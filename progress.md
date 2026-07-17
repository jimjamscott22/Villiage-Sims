# VillageSim progress

## Current milestone

- Milestone 1 complete on `main` (sim pipe, checkerboard, interpolated villager).
- Milestone 2 in progress: seeded island terrain + camera pan/zoom.

## M2 notes

- Rust generates `128×128` terrain with the `noise` crate (seed `42`).
- Frontend camera: drag to pan, wheel zoom (cursor-anchored), edge-scroll.
- Browser-demo transport uses a deterministic island (same thresholds; not byte-identical to Rust).

## Next milestone

- Do not begin M3 (building placement) until M2 is runnable and demoable.
- Re-read `docs/villagesim-spec.md` and write/approve an M3 design before implementation.
