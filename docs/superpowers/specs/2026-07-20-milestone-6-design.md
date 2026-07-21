# VillageSim Milestone 6 Design

## Scope

Milestone 6 adds the in-game clock (day/season/year), simulation speed controls, data-driven crops with planting and growth, seasonal gating, watering via `TendCrops`, and stage-based crop rendering.

**Done when:** wheat planted in spring visibly grows through its stages and stalls in winter.

Out of scope: harvest/yield/hauling (M8), weather/rain (M8), seed spending (deferred until harvest), utility AI / multi-villager (M7), deep crop UI polish.

## Decisions (locked)

| Topic | Choice |
|---|---|
| Planting | Player `plant_crop` **and** TendCrops auto-plant empty farm tiles |
| Watering | TendCrops sets `watered`; growth requires water when `water_required`; clear on day rollover |
| Calendar | Full spec calendar (28 days/season, 0.06 min/tick) **plus** debug day/season jump for tests |
| Harvest | Grow to max stage + `CropReady` only; no yield |
| Seed cost | Keep in `crops.json`; ignore until harvest exists |
| Architecture | Spec-faithful `clock.rs` + `crops.rs` + first-class `Crop` entities on farm tiles |

## Architecture

M5 needs/jobs/Working FSM stay intact. Additions:

1. `sim/clock.rs` — `Clock { tick, minute, day, season, year, speed }` with calendar advance and speed enum.
2. `sim/crops.rs` — `Crop` entities, growth tick, seasonal gate, watering helpers, plant validation.
3. `data/crops.json` — loaded into `Catalog` alongside buildings; `get_catalog` returns both.
4. Sim loop — read `clock.speed`: Paused skips `world.advance()`; else sleep `50ms / multiplier` (scale interval, not tick content).
5. Crops live on completed farm footprint tiles; farm still owns occupancy for pathing/placement. Pathfinding unchanged (stand tiles remain adjacent ring).
6. Snapshot gains `clock` + `crops`; `CropReady` in `events` when a crop first reaches max stage.

## Behaviour

### Clock

- World starts at Spring, day 1, year 1, speed 1×, minute 0.
- Each advancing tick: add `0.06` in-game minutes via a fractional accumulator; expose floored `minute` in `0..=1439`.
- When accumulator ≥ 1440: subtract 1440, `day += 1`, and clear all crop `watered` flags.
- When `day` would become 29: set `day = 1` and advance season; Winter → Spring also increments `year`.
- Seasons: Spring (0), Summer (1), Autumn (2), Winter (3).
- Speed bytes: `0 = Paused`, `1 = 1×`, `2 = 2×`, `3 = 3×`.
- Paused: still drain `SimCommand`s; skip `world.advance()` (no calendar, growth, needs, or movement).
- Debug/test command `advance_clock(days, season)`: jump forward `days` (applying day-rollover water clears) and optionally set season — used by unit tests and browser `?test=1` helpers; not a player chrome control.

### Planting

Valid when:

- Tile is inside a **completed** farm footprint
- No crop already on that tile
- Kind exists in `crops.json`

Player: enter plant mode → select crop (wheat) → click tile → `plant_crop(kind, x, y)`.

TendCrops: at the start of each `Working` cycle on a farm job, if the farm has an empty plantable tile and the current season is in wheat’s `seasons` list, auto-plant one `"wheat"` on the first empty footprint tile. Ignore `seed_cost`.

On farm demolish: remove all crops on that footprint (and existing job cleanup from M5).

### Growth and watering

Crops are planted at `stage = 0`. With `stages = 4`, max stage is `3`. Ready after `(stages - 1)` successful stage-ups (e.g. 3 × 400 = 1200 watered in-season ticks from plant to ready).

Per crop each tick (when sim is not paused):

