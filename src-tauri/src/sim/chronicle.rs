//! Village chronicle: a capped ring buffer of player-facing milestones (Milestone 10).

use std::collections::VecDeque;

use serde::{Deserialize, Serialize};

use super::clock::Clock;

/// Maximum entries retained. Oldest are evicted first.
pub const CHRONICLE_CAP: usize = 200;

/// What happened. Storage type: uses externally-tagged enum (variant indices) because bincode
/// does not support internally-tagged enums. For JSON APIs, use `ChronicleBodyView` which
/// provides a discriminated union with the `kind` field — see `ChronicleEntry::view()`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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

    #[cfg(test)]
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    #[cfg(test)]
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    #[cfg(test)]
    pub fn to_vec(&self) -> Vec<ChronicleEntry> {
        self.entries.iter().cloned().collect()
    }

    /// Borrowing accessor over the ring buffer, oldest first. Prefer this over
    /// `to_vec()` when the caller only needs to iterate (e.g. mapping to wire views)
    /// since it avoids cloning every entry.
    pub fn entries(&self) -> impl Iterator<Item = &ChronicleEntry> {
        self.entries.iter()
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

impl ChronicleEntry {
    /// Convert storage entry to JSON wire form with internally-tagged body.
    pub fn view(&self) -> ChronicleEntryView {
        ChronicleEntryView {
            seq: self.seq,
            tick: self.tick,
            day: self.day,
            season: self.season,
            year: self.year,
            focus: self.focus,
            body: self.body.view(),
        }
    }
}

impl ChronicleBody {
    /// Convert storage body to JSON wire form with kind discriminator.
    pub fn view(&self) -> ChronicleBodyView {
        match self {
            ChronicleBody::VillagerBorn { id, name } => ChronicleBodyView::VillagerBorn {
                id: *id,
                name: name.clone(),
            },
            ChronicleBody::VillagerDied { id, name, cause } => ChronicleBodyView::VillagerDied {
                id: *id,
                name: name.clone(),
                cause: cause.clone(),
            },
            ChronicleBody::BuildingComplete { id, building } => {
                ChronicleBodyView::BuildingComplete {
                    id: *id,
                    building: building.clone(),
                }
            }
            ChronicleBody::BuildingUnlocked { building } => ChronicleBodyView::BuildingUnlocked {
                building: building.clone(),
            },
            ChronicleBody::HarvestReady {
                site,
                building,
                count,
            } => ChronicleBodyView::HarvestReady {
                site: *site,
                building: building.clone(),
                count: *count,
            },
            ChronicleBody::SeasonTurned { season, year } => ChronicleBodyView::SeasonTurned {
                season: *season,
                year: *year,
            },
        }
    }
}

/// JSON wire form of a chronicle entry. Serialize only — never persisted.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChronicleEntryView {
    pub seq: u64,
    pub tick: u64,
    pub day: u32,
    pub season: u8,
    pub year: u32,
    pub focus: Option<(i32, i32)>,
    pub body: ChronicleBodyView,
}

