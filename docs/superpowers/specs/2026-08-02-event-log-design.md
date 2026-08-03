# VillageSim Event Log — Village Chronicle

## Scope

Give the player a readable, persistent record of what the village has done. Six kinds of milestone
are recorded by the Rust sim into a capped ring buffer, saved with the world, and displayed in a
collapsible drawer beneath the map. Clicking an entry moves the camera to its subject.

This replaces the existing `SimEvent` / `TickSnapshot.events` mechanism, which is emitted by the
sim, dropped by the transport, and consumed by nothing.

**Done when:** you can play a village through a season, open the drawer, read the story of what
happened in order, click a birth to jump to the villager who was born, save, reload, and find the
history intact.

This closes the event-log item of Milestone 10.

## Decisions (locked)

| Topic | Choice |
|---|---|
| Audience | Player-facing chronicle, not a developer firehose |
| Source of truth | Rust. `World.chronicle`, serialized with the save |
| Sync mechanism | Monotonic `chronicleSeq` in every tick snapshot; frontend refetches the whole buffer when it changes |
| Delta fetching | None. Full refetch on change — ~12KB, a few times a minute |
| Capacity | 200 entries, oldest evicted |
| Persistence | Yes. `SAVE_VERSION` 1 → 2; v1 saves rejected by the existing error path |
| Event set | VillagerBorn, VillagerDied, BuildingComplete, BuildingUnlocked, HarvestReady, SeasonTurned |
| Harvest spam | Coalesced at insert: same building + same in-game day increments a count |
| Placement | Full-width collapsible drawer below the canvas |
| Collapsed height | ~28px, showing the newest entry |
| Camera focus | `focus: Option<(i32, i32)>` on the entry; non-null rows are clickable |
| Warnings | Out of scope — deferred until M11 gives the player something to do about them |
| Styling | Plain Tailwind matching current HUD. Art Phase 3 restyles the whole HUD later |

## Why the sim owns the log

The delivery path is sim thread → `watch::send_replace` → async forwarder → `emit("tick")`
(`src-tauri/src/lib.rs:14-23`). A `watch` channel only guarantees delivery of the *latest* value.
If the forwarder is descheduled for a single tick — routine at 3× speed, where ticks are ~16ms —
that snapshot is skipped silently.

Positions tolerate this, which is why `watch` was the right choice. Discrete events do not.
`World.events` is cleared at the top of every `advance()` (`src-tauri/src/sim/world.rs:250`) and
carried only in that one tick's snapshot, so a skipped snapshot loses its events permanently.

Accumulating events frontend-side would therefore produce a log that quietly drops entries, and
one that could not persist across save/load or survive a page reload. Hence: Rust owns the buffer,
and the snapshot carries only a revision number.

## 1. Storage — `src-tauri/src/sim/chronicle.rs` (new)

A new module rather than more of `world.rs`, which is already 3123 lines. The buffer is
self-contained and unit-testable without constructing a `World`.

```rust
pub const CHRONICLE_CAP: usize = 200;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChronicleEntry {
    /// Unique and monotonic. Doubles as the React key.
    pub seq: u64,
    pub tick: u64,
    /// In-game date captured at emission.
    pub day: u32,
    pub season: u8,
    pub year: u32,
    /// Tile to centre the camera on when clicked. `None` renders a non-clickable row.
    pub focus: Option<(i32, i32)>,
    pub body: ChronicleBody,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ChronicleBody {
    VillagerBorn { id: u32, name: String },
    VillagerDied { id: u32, name: String, cause: String },
    BuildingComplete { id: u32, building: String },
    BuildingUnlocked { building: String },
    HarvestReady { site: u32, building: Option<String>, count: u32 },
    SeasonTurned { season: u8, year: u32 },
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct Chronicle {
    entries: VecDeque<ChronicleEntry>,
    next_seq: u64,
}
```

`focus` is hoisted out of the variants so the drawer tests one field rather than matching six body
types to decide clickability.

The payload field is named `building`, **not** `kind`, because the *wire* form of this enum is
tagged `#[serde(tag = "kind")]` and a variant field of the same name would collide with the
discriminant. `building` holds a `BuildingDef` id such as `"mill"`, resolved to a display name
through the catalog.

### Storage form vs wire form

`ChronicleBody` itself is **not** internally tagged. Serde's `#[serde(tag = "...")]` representation
requires a self-describing format, and `bincode` is not one — an internally-tagged enum inside the
whole-`World` bincode dump fails to serialize. The stored enum therefore uses serde's default
(externally tagged) representation.