1. If already at max stage → no further growth (keep rendering ready crop).
2. If current season ∉ crop’s `seasons` → stall. Winter and autumn both stall wheat.
3. Else if `water_required && !watered` → stall.
4. Else `growth_ticks += 1`. When `growth_ticks >= ticks_per_stage`: `stage += 1`, reset counter. On first transition to max stage, emit `CropReady { id }` once (`ready_emitted` flag).

TendCrops: every tick while `Working` on a farm job, set `watered = true` on all crops on that farm’s footprint.

Day rollover (see Clock) clears `watered` on all crops.

### Occupancy

Farm building occupies footprint tiles for placement/path blocking as today. Crops are separate entities keyed by `(x, y)` within that footprint; they do not change walkability. Villagers continue to stand on adjacent tiles outside the footprint.

## Data

`src-tauri/data/crops.json` (initial entry):

```json
[
  {
    "id": "wheat",
    "name": "Wheat",
    "stages": 4,
    "ticks_per_stage": 400,
    "seasons": ["spring", "summer"],
    "water_required": true,
    "yield": { "grain": 3 },
    "seed_cost": { "grain": 1 }
  }
]
```

`yield` / `seed_cost` are parsed and stored but unused in M6 gameplay.

### Crop struct

```rust
pub struct Crop {
    pub id: CropId,
    pub kind: String,       // catalog id, e.g. "wheat"
    pub tile: (i32, i32),
    pub stage: u8,          // 0..=stages-1
    pub growth_ticks: u32,
    pub watered: bool,
    pub ready_emitted: bool,
}
```

Snapshot `kind` is a compact `u8` index into the crops catalog order (same pattern as buildings).

## IPC

```rust
#[tauri::command] fn set_speed(speed: u8)
#[tauri::command] fn plant_crop(kind: String, x: i32, y: i32) -> Result<(), String>
#[tauri::command] fn get_catalog() -> Catalog  // buildings + crops
// test / demo helper:
#[tauri::command] fn advance_clock(days: u32, season: Option<u8>) -> Result<(), String>
```

All push `SimCommand` on the existing mpsc channel. `plant_crop` / `advance_clock` return via oneshot where a response is needed.

### Snapshot additions

```rust
pub struct ClockView {
    pub minute: u32,
    pub day: u32,
    pub season: u8,   // 0..3
    pub year: u32,
    pub speed: u8,    // 0..3
}
// Top-level TickSnapshot.tick remains the authoritative tick counter.

pub struct CropView {
    pub id: u32,
    pub x: i32,
    pub y: i32,
    pub kind: u8,
    pub stage: u8,
}

// TickSnapshot gains:
//   clock: ClockView
//   crops: Vec<CropView>
//   events: Vec<SimEvent> including CropReady { id }
```

Needs remain out of the tick payload (M5 unchanged).

## Frontend

- Clock strip + speed controls in chrome: day / season label / year, buttons Pause · 1× · 2× · 3× calling `set_speed`.
- Plant mode beside build mode: select wheat → ghost on farm tiles → click to plant.
- `drawEntities`: render crops by stage (size/color progression sufficient for M6).
- Browser-demo (`demoWorld.ts`): mirror clock advance, speed (including pause), plant, TendCrops auto-plant/water, growth, day-rollover water clear, season stall, `CropReady`, and `advance_clock` for `?test=1`.

## Verification

- Unit: minute→day→season→year rollover; paused skips advance; speed only changes interval; winter/out-of-season stall; water gate; stage advance + single `CropReady`; plant validation (not on farm / occupied / bad kind); TendCrops auto-plant + water; demolish removes crops.
- Integration: spring plant → water via tend → grow through stages → `advance_clock` into winter → growth stalls.
- Browser smoke: place farm, plant or wait for auto-plant, watch stages, jump season to winter, confirm stall; speed pause stops growth.
- `cargo test --lib`, `npm test`, `npm run build` pass.

## Explicit non-goals

Harvest, seed spending, rain/weather, hauling, grain economy, utility AI, multiple villagers, traits/`green_thumb`, autumn-specific crop kinds beyond JSON data.
