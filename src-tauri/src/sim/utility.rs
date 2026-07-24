//! Utility AI scoring and action selection (Milestone 7).

use super::clock::Clock;
use super::jobs::JobBoard;
use super::resources::ResourceTotals;

/// Candidate actions scored each decide tick.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ActionKind {
    Eat,
    Sleep,
    Work,
    Socialize,
    Wander,
}

impl ActionKind {
    pub fn as_u8(self) -> u8 {
        match self {
            Self::Eat => 0,
            Self::Sleep => 1,
            Self::Work => 2,
            Self::Socialize => 3,
            Self::Wander => 4,
        }
    }
}

/// New action must beat the current action's score by this margin.
pub const HYSTERESIS: f32 = 0.15;
pub const WORK_BASELINE: f32 = 0.4;
pub const WANDER_SCORE: f32 = 0.05;
pub const NIGHT_BONUS: f32 = 1.5;
pub const NIGHT_START_MINUTE: u32 = 20 * 60;
pub const NIGHT_END_MINUTE: u32 = 6 * 60;
pub const SOCIAL_RANGE: i32 = 8;

pub const EAT_TICKS: u32 = 60;
pub const SLEEP_TICKS: u32 = 100;
pub const SOCIALIZE_TICKS: u32 = 40;
pub const SOCIAL_RESTORE: f32 = 0.5;
pub const WANDER_RADIUS: i32 = 6;

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ScoredAction {
    pub kind: ActionKind,
    pub score: f32,
    /// Job id when `kind == Work`.
    pub job_id: Option<u32>,
}

pub fn is_night(minute: u32) -> bool {
    minute >= NIGHT_START_MINUTE || minute < NIGHT_END_MINUTE
}

pub fn distance_factor(dist: i32) -> f32 {
    1.0 / (1.0 + dist as f32 * 0.05)
}

pub fn score_eat(hunger: f32, food: u32) -> f32 {
    if food == 0 {
        return 0.0;
    }
    let deficit = (1.0 - hunger).clamp(0.0, 1.0);
    deficit * deficit
}

pub fn score_sleep(energy: f32, night: bool) -> f32 {
    let deficit = (1.0 - energy).clamp(0.0, 1.0);
    let base = deficit * deficit;
    if night {
        (base * NIGHT_BONUS).min(1.0)
    } else {
        base
    }
}

pub fn score_work(priority: u8, dist: i32) -> f32 {
    let priority_scale = f32::from(priority) / 10.0;
    (WORK_BASELINE * priority_scale * distance_factor(dist)).clamp(0.0, 1.0)
}

pub fn score_socialize(social: f32, partner_in_range: bool) -> f32 {
    if !partner_in_range {
        return 0.0;
    }
    let deficit = (1.0 - social).clamp(0.0, 1.0);
    deficit.powf(1.5)
}

pub fn score_wander() -> f32 {
    WANDER_SCORE
}

/// Immutable snapshot of what scoring needs (avoids borrowing all of World).
pub struct ScoreContext<'a> {
    pub hunger: f32,
    pub energy: f32,
    pub social: f32,
    pub from: (i32, i32),
    pub food: u32,
    pub night: bool,
    pub partner_in_range: bool,
    pub job_board: &'a JobBoard,
    pub villager_id: u32,
    /// Already-claimed job id, if any.
    pub current_job: Option<u32>,
}

pub fn score_all(ctx: &ScoreContext<'_>) -> Vec<ScoredAction> {
    let mut actions = vec![
        ScoredAction {
            kind: ActionKind::Eat,
            score: score_eat(ctx.hunger, ctx.food),
            job_id: None,
        },
        ScoredAction {
            kind: ActionKind::Sleep,
            score: score_sleep(ctx.energy, ctx.night),
            job_id: None,
        },
        ScoredAction {
            kind: ActionKind::Socialize,
            score: score_socialize(ctx.social, ctx.partner_in_range),
            job_id: None,
        },
        ScoredAction {
            kind: ActionKind::Wander,
            score: score_wander(),
            job_id: None,
        },
    ];

    let work = work_candidate(ctx);
    actions.push(work);
    actions
}

