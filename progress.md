# VillageSim progress & handoff

Last updated: 2026-07-18 (after M3 merge).

## Status

| Milestone | Status | PR |
|---|---|---|
| M1 — Prove the pipe | Complete on `main` | #1 |
| M2 — Terrain + camera | Complete on `main` | #2 |
| M3 — Building placement | Complete on `main` | #3 |
| **M4 — Pathfinding + villager FSM** | **Next — not started** | — |
| M5–M10 | Later | — |

Roadmap source of truth: [`docs/villagesim-spec.md`](docs/villagesim-spec.md).

## What works today (M1–M3)

- Tauri 2 + React Canvas; Rust owns a 20 Hz sim thread; frontend interpolates at RAF.
- Seeded `128×128` island terrain (`noise`), pan/zoom camera, offscreen terrain blit.
- `buildings.json` catalog (hut/farm/granary); BuildMenu; ghost preview; place/demolish with costs/refunds.
- Tick snapshots carry villagers, buildings, resources (terrain sent once via `get_terrain`).
- Browser-demo transport for headless/cloud testing (`npm run dev`, `?test=1` + `advanceTime` / `render_game_to_text`).

### Key paths

- Spec: `docs/villagesim-spec.md`
- Designs/plans: `docs/superpowers/specs/`, `docs/superpowers/plans/`
- Rust sim: `src-tauri/src/sim/` (`world.rs`, `terrain.rs`, `buildings.rs`, `catalog.rs`, `commands.rs`)
- Frontend: `src/render/`, `src/state/`, `src/ui/BuildMenu.tsx`
- Cloud notes: `AGENTS.md`

### Verify

```bash
npm test && npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
npm run dev   # browser demo
```

## Next: Milestone 4

**Design:** [`docs/superpowers/specs/2026-07-18-milestone-4-design.md`](docs/superpowers/specs/2026-07-18-milestone-4-design.md)  
**Plan:** [`docs/superpowers/plans/2026-07-18-milestone-4.md`](docs/superpowers/plans/2026-07-18-milestone-4.md)

**Done when:** right-click a tile → the villager walks there around water/buildings; placing a building on the path mid-walk forces a repath (or Idle + retry).

**Out of scope for M4:** needs, jobs, utility AI, crops, clock, economy (those are M5+).

## Handoff prompt (new thread)

```text
VillageSim M1–M3 are complete on main. Implement Milestone 4 only.

Read:
- docs/villagesim-spec.md (M4 section + pathfinding/FSM)
- docs/superpowers/specs/2026-07-18-milestone-4-design.md
- docs/superpowers/plans/2026-07-18-milestone-4.md
- progress.md
- AGENTS.md

Branch: jimjamscott22/<descriptive-name>-8d49
Do not start M5 until M4 demos.
```
