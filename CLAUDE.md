# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project overview

VillageSim is a Tauri 2 desktop village simulator: an **authoritative Rust simulation**
(`src-tauri/`) owns all world state and streams 20 Hz snapshots to a **thin React + Canvas
renderer** (`src/`), which holds no authoritative state and interpolates between the last two
snapshots for smooth 60fps motion. Villagers are autonomous — a utility-AI scorer picks their
actions (Eat/Sleep/Work/Socialize/Wander) each tick; the player places buildings, plants crops,
and opens jobs but never commands villagers directly.

Full design/roadmap: `docs/villagesim-spec.md`. Current milestone status and handoff notes:
`progress.md` (check this first — updated every milestone). Architecture deep-dive with diagrams:
`README.md`.

**Status:** built through Milestone 9; Milestone 10 (persistence, weather, event log polish) is
in progress.

## Commands

```bash
npm install                                           # install JS deps
npm run dev                                           # browser-only demo at http://127.0.0.1:5173/
npm run tauri dev                                     # full desktop app + live Rust sim (needs a display)
npm test                                              # frontend unit tests (Vitest)
npm run build                                         # typecheck + Vite build
npm run art                                           # regenerate public/art/ from tools/genart/
cargo test --manifest-path src-tauri/Cargo.toml --lib # Rust simulation tests
cargo check --manifest-path src-tauri/Cargo.toml      # Rust typecheck
```

There is no lint script; `npm run build`'s `tsc -b` is the typecheck gate for the frontend.

### Browser-demo transport

`npm run dev` (outside Tauri) automatically falls back to a deterministic **browser-demo**
transport that reproduces island terrain + an orbiting villager, so the full
render/interpolation/camera pipeline is testable without a desktop webview. It mirrors traits,
unlock conditions, housing capacity, and the chronicle, but **does not implement births or
deaths** — population is static in the demo. Deterministic test hooks on `window`:
`advanceTime(ms)` and `render_game_to_text()` (the latter includes camera state `x`/`y`/`zoom`).
The demo timer pauses when the URL has `?test=1`, so time only advances via `advanceTime`.

The real desktop app (`npm run tauri dev` / `cargo run`) needs a display + WebKitGTK and won't
render headless — use the browser demo for headless verification and `cargo test --lib` /
`cargo check` for the Rust side.

## Architecture

```
src-tauri/            Rust — the authoritative simulation
  src/sim/            world, clock, agents, needs, jobs, pathfind, crops, buildings, utility
  src/snapshot.rs     sim state -> compact render view (viewport-culled)
  src/commands.rs     Tauri IPC handlers
  src/persist.rs      versioned binary save/load (SAVE_VERSION)
  data/                buildings.json, crops.json, traits.json (data-driven content)
src/                  React + Canvas — the renderer (no authoritative state)
  render/             three-layer canvas stack (terrain / entities / overlay), camera, draw code
  state/              snapshot handling, interpolation, IPC transport, browser-demo world
  ui/                 BuildMenu, ClockBar, ResourceBar, VillagerPanel, ChronicleDrawer
tools/genart/         declarative pixel-art sprite sources + rasterizer -> public/art/
docs/villagesim-spec.md  full specification & milestone plan
```

Key mechanics:

- **Commands in, snapshots out.** The sim thread owns the `World` exclusively behind a command
  channel (not a shared `Arc<Mutex<World>>>`), keeping tick ordering deterministic — same seed +
  same commands always produce the same village.
- **Interpolation.** Sim ticks every 50ms (20 Hz); renderer runs at 60fps and interpolates
  positions between the last two snapshots by an `alpha` factor. Speed controls (Pause/1x/2x/3x)
  scale the tick *interval*, never tick content, so fast-forwarding replays identical history.
  Never accumulate events from tick payloads — the `watch` channel drops intermediate snapshots
  (this is why the chronicle is fetched separately; see Gotchas).
