use serde::Serialize;

use super::catalog::{BuildingDef, terrain_from_name};
use super::terrain::Terrain;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BuildState {
    UnderConstruction { progress_ticks: u32 },
    Complete,
}

impl BuildState {
    pub fn as_u8(self) -> u8 {
        match self {
            Self::UnderConstruction { .. } => 1,
            Self::Complete => 2,
        }
    }

    pub fn progress_byte(self, build_ticks: u32) -> u8 {
        match self {
            Self::Complete => 100,
            Self::UnderConstruction { progress_ticks } => {
                if build_ticks == 0 {
                    100
                } else {
                    ((progress_ticks as u64 * 100) / u64::from(build_ticks)).min(100) as u8
                }
            }
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Building {
    pub id: u32,
    pub kind_index: u8,
    pub origin: (i32, i32),
    pub rotation: u8,
    pub state: BuildState,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlacementValidity {
    pub valid: bool,
    pub reason: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlacementResult {
    pub id: u32,
}

pub fn rotated_footprint(def: &BuildingDef, rotation: u8) -> (u32, u32) {
    let [w, h] = def.footprint;
    if rotation % 2 == 0 { (w, h) } else { (h, w) }
}

pub fn footprint_tiles(origin: (i32, i32), footprint: (u32, u32)) -> Vec<(i32, i32)> {
    let mut tiles = Vec::with_capacity((footprint.0 * footprint.1) as usize);
    for dy in 0..footprint.1 as i32 {
        for dx in 0..footprint.0 as i32 {
            tiles.push((origin.0 + dx, origin.1 + dy));
        }
    }
    tiles
}

pub fn terrain_allowed(def: &BuildingDef, terrain: Terrain) -> bool {
    def.valid_terrain
        .iter()
        .filter_map(|name| terrain_from_name(name))
        .any(|allowed| allowed == terrain)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sim::catalog::Catalog;

    #[test]
    fn rotation_swaps_non_square_footprint() {
        let catalog = Catalog::load_builtin().unwrap();
        let farm = catalog.find("farm").unwrap().1;
        assert_eq!(rotated_footprint(farm, 0), (3, 3));
        let granary = catalog.find("granary").unwrap().1;
        assert_eq!(rotated_footprint(granary, 0), (2, 2));
        assert_eq!(rotated_footprint(granary, 1), (2, 2));
    }
}
