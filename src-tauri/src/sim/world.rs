use std::f32::consts::TAU;

use crate::snapshot::{TerrainSnapshot, TickSnapshot, VillagerView};

const ORBIT_TICKS: f32 = 200.0;
const ORBIT_RADIUS_FACTOR: f32 = 0.32;

pub struct World {
    width: u32,
    height: u32,
    tile_size: u32,
    tiles: Vec<u8>,
    tick: u64,
}

impl World {
    pub fn checkerboard(width: u32, height: u32, tile_size: u32) -> Self {
        let tiles = (0..height)
            .flat_map(|y| (0..width).map(move |x| ((x + y) % 2) as u8))
            .collect();
        Self {
            width,
            height,
            tile_size,
            tiles,
            tick: 0,
        }
    }

    pub fn advance(&mut self) {
        self.tick += 1;
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
    fn checkerboard_has_expected_dimensions_and_layout() {
        let world = World::checkerboard(4, 3, 32);
        let terrain = world.terrain_snapshot();

        assert_eq!(terrain.width, 4);
        assert_eq!(terrain.height, 3);
        assert_eq!(terrain.tile_size, 32);
        assert_eq!(terrain.tiles, vec![0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1]);
    }

    #[test]
    fn villager_motion_is_deterministic_at_known_ticks() {
        let mut world = World::checkerboard(32, 24, 32);
        let at_zero = world.tick_snapshot().villagers[0].clone();
        for _ in 0..50 {
            world.advance();
        }
        let at_quarter_turn = world.tick_snapshot().villagers[0].clone();

        assert!((at_zero.x - 757.76).abs() < 0.01);
        assert!((at_zero.y - 384.0).abs() < 0.01);
        assert!((at_quarter_turn.x - 512.0).abs() < 0.01);
        assert!((at_quarter_turn.y - 629.76).abs() < 0.01);
    }
}
