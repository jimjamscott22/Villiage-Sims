//! Daily weather rolls (Milestone 10).
//!
//! Weather is derived deterministically from `(seed, year, season, day)` so it
//! never needs to be stored in the save. Day-rollover applies Rain watering and
//! Storm building damage as one-shot world mutations; after that, crop/building
//! state carries the effects through save/load.

use super::clock::{Clock, Season};

/// 0 Clear, 1 Rain, 2 Storm.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u8)]
pub enum Weather {
    Clear = 0,
    Rain = 1,
    Storm = 2,
}

impl Weather {
    #[allow(dead_code)]
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(Self::Clear),
            1 => Some(Self::Rain),
            2 => Some(Self::Storm),
            _ => None,
        }
    }

    pub fn as_u8(self) -> u8 {
        self as u8
    }

    #[allow(dead_code)]
    pub fn name(self) -> &'static str {
        match self {
            Self::Clear => "Clear",
            Self::Rain => "Rain",
            Self::Storm => "Storm",
        }
    }

    /// Rain and Storm both soak outdoor crops for the day.
    pub fn waters_crops(self) -> bool {
        matches!(self, Self::Rain | Self::Storm)
    }

    pub fn damages_buildings(self) -> bool {
        matches!(self, Self::Storm)
    }
}

/// Deterministic daily weather from the world seed and calendar date.
///
/// Distribution: ~60% Clear, ~30% Rain, ~10% Storm.
pub fn weather_for(seed: u64, year: u32, season: Season, day: u32) -> Weather {
    let hash = mix(
        seed,
        u64::from(year),
        u64::from(season.as_u8()),
        u64::from(day),
    );
    match hash % 10 {
        0..=5 => Weather::Clear,
        6..=8 => Weather::Rain,
        _ => Weather::Storm,
    }
}

pub fn weather_for_clock(seed: u64, clock: &Clock) -> Weather {
    weather_for(seed, clock.year, clock.season, clock.day)
}

/// Rotating autosave slot (1..=3) for the current calendar day.
pub fn autosave_slot_for(clock: &Clock) -> u8 {
    let season = u64::from(clock.season.as_u8());
    let abs = u64::from(clock.year.saturating_sub(1))
        .saturating_mul(112)
        .saturating_add(season.saturating_mul(28))
        .saturating_add(u64::from(clock.day.saturating_sub(1)));
    (abs % 3) as u8 + 1
}

fn mix(a: u64, b: u64, c: u64, d: u64) -> u64 {
    let mut hash = a
        .wrapping_mul(0x9E37_79B9_7F4A_7C15)
        .wrapping_add(b)
        .wrapping_mul(0xBF58_476D_1CE4_E5B9)
        .wrapping_add(c)
        .wrapping_mul(0x94D0_49BB_1331_11EB)
        .wrapping_add(d);
    hash ^= hash >> 33;
    hash = hash.wrapping_mul(0xFF51_AFD7_ED55_8CCD);
    hash ^= hash >> 33;
    hash
}

/// Pick a building index to damage under a storm, or `None` if there are no
/// eligible buildings. Uses a separate hash stream so weather kind and damage
/// target are independent.
pub fn storm_damage_index(
    seed: u64,
    year: u32,
    season: Season,
    day: u32,
    building_count: usize,
) -> Option<usize> {
    if building_count == 0 {
        return None;
    }
    let hash = mix(
        seed ^ 0xA5A5_A5A5_A5A5_A5A5,
        u64::from(year),
        u64::from(season.as_u8()),
        u64::from(day),
    );
    Some((hash as usize) % building_count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn weather_is_deterministic() {
        let a = weather_for(42, 1, Season::Spring, 7);
        let b = weather_for(42, 1, Season::Spring, 7);
        assert_eq!(a, b);
    }

    #[test]
    fn weather_varies_across_days() {
        let kinds: Vec<_> = (1..=28)
            .map(|day| weather_for(42, 1, Season::Spring, day))
            .collect();
        assert!(
            kinds.iter().any(|w| *w != kinds[0]),
            "expected more than one weather kind across a season"
        );
    }

    #[test]
    fn distribution_covers_all_kinds() {
        let mut seen = [false; 3];
        for day in 1..=28 {
            for season in [
                Season::Spring,
                Season::Summer,
                Season::Autumn,
                Season::Winter,
            ] {
                for year in 1..=3 {
                    let w = weather_for(99, year, season, day);
                    seen[w.as_u8() as usize] = true;
                }
            }
        }
        assert!(
            seen[0] && seen[1] && seen[2],
            "expected Clear, Rain, and Storm"
        );
    }

    #[test]
    fn autosave_slots_rotate() {
        let mut clock = Clock::new();
        assert_eq!(autosave_slot_for(&clock), 1);
        clock.day = 2;
        assert_eq!(autosave_slot_for(&clock), 2);
        clock.day = 3;
        assert_eq!(autosave_slot_for(&clock), 3);
        clock.day = 4;
        assert_eq!(autosave_slot_for(&clock), 1);
    }

    #[test]
    fn storm_index_none_when_empty() {
        assert_eq!(storm_damage_index(1, 1, Season::Spring, 1, 0), None);
    }

    #[test]
    fn storm_index_in_range() {
        let idx = storm_damage_index(7, 2, Season::Autumn, 11, 5).expect("index");
        assert!(idx < 5);
    }
}