- **Utility AI.** Every decision tick, each possible action is scored 0-1 by a non-linear curve
  (e.g. `Eat` ramps as `(1 - hunger)^2`, `Sleep` gets a night multiplier, `Work` falls off with
  distance); highest score wins, gated by a hysteresis margin so villagers don't flicker between
  near-tied actions.
- **Data-driven content.** New buildings/crops are added via `src-tauri/data/*.json` (footprint,
  cost, valid terrain, jobs; growth stages, seasons, yield) — no gameplay code changes required.
- **Population & progression (M9).** Population grows automatically under housing capacity (base
  + houses); traits (`traits.json`) render in `VillagerPanel`; a tech/unlock tree gates buildings
  in `BuildMenu` via `World::satisfied_unlocks()` (`min_population`, `requires_building`).
  `BuildMenu` only reads the authoritative `unlocked` list off the snapshot — it never
  re-evaluates conditions itself.
- **Chronicle.** A capped 200-entry event log (`World.chronicle`) persisted with the save. The
  tick snapshot carries only `chronicleSeq`; the frontend refetches via `get_chronicle` when it
  changes. Clicking an entry syncs the camera viewport to the sim first (before jumping), since
  `building_views()` viewport-culls buildings and a raw jump can land on an unrendered building.

## Testing

- Frontend: Vitest, run via `npm test`. **Runs in a Node environment — no jsdom.** Tests must not
  touch `document`, `window`, `Image`, or canvas contexts. Keep pure logic (`planTile`, `cellRect`)
  separate from painters (`bakeTerrain`, `drawCell`) so it stays testable.
- Rust: `cargo test --manifest-path src-tauri/Cargo.toml --lib`.
- Art: a drift test regenerates the atlas and compares *decoded pixels* (not raw PNG bytes, since
  `zlib` output varies by Node version) against the committed `public/art/`. Any change under
  `tools/genart/` requires re-running `npm run art` or `tools/genart/genart.test.ts` fails.

## Gotchas

- `vite.config.ts` pins `build.target` to `es2020` (not the Tauri template default `safari13`) —
  esbuild in Vite 8 can't lower destructuring to Safari targets, which breaks `npm run build`.
  `es2020` output still runs fine on the Tauri webviews. Do not revert this.
- `src-tauri/icons/icon.png` (and friends) are required by Tauri's `generate_context!` — the build
  fails without them. Regenerate via `npm run tauri icon app-icon.png`.
- Rust crate uses edition 2024 — requires toolchain `>= 1.85`.
- Default world is `128x128` tiles at 32px (`4096x4096` offscreen terrain cache). Keep terrain out
  of tick payloads; only `get_terrain` sends the full grid.
- Only the 29 colors in `tools/genart/palette.ts` may appear in generated art — the rasterizer
  throws otherwise. Native art is drawn at 16px against a 32px world tile (`ART_SCALE` = 2x).
- `src-tauri/src/sim/chronicle.rs` has two serde forms: `ChronicleBody` (persisted storage type)
  uses serde's default externally-tagged representation because bincode isn't self-describing and
  can't handle `#[serde(tag = "...")]`; `ChronicleBodyView` (JSON wire type to the frontend) uses
  `#[serde(tag = "kind")]`. **Never add a tag attribute to `ChronicleBody`** — it breaks save/load.
- `World.unlocked` is seeded from `satisfied_unlocks()` in `generate()` — otherwise a brand-new
  village narrates its own starting unlocks on tick one.
- Persistence (M10, in progress) reads/writes a single fixed save slot via `saveGame`/`loadGame`.
  Desktop writes a versioned binary file (`src-tauri/src/persist.rs`, `SAVE_VERSION`); the
  browser-demo keeps saves in-memory only.

## Workflow

- Check `progress.md` before starting work — it has the current milestone, what's done, and
  "Next up" for what's actually outstanding.
- Design docs and implementation plans for past/current milestones live under
  `docs/superpowers/specs/` and `docs/superpowers/plans/`.
- Verify changes with `npm test && npm run build` and
  `cargo test --manifest-path src-tauri/Cargo.toml --lib` before considering work done.
