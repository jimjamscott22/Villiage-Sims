# VillageSim progress & handoff

Last updated: 2026-07-24 (M7 in progress).

## Status

| Milestone | Status | PR |
|---|---|---|
| M1 — Prove the pipe | Complete on `main` | #1 |
| M2 — Terrain + camera | Complete on `main` | #2 |
| M3 — Building placement | Complete on `main` | #3 |
| M4 — Pathfinding + villager FSM | Complete on `main` | #5 (+ follow-up) |
| M5 — Needs and a single job | Complete on `main` | #8 |
| M6 — Clock and crops | Complete on `main` | #9 |
| **M7 — Utility AI** | **In progress** | — |
| M8–M10 | Later | — |

Roadmap source of truth: [`docs/villagesim-spec.md`](docs/villagesim-spec.md).
M7 design: [`docs/superpowers/specs/2026-07-24-milestone-7-design.md`](docs/superpowers/specs/2026-07-24-milestone-7-design.md).

## What works today (M1–M6 + M7 WIP)

- Tauri 2 + React Canvas; Rust owns a 20 Hz sim thread; frontend interpolates at RAF.
- Seeded `128×128` island terrain (`noise`), pan/zoom camera, offscreen terrain blit.
- `buildings.json` catalog (hut/farm/granary); BuildMenu; ghost preview; place/demolish with costs/refunds.
- Five villagers with utility AI (Eat/Sleep/Work/Socialize/Wander) + hysteresis; A* pathfinding.
- Right-click a tile → nearest villager walks there; place a building on the active path forces a repath (or Idle + cooldown).
- Needs decay; completed farms advertise `TendCrops` jobs; villagers claim and work (job kept while eating).
- `VillagerPanel` via `get_villager_detail` (click a villager to select; needs never in tick payload).
- Clock (day/season/year) + speed controls; crops grow by stage when watered in-season; TendCrops auto-plants/waters.
- Tick snapshots carry villagers (with `state`), buildings, crops, clock, resources, events.
- Browser-demo transport mirrors utility AI, multi-villager, clock, crops, and detail for headless/cloud testing.

### Key paths

- Spec: `docs/villagesim-spec.md`
- Designs/plans: `docs/superpowers/specs/`, `docs/superpowers/plans/`
- Rust sim: `src-tauri/src/sim/` (`utility.rs`, `agents.rs`, `clock.rs`, `crops.rs`, `needs.rs`, `jobs.rs`, `world.rs`, …)
- Frontend: `src/render/`, `src/state/`, `src/ui/` (`ClockBar`, `BuildMenu`, `VillagerPanel`)
- Cloud notes: `AGENTS.md`

### Verify

```bash
npm test && npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
npm run dev   # five villagers wander/work; place farm → TendCrops; hunger → eat (food↓); click villager for panel
```

## Next after M7 demos

Milestone 8 — Economy and production chains (gathering, recipes, mill→bakery, storage, hauling, ResourceBar).
Do not start M8 until M7 demos cleanly.
