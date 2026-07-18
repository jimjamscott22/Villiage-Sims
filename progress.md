# VillageSim progress & handoff

Last updated: 2026-07-18 (after M4).

## Status

| Milestone | Status | PR |
|---|---|---|
| M1 — Prove the pipe | Complete on `main` | #1 |
| M2 — Terrain + camera | Complete on `main` | #2 |
| M3 — Building placement | Complete on `main` | #3 |
| **M4 — Pathfinding + villager FSM** | **Complete (this branch)** | — |
| M5–M10 | Later | — |

Roadmap source of truth: [`docs/villagesim-spec.md`](docs/villagesim-spec.md).

## What works today (M1–M4)

- Tauri 2 + React Canvas; Rust owns a 20 Hz sim thread; frontend interpolates at RAF.
- Seeded `128×128` island terrain (`noise`), pan/zoom camera, offscreen terrain blit.
- `buildings.json` catalog (hut/farm/granary); BuildMenu; ghost preview; place/demolish with costs/refunds.
- Single villager with Idle/MovingTo FSM; A* pathfinding (`pathfinding` crate) around water/buildings.
- Right-click a tile → villager walks there; place a building on the path → repath or Idle+cooldown.
- Tick snapshots carry villagers (with `state`), buildings, resources (terrain sent once via `get_terrain`).
- Browser-demo transport mirrors move + repath for headless/cloud testing.

### Key paths

- Spec: `docs/villagesim-spec.md`
- Designs/plans: `docs/superpowers/specs/`, `docs/superpowers/plans/`
- Rust sim: `src-tauri/src/sim/` (`pathfind.rs`, `agents.rs`, `world.rs`, `buildings.rs`, …)
- Frontend: `src/render/`, `src/state/` (`pathfind.ts`, `demoWorld.ts`, `transport.ts`)
- Cloud notes: `AGENTS.md`

### Verify

```bash
npm test && npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
npm run dev   # browser demo — right-click to move, place hut on path to repath
```

## Next: Milestone 5

Needs decay, job board beginnings, or whatever M5 is defined as in `docs/villagesim-spec.md`.
Do not start M5 until M4 is merged and demos cleanly.

## Handoff prompt (new thread)

```text
VillageSim M1–M4 are complete on main. Implement Milestone 5 only.

Read:
- docs/villagesim-spec.md (M5 section)
- progress.md
- AGENTS.md

Branch: jimjamscott22/<descriptive-name>-8d49
Do not start M6 until M5 demos.
```
