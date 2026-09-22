use crate::sim::world::*;
use crate::sim::buildings::*;
use crate::sim::agents::*;
use crate::sim::chronicle::*;
use crate::sim::catalog::*;
use crate::sim::commands::*;
use crate::sim::crops::*;
use crate::sim::jobs::*;
use crate::sim::pathfind::*;
use crate::sim::terrain::*;
use std::collections::BTreeSet;


impl super::World {
pub(crate) fn check_population_dynamics(&mut self) {
        // An Eating villager has already consumed a ration. Let that activity
        // finish restoring hunger, even if food arrived just before starvation.
        let mut dead_ids = Vec::new();
        for v in &mut self.villagers {
            if v.needs.hunger == 0.0 && !matches!(v.state, AgentState::Eating { .. }) {
                v.starvation_ticks += 1;
                if v.starvation_ticks >= 300 {
                    dead_ids.push((v.id, v.name.clone()));
                }
            } else {
                v.starvation_ticks = 0;
            }
        }
        for (id, name) in &dead_ids {
            self.job_board.release_claimed_by(*id);
            if let Some(index) = self.villagers.iter().position(|v| v.id == *id) {
                if let Some(carrying) = self.villagers[index].carrying.take() {
                    self.deposit_to_stockpile(&carrying.resource, carrying.amount);
                }
                let focus = Some(self.pos_to_tile(self.villagers[index].pos));
                self.villagers.remove(index);
                let body = ChronicleBody::VillagerDied {
                    id: *id,
                    name: name.clone(),
                    cause: "starvation".to_string(),
                };
                self.chronicle.push(&self.clock, focus, body);
            }
        }

        // Birth checks
        let capacity = self.housing_capacity();
        if (self.villagers.len() as u32) < capacity
            && self.clock.tick % 200 == 0
            && !self.villagers.is_empty()
        {
            let next_id = self.next_villager_id;
            self.next_villager_id = self.next_villager_id.saturating_add(1);
            let name_idx = (next_id as usize) % EXTRA_VILLAGER_NAMES.len();
            let name = EXTRA_VILLAGER_NAMES[name_idx].to_string();
            let cx = self.width as i32 / 2;
            let cy = self.height as i32 / 2;
            if let Some(tile) = self.find_walkable_near(cx, cy) {
                let pos = self.tile_center(tile.0, tile.1);
                let traits_pool: Vec<String> =
                    self.catalog.traits.iter().map(|t| t.id.clone()).collect();
                let mut v_traits = Vec::new();
                if !traits_pool.is_empty() {
                    v_traits.push(traits_pool[(next_id as usize) % traits_pool.len()].clone());
                }
                self.villagers
                    .push(Villager::new(next_id, name.clone(), pos).with_traits(v_traits));
                let body = ChronicleBody::VillagerBorn { id: next_id, name };
                self.chronicle.push(&self.clock, Some(tile), body);
            }
        }
    }
pub(crate) fn spawn_starting_villagers(&mut self) {
        let cx = self.width as i32 / 2;
        let cy = self.height as i32 / 2;
        let mut used = Vec::new();
        let traits_pool: Vec<String> = self.catalog.traits.iter().map(|t| t.id.clone()).collect();
        for (i, name) in STARTING_VILLAGER_NAMES.iter().enumerate() {
            let id = (i as u32) + 1;
            let tile = self
                .find_spawn_tile(cx, cy, &used)
                .unwrap_or((cx + i as i32, cy));
            used.push(tile);
            let pos = self.tile_center(tile.0, tile.1);
            let mut v_traits = Vec::new();
            if !traits_pool.is_empty() {
                v_traits.push(traits_pool[i % traits_pool.len()].clone());
            }
            self.villagers
                .push(Villager::new(id, *name, pos).with_traits(v_traits));
            self.next_villager_id = id.saturating_add(1);
        }
    }
pub(crate) fn find_spawn_tile(&self, cx: i32, cy: i32, used: &[(i32, i32)]) -> Option<(i32, i32)> {
        if let Some(tile) = self.find_walkable_near(cx, cy) {
            if !used.contains(&tile) {
                return Some(tile);
            }
        }
        let max_r = self.width.max(self.height) as i32;
        for r in 0..=max_r {
            for dy in -r..=r {
                for dx in -r..=r {
                    if dx.abs() != r && dy.abs() != r && r > 0 {
                        continue;
                    }
                    let x = cx + dx;
                    let y = cy + dy;
                    if used.contains(&(x, y)) {
                        continue;
                    }
                    if self.is_spawn_candidate(x, y) {
                        return Some((x, y));
                    }
                }
            }
        }
        None
    }
pub(crate) fn is_spawn_candidate(&self, x: i32, y: i32) -> bool {
        if !self.is_passable(x, y) {
            return false;
        }
        for (dx, dy) in [(1, 0), (-1, 0), (0, 1), (0, -1)] {
            if self.is_passable(x + dx, y + dy) {
                return true;
            }
        }
        false
    }
}
