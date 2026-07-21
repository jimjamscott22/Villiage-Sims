use tokio::sync::oneshot;

use super::buildings::{PlacementResult, PlacementValidity};
use crate::snapshot::VillagerDetail;

pub enum SimCommand {
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
        reply: oneshot::Sender<Result<(), String>>,
    },
    GetVillagerDetail {
        id: u32,
        reply: oneshot::Sender<Result<VillagerDetail, String>>,
    },
    SetSpeed {
        speed: u8,
        reply: oneshot::Sender<Result<(), String>>,
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
}
