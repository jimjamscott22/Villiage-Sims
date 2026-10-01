//! Assigned residences: one lasting hut home per villager (save version 6).
//!
//! Beds auto-fill from completed housing capacity (`houses` on the building
//! definition; 2 per hut today). When Sleep wins utility, housed villagers
//! path to a stand tile beside their home, rest there, then emerge. Homeless
//! villagers — or a lost/unreachable home — sleep in place as before.

use super::*;

impl super::World {
    /// Housing beds a building offers. Only completed buildings with a
    /// positive `houses` entry count (today: huts).
    pub(crate) fn home_capacity_of(&self, building: &Building) -> u32 {
        if building.state != BuildState::Complete {
            return 0;
        }
        self.catalog
            .get(building.kind_index)
            .and_then(|def| def.houses)
            .unwrap_or(0)
    }

    /// True when `building_id` can hold residents right now.
    pub(crate) fn valid_home(&self, building_id: u32) -> bool {
        self.buildings
            .iter()
            .find(|b| b.id == building_id)
            .is_some_and(|b| self.home_capacity_of(b) > 0)
    }

    /// Assigned-resident count per residence building, sorted by building id
    /// for deterministic fill order.
    fn home_occupancy(&self) -> BTreeMap<u32, u32> {
        let mut occupancy = BTreeMap::new();
        for villager in &self.villagers {
            if let Some(home) = villager.home {
                *occupancy.entry(home).or_insert(0) += 1;
            }
        }
        occupancy
    }

    /// Drop assignments that no longer point at a live residence (demolished,
    /// storm-damaged back to under-construction, or unknown after a load).
    /// Overfull huts keep their residents — capacity only gates new claims.
    /// Walks home that lost their residence fall back to normal decisioning;
    /// an in-progress rest at the old hut finishes out the night.
    pub(crate) fn clear_invalid_homes(&mut self) {
        let live: BTreeSet<u32> = self
            .buildings
            .iter()
            .filter(|b| self.home_capacity_of(b) > 0)
            .map(|b| b.id)
            .collect();
        for villager in &mut self.villagers {
            if villager.home.is_some_and(|id| !live.contains(&id)) {
                villager.home = None;
            }
            if villager.home.is_none()
                && matches!(
                    villager.state,
                    AgentState::MovingTo {
                        purpose: MovePurpose::Home,
                        ..
                    }
                )
            {
                villager.clear_path_to_idle();
                if villager.current_action == Some(ActionKind::Sleep) {
                    villager.current_action = None;
                }
            }
        }
    }

    /// Fill free beds for homeless villagers, in villager-id order onto
    /// building-id order. Deterministic: same world → same assignments.
    pub(crate) fn assign_homes(&mut self) {
        self.clear_invalid_homes();
        let mut occupancy = self.home_occupancy();
        let mut homes: Vec<u32> = self
            .buildings
            .iter()
            .filter(|b| self.home_capacity_of(b) > 0)
            .map(|b| b.id)
            .collect();
        homes.sort_unstable();
        let mut homeless: Vec<usize> = self
            .villagers
            .iter()
            .enumerate()
            .filter(|(_, v)| v.home.is_none())
            .map(|(index, _)| index)
            .collect();
        homeless.sort_by_key(|&index| self.villagers[index].id);
        for index in homeless {
            let Some(choice) = homes.iter().copied().find(|id| {
                let capacity = self
                    .buildings
                    .iter()
                    .find(|b| b.id == *id)
                    .map(|b| self.home_capacity_of(b))
                    .unwrap_or(0);
                occupancy.get(id).copied().unwrap_or(0) < capacity
            }) else {
                return;
            };
            self.villagers[index].home = Some(choice);
            *occupancy.entry(choice).or_insert(0) += 1;
        }
    }

    /// Stand tile beside a residence where its residents sleep.
    pub(crate) fn home_stand_tile(&self, building_id: u32) -> Option<(i32, i32)> {
        self.building_stand_tile(building_id)
    }

    /// Start the Sleep journey: path home when reachable, else rest in place.
    pub(crate) fn begin_sleep_at(&mut self, index: usize) {
        let home = self.villagers[index].home;
        let start = self.pos_to_tile(self.villagers[index].pos);
        if let Some(home_id) = home.filter(|id| self.valid_home(*id)) {
            if let Some(tile) = self.home_stand_tile(home_id) {
                if tile == start {
                    self.villagers[index].begin_sleeping();
                    self.villagers[index].set_thought(ActionKind::Sleep.thought(), 40);
                    return;
                }
                if let Some(path) = self.compute_path(start, tile) {
                    self.villagers[index].state = AgentState::MovingTo {
                        target: tile,
                        purpose: MovePurpose::Home,
                    };
                    self.villagers[index].path = Some(path);
                    self.villagers[index].current_action = Some(ActionKind::Sleep);
                    self.villagers[index].set_thought("Going home...", 40);
                    return;
                }
            }
        }
        self.villagers[index].begin_sleeping();
        self.villagers[index].set_thought(ActionKind::Sleep.thought(), 40);
    }

