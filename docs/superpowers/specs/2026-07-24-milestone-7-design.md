# VillageSim Milestone 7 Design

## Scope

Milestone 7 replaces the Idle priority ladder with utility AI scoring, adds Eat / Sleep / Socialize / Wander actions with hysteresis, and spawns multiple villagers (5).

**Done when:** villagers interleave working, eating, and sleeping without being told, and don't flicker between actions.

Out of scope: economy chains / hauling (M8), housing capacity / births (M9), beds as sleep sites, traits filtering jobs, weather.

## Decisions (locked)

| Topic | Choice |
|---|---|
| Action API | `ActionKind` enum + free `score` / `begin` (trait-shaped, borrow-friendly) |
| Re-decide when | Idle and Working only; Eating / Sleeping / Socializing / MovingTo run to completion |
| Eat interrupt | May leave Working for Eat/Sleep/Socialize; **job claim stays** (spec) |
| Eat / Sleep site | In place from global stock / rest (no furniture until later milestones) |
| Food gate | `resources.food >= 1`; consume 1 at Eat begin; starting food `50` |
| Night | `minute >= 1200` or `minute < 360`; Sleep score × `1.5` |
| Socialize gate | Another villager within Chebyshev distance ≤ 8; socialize in place |
| Wander | Score `0.05`; pick deterministic nearby walkable tile from `(seed, tick, id)` |
| Hysteresis | New action must beat current action score by `≥ 0.15` |
| Player move | Explicit abandonment: release job; `MovePurpose::PlayerOrder`; nearest villager to click (or selected) |
| Multi-villager | `World.villagers: Vec<Villager>` length 5; snapshot lists all |
| Selection | Click villager → panel polls that id; default id `1` |

## Architecture

1. `sim/utility.rs` — `ActionKind`, scoring curves, hysteresis pick, `begin` helpers that mutate villager + world resources/jobs.
2. Extend `agents.rs` — `Eating` / `Sleeping` / `Socializing` states; `MovePurpose::{Wander}`; `current_action: ActionKind` on villager.
3. `World.villager` → `World.villagers` (5 named spawns near center on distinct tiles).
4. Idle ladder in `tick_idle` replaced by `maybe_decide` → score → hysteresis → `begin`.
5. Frontend `demoWorld.ts` mirrors scoring + 5 villagers; `App` / Canvas support villager selection for the panel.

## Scoring (0.0–1.0)

Distance factor: `1.0 / (1.0 + dist * 0.05)` (Manhattan tiles).

| Action | Score | Gate |
|---|---|---|
| Eat | `(1 - hunger)²` | `food >= 1` |
| Sleep | `(1 - energy)² × night_bonus` | always (bonus 1.5 at night, else 1.0) |
| Work | `0.4 × (priority / 10) × dist_factor` | claimed job or best unclaimed |
| Socialize | `(1 - social)^1.5` | other villager Chebyshev ≤ 8 |
| Wander | `0.05` | always (floor) |

Pick max score. If `best != current` and `best_score < current_score + 0.15`, keep `current`. On first decide from a fresh Idle with no `current_action`, treat current score as `0`.

## Behaviour

### Eat

Begin: if `food >= 1`, spend 1 food, set `AgentState::Eating { ticks_remaining: 60 }`, set `current_action = Eat`. Do not release job.

Each tick: decrement; at 0 set hunger to `1.0`, recompute happiness, go Idle (keep `current_action` for hysteresis).

### Sleep

Begin: `Sleeping { ticks_remaining: 100 }`. At end set energy to `1.0`, Idle.

### Socialize

Begin: `Socializing { ticks_remaining: 40 }` while partner still within 8 (else abort to Idle). At end: `social = min(1, social + 0.5)`, Idle.

### Work

Begin: if already Working/MovingTo this job, no-op. Else claim best (or resume claim), path to stand tile / enter Working as today. TendCrops watering + auto-plant unchanged.

### Wander

Begin: choose walkable tile within radius 6 (deterministic hash); path with `MovePurpose::Wander`. On arrival → Idle. No job claim; if a claim was held, **keep it** (Wander only wins when Work scores ~0).

### Player order

`order_move` targets the selected villager id when provided; otherwise the nearest villager to the destination. Releases that villager's job. On arrival → Idle.

## State bytes

| Value | State |
|---|---|
| 0 | Idle |
| 1 | MovingTo |
| 2 | Working |
| 3 | Eating |
| 4 | Sleeping |
| 5 | Socializing |

## IPC

No new commands required. `get_villager_detail(id)` works for any of the five. Optional: `move_villager_to` gains optional `villager_id` — if omitted, nearest to tile.

## Tests

- Utility unit: Eat/Sleep/Work/Socialize/Wander curves + hysteresis holds weaker alternative.
- Eat consumes food and restores hunger; Sleep restores energy.
- Working villager switches to Eat when hunger low and food available without releasing claim.
- World spawns 5 villagers; two can claim different TendCrops slots on one farm.
- No flicker: forced borderline scores keep current action across ticks.

## Demo script

1. `npm run dev` — five villagers near spawn.
2. Place farm → completes → one or two claim TendCrops and work.
3. Lower hunger (wait or test hook) → villager eats (food decreases), then returns to work.
4. Jump clock toward night / drain energy → sleep without oscillating.
5. Click villagers to inspect needs in the panel.
