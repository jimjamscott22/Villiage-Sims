//! Cached neighborhood geometry and bounded destination selection.
use super::*;
use std::collections::VecDeque;

#[derive(Clone, Debug)]
pub(super) struct Destination { pub tile: (i32, i32), pub building: u32, pub density: u32 }
type BuildingKey = (u32, u8, (i32, i32), u8, bool);
type HutFootprint = (Vec<(i32, i32)>, BTreeSet<u32>);
#[derive(Clone, Debug, Default)]
pub(super) struct LeisureCache {
    signature: Vec<BuildingKey>,
    components: Vec<u32>,
    pub destinations: Vec<Destination>,
    huts: Vec<HutFootprint>,
}

impl World {
    pub(super) fn refresh_leisure_cache(&mut self) {
        let signature: Vec<_> = self.buildings.iter().map(|b| (b.id, b.kind_index, b.origin, b.rotation, b.state == BuildState::Complete)).collect();
        if self.leisure_cache.components.len() == self.tiles.len() && self.leisure_cache.signature == signature { return; }
        let mut cache = LeisureCache { signature, components: vec![0; self.tiles.len()], ..Default::default() };
        let mut component = 0;
        for y in 0..self.height as i32 { for x in 0..self.width as i32 {
            let offset = y as usize * self.width as usize + x as usize;
            if cache.components[offset] != 0 || !self.is_passable(x, y) { continue; }
            component += 1;
            cache.components[offset] = component;
            let mut queue = VecDeque::from([(x, y)]);
            while let Some((x, y)) = queue.pop_front() {
                for (nx, ny) in [(x-1,y), (x+1,y), (x,y-1), (x,y+1)] {
                    if !self.is_passable(nx, ny) { continue; }
                    let n = ny as usize * self.width as usize + nx as usize;
                    if cache.components[n] == 0 { cache.components[n] = component; queue.push_back((nx, ny)); }
                }
            }
        }}
        for b in &self.buildings {
            let Some(def) = self.catalog.get(b.kind_index) else { continue; };
            if b.state != BuildState::Complete || !matches!(def.id.as_str(), "hut" | "well") { continue; }
            let footprint = footprint_tiles(b.origin, rotated_footprint(def, b.rotation));
            let mut perimeter = BTreeSet::new();
            for &(x,y) in &footprint { for t in [(x-1,y),(x+1,y),(x,y-1),(x,y+1)] {
                if self.is_passable(t.0, t.1) { perimeter.insert(t); }
            }}
            if def.id == "hut" {
                let components = perimeter.iter().map(|&(x,y)| cache.components[y as usize * self.width as usize + x as usize]).collect();
                cache.huts.push((footprint, components));
            }
            cache.destinations.extend(perimeter.into_iter().map(|tile| Destination { tile, building: b.id, density: 0 }));
        }
        self.leisure_cache = cache;
        let densities: Vec<_> = self.leisure_cache.destinations.iter().map(|d| self.hut_density(d.tile)).collect();
        for (d, density) in self.leisure_cache.destinations.iter_mut().zip(densities) { d.density = density; }
    }

    pub(super) fn leisure_connected(&self, from: (i32, i32), to: (i32, i32)) -> bool {
        if !self.in_bounds(from.0, from.1) || !self.in_bounds(to.0, to.1) { return false; }
        let get = |t: (i32, i32)| self.leisure_cache.components.get(t.1 as usize * self.width as usize + t.0 as usize).copied();
        match (get(from), get(to)) {
            (Some(a), Some(b)) => a != 0 && a == b,
            _ => self.compute_path(from, to).is_some(),
        }
    }

    pub(super) fn hut_density(&self, tile: (i32, i32)) -> u32 {
        if !self.in_bounds(tile.0, tile.1) { return 0; }
        let Some(component) = self.leisure_cache.components.get(tile.1 as usize * self.width as usize + tile.0 as usize) else { return 0; };
        self.leisure_cache.huts.iter().filter(|(footprint, components)| components.contains(component)
            && footprint.iter().any(|&t| chebyshev(tile, t) <= 8)).count().min(5) as u32
    }

    pub(super) fn tile_reserved(&self, tile: (i32, i32), except: u32) -> bool {
        self.behavior.iter().any(|(id,b)| *id != except && b.destination == Some(tile))
            || self.encounters.iter().any(|p| p.meeting == tile || p.waiting == tile)
    }

    pub(super) fn leisure_access_available(&self, tile: (i32, i32), except: u32) -> bool {
        self.leisure_cache.destinations.iter().filter(|d| d.tile == tile).all(|d|
            self.leisure_cache.destinations.iter().any(|other| other.building == d.building && other.tile != tile && !self.tile_reserved(other.tile, except)))
    }