The frontend still needs the internally-tagged shape for a clean TypeScript discriminated union, so
the JSON form is a separate view type, exactly as the codebase already does for
`Clock`/`ClockView`, `Crop`/`CropView`, `Villager`/`VillagerView` and `Building`/`BuildingView`:

```rust
/// JSON wire form. Serialize only — never persisted.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChronicleEntryView { /* same fields as ChronicleEntry */ }

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ChronicleBodyView { /* same variants as ChronicleBody */ }
```

`get_chronicle` returns `Vec<ChronicleEntryView>`. `ChronicleEntry::view()` converts. The storage
type carries `Serialize + Deserialize`; the view type carries `Serialize` only, which makes the
one-way direction structural rather than conventional.

`VillagerDied` carries the villager's **name**, not just an id: the villager is removed from the
store before the drawer renders, so the frontend cannot resolve it. `BuildingComplete` and
`HarvestReady` carry `building` for the same reason, plus a stronger one — buildings are
**viewport-culled** out of the tick snapshot, so an id alone is unresolvable whenever the subject is
off-screen, which for an old log entry is most of the time. Every entry must be renderable from its
own contents plus the catalog.

### `Chronicle::push`

```rust
pub fn push(&mut self, clock: &Clock, focus: Option<(i32, i32)>, body: ChronicleBody)
```

`day`, `season`, and `year` are read off the `Clock` and stored on the entry; `season` is flattened
to `u8` via the existing `Season::as_u8`.

Behaviour:

`tick` is read from `Clock::tick` rather than passed separately.

1. **Coalesce.** If `body` is `HarvestReady { site, count, .. }` and the back entry is also
   `HarvestReady` for the same `site` with the same `day`/`season`/`year`, add `count` to the
   existing entry, assign it a fresh `seq` from `next_seq`, and return. Reassigning the seq is what
   makes the frontend notice the count changed.
2. **Append** otherwise, taking `seq` from `next_seq`.
3. **Evict** from the front while `entries.len() > CHRONICLE_CAP`.

`next_seq` increments on every mutation, so it doubles as the buffer's revision counter. That single
value is what the snapshot exposes.

### Accessors

- `Chronicle::seq(&self) -> u64` — returns `next_seq`, for the snapshot.
- `Chronicle::entries(&self) -> &VecDeque<ChronicleEntry>` — for the `get_chronicle` command.

## 2. Event set and emission points

| Entry | Emission point | Focus | Notes |
|---|---|---|---|
| `VillagerBorn` | `world.rs:323` | Spawn tile | Replaces the existing `SimEvent` push |
| `VillagerDied` | `world.rs:295` | Death tile | Capture `name` **before** removing the villager |
| `BuildingComplete` | `world.rs:617` | Building origin | Where `progress_ticks` reaches `build_ticks` |
| `HarvestReady` | `world.rs:1913` | Farm origin, else crop tile | Replaces the per-crop event; `Crop.ready_emitted` already guards re-emission. See the resolution rules below |
| `SeasonTurned` | `Clock::roll_day`, `clock.rs:181` | `None` | Fires on season change; year rollover implies one |
| `BuildingUnlocked` | End of `World::advance()` | `None` | Requires the new Rust-side unlock check below |

`Crop` has no owning-building field (`crops.rs:39-48`), so `HarvestReady` resolves its farm from
`tiles[idx].occupant` at the crop's tile:

- **Occupied** — `site` is the building's id, `building` is its def id, focus is the building
  origin. Renders as `"3 crops ready at Farm Plot"`.
- **Unoccupied** — `site` is the crop's id, `building` is `None`, focus is the crop tile. Renders as
  `"3 crops ready"`. Coalescing then groups per crop rather than per farm, which is correct: there
  is no farm to group under.

`site` is deliberately not named `building`, since it holds a crop id in the second case. It is used
only as a coalescing identity and a focus anchor.

`Clock::roll_day` currently returns nothing and mutates `season`/`year` internally. Change it to
report whether the season changed so `advance()` can push the entry; `Clock::advance` already
returns a day-boundary bool, so this follows the existing shape.

### Unlock evaluation moves to Rust

Unlock gating currently lives in the frontend — `BuildMenu.tsx:82` reads `unlockConditions` from the
catalog and evaluates `minPopulation` / `requiresBuilding` itself. Rust cannot emit a
`BuildingUnlocked` entry without that check, and frontend-side gating drifts from the architecture
rule that the frontend holds no authoritative state.

Add to `World`:

- `unlocked: BTreeSet<String>` — persisted, the set of building ids unlocked so far.
- `satisfied_unlocks(&self) -> BTreeSet<String>` — evaluates `min_population` and
  `requires_building` for every catalog entry. A building with no `unlock_conditions` is always
  satisfied.

