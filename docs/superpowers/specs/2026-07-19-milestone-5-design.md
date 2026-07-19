# VillageSim Milestone 5 Design

## Scope

Milestone 5 adds needs decay, a job board with farm `TendCrops` jobs, a `Working` FSM state, and an on-demand `VillagerPanel` via `get_villager_detail`.

**Done when:** the villager autonomously walks to a completed farm and works, and hunger ticks down in the panel.

Out of scope: crops growth (M6), clock/speed UI (M6), utility AI (M7), eating/sleeping actions, hauling, multiple villagers.

## Architecture

M4 pathfinding and player move orders stay intact. Additions:

1. `sim/needs.rs` — `Needs { hunger, energy, social, happiness }` with per-tick decay; happiness is derived.
2. `sim/jobs.rs` — `JobBoard` with `Job { id, kind, site, tile, priority, claimed_by }`. Completed farms advertise `TendCrops` slots from `buildings.json`.
3. Extend `agents.rs` — `MovePurpose::Work`, `AgentState::Working { job, ticks_remaining }`, villager fields `needs`, `current_job`, `name`.
4. Idle villager each tick: claim best unclaimed job by `priority / (1 + distance)`, path to `job.tile`, then enter `Working`.
5. `get_villager_detail(id)` oneshot command → `VillagerDetail` for the panel (never in tick payload).

## Behaviour

### Needs decay (per tick @ 20 Hz)

| Need | Decay | Notes |
|---|---|---|
| hunger | 0.00008 | empty in ~10 in-game hours |
| energy | 0.00005 | |
| social | 0.00003 | |
| happiness | derived | weighted avg of the three |

Clamp to `[0, 1]`. Starting values: all `1.0`.

### Job advertising

When a building transitions to `Complete`, call `job_board.advertise_for_building(...)`. For each `jobs` entry on the def with `kind == "tend_crops"`, create up to `slots` jobs. Work tile = nearest passable tile adjacent to the building footprint (4-neighbour ring). If fewer adjacent tiles than slots, create as many as possible.

On demolish: release any claim held by the villager for that site and remove all jobs for that building.

M5 only advertises `tend_crops`. Granary `haul` jobs are ignored until M8.

### FSM transitions (Idle decision)

Priority each tick while Idle (and repath cooldown is 0):

1. If `current_job` is set and still on the board → resume MovingTo that job tile (or Working if already there).
2. Else claim best unclaimed job; on success → `MovingTo { purpose: Work }`.
3. Else stay Idle.

While `MovingTo { purpose: Work }`: on arrival → `Working { ticks_remaining: WORK_CYCLE_TICKS }` (40 ticks). When the cycle ends, restart the cycle (ongoing tend) so the villager stays visibly working.

Player `MoveVillagerTo` releases the current job claim (explicit abandonment) and sets `MovePurpose::PlayerOrder`. On arrival → Idle (then may re-claim).

If a claimed job's building is demolished mid-work/move → clear claim, Idle.

### State bytes in snapshot

| Value | State |
|---|---|
| 0 | Idle |
| 1 | MovingTo |
| 2 | Working |

## IPC

```rust
#[tauri::command]
async fn get_villager_detail(id: u32) -> Result<VillagerDetail, String>

pub struct VillagerDetail {
    pub id: u32,
    pub name: String,
    pub state: u8,
    pub hunger: f32,
    pub energy: f32,
    pub social: f32,
    pub happiness: f32,
    pub job_kind: Option<String>,  // e.g. "tend_crops"
    pub job_site: Option<u32>,     // building id
}
```

Poll from the frontend ~4 Hz while the panel is open (or on each tick subscription callback with throttling). Do not put needs in `TickSnapshot`.

## Frontend

- `VillagerPanel` in the right chrome (below or above BuildMenu): shows name, state label, need bars, current job.
- Clicking the villager on the canvas selects them for the panel; with one villager, auto-select id 1 on load is fine.
- Browser-demo: mirror needs decay, farm job advertise/claim/work, and `getVillagerDetail`.

## Verification

- Unit: need decay math; job advertise on farm complete; claim scoring; Working cycle; demolish releases jobs.
- Integration: place farm → complete → villager paths to adjacent tile → Working; hunger decreases over ticks via detail.
- Browser smoke: place farm, wait for complete + work; panel hunger declines.
- `cargo test --lib`, `npm test`, `npm run build` pass.

## Explicit non-goals

Crops, seasons, clock UI, Eat/Sleep states, utility scoring, hauling, multi-villager — M6+.
