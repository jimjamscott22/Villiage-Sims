/// Villager needs with per-tick decay (Milestone 5).
use serde::{Deserialize, Serialize};

/// Decay rates per 20 Hz tick (from villagesim-spec).
pub const HUNGER_DECAY: f32 = 0.00008;
pub const ENERGY_DECAY: f32 = 0.00005;
pub const SOCIAL_DECAY: f32 = 0.00003;
/// Thirst drains ~1.5x faster than hunger: water matters sooner than food.
pub const THIRST_DECAY: f32 = 0.00012;
/// Health lost per tick for each survival need (hunger, thirst) sitting at zero.
/// 300 ticks (15 s) from full health matches the pre-health starvation rule.
pub const HEALTH_DAMAGE: f32 = 1.0 / 300.0;
/// Health regained per tick while fed and watered (~5 minutes from empty to full).
pub const HEALTH_REGEN: f32 = 1.0 / 6000.0;
/// Hunger and thirst must both be at least this for health to regenerate.
pub const HEALTH_REGEN_THRESHOLD: f32 = 0.25;

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct Needs {
    /// 0.0 = starving, 1.0 = full
    pub hunger: f32,
    pub energy: f32,
    pub social: f32,
    /// 0.0 = parched, 1.0 = quenched.
    pub thirst: f32,
    /// 0.0 = dead. Not decayed directly: falls while hunger or thirst is empty.
    pub health: f32,
    /// Derived each tick; not decayed directly.
    pub happiness: f32,
}

impl Needs {
    pub fn full() -> Self {
        let mut needs = Self {
            hunger: 1.0,
            energy: 1.0,
            social: 1.0,
            thirst: 1.0,
            health: 1.0,
            happiness: 1.0,
        };
        needs.recompute_happiness();
        needs
    }

    pub fn tick_decay(&mut self) {
        self.hunger = (self.hunger - HUNGER_DECAY).clamp(0.0, 1.0);
        self.energy = (self.energy - ENERGY_DECAY).clamp(0.0, 1.0);
        self.social = (self.social - SOCIAL_DECAY).clamp(0.0, 1.0);
        self.thirst = (self.thirst - THIRST_DECAY).clamp(0.0, 1.0);
        self.recompute_happiness();
    }

    pub(crate) fn recompute_happiness(&mut self) {
        // Equal weights across the decaying needs; health is tracked separately.
        self.happiness =
            ((self.hunger + self.energy + self.social + self.thirst) / 4.0).clamp(0.0, 1.0);
    }

    /// Apply one tick of health change. `starving`/`parched` say which survival
    /// needs are currently causing harm (callers exempt an in-progress meal/drink).
    /// Returns true when health has run out.
    pub fn tick_health(&mut self, starving: bool, parched: bool) -> bool {
        let harms = u8::from(starving) + u8::from(parched);
        if harms > 0 {
            self.health = (self.health - HEALTH_DAMAGE * f32::from(harms)).max(0.0);
        } else if self.hunger >= HEALTH_REGEN_THRESHOLD && self.thirst >= HEALTH_REGEN_THRESHOLD {
            self.health = (self.health + HEALTH_REGEN).min(1.0);
        }
        self.health <= 0.0
    }

    pub fn set_hunger(&mut self, value: f32) {
        self.hunger = value.clamp(0.0, 1.0);
        self.recompute_happiness();
    }

    pub fn set_energy(&mut self, value: f32) {
        self.energy = value.clamp(0.0, 1.0);
        self.recompute_happiness();
    }

    pub fn set_thirst(&mut self, value: f32) {
        self.thirst = value.clamp(0.0, 1.0);
        self.recompute_happiness();
    }

    pub fn set_health(&mut self, value: f32) {
        self.health = value.clamp(0.0, 1.0);
    }

    pub fn add_social(&mut self, amount: f32) {
        self.social = (self.social + amount).clamp(0.0, 1.0);
        self.recompute_happiness();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decay_reduces_hunger_over_ticks() {
        let mut needs = Needs::full();
        for _ in 0..1000 {
            needs.tick_decay();
        }
        assert!(needs.hunger < 1.0 - 0.05);
        assert!(needs.hunger > 0.0);
        assert!(
            needs.thirst < needs.hunger,
            "thirst drains faster than hunger"
        );
        assert!(
            (needs.happiness - (needs.hunger + needs.energy + needs.social + needs.thirst) / 4.0)
                .abs()
                < 1e-5
        );
    }

    #[test]
    fn health_falls_per_empty_need_and_regenerates_when_fed() {
        let mut needs = Needs::full();
        needs.set_hunger(0.0);
        needs.tick_health(true, false);
        assert!((needs.health - (1.0 - HEALTH_DAMAGE)).abs() < 1e-6);
        needs.tick_health(true, true);
        assert!((needs.health - (1.0 - 3.0 * HEALTH_DAMAGE)).abs() < 1e-6);

        needs.set_hunger(1.0);
        let before = needs.health;
        needs.tick_health(false, false);
        assert!(needs.health > before);

        // Neither harm nor recovery while a need is low but not empty.
        needs.set_thirst(0.1);
        let before = needs.health;
        needs.tick_health(false, false);
        assert_eq!(needs.health, before);
    }

    #[test]
    fn starving_from_full_health_is_fatal_after_about_300_ticks() {
        let mut needs = Needs::full();
        let mut ticks = 0;
        while !needs.tick_health(true, false) {
            ticks += 1;
            assert!(ticks < 400, "health never ran out");
        }
        assert!((298..=301).contains(&ticks), "died after {ticks} ticks");
    }

    #[test]
    fn decay_clamps_at_zero() {
        let mut needs = Needs {
            hunger: 0.00001,
            energy: 0.0,
            social: 0.0,
            thirst: 0.0,
            health: 1.0,
            happiness: 0.0,
        };
        needs.tick_decay();
        assert_eq!(needs.hunger, 0.0);
        assert_eq!(needs.happiness, 0.0);
    }
}
