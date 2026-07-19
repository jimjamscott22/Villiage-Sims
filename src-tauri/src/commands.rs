use std::sync::mpsc;

use tauri::State;
use tokio::sync::oneshot;

use crate::sim::buildings::{PlacementResult, PlacementValidity};
use crate::sim::catalog::Catalog;
use crate::sim::commands::SimCommand;
use crate::snapshot::{TerrainSnapshot, VillagerDetail};

pub struct AppState {
    terrain: TerrainSnapshot,
    catalog: Catalog,
    commands: mpsc::Sender<SimCommand>,
}

impl AppState {
    pub fn new(
        terrain: TerrainSnapshot,
        catalog: Catalog,
        commands: mpsc::Sender<SimCommand>,
    ) -> Self {
        Self {
            terrain,
            catalog,
            commands,
        }
    }
}

#[tauri::command]
pub(crate) fn get_terrain(state: State<'_, AppState>) -> TerrainSnapshot {
    state.terrain.clone()
}

#[tauri::command]
pub(crate) fn get_catalog(state: State<'_, AppState>) -> Catalog {
    state.catalog.clone()
}

#[tauri::command]
pub(crate) fn set_viewport(state: State<'_, AppState>, x: f32, y: f32, w: f32, h: f32) {
    let _ = state.commands.send(SimCommand::SetViewport { x, y, w, h });
}

#[tauri::command]
pub(crate) async fn validate_placement(
    state: State<'_, AppState>,
    kind: String,
    x: i32,
    y: i32,
    rotation: u8,
) -> Result<PlacementValidity, String> {
    let (reply, receiver) = oneshot::channel();
    state
        .commands
        .send(SimCommand::ValidatePlacement {
            kind,
            x,
            y,
            rotation,
            reply,
        })
        .map_err(|_| "simulation command channel closed".to_string())?;
    receiver
        .await
        .map_err(|_| "simulation dropped placement validation".to_string())
}

#[tauri::command]
pub(crate) async fn place_building(
    state: State<'_, AppState>,
    kind: String,
    x: i32,
    y: i32,
    rotation: u8,
) -> Result<PlacementResult, String> {
    let (reply, receiver) = oneshot::channel();
    state
        .commands
        .send(SimCommand::PlaceBuilding {
            kind,
            x,
            y,
            rotation,
            reply,
        })
        .map_err(|_| "simulation command channel closed".to_string())?;
    receiver
        .await
        .map_err(|_| "simulation dropped place_building".to_string())?
}

#[tauri::command]
pub(crate) async fn demolish(state: State<'_, AppState>, entity_id: u32) -> Result<(), String> {
    let (reply, receiver) = oneshot::channel();
    state
        .commands
        .send(SimCommand::Demolish { entity_id, reply })
        .map_err(|_| "simulation command channel closed".to_string())?;
    receiver
        .await
        .map_err(|_| "simulation dropped demolish".to_string())?
}

#[tauri::command]
pub(crate) async fn move_villager_to(state: State<'_, AppState>, x: i32, y: i32) -> Result<(), String> {
    let (reply, receiver) = oneshot::channel();
    state
        .commands
        .send(SimCommand::MoveVillagerTo { x, y, reply })
        .map_err(|_| "simulation command channel closed".to_string())?;
    receiver
        .await
        .map_err(|_| "simulation dropped move_villager_to".to_string())?
}

#[tauri::command]
pub(crate) async fn get_villager_detail(
    state: State<'_, AppState>,
    id: u32,
) -> Result<VillagerDetail, String> {
    let (reply, receiver) = oneshot::channel();
    state
        .commands
        .send(SimCommand::GetVillagerDetail { id, reply })
        .map_err(|_| "simulation command channel closed".to_string())?;
    receiver
        .await
        .map_err(|_| "simulation dropped get_villager_detail".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sim::catalog::Catalog;
    use crate::snapshot::TerrainSnapshot;
    use std::sync::mpsc;

    #[test]
    fn app_state_holds_catalog() {
        let (tx, _rx) = mpsc::channel();
        let state = AppState::new(
            TerrainSnapshot {
                width: 4,
                height: 4,
                tile_size: 32,
                tiles: vec![0; 16],
            },
            Catalog::load_builtin().unwrap(),
            tx,
        );
        assert_eq!(state.catalog.buildings.len(), 3);
    }
}
