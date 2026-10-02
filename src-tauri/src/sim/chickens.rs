//! Optional ambient flock. All timers and random state are persisted for replay.
use super::pathfind::{find_path, terrain_passable};
use super::terrain::Terrain;
use serde::{Deserialize, Serialize};

pub const EGG_FOOD: u32 = 3;
const DELTAS: [(i32, i32); 4] = [(1, 0), (-1, 0), (0, 1), (0, -1)];

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub enum Tendency {
    Curious,
    Sleepy,
    Social,
}
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub enum Activity {
    Walking,
    Pecking,
    Scratching,
    Resting,
    Following,
    Returning,
    Sleeping,
    Tilt,
    Scurry,
    Hop,
}
impl Activity {
    fn label(self) -> &'static str {
        match self {
            Self::Walking => "investigating a flower",
            Self::Pecking => "pecking for little treasures",
            Self::Scratching => "scratching the ground",
            Self::Resting => "taking a little rest",
            Self::Following => "following a friend",
            Self::Returning => "heading home to roost",
            Self::Sleeping => "sleeping by the shelter",
            Self::Tilt => "watching a passing villager",
            Self::Scurry => "scurrying out of the way",
            Self::Hop => "hopping and clucking",
        }
    }
    fn pose(self) -> &'static str {
        match self {
            Self::Walking | Self::Following | Self::Returning => "walk",
            Self::Pecking => "peck",
            Self::Scratching => "scratch",
            Self::Sleeping => "sleep",
            Self::Scurry => "startled",
            Self::Hop => "hop",
            Self::Tilt => "tilt",
            Self::Resting => "rest",
        }
    }
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Chicken {
    pub id: u32,
    pub name: String,
    pub tendency: Tendency,
    pub pos: (f32, f32),
    pub activity: Activity,
    pub remaining: u32,
    pub path: Vec<(i32, i32)>,
    pub rng: u32,
    pub click_cooldown: u32,
    pub reaction_cooldown: u32,
    pub sound_seq: u32,
    pub facing_left: bool,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Flock {
    pub shelter_id: u32,
    pub home: (i32, i32),
    pub chickens: Vec<Chicken>,
    pub baskets: Vec<u32>,
    pub next_basket: u32,
    pub last_morning: u32,
    pub settling: u32,
}
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChickenView {
    pub id: u32,
    pub shelter_id: u32,
    pub name: String,
    pub tendency: &'static str,
    pub x: f32,
    pub y: f32,
    pub pose: &'static str,
    pub activity: &'static str,
    pub sound_seq: u32,
    pub facing_left: bool,
}
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EggBasketView {
    pub id: u32,
    pub shelter_id: u32,
    pub x: f32,
    pub y: f32,
}

pub struct Ground<'a> {
    pub width: u32,
    pub height: u32,
    pub tile_size: u32,
    pub tiles: &'a [u8],
    pub occupancy: &'a [Option<u32>],
}
impl Ground<'_> {
    pub fn free(&self, x: i32, y: i32) -> bool {
        if x < 0 || y < 0 || x >= self.width as i32 || y >= self.height as i32 {
            return false;
        }
        let i = y as usize * self.width as usize + x as usize;
        self.occupancy[i].is_none() && Terrain::from_u8(self.tiles[i]).is_some_and(terrain_passable)
    }
    fn center(&self, t: (i32, i32)) -> (f32, f32) {
        (
            (t.0 as f32 + 0.5) * self.tile_size as f32,
            (t.1 as f32 + 0.5) * self.tile_size as f32,
        )
    }
    fn tile(&self, p: (f32, f32)) -> (i32, i32) {
        (
            (p.0 / self.tile_size as f32).floor() as i32,
            (p.1 / self.tile_size as f32).floor() as i32,
        )
    }
}
fn distance(a: (i32, i32), b: (i32, i32)) -> i32 {
    (a.0 - b.0).abs().max((a.1 - b.1).abs())
}
fn random(c: &mut Chicken) -> u32 {
    let mut r = c.rng;
    r ^= r << 13;
    r ^= r >> 17;
    r ^= r << 5;
    c.rng = r;
    r
}
fn local_free(g: &Ground<'_>, home: (i32, i32)) -> Vec<(i32, i32)> {
    let mut out = Vec::new();
    for y in home.1 - 5..=home.1 + 5 {
        for x in home.0 - 5..=home.0 + 5 {
            if g.free(x, y) {
                out.push((x, y));
            }
        }
    }
    out.sort_by_key(|t| distance(*t, home));
    out
}
impl Flock {
    pub fn new(shelter_id: u32, home: (i32, i32), seed: u64, date: u32, g: &Ground<'_>) -> Self {
        let free = local_free(g, home);
        let chickens = [
            ("Pip", Tendency::Curious),
            ("Mabel", Tendency::Sleepy),
            ("Poppy", Tendency::Social),
        ]
        .into_iter()
        .enumerate()
        .map(|(i, (name, tendency))| Chicken {
            id: i as u32 + 1,
            name: name.into(),
            tendency,
            pos: g.center(free[i % free.len()]),
            activity: if i == 2 {
                Activity::Scratching
            } else if i == 1 {
                Activity::Resting
            } else {
                Activity::Pecking
            },
            remaining: 40 + i as u32 * 35,
            path: Vec::new(),
            rng: ((seed as u32)
                ^ shelter_id.wrapping_mul(2654435761)
                ^ (i as u32 + 1).wrapping_mul(2246822519))
            .max(1),
            click_cooldown: 0,
            reaction_cooldown: 100,
            sound_seq: 0,
            facing_left: false,
        })
        .collect();
        Self {
            shelter_id,
            home,
            chickens,
            baskets: Vec::new(),
            next_basket: 1,
            last_morning: date,
            settling: 1200,
        }
    }
    pub fn relocate(&mut self, g: &Ground<'_>) {
        let free = local_free(g, self.home);
        for c in &mut self.chickens {
            let tile = g.tile(c.pos);
            if !g.free(tile.0, tile.1) {
                if let Some(t) = free.iter().min_by_key(|t| distance(**t, tile)) {
                    c.pos = g.center(*t);
                }
                c.path.clear();
                c.remaining = 0;
            }
        }
    }
    pub fn click(&mut self, id: u32) -> Result<bool, String> {
        let c = self
            .chickens
            .iter_mut()
            .find(|c| c.id == id)
            .ok_or("unknown chicken")?;
        if c.click_cooldown > 0 {
            return Ok(false);
        }
        c.activity = Activity::Hop;
        c.remaining = 14;
        c.path.clear();
        c.click_cooldown = 100;
        c.reaction_cooldown = 160;
        c.sound_seq = c.sound_seq.wrapping_add(1);
        Ok(true)
    }
    pub fn collect(&mut self, id: u32) -> Result<u32, String> {
        let i = self
            .baskets
            .iter()
            .position(|b| *b == id)
            .ok_or("egg basket already collected or missing")?;
        self.baskets.remove(i);
        Ok(EGG_FOOD)
    }
    pub fn tick(&mut self, g: &Ground<'_>, minute: u32, date: u32, walkers: &[(f32, f32)]) {
        if minute >= 360 && date != self.last_morning {
            self.last_morning = date;
            if self.baskets.len() < 3 {
                self.baskets.push(self.next_basket);
                self.next_basket = self.next_basket.saturating_add(1);
            }
        }
        let night = minute >= 1080 || (minute < 360 && self.settling == 0);
        self.settling = self.settling.saturating_sub(1);
        let free = local_free(g, self.home);
        let friends: Vec<_> = self.chickens.iter().map(|c| g.tile(c.pos)).collect();
        for (i, c) in self.chickens.iter_mut().enumerate() {
            c.click_cooldown = c.click_cooldown.saturating_sub(1);
            c.reaction_cooldown = c.reaction_cooldown.saturating_sub(1);
            let mut tile = g.tile(c.pos);
            if !g.free(tile.0, tile.1) {
                if let Some(t) = free.iter().min_by_key(|t| distance(**t, tile)) {
                    c.pos = g.center(*t);
                    tile = *t;
                }
                c.path.clear();
                c.remaining = 0;
            }
            if free.is_empty() {
                c.activity = Activity::Resting;
                continue;
            }
            if c.path.first().is_some_and(|t| {
                !g.free(t.0, t.1)
                    || (t.0 != tile.0
                        && t.1 != tile.1
                        && (!g.free(t.0, tile.1) || !g.free(tile.0, t.1)))
            }) {
                c.path.clear();
                c.remaining = 0;
            }
            let path_to = |goal| {
                find_path(tile, goal, g.width as i32, g.height as i32, &|x, y| {
                    g.free(x, y) && distance((x, y), self.home) <= 5
                })
            };
            if night {
                if c.activity == Activity::Hop && c.remaining > 0 {
                    c.remaining -= 1;
                    continue;
                }
                if c.activity == Activity::Sleeping && distance(tile, self.home) <= 1 {
                    continue;
                }
                if c.activity != Activity::Returning && c.activity != Activity::Sleeping {
                    c.path.clear();
                    c.remaining = 0;
                }
                if c.path.is_empty() {
                    let roost = free.iter().find_map(|t| path_to(*t).map(|p| (*t, p)));
                    if let Some((t, p)) = roost {
                        if tile == t {
                            c.activity = Activity::Sleeping;
                            c.remaining = 0;
                            continue;
                        }
                        c.path = p;
                    }
                }
                c.activity = Activity::Returning;
            } else {
                if matches!(c.activity, Activity::Sleeping | Activity::Returning) {
                    c.remaining = 0;
                    c.path.clear();
                }
                if c.reaction_cooldown == 0
                    && walkers
                        .iter()
                        .any(|p| (p.0 - c.pos.0).hypot(p.1 - c.pos.1) < g.tile_size as f32 * 1.3)
                {
                    c.path.clear();
                    c.remaining = 24;
                    c.reaction_cooldown = 160;
                    c.activity = if random(c) % 2 == 0 {
                        Activity::Tilt
                    } else {
                        Activity::Scurry
                    };
                    if c.activity == Activity::Scurry {
                        let away =
                            free.iter()
                                .filter(|t| distance(**t, tile) <= 2)
                                .max_by(|a, b| {
                                    let score = |t| {
                                        let p = g.center(t);
                                        walkers
                                            .iter()
                                            .map(|w| (p.0 - w.0).hypot(p.1 - w.1))
                                            .fold(f32::INFINITY, f32::min)
                                    };
                                    score(**a).total_cmp(&score(**b))
                                });
                        if let Some(t) = away {
                            c.path = path_to(*t).unwrap_or_default();
                        }
                    }
                }
                if c.remaining == 0 && c.path.is_empty() {
                    let r = random(c);
                    c.remaining = 40 + r % 80;
                    match r % 6 {
                        0 => {
                            c.activity = Activity::Resting;
                            if c.tendency == Tendency::Sleepy {
                                c.remaining += 100;
                            }
                        }
                        1 => c.activity = Activity::Pecking,
                        2 => c.activity = Activity::Scratching,
                        _ => {
                            let radius = if c.tendency == Tendency::Curious {
                                5
                            } else if c.tendency == Tendency::Social {
                                2
                            } else {
                                3
                            };
                            let candidates: Vec<_> = free
                                .iter()
                                .copied()
                                .filter(|t| distance(*t, self.home) <= radius)
                                .collect();
                            let follow = r % 6 == 3 || c.tendency == Tendency::Social;
                            let goal = if follow {
                                friends[(i + 1) % friends.len()]
                            } else if candidates.is_empty() {
                                tile
                            } else {
                                candidates[(random(c) as usize) % candidates.len()]
                            };
                            c.path = path_to(goal).unwrap_or_default();
                            c.activity = if follow {
                                Activity::Following
                            } else {
                                Activity::Walking
                            };
                        }
                    }
                    if r % 13 == 0 {
                        c.sound_seq = c.sound_seq.wrapping_add(1);
                    }
                }
            }
            if let Some(next) = c.path.first().copied() {
                let target = g.center(next);
                let dx = target.0 - c.pos.0;
                let dy = target.1 - c.pos.1;
                let d = dx.hypot(dy);
                let step = g.tile_size as f32
                    * if c.activity == Activity::Scurry {
                        0.09
                    } else {
                        0.035
                    };
                if dx.abs() > 0.01 {
                    c.facing_left = dx < 0.0;
                }
                if d <= step {
                    c.pos = target;
                    c.path.remove(0);
                } else {
                    c.pos.0 += dx / d * step;
                    c.pos.1 += dy / d * step;
                }
            } else {
                c.remaining = c.remaining.saturating_sub(1);
                if c.remaining == 0
                    && matches!(
                        c.activity,
                        Activity::Walking | Activity::Following | Activity::Scurry
                    )
                {
                    c.activity = Activity::Pecking;
                    c.remaining = 30;
                }
            }
        }
    }
    pub fn views(&self) -> Vec<ChickenView> {
        self.chickens
            .iter()
            .map(|c| ChickenView {
                id: c.id,
                shelter_id: self.shelter_id,
                name: c.name.clone(),
                tendency: match c.tendency {
                    Tendency::Curious => "curious",
                    Tendency::Sleepy => "sleepy",
                    Tendency::Social => "social",
                },
                x: c.pos.0,
                y: c.pos.1,
                pose: c.activity.pose(),
                activity: c.activity.label(),
                sound_seq: c.sound_seq,
                facing_left: c.facing_left,
            })
            .collect()
    }
    pub fn basket_views(&self, tile_size: u32) -> Vec<EggBasketView> {
        self.baskets
            .iter()
            .enumerate()
            .map(|(i, id)| EggBasketView {
                id: *id,
                shelter_id: self.shelter_id,
                x: (self.home.0 as f32 + 0.2 + i as f32 * 0.3) * tile_size as f32,
                y: (self.home.1 as f32 + 0.85) * tile_size as f32,
            })
            .collect()
    }
    pub fn validate(&self, g: &Ground<'_>) -> Result<(), String> {
        if self.chickens.len() != 3
            || self.baskets.len() > 3
            || self.next_basket == 0
            || self.settling > 1200
        {
            return Err("save contains invalid flock".into());
        }
        let mut ids = std::collections::BTreeSet::new();
        for c in &self.chickens {
            if !(1..=3).contains(&c.id)
                || !ids.insert(c.id)
                || c.rng == 0
                || c.name.is_empty()
                || !c.pos.0.is_finite()
                || !c.pos.1.is_finite()
                || c.pos.0 < 0.0
                || c.pos.1 < 0.0
                || c.pos.0 >= g.width as f32 * g.tile_size as f32
                || c.pos.1 >= g.height as f32 * g.tile_size as f32
                || distance(g.tile(c.pos), self.home) > 5
                || c.path.iter().any(|t| {
                    distance(*t, self.home) > 5
                        || t.0 < 0
                        || t.1 < 0
                        || t.0 >= g.width as i32
                        || t.1 >= g.height as i32
                })
            {
                return Err("save contains invalid chicken".into());
            }
        }
        ids.clear();
        for b in &self.baskets {
            if *b == 0 || *b >= self.next_basket || !ids.insert(*b) {
                return Err("save contains invalid baskets".into());
            }
        }
        Ok(())
    }
}

