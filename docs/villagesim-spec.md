# VillageSim — Specification & Implementation Plan

A desktop village simulator with autonomous villagers. Rust owns the authoritative simulation; a Tauri webview renders with 2D Canvas.

This document is a handoff package for Claude Code. Build in milestone order. Every milestone must end in a runnable, demoable state.

---

## 1. Architecture

**The split:** Rust is the authoritative simulation. The webview is a thin renderer plus UI chrome. The frontend holds no authoritative state — it can be rebuilt from a snapshot at any time.

| Concern | Owner |
|---|---|
| World state, entities, clock, economy | Rust |
| Villager AI, pathfinding, needs | Rust |
| Save/load serialization | Rust |
| Terrain/entity rendering | Webview (2D Canvas) |
| Camera, input, UI chrome | Webview (React) |
| Interpolation between ticks | Webview |

**Threading model:** the simulation runs on its own thread, independent of Tauri's async runtime.

- Commands in: `std::sync::mpsc::Sender<SimCommand>` — frontend intents are queued and drained at the top of each tick.
- Snapshots out: `tokio::sync::watch::Sender<TickSnapshot>` — the frontend only ever cares about the latest snapshot, so slow readers cannot back up the queue.

Do **not** put the world behind an `Arc<Mutex<World>>` accessed directly from command handlers. All mutation goes through the command channel so the sim thread owns the world exclusively and tick ordering stays deterministic.

**Tick rate:** 20Hz logic (50ms). Render at 60fps via `requestAnimationFrame`, interpolating positions between the last two snapshots. Speed multipliers (1x/2x/3x/pause) scale the tick interval, not the tick content.

---

## 2. Project structure

```
villagesim/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs           // Tauri setup, spawns sim thread
│   │   ├── commands.rs       // #[tauri::command] IPC handlers
│   │   ├── sim/
│   │   │   ├── mod.rs        // World struct, tick loop
│   │   │   ├── world.rs      // tile grid, terrain gen
│   │   │   ├── clock.rs      // time, calendar, seasons
│   │   │   ├── agents.rs     // villager FSM → utility AI
│   │   │   ├── needs.rs      // hunger/energy/social decay
│   │   │   ├── jobs.rs       // job board, claiming
│   │   │   ├── pathfind.rs   // A* over grid
│   │   │   ├── crops.rs      // growth stages
│   │   │   ├── buildings.rs  // placement validation, states
│   │   │   └── economy.rs    // resources, production chains
│   │   ├── snapshot.rs       // sim state → render view
│   │   └── persist.rs        // serde save/load
│   ├── data/
│   │   ├── buildings.json
│   │   ├── crops.json
│   │   └── traits.json
│   └── Cargo.toml
└── src/
    ├── main.tsx
    ├── render/
    │   ├── Canvas.tsx        // canvas stack, RAF loop
    │   ├── camera.ts         // pan/zoom, world↔screen transform
    │   ├── drawTiles.ts      // terrain layer
    │   ├── drawEntities.ts   // buildings, villagers, crops
    │   └── drawGhost.ts      // placement preview
    ├── state/
    │   ├── snapshot.ts       // latest snapshot, interpolation
    │   └── commands.ts       // invoke() wrappers
    └── ui/
        ├── BuildMenu.tsx
        ├── ResourceBar.tsx
        └── VillagerPanel.tsx
```

**Crates:** `tauri` 2.x, `serde`/`serde_json`, `bincode`, `noise` (terrain), `pathfinding` (A*), `rand` with a seedable RNG (`StdRng::seed_from_u64`), `tokio` (watch channel only).

**Frontend:** React + Vite + TypeScript + Tailwind. No canvas library — raw 2D context.

---

## 3. World model

Grid-based, finite. Default 128×128 tiles, 32px per tile at zoom 1.0.

```rust
pub struct World {
    pub width: usize,
    pub height: usize,
    pub tiles: Vec<Tile>,          // row-major, index = y * width + x
    pub entities: EntityStore,
    pub clock: Clock,
    pub resources: ResourceTotals,
    pub job_board: JobBoard,
    pub rng: StdRng,
    pub seed: u64,
    pub dirty_tiles: Vec<usize>,   // drained each tick into the snapshot
}

pub struct Tile {
    pub terrain: Terrain,
    pub occupant: Option<EntityId>, // building or crop occupying this cell
    pub tilled: bool,
    pub watered: bool,
}

#[repr(u8)]
pub enum Terrain {
    DeepWater = 0, ShallowWater = 1, Sand = 2,
    Grass = 3, Forest = 4, Rock = 5, Mountain = 6,
}
```

