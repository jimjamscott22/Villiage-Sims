use super::*;


impl super::World {
pub(crate) fn check_unlocks(&mut self) {
        let satisfied = self.satisfied_unlocks();
        let newly: Vec<String> = satisfied.difference(&self.unlocked).cloned().collect();
        for building in newly {
            let body = ChronicleBody::BuildingUnlocked { building };
            self.chronicle.push(&self.clock, None, body);
        }
        self.unlocked.extend(satisfied);
    }

pub fn satisfied_unlocks(&self) -> BTreeSet<String> {
        let population = self.villagers.len() as u32;
        let completed: BTreeSet<&str> = self
            .buildings
            .iter()
            .filter(|b| b.state == BuildState::Complete)
            .filter_map(|b| self.catalog.get(b.kind_index).map(|def| def.id.as_str()))
            .collect();

        self.catalog
            .buildings
            .iter()
            .filter(|def| match &def.unlock_conditions {
                None => true,
                Some(cond) => {
                    cond.min_population.is_none_or(|min| population >= min)
                        && cond
                            .requires_building
                            .as_deref()
                            .is_none_or(|req| completed.contains(req))
                }
            })
            .map(|def| def.id.clone())
            .collect()
    }
pub(crate) fn check_objectives(&mut self) {
        let newly: Vec<String> = self
            .catalog
            .objectives
            .iter()
            .filter(|obj| !self.completed_objectives.contains(&obj.id))
            .filter(|obj| self.objective_satisfied(&obj.condition))
            .map(|obj| obj.id.clone())
            .collect();
        self.completed_objectives.extend(newly);
    }
}
