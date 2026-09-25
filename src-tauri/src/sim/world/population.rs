use super::*;


impl super::World {
pub(crate) fn check_population_dynamics(&mut self) {
        // An Eating/Drinking villager has already started restoring that need.
        // Let the activity finish rather than letting it harm health meanwhile.
        let mut dead_ids = Vec::new();
        for v in &mut self.villagers {
            let starving = v.needs.hunger == 0.0 && !matches!(v.state, AgentState::Eating { .. });
            let parched = v.needs.thirst == 0.0 && !matches!(v.state, AgentState::Drinking { .. });
            if v.needs.tick_health(starving, parched) {
                let cause = if starving {
                    "starvation"
                } else {
                    "dehydration"
                };
                dead_ids.push((v.id, v.name.clone(), cause));
            }
        }
        for (id, name, cause) in &dead_ids {
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
                    cause: cause.to_string(),
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
        // Everyone after the first must spawn where the first villager can walk,
        // and the first picks an area with a route to water, or the whole village
        // starts walled in and dies of thirst.
        let mut home: Option<Vec<bool>> = None;
        let traits_pool: Vec<String> = self.catalog.traits.iter().map(|t| t.id.clone()).collect();
        for (i, name) in STARTING_VILLAGER_NAMES.iter().enumerate() {
            let id = (i as u32) + 1;
            let tile = match home {
                None => self.first_spawn_tile(cx, cy),
                Some(ref region) => self.find_spawn_tile(cx, cy, &used, Some(region)),
            }
            .unwrap_or((cx + i as i32, cy));
            if home.is_none() {
                home = Some(self.reachable_from(tile));
            }
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

pub(crate) fn first_spawn_tile(&self, cx: i32, cy: i32) -> Option<(i32, i32)> {
        let preferred = self.find_spawn_tile(cx, cy, &[], None)?;
        if self.nearest_water_access(preferred).is_some() {
            return Some(preferred);
        }
        // Each landlocked area is searched once, then skipped wholesale.
        let mut landlocked = self.reachable_from(preferred);
        let max_r = self.width.max(self.height) as i32;
        for r in 0..=max_r {
            for dy in -r..=r {
                for dx in -r..=r {
                    if dx.abs() != r && dy.abs() != r {
                        continue;
                    }
                    let (x, y) = (cx + dx, cy + dy);
                    if !self.is_spawn_candidate(x, y)
                        || landlocked[(y as u32 * self.width + x as u32) as usize]
                    {
                        continue;
                    }
                    if self.nearest_water_access((x, y)).is_some() {
                        return Some((x, y));
                    }
                    for (seen, reached) in landlocked.iter_mut().zip(self.reachable_from((x, y))) {
                        *seen |= reached;
                    }
                }
            }
        }
        Some(preferred)
    }

/// Tiles walkable-connected to `start` (4-neighbour, matching A*'s no corner-cutting).
pub(crate) fn reachable_from(&self, start: (i32, i32)) -> Vec<bool> {
        let mut seen = vec![false; self.tiles.len()];
        if !self.is_passable(start.0, start.1) {
            return seen;
        }
        let width = self.width as i32;
        seen[(start.1 * width + start.0) as usize] = true;
        let mut queue = VecDeque::from([start]);
        while let Some((x, y)) = queue.pop_front() {
            for (dx, dy) in [(1, 0), (-1, 0), (0, 1), (0, -1)] {
                let (nx, ny) = (x + dx, y + dy);
                if self.is_passable(nx, ny) && !seen[(ny * width + nx) as usize] {
                    seen[(ny * width + nx) as usize] = true;
                    queue.push_back((nx, ny));
                }
            }
        }
        seen
    }
pub(crate) fn find_spawn_tile(
        &self,
        cx: i32,
        cy: i32,
        used: &[(i32, i32)],
        region: Option<&[bool]>,
    ) -> Option<(i32, i32)> {
        let in_region = |(x, y): (i32, i32)| {
            region.is_none_or(|r| {
                self.in_bounds(x, y) && r[(y as u32 * self.width + x as u32) as usize]
            })
        };
        if let Some(tile) = self.find_walkable_near(cx, cy) {
            if !used.contains(&tile) && in_region(tile) {
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
                    if self.is_spawn_candidate(x, y) && in_region((x, y)) {
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
