# Pixel Art Phase 2 — Entities Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace flat-shape buildings, crops, villagers and terrain props with authored pixel sprites drawn through a y-sorted scene pass, so the world reads entirely as Mediterranean pixel art while the HUD stays as Phase 1 left it.

**Architecture:** Declarative `{ size, palette, rows }` grids in `tools/genart/sprites/` rasterize into an `entities` sheet packed alongside the existing `tiles` sheet. Runtime `scene.ts` builds a per-frame draw list from the tick snapshot, sorts by `(layerRank, baseY, id)`, and paints via `drawCell`. Facing comes from interpolation deltas in `SnapshotBuffer`. Flat `drawEntities.ts` remains the atlas-fallback path.

**Tech Stack:** TypeScript, existing genart pipeline (`Raster`, `pack`, `png`, `palette`), Vite 8, Vitest 4, Canvas 2D. One optional Rust field (`sprite`) on catalog defs.

**Spec:** `docs/superpowers/specs/2026-07-31-pixel-art-ui-redesign-design.md`

## Global Constraints

- Same as Phase 1: no new runtime deps; Node-only Vitest (no DOM in tests); `verbatimModuleSyntax`; palette-only colors; `ART_SCALE = 2`.
- Declarative grids for entities (Phase 1 deviation #2 already flagged this).
- Drift test still compares decoded pixels.
- Buildings face south only; no rotated art.
- Forest/Mountain props are entity-layer (y-sorted), never baked into the terrain cache.
- Commit after coherent task groups. Verify with `npm test`, `npm run build`, `npm run art`.

## Deviations from the spec

**1. Villager dye variants are generated at pack time, not tinted at draw.** The draw-list `tint?` field is unused. Sprites are authored with a dye placeholder hex; `build.ts` expands each pose into six palette dyes keyed `villager.<facing>.<pose>.<dye>`. Runtime picks dye from `id % 6`. Avoids Canvas per-pixel remapping and keeps the fallback path simple.

**2. Farm field is a single atlas cell (`farm.field`), not a per-tile procedural fill.** Drawn once at rank 0 covering the building footprint. Crops sit at rank 1 on top.

**3. Specific tool bubbles for the selected villager need `jobKind` from detail.** Phase 2 draws the generic tool bubble for all Working villagers; wiring the selected-villager-specific tool is deferred to a thin follow-up once `VillagerPanel` selection detail is threaded into `scene.ts` (the canvas already holds `selectedVillagerId` but not `jobKind`).

## File structure

**Create**

| File | Responsibility |
|---|---|
| `tools/genart/grid.ts` | Rasterize `{ size, palette, rows }` into a `Raster`; assert palette membership. |
| `tools/genart/sprites/props.ts` | Cypress cluster, mountain peak. |
| `tools/genart/sprites/buildings.ts` | Hut, farm, granary, mill (+ sails), bakery (+ smoke), scaffolds, farm field. |
| `tools/genart/sprites/crops.ts` | Wheat stages 0–3 (+ sway on stage 3). |
| `tools/genart/sprites/villagers.ts` | N/E/S walk×4 + idle, lying pose, status bubbles; dye placeholder. |
| `src/render/scene.ts` | Pure draw-list builder + painter; facing map; frame clocks. |
| `src/render/scene.test.ts` | Ordering: farm before crops; south villager after building; stable ties. |
| `public/art/entities.png` | Generated, committed. |

**Modify**

| File | Change |
|---|---|
| `tools/genart/build.ts` | Pack tiles + entities sheets; expand villager dyes; set `anchorY` / `frames`. |
| `src/render/tilemap.ts` | Export `terrainProps()` for forest/mountain standing props. |
| `src/state/types.ts` | `sprite?: string` on defs; `dx?`/`dy?` on `VillagerView`. |
| `src/state/snapshot.ts` | Emit `dx`/`dy` from snapshot deltas. |
| `src/state/snapshot.test.ts` | Facing-delta tests. |
| `src/render/atlas.test.ts` | Assert entity cells for catalog ids + scaffolds + props. |
| `src/render/Canvas.tsx` | Use `paintScene` when atlas loaded; keep flat fallback. |
| `src-tauri/src/sim/catalog.rs` + `crops.rs` | Optional `sprite` field passthrough. |
| `progress.md` | Mark Art Phase 2 complete / next up Phase 3. |

## Atlas keys (contract)

| Key pattern | Notes |
|---|---|
| `hut`, `farm`, `granary`, `mill`, `bakery` | Completed buildings; mill/bakery may have `frames` |
| `scaffold.1`, `scaffold.2`, `scaffold.3` | Shared by footprint size |
| `farm.field` | Rank-0 ground under a farm |
| `wheat.0`…`wheat.3` | Stage; stage 3 may sway (`frames: 2`) |
| `prop.cypress`, `prop.peak` | Forest / Mountain |
| `villager.{n\|e\|s}.{idle\|walk0..3\|lie}.{0..5}` | Facing × pose × dye |
| `bubble.fork`, `bubble.zzz`, `bubble.speech`, `bubble.tool` | 8×8 status |

`anchorY` = pixels of sprite above the footprint top. Draw at `(tileX * 32, tileY * 32 - anchorY * 2)`.

## Layer ranks

| Rank | Contents |
|---|---|
| 0 | `farm.field` |
| 1 | buildings, scaffolds, crops, props, villagers |
| 2 | bubbles, selection brackets |

`baseY` = world-y of the sprite’s bottom edge. Tie-break on `id` (stringified).

## Frame clocks (ticks per frame)

| Thing | Period | Frames |
|---|---|---|
| Villager walk | 3 | 4 |
| Mill sails | 4 | 4 |
| Bakery smoke | 6 | 3 |
| Wheat / cypress sway | 12 | 2 |
| Shoreline foam | 8 | 3 (unchanged, still in Canvas) |

`prefers-reduced-motion` freezes ambient loops at frame 0; walk cycles continue.

## Tasks

### Task 1: Grid rasterizer

- Create `tools/genart/grid.ts` + `grid.test.ts`
- API: `rasterizeGrid(def: SpriteGrid): Raster`
- Palette values must be palette hex or `null` (transparent); throw otherwise
- Contact-shadow helper optional here or in sprite modules

### Task 2: Props + buildings + crops sprites

- Author Mediterranean 3/4 sprites within the 29-color palette
- Hut 16×32 (`anchorY` 16), farm/granary/mill/bakery sized to footprint×16 with headroom
- Scaffolds 1/2/3 tile; farm.field flat 48×48
- Wheat 16×16 stages; stage 3 has 2 sway frames
- Cypress ~16×32, peak ~16×24

### Task 3: Villager sprites + bubbles

- 16×24 body; N/E/S idle + 4 walk; lying; W = E mirrored at draw time
- Dye placeholder color (e.g. shutter `#3f6f8f`) remapped to 6 dyes at pack
- Bubbles 8×8: fork, zzz, speech, tool

### Task 4: Pack entities sheet

- `buildAtlas` returns tiles + entities sheets
- Manifest includes `anchorY` / `frames` where needed
- `npm run art`; drift test green

### Task 5: Snapshot facing deltas

- `VillagerView.dx` / `dy`
- Tests for motion and zero-delta (scene holds last facing — tested in scene)

### Task 6: `scene.ts`

- Pure `buildDrawList(...)` → sorted entries
- `paintScene(ctx, atlas, list)` uses `drawCell` (+ mirror for West)
- `terrainProps` from tilemap feeds cypress/peak
- Selection brackets at rank 2
- Tests without canvas: ordering only on the pure list

### Task 7: Catalog `sprite` + Canvas wire-up

- Optional `sprite` on BuildingDef / CropDef (Rust + TS); lookup falls back to `id`
- Canvas: if atlas has entity cells, `paintScene`; else flat `drawEntities`
- Foam stays in Canvas (already there)

### Task 8: Docs + progress

- Update `progress.md` Art Phase 2 row; Next up → Phase 3 HUD
- Brief README note that `entities.png` is also committed

## Definition of done

- [ ] `npm test` / `npm run build` / `npm run art` (clean tree) all pass
- [ ] `npm run dev` shows pixel buildings, crops, props, villagers over Phase 1 terrain
- [ ] Atlas load failure still falls back to flat entities
- [ ] HUD unchanged (Phase 3)
