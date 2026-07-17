use serde::Serialize;

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerrainSnapshot {
    pub width: u32,
    pub height: u32,
    pub tile_size: u32,
    pub tiles: Vec<u8>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct TickSnapshot {
    pub tick: u64,
    pub villagers: Vec<VillagerView>,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct VillagerView {
    pub id: u32,
    pub x: f32,
    pub y: f32,
}
