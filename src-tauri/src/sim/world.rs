use crate::snapshot::{BuildingView, TerrainSnapshot, TickSnapshot, VillagerView};

use super::agents::{
    AgentState, MOVE_SPEED_TILES_PER_SEC, MovePurpose, REPATH_COOLDOWN_TICKS, Villager,
};
use super::buildings::{
    BuildState, Building, PlacementResult, PlacementValidity, footprint_tiles, rotated_footprint,
    terrain_allowed,
};
use super::catalog::Catalog;
use super::commands::SimCommand;
use super::pathfind::{find_path, terrain_passable};
use super::resources::ResourceTotals;
use super::terrain::{Terrain, generate_terrain};

const VIEWPORT_MARGIN_TILES: f32 = 4.0;
const TICKS_PER_SECOND: f32 = 20.0;
const ARRIVE_EPSILON_PX: f32 = 0.5;

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
    villager: Villager,
    viewport: Viewport,
}

impl World {
    pub fn generate(width: u32, height: u32, tile_size: u32, seed: u64) -> Self {
        let tiles = generate_terrain(width, height, seed);
        let occupancy = vec![None; (width * height) as usize];
        let world_w = width as f32 * tile_size as f32;
        let world_h = height as f32 * tile_size as f32;
        let mut world = Self {
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
            villager: Villager::new(1, (0.0, 0.0)),
            viewport: Viewport {
                x: 0.0,
                y: 0.0,
                w: world_w,
                h: world_h,
            },
        };
        let spawn = world
            .find_walkable_near(width as i32 / 2, height as i32 / 2)
            .unwrap_or((width as i32 / 2, height as i32 / 2));
        world.villager.pos = world.tile_center(spawn.0, spawn.1);
        world
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
            SimCommand::MoveVillagerTo { x, y, reply } => {
                let result = self.order_move(x, y);
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
        self.tick_villager();
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

    #[cfg(test)]
    pub fn villager(&self) -> &Villager {
        &self.villager
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
        TickSnapshot {
            tick: self.tick,
            villagers: vec![VillagerView {
                id: self.villager.id,
                x: self.villager.pos.0,
                y: self.villager.pos.1,
                state: self.villager.state.as_u8(),
            }],
            buildings: self.building_views(),
            resources: self.resources.clone(),
        }
    }

    pub fn order_move(&mut self, x: i32, y: i32) -> Result<(), String> {
        if !self.in_bounds(x, y) {
            return Err("out of bounds".into());
        }
        if !self.is_passable(x, y) {
            return Err("tile impassable".into());
        }
        let start = self.pos_to_tile(self.villager.pos);
        let path = self
            .compute_path(start, (x, y))
            .ok_or_else(|| "no path".to_string())?;
        self.villager.state = AgentState::MovingTo {
            target: (x, y),
            purpose: MovePurpose::PlayerOrder,
        };
        self.villager.path = Some(path);
        self.villager.repath_cooldown = 0;
        Ok(())
    }

    fn tick_villager(&mut self) {
        if self.villager.repath_cooldown > 0 {
            self.villager.repath_cooldown -= 1;
        }

        let AgentState::MovingTo { target, .. } = self.villager.state else {
            return;
        };

        if self.path_is_blocked(target) {
            self.try_repath(target);
            if !matches!(self.villager.state, AgentState::MovingTo { .. }) {
                return;
            }
        }

        if self.villager.path.as_ref().is_none_or(|path| path.is_empty()) {
            // Already at/near goal with an empty path.
            let start = self.pos_to_tile(self.villager.pos);
            if start == target {
                self.villager.clear_path_to_idle();
                return;
            }
            self.try_repath(target);
            if self.villager.path.as_ref().is_none_or(|path| path.is_empty()) {
                return;
            }
        }

        let speed_px = MOVE_SPEED_TILES_PER_SEC * self.tile_size as f32 / TICKS_PER_SECOND;
        let Some(next) = self
            .villager
            .path
            .as_ref()
            .and_then(|path| path.first().copied())
        else {
            return;
        };
        let (cx, cy) = self.tile_center(next.0, next.1);
        let dx = cx - self.villager.pos.0;
        let dy = cy - self.villager.pos.1;
        let dist = (dx * dx + dy * dy).sqrt();
        if dist <= speed_px || dist <= ARRIVE_EPSILON_PX {
            self.villager.pos = (cx, cy);
            if let Some(path) = self.villager.path.as_mut() {
                path.remove(0);
                if path.is_empty() {
                    self.villager.clear_path_to_idle();
                }
            }
        } else {
            self.villager.pos.0 += dx / dist * speed_px;
            self.villager.pos.1 += dy / dist * speed_px;
        }
    }

    fn try_repath(&mut self, target: (i32, i32)) {
        if self.villager.repath_cooldown > 0 {
            self.villager.clear_path_to_idle();
            return;
        }
        let start = self.pos_to_tile(self.villager.pos);
        match self.compute_path(start, target) {
            Some(path) => {
                self.villager.path = Some(path);
                self.villager.state = AgentState::MovingTo {
                    target,
                    purpose: MovePurpose::PlayerOrder,
                };
            }
            None => {
                self.villager.clear_path_to_idle();
                self.villager.repath_cooldown = REPATH_COOLDOWN_TICKS;
            }
        }
    }

    fn path_is_blocked(&self, target: (i32, i32)) -> bool {
        if !self.is_passable(target.0, target.1) {
            return true;
        }
        match &self.villager.path {
            Some(path) => path.iter().any(|&(x, y)| !self.is_passable(x, y)),
            None => false,
        }
    }

    fn invalidate_path_if_needed(&mut self) {
        let Some(target) = self.villager.target_tile() else {
            return;
        };
        if self.path_is_blocked(target) {
            self.try_repath(target);
        }
    }

    fn compute_path(&self, start: (i32, i32), goal: (i32, i32)) -> Option<Vec<(i32, i32)>> {
        let width = self.width as i32;
        let height = self.height as i32;
        // Always allow the villager's current tile so they can path out if a
        // building was placed on top of them.
        find_path(start, goal, width, height, &|x, y| {
            (x, y) == start || self.is_passable(x, y)
        })
    }

    fn is_passable(&self, x: i32, y: i32) -> bool {
        if !self.in_bounds(x, y) {
            return false;
        }
        let index = (y as u32 * self.width + x as u32) as usize;
        if self.occupancy[index].is_some() {
            return false;
        }
        let terrain = Terrain::from_u8(self.tiles[index]).unwrap_or(Terrain::DeepWater);
        terrain_passable(terrain)
    }

    fn in_bounds(&self, x: i32, y: i32) -> bool {
        x >= 0 && y >= 0 && x < self.width as i32 && y < self.height as i32
    }

    fn tile_center(&self, x: i32, y: i32) -> (f32, f32) {
        let tile = self.tile_size as f32;
        ((x as f32 + 0.5) * tile, (y as f32 + 0.5) * tile)
    }

    fn pos_to_tile(&self, pos: (f32, f32)) -> (i32, i32) {
        let tile = self.tile_size as f32;
        let x = (pos.0 / tile).floor() as i32;
        let y = (pos.1 / tile).floor() as i32;
        (
            x.clamp(0, self.width.saturating_sub(1) as i32),
            y.clamp(0, self.height.saturating_sub(1) as i32),
        )
    }

    fn find_walkable_near(&self, cx: i32, cy: i32) -> Option<(i32, i32)> {
        // Prefer a connected walkable tile (has a passable neighbor) so the
        // villager is not stranded on an isolated forest/rock pocket.
        if self.is_spawn_candidate(cx, cy) {
            return Some((cx, cy));
        }
        let max_r = self.width.max(self.height) as i32;
        for r in 1..=max_r {
            for dy in -r..=r {
                for dx in -r..=r {
                    if dx.abs() != r && dy.abs() != r {
                        continue;
                    }
                    let x = cx + dx;
                    let y = cy + dy;
                    if self.is_spawn_candidate(x, y) {
                        return Some((x, y));
                    }
                }
            }
        }
        // Fallback: any passable tile if the map has no connected land.
        if self.is_passable(cx, cy) {
            return Some((cx, cy));
        }
        for r in 1..=max_r {
            for dy in -r..=r {
                for dx in -r..=r {
                    if dx.abs() != r && dy.abs() != r {
                        continue;
                    }
                    let x = cx + dx;
                    let y = cy + dy;
                    if self.is_passable(x, y) {
                        return Some((x, y));
                    }
                }
            }
        }
        None
    }

    fn is_spawn_candidate(&self, x: i32, y: i32) -> bool {
        if !self.is_passable(x, y) {
            return false;
        }
        for (dx, dy) in [(1, 0), (-1, 0), (0, 1), (0, -1)] {
            if self.is_passable(x + dx, y + dy) {
                return true;
            }
        }
        false
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
        self.invalidate_path_if_needed();
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
        // Demolish opens tiles; no forced repath, but a blocked goal may become free —
        // leave current path intact.
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sim::agents::AgentState;
    use crate::sim::terrain::Terrain;

    fn grass_world() -> World {
        let mut world = World::generate(8, 8, 32, 1);
        world.tiles = vec![Terrain::Grass as u8; 64];
        world.occupancy = vec![None; 64];
        world.villager.pos = world.tile_center(0, 0);
        world.villager.clear_path_to_idle();
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
    fn villager_spawns_idle_on_walkable_tile() {
        let world = World::default_world();
        let snap = world.tick_snapshot();
        assert_eq!(snap.villagers.len(), 1);
        assert_eq!(snap.villagers[0].state, 0);
        let (tx, ty) = world.pos_to_tile(world.villager().pos);
        assert!(world.is_passable(tx, ty));
        assert!(
            world.is_spawn_candidate(tx, ty),
            "spawn ({tx},{ty}) should have a passable neighbor"
        );
        // Idle villager does not drift across ticks.
        let mut world = world;
        let before = world.villager().pos;
        for _ in 0..10 {
            world.advance();
        }
        assert_eq!(world.villager().pos, before);
    }

    #[test]
    fn order_move_approaches_target_over_ticks() {
        let mut world = grass_world();
        world.order_move(5, 0).unwrap();
        assert!(matches!(
            world.villager().state,
            AgentState::MovingTo { target: (5, 0), .. }
        ));
        let start_x = world.villager().pos.0;
        for _ in 0..40 {
            world.advance();
        }
        assert!(world.villager().pos.0 > start_x + 10.0);
        for _ in 0..200 {
            world.advance();
        }
        let (tx, ty) = world.pos_to_tile(world.villager().pos);
        assert_eq!((tx, ty), (5, 0));
        assert!(matches!(world.villager().state, AgentState::Idle));
    }

    #[test]
    fn placing_building_on_path_triggers_repath_or_idle() {
        let mut world = grass_world();
        // Walk along y=0 from (0,0) to (7,0).
        world.order_move(7, 0).unwrap();
        let path_before = world.villager().path.clone().expect("path");
        assert!(path_before.contains(&(3, 0)));
        // Block the corridor mid-path.
        world.place_building("hut", 3, 0, 0).unwrap();
        // Either repathed around (3,0) or briefly idled with cooldown.
        if let Some(path) = &world.villager().path {
            assert!(!path.contains(&(3, 0)));
            assert!(matches!(world.villager().state, AgentState::MovingTo { .. }));
        } else {
            assert!(matches!(world.villager().state, AgentState::Idle));
            assert!(world.villager().repath_cooldown > 0);
        }
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

    #[test]
    fn path_routes_around_building() {
        let mut world = grass_world();
        world.place_building("hut", 3, 0, 0).unwrap();
        world.order_move(6, 0).unwrap();
        let path = world.villager().path.clone().expect("path");
        assert!(!path.contains(&(3, 0)));
        assert_eq!(*path.last().unwrap(), (6, 0));
    }
}
