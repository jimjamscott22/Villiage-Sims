use tauri::State;

use crate::snapshot::TerrainSnapshot;

pub struct AppState {
    terrain: TerrainSnapshot,
}

impl AppState {
    pub fn new(terrain: TerrainSnapshot) -> Self {
        Self { terrain }
    }
}

#[tauri::command]
pub(crate) fn get_terrain(state: State<'_, AppState>) -> TerrainSnapshot {
    state.terrain.clone()
}
