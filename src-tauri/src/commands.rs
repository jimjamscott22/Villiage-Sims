use tauri::State;

use crate::snapshot::TerrainSnapshot;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Viewport {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

pub struct AppState {
    terrain: TerrainSnapshot,
    viewport: std::sync::Mutex<Viewport>,
}

impl AppState {
    pub fn new(terrain: TerrainSnapshot) -> Self {
        let w = terrain.width as f32 * terrain.tile_size as f32;
        let h = terrain.height as f32 * terrain.tile_size as f32;
        Self {
            terrain,
            viewport: std::sync::Mutex::new(Viewport {
                x: 0.0,
                y: 0.0,
                w,
                h,
            }),
        }
    }

    #[cfg(test)]
    pub fn viewport(&self) -> Viewport {
        *self.viewport.lock().expect("viewport lock poisoned")
    }
}

#[tauri::command]
pub(crate) fn get_terrain(state: State<'_, AppState>) -> TerrainSnapshot {
    state.terrain.clone()
}

#[tauri::command]
pub(crate) fn set_viewport(state: State<'_, AppState>, x: f32, y: f32, w: f32, h: f32) {
    let mut viewport = state.viewport.lock().expect("viewport lock poisoned");
    *viewport = Viewport { x, y, w, h };
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::snapshot::TerrainSnapshot;

    #[test]
    fn set_viewport_updates_stored_bounds() {
        let state = AppState::new(TerrainSnapshot {
            width: 4,
            height: 4,
            tile_size: 32,
            tiles: vec![0; 16],
        });
        {
            let mut viewport = state.viewport.lock().unwrap();
            *viewport = Viewport {
                x: 10.0,
                y: 20.0,
                w: 100.0,
                h: 80.0,
            };
        }
        assert_eq!(
            state.viewport(),
            Viewport {
                x: 10.0,
                y: 20.0,
                w: 100.0,
                h: 80.0
            }
        );
    }
}
