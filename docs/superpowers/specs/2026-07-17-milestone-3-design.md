# VillageSim Milestone 3 Design

## Scope

Milestone 3 adds data-driven building placement on top of the M2 island and camera. The player can open a build menu, preview a ghost footprint, place buildings on valid terrain (paying resource costs), see them in tick snapshots, and demolish them for a full refund.

Out of scope: pathfinding, villager AI/jobs, crops, clock/seasons, production chains, and save/load.

## Architecture

1. `src-tauri/data/buildings.json` is the catalog. Loaded and validated at startup via `include_str!`.
2. Mutating intents (`place_building`, `demolish`, `set_viewport`) and request/response checks (`validate_placement`) go through an `mpsc` command channel drained at the top of each sim tick. `World` remains exclusively owned by the sim thread.
3. Tick snapshots gain `buildings` (viewport-culled) and `resources`. Terrain stays out of ticks.
4. The frontend adds `BuildMenu`, ghost overlay drawing, and build-mode input (`R` rotate, `Esc` cancel, click to place). Demolish uses selection + Delete/UI button.

## Rust Components

- `sim/catalog.rs` — deserialize/validate building defs; expose `Catalog` / `BuildingDef`.
- `sim/buildings.rs` — `Building`, `BuildState`, footprint helpers (rotation), placement validation.
- `sim/resources.rs` — `ResourceTotals` with afford / spend / refund.
- `sim/commands.rs` — `SimCommand` enum + oneshot replies for validate/place/demolish.
- `sim/world.rs` — holds catalog handle, buildings, occupancy grid, resources, viewport; handles commands; auto-advances construction progress each tick (no workers yet).
- `snapshot.rs` — `BuildingView`, `ResourceTotals` on `TickSnapshot`.
- `commands.rs` (Tauri) — `get_catalog`, `validate_placement`, `place_building`, `demolish`; keep `get_terrain` / `set_viewport`.

### Placement rules

Valid when every footprint tile is in-bounds, matches `valid_terrain`, and is unoccupied. Cost is deducted on place. Demolish clears occupancy and refunds the full cost.

Build states: `UnderConstruction { progress_ticks }` → `Complete` when `progress_ticks >= build_ticks`. M3 auto-increments progress each tick so buildings finish without workers.

### Starting resources

`wood: 120`, `stone: 40`, others `0` — enough for several huts and one granary.

## Frontend Components

- `ui/BuildMenu.tsx` — catalog buttons + resource readout + selected building demolish control.
- `render/drawGhost.ts` — green/red footprint preview.
- `render/drawEntities.ts` — draw buildings (kind-colored rects; construction tint).
- `state/transport.ts` — catalog + place/validate/demolish; browser-demo mirrors placement rules on its local island.
- `state/snapshot.ts` — pass through buildings/resources (no interpolation needed for tile-aligned buildings).
- `Canvas.tsx` — build mode input; middle-drag always pans; left-click places in build mode / selects otherwise.

## Verification

- Rust: catalog loads 3 buildings; hut valid on grass, invalid on water; place deducts wood; demolish refunds; occupancy blocks overlap.
- TS: snapshot buffer keeps buildings/resources; transport placement works in browser-demo.
- Browser smoke: select Hut, hover grass (green ghost) / water (red), place, see building, demolish, resources restore.
- `cargo test --lib`, `npm test`, `npm run build` pass.

**Done when:** place a hut on grass, rejection on water, and demolish with refund all work end-to-end.