/// Internally tagged so the frontend gets a clean discriminated union on `kind`.
/// Serialize only — never persisted. No variant may carry a field named `kind` — it would
/// collide with the tag. See `ChronicleBody` for the storage type.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ChronicleBodyView {
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
        building: String,
    },
    BuildingUnlocked {
        building: String,
    },
    HarvestReady {
        site: u32,
        building: Option<String>,
        count: u32,
    },
    SeasonTurned {
        season: u8,
        year: u32,
    },
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
    fn is_empty_reflects_entry_count() {
        let clock = Clock::new();
        let mut chronicle = Chronicle::new();
        assert!(chronicle.is_empty());
        chronicle.push(&clock, None, born(1));
        assert!(!chronicle.is_empty());
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

    #[test]
    fn wire_view_has_correct_kind_discriminant_and_fields_for_all_variants() {
        use serde_json;

        let clock = Clock::new();

        // Test data: (body, expected_kind, expected_field_checks)
        // Each check is a closure that validates JSON content
        type FieldCheck = Box<dyn Fn(&str) -> bool>;
        type TestCase = (ChronicleBody, &'static str, Vec<FieldCheck>);
        let test_cases: Vec<TestCase> = vec![
            // VillagerBorn: check kind and name field
            (
                ChronicleBody::VillagerBorn {
                    id: 42,
                    name: "Anya".to_string(),
                },
                "villagerBorn",
                vec![
                    Box::new(|json: &str| json.contains("\"id\":42")),
                    Box::new(|json: &str| json.contains("\"name\":\"Anya\"")),
                ],
            ),
            // VillagerDied: check kind, name, and cause fields
            (
                ChronicleBody::VillagerDied {
                    id: 7,
                    name: "Bob".to_string(),
                    cause: "starvation".to_string(),
                },
                "villagerDied",
                vec![
                    Box::new(|json: &str| json.contains("\"id\":7")),
                    Box::new(|json: &str| json.contains("\"name\":\"Bob\"")),
                    Box::new(|json: &str| json.contains("\"cause\":\"starvation\"")),
                ],
            ),
            // BuildingComplete: check kind and building field (not kind field)
            (
                ChronicleBody::BuildingComplete {
                    id: 99,
                    building: "mill".to_string(),
                },
                "buildingComplete",
                vec![
                    Box::new(|json: &str| json.contains("\"id\":99")),
                    Box::new(|json: &str| json.contains("\"building\":\"mill\"")),
                ],
            ),
            // BuildingUnlocked: check kind and building field
            (
                ChronicleBody::BuildingUnlocked {
                    building: "granary".to_string(),
                },
                "buildingUnlocked",
                vec![Box::new(|json: &str| json.contains("\"building\":\"granary\""))],
            ),
            // HarvestReady with Some(building): check site, count, building
            (
                ChronicleBody::HarvestReady {
                    site: 15,
                    building: Some("farm".to_string()),
                    count: 3,
                },
                "harvestReady",
                vec![
                    Box::new(|json: &str| json.contains("\"site\":15")),
                    Box::new(|json: &str| json.contains("\"count\":3")),
                    Box::new(|json: &str| json.contains("\"building\":\"farm\"")),
                ],
            ),
            // HarvestReady with None(building): check site, count, null building
            (
                ChronicleBody::HarvestReady {
                    site: 20,
                    building: None,
                    count: 5,
                },
                "harvestReady",
                vec![
                    Box::new(|json: &str| json.contains("\"site\":20")),
                    Box::new(|json: &str| json.contains("\"count\":5")),
                    Box::new(|json: &str| json.contains("\"building\":null")),
                ],
            ),
            // SeasonTurned: check kind, season, and year fields
            (
                ChronicleBody::SeasonTurned {
                    season: 2,
                    year: 4,
                },
                "seasonTurned",
                vec![
                    Box::new(|json: &str| json.contains("\"season\":2")),
                    Box::new(|json: &str| json.contains("\"year\":4")),
                ],
            ),
        ];

        // Test each variant
        for (body, expected_kind, field_checks) in test_cases {
            let mut chronicle = Chronicle::new();
            chronicle.push(&clock, None, body);
            let entry = chronicle.back().unwrap();
            let view = entry.view();

            let json = serde_json::to_string(&view).expect("serialize to json");

            // Check kind discriminator
            let kind_field = format!("\"kind\":\"{}\"", expected_kind);
            assert!(
                json.contains(&kind_field),
                "JSON for {} must contain kind discriminator '{}'; got: {}",
                expected_kind,
                kind_field,
                json
            );

            // Check all field assertions for this variant
            for check in field_checks {
                assert!(
                    check(&json),
                    "Field validation failed for {} variant; JSON: {}",
                    expected_kind,
                    json
                );
            }
        }
    }

    #[test]
    fn wire_view_encodes_focus_coordinates_correctly() {
        use serde_json;

        let clock = Clock::new();
        let mut chronicle = Chronicle::new();

        // Test with Some(focus)
        chronicle.push(&clock, Some((3, 4)), ChronicleBody::VillagerBorn {
            id: 1,
            name: "Test".to_string(),
        });
        let entry_with_focus = chronicle.back().unwrap();
        let view_with_focus = entry_with_focus.view();
        let json_with_focus =
            serde_json::to_string(&view_with_focus).expect("serialize with focus");
        assert!(
            json_with_focus.contains("\"focus\":[3,4]"),
            "focus should render as JSON array [3,4]; got: {}",
            json_with_focus
        );

        // Test with None(focus)
        chronicle.push(&clock, None, ChronicleBody::VillagerBorn {
            id: 2,
            name: "Test2".to_string(),
        });
        let entry_no_focus = chronicle.back().unwrap();
        let view_no_focus = entry_no_focus.view();
        let json_no_focus =
            serde_json::to_string(&view_no_focus).expect("serialize without focus");
        assert!(
            json_no_focus.contains("\"focus\":null"),
            "focus should render as null when None; got: {}",
            json_no_focus
        );
    }

    #[test]
    fn storage_body_round_trips_via_bincode() {
        // Test that storage body (untagged) survives bincode serialization.
        // This is the regression guard for the tag removal — if someone re-adds the tag,
        // this will fail.
        let body = born(1);
        let config = bincode::config::standard().with_limit::<{ 64 * 1024 * 1024 }>();
        let encoded = bincode::serde::encode_to_vec(&body, config)
            .expect("encode storage body");
        let (decoded, _): (ChronicleBody, usize) =
            bincode::serde::decode_from_slice(&encoded, config)
                .expect("decode storage body");
        assert_eq!(decoded, body);
    }
}