At the end of `advance()`, diff `satisfied_unlocks()` against `unlocked`; push one
`BuildingUnlocked` per newly-present id, then store the new set. `BTreeSet` rather than `HashSet`
for deterministic iteration order, per the determinism warning in `docs/villagesim-spec.md` §14.

**`unlocked` must be seeded at world construction**, not left empty. `hut` and `farm` have no
`unlock_conditions` and are therefore satisfied from tick zero; starting from an empty set would
make the first tick emit "Hut unlocked" and "Farm Plot unlocked" into a brand-new village's
chronicle. `World::generate` sets `unlocked = satisfied_unlocks()` once the world is fully built,
so the opening state is silent.

Note this also fixes a live bug: `BuildMenu.tsx:82-83` evaluates **only** `minPopulation` and
ignores `requiresBuilding` entirely, so the mill currently unlocks on population alone without its
granary. Moving the check into `satisfied_unlocks`, which evaluates both, corrects it.

`TickSnapshot` gains `unlocked: Vec<String>` so `BuildMenu` reads the authoritative set instead of
recomputing it. This is a small payload (at most five short ids today) and removes the duplicated
logic.

### Removal

`SimEvent` and `TickSnapshot.events` are deleted, along with `World.events` and the two
`self.events.clear()` calls. Nothing consumes them, they are the lossy path, and keeping both would
mean two parallel event systems.

## 3. IPC contract

```rust
// sim/commands.rs
GetChronicle { reply: oneshot::Sender<Vec<ChronicleEntry>> }

// commands.rs
#[tauri::command]
fn get_chronicle(state: State<AppState>) -> Result<Vec<ChronicleEntry>, String>
```

Registered in the `generate_handler!` list in `lib.rs`.

`TickSnapshot` changes:

- **adds** `chronicle_seq: u64` (serialized `chronicleSeq`)
- **adds** `unlocked: Vec<String>`
- **removes** `events: Vec<SimEvent>`

Net effect on payload size is a reduction.

## 4. Frontend

Split so the logic is testable under Vitest's Node environment — no jsdom is installed, so tests
must not touch `document`, `window`, or canvas contexts (`AGENTS.md`).

### `src/state/chronicle.ts` (new, pure)

- `formatEntry(entry: ChronicleEntry, catalog: Catalog | null): string` — display text per variant.
  Building `kind` strings resolve to display names through the catalog, falling back to the raw id
  when the catalog is absent or the id is unknown. Examples: `"Bram died of starvation"`,
  `"3 crops ready at Farm Plot"`, `"Mill unlocked"`. The catalog is fetched once at startup and is
  never viewport-culled, so this lookup always succeeds in practice.
- `needsDivider(prev: ChronicleEntry | null, entry: ChronicleEntry): boolean` — true when `prev` is
  null or the season/year differs, marking where a `"Spring · Year 2"` rule is drawn.
- `formatDivider(entry: ChronicleEntry): string`.

No DOM access. This module holds all the tested logic.

### `src/ui/ChronicleDrawer.tsx` (new, presentational)

Props: `entries`, `catalog`, `collapsed`, `onToggle`, `onFocus`.

- Collapsed: ~28px strip showing `formatEntry` of the newest entry plus a toggle affordance.
- Expanded: scrollable list, oldest at the top, newest at the bottom, with season dividers.
  Auto-scrolls to the bottom on new entries unless the user has scrolled up.
- Rows with `focus != null` are buttons calling `onFocus(entry.focus)`; rows without are plain text.
- Empty state: `"Nothing has happened yet."`
- Collapsed/expanded is local component state defaulting to collapsed, and is not persisted — UI
  state is explicitly excluded from saves (`docs/villagesim-spec.md` §11).

### `src/App.tsx`

Holds `entries: ChronicleEntry[]` and `lastSeq: number`. In `onSnapshot`, when
`snapshot.chronicleSeq !== lastSeq`, call `transport.getChronicle()`, replace `entries`, and store
the new seq. That is the entire sync mechanism — a dropped snapshot self-heals because the next one
carries a seq that still differs from what the frontend holds.

Renders `<ChronicleDrawer>` below the `<Canvas>`, inside the existing flex column.

### Camera focus

`src/render/camera.ts` has `centerOnWorld` but nothing for a specific tile. Add
`Camera.centerOnTile(tileX, tileY, viewWidth, viewHeight)`, converting tile → world pixels via
`tileSize` and reusing the existing centring maths.

`Canvas` gains a `focusTile: [number, number] | null` prop and calls `centerOnTile` when it changes.
`App` passes the tile from the drawer's `onFocus`.

