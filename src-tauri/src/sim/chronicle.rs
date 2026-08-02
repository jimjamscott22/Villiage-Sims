//! Village chronicle: a capped ring buffer of player-facing milestones (Milestone 10).

use std::collections::VecDeque;

use serde::{Deserialize, Serialize};

use super::clock::Clock;

/// Maximum entries retained. Oldest are evicted first.
pub const CHRONICLE_CAP: usize = 200;

/// What happened. Tagged `kind` on the wire, so no variant may carry a `kind` field.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ChronicleBody {
    VillagerBorn {
        id: u32,
        name: String,
    },
    VillagerDied {
        id: u32,
        name: String,
        cause: String,
    },
    BuildingComplete {
        id: u32,
        /// `BuildingDef` id, e.g. "mill".
        building: String,
    },
    BuildingUnlocked {
        building: String,
    },
    HarvestReady {
        /// Owning building id, or the crop id when the tile has no occupant.
        site: u32,
        /// `BuildingDef` id of the owning farm; `None` for a bare crop.
        building: Option<String>,
        count: u32,
    },
    SeasonTurned {
        season: u8,
        year: u32,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChronicleEntry {
    /// Unique and monotonic. Doubles as the React key.
    pub seq: u64,
    pub tick: u64,
    pub day: u32,
    pub season: u8,
    pub year: u32,
    /// Tile to centre the camera on. `None` renders a non-clickable row.
    pub focus: Option<(i32, i32)>,
    pub body: ChronicleBody,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Chronicle {
    entries: VecDeque<ChronicleEntry>,
    next_seq: u64,
}

impl Chronicle {
    pub fn new() -> Self {
        Self::default()
    }

    /// Monotonic revision counter. Changes on every mutation, including a
    /// coalesced harvest count bump. This is what the tick snapshot exposes.
    pub fn seq(&self) -> u64 {
        self.next_seq
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    pub fn to_vec(&self) -> Vec<ChronicleEntry> {
        self.entries.iter().cloned().collect()
    }

    #[cfg(test)]
    pub fn back(&self) -> Option<&ChronicleEntry> {
        self.entries.back()
    }

    /// Record an entry, coalescing consecutive same-site harvests within one day.
    pub fn push(&mut self, clock: &Clock, focus: Option<(i32, i32)>, body: ChronicleBody) {
        let season = clock.season.as_u8();

        if let ChronicleBody::HarvestReady { site, count, .. } = &body
            && let Some(last) = self.entries.back_mut()
            && last.day == clock.day
            && last.season == season
            && last.year == clock.year
            && let ChronicleBody::HarvestReady {
                site: last_site,
                count: last_count,
                ..
            } = &mut last.body
            && *last_site == *site
        {
            *last_count = last_count.saturating_add(*count);
            last.tick = clock.tick;
            last.seq = self.next_seq;
            self.next_seq = self.next_seq.saturating_add(1);
            return;
        }

        self.entries.push_back(ChronicleEntry {
            seq: self.next_seq,
            tick: clock.tick,
            day: clock.day,
            season,
            year: clock.year,
            focus,
            body,
        });
        self.next_seq = self.next_seq.saturating_add(1);

        while self.entries.len() > CHRONICLE_CAP {
            self.entries.pop_front();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn harvest(site: u32, count: u32) -> ChronicleBody {
        ChronicleBody::HarvestReady {
            site,
            building: Some("farm".to_string()),
            count,
        }
    }

    fn born(id: u32) -> ChronicleBody {
        ChronicleBody::VillagerBorn {
            id,
            name: format!("V{id}"),
        }
    }

    #[test]
    fn evicts_oldest_past_cap() {
        let clock = Clock::new();
        let mut chronicle = Chronicle::new();
        for id in 0..(CHRONICLE_CAP as u32 + 25) {
            chronicle.push(&clock, None, born(id));
        }
        assert_eq!(chronicle.len(), CHRONICLE_CAP);
        // The 25 oldest are gone, so the first surviving entry is id 25.
        let first = chronicle.to_vec()[0].clone();
        assert_eq!(first.body, born(25));
    }

    #[test]
    fn coalesces_same_site_same_day() {
        let clock = Clock::new();
        let mut chronicle = Chronicle::new();
        chronicle.push(&clock, None, harvest(7, 1));
        chronicle.push(&clock, None, harvest(7, 2));
        assert_eq!(chronicle.len(), 1);
        assert_eq!(
            chronicle.back().unwrap().body,
            ChronicleBody::HarvestReady {
                site: 7,
                building: Some("farm".to_string()),
                count: 3,
            }
        );
    }

    #[test]
    fn does_not_coalesce_different_site() {
        let clock = Clock::new();
        let mut chronicle = Chronicle::new();
        chronicle.push(&clock, None, harvest(7, 1));
        chronicle.push(&clock, None, harvest(8, 1));
        assert_eq!(chronicle.len(), 2);
    }

    #[test]
    fn does_not_coalesce_across_a_day_boundary() {
        let mut clock = Clock::new();
        let mut chronicle = Chronicle::new();
        chronicle.push(&clock, None, harvest(7, 1));
        clock.force_day_rollover();
        chronicle.push(&clock, None, harvest(7, 1));
        assert_eq!(chronicle.len(), 2);
    }

    #[test]
    fn does_not_coalesce_when_another_entry_intervenes() {
        let clock = Clock::new();
        let mut chronicle = Chronicle::new();
        chronicle.push(&clock, None, harvest(7, 1));
        chronicle.push(&clock, None, born(1));
        chronicle.push(&clock, None, harvest(7, 1));
        assert_eq!(chronicle.len(), 3);
    }

    #[test]
    fn coalescing_still_advances_seq() {
        let clock = Clock::new();
        let mut chronicle = Chronicle::new();
        chronicle.push(&clock, None, harvest(7, 1));
        let after_first = chronicle.seq();
        chronicle.push(&clock, None, harvest(7, 1));
        assert!(chronicle.seq() > after_first, "coalesce must bump the revision");
    }

    #[test]
    fn seq_is_strictly_increasing() {
        let clock = Clock::new();
        let mut chronicle = Chronicle::new();
        let mut previous = chronicle.seq();
        for id in 0..10 {
            chronicle.push(&clock, None, born(id));
            assert!(chronicle.seq() > previous);
            previous = chronicle.seq();
        }
        let entries = chronicle.to_vec();
        for pair in entries.windows(2) {
            assert!(pair[1].seq > pair[0].seq);
        }
    }

    #[test]
    fn captures_the_clock_date() {
        let mut clock = Clock::new();
        clock.day = 12;
        clock.year = 3;
        let mut chronicle = Chronicle::new();
        chronicle.push(&clock, Some((4, 5)), born(1));
        let entry = chronicle.back().unwrap();
        assert_eq!(entry.day, 12);
        assert_eq!(entry.year, 3);
        assert_eq!(entry.focus, Some((4, 5)));
    }
}
