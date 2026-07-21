# VillageSim progress & handoff

Last updated: 2026-07-20 (M6 in progress).

## Status

| Milestone | Status | PR |
|---|---|---|
| M1 — Prove the pipe | Complete on `main` | #1 |
| M2 — Terrain + camera | Complete on `main` | #2 |
| M3 — Building placement | Complete on `main` | #3 |
| M4 — Pathfinding + villager FSM | Complete on `main` | #5 (+ follow-up) |
| M5 — Needs and a single job | Complete on `main` | #8 |
| **M6 — Clock and crops** | **In progress** | — |
| M7–M10 | Later | — |

Roadmap source of truth: [`docs/villagesim-spec.md`](docs/villagesim-spec.md).

## What works today (M1–M6 WIP)

- Everything from M1–M5.
- Clock (day/season/year) + pause/1×/2×/3× speed controls.
- `crops.json` wheat; plant on completed farm tiles; TendCrops auto-plant + water.
- Growth gated by season and watering; winter stalls; `CropReady` at max stage (no harvest).
- Crops render by stage; browser-demo parity including `advanceClock`.

### Key paths

- Spec: `docs/villagesim-spec.md`
- Design: `docs/superpowers/specs/2026-07-20-milestone-6-design.md`
- Plan: `docs/superpowers/plans/2026-07-20-milestone-6.md`
- Rust: `src-tauri/src/sim/clock.rs`, `crops.rs`, `catalog.rs`, `world.rs`
- Frontend: `BuildMenu` clock/plant, `drawEntities` crops, `demoWorld.ts`

### Verify

```bash
npm test && npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
npm run dev   # place farm → plant wheat → tend waters → advanceClock to winter → stall
```

## Next after M6 demos

Milestone 7 — Utility AI (Action trait, scoring, multiple villagers).
Do not start M7 until M6 demos cleanly.

## Handoff prompt (new thread)

```text
VillageSim M6 clock/crops is in progress on jimjamscott22/milestone-6-clock-crops-34b3.

Read:
- docs/villagesim-spec.md (M6 section)
- docs/superpowers/specs/2026-07-20-milestone-6-design.md
- docs/superpowers/plans/2026-07-20-milestone-6.md
- progress.md
- AGENTS.md

Finish browser smoke, then PR. Do not start M7 until M6 demos.
```
