use std::f32::consts::TAU;

use crate::snapshot::{TerrainSnapshot, TickSnapshot, VillagerView};

use super::terrain::generate_terrain;

const ORBIT_TICKS: f32 = 200.0;
const ORBIT_RADIUS_FACTOR: f32 = 0.32;

pub const DEFAULT_WIDTH: u32 = 128;
pub const DEFAULT_HEIGHT: u32 = 128;
pub const DEFAULT_TILE_SIZE: u32 = 32;
pub const DEFAULT_SEED: u64 = 42;

pub struct World {
    width: u32,
    height: u32,
    tile_size: u32,
    tiles: Vec<u8>,
    #[allow(dead_code)]
    seed: u64,
    tick: u64,
}

impl World {
    pub fn generate(width: u32, height: u32, tile_size: u32, seed: u64) -> Self {
        let tiles = generate_terrain(width, height, seed);
        Self {
            width,
            height,
            tile_size,
            tiles,
            seed,
            tick: 0,
        }
    }

    pub fn default_world() -> Self {
        Self::generate(
            DEFAULT_WIDTH,
            DEFAULT_HEIGHT,
            DEFAULT_TILE_SIZE,
            DEFAULT_SEED,
        )
    }

    pub fn advance(&mut self) {
        self.tick += 1;
    }

    #[cfg(test)]
    pub fn seed(&self) -> u64 {
        self.seed
    }

    pub fn terrain_snapshot(&self) -> TerrainSnapshot {
        TerrainSnapshot {
            width: self.width,
            height: self.height,
            tile_size: self.tile_size,
            tiles: self.tiles.clone(),
        }
    }

    pub fn tick_snapshot(&self) -> TickSnapshot {
        let world_width = self.width as f32 * self.tile_size as f32;
        let world_height = self.height as f32 * self.tile_size as f32;
        let center_x = world_width / 2.0;
        let center_y = world_height / 2.0;
        let radius = world_width.min(world_height) * ORBIT_RADIUS_FACTOR;
        let angle = self.tick as f32 * TAU / ORBIT_TICKS;

        TickSnapshot {
            tick: self.tick,
            villagers: vec![VillagerView {
                id: 1,
                x: center_x + angle.cos() * radius,
                y: center_y + angle.sin() * radius,
            }],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_world_has_expected_dimensions() {
        let world = World::generate(16, 12, 32, 7);
        let terrain = world.terrain_snapshot();

        assert_eq!(terrain.width, 16);
        assert_eq!(terrain.height, 12);
        assert_eq!(terrain.tile_size, 32);
        assert_eq!(terrain.tiles.len(), 16 * 12);
        assert_eq!(world.seed(), 7);
    }

    #[test]
    fn villager_motion_is_deterministic_at_known_ticks() {
        let mut world = World::default_world();
        let at_zero = world.tick_snapshot().villagers[0].clone();
        for _ in 0..50 {
            world.advance();
        }
        let at_quarter_turn = world.tick_snapshot().villagers[0].clone();

        // 128 * 32 = 4096 world pixels; center 2048; radius 0.32 * 4096 = 1310.72
        assert!((at_zero.x - (2048.0 + 1310.72)).abs() < 0.01);
        assert!((at_zero.y - 2048.0).abs() < 0.01);
        assert!((at_quarter_turn.x - 2048.0).abs() < 0.01);
        assert!((at_quarter_turn.y - (2048.0 + 1310.72)).abs() < 0.01);
    }
}
