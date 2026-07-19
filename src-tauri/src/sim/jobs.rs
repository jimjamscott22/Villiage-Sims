/// Job board: buildings advertise jobs; villagers claim them (Milestone 5).

use super::catalog::BuildingDef;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum JobKind {
    TendCrops,
}

impl JobKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::TendCrops => "tend_crops",
        }
    }

    pub fn from_catalog(kind: &str) -> Option<Self> {
        match kind {
            "tend_crops" => Some(Self::TendCrops),
            _ => None, // haul etc. deferred to later milestones
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
                });
            }
        }
    }

    pub fn remove_site(&mut self, site: u32) -> Vec<u32> {
        let released: Vec<u32> = self
            .jobs
            .iter()
            .filter(|job| job.site == site)
            .filter_map(|job| job.claimed_by)
            .collect();
        self.jobs.retain(|job| job.site != site);
        released
    }

    pub fn release(&mut self, job_id: u32, villager_id: u32) {
        if let Some(job) = self.jobs.iter_mut().find(|job| job.id == job_id) {
            if job.claimed_by == Some(villager_id) {
                job.claimed_by = None;
            }
        }
    }

    #[allow(dead_code)]
    pub fn release_villager(&mut self, villager_id: u32) {
        for job in &mut self.jobs {
            if job.claimed_by == Some(villager_id) {
                job.claimed_by = None;
            }
        }
    }

    /// Claim the best unclaimed job by `priority / (1 + manhattan_distance)`.
    pub fn claim_best(&mut self, villager_id: u32, from: (i32, i32)) -> Option<u32> {
        let mut best: Option<(usize, f32)> = None;
        for (index, job) in self.jobs.iter().enumerate() {
            if job.claimed_by.is_some() {
                continue;
            }
            let dist = (job.tile.0 - from.0).abs() + (job.tile.1 - from.1).abs();
            let score = f32::from(job.priority) / (1.0 + dist as f32);
            match best {
                Some((_, best_score)) if score <= best_score => {}
                _ => best = Some((index, score)),
            }
        }
        let (index, _) = best?;
        self.jobs[index].claimed_by = Some(villager_id);
        Some(self.jobs[index].id)
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
        assert_eq!(board.jobs().len(), 2); // farm has slots: 2
        assert!(board.jobs().iter().all(|j| j.kind == JobKind::TendCrops));
        assert!(board.jobs().iter().all(|j| j.site == 10));
        assert!(board.jobs().iter().all(|j| j.claimed_by.is_none()));
    }

    #[test]
    fn claim_prefers_closer_higher_priority() {
        let mut board = JobBoard::new();
        board.jobs.push(Job {
            id: 1,
            kind: JobKind::TendCrops,
            site: 1,
            tile: (10, 0),
            priority: 10,
            claimed_by: None,
        });
        board.jobs.push(Job {
            id: 2,
            kind: JobKind::TendCrops,
            site: 2,
            tile: (1, 0),
            priority: 10,
            claimed_by: None,
        });
        let claimed = board.claim_best(7, (0, 0)).unwrap();
        assert_eq!(claimed, 2);
        assert_eq!(board.get(2).unwrap().claimed_by, Some(7));
        assert!(board.get(1).unwrap().claimed_by.is_none());
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
        });
        let released = board.remove_site(5);
        assert_eq!(released, vec![3]);
        assert!(board.jobs().is_empty());
    }

    #[test]
    fn granary_haul_not_advertised_in_m5() {
        let catalog = Catalog::load_builtin().unwrap();
        let granary = catalog.find("granary").unwrap().1;
        let mut board = JobBoard::new();
        board.advertise_for_building(1, granary, &[(0, 0)], 5);
        assert!(board.jobs().is_empty());
    }
}
