use serde::Serialize;

use crate::sim::clock::ClockView;
use crate::sim::crops::CropView;
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
pub struct WorldInit {
    pub seed: u64,
    pub width: u32,
    pub height: u32,
    pub tile_size: u32,
    pub tick: u64,
    pub save_version: u32,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TickSnapshot {
    pub tick: u64,
    pub villagers: Vec<VillagerView>,
    pub buildings: Vec<BuildingView>,
    pub crops: Vec<CropView>,
    pub resources: ResourceTotals,
    pub housing_capacity: u32,
    pub clock: ClockView,
    /// Monotonic chronicle revision. When this changes, refetch via `get_chronicle`.
    pub chronicle_seq: u64,
    /// Building ids whose unlock conditions are met.
    pub unlocked: Vec<String>,
    /// Last rotating autosave slot written this session (`1..=3`), if any.
    pub last_autosave_slot: Option<u8>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct VillagerView {
    pub id: u32,
    pub x: f32,
    pub y: f32,
    /// 0 Idle, 1 Moving, 2 Working, 3 Eating, 4 Sleeping, 5 Socializing.
    #[serde(default)]
    pub state: u8,
    /// True while the villager holds a haul stack, so the renderer can pick the carry pose.
    #[serde(default)]
    pub carrying: bool,
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
    pub traits: Vec<String>,
}