### `src/ui/BuildMenu.tsx`

Replace the local unlock evaluation at line 82 with a lookup against the `unlocked` list from the
snapshot. The `unlockConditions` fields stay in the catalog types for display purposes ("Requires
population 6"), but no longer drive the gate.

## 5. Browser-demo parity

`src/state/demoWorld.ts` must mirror the chronicle exactly: same 200 cap, same coalescing rule, same
seq semantics, same six emission points, plus `getChronicle()` on the transport and `chronicleSeq` /
`unlocked` in its snapshots.

This is not optional. The browser-demo transport is the only way any of this is verifiable headless,
and it is how the drawer gets looked at without a desktop webview (`AGENTS.md`).

## 6. Persistence

`SAVE_VERSION` 1 → 2 in `src-tauri/src/persist.rs`.

`Chronicle` and `World.unlocked` are plain serde types, so they ride along in the existing
whole-`World` bincode dump with no format work. Existing slot-1 saves are rejected by the current
version-mismatch error path.

A full 200-entry buffer adds roughly 15–20KB to a save, against a 64MB cap.

## 7. Testing

### Rust

`chronicle.rs`:
- eviction holds the buffer at `CHRONICLE_CAP`
- two harvests, same building, same day → one entry with `count == 2`
- two harvests, same building, different day → two entries
- coalescing still advances `seq`
- `seq` is strictly increasing across all operations

`world.rs`:
- each of the six emission points produces exactly one entry
- the death entry carries the villager's name
- unlock diffing emits one entry per building, not one per tick while the condition holds
- `satisfied_unlocks` treats a building with no conditions as unlocked

`persist.rs`:
- chronicle and `unlocked` survive a save → load → save round trip
- a `SAVE_VERSION` 1 payload is rejected with a clear error

### TypeScript

`src/state/chronicle.test.ts`:
- `formatEntry` for all six variants, including the catalog-absent fallback
- `needsDivider` at a season boundary, a year boundary, and the first entry
- pluralisation: `"1 crop ready"` vs `"3 crops ready"`

`src/state/snapshot.test.ts`:
- updated for the removal of `events`
- a `chronicleSeq` change triggers exactly one `getChronicle` call against a mock transport

## 8. File-by-file changes

**New**
- `src-tauri/src/sim/chronicle.rs`
- `src/state/chronicle.ts`
- `src/state/chronicle.test.ts`
- `src/ui/ChronicleDrawer.tsx`

**Modified — Rust**
- `src-tauri/src/sim/mod.rs` — declare `pub mod chronicle;`
- `src-tauri/src/sim/world.rs` — `chronicle` and `unlocked` fields; six emission points; `satisfied_unlocks`; remove `events`; snapshot fields; accessor
- `src-tauri/src/sim/clock.rs` — `roll_day` reports season change
- `src-tauri/src/sim/commands.rs` — `GetChronicle` variant
- `src-tauri/src/commands.rs` — `get_chronicle` handler
- `src-tauri/src/lib.rs` — register the handler
- `src-tauri/src/snapshot.rs` — delete `SimEvent`; add `chronicle_seq` and `unlocked`
- `src-tauri/src/persist.rs` — `SAVE_VERSION = 2`

**Modified — frontend**
- `src/state/types.ts` — replace `SimEvent` with `ChronicleEntry` / `ChronicleBody`; snapshot fields
- `src/state/transport.ts` — `getChronicle()`
- `src/state/demoWorld.ts` — mirror the chronicle
- `src/state/snapshot.ts` — drop the `events` passthrough
- `src/render/camera.ts` — `centerOnTile`
- `src/render/Canvas.tsx` — `focusTile` prop
- `src/App.tsx` — chronicle state, seq comparison, drawer, focus wiring
- `src/ui/BuildMenu.tsx` — read `unlocked` from the snapshot

**Docs**
- `progress.md` — M10 status
- `AGENTS.md` — drawer controls and the browser-demo note

## Out of scope

- Toast notifications over the canvas — a clean follow-up once the drawer proves itself
- `ResourceCritical`, starvation warnings, production-stall warnings — deferred with the rest of the
  warnings set until M11 makes them actionable
- Filtering, search, or category toggles in the drawer
- Autosave rotation — separate M10 item
- Pixel-art styling — Art Phase 3 restyles the HUD with 9-slice panels and will absorb the drawer

## Follow-ups this enables

The warnings set becomes worth building the moment M11 lands: once labour is scarce, "food running
out" and "construction stalled, no free workers" are entries the player can act on. The buffer,
sync, and drawer built here take them without change — only new `ChronicleBody` variants.