    pub(super) fn is_leisure_activity(&self, index: usize) -> bool {
        matches!(self.villagers[index].state, AgentState::MovingTo { purpose: MovePurpose::Wander, .. })
            || self.behavior.get(&self.villagers[index].id).is_some_and(|b| b.pause > 0)
    }

    pub(super) fn has_leisure_intent(&self, index: usize) -> bool {
        self.behavior.get(&self.villagers[index].id).is_some_and(|b| b.destination.is_some()
            && (b.pause > 0 || matches!(self.villagers[index].state, AgentState::MovingTo { .. })))
    }

    pub(super) fn clear_leisure(&mut self, index: usize) {
        if let Some(b) = self.behavior.get_mut(&self.villagers[index].id) {
            b.destination = None; b.building = None; b.pause = 0;
        }
    }

    pub(super) fn arrive_leisure(&mut self, index: usize) {
        let b = self.behavior.entry(self.villagers[index].id).or_default();
        b.pause = 80; b.previous = b.destination;
    }

    pub(super) fn begin_leisure(&mut self, index: usize) {
        let id = self.villagers[index].id;
        let from = self.pos_to_tile(self.villagers[index].pos);
        let state = self.behavior.entry(id).or_default().clone();
        let salt = (self.seed as u32).wrapping_add(id.wrapping_mul(31)).wrapping_add(state.visits.wrapping_mul(17));
        let mut candidates: Vec<_> = self.leisure_cache.destinations.iter().filter(|d|
            chebyshev(from, d.tile) <= 16 && d.tile != from && !self.tile_reserved(d.tile, id)
                && self.leisure_access_available(d.tile, id)
                && !self.villagers.iter().any(|v| v.id != id && self.pos_to_tile(v.pos) == d.tile)).cloned().collect();
        let rank = |d: &Destination| {
            let dist = (from.0-d.tile.0).abs() + (from.1-d.tile.1).abs();
            (1.0 + 0.15 * d.density as f32) / (1.0 + 0.1 * dist as f32)
        };
        candidates.sort_by(|a,b| (Some(a.tile) == state.previous).cmp(&(Some(b.tile) == state.previous))
            .then_with(|| rank(b).total_cmp(&rank(a)))
            .then_with(|| leisure_hash(a.tile, salt).cmp(&leisure_hash(b.tile, salt))).then_with(|| a.tile.cmp(&b.tile)));
        let mut routes = Vec::new();
        for d in candidates.into_iter().take(8) {
            if let Some(path) = self.compute_path(from, d.tile) {
                let score = (1.0 + 0.15 * d.density as f32) / (1.0 + 0.1 * path.len() as f32);
                routes.push((d, path, score));
            }
        }
        routes.sort_by(|a,b| (Some(a.0.tile) == state.previous).cmp(&(Some(b.0.tile) == state.previous))
            .then_with(|| b.2.total_cmp(&a.2)).then_with(|| leisure_hash(a.0.tile, salt).cmp(&leisure_hash(b.0.tile, salt))));
        let choice = routes.into_iter().next().map(|(d,p,_)| (d.tile, Some(d.building), p)).or_else(|| {
            (0..8).find_map(|attempt| {
                let t = wander_tile(from, self.seed, self.clock.tick + u64::from(state.visits) + attempt, id, self.width as i32, self.height as i32, &|x,y| self.is_passable(x,y))?;
                if t == from || Some(t) == state.previous || self.tile_reserved(t, id) || !self.leisure_access_available(t, id) { return None; }
                self.compute_path(from,t).map(|p| (t,None,p))
            })
        });
        self.clear_leisure(index);
        self.villagers[index].current_action = Some(ActionKind::Wander);
        if let Some((tile,building,path)) = choice {
            let b = self.behavior.entry(id).or_default();
            b.destination = Some(tile); b.building = building; b.visits = b.visits.wrapping_add(1);
            self.villagers[index].state = AgentState::MovingTo { target: tile, purpose: MovePurpose::Wander };
            self.villagers[index].path = Some(path);
        } else { self.villagers[index].clear_path_to_idle(); self.villagers[index].repath_cooldown = REPATH_COOLDOWN_TICKS; }
    }
}

fn leisure_hash(tile: (i32,i32), salt: u32) -> u32 {
    (tile.0 as u32).wrapping_mul(73856093) ^ (tile.1 as u32).wrapping_mul(19349663) ^ salt.wrapping_mul(83492791)
}
