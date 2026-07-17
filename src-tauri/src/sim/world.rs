use std::f32::consts::TAU;

use crate::snapshot::{BuildingView, TerrainSnapshot, TickSnapshot, VillagerView};

use super::buildings::{
    BuildState, Building, PlacementResult, PlacementValidity, footprint_tiles, rotated_footprint,
    terrain_allowed,
};
use super::catalog::Catalog;
use super::commands::SimCommand;
use super::resources::ResourceTotals;
use super::terrain::{Terrain, generate_terrain};

const ORBIT_TICKS: f32 = 200.0;
const ORBIT_RADIUS_FACTOR: f32 = 0.32;
const VIEWPORT_MARGIN_TILES: f32 = 4.0;

pub const DEFAULT_WIDTH: u32 = 128;
pub const DEFAULT_HEIGHT: u32 = 128;
pub const DEFAULT_TILE_SIZE: u32 = 32;
pub const DEFAULT_SEED: u64 = 42;

#[derive(Clone, Copy, Debug)]
struct Viewport {
    x: f32,
    y: f32,
    w: f32,
    h: f32,
}

pub struct World {
    width: u32,
    height: u32,
    tile_size: u32,
    tiles: Vec<u8>,
    #[allow(dead_code)]
    seed: u64,
    tick: u64,
    catalog: Catalog,
    buildings: Vec<Building>,
    occupancy: Vec<Option<u32>>,
    resources: ResourceTotals,
    next_building_id: u32,
    viewport: Viewport,
}

