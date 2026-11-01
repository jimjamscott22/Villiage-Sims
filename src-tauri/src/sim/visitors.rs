//! Deterministic authored visits. Integer simulation ticks avoid timer drift.
use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, sync::OnceLock};

pub const FIRST_VISIT_TICKS: u32 = 1000;
pub const VISIT_STAY_TICKS: u32 = 3000;
pub const VISIT_GAP_TICKS: u32 = 6000;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VisitorKind {
    Merchant,
    Musician,
    Grower,
}
impl VisitorKind {
    pub fn definition(self) -> &'static VisitorDefinition {
        static DEFINITIONS: OnceLock<Vec<VisitorDefinition>> = OnceLock::new();
        &DEFINITIONS.get_or_init(|| {
            serde_json::from_str(include_str!("../../data/visitors.json"))
                .expect("builtin visitor definitions")
        })[self as usize]
    }
}
#[derive(Debug, Deserialize)]
pub struct VisitorDefinition {
    pub name: String,
    pub title: String,
    pub introduction: String,
    pub cost: BTreeMap<String, u32>,
    pub reward: String,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ActiveVisit {
    pub id: u32,
    pub visitor: VisitorKind,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Visits {
    pub active: Option<ActiveVisit>,
    pub remaining_ticks: u32,
    pub next_id: u32,
    pub next_index: u8,
    pub grower_settled: bool,
}
impl Default for Visits {
    fn default() -> Self {
        Self {
            active: None,
            remaining_ticks: FIRST_VISIT_TICKS,
            next_id: 1,
            next_index: 0,
            grower_settled: false,
        }
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VisitOutcome {
    Arrived,
    Accepted,
    Declined,
    Expired,
}
#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VisitDecision {
    Accept,
    Decline,
}
#[derive(Clone, Debug)]
pub struct VisitEvent {
    pub offset: u32,
    pub visit: ActiveVisit,
    pub outcome: VisitOutcome,
}
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VisitorView {
    pub visit_id: u32,
    pub visitor: VisitorKind,
    pub name: String,
    pub title: String,
    pub introduction: String,
    pub cost: BTreeMap<String, u32>,
    pub reward: String,
    pub remaining_minutes: u32,
    pub can_accept: bool,
    pub unavailable_reason: Option<String>,
}
impl Visits {
    pub fn finish(&mut self) {
        self.active = None;
        self.remaining_ticks = VISIT_GAP_TICKS;
    }
    pub fn advance(&mut self, mut ticks: u32) -> Vec<VisitEvent> {
        let mut events = Vec::new();
        let mut offset = 0;
        while ticks >= self.remaining_ticks {
            ticks -= self.remaining_ticks;
            offset += self.remaining_ticks;
            if let Some(visit) = self.active {
                events.push(VisitEvent {
                    offset,
                    visit,
                    outcome: VisitOutcome::Expired,
                });
                self.finish();
            } else {
                if self.grower_settled && self.next_index == 2 {
                    self.next_index = 0;
                }
                let visitor = [
                    VisitorKind::Merchant,
                    VisitorKind::Musician,
                    VisitorKind::Grower,
                ][self.next_index as usize];
                let visit = ActiveVisit {
                    id: self.next_id,
                    visitor,
                };
                self.next_id += 1;
                self.active = Some(visit);
                self.next_index = (self.next_index + 1) % 3;
                self.remaining_ticks = VISIT_STAY_TICKS;
                events.push(VisitEvent {
                    offset,
                    visit,
                    outcome: VisitOutcome::Arrived,
                });
            }
        }
        self.remaining_ticks -= ticks;
        events
    }
    pub fn validate(&self) -> Result<(), String> {
        if self.remaining_ticks == 0
            || self.remaining_ticks
                > if self.active.is_some() {
                    VISIT_STAY_TICKS
                } else {
                    VISIT_GAP_TICKS
                }
            || self.next_id == 0
            || self.next_id == u32::MAX
            || self.next_index > 2
            || self.active.is_some_and(|a| {
                a.id == 0
                    || a.id >= self.next_id
                    || (self.grower_settled && a.visitor == VisitorKind::Grower)
            })
        {
            return Err("save has invalid visitor state".into());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn schedule_boundaries_and_rotation() {
        let mut state = Visits::default();
        assert!(state.advance(999).is_empty());
        assert_eq!(
            state.advance(1)[0].visit,
            ActiveVisit {
                id: 1,
                visitor: VisitorKind::Merchant
            }
        );
        assert_eq!(state.remaining_ticks, 3000);
        assert!(state.advance(2999).is_empty());
        assert_eq!(state.advance(1)[0].outcome, VisitOutcome::Expired);
        assert!(state.advance(5999).is_empty());
        assert_eq!(state.advance(1)[0].visit.visitor, VisitorKind::Musician);
        state.finish();
        state.advance(6000);
        assert_eq!(state.active.unwrap().visitor, VisitorKind::Grower);
        state.grower_settled = true;
        state.finish();
        state.advance(6000);
        assert_eq!(state.active.unwrap().visitor, VisitorKind::Merchant);
        state.finish();
        state.advance(6000);
        state.finish();
        state.advance(6000);
        assert_eq!(state.active.unwrap().visitor, VisitorKind::Merchant);
    }
    #[test]
    fn jumps_match_chunked_time_and_invalid_saves_fail() {
        let mut a = Visits::default();
        let mut b = a.clone();
        a.advance(24000);
        for _ in 0..24 {
            b.advance(1000);
        }
        assert_eq!(a, b);
        assert!(a.validate().is_ok());
        a.remaining_ticks = 0;
        assert!(a.validate().is_err());
        a.remaining_ticks = 1;
        a.next_index = 3;
        assert!(a.validate().is_err());
    }
}