**Terrain generation:** two noise layers with `noise` crate.

- Elevation: fBm simplex, ~4 octaves, frequency ~0.03.
- Moisture: second simplex with a different seed offset.

Map to terrain by thresholding elevation first (water → sand → land → rock → mountain), then use moisture to split land into Grass vs Forest. Seed the generator from `world.seed` so worlds are reproducible.

**Passability:** DeepWater, ShallowWater, Rock, Mountain are impassable. Buildings occupy tiles and are impassable. Everything else is walkable.

---

## 4. Entities

Use a generational-index store, not raw `Vec` indices — entities get demolished and IDs must not be reused ambiguously.

```rust
pub struct EntityId { index: u32, generation: u32 }

pub struct EntityStore {
    pub villagers: SlotMap<VillagerId, Villager>,
    pub buildings: SlotMap<BuildingId, Building>,
    pub crops: SlotMap<CropId, Crop>,
}
```

Use the `slotmap` crate for this, or hand-roll generational indices. Serialization must survive round-tripping — verify save/load preserves IDs.

### Villager

```rust
pub struct Villager {
    pub id: VillagerId,
    pub name: String,
    pub pos: Vec2,              // continuous world coords, not tile coords
    pub facing: Facing,
    pub state: AgentState,
    pub needs: Needs,
    pub traits: Vec<TraitId>,
    pub inventory: Inventory,
    pub current_job: Option<JobId>,
    pub path: Option<Path>,
    pub home: Option<BuildingId>,
}
```

Villagers move in continuous coordinates at ~2.0 tiles/second, following a tile path. Position is what gets interpolated on the frontend.

### Building

```rust
pub struct Building {
    pub id: BuildingId,
    pub kind: BuildingKind,     // data-driven, from buildings.json
    pub origin: (i32, i32),     // top-left tile
    pub rotation: u8,           // 0-3
    pub state: BuildState,      // Ghost | UnderConstruction { progress } | Complete
    pub workers: Vec<VillagerId>,
    pub storage: Inventory,
}
```

### Crop

```rust
pub struct Crop {
    pub id: CropId,
    pub kind: CropKind,         // from crops.json
    pub tile: (i32, i32),
    pub stage: u8,              // 0..=max_stage
    pub growth_ticks: u32,
    pub watered: bool,
}
```

---

## 5. Data-driven content

Content lives in JSON under `src-tauri/data/`, loaded at startup and validated. Adding a building must never require touching gameplay code.

**buildings.json:**
```json
[
  {
    "id": "hut",
    "name": "Hut",
    "footprint": [1, 1],
    "cost": { "wood": 20 },
    "build_ticks": 200,
    "category": "housing",
    "houses": 2,
    "valid_terrain": ["grass", "sand"],
    "jobs": []
  },
  {
    "id": "farm",
    "name": "Farm Plot",
    "footprint": [3, 3],
    "cost": { "wood": 10 },
    "build_ticks": 100,
    "category": "production",
    "valid_terrain": ["grass"],
    "jobs": [{ "kind": "tend_crops", "slots": 2 }]
  },
  {
    "id": "granary",
    "name": "Granary",
    "footprint": [2, 2],
    "cost": { "wood": 40, "stone": 10 },
    "build_ticks": 300,
    "category": "storage",
    "stores": ["food"],
    "capacity": 500,
    "valid_terrain": ["grass", "sand"],
    "jobs": [{ "kind": "haul", "slots": 1 }]
  }
]
```

**crops.json:**
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

**traits.json:** trait ID → flat modifier map. `{"id":"green_thumb","name":"Green Thumb","modifiers":{"crop_growth_rate":1.25}}`. Modifiers are looked up by key at the point of use; unknown keys are ignored.

---

## 6. Time & environment

