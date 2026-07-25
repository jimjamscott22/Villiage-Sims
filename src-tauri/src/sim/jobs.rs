/// Job board: buildings advertise jobs; villagers claim them.
use super::catalog::BuildingDef;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum JobKind {
    TendCrops,
    Gather,
    Haul,
    Produce,
}

impl JobKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::TendCrops => "tend_crops",
            Self::Gather => "gather",
            Self::Haul => "haul",
            Self::Produce => "produce",
        }
    }

    pub fn from_catalog(kind: &str) -> Option<Self> {
        match kind {
            "tend_crops" => Some(Self::TendCrops),
            "gather" => Some(Self::Gather),
            "haul" => Some(Self::Haul),
            "produce" => Some(Self::Produce),
            _ => None,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Job {
    pub id: u32,
    pub kind: JobKind,
    pub site: u32,
    /// Walkable tile where the worker stands.
    pub tile: (i32, i32),
    pub priority: u8,
    pub claimed_by: Option<u32>,
    /// For Gather jobs: the resource node tile.
    pub gather_tile: Option<(i32, i32)>,
}

#[derive(Clone, Debug, Default)]
pub struct JobBoard {
    jobs: Vec<Job>,
    next_id: u32,
}

impl JobBoard {
    pub fn new() -> Self {
        Self {
            jobs: Vec::new(),
            next_id: 1,
        }
    }

    pub fn jobs(&self) -> &[Job] {
        &self.jobs
    }

    pub fn get(&self, id: u32) -> Option<&Job> {
        self.jobs.iter().find(|job| job.id == id)
    }

    /// Advertise jobs for a completed building. `stand_tiles` are candidate
    /// walkable tiles adjacent to the footprint (consumed in order, one per slot).
    pub fn advertise_for_building(
        &mut self,
        site: u32,
        def: &BuildingDef,
        stand_tiles: &[(i32, i32)],
        priority: u8,
    ) {
        // Replace any stale jobs for this site (e.g. re-complete edge case).
        self.remove_site(site);
        let mut tile_iter = stand_tiles.iter().copied();
        for job_def in &def.jobs {
            let Some(kind) = JobKind::from_catalog(&job_def.kind) else {
                continue;
            };
            for _ in 0..job_def.slots {
                let Some(tile) = tile_iter.next() else {
                    return;
                };
                let id = self.next_id;
                self.next_id = self.next_id.saturating_add(1);
                self.jobs.push(Job {
                    id,
                    kind,
                    site,
                    tile,
                    priority,
                    claimed_by: None,
                    gather_tile: None,
                });
            }
        }
    }

    pub fn advertise_gather(
        &mut self,
        stand: (i32, i32),
        node_tile: (i32, i32),
        priority: u8,
    ) -> u32 {
        let id = self.next_id;
        self.next_id = self.next_id.saturating_add(1);
        self.jobs.push(Job {
            id,
            kind: JobKind::Gather,
            site: 0,
            tile: stand,
            priority,
            claimed_by: None,
            gather_tile: Some(node_tile),
        });
        id
    }

    pub fn remove_gather_jobs_for_node(&mut self, node_tile: (i32, i32)) -> Vec<u32> {
        let mut released = Vec::new();
        self.jobs.retain(|job| {
            if job.kind == JobKind::Gather && job.gather_tile == Some(node_tile) {
                if let Some(villager) = job.claimed_by {
                    released.push(villager);
                }
                false
            } else {
                true
            }
        });
        released
    }

    pub fn gather_job_count(&self) -> usize {
        self.jobs
            .iter()
            .filter(|job| job.kind == JobKind::Gather)
            .count()
    }

    pub fn has_gather_for_node(&self, node_tile: (i32, i32)) -> bool {
        self.jobs
            .iter()
            .any(|job| job.kind == JobKind::Gather && job.gather_tile == Some(node_tile))
    }

    /// Remove all jobs for a building site; return villager ids that held claims.
    pub fn remove_site(&mut self, site: u32) -> Vec<u32> {
        let mut released = Vec::new();
        self.jobs.retain(|job| {
            if job.site == site && job.kind != JobKind::Gather {
                if let Some(villager) = job.claimed_by {
                    released.push(villager);
                }
                false
            } else {
                true
            }
        });
        released
    }

    pub fn release(&mut self, job_id: u32, villager_id: u32) {
        if let Some(job) = self.jobs.iter_mut().find(|job| job.id == job_id) {
            if job.claimed_by == Some(villager_id) {
                job.claimed_by = None;
            }
        }
    }

    pub fn claim_id(&mut self, job_id: u32, villager_id: u32) -> bool {
        let Some(job) = self.jobs.iter_mut().find(|job| job.id == job_id) else {
            return false;
        };
        match job.claimed_by {
            None => {
                job.claimed_by = Some(villager_id);
                true
            }
            Some(id) if id == villager_id => true,
            Some(_) => false,
        }
    }

    /// Peek best unclaimed (or already claimed by this villager) job without claiming.
    pub fn peek_best(&self, villager_id: u32, from: (i32, i32)) -> Option<(u32, u8, i32)> {
        let mut best: Option<(u32, u8, i32)> = None;
        for job in &self.jobs {
            if let Some(owner) = job.claimed_by {
                if owner != villager_id {
                    continue;
                }
            }
            let dist = (job.tile.0 - from.0).abs() + (job.tile.1 - from.1).abs();
            match best {
                None => best = Some((job.id, job.priority, dist)),
                Some((_, priority, best_dist))
                    if job.priority > priority
                        || (job.priority == priority && dist < best_dist) =>
                {
                    best = Some((job.id, job.priority, dist));
                }
                _ => {}
            }
        }
        best
    }

    #[cfg(test)]
    pub fn jobs_mut_for_test(&mut self) -> &mut Vec<Job> {
        &mut self.jobs
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sim::catalog::Catalog;

    #[test]
    fn farm_advertises_tend_crops_slots() {
        let catalog = Catalog::load_builtin().unwrap();
        let farm = catalog.find("farm").unwrap().1;
        let mut board = JobBoard::new();
        let tiles = [(1, 0), (2, 0), (3, 0)];
        board.advertise_for_building(10, farm, &tiles, 10);
        assert_eq!(board.jobs().len(), 2);
        assert!(board.jobs().iter().all(|j| j.kind == JobKind::TendCrops));
        assert!(board.jobs().iter().all(|j| j.site == 10));
        assert!(board.jobs().iter().all(|j| j.claimed_by.is_none()));
    }

    #[test]
    fn peek_prefers_closer_job_at_equal_priority() {
        let mut board = JobBoard::new();
        board.jobs.push(Job {
            id: 1,
            kind: JobKind::TendCrops,
            site: 1,
            tile: (10, 0),
            priority: 10,
            claimed_by: None,
            gather_tile: None,
        });
        board.jobs.push(Job {
            id: 2,
            kind: JobKind::TendCrops,
            site: 2,
            tile: (1, 0),
            priority: 10,
            claimed_by: None,
            gather_tile: None,
        });
        let best = board.peek_best(7, (0, 0)).unwrap();
        assert_eq!(best.0, 2);
        assert!(board.get(2).unwrap().claimed_by.is_none());
        assert!(board.get(1).unwrap().claimed_by.is_none());
    }

    #[test]
    fn peek_prefers_priority_over_distance() {
        let mut board = JobBoard::new();
        board.jobs.push(Job {
            id: 1,
            kind: JobKind::Gather,
            site: 0,
            tile: (1, 0),
            priority: 8,
            claimed_by: None,
            gather_tile: Some((1, 0)),
        });
        board.jobs.push(Job {
            id: 2,
            kind: JobKind::TendCrops,
            site: 2,
            tile: (10, 0),
            priority: 10,
            claimed_by: None,
            gather_tile: None,
        });

        assert_eq!(board.peek_best(7, (0, 0)).map(|best| best.0), Some(2));
    }

    #[test]
    fn remove_site_releases_claimants() {
        let mut board = JobBoard::new();
        board.jobs.push(Job {
            id: 1,
            kind: JobKind::TendCrops,
            site: 5,
            tile: (0, 0),
            priority: 10,
            claimed_by: Some(3),
            gather_tile: None,
        });
        let released = board.remove_site(5);
        assert_eq!(released, vec![3]);
        assert!(board.jobs().is_empty());
    }

    #[test]
    fn granary_advertises_haul_in_m8() {
        let catalog = Catalog::load_builtin().unwrap();
        let granary = catalog.find("granary").unwrap().1;
        let mut board = JobBoard::new();
        board.advertise_for_building(1, granary, &[(0, 0)], 5);
        assert_eq!(board.jobs().len(), 1);
        assert_eq!(board.jobs()[0].kind, JobKind::Haul);
    }

    #[test]
    fn mill_advertises_produce_and_haul() {
        let catalog = Catalog::load_builtin().unwrap();
        let mill = catalog.find("mill").unwrap().1;
        let mut board = JobBoard::new();
        board.advertise_for_building(2, mill, &[(0, 0), (1, 0)], 10);
        assert_eq!(board.jobs().len(), 2);
        assert!(board.jobs().iter().any(|j| j.kind == JobKind::Produce));
        assert!(board.jobs().iter().any(|j| j.kind == JobKind::Haul));
    }
}
