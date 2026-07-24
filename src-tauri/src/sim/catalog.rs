use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use super::crops::CropDef;
use super::terrain::Terrain;

const BUILDINGS_JSON: &str = include_str!("../../data/buildings.json");
const CROPS_JSON: &str = include_str!("../../data/crops.json");

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildingDef {
    pub id: String,
    pub name: String,
    pub footprint: [u32; 2],
    pub cost: BTreeMap<String, u32>,
    #[serde(alias = "build_ticks")]
    pub build_ticks: u32,
    pub category: String,
    #[serde(default)]
    pub houses: Option<u32>,
    #[serde(alias = "valid_terrain")]
    pub valid_terrain: Vec<String>,
    #[serde(default)]
    pub jobs: Vec<JobDef>,
    #[serde(default)]
    pub stores: Option<Vec<String>>,
    #[serde(default)]
    pub capacity: Option<u32>,
    #[serde(default)]
    pub recipe: Option<RecipeDef>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct RecipeDef {
    pub inputs: BTreeMap<String, u32>,
    pub outputs: BTreeMap<String, u32>,
    pub ticks: u32,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct JobDef {
    pub kind: String,
    pub slots: u32,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub buildings: Vec<BuildingDef>,
    #[serde(default)]
    pub crops: Vec<CropDef>,
}

impl Catalog {
    pub fn load_builtin() -> Result<Self, String> {
        let buildings: Vec<BuildingDef> = serde_json::from_str(BUILDINGS_JSON)
            .map_err(|error| format!("invalid buildings.json: {error}"))?;
        let crops: Vec<CropDef> = serde_json::from_str(CROPS_JSON)
            .map_err(|error| format!("invalid crops.json: {error}"))?;
        let catalog = Self { buildings, crops };
        catalog.validate()?;
        Ok(catalog)
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.buildings.is_empty() {
            return Err("buildings catalog is empty".into());
        }
        let mut seen = std::collections::BTreeSet::new();
        for (index, building) in self.buildings.iter().enumerate() {
            if building.id.is_empty() {
                return Err(format!("building at index {index} has empty id"));
            }
            if !seen.insert(building.id.clone()) {
                return Err(format!("duplicate building id '{}'", building.id));
            }
            if building.footprint[0] == 0 || building.footprint[1] == 0 {
                return Err(format!("building '{}' has zero footprint", building.id));
            }
            if building.valid_terrain.is_empty() {
                return Err(format!("building '{}' has no valid_terrain", building.id));
            }
            for terrain in &building.valid_terrain {
                if terrain_from_name(terrain).is_none() {
                    return Err(format!(
                        "building '{}' references unknown terrain '{terrain}'",
                        building.id
                    ));
                }
            }
        }
        if self.crops.is_empty() {
            return Err("crops catalog is empty".into());
        }
        let mut crop_seen = std::collections::BTreeSet::new();
        for (index, crop) in self.crops.iter().enumerate() {
            if crop.id.is_empty() {
                return Err(format!("crop at index {index} has empty id"));
            }
            if !crop_seen.insert(crop.id.clone()) {
                return Err(format!("duplicate crop id '{}'", crop.id));
            }
            if crop.stages == 0 {
                return Err(format!("crop '{}' has zero stages", crop.id));
            }
            if crop.ticks_per_stage == 0 {
                return Err(format!("crop '{}' has zero ticks_per_stage", crop.id));
            }
            if crop.seasons.is_empty() {
                return Err(format!("crop '{}' has no seasons", crop.id));
            }
            for season in &crop.seasons {
                if super::clock::Season::from_name(season).is_none() {
                    return Err(format!(
                        "crop '{}' references unknown season '{season}'",
                        crop.id
                    ));
                }
            }
        }
        Ok(())
    }

    pub fn find(&self, id: &str) -> Option<(u8, &BuildingDef)> {
        self.buildings
            .iter()
            .enumerate()
            .find(|(_, def)| def.id == id)
            .map(|(index, def)| (index as u8, def))
    }

    pub fn get(&self, kind_index: u8) -> Option<&BuildingDef> {
        self.buildings.get(kind_index as usize)
    }

    pub fn find_crop(&self, id: &str) -> Option<(u8, &CropDef)> {
        self.crops
            .iter()
            .enumerate()
            .find(|(_, def)| def.id == id)
            .map(|(index, def)| (index as u8, def))
    }

    pub fn get_crop(&self, kind_index: u8) -> Option<&CropDef> {
        self.crops.get(kind_index as usize)
    }
}

pub fn terrain_from_name(name: &str) -> Option<Terrain> {
    match name {
        "deep_water" | "deepWater" => Some(Terrain::DeepWater),
        "shallow_water" | "shallowWater" => Some(Terrain::ShallowWater),
        "sand" => Some(Terrain::Sand),
        "grass" => Some(Terrain::Grass),
        "forest" => Some(Terrain::Forest),
        "rock" => Some(Terrain::Rock),
        "mountain" => Some(Terrain::Mountain),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builtin_catalog_loads_buildings_and_crops() {
        let catalog = Catalog::load_builtin().expect("catalog");
        assert_eq!(catalog.buildings.len(), 5);
        assert!(catalog.find("hut").is_some());
        assert!(catalog.find("farm").is_some());
        assert!(catalog.find("granary").is_some());
        assert!(catalog.find("mill").is_some());
        assert!(catalog.find("bakery").is_some());
        let mill = catalog.find("mill").unwrap().1;
        assert!(mill.recipe.is_some());
        let granary = catalog.find("granary").unwrap().1;
        assert!(granary.stores.as_ref().unwrap().contains(&"grain".into()));
        assert_eq!(catalog.crops.len(), 1);
        assert!(catalog.find_crop("wheat").is_some());
    }
}
