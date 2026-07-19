use serde::Serialize;

use crate::sim::resources::ResourceTotals;

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerrainSnapshot {
    pub width: u32,
    pub height: u32,
    pub tile_size: u32,
    pub tiles: Vec<u8>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TickSnapshot {
    pub tick: u64,
    pub villagers: Vec<VillagerView>,
    pub buildings: Vec<BuildingView>,
    pub resources: ResourceTotals,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct VillagerView {
    pub id: u32,
    pub x: f32,
    pub y: f32,
    /// 0 = Idle, 1 = Moving, 2 = Working (M5 FSM).
    #[serde(default)]
    pub state: u8,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct BuildingView {
    pub id: u32,
    pub kind: u8,
    pub x: i32,
    pub y: i32,
    pub rot: u8,
    pub state: u8,
    pub progress: u8,
}

/// On-demand villager detail for the panel (never in tick payload).
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VillagerDetail {
    pub id: u32,
    pub name: String,
    pub state: u8,
    pub state_label: String,
    pub hunger: f32,
    pub energy: f32,
    pub social: f32,
    pub happiness: f32,
    pub job_kind: Option<String>,
    pub job_site: Option<u32>,
}