```rust
pub struct Clock {
    pub tick: u64,
    pub minute: u32,     // 0..1440 in-game minutes per day
    pub day: u32,        // 1..=28 per season
    pub season: Season,  // Spring, Summer, Autumn, Winter
    pub year: u32,
    pub speed: Speed,    // Paused, X1, X2, X3
}
```

One in-game day = 20 real minutes at 1x. 1440 in-game minutes / (20 min × 60 s × 20 ticks) = 0.06 in-game minutes per tick. Store minute as a float internally or accumulate fractional ticks.

**Seasons** gate crop viability and modify growth rate. Winter halts most crop growth.

**Weather** (Milestone 8+): per-day roll — Clear, Rain, Storm. Rain sets `watered = true` on all outdoor tiles. Storm can damage buildings.

---

## 7. Villager AI

Build the FSM first (Milestone 4), refactor to utility AI once needs and jobs exist (Milestone 7). Keep the action set identical across both so the refactor is contained to the decision function.

### Needs

```rust
pub struct Needs {
    pub hunger: f32,   // 0.0 = starving, 1.0 = full
    pub energy: f32,
    pub social: f32,
    pub happiness: f32, // derived, not decayed directly
}
```

Decay per tick: hunger ~0.00008 (empty in ~10 in-game hours), energy ~0.00005, social ~0.00003. Tune later. Happiness is a weighted average of the others plus modifiers (housed, well-fed, recent socializing).

### Phase 1 — FSM

```rust
pub enum AgentState {
    Idle,
    MovingTo { target: (i32, i32), purpose: MovePurpose },
    Working { job: JobId, ticks_remaining: u32 },
    Eating { ticks_remaining: u32 },
    Sleeping { ticks_remaining: u32 },
    Hauling { from: BuildingId, to: BuildingId, item: ItemKind },
}
```

Transitions checked each tick in priority order: critical needs → assigned job → idle wander.

### Phase 2 — Utility AI

Replace the transition ladder with scoring. Each candidate action scores 0.0–1.0; the villager picks the highest, with hysteresis (require the new action to beat the current one by ~0.15) to prevent oscillation.

```rust
pub trait Action {
    fn score(&self, v: &Villager, w: &World) -> f32;
    fn begin(&self, v: &mut Villager, w: &mut World);
}
```

Scoring curves:
- **Eat:** `(1.0 - hunger)^2` — ramps up sharply as hunger empties. Gate on food being available.
- **Sleep:** `(1.0 - energy)^2`, multiplied by a night-time bonus.
- **Work:** flat ~0.4 baseline, scaled by job priority and inversely by distance to the job site.
- **Socialize:** `(1.0 - social)^1.5`, gated on another villager being within ~8 tiles.
- **Wander:** constant 0.05 — the floor that prevents standing still.

Distance factor for any action requiring travel: `1.0 / (1.0 + dist * 0.05)`.

### Pathfinding

A* over the tile grid via the `pathfinding` crate. 8-directional movement, diagonal cost 1.414, no corner-cutting through impassable diagonals.

Cache the computed path on the villager. Recompute only when the path is blocked (a building was placed on it) or the target moved. On path failure, fall back to Idle and retry after a short cooldown — never spin recomputing every tick.

Guard against pathological cases: cap A* node expansion (~4000 nodes) and abandon the path if exceeded.

### Job board

```rust
pub struct Job {
    pub id: JobId,
    pub kind: JobKind,          // TendCrops | Haul | Construct | Gather
    pub site: BuildingId,
    pub tile: (i32, i32),       // where the worker stands
    pub priority: u8,
    pub claimed_by: Option<VillagerId>,
}
```

Buildings advertise jobs when complete. Villagers claim the highest `priority / (1 + distance)` unclaimed job matching their suitability (traits). Jobs release on villager death, reassignment, or building demolition. A job claimed by a villager who then goes to eat stays claimed — release only on explicit abandonment.

---

## 8. Economy

**Resources:** `wood`, `stone`, `grain`, `food`, `gold`.

**Gathering:** villagers with Gather jobs harvest from resource nodes (forest tiles → wood, rock tiles → stone). Nodes deplete and regrow slowly.

**Production chains:** the depth of the sim. Defined in `buildings.json` as recipes:

```json
"recipe": {
  "inputs": { "grain": 2 },
  "outputs": { "food": 3 },
  "ticks": 150
}
```

