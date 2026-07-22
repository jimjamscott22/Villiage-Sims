# VillageSim progress & handoff

Last updated: 2026-07-22 (M6 in progress).

## Status

| Milestone | Status | PR |
|---|---|---|
| M1 — Prove the pipe | Complete on `main` | #1 |
| M2 — Terrain + camera | Complete on `main` | #2 |
| M3 — Building placement | Complete on `main` | #3 |
| M4 — Pathfinding + villager FSM | Complete on `main` | #5 (+ follow-up) |
| M5 — Needs and a single job | Complete on `main` | #8 |
| **M6 — Clock and crops** | **In progress** | [#9](https://github.com/jimjamscott22/Villiage-Sims/pull/9) |
| M7–M10 | Later | — |

Roadmap source of truth: [`docs/villagesim-spec.md`](docs/villagesim-spec.md).
M6 design: [`docs/superpowers/specs/2026-07-20-milestone-6-design.md`](docs/superpowers/specs/2026-07-20-milestone-6-design.md).

## What works today (M1–M5 + M6 WIP)

- Tauri 2 + React Canvas; Rust owns a 20 Hz sim thread; frontend interpolates at RAF.
- Seeded `128×128` island terrain (`noise`), pan/zoom camera, offscreen terrain blit.
- `buildings.json` catalog (hut/farm/granary); BuildMenu; ghost preview; place/demolish with costs/refunds.
- Single villager with Idle/MovingTo/Working FSM; A* pathfinding around water/buildings.
- Right-click a tile → villager walks there; place a building on the path → repath or Idle+cooldown.
- Needs decay (hunger/energy/social/happiness); completed farms advertise `TendCrops` jobs; villager claims and works.
- `VillagerPanel` via `get_villager_detail` (polled; needs never in tick payload).
- **M6:** `Clock` (day/season/year) + speed controls; `crops.json` / crop entities; plant mode; growth + seasonal stall; TendCrops auto-plant/water; day-rollover clears water.
- Tick snapshots carry villagers (with `state`), buildings, crops, clock, resources, events.
- Browser-demo transport mirrors move, jobs, needs, clock, crops, and detail for headless/cloud testing.

### Key paths

- Spec: `docs/villagesim-spec.md`
- Designs/plans: `docs/superpowers/specs/`, `docs/superpowers/plans/`
- Rust sim: `src-tauri/src/sim/` (`clock.rs`, `crops.rs`, `needs.rs`, `jobs.rs`, `agents.rs`, `pathfind.rs`, `world.rs`, …)
- Frontend: `src/render/`, `src/state/`, `src/ui/` (`ClockBar`, `BuildMenu`, `VillagerPanel`)
- Cloud notes: `AGENTS.md`

### Verify

```bash
npm test && npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
npm run dev   # place a farm → plant wheat (or wait for auto-plant) → watch stages; Pause/2×; jump season via advance_clock in tests
```

## Next after M6 demos

Milestone 7 — Utility AI (Eat/Sleep/Work/Socialize/Wander, hysteresis, multiple villagers).
Do not start M7 until M6 demos cleanly.