pub fn has_exit(g: &Ground<'_>, home: (i32, i32)) -> bool {
    DELTAS.iter().any(|d| g.free(home.0 + d.0, home.1 + d.1))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sim::world::World;
    fn world() -> World {
        let mut w = World::generate(20, 20, 32, 42);
        w.tiles = vec![Terrain::Grass as u8; 400];
        w.occupancy = vec![None; 400];
        w.villagers.clear();
        w.nodes.clear();
        w.place_building("chicken_shelter", 10, 10, 0).unwrap();
        w
    }
    fn set_time(w: &mut World, minute: u32) {
        let mut clock = serde_json::to_value(&w.clock).unwrap();
        clock["minute"] = minute.into();
        clock["minute_accum"] = minute.into();
        w.clock = serde_json::from_value(clock).unwrap();
    }
    fn daytime(w: &mut World) {
        set_time(w, 480);
    }
    #[test]
    fn flock_is_optional_unique_and_can_be_removed_and_replaced() {
        let mut w = world();
        assert_eq!(w.flock.as_ref().unwrap().chickens.len(), 3);
        assert!(!w.validate_placement("chicken_shelter", 5, 5, 0).valid);
        let id = w.flock.as_ref().unwrap().shelter_id;
        w.demolish(id).unwrap();
        assert!(w.flock.is_none());
        w.place_building("chicken_shelter", 5, 5, 0).unwrap();
        assert!(w.click_chicken(id, 1).is_err());
    }
    #[test]
    fn changes_behavior_in_first_minute_stays_near_home_and_avoids_obstacles() {
        let mut w = world();
        // Includes a water moat segment and a building barrier.
        for y in 7..14 {
            w.tiles[y * 20 + 12] = Terrain::ShallowWater as u8;
        }
        w.place_building("hut", 8, 9, 0).unwrap();
        let mut poses = std::collections::BTreeSet::new();
        for _ in 0..1200 {
            w.advance();
            let f = w.flock.as_ref().unwrap();
            for c in &f.chickens {
                let t = w.chicken_ground().tile(c.pos);
                assert!(w.chicken_ground().free(t.0, t.1));
                assert!(distance(t, f.home) <= 5);
                poses.insert(c.activity.pose());
            }
        }
        assert!(poses.contains("walk"));
        assert!(poses.contains("peck"));
        assert!(poses.contains("scratch"));
    }
    #[test]
    fn returns_at_dusk_and_wakes_at_dawn() {
        let mut w = world();
        daytime(&mut w);
        for _ in 0..1000 {
            w.advance();
        }
        set_time(&mut w, 1080);
        for _ in 0..700 {
            w.advance();
        }
        let f = w.flock.as_ref().unwrap();
        for c in &f.chickens {
            assert_eq!(c.activity, Activity::Sleeping);
            assert!(distance(w.chicken_ground().tile(c.pos), f.home) <= 1);
        }
        w.clock.day += 1;
        set_time(&mut w, 360);
        w.advance();
        assert!(
            w.flock
                .as_ref()
                .unwrap()
                .chickens
                .iter()
                .all(|c| c.activity != Activity::Sleeping)
        );
    }
    #[test]
    fn first_dawn_produces_once_and_sleeping_clicks_briefly_hop() {
        let mut w = world();
        set_time(&mut w, 359);
        w.advance();
        assert!(w.flock.as_ref().unwrap().baskets.is_empty());
        set_time(&mut w, 360);
        w.advance();
        assert_eq!(w.flock.as_ref().unwrap().baskets.len(), 1);
        w.advance();
        assert_eq!(w.flock.as_ref().unwrap().baskets.len(), 1);
        set_time(&mut w, 1080);
        for _ in 0..700 {
            w.advance();
        }
        let id = w.flock.as_ref().unwrap().shelter_id;
        assert!(w.click_chicken(id, 1).unwrap());
        for _ in 0..10 {
            w.advance();
        }
        assert_eq!(
            w.flock.as_ref().unwrap().chickens[0].activity,
            Activity::Hop
        );
        for _ in 0..10 {
            w.advance();
        }
        assert_eq!(
            w.flock.as_ref().unwrap().chickens[0].activity,
            Activity::Sleeping
        );
    }

    #[test]
    fn baskets_cap_and_each_grants_food_exactly_once() {
        let mut w = world();
        daytime(&mut w);
        for _ in 0..10 {
            w.clock.day += 1;
            w.advance();
        }
        let f = w.flock.as_ref().unwrap();
        assert_eq!(f.baskets.len(), 3);
        let id = f.baskets[0];
        let shelter = f.shelter_id;
        let food = w.resources.food;
        assert_eq!(w.collect_eggs(shelter, id).unwrap(), 3);
        assert_eq!(w.resources.food, food + 3);
        assert!(w.collect_eggs(shelter, id).is_err());
        assert_eq!(w.resources.food, food + 3);
        w.advance();
        assert_eq!(w.flock.as_ref().unwrap().baskets.len(), 2);
        w.clock.day += 1;
        w.advance();
        assert_eq!(w.flock.as_ref().unwrap().baskets.len(), 3);
    }
    #[test]
    fn click_and_villager_reactions_have_cooldowns() {
        let mut w = world();
        daytime(&mut w);
        let id = w.flock.as_ref().unwrap().shelter_id;
        assert!(w.click_chicken(id, 1).unwrap());
        assert!(!w.click_chicken(id, 1).unwrap());
        for _ in 0..100 {
            w.advance();
        }
        assert!(w.click_chicken(id, 1).unwrap());
        let mut f = w.flock.take().unwrap();
        f.chickens[1].reaction_cooldown = 0;
        let p = f.chickens[1].pos;
        f.tick(&w.chicken_ground(), 480, 200, &[p]);
        assert!(matches!(
            f.chickens[1].activity,
            Activity::Tilt | Activity::Scurry
        ));
        assert!(f.chickens[1].reaction_cooldown > 0);
    }
    #[test]
    fn building_over_chicken_relocates_without_blocking_construction() {
        let mut w = world();
        let p = w.flock.as_ref().unwrap().chickens[0].pos;
        let t = w.chicken_ground().tile(p);
        w.place_building("hut", t.0, t.1, 0).unwrap();
        for c in &w.flock.as_ref().unwrap().chickens {
            let t = w.chicken_ground().tile(c.pos);
            assert!(w.chicken_ground().free(t.0, t.1));
        }
    }
    #[test]
    fn saves_preserve_names_positions_baskets_and_deterministic_continuation() {
        let mut w = world();
        daytime(&mut w);
        for _ in 0..173 {
            w.advance();
        }
        w.clock.day += 1;
        w.advance();
        let bytes = crate::persist::encode_world(&w).unwrap();
        let mut loaded = crate::persist::decode_world(&bytes).unwrap();
        assert_eq!(w.flock, loaded.flock);
        assert_eq!(bytes, crate::persist::encode_world(&loaded).unwrap());
        for _ in 0..600 {
            w.advance();
            loaded.advance();
        }
        assert_eq!(w.flock, loaded.flock);
        assert_eq!(
            crate::persist::encode_world(&w).unwrap(),
            crate::persist::encode_world(&loaded).unwrap()
        );
    }
}