Mill: grain → flour. Bakery: flour → bread (food). Each step needs a worker and input stock hauled in.

**Storage:** buildings with a `stores` field hold inventory up to `capacity`. Global `ResourceTotals` is the sum across storage buildings — compute it each tick for the snapshot rather than tracking it separately, to avoid desync.

**Hauling:** the connective tissue. Production buildings output to their own small buffer; haulers move goods to storage, and inputs from storage to production buildings. Without hauling, chains stall — this is the system that makes the economy feel alive.

---

## 9. IPC contract

### Frontend → Rust (commands)

```rust
#[tauri::command] fn new_world(seed: Option<u64>, width: usize, height: usize) -> Result<WorldInit, String>
#[tauri::command] fn get_terrain() -> Vec<u8>                    // width*height bytes
#[tauri::command] fn place_building(kind: String, x: i32, y: i32, rotation: u8) -> Result<PlacementResult, String>
#[tauri::command] fn validate_placement(kind: String, x: i32, y: i32, rotation: u8) -> PlacementValidity
#[tauri::command] fn demolish(entity_id: u32) -> Result<(), String>
#[tauri::command] fn plant_crop(kind: String, x: i32, y: i32) -> Result<(), String>
#[tauri::command] fn set_speed(speed: u8)
#[tauri::command] fn set_viewport(x: f32, y: f32, w: f32, h: f32)
#[tauri::command] fn assign_job(villager_id: u32, building_id: u32) -> Result<(), String>
#[tauri::command] fn get_villager_detail(id: u32) -> Result<VillagerDetail, String>
#[tauri::command] fn get_catalog() -> Catalog                     // buildings.json + crops.json
#[tauri::command] fn save_game(path: String) -> Result<(), String>
#[tauri::command] fn load_game(path: String) -> Result<WorldInit, String>
```

All commands push a `SimCommand` onto the mpsc channel. Ones needing a response (`validate_placement`, `get_villager_detail`) include a `oneshot::Sender` in the command payload.

`validate_placement` is called on every mouse-move during build mode — keep it cheap. Consider caching the last result and only revalidating when the hovered tile changes.

### Rust → Frontend (events)

`app_handle.emit("tick", &snapshot)` each tick. Frontend subscribes with `listen("tick", ...)`.

```rust
#[derive(Serialize)]
pub struct TickSnapshot {
    pub tick: u64,
    pub clock: ClockView,             // day, hour, season, year, speed
    pub villagers: Vec<VillagerView>, // viewport-culled
    pub buildings: Vec<BuildingView>, // viewport-culled
    pub crops: Vec<CropView>,         // viewport-culled
    pub resources: ResourceTotals,
    pub dirty_tiles: Vec<TileDelta>,
    pub events: Vec<SimEvent>,
}

#[derive(Serialize)]
pub struct VillagerView { pub id: u32, pub x: f32, pub y: f32, pub state: u8, pub facing: u8 }

#[derive(Serialize)]
pub struct BuildingView { pub id: u32, pub kind: u8, pub x: i32, pub y: i32, pub rot: u8, pub state: u8, pub progress: u8 }

#[derive(Serialize)]
pub struct CropView { pub id: u32, pub x: i32, pub y: i32, pub kind: u8, pub stage: u8 }

#[derive(Serialize)]
pub struct TileDelta { pub idx: u32, pub terrain: u8, pub tilled: bool, pub watered: bool }

#[derive(Serialize)]
pub enum SimEvent {
    BuildingComplete { id: u32 },
    CropReady { id: u32 },
    VillagerBorn { id: u32, name: String },
    VillagerDied { id: u32, cause: String },
    ResourceCritical { kind: String },
}
```

**Snapshot rules — these are the performance contract:**

1. **Terrain is sent once**, via `get_terrain()`. Never in the tick payload. Changes arrive as `dirty_tiles` only.
2. **Viewport-cull everything.** Only entities within the camera bounds plus a 4-tile margin go in the snapshot. `set_viewport` keeps Rust informed.
3. **Enums serialize as bytes**, not strings. `state: u8`, not `state: "Working"`.
4. **Detail is on-demand.** Full needs/inventory/job history for the villager panel comes from `get_villager_detail(id)`, never the tick payload.
5. `dirty_tiles` is drained each tick — the world clears it after snapshotting.