    /// Player reassignment: move a villager's home to another residence.
    /// `None` clears the assignment (villager sleeps in place until refilled).
    pub(crate) fn assign_home(
        &mut self,
        villager_id: u32,
        building_id: Option<u32>,
    ) -> Result<(), String> {
        let index = self
            .villagers
            .iter()
            .position(|v| v.id == villager_id)
            .ok_or_else(|| format!("unknown villager {villager_id}"))?;
        if let Some(building_id) = building_id {
            if !self.valid_home(building_id) {
                return Err(format!("building {building_id} is not a completed residence"));
            }
            let capacity = self
                .buildings
                .iter()
                .find(|b| b.id == building_id)
                .map(|b| self.home_capacity_of(b))
                .unwrap_or(0);
            let used = self
                .villagers
                .iter()
                .filter(|v| v.home == Some(building_id) && v.id != villager_id)
                .count() as u32;
            if used >= capacity {
                return Err(format!("building {building_id} has no free bed"));
            }
            self.villagers[index].home = Some(building_id);
        } else {
            self.villagers[index].home = None;
        }
        // A reassignment mid-journey repaths on the next decision: cancel a
        // stale walk home so the villager heads to the new home (or rests in
        // place when homeless). An in-progress rest at the old hut finishes —
        // the new home applies to the next Sleep.
        if matches!(
            self.villagers[index].state,
            AgentState::MovingTo {
                purpose: MovePurpose::Home,
                ..
            }
        ) {
            self.villagers[index].clear_path_to_idle();
            if self.villagers[index].current_action == Some(ActionKind::Sleep) {
                self.villagers[index].current_action = None;
            }
        }
        Ok(())
    }

    /// Clear residence links lost to a demolished building and release
    /// interrupted walks home back to normal decisioning.
    pub(crate) fn clear_homes_for_building(&mut self, building_id: u32) {
        for villager in &mut self.villagers {
            if villager.home == Some(building_id) {
                villager.home = None;
            }
            if villager.home.is_none()
                && matches!(
                    villager.state,
                    AgentState::MovingTo {
                        purpose: MovePurpose::Home,
                        ..
                    }
                )
            {
                villager.clear_path_to_idle();
                if villager.current_action == Some(ActionKind::Sleep) {
                    villager.current_action = None;
                }
            }
        }
    }

    /// Origin tile + definition id of a villager's residence, if valid.
    pub(crate) fn home_view(&self, villager: &Villager) -> Option<(u32, String, (i32, i32))> {
        let home = villager.home.filter(|id| self.valid_home(*id))?;
        let building = self.buildings.iter().find(|b| b.id == home)?;
        let def = self.catalog.get(building.kind_index)?;
        Some((home, def.id.clone(), building.origin))
    }

    /// Workplace name + origin tile for a claimed job, if still advertised.
    pub(crate) fn job_site_view(&self, villager: &Villager) -> Option<(u32, String, (i32, i32))> {
        let job_id = villager.current_job?;
        let job = self.job_board.get(job_id)?;
        let building = self.buildings.iter().find(|b| b.id == job.site)?;
        let def = self.catalog.get(building.kind_index)?;
        Some((job.site, def.id.clone(), building.origin))
    }

    /// Villager ids homed in a building, sorted — backs the map's
    /// residents readout on `BuildingView`.
    pub(crate) fn home_residents(&self, building_id: u32) -> Vec<u32> {
        let mut residents: Vec<u32> = self
            .villagers
            .iter()
            .filter(|v| v.home == Some(building_id))
            .map(|v| v.id)
            .collect();
        residents.sort_unstable();
        residents
    }

    /// Villager ids holding a claimed job at a building site, sorted.
    pub(crate) fn site_workers(&self, building_id: u32) -> Vec<u32> {
        let mut workers: Vec<u32> = self
            .job_board
            .jobs()
            .iter()
            .filter(|job| job.site == building_id)
            .filter_map(|job| job.claimed_by)
            .collect();
        workers.sort_unstable();
        workers.dedup();
        workers
    }
}
