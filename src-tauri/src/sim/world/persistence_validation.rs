use super::*;


impl super::World {
pub(crate) fn prepare_after_load(&mut self) -> Result<(), String> {
        if self.width == 0 || self.height == 0 || self.tile_size == 0 {
            return Err("save has invalid world dimensions".into());
        }
        let expected_len =
            self.width
                .checked_mul(self.height)
                .ok_or_else(|| "save world dimensions overflow".to_string())? as usize;
        if self.tiles.len() != expected_len || self.occupancy.len() != expected_len {
            return Err("save world grid length does not match its dimensions".into());
        }
        if self
            .tiles
            .iter()
            .any(|terrain| Terrain::from_u8(*terrain).is_none())
        {
            return Err("save contains an unknown terrain value".into());
        }
        self.catalog.validate()?;

        let mut building_ids = BTreeSet::new();
        let mut expected_occupancy = vec![None; expected_len];
        for building in &self.buildings {
            if building.id == 0 || !building_ids.insert(building.id) {
                return Err(format!(
                    "save contains invalid or duplicate building id {}",
                    building.id
                ));
            }
            let def = self
                .catalog
                .get(building.kind_index)
                .ok_or_else(|| format!("building {} has an unknown kind", building.id))?;
            for (x, y) in
                footprint_tiles(building.origin, rotated_footprint(def, building.rotation))
            {
                if x < 0 || y < 0 || x >= self.width as i32 || y >= self.height as i32 {
                    return Err(format!("building {} is outside the world", building.id));
                }
                let index = y as usize * self.width as usize + x as usize;
                if expected_occupancy[index].replace(building.id).is_some() {
                    return Err("save contains overlapping buildings".into());
                }
            }
        }
        if self.occupancy != expected_occupancy {
            return Err("save building occupancy is inconsistent".into());
        }
        if self.next_building_id <= building_ids.last().copied().unwrap_or(0) {
            return Err("save has an invalid next building id".into());
        }

        let mut crop_ids = BTreeSet::new();
        for crop in &self.crops {
            if crop.id == 0 || !crop_ids.insert(crop.id) {
                return Err(format!(
                    "save contains invalid or duplicate crop id {}",
                    crop.id
                ));
            }
            let def = self
                .catalog
                .get_crop(crop.kind_index)
                .ok_or_else(|| format!("crop {} has an unknown kind", crop.id))?;
            if crop.kind != def.id {
                return Err(format!(
                    "crop {} kind does not match its catalog entry",
                    crop.id
                ));
            }
            if crop.tile.0 < 0
                || crop.tile.1 < 0
                || crop.tile.0 >= self.width as i32
                || crop.tile.1 >= self.height as i32
            {
                return Err(format!("crop {} is outside the world", crop.id));
            }
        }
        if self.next_crop_id <= crop_ids.last().copied().unwrap_or(0) {
            return Err("save has an invalid next crop id".into());
        }

        let mut villager_ids = BTreeSet::new();
        let world_width = self.width as f32 * self.tile_size as f32;
        let world_height = self.height as f32 * self.tile_size as f32;
        for villager in &self.villagers {
            if villager.id == 0 || !villager_ids.insert(villager.id) {
                return Err(format!(
                    "save contains invalid or duplicate villager id {}",
                    villager.id
                ));
            }
            if !villager.pos.0.is_finite()
                || !villager.pos.1.is_finite()
                || villager.pos.0 < 0.0
                || villager.pos.1 < 0.0
                || villager.pos.0 >= world_width
                || villager.pos.1 >= world_height
            {
                return Err(format!("villager {} has an invalid position", villager.id));
            }
            for need in [
                villager.needs.hunger,
                villager.needs.energy,
                villager.needs.social,
                villager.needs.thirst,
                villager.needs.health,
                villager.needs.happiness,
            ] {
                if !need.is_finite() || !(0.0..=1.0).contains(&need) {
                    return Err(format!("villager {} has invalid needs", villager.id));
                }
            }
        }
        if self.next_villager_id <= villager_ids.last().copied().unwrap_or(0) {
            return Err("save has an invalid next villager id".into());
        }
        self.job_board
            .validate_loaded(&villager_ids, &building_ids)?;

        self.validate_behavior()?;
        self.leisure_cache = Default::default();
        self.viewport = Viewport {
            x: 0.0,
            y: 0.0,
            w: world_width,
            h: world_height,
        };
        Ok(())
    }
}
