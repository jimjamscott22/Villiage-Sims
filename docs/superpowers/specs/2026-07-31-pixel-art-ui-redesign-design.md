# VillageSim Pixel Art UI Redesign

## Scope

Replace every flat-shape primitive in the renderer with authored pixel art, and restyle the HUD to match. Terrain becomes a tilemap with variants and edge fringes; buildings, crops and villagers become 3/4-perspective sprites drawn from a committed sprite sheet; the HUD gains 9-slice panel frames, sprite icons and a bitmap display font.

Art is produced by a generator script in the repo, encoded to PNG sheets plus a JSON atlas manifest, and committed. The runtime loads images — it never generates art.

**Done when:** a running village reads entirely through artwork — you can identify any terrain, any building (including under construction), any crop stage and what any villager is doing, without selecting anything or reading a label.

Out of scope: weather visuals (M10), event log UI (M10), autosave (M10), day/night lighting, isometric projection, per-villager portraits, sound.

This is a parallel art track, not a milestone. It touches no sim code and adds one optional catalog field, so it neither blocks nor is blocked by the remaining M10 work. Weather, when it lands, will need art that this atlas is designed to absorb.

## Decisions (locked)

| Topic | Choice |
|---|---|
| Asset source | Generator script emits committed PNG sheets + `atlas.json`; runtime loads only |
| Generator location | `tools/genart/`, run via `npm run art` |
| PNG encoding | Node built-in `zlib` — IHDR/IDAT/IEND, filter type 0 per row. No new dependencies |
| Sprite authoring format | Declarative TS: `{ size, palette, rows }` with single-character keys |
| Output | `public/art/tiles.png`, `entities.png`, `ui.png`, `atlas.json` — all committed |
| Native resolution | 16×16 px; world `tileSize` stays 32, so everything upscales exactly 2× |
| Projection | 3/4 top-down. Sprites may extend above their footprint; footprint is unchanged for hit-testing |
| Setting | Mediterranean terraces — whitewash, terracotta, olive/cypress, turquoise shallows |
| Palette | 29 colors in five world ramps + three UI darks. No color outside the palette |
| Light direction | Top-left, hard. Every sprite gets a contact shadow at its base |
| Outlines | Selective: silhouette only, never internal detail; outline is a darkened neighbour, never pure black |
| Sprite lookup | Optional `sprite` field on `BuildingDef` / `CropDef`, falling back to `id` |
| Terrain base tiles | Five: deep water, shallow water, sand, grass, rock |
| Forest / Mountain | Base tile + standing prop (cypress cluster / peak), not flat tiles |
| Tile variation | 4 variants per base, selected by a hash of `(x, y)` — deterministic, stateless |
| Edge fringes | Priority water → sand → grass → rock; 12 cells per transition (4 sides, 4 outer, 4 inner corners) |
| Draw ordering | Single y-sorted pass, key `(layerRank, baseY, id)` |
| Layer ranks | 0 = ground surfaces painted over by everything (farm field), 1 = objects that y-sort (buildings, trees, crops, villagers), 2 = always-on-top (status bubbles, selection) |
| Under construction | One scaffold sprite per footprint size (1×1, 2×2, 3×3), shared across buildings |
| Villager sprites | 16×24; N/E/S authored at 4 walk frames + 1 idle; W is E mirrored; 1 lying pose |
| Villager variety | Garment color hashed from villager `id` across six palette dyes |
| Villager state | 8×8 bubble above head: fork / Zzz / speech / tool. Generic tool for all workers; the specific tool (hoe, sack, millstone) only for the selected villager |
| Rotation | No rotated art; sprites face south; `rot` stays data-only |
| Facing | Derived from interpolation delta in `SnapshotBuffer`. No Rust or IPC change |
| Animation clock | `frame = floor(tick / n) % frameCount` — deterministic, stateless |
| Signature element | Animated 3-frame shoreline foam tracing the whole island |
| Shoreline layer | Entity layer, viewport-culled — **not** baked into the terrain cache |
| HUD panels | Deep shutter-blue timber, 9-slice via CSS `border-image`, bevel matching sun direction |
| HUD type | `<PixelText>` (6×7 bitmap font, caps) for headings/numbers/clock only; Inter for prose |
| Reduced motion | `prefers-reduced-motion` disables ambient loops; villager walk cycles persist |
| Fallback | If atlas or a PNG fails to load, renderer keeps the current flat-color drawing |

## Palette

