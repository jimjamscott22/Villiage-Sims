# VillageSim progress & handoff

Last updated: 2026-07-24 (M8 complete).

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
| **M8 — Economy and production chains** | **Complete** | [#12](https://github.com/jimjamscott22/Villiage-Sims/pull/12) |
| M9–M10 | Later | — |

Roadmap source of truth: [`docs/villagesim-spec.md`](docs/villagesim-spec.md).
M8 design: [`docs/superpowers/specs/2026-07-24-milestone-8-design.md`](docs/superpowers/specs/2026-07-24-milestone-8-design.md).

## What works today (M1–M8)

- Tauri 2 + React Canvas; Rust owns a 20 Hz sim thread; frontend interpolates at RAF.
- Seeded `128×128` island terrain (`noise`), pan/zoom camera, offscreen terrain blit.
- `buildings.json` catalog (hut/farm/granary/mill/bakery); BuildMenu; ghost preview; place/demolish with costs/refunds.
- Five villagers with utility AI (Eat/Sleep/Work/Socialize/Wander) + hysteresis; A* pathfinding.
- Right-click a tile → nearest villager walks there; place a building on the active path forces a repath (or Idle + cooldown).
- Needs decay; farms advertise `TendCrops` (harvest ready wheat → farm grain buffer); mill/bakery `Produce`; granary/mill/bakery `Haul`; forest/rock `Gather`.
- Building inventories + camp stockpile; ResourceBar totals = stockpile + storage inventories.
- Mill: grain→flour; Bakery: flour→food; haulers move buffers ↔ storage.
- Completed Eat/Sleep/Socialize clear `current_action` so hysteresis cannot re-enter or starve Wander.
- `VillagerPanel` via `get_villager_detail` (click a villager to select; needs never in tick payload).
- Clock (day/season/year) + speed controls; crops grow by stage when watered in-season; TendCrops auto-plants/waters/harvests.
- Tick snapshots carry villagers (with `state`), buildings, crops, clock, derived resources, events.
- Browser-demo transport mirrors utility AI, multi-villager, clock, crops, economy, and detail for headless/cloud testing.

### Key paths

- Spec: `docs/villagesim-spec.md`
- Designs/plans: `docs/superpowers/specs/`, `docs/superpowers/plans/`
- Rust sim: `src-tauri/src/sim/` (`economy.rs`, `nodes.rs`, `utility.rs`, `agents.rs`, `clock.rs`, `crops.rs`, `needs.rs`, `jobs.rs`, `world.rs`, …)
- Frontend: `src/render/`, `src/state/`, `src/ui/` (`ClockBar`, `ResourceBar`, `BuildMenu`, `VillagerPanel`)
- Cloud notes: `AGENTS.md`

### Verify

```bash
npm test && npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
npm run dev   # ResourceBar live; place farm/mill/bakery/granary; gather + haul + produce loop
```

## Next up

Milestone 9 — Population and progression.
