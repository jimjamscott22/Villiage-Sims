# VillageSim progress & handoff

Last updated: 2026-07-19 (after M5).

## Status

| Milestone | Status | PR |
|---|---|---|
| M1 — Prove the pipe | Complete on `main` | #1 |
| M2 — Terrain + camera | Complete on `main` | #2 |
| M3 — Building placement | Complete on `main` | #3 |
| M4 — Pathfinding + villager FSM | Complete on `main` | #5 (+ follow-up) |
| **M5 — Needs and a single job** | **Complete** | #8 |
| M6–M10 | Later | — |

Roadmap source of truth: [`docs/villagesim-spec.md`](docs/villagesim-spec.md).

## What works today (M1–M5)

- Tauri 2 + React Canvas; Rust owns a 20 Hz sim thread; frontend interpolates at RAF.
- Seeded `128×128` island terrain (`noise`), pan/zoom camera, offscreen terrain blit.
- `buildings.json` catalog (hut/farm/granary); BuildMenu; ghost preview; place/demolish with costs/refunds.
- Single villager with Idle/MovingTo/Working FSM; A* pathfinding around water/buildings.
- Right-click a tile → villager walks there; place a building on the path → repath or Idle+cooldown.
- Needs decay (hunger/energy/social/happiness); completed farms advertise `TendCrops` jobs; villager claims and works.
- `VillagerPanel` via `get_villager_detail` (polled; needs never in tick payload).
- Tick snapshots carry villagers (with `state`), buildings, resources (terrain sent once via `get_terrain`).
- Browser-demo transport mirrors move, jobs, needs, and detail for headless/cloud testing.

### Key paths

- Spec: `docs/villagesim-spec.md`
- Designs/plans: `docs/superpowers/specs/`, `docs/superpowers/plans/`
- Rust sim: `src-tauri/src/sim/` (`needs.rs`, `jobs.rs`, `agents.rs`, `pathfind.rs`, `world.rs`, …)
- Frontend: `src/render/`, `src/state/`, `src/ui/VillagerPanel.tsx`
- Cloud notes: `AGENTS.md`

### Verify

```bash
npm test && npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
npm run dev   # place a farm → wait for complete → villager works; watch hunger in panel
```

## Next: Milestone 6

Clock (day/season/year) + speed controls, `crops.json`, planting/growth stages, seasonal gating.
Do not start M6 until M5 demos cleanly.

## Handoff prompt (new thread)

```text
VillageSim M1–M5 are complete on main. Implement Milestone 6 only.

Read:
- docs/villagesim-spec.md (M6 section)
- progress.md
- AGENTS.md

Branch: jimjamscott22/<descriptive-name>-34b3
Do not start M7 until M6 demos.
```