```
sea         #0e3f52  #12556b  #1f7f92  #2fa0a8   foam #a8e0dc
sand/stone  #8a7455  #c9b483  #e0cfa0  #f2e8c8
vegetation  #2a4430  #3d5f39  #5c7a3e  #8fa249  #b5bb6a
architecture #6b5f4e #9c8b70  #b8a68c  #dcd2bd  #f2ece0
terracotta  #7a3320  #a54428  #c05a34  #e08a5a
accents     shutter #3f6f8f   wheat #d9a531   ink #2b2320
ui          panel #1b3038     raised #26454f   recess #14242a
```

Terrain base colors map onto these ramps, replacing the seven literals currently in `drawTerrain.ts`:

| Terrain | Base |
|---|---|
| DeepWater | `#12556b` |
| ShallowWater | `#2fa0a8` |
| Sand | `#e0cfa0` |
| Grass | `#8fa249` |
| Forest | grass base + cypress prop (`#3d5f39`) |
| Rock | `#b8a68c` |
| Mountain | rock base + peak prop (`#dcd2bd`) |

## Architecture

### Generator — `tools/genart/`

```
tools/genart/
  index.ts          entry; assembles sheets, writes PNGs + atlas.json
  png.ts            minimal PNG encoder over node:zlib
  palette.ts        the 29 named colors; single source of truth
  pack.ts           shelf-packs cells into a sheet, emits cell rects
  sprites/
    terrain.ts      base tiles + variants + fringes + foam frames
    buildings.ts    hut, farm, granary, mill, bakery, scaffolds
    crops.ts        wheat stages 0-3 (+ sway frame on stage 3)
    villagers.ts    3 directions × (4 walk + 1 idle) + lying pose
    props.ts        cypress cluster, mountain peak
    ui.ts           9-slice frames, resource/season/speed icons, 6×7 font
```

Sprites are authored as pixel grids:

```ts
export const HUT = {
  size: [16, 32],
  palette: { '.': null, w: '#f2ece0', t: '#c05a34', s: '#3f6f8f', o: '#6b5f4e' },
  rows: ['.....tttttt.....', '....tttttttt....', /* … */],
};
```

Palette values must be members of `palette.ts`; the generator throws on any color outside it. Grids are legible in a diff, so art changes review like code.

`package.json` gains `"art": "tsx tools/genart/index.ts"` — or a `node --experimental-strip-types` invocation if adding `tsx` as a dev dependency is unwanted. The generator is never part of `build` or `dev`; its output is committed.

### Atlas manifest

`atlas.json` is the contract between generator and runtime:

```jsonc
{
  "sheets": { "tiles": "tiles.png", "entities": "entities.png", "ui": "ui.png" },
  "cells": {
    "hut":        { "sheet": "entities", "x": 0,  "y": 0, "w": 16, "h": 32, "anchorY": 16 },
    "mill":       { "sheet": "entities", "x": 16, "y": 0, "w": 32, "h": 64, "anchorY": 32, "frames": 4 },
    "grass.0":    { "sheet": "tiles", "x": 0, "y": 0, "w": 16, "h": 16 },
    "foam.n":     { "sheet": "tiles", "x": 64, "y": 0, "w": 16, "h": 16, "frames": 3 }
  }
}
```

`anchorY` is the distance from the sprite top down to the top of its footprint — the headroom. A sprite draws at `(tileX * 32, tileY * 32 - anchorY * 2)`. `frames` defaults to 1; frames are laid out horizontally.

### Runtime — `src/render/`

New:

- `atlas.ts` — loads `atlas.json` + sheets, exposes `cell(key)` and `drawCell(ctx, key, x, y, frame)`. Resolves to `null` when loading fails, which is the fallback signal.
- `scene.ts` — builds the per-frame draw list from a `TickSnapshot`, sorts it, paints it. This is where y-sorting, animation frame selection and villager facing live.
- `tilemap.ts` — bakes the terrain layer: base tile + variant + fringes. Precomputes the shoreline tile list for `scene.ts`.
- `PixelText.tsx` (in `src/ui/`) — bitmap-font text.

Changed:

- `drawTerrain.ts` — retained as the fallback path only; `tilemap.ts` is the primary.
- `drawEntities.ts` — retained as the fallback path only; `scene.ts` is the primary.
- `drawGhost.ts` — hatched tile overlay instead of flat alpha.
- `snapshot.ts` — interpolated villagers gain `dx` / `dy`.
- `Canvas.tsx` — per-frame scene assembly moves out to `scene.ts`, leaving input, camera and lifecycle. The file is already 568 lines and owns too much; this keeps it from growing.
- `types.ts` — `sprite?: string` on `BuildingDef` and `CropDef`; `dx?` / `dy?` on the interpolated villager view.