---

## 10. Frontend rendering

### Canvas stack

Three stacked `<canvas>` elements, absolutely positioned, redrawn at different frequencies:

| Layer | Redraw when | Contents |
|---|---|---|
| Terrain | On load; on dirty tiles | Tile colors/sprites |
| Entities | Every frame | Buildings, crops, villagers |
| Overlay | Every frame in build mode | Placement ghost, selection, hover |

Terrain is pre-rendered to an **offscreen canvas** at full world size once, then blitted to the visible terrain canvas with the camera transform each frame via `drawImage` with source rect. Dirty tiles patch the offscreen canvas in place — never redraw the whole thing.

### Camera

```ts
const worldToScreen = (wx: number, wy: number): [number, number] =>
  [(wx - camX) * zoom, (wy - camY) * zoom];

const screenToWorld = (sx: number, sy: number): [number, number] =>
  [sx / zoom + camX, sy / zoom + camY];

const tileAt = (sx: number, sy: number): [number, number] => {
  const [wx, wy] = screenToWorld(sx, sy);
  return [Math.floor(wx / TILE), Math.floor(wy / TILE)];
};
```

Apply with `ctx.setTransform(zoom, 0, 0, zoom, -camX * zoom, -camY * zoom)`. Zoom clamped 0.25–4.0. Pan via middle-drag or edge-scroll; zoom via wheel, anchored to the cursor position (not the viewport center — anchor-to-cursor is what makes zoom feel right).

Call `set_viewport` on the Rust side whenever the camera settles (debounce ~100ms).

### Interpolation

The single thing that separates a smooth sim from a stuttering one.

```ts
// Keep the last two snapshots
const alpha = Math.min((performance.now() - currSnapshotTime) / TICK_MS, 1);
const x = prev.x + (curr.x - prev.x) * alpha;
const y = prev.y + (curr.y - prev.y) * alpha;
```

Match villagers across snapshots by `id`. New villagers (no `prev` entry) render at their current position with no interpolation. Removed villagers vanish. When paused, freeze alpha at 1.0.

### Build mode

1. User selects a building in `BuildMenu`.
2. On mouse-move, compute `tileAt`, call `validate_placement` (debounced/cached per tile).
3. Draw the ghost on the overlay canvas — green tint if valid, red if not, showing the full footprint.
4. On click, call `place_building`. On success the next tick's snapshot contains the new building in `UnderConstruction` state.
5. `R` rotates. `Esc` exits build mode.

---

## 11. Save/load

Rust owns it entirely. `serde` derive on `World` and everything it contains.

- **Format:** `bincode` for release saves (compact, fast). Add a `--json-saves` dev flag that swaps to `serde_json` for human-readable debugging.
- **Versioning:** every save starts with `{ version: u32, seed: u64 }`. On load, reject mismatched versions with a clear error rather than deserializing garbage.
- **What's saved:** the entire `World` — tiles, entities, clock, resources, job board, RNG state. Restoring RNG state matters for determinism.
- **What's not saved:** camera position, UI state, cached paths (recompute on demand).
- **Autosave:** every in-game day, rotating through 3 slots.

After `load_game`, the frontend must re-fetch terrain and rebuild its offscreen canvas — return `WorldInit` from the command so it can do this in one round trip.

---

## 12. Implementation milestones

Each milestone ends runnable. Do not start the next until the current one demos.

### M1 — Prove the pipe
- `World { tiles: Vec<u8>, width, height }` with a hardcoded checkerboard.
- `get_terrain()` returns the byte array.
- Frontend fetches once, draws colored rects to the terrain canvas.
- Sim thread ticking at 20Hz via `std::thread::spawn`, emitting `TickSnapshot { tick, villagers: [one fake villager moving in a circle] }`.
- Frontend listens, interpolates, draws a dot.

**Done when:** a dot moves smoothly across colored tiles. This answers threading, IPC, serialization, interpolation, and camera in one shot.

### M2 — Terrain generation
- `noise` crate, elevation + moisture, thresholded to the `Terrain` enum.
- Seeded and reproducible.
- Offscreen canvas pre-render + camera blit.
- Pan and zoom with cursor-anchored wheel zoom.

