use std::path::PathBuf;
use std::sync::mpsc;

use tauri::{AppHandle, Manager, State};
use tokio::sync::oneshot;

use crate::sim::buildings::{PlacementResult, PlacementValidity};
use crate::sim::catalog::Catalog;
use crate::sim::chronicle::ChronicleEntryView;
use crate::sim::commands::SimCommand;
use crate::snapshot::{TerrainSnapshot, VillagerDetail, WorldInit};

pub struct AppState {
    catalog: Catalog,
    commands: mpsc::Sender<SimCommand>,
}

impl AppState {
    pub fn new(catalog: Catalog, commands: mpsc::Sender<SimCommand>) -> Self {
        Self { catalog, commands }
    }
}

#[tauri::command]
pub(crate) async fn get_terrain(state: State<'_, AppState>) -> Result<TerrainSnapshot, String> {
    let (reply, receiver) = oneshot::channel();
    state
        .commands
        .send(SimCommand::GetTerrain { reply })
        .map_err(|_| "simulation command channel closed".to_string())?;
    receiver
        .await
        .map_err(|_| "simulation dropped get_terrain".to_string())
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
pub(crate) fn set_speed(state: State<'_, AppState>, speed: u8) {
    let _ = state.commands.send(SimCommand::SetSpeed { speed });
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
pub(crate) async fn move_villager_to(
    state: State<'_, AppState>,
    x: i32,
    y: i32,
) -> Result<(), String> {
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

#[tauri::command]
pub(crate) async fn get_chronicle(
    state: State<'_, AppState>,
) -> Result<Vec<ChronicleEntryView>, String> {
    let (reply, receiver) = oneshot::channel();
    state
        .commands
        .send(SimCommand::GetChronicle { reply })
        .map_err(|_| "simulation command channel closed".to_string())?;
    receiver
        .await
        .map_err(|_| "simulation dropped get_chronicle".to_string())
}

#[tauri::command]
pub(crate) async fn plant_crop(
    state: State<'_, AppState>,
    kind: String,
    x: i32,
    y: i32,
) -> Result<(), String> {
    let (reply, receiver) = oneshot::channel();
    state
        .commands
        .send(SimCommand::PlantCrop { kind, x, y, reply })
        .map_err(|_| "simulation command channel closed".to_string())?;
    receiver
        .await
        .map_err(|_| "simulation dropped plant_crop".to_string())?
}

#[tauri::command]
pub(crate) async fn advance_clock(
    state: State<'_, AppState>,
    days: u32,
    season: Option<u8>,
) -> Result<(), String> {
    let (reply, receiver) = oneshot::channel();
    state
        .commands
        .send(SimCommand::AdvanceClock {
            days,
            season,
            reply,
        })
        .map_err(|_| "simulation command channel closed".to_string())?;
    receiver
        .await
        .map_err(|_| "simulation dropped advance_clock".to_string())?
}

fn validate_slot(slot: u8) -> Result<(), String> {
    if (1..=3).contains(&slot) {
        Ok(())
    } else {
        Err(format!("invalid save slot {slot}; expected 1, 2, or 3"))
    }
}

fn save_slot_path(app: &AppHandle, slot: u8) -> Result<PathBuf, String> {
    validate_slot(slot)?;
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("could not locate app data directory: {error}"))?;
    Ok(app_data.join("saves").join(format!("slot-{slot}.vsav")))
}

#[tauri::command]
pub(crate) async fn save_game(
    app: AppHandle,
    state: State<'_, AppState>,
    slot: u8,
) -> Result<(), String> {
    let path = save_slot_path(&app, slot)?;
    let (reply, receiver) = oneshot::channel();
    state
        .commands
        .send(SimCommand::SaveGame { path, reply })
        .map_err(|_| "simulation command channel closed".to_string())?;
    receiver
        .await
        .map_err(|_| "simulation dropped save_game".to_string())?
}

#[tauri::command]
pub(crate) async fn load_game(
    app: AppHandle,
    state: State<'_, AppState>,
    slot: u8,
) -> Result<WorldInit, String> {
    let path = save_slot_path(&app, slot)?;
    let (reply, receiver) = oneshot::channel();
    state
        .commands
        .send(SimCommand::LoadGame { path, reply })
        .map_err(|_| "simulation command channel closed".to_string())?;
    receiver
        .await
        .map_err(|_| "simulation dropped load_game".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sim::catalog::Catalog;
    use std::sync::mpsc;

    #[test]
    fn app_state_holds_catalog() {
        let (tx, _rx) = mpsc::channel();
        let state = AppState::new(Catalog::load_builtin().unwrap(), tx);
        assert_eq!(state.catalog.buildings.len(), 5);
        assert_eq!(state.catalog.crops.len(), 1);
    }

    #[test]
    fn save_slots_are_limited_to_three() {
        assert!(validate_slot(1).is_ok());
        assert!(validate_slot(3).is_ok());
        assert_eq!(
            validate_slot(4).unwrap_err(),
            "invalid save slot 4; expected 1, 2, or 3"
        );
    }
}
