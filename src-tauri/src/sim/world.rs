use crate::snapshot::{
    BuildingView, SimEvent, TerrainSnapshot, TickSnapshot, VillagerDetail, VillagerView,
};

use super::agents::{
    AgentState, DEFAULT_JOB_PRIORITY, MOVE_SPEED_TILES_PER_SEC, MovePurpose, REPATH_COOLDOWN_TICKS,
    STARTING_VILLAGER_NAMES, Villager, WORK_CYCLE_TICKS,
};
use super::buildings::{
    BuildState, Building, PlacementResult, PlacementValidity, footprint_tiles, rotated_footprint,
    terrain_allowed,
};
use super::catalog::Catalog;
use super::clock::Clock;
use super::commands::SimCommand;
use super::crops::{Crop, tick_crop};
use super::jobs::JobBoard;
use super::pathfind::{find_path, terrain_passable};
use super::resources::ResourceTotals;
use super::terrain::{Terrain, generate_terrain};
use super::utility::{
    ActionKind, SOCIAL_RANGE, SOCIAL_RESTORE, ScoreContext, chebyshev, night_from_clock, pick_action,
    score_all, wander_tile,
};

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
    seed: u64,
    clock: Clock,
    catalog: Catalog,
    buildings: Vec<Building>,
    crops: Vec<Crop>,
    occupancy: Vec<Option<u32>>,
    resources: ResourceTotals,
    next_building_id: u32,
    next_crop_id: u32,
    villagers: Vec<Villager>,
    job_board: JobBoard,
    events: Vec<SimEvent>,
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
            clock: Clock::new(),
            catalog: Catalog::load_builtin().expect("builtin buildings catalog"),
            buildings: Vec::new(),
            crops: Vec::new(),
            occupancy,
            resources: ResourceTotals::starting(),
            next_building_id: 1,
            next_crop_id: 1,
            villagers: Vec::new(),
            job_board: JobBoard::new(),
            events: Vec::new(),
            viewport: Viewport {
                x: 0.0,
                y: 0.0,
                w: world_w,
                h: world_h,
            },
        };
        world.spawn_starting_villagers();
        world
    }

    fn spawn_starting_villagers(&mut self) {
        let cx = self.width as i32 / 2;
        let cy = self.height as i32 / 2;
        let mut used = Vec::new();
        for (i, name) in STARTING_VILLAGER_NAMES.iter().enumerate() {
            let id = (i as u32) + 1;
            let tile = self
                .find_spawn_tile(cx, cy, &used)
                .unwrap_or((cx + i as i32, cy));
            used.push(tile);
            let pos = self.tile_center(tile.0, tile.1);
            self.villagers.push(Villager::new(id, *name, pos));
        }
    }

    fn find_spawn_tile(&self, cx: i32, cy: i32, used: &[(i32, i32)]) -> Option<(i32, i32)> {
        if let Some(tile) = self.find_walkable_near(cx, cy) {
            if !used.contains(&tile) {
                return Some(tile);
            }
        }
        let max_r = self.width.max(self.height) as i32;
        for r in 0..=max_r {
            for dy in -r..=r {
                for dx in -r..=r {
                    if dx.abs() != r && dy.abs() != r && r > 0 {
                        continue;
                    }
                    let x = cx + dx;
                    let y = cy + dy;
                    if used.contains(&(x, y)) {
                        continue;
                    }
                    if self.is_spawn_candidate(x, y) {
                        return Some((x, y));
                    }
                }
            }
        }
        None
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

    pub fn clock(&self) -> &Clock {
        &self.clock
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
            SimCommand::GetVillagerDetail { id, reply } => {
                let result = self.villager_detail(id);
                let _ = reply.send(result);
            }
            SimCommand::SetSpeed { speed } => {
                let _ = self.clock.set_speed(speed);
            }
            SimCommand::PlantCrop { kind, x, y, reply } => {
                let result = self.plant_crop(&kind, x, y);
                let _ = reply.send(result);
            }
            SimCommand::AdvanceClock {
                days,
                season,
                reply,
            } => {
                let result = self.advance_clock(days, season);
                let _ = reply.send(result);
            }
        }
    }

    pub fn advance(&mut self) {
        self.events.clear();
        if self.clock.advance_tick() {
            self.clear_all_crop_water();
        }
        self.complete_buildings();
        self.tick_crops();
        for villager in &mut self.villagers {
            villager.needs.tick_decay();
        }
        let count = self.villagers.len();
        for index in 0..count {
            self.tick_villager_at(index);
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

    #[cfg(test)]
    pub fn villager(&self) -> &Villager {
        &self.villagers[0]
    }

    #[cfg(test)]
    pub fn villager_mut(&mut self) -> &mut Villager {
        &mut self.villagers[0]
    }

    #[cfg(test)]
    pub fn villagers(&self) -> &[Villager] {
        &self.villagers
    }

    #[cfg(test)]
    pub fn job_board(&self) -> &JobBoard {
        &self.job_board
    }

    #[cfg(test)]
    pub fn crops(&self) -> &[Crop] {
        &self.crops
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
            tick: self.clock.tick,
            villagers: self
                .villagers
                .iter()
                .map(|v| VillagerView {
                    id: v.id,
                    x: v.pos.0,
                    y: v.pos.1,
                    state: v.state.as_u8(),
                })
                .collect(),
            buildings: self.building_views(),
            crops: self.crops.iter().map(Crop::view).collect(),
            resources: self.resources.clone(),
            clock: self.clock.view(),
            events: self.events.clone(),
        }
    }

    pub fn villager_detail(&self, id: u32) -> Result<VillagerDetail, String> {
        let villager = self
            .villagers
            .iter()
            .find(|v| v.id == id)
            .ok_or_else(|| format!("unknown villager {id}"))?;
        let (job_kind, job_site) = villager
            .current_job
            .and_then(|job_id| self.job_board.get(job_id))
            .map(|job| (Some(job.kind.as_str().to_string()), Some(job.site)))
            .unwrap_or((None, None));
        Ok(VillagerDetail {
            id: villager.id,
            name: villager.name.clone(),
            state: villager.state.as_u8(),
            state_label: villager.state.label().to_string(),
            hunger: villager.needs.hunger,
            energy: villager.needs.energy,
            social: villager.needs.social,
            happiness: villager.needs.happiness,
            job_kind,
            job_site,
        })
    }

    pub fn order_move(&mut self, x: i32, y: i32) -> Result<(), String> {
        if !self.in_bounds(x, y) {
            return Err("out of bounds".into());
        }
        if !self.is_passable(x, y) {
            return Err("tile impassable".into());
        }
        let index = self
            .nearest_villager_index_to(x, y)
            .ok_or_else(|| "no villagers".to_string())?;
        self.release_job_at(index);
        let start = self.pos_to_tile(self.villagers[index].pos);
        let path = self
            .compute_path(start, (x, y))
            .ok_or_else(|| "no path".to_string())?;
        self.villagers[index].state = AgentState::MovingTo {
            target: (x, y),
            purpose: MovePurpose::PlayerOrder,
        };
        self.villagers[index].path = Some(path);
        self.villagers[index].repath_cooldown = 0;
        self.villagers[index].current_action = None;
        Ok(())
    }

    fn nearest_villager_index_to(&self, x: i32, y: i32) -> Option<usize> {
        let mut best: Option<(usize, i32)> = None;
        for (index, villager) in self.villagers.iter().enumerate() {
            let (vx, vy) = self.pos_to_tile(villager.pos);
            let dist = (vx - x).abs() + (vy - y).abs();
            match best {
                Some((_, best_dist)) if dist >= best_dist => {}
                _ => best = Some((index, dist)),
            }
        }
        best.map(|(index, _)| index)
    }

    fn complete_buildings(&mut self) {
        let mut newly_complete = Vec::new();
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
                newly_complete.push(self.buildings[index].id);
            }
        }
        for building_id in newly_complete {
            self.advertise_jobs_for(building_id);
        }
    }

    fn advertise_jobs_for(&mut self, building_id: u32) {
        let Some(building) = self.buildings.iter().find(|b| b.id == building_id).cloned() else {
            return;
        };
        let Some(def) = self.catalog.get(building.kind_index).cloned() else {
            return;
        };
        let footprint = rotated_footprint(&def, building.rotation);
        let stand_tiles = self.adjacent_stand_tiles(building.origin, footprint);
        self.job_board.advertise_for_building(
            building_id,
            &def,
            &stand_tiles,
            DEFAULT_JOB_PRIORITY,
        );
    }

    fn adjacent_stand_tiles(&self, origin: (i32, i32), footprint: (u32, u32)) -> Vec<(i32, i32)> {
        let mut candidates = Vec::new();
        let x0 = origin.0;
        let y0 = origin.1;
        let x1 = origin.0 + footprint.0 as i32 - 1;
        let y1 = origin.1 + footprint.1 as i32 - 1;
        // Ring around the footprint (orthogonal neighbours only).
        for x in (x0 - 1)..=(x1 + 1) {
            for y in [y0 - 1, y1 + 1] {
                if self.is_passable(x, y) {
                    candidates.push((x, y));
                }
            }
        }
        for y in y0..=y1 {
            for x in [x0 - 1, x1 + 1] {
                if self.is_passable(x, y) {
                    candidates.push((x, y));
                }
            }
        }
        // Stable unique order.
        candidates.sort_by_key(|&(x, y)| (y, x));
        candidates.dedup();
        candidates
    }


    fn tick_villager_at(&mut self, index: usize) {
        if self.villagers[index].repath_cooldown > 0 {
            self.villagers[index].repath_cooldown -= 1;
        }

        if let Some(job_id) = self.villagers[index].current_job {
            if self.job_board.get(job_id).is_none() {
                self.villagers[index].current_job = None;
                if matches!(
                    self.villagers[index].state,
                    AgentState::Working { .. }
                        | AgentState::MovingTo {
                            purpose: MovePurpose::Work,
                            ..
                        }
                ) {
                    self.villagers[index].clear_path_to_idle();
                    // Drop Work hysteresis once the claim is gone — a 0 Work score
                    // would otherwise block Wander via the 0.15 margin.
                    if self.villagers[index].current_action == Some(ActionKind::Work) {
                        self.villagers[index].current_action = None;
                    }
                }
            }
        }

        let state = self.villagers[index].state.clone();
        match state {
            AgentState::Eating { ticks_remaining } => {
                self.tick_eating(index, ticks_remaining);
            }
            AgentState::Sleeping { ticks_remaining } => {
                self.tick_sleeping(index, ticks_remaining);
            }
            AgentState::Socializing { ticks_remaining } => {
                self.tick_socializing(index, ticks_remaining);
            }
            AgentState::MovingTo { target, purpose } => {
                self.tick_moving(index, target, purpose);
            }
            AgentState::Idle | AgentState::Working { .. } => {
                self.maybe_decide(index);
                match self.villagers[index].state.clone() {
                    AgentState::Working {
                        job,
                        ticks_remaining,
                    } => self.tick_working(index, job, ticks_remaining),
                    _ => {}
                }
            }
        }
    }

    fn maybe_decide(&mut self, index: usize) {
        if self.villagers[index].repath_cooldown > 0
            && matches!(self.villagers[index].state, AgentState::Idle)
        {
            return;
        }
        if !self.villagers[index].state.is_decidable() {
            return;
        }

        // Eat/Sleep/Socialize run to completion in their own states. Once Idle,
        // retaining them as `current_action` feeds a near-zero live score into
        // hysteresis and traps the villager (re-eat until food is gone, then stuck).
        if matches!(self.villagers[index].state, AgentState::Idle) {
            match self.villagers[index].current_action {
                Some(ActionKind::Eat | ActionKind::Sleep | ActionKind::Socialize) => {
                    self.villagers[index].current_action = None;
                }
                _ => {}
            }
        }

        let from = self.pos_to_tile(self.villagers[index].pos);
        let partner_in_range = self.partner_in_range(index, from);
        let ctx = ScoreContext {
            hunger: self.villagers[index].needs.hunger,
            energy: self.villagers[index].needs.energy,
            social: self.villagers[index].needs.social,
            from,
            food: self.resources.food,
            night: night_from_clock(&self.clock),
            partner_in_range,
            job_board: &self.job_board,
            villager_id: self.villagers[index].id,
            current_job: self.villagers[index].current_job,
        };
        let scored = score_all(&ctx);
        let current = self.villagers[index].current_action;
        let picked = pick_action(&scored, current);

        // Already executing the same work action — keep the work cycle going.
        if picked.kind == ActionKind::Work
            && matches!(self.villagers[index].state, AgentState::Working { .. })
            && self.villagers[index].current_action == Some(ActionKind::Work)
        {
            return;
        }
        if Some(picked.kind) == self.villagers[index].current_action
            && matches!(
                (picked.kind, &self.villagers[index].state),
                (ActionKind::Work, AgentState::Working { .. })
                    | (ActionKind::Work, AgentState::MovingTo { purpose: MovePurpose::Work, .. })
            )
        {
            return;
        }

        self.begin_action(index, picked.kind, picked.job_id);
    }

    fn partner_in_range(&self, index: usize, from: (i32, i32)) -> bool {
        let id = self.villagers[index].id;
        self.villagers.iter().any(|other| {
            other.id != id && chebyshev(from, self.pos_to_tile(other.pos)) <= SOCIAL_RANGE
        })
    }

    fn begin_action(&mut self, index: usize, kind: ActionKind, job_id: Option<u32>) {
        match kind {
            ActionKind::Eat => self.begin_eat(index),
            ActionKind::Sleep => {
                self.villagers[index].begin_sleeping();
            }
            ActionKind::Socialize => {
                self.villagers[index].begin_socializing();
            }
            ActionKind::Work => self.begin_work(index, job_id),
            ActionKind::Wander => self.begin_wander(index),
        }
    }

    fn begin_eat(&mut self, index: usize) {
        if self.resources.food == 0 {
            return;
        }
        self.resources.food -= 1;
        self.villagers[index].begin_eating();
    }

    fn begin_work(&mut self, index: usize, job_id: Option<u32>) {
        // Resume existing claim.
        let villager_id = self.villagers[index].id;
        let from = self.pos_to_tile(self.villagers[index].pos);

        let resolved = if let Some(existing) = self.villagers[index].current_job {
            if self.job_board.get(existing).is_some() {
                Some(existing)
            } else {
                self.villagers[index].current_job = None;
                None
            }
        } else {
            None
        };

        let job_id = match resolved.or(job_id) {
            Some(id) if self.job_board.claim_id(id, villager_id) => id,
            _ => match self.job_board.claim_best(villager_id, from) {
                Some(id) => id,
                None => return,
            },
        };

        self.villagers[index].current_job = Some(job_id);
        self.villagers[index].current_action = Some(ActionKind::Work);
        let tile = self
            .job_board
            .get(job_id)
            .map(|job| job.tile)
            .expect("claimed job");
        self.begin_move_to_job(index, tile, job_id);
    }

    fn begin_wander(&mut self, index: usize) {
        let from = self.pos_to_tile(self.villagers[index].pos);
        let width = self.width as i32;
        let height = self.height as i32;
        let seed = self.seed;
        let tick = self.clock.tick;
        let villager_id = self.villagers[index].id;
        let target = {
            let passable = |x: i32, y: i32| self.is_passable(x, y);
            wander_tile(from, seed, tick, villager_id, width, height, &passable)
        };
        let Some(target) = target else {
            self.villagers[index].current_action = Some(ActionKind::Wander);
            return;
        };
        match self.compute_path(from, target) {
            Some(path) => {
                self.villagers[index].state = AgentState::MovingTo {
                    target,
                    purpose: MovePurpose::Wander,
                };
                self.villagers[index].path = Some(path);
                self.villagers[index].current_action = Some(ActionKind::Wander);
            }
            None => {
                self.villagers[index].current_action = Some(ActionKind::Wander);
                self.villagers[index].repath_cooldown = REPATH_COOLDOWN_TICKS;
            }
        }
    }

    fn tick_eating(&mut self, index: usize, ticks_remaining: u32) {
        if ticks_remaining <= 1 {
            self.villagers[index].needs.set_hunger(1.0);
            self.villagers[index].state = AgentState::Idle;
            self.villagers[index].path = None;
            self.villagers[index].current_action = None;
        } else {
            self.villagers[index].state = AgentState::Eating {
                ticks_remaining: ticks_remaining - 1,
            };
        }
    }

    fn tick_sleeping(&mut self, index: usize, ticks_remaining: u32) {
        if ticks_remaining <= 1 {
            self.villagers[index].needs.set_energy(1.0);
            self.villagers[index].state = AgentState::Idle;
            self.villagers[index].path = None;
            self.villagers[index].current_action = None;
        } else {
            self.villagers[index].state = AgentState::Sleeping {
                ticks_remaining: ticks_remaining - 1,
            };
        }
    }

    fn tick_socializing(&mut self, index: usize, ticks_remaining: u32) {
        let from = self.pos_to_tile(self.villagers[index].pos);
        if !self.partner_in_range(index, from) {
            self.villagers[index].state = AgentState::Idle;
            self.villagers[index].current_action = None;
            return;
        }
        if ticks_remaining <= 1 {
            self.villagers[index].needs.add_social(SOCIAL_RESTORE);
            self.villagers[index].state = AgentState::Idle;
            self.villagers[index].path = None;
            self.villagers[index].current_action = None;
        } else {
            self.villagers[index].state = AgentState::Socializing {
                ticks_remaining: ticks_remaining - 1,
            };
        }
    }

    fn begin_move_to_job(&mut self, index: usize, tile: (i32, i32), job_id: u32) {
        let start = self.pos_to_tile(self.villagers[index].pos);
        if start == tile {
            self.villagers[index].path = None;
            self.villagers[index].state = AgentState::Working {
                job: job_id,
                ticks_remaining: WORK_CYCLE_TICKS,
            };
            return;
        }
        match self.compute_path(start, tile) {
            Some(path) => {
                self.villagers[index].state = AgentState::MovingTo {
                    target: tile,
                    purpose: MovePurpose::Work,
                };
                self.villagers[index].path = Some(path);
            }
            None => {
                self.release_job_at(index);
                self.villagers[index].repath_cooldown = REPATH_COOLDOWN_TICKS;
                self.villagers[index].clear_path_to_idle();
            }
        }
    }

    fn tick_moving(&mut self, index: usize, target: (i32, i32), purpose: MovePurpose) {
        if self.path_is_blocked_at(index, target) {
            self.try_repath(index, target, purpose);
            if !matches!(self.villagers[index].state, AgentState::MovingTo { .. }) {
                return;
            }
        }

        if self.villagers[index]
            .path
            .as_ref()
            .is_none_or(|path| path.is_empty())
        {
            let start = self.pos_to_tile(self.villagers[index].pos);
            if start == target {
                self.on_arrived(index, purpose, target);
                return;
            }
            self.try_repath(index, target, purpose);
            if self.villagers[index]
                .path
                .as_ref()
                .is_none_or(|path| path.is_empty())
            {
                return;
            }
        }

        let speed_px = MOVE_SPEED_TILES_PER_SEC * self.tile_size as f32 / TICKS_PER_SECOND;
        let Some(next) = self.villagers[index]
            .path
            .as_ref()
            .and_then(|path| path.first().copied())
        else {
            return;
        };
        let (cx, cy) = self.tile_center(next.0, next.1);
        let dx = cx - self.villagers[index].pos.0;
        let dy = cy - self.villagers[index].pos.1;
        let dist = (dx * dx + dy * dy).sqrt();
        if dist <= speed_px || dist <= ARRIVE_EPSILON_PX {
            self.villagers[index].pos = (cx, cy);
            if let Some(path) = self.villagers[index].path.as_mut() {
                path.remove(0);
                if path.is_empty() {
                    self.on_arrived(index, purpose, target);
                }
            }
        } else {
            self.villagers[index].pos.0 += dx / dist * speed_px;
            self.villagers[index].pos.1 += dy / dist * speed_px;
        }
    }

    fn on_arrived(&mut self, index: usize, purpose: MovePurpose, _target: (i32, i32)) {
        self.villagers[index].path = None;
        match purpose {
            MovePurpose::PlayerOrder | MovePurpose::Wander => {
                self.villagers[index].state = AgentState::Idle;
            }
            MovePurpose::Work => {
                if let Some(job_id) = self.villagers[index].current_job {
                    if self.job_board.get(job_id).is_some() {
                        self.villagers[index].state = AgentState::Working {
                            job: job_id,
                            ticks_remaining: WORK_CYCLE_TICKS,
                        };
                        return;
                    }
                }
                self.villagers[index].current_job = None;
                self.villagers[index].state = AgentState::Idle;
            }
        }
    }

    fn tick_working(&mut self, index: usize, job: u32, ticks_remaining: u32) {
        if self.job_board.get(job).is_none() {
            self.villagers[index].current_job = None;
            self.villagers[index].state = AgentState::Idle;
            if self.villagers[index].current_action == Some(ActionKind::Work) {
                self.villagers[index].current_action = None;
            }
            return;
        }
        if ticks_remaining == WORK_CYCLE_TICKS {
            self.tend_auto_plant(job);
        }
        self.tend_water_crops(job);
        if ticks_remaining <= 1 {
            self.villagers[index].state = AgentState::Working {
                job,
                ticks_remaining: WORK_CYCLE_TICKS,
            };
        } else {
            self.villagers[index].state = AgentState::Working {
                job,
                ticks_remaining: ticks_remaining - 1,
            };
        }
    }

    fn release_job_at(&mut self, index: usize) {
        if let Some(job_id) = self.villagers[index].current_job.take() {
            let villager_id = self.villagers[index].id;
            self.job_board.release(job_id, villager_id);
        }
    }

    fn try_repath(&mut self, index: usize, target: (i32, i32), purpose: MovePurpose) {
        if self.villagers[index].repath_cooldown > 0 {
            self.villagers[index].clear_path_to_idle();
            return;
        }
        let start = self.pos_to_tile(self.villagers[index].pos);
        match self.compute_path(start, target) {
            Some(path) => {
                self.villagers[index].path = Some(path);
                self.villagers[index].state = AgentState::MovingTo { target, purpose };
            }
            None => {
                self.villagers[index].clear_path_to_idle();
                self.villagers[index].repath_cooldown = REPATH_COOLDOWN_TICKS;
                if purpose == MovePurpose::Work {
                    self.release_job_at(index);
                }
            }
        }
    }

    fn path_is_blocked_at(&self, index: usize, target: (i32, i32)) -> bool {
        if !self.is_passable(target.0, target.1) {
            return true;
        }
        match &self.villagers[index].path {
            Some(path) => path.iter().any(|&(x, y)| !self.is_passable(x, y)),
            None => false,
        }
    }

    fn invalidate_paths_if_needed(&mut self) {
        let movers: Vec<(usize, (i32, i32), MovePurpose)> = self
            .villagers
            .iter()
            .enumerate()
            .filter_map(|(index, villager)| match villager.state {
                AgentState::MovingTo { target, purpose } => Some((index, target, purpose)),
                _ => None,
            })
            .collect();
        for (index, target, purpose) in movers {
            if self.path_is_blocked_at(index, target) {
                self.try_repath(index, target, purpose);
            }
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
        // Prefer the most open connected walkable tile near center so the
        // villager has room to path around buildings.
        let search_r = (self.width.max(self.height) as i32).min(48);
        let mut best: Option<(i32, i32, i32, i32)> = None; // x,y,score,dist
        for y in (cy - search_r)..=(cy + search_r) {
            for x in (cx - search_r)..=(cx + search_r) {
                if !self.is_spawn_candidate(x, y) {
                    continue;
                }
                let score = self.openness_score(x, y);
                let dist = (x - cx).abs() + (y - cy).abs();
                match best {
                    Some((_, _, best_score, best_dist))
                        if score < best_score || (score == best_score && dist >= best_dist) => {}
                    _ => best = Some((x, y, score, dist)),
                }
            }
        }
        if let Some((x, y, _, _)) = best {
            return Some((x, y));
        }
        if self.is_passable(cx, cy) {
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

    fn openness_score(&self, x: i32, y: i32) -> i32 {
        let mut score = 0;
        for dy in -4..=4 {
            for dx in -4..=4 {
                if self.is_passable(x + dx, y + dy) {
                    score += 1;
                }
            }
        }
        score
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
        self.invalidate_paths_if_needed();
        Ok(PlacementResult { id })
    }

    pub fn plant_crop(&mut self, kind: &str, x: i32, y: i32) -> Result<(), String> {
        let (kind_index, def) = self
            .catalog
            .find_crop(kind)
            .ok_or_else(|| format!("unknown crop '{kind}'"))?;
        let _ = def;
        let farm_id = self
            .completed_farm_at(x, y)
            .ok_or_else(|| "tile is not on a completed farm".to_string())?;
        let _ = farm_id;
        if self.crops.iter().any(|crop| crop.tile == (x, y)) {
            return Err("tile already has a crop".into());
        }
        let id = self.next_crop_id;
        self.next_crop_id = self.next_crop_id.saturating_add(1);
        self.crops
            .push(Crop::new(id, kind.to_string(), kind_index, (x, y)));
        Ok(())
    }

    pub fn advance_clock(&mut self, days: u32, season: Option<u8>) -> Result<(), String> {
        for _ in 0..days {
            self.clock.force_day_rollover();
            self.clear_all_crop_water();
        }
        if let Some(value) = season {
            self.clock.set_season(value)?;
        }
        Ok(())
    }

    fn tick_crops(&mut self) {
        let season = self.clock.season;
        let defs: Vec<Option<_>> = self
            .crops
            .iter()
            .map(|crop| self.catalog.get_crop(crop.kind_index).cloned())
            .collect();
        let mut ready_ids = Vec::new();
        for (crop, def) in self.crops.iter_mut().zip(defs) {
            let Some(def) = def else {
                continue;
            };
            if tick_crop(crop, &def, season) {
                ready_ids.push(crop.id);
            }
        }
        for id in ready_ids {
            self.events.push(SimEvent::CropReady { id });
        }
    }

    fn clear_all_crop_water(&mut self) {
        for crop in &mut self.crops {
            crop.watered = false;
        }
    }

    fn completed_farm_at(&self, x: i32, y: i32) -> Option<u32> {
        for building in &self.buildings {
            if building.state != BuildState::Complete {
                continue;
            }
            let Some(def) = self.catalog.get(building.kind_index) else {
                continue;
            };
            if def.id != "farm" {
                continue;
            }
            let footprint = rotated_footprint(def, building.rotation);
            if footprint_tiles(building.origin, footprint)
                .into_iter()
                .any(|(tx, ty)| tx == x && ty == y)
            {
                return Some(building.id);
            }
        }
        None
    }

    fn farm_footprint_tiles(&self, building_id: u32) -> Vec<(i32, i32)> {
        let Some(building) = self.buildings.iter().find(|b| b.id == building_id) else {
            return Vec::new();
        };
        let Some(def) = self.catalog.get(building.kind_index) else {
            return Vec::new();
        };
        let footprint = rotated_footprint(def, building.rotation);
        footprint_tiles(building.origin, footprint)
    }

    fn tend_water_crops(&mut self, job_id: u32) {
        let Some(job) = self.job_board.get(job_id).cloned() else {
            return;
        };
        let tiles = self.farm_footprint_tiles(job.site);
        for crop in &mut self.crops {
            if tiles.iter().any(|&tile| tile == crop.tile) {
                crop.watered = true;
            }
        }
    }

    fn tend_auto_plant(&mut self, job_id: u32) {
        let Some(job) = self.job_board.get(job_id).cloned() else {
            return;
        };
        let Some((kind_index, def)) = self.catalog.find_crop("wheat") else {
            return;
        };
        if !def.grows_in(self.clock.season) {
            return;
        }
        let tiles = self.farm_footprint_tiles(job.site);
        let empty = tiles.into_iter().find(|&tile| {
            self.completed_farm_at(tile.0, tile.1) == Some(job.site)
                && !self.crops.iter().any(|crop| crop.tile == tile)
        });
        let Some(tile) = empty else {
            return;
        };
        let id = self.next_crop_id;
        self.next_crop_id = self.next_crop_id.saturating_add(1);
        self.crops
            .push(Crop::new(id, "wheat".to_string(), kind_index, tile));
    }

    fn remove_crops_on_tiles(&mut self, tiles: &[(i32, i32)]) {
        self.crops
            .retain(|crop| !tiles.iter().any(|&tile| tile == crop.tile));
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
            .ok_or_else(|| "missing building definition".to_string())?
            .clone();
        let footprint = rotated_footprint(&def, building.rotation);
        let tiles = footprint_tiles(building.origin, footprint);
        for (tx, ty) in &tiles {
            if *tx < 0 || *ty < 0 || *tx >= self.width as i32 || *ty >= self.height as i32 {
                continue;
            }
            let tile_index = (*ty as u32 * self.width + *tx as u32) as usize;
            if self.occupancy[tile_index] == Some(entity_id) {
                self.occupancy[tile_index] = None;
            }
        }
        self.remove_crops_on_tiles(&tiles);
        self.resources.refund(&def.cost);
        let released = self.job_board.remove_site(entity_id);
        for villager in &mut self.villagers {
            if released.contains(&villager.id) {
                villager.current_job = None;
                if matches!(
                    villager.state,
                    AgentState::Working { .. }
                        | AgentState::MovingTo {
                            purpose: MovePurpose::Work,
                            ..
                        }
                ) {
                    villager.clear_path_to_idle();
                }
            } else if let Some(job_id) = villager.current_job {
                if self.job_board.get(job_id).is_none() {
                    villager.current_job = None;
                }
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sim::agents::{AgentState, MovePurpose};
    use crate::sim::clock::{Clock, Season};
    use crate::sim::jobs::JobKind;
    use crate::sim::needs::Needs;
    use crate::sim::terrain::Terrain;
    use crate::sim::utility::EAT_TICKS;

    fn grass_world() -> World {
        let mut world = World::generate(8, 8, 32, 1);
        world.tiles = vec![Terrain::Grass as u8; 64];
        world.occupancy = vec![None; 64];
        // Single villager for path/move unit tests.
        world.villagers.truncate(1);
        world.villagers[0].pos = world.tile_center(0, 0);
        world.villagers[0].clear_path_to_idle();
        world.villagers[0].current_job = None;
        world.villagers[0].current_action = None;
        world.job_board = JobBoard::new();
        world.crops.clear();
        world.events.clear();
        world.clock = Clock::new();
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
    fn spawns_five_villagers_on_walkable_tiles() {
        let world = World::default_world();
        let snap = world.tick_snapshot();
        assert_eq!(snap.villagers.len(), 5);
        assert_eq!(world.villagers().len(), 5);
        for villager in world.villagers() {
            assert_eq!(villager.state.as_u8(), 0);
            let (tx, ty) = world.pos_to_tile(villager.pos);
            assert!(world.is_passable(tx, ty));
        }
        assert_eq!(world.resources().food, 50);
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
        let mut arrived = false;
        for _ in 0..200 {
            world.advance();
            let (tx, ty) = world.pos_to_tile(world.villager().pos);
            if (tx, ty) == (5, 0)
                && !matches!(
                    world.villager().state,
                    AgentState::MovingTo {
                        purpose: MovePurpose::PlayerOrder,
                        ..
                    }
                )
            {
                arrived = true;
                break;
            }
        }
        assert!(arrived, "villager should reach ordered tile before wandering");
    }

    #[test]
    fn placing_building_on_path_triggers_repath_or_idle() {
        let mut world = grass_world();
        world.order_move(7, 0).unwrap();
        let path_before = world.villager().path.clone().expect("path");
        assert!(path_before.contains(&(3, 0)));
        world.place_building("hut", 3, 0, 0).unwrap();
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

    #[test]
    fn hunger_decays_across_ticks() {
        let mut world = grass_world();
        world.resources.food = 0; // prevent eating from restoring hunger
        let before = world.villager().needs.hunger;
        for _ in 0..500 {
            world.advance();
        }
        assert!(world.villager().needs.hunger < before);
        let detail = world.villager_detail(1).unwrap();
        assert!(detail.hunger < before);
    }

    #[test]
    fn completed_farm_advertises_tend_crops_and_villager_works() {
        let mut world = grass_world();
        world.place_building("farm", 2, 2, 0).unwrap();
        for _ in 0..30 {
            world.advance();
        }
        assert_eq!(world.buildings()[0].state, BuildState::Complete);
        assert!(
            world
                .job_board()
                .jobs()
                .iter()
                .any(|job| job.kind == JobKind::TendCrops)
        );

        for _ in 0..400 {
            world.advance();
            if matches!(world.villager().state, AgentState::Working { .. }) {
                break;
            }
        }
        assert!(
            matches!(world.villager().state, AgentState::Working { .. }),
            "expected Working, got {:?}",
            world.villager().state
        );
        assert!(world.villager().current_job.is_some());
        let detail = world.villager_detail(1).unwrap();
        assert_eq!(detail.job_kind.as_deref(), Some("tend_crops"));
        assert_eq!(detail.state, 2);
    }

    #[test]
    fn demolish_farm_clears_jobs_and_returns_villager_to_idle() {
        let mut world = grass_world();
        let placed = world.place_building("farm", 2, 2, 0).unwrap();
        for _ in 0..30 {
            world.advance();
        }
        for _ in 0..400 {
            world.advance();
            if matches!(world.villager().state, AgentState::Working { .. }) {
                break;
            }
        }
        assert!(matches!(world.villager().state, AgentState::Working { .. }));
        world.demolish(placed.id).unwrap();
        assert!(world.job_board().jobs().is_empty());
        assert!(world.villager().current_job.is_none());
        assert!(matches!(world.villager().state, AgentState::Idle));
    }

    #[test]
    fn player_move_releases_job_claim() {
        let mut world = grass_world();
        world.place_building("farm", 2, 2, 0).unwrap();
        for _ in 0..30 {
            world.advance();
        }
        for _ in 0..400 {
            world.advance();
            if world.villager().current_job.is_some() {
                break;
            }
        }
        assert!(world.villager().current_job.is_some());
        world.order_move(7, 7).unwrap();
        assert!(world.villager().current_job.is_none());
        assert!(matches!(
            world.villager().state,
            AgentState::MovingTo {
                purpose: MovePurpose::PlayerOrder,
                ..
            }
        ));
    }

    #[test]
    fn plant_crop_on_completed_farm_and_grow_with_water() {
        let mut world = grass_world();
        world.place_building("farm", 2, 2, 0).unwrap();
        for _ in 0..30 {
            world.advance();
        }
        world.plant_crop("wheat", 2, 2).unwrap();
        assert_eq!(world.crops().len(), 1);
        assert!(world.plant_crop("wheat", 2, 2).is_err());
        assert!(world.plant_crop("wheat", 0, 0).is_err());

        world.crops[0].watered = true;
        let ticks_per_stage = world.catalog().find_crop("wheat").unwrap().1.ticks_per_stage;
        let stages = world.catalog().find_crop("wheat").unwrap().1.stages;
        for _ in 0..(ticks_per_stage * u32::from(stages)) {
            world.crops[0].watered = true;
            world.advance();
        }
        assert_eq!(world.crops()[0].stage, stages - 1);
        assert!(world.crops()[0].ready_emitted);
    }

    #[test]
    fn winter_stalls_crop_growth() {
        let mut world = grass_world();
        world.place_building("farm", 2, 2, 0).unwrap();
        for _ in 0..30 {
            world.advance();
        }
        world.plant_crop("wheat", 3, 3).unwrap();
        world.advance_clock(0, Some(Season::Winter as u8)).unwrap();
        world.crops[0].watered = true;
        for _ in 0..500 {
            world.crops[0].watered = true;
            world.advance();
        }
        assert_eq!(world.crops()[0].stage, 0);
    }

    #[test]
    fn tend_crops_auto_plants_and_waters() {
        let mut world = grass_world();
        world.place_building("farm", 2, 2, 0).unwrap();
        for _ in 0..30 {
            world.advance();
        }
        for _ in 0..500 {
            world.advance();
            if !world.crops().is_empty() {
                break;
            }
        }
        assert!(
            !world.crops().is_empty(),
            "TendCrops should auto-plant wheat on empty farm tiles"
        );
        assert!(world.crops().iter().any(|crop| crop.watered));
    }

    #[test]
    fn demolish_farm_removes_crops() {
        let mut world = grass_world();
        let placed = world.place_building("farm", 2, 2, 0).unwrap();
        for _ in 0..30 {
            world.advance();
        }
        world.plant_crop("wheat", 2, 2).unwrap();
        world.plant_crop("wheat", 3, 2).unwrap();
        assert_eq!(world.crops().len(), 2);
        world.demolish(placed.id).unwrap();
        assert!(world.crops().is_empty());
    }

    #[test]
    fn day_rollover_clears_water_and_paused_skips_advance() {
        let mut world = grass_world();
        world.place_building("farm", 2, 2, 0).unwrap();
        for _ in 0..30 {
            world.advance();
        }
        world.plant_crop("wheat", 2, 2).unwrap();
        world.crops[0].watered = true;
        world.advance_clock(1, None).unwrap();
        assert!(!world.crops()[0].watered);
        assert_eq!(world.clock().day, 2);

        let tick_before = world.clock().tick;
        world.clock.set_speed(0).unwrap();
        if !world.clock().speed.is_paused() {
            world.advance();
        }
        assert_eq!(world.clock().tick, tick_before);
    }

    #[test]
    fn snapshot_includes_clock_and_crops() {
        let mut world = grass_world();
        world.place_building("farm", 2, 2, 0).unwrap();
        for _ in 0..30 {
            world.advance();
        }
        world.plant_crop("wheat", 4, 4).unwrap();
        let snap = world.tick_snapshot();
        assert_eq!(snap.clock.day, 1);
        assert_eq!(snap.clock.season, 0);
        assert_eq!(snap.clock.speed, 1);
        assert_eq!(snap.crops.len(), 1);
        assert_eq!(snap.crops[0].x, 4);
        assert_eq!(snap.crops[0].y, 4);
        assert_eq!(snap.villagers.len(), 1);
    }

    #[test]
    fn hungry_villager_eats_without_releasing_job() {
        let mut world = grass_world();
        world.place_building("farm", 2, 2, 0).unwrap();
        for _ in 0..30 {
            world.advance();
        }
        for _ in 0..400 {
            world.advance();
            if matches!(world.villager().state, AgentState::Working { .. }) {
                break;
            }
        }
        assert!(matches!(world.villager().state, AgentState::Working { .. }));
        let job = world.villager().current_job;
        assert!(job.is_some());
        world.villager_mut().needs.set_hunger(0.0);
        let food_before = world.resources().food;
        world.maybe_decide(0);
        assert!(matches!(world.villager().state, AgentState::Eating { .. }));
        assert_eq!(world.villager().current_job, job);
        assert_eq!(world.resources().food, food_before - 1);
        for _ in 0..EAT_TICKS {
            world.advance();
            if !matches!(world.villager().state, AgentState::Eating { .. }) {
                break;
            }
        }
        assert!((world.villager().needs.hunger - 1.0).abs() < 1e-5);
    }

    #[test]
    fn completed_eat_clears_action_so_hysteresis_cannot_reenter() {
        let mut world = grass_world();
        world.resources.food = 3;
        world.villager_mut().needs = Needs::full();
        world.villager_mut().needs.set_hunger(0.0);
        world.maybe_decide(0);
        assert!(matches!(world.villager().state, AgentState::Eating { .. }));
        assert_eq!(world.resources().food, 2);

        for _ in 0..EAT_TICKS + 2 {
            world.advance();
            if matches!(world.villager().state, AgentState::Idle) {
                break;
            }
        }
        assert!(matches!(world.villager().state, AgentState::Idle));
        assert!(world.villager().current_action.is_none());
        assert!((world.villager().needs.hunger - 1.0).abs() < 1e-5);

        let food_after_eat = world.resources().food;
        for _ in 0..40 {
            world.advance();
        }
        // Hunger is full — must not re-enter Eat via leftover hysteresis.
        assert_eq!(world.resources().food, food_after_eat);
        assert!(!matches!(world.villager().state, AgentState::Eating { .. }));
    }

    #[test]
    fn stale_eat_action_while_idle_does_not_block_wander() {
        let mut world = grass_world();
        world.resources.food = 0;
        world.villager_mut().needs = Needs::full();
        world.villager_mut().current_action = Some(crate::sim::utility::ActionKind::Eat);
        world.maybe_decide(0);
        assert_ne!(
            world.villager().current_action,
            Some(crate::sim::utility::ActionKind::Eat)
        );
        assert!(
            matches!(
                world.villager().state,
                AgentState::MovingTo {
                    purpose: MovePurpose::Wander,
                    ..
                }
            ) || world.villager().current_action
                == Some(crate::sim::utility::ActionKind::Wander),
            "expected wander after clearing stale Eat, got state={:?} action={:?}",
            world.villager().state,
            world.villager().current_action
        );
    }

    #[test]
    fn two_villagers_can_claim_farm_slots() {
        let mut world = World::generate(8, 8, 32, 1);
        world.tiles = vec![Terrain::Grass as u8; 64];
        world.occupancy = vec![None; 64];
        world.villagers.truncate(2);
        world.villagers[0].pos = world.tile_center(0, 0);
        world.villagers[1].pos = world.tile_center(7, 7);
        for v in &mut world.villagers {
            v.clear_path_to_idle();
            v.current_job = None;
            v.current_action = None;
        }
        world.job_board = JobBoard::new();
        world.clock = Clock::new();
        world.place_building("farm", 2, 2, 0).unwrap();
        for _ in 0..30 {
            world.advance();
        }
        for _ in 0..500 {
            world.advance();
            let working = world
                .villagers()
                .iter()
                .filter(|v| matches!(v.state, AgentState::Working { .. }))
                .count();
            if working >= 2 {
                break;
            }
        }
        let working = world
            .villagers()
            .iter()
            .filter(|v| matches!(v.state, AgentState::Working { .. }))
            .count();
        assert!(
            working >= 2,
            "expected both villagers working, got {:?}",
            world.villagers().iter().map(|v| &v.state).collect::<Vec<_>>()
        );
    }
}
