/// Villager needs with per-tick decay (Milestone 5).

/// Decay rates per 20 Hz tick (from villagesim-spec).
pub const HUNGER_DECAY: f32 = 0.00008;
pub const ENERGY_DECAY: f32 = 0.00005;
pub const SOCIAL_DECAY: f32 = 0.00003;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Needs {
    /// 0.0 = starving, 1.0 = full
    pub hunger: f32,
    pub energy: f32,
    pub social: f32,
    /// Derived each tick; not decayed directly.
    pub happiness: f32,
}

impl Needs {
    pub fn full() -> Self {
        let mut needs = Self {
            hunger: 1.0,
            energy: 1.0,
            social: 1.0,
            happiness: 1.0,
        };
        needs.recompute_happiness();
        needs
    }

    pub fn tick_decay(&mut self) {
        self.hunger = (self.hunger - HUNGER_DECAY).clamp(0.0, 1.0);
        self.energy = (self.energy - ENERGY_DECAY).clamp(0.0, 1.0);
        self.social = (self.social - SOCIAL_DECAY).clamp(0.0, 1.0);
        self.recompute_happiness();
    }

    fn recompute_happiness(&mut self) {
        // Equal weights for M5; housing/social modifiers land in later milestones.
        self.happiness = ((self.hunger + self.energy + self.social) / 3.0).clamp(0.0, 1.0);
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
        assert!((needs.happiness - (needs.hunger + needs.energy + needs.social) / 3.0).abs() < 1e-5);
    }

    #[test]
    fn decay_clamps_at_zero() {
        let mut needs = Needs {
            hunger: 0.00001,
            energy: 0.0,
            social: 0.0,
            happiness: 0.0,
        };
        needs.tick_decay();
        assert_eq!(needs.hunger, 0.0);
        assert_eq!(needs.happiness, 0.0);
    }
}
