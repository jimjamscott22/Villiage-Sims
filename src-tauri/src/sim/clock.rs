//! In-game calendar and simulation speed (Milestone 6).

use serde::Serialize;

/// In-game minutes added per logic tick at any speed.
/// 1440 minutes / (20 real min × 60 s × 20 Hz) = 0.06.
pub const MINUTES_PER_TICK: f32 = 0.06;
pub const MINUTES_PER_DAY: f32 = 1440.0;
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

    #[allow(dead_code)]
    pub fn name(self) -> &'static str {
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
            "autumn" => Some(Self::Autumn),
            "winter" => Some(Self::Winter),
            _ => None,
        }
    }

    pub fn next(self) -> (Self, bool) {
        match self {
            Self::Spring => (Self::Summer, false),
            Self::Summer => (Self::Autumn, false),
            Self::Autumn => (Self::Winter, false),
            Self::Winter => (Self::Spring, true),
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

    /// Base tick interval scaled by speed (Paused keeps the 1× poll cadence).
    pub fn tick_interval(self, base: std::time::Duration) -> std::time::Duration {
        match self {
            Self::Paused | Self::X1 => base,
            Self::X2 => base / 2,
            Self::X3 => base / 3,
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
    /// Fractional in-game minutes accumulated within the current day.
    minute_accum: f32,
    pub minute: u32,
    pub day: u32,
    pub season: Season,
    pub year: u32,
    pub speed: Speed,
}

impl Clock {
    pub fn new() -> Self {
        Self {
            tick: 0,
            minute_accum: 0.0,
            minute: 0,
            day: 1,
            season: Season::Spring,
            year: 1,
            speed: Speed::X1,
        }
    }

    pub fn view(&self) -> ClockView {
        ClockView {
            minute: self.minute,
            day: self.day,
            season: self.season.as_u8(),
            year: self.year,
            speed: self.speed.as_u8(),
        }
    }

    pub fn set_speed(&mut self, speed: u8) -> Result<(), String> {
        self.speed = Speed::from_u8(speed).ok_or_else(|| format!("invalid speed {speed}"))?;
        Ok(())
    }

    pub fn set_season(&mut self, season: u8) -> Result<(), String> {
        self.season = Season::from_u8(season).ok_or_else(|| format!("invalid season {season}"))?;
        Ok(())
    }

    /// Advance one logic tick. Returns `true` when a day boundary is crossed.
    pub fn advance_tick(&mut self) -> bool {
        self.tick = self.tick.saturating_add(1);
        self.minute_accum += MINUTES_PER_TICK;
        self.minute = self.minute_accum.floor() as u32;
        if self.minute_accum < MINUTES_PER_DAY {
            return false;
        }
        self.minute_accum -= MINUTES_PER_DAY;
        self.minute = self.minute_accum.floor() as u32;
        self.roll_day();
        true
    }

    /// Jump forward one calendar day (debug / tests), resetting the minute clock.
    pub fn force_day_rollover(&mut self) {
        self.minute_accum = 0.0;
        self.minute = 0;
        self.roll_day();
    }

    fn roll_day(&mut self) {
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
    fn day_season_year_rollover() {
        let mut clock = Clock::new();
        clock.day = 28;
        clock.season = Season::Winter;
        clock.year = 1;
        clock.force_day_rollover();
        assert_eq!(clock.day, 1);
        assert_eq!(clock.season, Season::Spring);
        assert_eq!(clock.year, 2);
    }

    #[test]
    fn minute_accumulates_to_day() {
        let mut clock = Clock::new();
        let ticks_per_day = (MINUTES_PER_DAY / MINUTES_PER_TICK).round() as u32;
        let mut rolled = false;
        for _ in 0..ticks_per_day {
            if clock.advance_tick() {
                rolled = true;
            }
        }
        assert!(rolled);
        assert_eq!(clock.day, 2);
        assert_eq!(clock.season, Season::Spring);
    }

    #[test]
    fn speed_scales_interval() {
        let base = std::time::Duration::from_millis(50);
        assert_eq!(Speed::X1.tick_interval(base), base);
        assert_eq!(Speed::X2.tick_interval(base), base / 2);
        assert_eq!(Speed::X3.tick_interval(base), base / 3);
        assert_eq!(Speed::Paused.tick_interval(base), base);
    }
}
