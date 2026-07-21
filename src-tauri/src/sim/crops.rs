use super::catalog::CropDef;
use super::clock::Season;

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

    pub fn max_stage(def: &CropDef) -> u8 {
        def.stages.saturating_sub(1)
    }

    /// Returns true if this tick emitted `CropReady` for the first time.
    pub fn tick_growth(&mut self, def: &CropDef, season: Season) -> bool {
        let max = Self::max_stage(def);
        if self.stage >= max {
            return false;
        }
        if !def.allows_season(season) {
            return false;
        }
        if def.water_required && !self.watered {
            return false;
        }
        self.growth_ticks = self.growth_ticks.saturating_add(1);
        if self.growth_ticks < def.ticks_per_stage {
            return false;
        }
        self.growth_ticks = 0;
        self.stage = self.stage.saturating_add(1).min(max);
        if self.stage >= max && !self.ready_emitted {
            self.ready_emitted = true;
            return true;
        }
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    fn wheat() -> CropDef {
        CropDef {
            id: "wheat".into(),
            name: "Wheat".into(),
            stages: 4,
            ticks_per_stage: 4,
            seasons: vec!["spring".into(), "summer".into()],
            water_required: true,
            yield_map: BTreeMap::new(),
            seed_cost: BTreeMap::new(),
        }
    }

    #[test]
    fn stalls_without_water() {
        let def = wheat();
        let mut crop = Crop::new(1, "wheat".into(), 0, (0, 0));
        assert!(!crop.tick_growth(&def, Season::Spring));
        assert_eq!(crop.growth_ticks, 0);
    }

    #[test]
    fn stalls_in_winter() {
        let def = wheat();
        let mut crop = Crop::new(1, "wheat".into(), 0, (0, 0));
        crop.watered = true;
        assert!(!crop.tick_growth(&def, Season::Winter));
        assert_eq!(crop.growth_ticks, 0);
    }

    #[test]
    fn grows_through_stages_and_emits_ready_once() {
        let def = wheat();
        let mut crop = Crop::new(1, "wheat".into(), 0, (0, 0));
        crop.watered = true;
        let mut ready_count = 0;
        for _ in 0..12 {
            if crop.tick_growth(&def, Season::Spring) {
                ready_count += 1;
            }
        }
        assert_eq!(crop.stage, 3);
        assert_eq!(ready_count, 1);
        assert!(!crop.tick_growth(&def, Season::Spring));
    }
}
