# VillageSim progress

## Current milestone

- Milestone 1 complete on `main` (sim pipe, checkerboard, interpolated villager).
- Milestone 2 complete on branch `jimjamscott22/milestone-2-terrain-camera-8d49`.

## M2 completion

- Rust generates `128×128` terrain with the `noise` crate (seed `42`); reproducible island with water, sand, grass/forest, rock/mountain.
- Frontend camera: drag/edge-scroll pan, cursor-anchored wheel zoom (`0.25…4.0`), initial fit-to-world.
- `set_viewport` IPC records camera frustum for M3+ culling.
- Browser-demo transport uses a deterministic island (same thresholds; not byte-identical to Rust).
- Verified: `cargo test --lib` (8), `npm test` (9), `npm run build`, browser smoke screenshots.

## Next milestone

- Do not begin M3 (building placement) until this PR is merged and demoed.
- Re-read `docs/villagesim-spec.md` and write/approve an M3 design before implementation.
