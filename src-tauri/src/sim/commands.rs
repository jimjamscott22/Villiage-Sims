use tokio::sync::oneshot;

use super::buildings::{PlacementResult, PlacementValidity};

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
}