### Rust

One change only: `sprite: Option<String>` on `BuildingDef` and `CropDef` in `catalog.rs`, passed through by `get_catalog()`. No sim, snapshot or IPC changes. Buildings that omit it fall back to `id` on the frontend.

## Behaviour

### Terrain baking

At load, for each tile:

1. Draw base variant `hash(x, y) % 4`.
2. For each of the 4 neighbours whose terrain has **higher** priority, overlay that terrain's fringe for that edge; then overlay corner fringes where two adjacent edges both fringe (outer) or where only the diagonal neighbour is higher (inner).
3. If the terrain is Forest or Mountain, record a standing prop for the entity layer — props are **not** baked, because they y-sort against villagers and buildings.

Priority: `DeepWater(0) < ShallowWater(1) < Sand(2) < Grass(3) < Rock(4)`.

Forest and Mountain have no priority of their own — they fringe as their base tile. A Forest tile is Grass(3) for fringe purposes, a Mountain tile is Rock(4). This is why the props are a separate layer rather than a sixth and seventh tile set.

`hash(x, y)` is a fixed integer hash, so the same world always bakes identically — consistent with the project's determinism rule and stable across save/load.

Cost: roughly 50k `drawImage` calls into the existing 4096×4096 offscreen canvas at load, replacing 16k `fillRect`. One time, a few hundred ms. If it measures worse than 500ms, bake in row chunks across frames rather than blocking.

Dirty tiles re-bake the affected tile **and its 8 neighbours**, since a terrain change alters neighbouring fringes. The same pass updates the shoreline tile list and the prop list for those 9 tiles — both are derived from terrain, so both go stale on a dirty tile.

### Draw list

`scene.ts` emits one entry per visible object:

```
{ rank, baseY, id, key, frame, x, y, tint? }
```

sorted ascending by `(rank, baseY, id)`.

- `rank 0` — the farm field. Flat, painted before anything standing on it.
- `rank 1` — buildings, terrain props, villagers.
- `rank 2` — status bubbles, selection brackets.

`baseY` is the world-y of the sprite's bottom edge. The `id` tie-break makes ordering total and deterministic.

The rank split is what stops a 3×3 farm — whose bottom edge sits below its own crops — from painting over its wheat. Crops sit at `rank 1` with `baseY` at their tile bottom.

### Villager facing and animation

`SnapshotBuffer.interpolate` already holds two snapshots. Per villager it now also emits `dx` / `dy`, the position delta between them. Only the sign and relative magnitude matter, so the units are whatever the delta already is — no normalisation.

```
facing = |dx| > |dy| ? (dx > 0 ? East : West) : (dy > 0 ? South : North)
```

When `dx` and `dy` are both zero the villager holds its **last** facing rather than snapping to a default; `scene.ts` keeps a small `id → facing` map for this. West draws East mirrored via `ctx.scale(-1, 1)`.

Frame selection:

| Thing | Ticks per frame | Frames |
|---|---|---|
| Villager walk | 3 | 4 |
| Shoreline foam | 8 | 3 |
| Mill sails | 4 | 4 |
| Bakery smoke | 6 | 3 |
| Wheat / cypress sway | 12 | 2 |

State (`VillagerView.state`) selects the pose and bubble:

| State | Pose | Bubble |
|---|---|---|
| 0 Idle | idle | — |
| 1 Moving | walk cycle | — |
| 2 Working | idle | generic tool (specific tool if selected) |
| 3 Eating | idle | fork |
| 4 Sleeping | lying | Zzz |
| 5 Socializing | idle | speech |

The tool bubble needs the villager's job kind, which is currently only in `get_villager_detail`. Rather than widening the tick payload, `scene.ts` draws a generic tool bubble for `Working` and the specific tool only for the selected villager, whose detail is already fetched. Widening the snapshot for this is not worth the payload.

### Buildings

`state !== 2` draws the scaffold sprite for the building's footprint size instead of the building, with the progress bar restyled to a segmented pixel bar. `state === 2` draws the building sprite.

Building sprites are authored facing **south only**. No rotated art, and the camera stays fixed-orientation.