**Done when:** a recognizable island with coastline, forest, and mountains, pannable at 60fps.

### M3 — Object placement
- `buildings.json` loaded and validated at startup; `get_catalog()` exposes it.
- `BuildMenu` UI, ghost preview, `validate_placement`, `place_building`.
- Buildings appear in the snapshot and render on the entity canvas.
- Demolish with refund.

**Done when:** you can click to place a hut on grass, get rejected on water, and demolish it.

### M4 — One villager, FSM, pathfinding
- A* over the grid, `pathfinding` crate.
- Single villager, `AgentState` FSM, `MovingTo` → `Idle`.
- Right-click a tile → villager walks there, routing around water and buildings.
- Path invalidation when a building blocks the route.

**Done when:** the villager navigates around an obstacle you place in its path mid-walk.

### M5 — Needs and a single job
- `Needs` struct with decay.
- Farm building advertising a `TendCrops` job.
- Job board, claiming, `Working` state.
- `VillagerPanel` via `get_villager_detail`.

**Done when:** the villager autonomously walks to the farm and works, and you can watch hunger tick down in the panel.

### M6 — Clock and crops
- `Clock` with day/season/year, speed controls (pause/1x/2x/3x).
- `crops.json`, planting, growth stages driven by ticks.
- Seasonal gating, watering.
- Crops render by stage on the entity canvas.

**Done when:** wheat planted in spring visibly grows through its stages and stalls in winter.

### M7 — Utility AI
- Refactor `AgentState` transitions to the `Action` trait and scoring.
- Eat, Sleep, Work, Socialize, Wander.
- Hysteresis to prevent oscillation.
- Multiple villagers (start with 5).

**Done when:** villagers interleave working, eating, and sleeping without being told, and don't flicker between actions.

### M8 — Economy and production chains
- Resource nodes, gathering.
- Recipes, mill → bakery chain.
- Storage buildings, capacity.
- Hauling jobs.
- `ResourceBar` UI.

**Done when:** grain harvested from a farm is hauled to a granary, milled, baked, and eaten — with no manual intervention.

### M9 — Population and progression
- Housing, `houses` capacity.
- Births/deaths, `VillagerBorn`/`VillagerDied` events.
- Character creation: name, traits, starting background.
- Tech/unlock tree gating buildings.

**Done when:** a village grows from 5 to 15 villagers on its own and unlocks a new building tier.

### M10 — Persistence and polish
- `bincode` save/load, versioning, autosave rotation.
- Weather.
- Event log UI.
- Camera polish, hover tooltips, selection highlight.

**Done when:** you can save a 50-villager village, quit, reload, and it resumes identically.

---

## 13. Performance targets & traps

**Targets:** 60fps render with 100 villagers on a 128×128 map. Tick budget ≤ 5ms at 20Hz. Snapshot payload ≤ 20KB/tick.

**Traps, in the order you'll hit them:**

1. **Full-world snapshots.** The single biggest risk in this architecture. Viewport-cull from M3 onward, before it becomes a habit.
2. **Serializing enums as strings.** Bloats payloads 5–10x. Bytes only.
3. **Redrawing terrain every frame.** Offscreen canvas + blit, from M2.
4. **Pathfinding every tick.** Cache paths, recompute only on invalidation, cap node expansion.
5. **No interpolation.** Villagers stutter at 20Hz. Build it in M1 so it's never missing.
6. **`validate_placement` on every mouse-move event.** Cache per tile.
7. **Job thrashing.** Villagers dropping and reclaiming jobs each tick. Hysteresis in M7.
8. **JSON for large saves.** `bincode` for release.

---

## 14. Testing

- **Unit:** terrain thresholds, A* on hand-built grids (including no-path cases), need decay math, utility scoring curves, recipe resolution.
- **Determinism:** same seed + same command sequence → identical world hash after N ticks. This is the highest-value test in the project; it catches nondeterminism from `HashMap` iteration order early. Use `BTreeMap` or sorted iteration anywhere sim state depends on order.
- **Save round-trip:** save → load → save, byte-identical. Verify generational IDs survive.
- **Headless sim:** run 10,000 ticks with no frontend, assert no panics and no starvation deadlock. Cheap to run in CI, catches economy stalls.