fn work_candidate(ctx: &ScoreContext<'_>) -> ScoredAction {
    if let Some(job_id) = ctx.current_job {
        if let Some(job) = ctx.job_board.get(job_id) {
            let dist = (job.tile.0 - ctx.from.0).abs() + (job.tile.1 - ctx.from.1).abs();
            return ScoredAction {
                kind: ActionKind::Work,
                score: score_work(job.priority, dist),
                job_id: Some(job_id),
            };
        }
    }
    if let Some((job_id, priority, tile)) = ctx.job_board.peek_best(ctx.from) {
        let dist = (tile.0 - ctx.from.0).abs() + (tile.1 - ctx.from.1).abs();
        ScoredAction {
            kind: ActionKind::Work,
            score: score_work(priority, dist),
            job_id: Some(job_id),
        }
    } else {
        ScoredAction {
            kind: ActionKind::Work,
            score: 0.0,
            job_id: None,
        }
    }
}

/// Pick the best action applying hysteresis against `current`.
/// When `current` is `None`, any positive score may win (no margin required vs 0).
pub fn pick_action(scored: &[ScoredAction], current: Option<ActionKind>) -> ScoredAction {
    let mut best = ScoredAction {
        kind: ActionKind::Wander,
        score: 0.0,
        job_id: None,
    };
    for action in scored {
        if action.score > best.score
            || (action.score == best.score && action.kind.as_u8() < best.kind.as_u8())
        {
            best = *action;
        }
    }

    let Some(current_kind) = current else {
        return best;
    };
    let current_score = scored
        .iter()
        .find(|a| a.kind == current_kind)
        .map(|a| a.score)
        .unwrap_or(0.0);

    if best.kind != current_kind && best.score < current_score + HYSTERESIS {
        if let Some(kept) = scored.iter().find(|a| a.kind == current_kind) {
            return *kept;
        }
        return ScoredAction {
            kind: current_kind,
            score: current_score,
            job_id: None,
        };
    }
    best
}

pub fn night_from_clock(clock: &Clock) -> bool {
    is_night(clock.minute)
}

#[allow(dead_code)]
pub fn food_available(resources: &ResourceTotals) -> bool {
    resources.food >= 1
}

/// Deterministic wander offset from ids (no RNG required).
pub fn wander_tile(
    from: (i32, i32),
    seed: u64,
    tick: u64,
    villager_id: u32,
    width: i32,
    height: i32,
    is_passable: &dyn Fn(i32, i32) -> bool,
) -> Option<(i32, i32)> {
    let mut hash = seed
        .wrapping_mul(0x9E37_79B9_7F4A_7C15)
        .wrapping_add(tick)
        .wrapping_add(u64::from(villager_id).wrapping_mul(0xC2B2_AE3D_27D4_EB4F));
    for _ in 0..16 {
        hash = hash
            .wrapping_mul(0xBF58_476D_1CE4_E5B9)
            .wrapping_add(0x94D0_49BB_1331_11EB);
        let raw_dx = (hash % (2 * WANDER_RADIUS as u64 + 1)) as i32 - WANDER_RADIUS;
        let raw_dy =
            ((hash / (2 * WANDER_RADIUS as u64 + 1)) % (2 * WANDER_RADIUS as u64 + 1)) as i32
                - WANDER_RADIUS;
        if raw_dx == 0 && raw_dy == 0 {
            continue;
        }
        let x = (from.0 + raw_dx).clamp(0, width - 1);
        let y = (from.1 + raw_dy).clamp(0, height - 1);
        if (x, y) != from && is_passable(x, y) {
            return Some((x, y));
        }
    }
    None
}

