//! World-owned social encounters. Timers and rewards advance once per pair.
use super::*;

pub(super) const CHAT_TICKS: u32 = 120;
pub(super) const CHAT_GAIN: f32 = 0.30 / CHAT_TICKS as f32;

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub(super) struct Behavior {
    pub cooldown: u32,
    pub destination: Option<(i32, i32)>,
    pub building: Option<u32>,
    pub previous: Option<(i32, i32)>,
    pub visits: u32,
    pub pause: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub(super) struct Encounter {
    pub a: u32,
    pub b: u32,
    pub meeting: (i32, i32),
    pub waiting: (i32, i32),
    pub remaining: u32,
    pub talking: bool,
}

impl World {
    pub(super) fn encounter_for(&self, id: u32) -> Option<&Encounter> {
        self.encounters.iter().find(|p| p.a == id || p.b == id)
    }

    pub(super) fn social_eligible(&self, index: usize) -> bool {
        let v = &self.villagers[index];
        v.needs.hunger > 0.25 && v.needs.energy > 0.25
            && v.current_job.is_none() && v.carrying.is_none()
            && self.encounter_for(v.id).is_none()
            && self.behavior.get(&v.id).is_none_or(|b| b.cooldown == 0)
            && (matches!(v.state, AgentState::Idle) || self.is_leisure_activity(index))
    }

    pub(super) fn begin_encounter(&mut self, index: usize) -> bool {
        if !self.social_eligible(index) { return false; }
        let from = self.pos_to_tile(self.villagers[index].pos);
        let mut choices = Vec::new();
        for (j, v) in self.villagers.iter().enumerate() {
            let waiting = self.pos_to_tile(v.pos);
            // A walking partner is recruited at a tile center, never teleported.
            if j == index || !self.social_eligible(j) || chebyshev(from, waiting) > 8
                || v.pos != self.tile_center(waiting.0, waiting.1)
                || self.tile_reserved(waiting, v.id) { continue; }
            for meeting in [(waiting.0 - 1, waiting.1), (waiting.0 + 1, waiting.1),
                (waiting.0, waiting.1 - 1), (waiting.0, waiting.1 + 1)] {
                if !self.is_passable(meeting.0, meeting.1)
                    || self.tile_reserved(meeting, self.villagers[index].id)
                    || self.villagers.iter().any(|other| other.id != self.villagers[index].id && self.pos_to_tile(other.pos) == meeting)
                    || !self.leisure_access_available(meeting, self.villagers[index].id) { continue; }
                if let Some(path) = self.compute_path(from, meeting) {
                    choices.push((path.len(), v.id, meeting, waiting, j, path));
                }
            }
        }
        choices.sort_by_key(|c| (c.0, c.1, c.2));
        let Some((_, b, meeting, waiting, j, mut path)) = choices.into_iter().next() else { return false; };
        let a = self.villagers[index].id;
        self.clear_leisure(index);
        self.clear_leisure(j);
        // A villager can be between tile centers when its leisure trip is interrupted.
        if path.is_empty() && self.villagers[index].pos != self.tile_center(meeting.0, meeting.1) { path.push(meeting); }
        self.villagers[index].state = AgentState::MovingTo { target: meeting, purpose: MovePurpose::Wander };
        self.villagers[index].path = Some(path);
        self.villagers[index].current_action = Some(ActionKind::Socialize);
        self.villagers[j].clear_path_to_idle();
        self.villagers[j].current_action = Some(ActionKind::Socialize);
        self.encounters.push(Encounter { a, b, meeting, waiting, remaining: 200, talking: false });
        true
    }

    fn finish_encounter(&mut self, pair: &Encounter, cooldown: u32) {
        for id in [pair.a, pair.b] {
            if let Some(v) = self.villagers.iter_mut().find(|v| v.id == id) {
                if v.current_action == Some(ActionKind::Socialize) {
                    v.clear_path_to_idle();
                    v.current_action = None;
                    v.thought = None;
                }
                self.behavior.entry(id).or_default().cooldown = cooldown;
            }
        }
    }

    pub(super) fn cancel_encounter(&mut self, id: u32) {
        if let Some(i) = self.encounters.iter().position(|p| p.a == id || p.b == id) {
            let pair = self.encounters.remove(i);
            self.finish_encounter(&pair, if pair.talking { 400 } else { 100 });
        }
    }

    fn pair_valid(&self, pair: &Encounter) -> bool {
        [pair.a, pair.b].iter().all(|id| self.villagers.iter().any(|v|
            v.id == *id && v.needs.hunger > 0.25 && v.needs.energy > 0.25
                && v.current_action == Some(ActionKind::Socialize)))
            && self.is_passable(pair.meeting.0, pair.meeting.1)
            && self.is_passable(pair.waiting.0, pair.waiting.1)
    }

    pub(super) fn cancel_invalid_encounters(&mut self) {
        let invalid: Vec<_> = self.encounters.iter().filter(|p| !self.pair_valid(p)).map(|p| p.a).collect();
        for id in invalid { self.cancel_encounter(id); }
        let ids: BTreeSet<_> = self.villagers.iter().map(|v| v.id).collect();
        self.behavior.retain(|id, _| ids.contains(id));
    }

    pub(super) fn prepare_behavior_tick(&mut self) {
        self.refresh_leisure_cache();
        for b in self.behavior.values_mut() {
            b.cooldown = b.cooldown.saturating_sub(1);
            b.pause = b.pause.saturating_sub(1);
        }
        self.cancel_invalid_encounters();
        for i in 0..self.villagers.len() {
            let invalid = self.behavior.get(&self.villagers[i].id).is_some_and(|b| {
                b.destination.is_some_and(|tile| !self.is_passable(tile.0, tile.1)
                    || b.building.is_some_and(|id| !self.leisure_cache.destinations.iter().any(|d| d.building == id && d.tile == tile)))
            });
            if invalid { self.clear_leisure(i); self.villagers[i].clear_path_to_idle(); self.villagers[i].current_action = None; }
        }
    }

    pub(super) fn tick_encounters(&mut self) {
        for mut pair in std::mem::take(&mut self.encounters) {
            if !self.pair_valid(&pair) { self.finish_encounter(&pair, 100); continue; }
            let a = self.villagers.iter().position(|v| v.id == pair.a).unwrap();
            let b = self.villagers.iter().position(|v| v.id == pair.b).unwrap();
            if pair.talking {
                for i in [a, b] { self.villagers[i].needs.add_social(CHAT_GAIN); }
                pair.remaining -= 1;
            } else if self.villagers[a].pos == self.tile_center(pair.meeting.0, pair.meeting.1)
                && self.villagers[b].pos == self.tile_center(pair.waiting.0, pair.waiting.1) {
                pair.talking = true;
                pair.remaining = CHAT_TICKS;
                for i in [a, b] {
                    self.villagers[i].path = None;
                    self.villagers[i].state = AgentState::Socializing { ticks_remaining: CHAT_TICKS };
                }
            } else { pair.remaining -= 1; }
            if pair.remaining == 0 { self.finish_encounter(&pair, if pair.talking { 400 } else { 100 }); }
            else { self.encounters.push(pair); }
        }
    }

    pub(super) fn activity_kind(&self, v: &Villager) -> Option<String> {
        if let Some(p) = self.encounter_for(v.id) {
            return Some(if p.talking { "talking" } else if p.a == v.id { "meeting" } else { "waiting" }.into());
        }
        self.behavior.get(&v.id).and_then(|b| {
            if b.pause > 0 { Some("break".into()) } else if b.destination.is_some() { Some("visiting".into()) } else { None }
        })
    }

    pub(super) fn activity_label(&self, v: &Villager) -> String {
        if let Some(p) = self.encounter_for(v.id) {
            let other = if p.a == v.id { p.b } else { p.a };
            let name = self.villagers.iter().find(|v| v.id == other).map(|v| v.name.as_str()).unwrap_or("a villager");
            return format!("{} {name}", if p.talking { "Talking to" } else if p.a == v.id { "Meeting" } else { "Waiting for" });
        }
        if let Some(b) = self.behavior.get(&v.id) {
            if b.pause > 0 { return "Taking a break".into(); }
            if b.destination.is_some() {
                return b.building.and_then(|id| self.buildings.iter().find(|b| b.id == id))
                    .and_then(|b| self.catalog.get(b.kind_index)).map(|d| format!("Heading to the {}", d.id))
                    .unwrap_or_else(|| "Taking a stroll".into());
            }
        }
        v.state.label().into()
    }

    pub(super) fn validate_behavior(&self) -> Result<(), String> {
        let mut used = BTreeSet::new();
        let mut tiles = BTreeSet::new();
        for p in &self.encounters {
            if p.a == p.b || !used.insert(p.a) || !used.insert(p.b)
                || !tiles.insert(p.meeting) || !tiles.insert(p.waiting)
                || p.remaining == 0 || p.remaining > if p.talking { CHAT_TICKS } else { 200 }
                || (p.meeting.0 - p.waiting.0).abs() + (p.meeting.1 - p.waiting.1).abs() != 1
                || !self.in_bounds(p.meeting.0, p.meeting.1) || !self.in_bounds(p.waiting.0, p.waiting.1)
                || ![p.a, p.b].iter().all(|id| self.villagers.iter().any(|v| v.id == *id && v.current_action == Some(ActionKind::Socialize))) {
                return Err("save contains an invalid social encounter".into());
            }
            for (id, tile) in [(p.a, p.meeting), (p.b, p.waiting)] {
                let v = self.villagers.iter().find(|v| v.id == id).unwrap();
                if (p.talking || id == p.b) && v.pos != self.tile_center(tile.0, tile.1) {
                    return Err("save contains an invalid conversation position".into());
                }
            }
        }
        for (id, b) in &self.behavior {
            if !self.villagers.iter().any(|v| v.id == *id) || b.cooldown > 400 || b.pause > 80
                || b.destination.is_some_and(|t| !self.in_bounds(t.0, t.1) || !tiles.insert(t))
                || (b.building.is_some() && b.destination.is_none()) {
                return Err("save contains invalid leisure behavior".into());
            }
        }
        Ok(())
    }
}
