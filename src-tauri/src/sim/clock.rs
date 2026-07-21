use serde::Serialize;

/// In-game minutes advanced per sim tick, as centi-minutes (0.01 min).
/// 0.06 min/tick → 6 centi-minutes.
pub const CENTI_MINUTES_PER_TICK: u32 = 6;
pub const CENTI_MINUTES_PER_DAY: u32 = 1440 * 100;
pub const DAYS_PER_SEASON: u32 = 28;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
#[repr(u8)]
pub enum Season {
    Spring = 0,
    Summer = 1,
    Autumn = 2,
    Winter = 3,
}

impl Season {
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(Self::Spring),
            1 => Some(Self::Summer),
            2 => Some(Self::Autumn),
            3 => Some(Self::Winter),
            _ => None,
        }
    }

    pub fn as_u8(self) -> u8 {
        self as u8
    }

    pub fn next(self) -> (Self, bool) {
        match self {
            Self::Spring => (Self::Summer, false),
            Self::Summer => (Self::Autumn, false),
            Self::Autumn => (Self::Winter, false),
            Self::Winter => (Self::Spring, true),
        }
    }

    #[allow(dead_code)]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Spring => "spring",
            Self::Summer => "summer",
            Self::Autumn => "autumn",
            Self::Winter => "winter",
        }
    }

    pub fn from_name(name: &str) -> Option<Self> {
        match name {
            "spring" => Some(Self::Spring),
            "summer" => Some(Self::Summer),
            "autumn" | "fall" => Some(Self::Autumn),
            "winter" => Some(Self::Winter),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
#[repr(u8)]
pub enum Speed {
    Paused = 0,
    X1 = 1,
    X2 = 2,
    X3 = 3,
}

impl Speed {
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(Self::Paused),
            1 => Some(Self::X1),
            2 => Some(Self::X2),
            3 => Some(Self::X3),
            _ => None,
        }
    }

    pub fn as_u8(self) -> u8 {
        self as u8
    }

    pub fn is_paused(self) -> bool {
        matches!(self, Self::Paused)
    }

    /// Real-time sleep between sim loop iterations. Paused keeps a 50ms poll.
    pub fn tick_interval_ms(self) -> u64 {
        match self {
            Self::Paused | Self::X1 => 50,
            Self::X2 => 25,
            Self::X3 => 50 / 3, // 16ms
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClockView {
    pub minute: u32,
    pub day: u32,
    pub season: u8,
    pub year: u32,
    pub speed: u8,
}

#[derive(Clone, Debug)]
pub struct Clock {
    pub tick: u64,
    /// Fractional day progress in centi-minutes (0.01 in-game minute).
    centi_minutes: u32,
    pub day: u32,
    pub season: Season,
    pub year: u32,
    pub speed: Speed,
}

impl Clock {
    pub fn new() -> Self {
        Self {
            tick: 0,
            centi_minutes: 0,
            day: 1,
            season: Season::Spring,
            year: 1,
            speed: Speed::X1,
        }
    }

    pub fn minute(&self) -> u32 {
        self.centi_minutes / 100
    }

    pub fn view(&self) -> ClockView {
        ClockView {
            minute: self.minute(),
            day: self.day,
            season: self.season.as_u8(),
            year: self.year,
            speed: self.speed.as_u8(),
        }
    }

    pub fn set_speed(&mut self, speed: Speed) {
        self.speed = speed;
    }

    pub fn set_season(&mut self, season: Season) {
        self.season = season;
    }

    /// Advance one sim tick of calendar time. Returns true if a day rolled over.
    pub fn advance_tick(&mut self) -> bool {
        self.tick = self.tick.saturating_add(1);
        self.centi_minutes += CENTI_MINUTES_PER_TICK;
        self.drain_day_rollovers()
    }

    /// Jump forward `days` calendar days (each triggers a day rollover).
    /// Returns how many day rollovers occurred (`days`).
    pub fn advance_days(&mut self, days: u32) -> u32 {
        for _ in 0..days {
            self.day += 1;
            if self.day > DAYS_PER_SEASON {
                self.day = 1;
                let (next, new_year) = self.season.next();
                self.season = next;
                if new_year {
                    self.year = self.year.saturating_add(1);
                }
            }
        }
        // Snap to start-of-day after a jump so demos are predictable.
        self.centi_minutes = 0;
        days
    }

    fn drain_day_rollovers(&mut self) -> bool {
        let mut rolled = false;
        while self.centi_minutes >= CENTI_MINUTES_PER_DAY {
            self.centi_minutes -= CENTI_MINUTES_PER_DAY;
            self.day += 1;
            rolled = true;
            if self.day > DAYS_PER_SEASON {
                self.day = 1;
                let (next, new_year) = self.season.next();
                self.season = next;
                if new_year {
                    self.year = self.year.saturating_add(1);
                }
            }
        }
        rolled
    }
}

impl Default for Clock {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn starts_at_spring_day_one_year_one() {
        let clock = Clock::new();
        assert_eq!(clock.day, 1);
        assert_eq!(clock.season, Season::Spring);
        assert_eq!(clock.year, 1);
        assert_eq!(clock.speed, Speed::X1);
        assert_eq!(clock.minute(), 0);
    }

    #[test]
    fn day_rolls_after_enough_ticks() {
        let mut clock = Clock::new();
        // 1440 / 0.06 = 24_000 ticks per day (integer centi-minutes).
        let mut rolled = false;
        for _ in 0..24_000 {
            if clock.advance_tick() {
                rolled = true;
            }
        }
        assert!(rolled);
        assert_eq!(clock.day, 2);
        assert_eq!(clock.season, Season::Spring);
        assert_eq!(clock.centi_minutes, 0);
    }

    #[test]
    fn season_and_year_roll_via_advance_days() {
        let mut clock = Clock::new();
        clock.advance_days(28);
        assert_eq!(clock.day, 1);
        assert_eq!(clock.season, Season::Summer);
        assert_eq!(clock.year, 1);

        clock.advance_days(28 * 3); // summer→autumn→winter→spring
        assert_eq!(clock.season, Season::Spring);
        assert_eq!(clock.year, 2);
    }

    #[test]
    fn speed_from_u8_rejects_invalid() {
        assert_eq!(Speed::from_u8(3), Some(Speed::X3));
        assert!(Speed::from_u8(4).is_none());
    }

    #[test]
    fn tick_interval_scales_with_speed() {
        assert_eq!(Speed::X1.tick_interval_ms(), 50);
        assert_eq!(Speed::X2.tick_interval_ms(), 25);
        assert_eq!(Speed::X3.tick_interval_ms(), 16);
        assert_eq!(Speed::Paused.tick_interval_ms(), 50);
    }
}