impl World {
    pub fn generate(width: u32, height: u32, tile_size: u32, seed: u64) -> Self {
        let tiles = generate_terrain(width, height, seed);
        let occupancy = vec![None; (width * height) as usize];
        let world_w = width as f32 * tile_size as f32;
        let world_h = height as f32 * tile_size as f32;
        Self {
            width,
            height,
            tile_size,
            tiles,
            seed,
            tick: 0,
            catalog: Catalog::load_builtin().expect("builtin buildings catalog"),
            buildings: Vec::new(),
            occupancy,
            resources: ResourceTotals::starting(),
            next_building_id: 1,
            viewport: Viewport {
                x: 0.0,
                y: 0.0,
                w: world_w,
                h: world_h,
            },
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

    pub fn catalog(&self) -> &Catalog {
        &self.catalog
    }

    pub fn handle_command(&mut self, command: SimCommand) {
        match command {
            SimCommand::SetViewport { x, y, w, h } => {
                self.viewport = Viewport { x, y, w, h };
            }
            SimCommand::ValidatePlacement {
                kind,
                x,
                y,
                rotation,
                reply,
            } => {
                let validity = self.validate_placement(&kind, x, y, rotation);
                let _ = reply.send(validity);
            }
            SimCommand::PlaceBuilding {
                kind,
                x,
                y,
                rotation,
                reply,
            } => {
                let result = self.place_building(&kind, x, y, rotation);
                let _ = reply.send(result);
            }
            SimCommand::Demolish { entity_id, reply } => {
                let result = self.demolish(entity_id);
                let _ = reply.send(result);
            }
        }
    }

    pub fn advance(&mut self) {
        self.tick += 1;
        for index in 0..self.buildings.len() {
            let kind_index = self.buildings[index].kind_index;
            let required = self.catalog.get(kind_index).map(|def| def.build_ticks);
            let BuildState::UnderConstruction { progress_ticks } = &mut self.buildings[index].state
            else {
                continue;
            };
            *progress_ticks = progress_ticks.saturating_add(1);
            if required.is_some_and(|ticks| *progress_ticks >= ticks) {
                self.buildings[index].state = BuildState::Complete;
            }
        }
    }

    #[cfg(test)]
    pub fn seed(&self) -> u64 {
        self.seed
    }

    #[cfg(test)]
    pub fn resources(&self) -> &ResourceTotals {
        &self.resources
    }

    #[cfg(test)]
    pub fn buildings(&self) -> &[Building] {
        &self.buildings
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
            buildings: self.building_views(),
            resources: self.resources.clone(),
        }
    }

    fn building_views(&self) -> Vec<BuildingView> {
        let tile = self.tile_size as f32;
        let margin = VIEWPORT_MARGIN_TILES * tile;
        let min_x = self.viewport.x - margin;
        let min_y = self.viewport.y - margin;
        let max_x = self.viewport.x + self.viewport.w + margin;
        let max_y = self.viewport.y + self.viewport.h + margin;

        self.buildings
            .iter()
            .filter_map(|building| {
                let def = self.catalog.get(building.kind_index)?;
                let (fw, fh) = rotated_footprint(def, building.rotation);
                let x0 = building.origin.0 as f32 * tile;
                let y0 = building.origin.1 as f32 * tile;
                let x1 = x0 + fw as f32 * tile;
                let y1 = y0 + fh as f32 * tile;
                if x1 < min_x || y1 < min_y || x0 > max_x || y0 > max_y {
                    return None;
                }
                Some(BuildingView {
                    id: building.id,
                    kind: building.kind_index,
                    x: building.origin.0,
                    y: building.origin.1,
                    rot: building.rotation % 4,
                    state: building.state.as_u8(),
                    progress: building.state.progress_byte(def.build_ticks),
                })
            })
            .collect()
    }

    pub fn validate_placement(
        &self,
        kind: &str,
        x: i32,
        y: i32,
        rotation: u8,
    ) -> PlacementValidity {
        let Some((kind_index, def)) = self.catalog.find(kind) else {
            return PlacementValidity {
                valid: false,
                reason: format!("unknown building '{kind}'"),
            };
        };
        let _ = kind_index;
        let footprint = rotated_footprint(def, rotation);
        let tiles = footprint_tiles((x, y), footprint);

        for (tx, ty) in tiles {
            if tx < 0 || ty < 0 || tx >= self.width as i32 || ty >= self.height as i32 {
                return PlacementValidity {
                    valid: false,
                    reason: "out of bounds".into(),
                };
            }
            let index = (ty as u32 * self.width + tx as u32) as usize;
            let terrain = Terrain::from_u8(self.tiles[index]).unwrap_or(Terrain::DeepWater);
            if !terrain_allowed(def, terrain) {
                return PlacementValidity {
                    valid: false,
                    reason: format!("invalid terrain for {}", def.id),
                };
            }
            if self.occupancy[index].is_some() {
                return PlacementValidity {
                    valid: false,
                    reason: "tile occupied".into(),
                };
            }
        }

        if !self.resources.can_afford(&def.cost) {
            return PlacementValidity {
                valid: false,
                reason: "insufficient resources".into(),
            };
        }

        PlacementValidity {
            valid: true,
            reason: String::new(),
        }
    }

    pub fn place_building(
        &mut self,
        kind: &str,
        x: i32,
        y: i32,
        rotation: u8,
    ) -> Result<PlacementResult, String> {
        let validity = self.validate_placement(kind, x, y, rotation);
        if !validity.valid {
            return Err(validity.reason);
        }
        let (kind_index, def) = self
            .catalog
            .find(kind)
            .ok_or_else(|| format!("unknown building '{kind}'"))?;
        let footprint = rotated_footprint(def, rotation);
        let tiles = footprint_tiles((x, y), footprint);
        self.resources.spend(&def.cost)?;

        let id = self.next_building_id;
        self.next_building_id = self.next_building_id.saturating_add(1);
        for (tx, ty) in &tiles {
            let index = (*ty as u32 * self.width + *tx as u32) as usize;
            self.occupancy[index] = Some(id);
        }
        self.buildings.push(Building {
            id,
            kind_index,
            origin: (x, y),
            rotation: rotation % 4,
            state: BuildState::UnderConstruction { progress_ticks: 0 },
        });
        Ok(PlacementResult { id })
    }

    pub fn demolish(&mut self, entity_id: u32) -> Result<(), String> {
        let index = self
            .buildings
            .iter()
            .position(|building| building.id == entity_id)
            .ok_or_else(|| format!("unknown building {entity_id}"))?;
        let building = self.buildings.remove(index);
        let def = self
            .catalog
            .get(building.kind_index)
            .ok_or_else(|| "missing building definition".to_string())?;
        let footprint = rotated_footprint(def, building.rotation);
        for (tx, ty) in footprint_tiles(building.origin, footprint) {
            if tx < 0 || ty < 0 || tx >= self.width as i32 || ty >= self.height as i32 {
                continue;
            }
            let tile_index = (ty as u32 * self.width + tx as u32) as usize;
            if self.occupancy[tile_index] == Some(entity_id) {
                self.occupancy[tile_index] = None;
            }
        }
        self.resources.refund(&def.cost);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sim::terrain::Terrain;

    fn grass_world() -> World {
        let mut world = World::generate(8, 8, 32, 1);
        world.tiles = vec![Terrain::Grass as u8; 64];
        world.occupancy = vec![None; 64];
        world
    }

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

        assert!((at_zero.x - (2048.0 + 1310.72)).abs() < 0.01);
        assert!((at_zero.y - 2048.0).abs() < 0.01);
        assert!((at_quarter_turn.x - 2048.0).abs() < 0.01);
        assert!((at_quarter_turn.y - (2048.0 + 1310.72)).abs() < 0.01);
    }

    #[test]
    fn hut_places_on_grass_and_rejects_water() {
        let mut world = grass_world();
        assert!(world.validate_placement("hut", 2, 2, 0).valid);
        world.place_building("hut", 2, 2, 0).unwrap();
        assert_eq!(world.resources().wood, 100);
        assert_eq!(world.buildings().len(), 1);

        world.tiles[2 * 8 + 3] = Terrain::DeepWater as u8;
        let invalid = world.validate_placement("hut", 3, 2, 0);
        assert!(!invalid.valid);
    }

    #[test]
    fn demolish_refunds_cost_and_clears_occupancy() {
        let mut world = grass_world();
        let placed = world.place_building("hut", 1, 1, 0).unwrap();
        world.demolish(placed.id).unwrap();
        assert_eq!(world.resources().wood, 120);
        assert!(world.buildings().is_empty());
        assert!(world.validate_placement("hut", 1, 1, 0).valid);
    }

    #[test]
    fn construction_completes_after_build_ticks() {
        let mut world = grass_world();
        world.place_building("hut", 0, 0, 0).unwrap();
        for _ in 0..40 {
            world.advance();
        }
        assert_eq!(world.buildings()[0].state, BuildState::Complete);
    }
}
