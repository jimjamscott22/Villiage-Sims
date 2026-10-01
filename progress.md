# VillageSim progress & handoff

Last updated: 2026-09-30 (PR #56 demo storm cargo cleanup fixed and automated checks verified; live interaction testing remains unrun).

## Status

| Milestone | Status | PR |
|---|---|---|
| M1 — Prove the pipe | Complete on `main` | #1 |
| M2 — Terrain + camera | Complete on `main` | #2 |
| M3 — Building placement | Complete on `main` | #3 |
| M4 — Pathfinding + villager FSM | Complete on `main` | #5 (+ follow-up) |
| M5 — Needs and a single job | Complete on `main` | #8 |
| M6 — Clock and crops | Complete on `main` | #9 |
| M7 — Utility AI | Complete on `main` | [#10](https://github.com/jimjamscott22/Villiage-Sims/pull/10) (+ [#11](https://github.com/jimjamscott22/Villiage-Sims/pull/11) hysteresis fix) |
| M8 — Economy and production chains | Complete on `main` | [#12](https://github.com/jimjamscott22/Villiage-Sims/pull/12) |
| **M9 — Population and progression** | **Complete** | — |
| **M10 — Persistence and polish** | **Complete** | — |
| **M11 — Socializing and purposeful movement** | **Implemented** | — |
| Art — Phase 1 (pipeline + terrain) | Complete | [#21](https://github.com/jimjamscott22/Villiage-Sims/pull/21) |
| Art — Phase 2 (entities + y-sort) | Complete | — |
| **Art — Phase 3 (pixel HUD)** | **Complete** | — |

Roadmap source of truth: [`docs/villagesim-spec.md`](docs/villagesim-spec.md).

## What works today (M1–M11)

- Tauri 2 + React Canvas; Rust owns a 20 Hz sim thread; frontend interpolates at RAF.
- Seeded `128×128` island terrain (`noise`), pan/zoom camera, offscreen terrain blit.
- `buildings.json` catalog (hut/farm/granary/mill/bakery); BuildMenu; ghost preview; place/demolish with costs/refunds.
- Five villagers with utility AI (Eat/Sleep/Work/Socialize/Wander) + hysteresis; A* pathfinding.
- Paired conversations: villagers reserve a reachable meeting tile, stop together, restore the existing Social satisfaction meter over six seconds, and cool down afterward. Urgent needs, player orders, death, blocked routes, and demolished destinations release both participants.
- Purposeful leisure: free villagers visit reachable hut or well perimeters, pause briefly, and avoid immediately repeating the previous destination. Completed huts increase local social and leisure priority up to a five-hut cap; isolated villagers can still meet.
- Needs decay; farms advertise `TendCrops`; mill/bakery `Produce`; granary/mill/bakery `Haul`; forest/rock `Gather`.
- Population & Housing: base capacity + Hut capacity (+2/hut); automatic birth when under capacity.
- Thirst & Health: thirst decays ~1.5x faster than hunger; the Drink action (`(1 - thirst)^2`) walks
  villagers to the nearest reachable shoreline or completed well (fixed-order BFS) and restores it.
  Health falls `1/300` per tick per empty survival need (hunger/thirst, exempting an in-progress
  meal/drink) and regenerates slowly while both are ≥ 25%; death at zero health is recorded as
  starvation or dehydration. Happiness now averages hunger, energy, social and thirst.
- Spawn connectivity: starting villagers after the first must spawn in the region walkable from
  the first villager's tile (Rust + demo). Previously the demo map walled 4 of 5 villagers into
  rock pockets with no route to water. The first villager also avoids a landlocked area: if the most
  open central tile can't reach water, spawn moves to the nearest area that can. Drinking re-checks
  its water source each tick, so a well demolished or storm-damaged mid-drink gives no refill.
- Character Traits: `traits.json` assigned to villagers and rendered in `VillagerPanel`.
- Tech / Progression Tree: buildings locked in `BuildMenu` until population or building pre-requisites are met.
- ResourceBar displays live population / housing capacity counter (`Pop X/Y`).
- Browser-demo transport mirrors traits, unlock conditions, housing capacity, weather, autosave
  rotation, and the chronicle for headless/cloud testing. It does **not** implement births or
  deaths, so population is static in the demo.
- Village Chronicle: a 200-entry capped log of births, deaths, building completions, unlocks,
  harvests and season turns, owned by the sim, saved with the world, shown in a collapsible drawer.
  Clicking an entry centres the camera on its subject.
- Persistence: versioned bincode save/load (`SAVE_VERSION` 5; versions 3–4 migrate via the frozen
  `legacy_v4` villager layout, starting thirst/health full); manual Slot 1 Save/Load; rotating
  autosave through slots 1–3 every in-game day.
- Weather: deterministic daily Clear/Rain/Storm from seed+date. Rain/Storm water outdoor crops;
  Storm knocks one building back to half-built. Shown in the ClockBar.
- Interaction polish: pixel selection brackets plus hover tooltips for villagers, buildings and
  crops. Hover inspection is suppressed during build/plant placement so the ghost remains clear.
- Villager roster overlay (`SIMS` button / `V`): lists every living villager with Health, Hunger,
  Thirst, Energy, Social and Happiness bars, sortable per column (stats sort neediest-first), flags critical needs,
  and clicking a row selects the villager and centres the camera. Data comes from the on-demand
  `get_villager_roster` command (polled only while open), never the tick payload.
- Name tags (`TAGS` button / `N`): each villager's name is drawn under its feet; duplicate names get
  `#id`. Below 0.4× zoom only the selected villager keeps its tag. Names are fetched via the roster
  when an unlabelled villager id appears in a snapshot (startup, births).
- Persistence acceptance: a 50-villager save is byte-identical after reload and remains identical
  after both the original and loaded simulations advance.

### Key paths

- Spec: `docs/villagesim-spec.md`
- Rust sim: `src-tauri/src/sim/` (`agents.rs`, `catalog.rs`, `world.rs`, `jobs.rs`, `weather.rs`, …)
- Frontend: `src/render/`, `src/state/`, `src/ui/` (`ResourceBar`, `BuildMenu`, `VillagerPanel`, `ClockBar`)
- Cloud notes: `AGENTS.md`

### Verify

```bash
npm test && npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
npm run dev
```

### Props & assets

- Decor scatter (all deterministic by tile hash in `terrainProps()`, flagged `decor` so
  `buildDrawList` hides them under building footprints): `prop.bush`, `prop.flowers`
  (spring-only), `prop.stump`/`prop.deadfall`/`prop.mushroom` (forest edge) on grass;
  `prop.boulder` on rock; `prop.palm`, `prop.cactus` (inland), `prop.reeds`, `prop.shoreRock`,
  `prop.driftwood` (shoreline) on sand; `prop.lilypad` on calm open shallow water;
  `prop.campfire` (two-frame flame flicker) sparsely on open grass.
- `well` — a 1×1 amenity building (15 stone / 5 wood), unlocked at population 4, no jobs.
- `fence`, `gate`, `signpost` — 1×1 zero-job decorative buildings.
- `storehouse` — 2×2 wood/stone counterpart to the grain-only granary, with the same `haul` job.
- Candidate future additions are catalogued in
  [`docs/props-and-assets-backlog.md`](docs/props-and-assets-backlog.md).

## Verification status

The original M11 handoff deferred the full checks. PR #56 now has passing automated checks; see the follow-up validation below. Live Tauri/browser interaction verification remains unrun.

## Simulation review follow-ups (handoff, 2026-09-29)

Branch `fix/sim-review-followups` works through `docs/rust-simulation-review-2026-09-02.md`; the
"Resolution status" table there is the source of truth. Resolved: R2, R3, R5, R6, R7. Partly resolved:
R1 (nearest pickup, cargo resume; still needs an explicit pickup/delivery phase and reservations) and
R4 (in-place workers end when built over; still needs reachable stand tiles, haul entrances, gate
pass-through). Open: R8. Each fix has a Rust regression in `src-tauri/src/sim/world_review_tests.rs`
and a mirrored case in `src/state/demoWorld.test.ts`.

State at the original local handoff, before opening PR #56: working tree clean; Rust lib tests 163,
Vitest 265, `tsc -b` and `cargo check` pass. Not run: `npm run build` (the review notes an unrelated `tools/genart/app-icon.test.ts`
TS2554 error) and any live Tauri or browser session. The branch is not pushed and has no PR.

Suggested next: decision-explanation diagnostics (current action, job id, pickup/delivery endpoint,
scores, interruption reason) before tuning utility curves; then the R1 and R4 remainders. Gate
behaviour (can villagers walk through gates?) needs a product decision first, as does R8. Also open:
replay/determinism coverage across seasons and player commands.

## PR #56 storm cargo and claim follow-ups (2026-09-30)

`ad73f48` routes demo `applyStormDamage()` through `clearReleasedWorkClaims` and `releaseJobAt`.
The September 29 Codex finding was valid: clearing only `currentJob` stranded carried cargo.
Three cases in `demoWorld.test.ts` now cover working, moving and eating haulers, returning the
exact cargo once, clearing removed claims, stopping affected work travel, preserving meals and
unrelated haulers, and preventing double refunds. The existing Rust fixes are preserved; later R1/R5 refinements are described below.

`8c279fa` also fixes a new Codex R2 finding: `beginWork` now releases the previous job's
reservation when selecting a different job, without returning cargo during a haul-slot switch.
A regression verifies that another villager can reclaim the old farm slot.

`171eda1` addresses two later Rust review findings, mirrored in the demo: carrying haulers are
admitted and moved using the delivery endpoint, and failed resumption returns cargo through the
central cleanup. A finished recipe without room retains its pending batch but becomes
non-actionable so its producer can haul and then resume. Rust and demo regressions cover reachable
delivery despite a blocked job tile, failed-delivery cargo return, and single-worker production
recovery with exact output conservation. Earlier Rust fixes remain in place.

[CI run 36767376700](https://github.com/jimjamscott22/Villiage-Sims/actions/runs/36767376700)
passed on code commit `171eda1` (including all four review fixes): Rust lib tests **166**, Vitest **273** (30 files), Rust Clippy
with `--all-targets -- -D warnings`, and `npm run build` (`tsc -b && vite build`).
The app-icon error from the September 2 review did not recur in CI.
Standalone `cargo check` and `npx tsc -b` were previously reported passing; they were not
separately rerun here. Local `npm run build` and live Tauri/browser verification remain unrun.

R7 is resolved in Rust and the demo. The scoped fixes are ready to merge on automated evidence;
the R1/R4 remainders, R8 decisions and live interaction checks remain outstanding.

## Next up

Milestone 11 is implemented. The next engineering priority is running the deferred full checks and
reviewing Rust/browser-demo parity for the new encounter and leisure state. The next longer-term priority is reducing the Rust/browser-demo parity
risk and adding the deterministic world-hash and long-running soak tests identified in
`docs/state-of-the-game-review.html`. The Aug 10 follow-up also fixed seed planting, storm job
stripping, cargo deposits on death/move, selected-villager move orders, and demo unlock
monotonicity.
The pixel-art redesign (Phases 1–3) is complete — see
`docs/superpowers/specs/2026-07-31-pixel-art-ui-redesign-design.md`.

Browser-demo gap: births and deaths are not simulated, so `villagerBorn` / `villagerDied`
chronicle entries only appear in the desktop build.