pub fn chebyshev(a: (i32, i32), b: (i32, i32)) -> i32 {
    (a.0 - b.0).abs().max((a.1 - b.1).abs())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sim::jobs::{Job, JobBoard, JobKind};

    #[test]
    fn eat_ramps_as_hunger_drops() {
        assert!((score_eat(1.0, 5) - 0.0).abs() < 1e-5);
        assert!((score_eat(0.0, 5) - 1.0).abs() < 1e-5);
        assert!(score_eat(0.5, 5) > score_eat(0.8, 5));
        assert_eq!(score_eat(0.0, 0), 0.0);
    }

    #[test]
    fn sleep_gets_night_bonus() {
        let day = score_sleep(0.0, false);
        let night = score_sleep(0.0, true);
        assert!((day - 1.0).abs() < 1e-5);
        assert!((night - 1.0).abs() < 1e-5); // clamped
        let mid_day = score_sleep(0.5, false);
        let mid_night = score_sleep(0.5, true);
        assert!(mid_night > mid_day);
    }

    #[test]
    fn work_falls_with_distance() {
        assert!(score_work(10, 0) > score_work(10, 20));
        assert!((score_work(10, 0) - WORK_BASELINE).abs() < 1e-5);
    }

    #[test]
    fn socialize_requires_partner() {
        assert_eq!(score_socialize(0.0, false), 0.0);
        assert!(score_socialize(0.0, true) > 0.9);
    }

    #[test]
    fn hysteresis_prevents_weak_switch() {
        let scored = [
            ScoredAction {
                kind: ActionKind::Work,
                score: 0.40,
                job_id: Some(1),
            },
            ScoredAction {
                kind: ActionKind::Eat,
                score: 0.50,
                job_id: None,
            },
            ScoredAction {
                kind: ActionKind::Wander,
                score: 0.05,
                job_id: None,
            },
        ];
        // Eat leads by only 0.10 < 0.15 → stay on Work.
        let picked = pick_action(&scored, Some(ActionKind::Work));
        assert_eq!(picked.kind, ActionKind::Work);

        let scored_strong = [
            ScoredAction {
                kind: ActionKind::Work,
                score: 0.40,
                job_id: Some(1),
            },
            ScoredAction {
                kind: ActionKind::Eat,
                score: 0.60,
                job_id: None,
            },
        ];
        let picked = pick_action(&scored_strong, Some(ActionKind::Work));
        assert_eq!(picked.kind, ActionKind::Eat);
    }

    #[test]
    fn pick_without_current_takes_best() {
        let scored = [
            ScoredAction {
                kind: ActionKind::Wander,
                score: 0.05,
                job_id: None,
            },
            ScoredAction {
                kind: ActionKind::Work,
                score: 0.35,
                job_id: Some(2),
            },
        ];
        assert_eq!(pick_action(&scored, None).kind, ActionKind::Work);
    }

    #[test]
    fn score_all_includes_claimed_job() {
        let mut board = JobBoard::new();
        board.jobs_mut_for_test().push(Job {
            id: 9,
            kind: JobKind::TendCrops,
            site: 1,
            tile: (3, 0),
            priority: 10,
            claimed_by: Some(1),
        });
        let ctx = ScoreContext {
            hunger: 1.0,
            energy: 1.0,
            social: 1.0,
            from: (0, 0),
            food: 10,
            night: false,
            partner_in_range: false,
            job_board: &board,
            villager_id: 1,
            current_job: Some(9),
        };
        let scored = score_all(&ctx);
        let work = scored.iter().find(|a| a.kind == ActionKind::Work).unwrap();
        assert!(work.score > 0.0);
        assert_eq!(work.job_id, Some(9));
    }

    #[test]
    fn is_night_windows() {
        assert!(!is_night(12 * 60));
        assert!(is_night(21 * 60));
        assert!(is_night(2 * 60));
        assert!(!is_night(8 * 60));
    }
}
