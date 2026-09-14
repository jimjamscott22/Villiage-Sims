# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

VillageSim: a Tauri 2 desktop village simulator. An authoritative Rust simulation
(`src-tauri/`) runs on its own thread at 20Hz and streams snapshots to a thin React + Canvas
renderer (`src/`), which holds no authoritative state and interpolates between ticks at 60fps.

Read `progress.md` first — it tracks milestone status and is updated every milestone. The full
design/roadmap lives in `docs/villagesim-spec.md`. `AGENTS.md` has Cursor-Cloud-specific run
notes (headless/browser-demo testing) that overlap with the gotchas below.

## Commands

```bash
npm install
npm run tauri dev      # full desktop app (Rust sim + webview) — needs a display + WebKitGTK
npm run dev            # browser-only dev server at :5173, using the deterministic browser-demo
                        # transport instead of the real sim (works headless)

npm test                                              # Vitest, frontend
npm run build                                         # tsc -b && vite build
cargo test --manifest-path src-tauri/Cargo.toml --lib # Rust sim tests
cargo check --manifest-path src-tauri/Cargo.toml      # Rust typecheck

npm run art            # regenerate public/art/ from tools/genart/ (see Art section)
```

Single test:
```bash
npx vitest run src/state/pathfind.test.ts
cargo test --manifest-path src-tauri/Cargo.toml --lib social::tests::mutual_gain_while_stopped
```

## Architecture

**The split is the whole design.** Rust owns every tile, villager, need, job, and the clock.
The webview can be rebuilt entirely from one snapshot at any moment. They talk over two
channels, never a shared `Arc<Mutex<World>>`:

- **Commands in:** `std::sync::mpsc::Sender<SimCommand>` (`src-tauri/src/sim/commands.rs`) —
  frontend intents are queued and drained at the top of each tick inside `World::handle_command`.
- **Snapshots out:** `tokio::sync::watch::Sender<TickSnapshot>` (`src-tauri/src/snapshot.rs`) —
  the frontend only ever sees the latest snapshot; slow readers can't back up the queue.

This keeps tick ordering deterministic: same seed + same command sequence → identical world.
The sim loop (`src-tauri/src/sim/mod.rs::start_simulation`) drains commands, advances the world
if unpaused, and always publishes a snapshot (even paused, so plant/demolish/UI actions still
reach the frontend).

**Snapshot rules are the performance contract** — do not regress these when touching
`snapshot.rs` or adding new state to the tick payload:
1. Terrain is sent once via `get_terrain()`, never in a tick. Tile changes arrive as
   `dirty_tiles` deltas only.
2. Everything is viewport-culled (`set_viewport`) — only entities near the camera go in the
   snapshot.
3. Enums serialize as bytes (`state: u8`), not strings.
4. Per-entity detail (full needs, inventory, job history) is fetched on demand via
   `get_villager_detail`, never embedded in the tick payload.
5. The chronicle (`src-tauri/src/sim/chronicle.rs`) follows the same rule: the snapshot only
   carries `chronicleSeq`; the frontend refetches via `get_chronicle` when it changes. Never
   accumulate chronicle events from tick payloads — the `watch` channel drops intermediate ticks.

**Rendering** (`src/render/`): three stacked canvases (terrain / entities / overlay), each
redrawn only as often as needed. Terrain is pre-rendered once to an offscreen buffer and
blitted with the camera transform (`camera.ts`); dirty tiles patch that buffer in place.
Villager positions are interpolated between the last two snapshots by an `alpha` factor derived
from wall-clock time vs. tick interval — this is what keeps a 20Hz sim looking smooth at 60fps.
Speed controls (Pause/1x/2x/3x) scale the tick *interval*, never tick content.

**Villager AI** (`src-tauri/src/sim/agents.rs`, `utility.rs`): needs (hunger/energy/social)
decay every tick; happiness is derived. Each decision tick scores candidate actions 0–1 via
non-linear curves (e.g. Eat ramps as `(1 - hunger)^2`) and a hysteresis margin (~0.15) prevents
flickering between near-tied actions. Newer behavior (social pairing in `sim/social.rs`, leisure
destinations in `sim/leisure.rs`) plugs into this same scoring/decision loop rather than
replacing it.

**Data-driven content**: buildings and crops are JSON (`src-tauri/data/buildings.json`,
`crops.json`), loaded and validated at startup, exposed via `get_catalog()`. Adding a building
or crop should never require touching gameplay code. A building's `kind` is its **index** in
`buildings.json` and saves store that index — append new buildings, never insert or reorder.

**Browser-demo parity** (`src/state/demoWorld.ts` + `demo*.ts` siblings): when not running
inside Tauri, the frontend uses a deterministic in-memory transport that mirrors Rust sim
behavior (terrain, catalog, unlocks, weather, chronicle, and now social/leisure) closely enough
to be tested headlessly. It intentionally does **not** simulate births/deaths. Any change to
sim rules, the building/crop catalog, or persisted state generally needs a matching change in
the demo transport, or the two drift. Deterministic browser-smoke hooks are exposed on
`window`: `advanceTime(ms)` and `render_game_to_text()`; the demo timer pauses when the URL has
`?test=1` so time only advances via `advanceTime`.

**Persistence** (`src-tauri/src/persist.rs`): versioned `bincode` saves (`SAVE_VERSION`), header
= magic + version + seed. Loading an older version decodes through a frozen legacy
representation (see `sim::world::legacy_v3`) and converts it into the current `World` — old
saves must keep loading after the layout changes. Camera/UI state and cached paths are not
saved.

## Non-obvious gotchas

- `vite.config.ts` pins `build.target` to `es2020`, not the Tauri template default
  (`safari13`) — esbuild in Vite 8 can't lower destructuring to `safari13`, which breaks
  `npm run build`. Do not revert this.
- Rust edition is 2024 (`rust-version = "1.85"` in `Cargo.toml`) — requires a current toolchain.
- Vitest runs in a **Node** environment (no jsdom). Tests must not touch `document`, `window`,
  `Image`, or canvas contexts — keep pure logic (e.g. `planTile`, `cellRect`) separate from
  painters (`bakeTerrain`, `drawCell`) so it stays testable.
- The chronicle has two serde forms: `ChronicleBody` (persisted, bincode) must keep serde's
  default externally-tagged representation because bincode isn't self-describing and can't
  handle `#[serde(tag = "...")]`; `ChronicleBodyView` (JSON wire type to the frontend) does use
  `#[serde(tag = "kind")]`. Don't add a tag attribute to `ChronicleBody` — it breaks save/load.
- `World.unlocked` is seeded from `satisfied_unlocks()` in `World::generate()` — otherwise a new
  village narrates its own starting unlocks on tick one.
- App icons in `src-tauri/icons/` are required by `generate_context!` (build fails without
  `icon.png`); regenerate via `npm run tauri icon app-icon.png`.

## Art pipeline

World/UI art is generated, not hand-drawn binary assets. Sources live in `tools/genart/` as
declarative pixel data + material recipes; the generator rasterizes sprite sheets into
`public/art/` (`tiles.png`, `entities.png`, `atlas.json`), which are **committed** so `npm run
dev` works without running the generator. After changing anything under `tools/genart/`, run
`npm run art` — a drift test (`tools/genart/genart.test.ts`) regenerates the atlas and compares
decoded pixels against the committed output (not raw PNG bytes, since zlib output varies by
Node version) and fails if they diverge. Only the 29 colors in `tools/genart/palette.ts` may
appear in generated art; the rasterizer throws otherwise. If the atlas fails to load at runtime,
rendering falls back to flat colors rather than breaking.