Note that all five buildings in `buildings.json` currently have square footprints — `[1,1]`, `[3,3]`, `[2,2]`, `[2,2]`, `[2,2]` — and `rot` only swaps footprint width and height. Rotation therefore has no observable effect in the game as it stands. `rot` stays in the data model because a future non-square building (a 2×3 dock or stable) would need it, but no art is spent on it and the redesign does not make it visible.

This leaves the `R` key advertised in the canvas hint doing nothing. Removing that affordance is a one-line HUD change, but it is a gameplay decision rather than an art one, so it is **out of scope here** and flagged for a separate call.

### HUD

- **Panels** — `border-image: url(/art/ui.png) 6 fill repeat` with `image-rendering: pixelated`, applied through Tailwind arbitrary properties. No JS.
- **PixelText** — container carries `aria-label={text}`; glyph spans are `aria-hidden` with `background-position` into the font strip. Caps, digits and ~12 punctuation marks, 48 glyphs at 6×7.
- **BuildMenu** — each entry shows its building sprite from `entities.png`. Locked entries desaturate and show a padlock glyph; the unlock condition stays Inter.
- **ResourceBar** — six 16×16 icons (log, block, sheaf, sack, loaf, coin); counts in `<PixelText>`.
- **ClockBar** — four season glyphs; speed as pause/chevron glyphs.
- **VillagerPanel** — needs render as segmented ten-notch bars with ink outlines. Name and traits stay Inter.
- **Selection** — four corner brackets plus contact glow, replacing the yellow stroke rect.
- **Focus** — visible shutter-blue pixel focus ring on every interactive element.

### Reduced motion

`prefers-reduced-motion: reduce` freezes foam, sails, smoke and sway at frame 0. Villager walk cycles continue, because they communicate movement state rather than decorate.

### Fallback

If `atlas.json` or any sheet fails to load, `atlas.ts` resolves `null` and the renderer uses the existing `drawTerrain` / `drawEntities` flat-color path. The game stays playable rather than blank. This is why those two modules are retained rather than deleted.

## Build order

Three phases, each ending in a running game. The fallback path is what makes this possible: until a phase lands, its objects keep drawing as flat shapes, so the game is never broken mid-redesign.

**Phase 1 — pipeline and terrain.** `tools/genart/` with the PNG encoder, palette and packer; terrain base tiles, variants and fringes; `atlas.ts` and `tilemap.ts`; the shoreline foam. Ends with an animated tilemapped island under unchanged flat-shape entities. This phase carries all the pipeline risk, so it goes first and alone.

**Phase 2 — entities.** Building sprites, scaffolds, crop stages, terrain props, villager sprites and bubbles; `scene.ts` with y-sorting; the `sprite` catalog field and the Rust passthrough; `snapshot.ts` facing deltas. Ends with the world fully in pixel art.

**Phase 3 — HUD.** `ui.png`, 9-slice frames, the bitmap font and `PixelText`, panel restyling, icons, segmented bars, focus rings, reduced-motion handling.

## Testing

| Test | Guards |
|---|---|
| `art.test.ts` | Regenerates the atlas in memory and byte-compares the committed PNGs — art and source cannot drift |
| `atlas.test.ts` | Every `sprite` key in `buildings.json` / `crops.json` resolves to a cell; every terrain enum has a base tile |
| `scene.test.ts` | Draw-list ordering: a farm sorts before its crops; a villager south of a building sorts after it; ordering is stable for equal `baseY` |
| `snapshot.test.ts` | `dx` / `dy` derivation and facing, including zero-delta holding the last facing |
| `tilemap.test.ts` | Fringe selection for each neighbour configuration; variant hash is stable for a given `(x, y)` |

`render_game_to_text()` gains `art: { loaded: boolean, cells: number }` so the Playwright smoke flow can assert art actually loaded rather than silently passing on the fallback path.

## Risks

| Risk | Mitigation |
|---|---|
| Terrain bake blocks the load for too long | Measure; chunk by row across frames if over 500ms |
| Non-integer camera zoom shimmers upscaled art | `image-rendering: pixelated` is already set; if it reads badly, snap zoom to 0.5 steps |
| Hand-authoring ~180 cells is the bulk of the work | Sprites are independent — build terrain first and ship it working before entities and UI |
| Bitmap font hurts readability | Confined to caps headings, numbers and the clock; all prose stays Inter |
| Atlas keys drift from catalog ids | `atlas.test.ts` fails the build |
