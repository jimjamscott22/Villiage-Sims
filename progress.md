# VillageSim progress

## Current milestone

- Milestone 1–2 complete on `main`.
- Milestone 3 complete on branch `jimjamscott22/milestone-3-building-placement-8d49`.

## M3 completion

- `buildings.json` catalog (hut/farm/granary) with `get_catalog`.
- Command channel: `validate_placement`, `place_building`, `demolish`, `set_viewport`.
- Tick snapshots include buildings + resources; construction auto-progresses.
- BuildMenu + ghost preview; demolish with full refund.
- Browser smoke: place hut (wood 120→100), demolish (wood→120).
- Verified: `cargo test --lib` (14), `npm test` (12), `npm run build`.

## Next milestone

- Do not begin M4 (pathfinding / villager FSM) until this PR is merged.
- Re-read `docs/villagesim-spec.md` and write/approve an M4 design before implementation.
