use std::path::PathBuf;

use tokio::sync::oneshot;

use super::buildings::{PlacementResult, PlacementValidity};
use crate::sim::chronicle::ChronicleEntryView;
use crate::snapshot::{TerrainSnapshot, VillagerDetail, WorldInit};

pub enum SimCommand {
    ClickChicken {
        shelter_id: u32,
        id: u32,
        reply: oneshot::Sender<Result<bool, String>>,
    },
    CollectEggs {
        shelter_id: u32,
        id: u32,
        reply: oneshot::Sender<Result<u32, String>>,
    },
    SetViewport {
        x: f32,
        y: f32,
        w: f32,
        h: f32,
    },
    ValidatePlacement {
        kind: String,
        x: i32,
        y: i32,
        rotation: u8,
        reply: oneshot::Sender<PlacementValidity>,
    },
    PlaceBuilding {
        kind: String,
        x: i32,
        y: i32,
        rotation: u8,
        reply: oneshot::Sender<Result<PlacementResult, String>>,
    },
    Demolish {
        entity_id: u32,
        reply: oneshot::Sender<Result<(), String>>,
    },
    MoveVillagerTo {
        x: i32,
        y: i32,
        villager_id: Option<u32>,
        reply: oneshot::Sender<Result<(), String>>,
    },
    AssignHome {
        villager_id: u32,
        /// Residence building id, or `None` to clear the assignment.
        building_id: Option<u32>,
        reply: oneshot::Sender<Result<(), String>>,
    },
    GetVillagerDetail {
        id: u32,
        reply: oneshot::Sender<Result<VillagerDetail, String>>,
    },
    GetVillagerRoster {
        reply: oneshot::Sender<Vec<VillagerDetail>>,
    },
    SetSpeed {
        speed: u8,
    },
    PlantCrop {
        kind: String,
        x: i32,
        y: i32,
        reply: oneshot::Sender<Result<(), String>>,
    },
    AdvanceClock {
        days: u32,
        season: Option<u8>,
        reply: oneshot::Sender<Result<(), String>>,
    },
    GetTerrain {
        reply: oneshot::Sender<TerrainSnapshot>,
    },
    GetChronicle {
        reply: oneshot::Sender<Vec<ChronicleEntryView>>,
    },
    SaveGame {
        path: PathBuf,
        reply: oneshot::Sender<Result<(), String>>,
    },
    LoadGame {
        path: PathBuf,
        reply: oneshot::Sender<Result<WorldInit, String>>,
    },
}
