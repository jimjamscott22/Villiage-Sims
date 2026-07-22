//! Crop entities, growth, watering, and seasonal gating (Milestone 6).

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use super::clock::Season;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CropDef {
    pub id: String,
    pub name: String,
    pub stages: u8,
    #[serde(alias = "ticks_per_stage")]
    pub ticks_per_stage: u32,
    pub seasons: Vec<String>,
    #[serde(alias = "water_required")]
    pub water_required: bool,
    #[serde(default)]
    pub r#yield: BTreeMap<String, u32>,
    #[serde(default, alias = "seed_cost")]
    pub seed_cost: BTreeMap<String, u32>,
}

impl CropDef {
    pub fn max_stage(&self) -> u8 {
        self.stages.saturating_sub(1)
    }

    pub fn grows_in(&self, season: Season) -> bool {
        self.seasons
            .iter()
            .any(|name| Season::from_name(name) == Some(season))
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct Crop {
    pub id: u32,
    pub kind: String,
    pub kind_index: u8,
    pub tile: (i32, i32),
    pub stage: u8,
    pub growth_ticks: u32,
    pub watered: bool,
    pub ready_emitted: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct CropView {
    pub id: u32,
    pub x: i32,
    pub y: i32,
    pub kind: u8,
    pub stage: u8,
}

impl Crop {
    pub fn new(id: u32, kind: String, kind_index: u8, tile: (i32, i32)) -> Self {
        Self {
            id,
            kind,
            kind_index,
            tile,
            stage: 0,
            growth_ticks: 0,
            watered: false,
            ready_emitted: false,
        }
    }

    pub fn view(&self) -> CropView {
        CropView {
            id: self.id,
            x: self.tile.0,
            y: self.tile.1,
            kind: self.kind_index,
            stage: self.stage,
        }
    }
}

/// Advance one crop by a tick. Returns `true` the first time it reaches max stage.
pub fn tick_crop(crop: &mut Crop, def: &CropDef, season: Season) -> bool {
    let max_stage = def.max_stage();
    if crop.stage >= max_stage {
        return false;
    }
    if !def.grows_in(season) {
        return false;
    }
    if def.water_required && !crop.watered {
        return false;
    }
    crop.growth_ticks = crop.growth_ticks.saturating_add(1);
    if crop.growth_ticks < def.ticks_per_stage {
        return false;
    }
    crop.growth_ticks = 0;
    crop.stage = crop.stage.saturating_add(1).min(max_stage);
    if crop.stage >= max_stage && !crop.ready_emitted {
        crop.ready_emitted = true;
        return true;
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    fn wheat() -> CropDef {
        CropDef {
            id: "wheat".into(),
            name: "Wheat".into(),
            stages: 4,
            ticks_per_stage: 3,
            seasons: vec!["spring".into(), "summer".into()],
            water_required: true,
            r#yield: BTreeMap::new(),
            seed_cost: BTreeMap::new(),
        }
    }

    #[test]
    fn growth_requires_water_and_season() {
        let def = wheat();
        let mut crop = Crop::new(1, "wheat".into(), 0, (0, 0));
        assert!(!tick_crop(&mut crop, &def, Season::Spring));
        crop.watered = true;
        for _ in 0..2 {
            assert!(!tick_crop(&mut crop, &def, Season::Spring));
        }
        assert!(!tick_crop(&mut crop, &def, Season::Spring)); // stage-up, not yet ready
        assert_eq!(crop.stage, 1);
    }

    #[test]
    fn winter_stalls_wheat() {
        let def = wheat();
        let mut crop = Crop::new(1, "wheat".into(), 0, (0, 0));
        crop.watered = true;
        for _ in 0..10 {
            assert!(!tick_crop(&mut crop, &def, Season::Winter));
        }
        assert_eq!(crop.stage, 0);
    }

    #[test]
    fn crop_ready_emits_once() {
        let def = CropDef {
            ticks_per_stage: 1,
            ..wheat()
        };
        let mut crop = Crop::new(1, "wheat".into(), 0, (0, 0));
        crop.watered = true;
        assert!(!tick_crop(&mut crop, &def, Season::Spring)); // stage 1
        assert!(!tick_crop(&mut crop, &def, Season::Spring)); // stage 2
        assert!(tick_crop(&mut crop, &def, Season::Spring)); // stage 3 ready
        assert!(!tick_crop(&mut crop, &def, Season::Spring)); // already max
        assert_eq!(crop.stage, 3);
        assert!(crop.ready_emitted);
    }
}
