use super::*;


impl super::World {
pub fn handle_command(&mut self, command: SimCommand) {
        match command {
            SimCommand::SetViewport { x, y, w, h } => {
                self.viewport = Viewport { x, y, w, h };
            }
            SimCommand::ValidatePlacement {
                kind,
                x,
                y,
                rotation,
                reply,
            } => {
                let validity = self.validate_placement(&kind, x, y, rotation);
                let _ = reply.send(validity);
            }
            SimCommand::PlaceBuilding {
                kind,
                x,
                y,
                rotation,
                reply,
            } => {
                let result = self.place_building(&kind, x, y, rotation);
                let _ = reply.send(result);
            }
            SimCommand::Demolish { entity_id, reply } => {
                let result = self.demolish(entity_id);
                let _ = reply.send(result);
            }
            SimCommand::MoveVillagerTo {
                x,
                y,
                villager_id,
                reply,
            } => {
                let result = self.order_move_villager(x, y, villager_id);
                let _ = reply.send(result);
            }
            SimCommand::GetVillagerDetail { id, reply } => {
                let result = self.villager_detail(id);
                let _ = reply.send(result);
            }
            SimCommand::SetSpeed { speed } => {
                let _ = self.clock.set_speed(speed);
            }
            SimCommand::PlantCrop { kind, x, y, reply } => {
                let result = self.plant_crop(&kind, x, y);
                let _ = reply.send(result);
            }
            SimCommand::AdvanceClock {
                days,
                season,
                reply,
            } => {
                let result = self.advance_clock(days, season);
                let _ = reply.send(result);
            }
            SimCommand::GetTerrain { reply } => {
                let _ = reply.send(self.terrain_snapshot());
            }
            SimCommand::GetChronicle { reply } => {
                let views: Vec<_> = self.chronicle.entries().map(|e| e.view()).collect();
                let _ = reply.send(views);
            }
            SimCommand::SaveGame { path, reply } => {
                let _ = reply.send(crate::persist::save_world(self, &path));
            }
            SimCommand::LoadGame { path, reply } => {
                let autosave_dir = self.autosave_dir.clone();
                let result = crate::persist::load_world(&path).map(|loaded| {
                    *self = loaded;
                    self.autosave_dir = autosave_dir;
                    self.last_autosave_slot = None;
                    self.world_init(crate::persist::SAVE_VERSION)
                });
                let _ = reply.send(result);
            }
        }
    }

pub fn validate_placement(
        &self,
        kind: &str,
        x: i32,
        y: i32,
        rotation: u8,
    ) -> PlacementValidity {
        let Some((kind_index, def)) = self.catalog.find(kind) else {
            return PlacementValidity {
                valid: false,
                reason: format!("unknown building '{kind}'"),
            };
        };
        let _ = kind_index;
        // The frontend hides locked buildings, but it holds no authoritative state —
        // the sim must reject a direct placement attempt too (e.g. a raw `invoke`
        // bypassing the UI). Gating here also covers `validate_placement`, so the
        // ghost preview reflects the lock without a second check.
        if !self.unlocked.contains(&def.id) {
            return PlacementValidity {
                valid: false,
                reason: format!("{} is locked", def.id),
            };
        }
        let footprint = rotated_footprint(def, rotation);
        let tiles = footprint_tiles((x, y), footprint);

        for (tx, ty) in tiles {
            if tx < 0 || ty < 0 || tx >= self.width as i32 || ty >= self.height as i32 {
                return PlacementValidity {
                    valid: false,
                    reason: "out of bounds".into(),
                };
            }
            let index = (ty as u32 * self.width + tx as u32) as usize;
            let terrain = Terrain::from_u8(self.tiles[index]).unwrap_or(Terrain::DeepWater);
            if !terrain_allowed(def, terrain) {
                return PlacementValidity {
                    valid: false,
                    reason: format!("invalid terrain for {}", def.id),
                };
            }
            if self.occupancy[index].is_some() {
                return PlacementValidity {
                    valid: false,
                    reason: "tile occupied".into(),
                };
            }
        }

        if !self.derived_resources().can_afford(&def.cost) {
            return PlacementValidity {
                valid: false,
                reason: "insufficient resources".into(),
            };
        }

        PlacementValidity {
            valid: true,
            reason: String::new(),
        }
    }

pub fn place_building(
        &mut self,
        kind: &str,
        x: i32,
        y: i32,
        rotation: u8,
    ) -> Result<PlacementResult, String> {
        let validity = self.validate_placement(kind, x, y, rotation);
        if !validity.valid {
            return Err(validity.reason);
        }
        let (kind_index, footprint, cost) = {
            let (kind_index, def) = self
                .catalog
                .find(kind)
                .ok_or_else(|| format!("unknown building '{kind}'"))?;
            (
                kind_index,
                rotated_footprint(def, rotation),
                def.cost.clone(),
            )
        };
        let tiles = footprint_tiles((x, y), footprint);
        self.withdraw_cost(&cost)?;

        let id = self.next_building_id;
        self.next_building_id = self.next_building_id.saturating_add(1);
        for (tx, ty) in &tiles {
            let index = (*ty as u32 * self.width + *tx as u32) as usize;
            self.occupancy[index] = Some(id);
        }
        self.buildings.push(Building {
            id,
            kind_index,
            origin: (x, y),
            rotation: rotation % 4,
            state: BuildState::UnderConstruction { progress_ticks: 0 },
            inventory: BTreeMap::new(),
            recipe_ticks: 0,
        });
        self.invalidate_paths_if_needed();
        Ok(PlacementResult { id })
    }

pub fn demolish(&mut self, entity_id: u32) -> Result<(), String> {
        let index = self
            .buildings
            .iter()
            .position(|building| building.id == entity_id)
            .ok_or_else(|| format!("unknown building {entity_id}"))?;
        let building = self.buildings.remove(index);
        let def = self
            .catalog
            .get(building.kind_index)
            .ok_or_else(|| "missing building definition".to_string())?
            .clone();
        let footprint = rotated_footprint(&def, building.rotation);
        let tiles = footprint_tiles(building.origin, footprint);
        for (tx, ty) in &tiles {
            if *tx < 0 || *ty < 0 || *tx >= self.width as i32 || *ty >= self.height as i32 {
                continue;
            }
            let tile_index = (*ty as u32 * self.width + *tx as u32) as usize;
            if self.occupancy[tile_index] == Some(entity_id) {
                self.occupancy[tile_index] = None;
            }
        }
        self.remove_crops_on_tiles(&tiles);
        for (resource, amount) in building.inventory {
            self.deposit_to_stockpile(&resource, amount);
        }
        self.resources.refund(&def.cost);
        let released = self.job_board.remove_site(entity_id);
        for villager in &mut self.villagers {
            if released.contains(&villager.id) {
                villager.current_job = None;
                if matches!(
                    villager.state,
                    AgentState::Working { .. }
                        | AgentState::MovingTo {
                            purpose: MovePurpose::Work,
                            ..
                        }
                ) {
                    villager.clear_path_to_idle();
                }
            } else if let Some(job_id) = villager.current_job {
                if self.job_board.get(job_id).is_none() {
                    villager.current_job = None;
                }
            }
        }
        Ok(())
    }

pub fn plant_crop(&mut self, kind: &str, x: i32, y: i32) -> Result<(), String> {
        let (kind_index, def) = self
            .catalog
            .find_crop(kind)
            .ok_or_else(|| format!("unknown crop '{kind}'"))?;
        let _ = def;
        let farm_id = self
            .completed_farm_at(x, y)
            .ok_or_else(|| "tile is not on a completed farm".to_string())?;
        let _ = farm_id;
        if self.crops.iter().any(|crop| crop.tile == (x, y)) {
            return Err("tile already has a crop".into());
        }
        let id = self.next_crop_id;
        self.next_crop_id = self.next_crop_id.saturating_add(1);
        self.crops
            .push(Crop::new(id, kind.to_string(), kind_index, (x, y)));
        Ok(())
    }
}
