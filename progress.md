# VillageSim progress & handoff

Last updated: 2026-08-04 (Art Phase 2 entities complete; M10 persistence in progress).

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
| **M10 — Persistence and polish** | **In progress: save/load + event log done; autosave and weather remain** | [#17](https://github.com/jimjamscott22/Villiage-Sims/pull/17) |
| Art — Phase 1 (pipeline + terrain) | Complete | [#21](https://github.com/jimjamscott22/Villiage-Sims/pull/21) |
| **Art — Phase 2 (entities + y-sort)** | **Complete** | — |

Roadmap source of truth: [`docs/villagesim-spec.md`](docs/villagesim-spec.md).

## What works today (M1–M9)

- Tauri 2 + React Canvas; Rust owns a 20 Hz sim thread; frontend interpolates at RAF.
- Seeded `128×128` island terrain (`noise`), pan/zoom camera, offscreen terrain blit.
- `buildings.json` catalog (hut/farm/granary/mill/bakery); BuildMenu; ghost preview; place/demolish with costs/refunds.
- Five villagers with utility AI (Eat/Sleep/Work/Socialize/Wander) + hysteresis; A* pathfinding.
- Needs decay; farms advertise `TendCrops`; mill/bakery `Produce`; granary/mill/bakery `Haul`; forest/rock `Gather`.
- Population & Housing: base capacity + Hut capacity (+2/hut); automatic birth when under capacity; starvation death on zero hunger.
- Character Traits: `traits.json` assigned to villagers and rendered in `VillagerPanel`.
- Tech / Progression Tree: buildings locked in `BuildMenu` until population or building pre-requisites are met.
- ResourceBar displays live population / housing capacity counter (`Pop X/Y`).
- Browser-demo transport mirrors traits, unlock conditions, housing capacity, and the chronicle
  (building completions, harvests, season turns, unlocks) for headless/cloud testing. It does
  **not** implement births or deaths, so population is static in the demo.
- Village Chronicle: a 200-entry capped log of births, deaths, building completions, unlocks,
  harvests and season turns, owned by the sim, saved with the world, shown in a collapsible drawer.
  Clicking an entry centres the camera on its subject.

### Key paths

- Spec: `docs/villagesim-spec.md`
- Rust sim: `src-tauri/src/sim/` (`agents.rs`, `catalog.rs`, `world.rs`, `jobs.rs`, …)
- Frontend: `src/render/`, `src/state/`, `src/ui/` (`ResourceBar`, `BuildMenu`, `VillagerPanel`)
- Cloud notes: `AGENTS.md`

### Verify

```bash
npm test && npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
npm run dev
```

## Next up

Finish Milestone 10: autosave rotation, weather, and camera/interaction polish.
Art Phase 3 (pixel HUD: 9-slice panels, bitmap font, icons, segmented bars) is
specced in `docs/superpowers/specs/2026-07-31-pixel-art-ui-redesign-design.md`.

Browser-demo gap: births and deaths are not simulated, so `villagerBorn` / `villagerDied`
chronicle entries only appear in the desktop build.
