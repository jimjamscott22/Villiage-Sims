# Claude Code Plan: VillageSim visual consistency pass

Run inside the VillageSim repo (base commit `f30bcf5`). The spec is `STYLE_GUIDE.md`, which ships with this plan. Its key rules are copied here so this plan stands on its own.

## Ground rules
- `git switch -c art/style-lock`. Make one small commit per phase, with messages like `art(A): ...`. Do not push. Do not open a PR unless you are asked to.
- **No gameplay changes.** Do not touch `src-tauri/src/sim/**`, `src/state/**` logic, tick rates, costs, or AI.
- Do not change `DEFAULT_TILE_SIZE` (32) or `ART_SCALE` (2).
- After every phase, run `npm test` and `npx tsc -b`. Both must pass before you commit.
- Final palette (27 tokens): the 29 colours in `tools/genart/palette.ts`, minus 4 merges, plus `uiBg` #17211b and `highlight` #f4c95d. `uiText` = whitewash #f2ece0.

The merges:

| Remove | Replace with |
|---|---|
| stoneLight | sandMid |
| sandPale | whitewash |
| uiRecess | uiPanel |
| terraDeep | terraDark |

## Phase A: single palette source
- Files:
  - `tools/genart/palette.ts`: add `uiBg`, `highlight`, and the alias `uiText = whitewash` (or put the UI tokens in a `UI_TOKENS` map).
  - New `src/theme/palette.ts`: re-export from `../../tools/genart/palette`. If tsconfig blocks this, move the palette to `src/theme/palette.ts` and have genart import it. `tsconfig.app.json` and `tsconfig.tools.json` may need an include.
  - New `tools/genart/css.ts`: writes `src/theme/palette.css` with `:root { --c-<kebab-name>: #hex; }`. Call it from `tools/genart/index.ts`.
  - `src/styles.css`: `@import "./theme/palette.css";`
  - Optionally expose the tokens to Tailwind 4 through `@theme`.
- Acceptance: one definition of every hex value. Both the CSS file and the TS module are generated or imported from it.
- Verify: `npm run art && git diff --stat && npx tsc -b && npm test`

## Phase B: replace off-palette hex values with tokens
Use `var(--c-…)` in CSS and Tailwind arbitrary values (`text-[var(--c-ui-text)]`), and `PALETTE.x` in TS.

Mapping:

| From | To |
|---|---|
| #f7f4e9, #fff6d5, #f4e8d0 | uiText |
| #17211b, #0b151c, #1c2a21, #1a1510, #352f25, #2b2118 | uiBg (or ink for #352f25 and #2b2118) |
| #f4c95d, #ffd700, #e6c84a | highlight |
| #d4a85a | wheat |
| #d4cfc0, #a8b0b5 | stonePale |
| #c5c0a8 | stoneMid |
| #b6f28a | vegPale |
| #2f5562 | seaDeep |
| #5a4634 | stoneShadow |
| #2a3a1a | vegDarkest |
| #26454f | uiRaised (already in palette; convert to token) |
| #1b3038 | uiPanel (already in palette; convert to token) |
| #3f6f8f | shutter (already in palette; convert to token) |

Occurrences, by file and line:
- `src/ui/SegmentedBar.tsx`: 20
- `src/ui/BuildMenu.tsx`: 165, 166
- `src/ui/ResourceBar.tsx`: 28
- `src/ui/ToastStack.tsx`: 54
- `src/ui/ChickenDemolitionDialog.tsx`: 14 (×2)
- `src/ui/ObjectivesPanel.tsx`: 66, 78, 83, 84, 89
- `src/ui/VillagerRoster.tsx`: 116
- `src/ui/VillagerPanel.tsx`: 52, 78, 81
- `src/App.tsx`: 184-189, 250, 252, 342 (×2)
- `src/render/scene.ts`: 551
- `src/render/Canvas.tsx`: 467, 544, 901, 928
- `src/render/drawEntities.ts`: 25, 26, 40, 59, 62 (×2), 89 (×2), 111 (lines 3-4 are handled in Phase C)
- `src/render/nameTags.ts`: 105, 108 (×2)
- `src/render/intentOverlay.ts`: 149, 231
- `src/styles.css`: 5, 6, 23, 31, 39, 47, 57, 61, 119 (×8)

Also convert the `rgba(...)` literals to palette RGB with alpha: `Canvas.tsx` ~542, `drawEntities.ts` ~92, `nameTags.ts` ~103/105, `intentOverlay.ts` ~150. Use a helper `withAlpha(PALETTE.x, a)`.

- Acceptance: `rg -n '#[0-9a-fA-F]{6}\b' src --glob '!*.test.*' --glob '!src/theme/**'` returns only the whitelisted `#ff00ff` debug colour.
- Verify: that `rg` command, then `npm test`.

## Phase C: fallback colours from the palette
- Files: `src/render/drawTerrain.ts` (lines 5-11), `src/render/drawEntities.ts` (lines 3-4).
- Terrain fallback, by terrain type:

| Terrain | Token |
|---|---|
| DeepWater | seaDeep |
| ShallowWater | seaShallow |
| Sand | sandMid |
| Grass | vegMid |
| Forest | vegDark |
| Rock | stoneMid |
| Mountain | stonePale |

- Building fallback: sandMid / vegLight / stoneMid.
- Crop stages: vegDark, vegMid, vegLight, wheat.
- Keep `#ff00ff` for the missing case only, as the named constant `DEBUG_MISSING`.
- Acceptance: no literal hex values left in either file except `DEBUG_MISSING`.
- Verify: `npm test -- src/render`

## Phase D: integer zoom steps
- Files: `src/render/camera.ts`, `src/render/Canvas.tsx` (~843-844 wheel handler, ~617 `Math.max(camera.zoom, 1)`), `src/render/camera.test.ts`.
- Add `ZOOM_STEPS = [0.25, 0.5, 1, 2, 3, 4]` and `stepZoom(dir)`. The wheel handler moves one step and keeps `zoomAt` cursor anchoring.
- `fit()` (~line 40) snaps down to the largest step that fits.
- Remove the 1.1 factor.
- Acceptance: `camera.zoom` is always a member of `ZOOM_STEPS`. Add tests for step up, step down, the clamps, and fit-snapping.
- Verify: `npm test -- camera`

## Phase E: unify fonts
- Files: `src/render/nameTags.ts:7`, `src/render/intentOverlay.ts:151`, `src/render/drawEntities.ts:17`, `src/render/Canvas.tsx:545`.
- Add `src/render/bitmapText.ts`, which draws `font.strip` glyphs from the ui atlas onto the canvas. Reuse `FONT_GLYPHS`, `GLYPH_WIDTH`, `GLYPH_HEIGHT`, `GLYPHS_PER_ROW` and `normalizePixelText` from `src/ui/font.ts`.
- Name tag and label widths must use glyph metrics (6px × scale) instead of `measureText`. Update `nameTags.test.ts` and `intentOverlay.test.ts`.
- HTML stays Pixelify Sans.
- Acceptance: `rg -n "ui-sans-serif|ui-monospace" src` matches only the CSS fallback stack in `styles.css:7`.
- Verify: that `rg`, then `npm test -- nameTags intentOverlay`

## Phase F: 6px 9-slice borders
- File: `src/styles.css`, lines 28 and 54: change `border-width: 4px` to `6px`.
- Check `BuildMenu.tsx`, `ResourceBar.tsx` and `ClockBar.tsx` for padding or fixed sizes that now overflow, and reduce the inner padding by 2px if needed.
- Acceptance: every `border-image: url(/art/panel.png) 6` rule has `border-width: 6px`.
- Verify: `rg -n "border-width" src/styles.css`, and do a visual check with `npm run dev`.

## Phase G: outline pass in the generator
- Files: `tools/genart/sprites/props.ts` (fence, gate, signpost), `tools/genart/sprites/chickens.ts` (chicken, chicken_shelter, wherever each is defined), and if useful a shared `outline(grid, 'ink')` helper in `tools/genart/raster.ts` or `grid.ts`.
- Rule: add a 1px `ink` border on transparent pixels touching the silhouette, without growing the cell. Shave 1px of interior if needed. Do not outline crops or terrain.
- Acceptance: at least 30% of edge pixels are ink for each of fence, gate, signpost, chicken_shelter and chicken. Today they are 0, 0, 0, 0 and 2%. Add this as a test in `tools/genart/genart.test.ts`.
- Verify: `npm run art && npm test -- genart`

## Phase H: palette merge and regenerate
- Files: `tools/genart/palette.ts`, plus every sprite file that references the removed names (`rg -n "stoneLight|sandPale|uiRecess|terraDeep" tools/genart`). Today that is buildings, props, villagers, chickens, terrain, vfx and ui.
- Replace each removed name with its merge target (table under Ground rules), then `npm run art`. This rewrites `public/art/*.png`, `atlas.json` and the icons.
- Atlas cell coordinates and sizes must stay unchanged: `git diff public/art/atlas.json` should be empty or contain only a hash.
- Acceptance: the palette has 25 art entries plus uiBg and highlight. The PNGs contain at most 25 unique opaque colours in total.
- Verify: `npm run art && npm test && python3 -c "from PIL import Image;s=set();[s.update(p[:3] for p in Image.open(f'public/art/{f}.png').convert('RGBA').getdata() if p[3]) for f in ['tiles','entities','ui','panel']];print(len(s))"` should print ≤25.

## Phase I: off-palette guard
- New file: `src/theme/palette.lint.test.ts` (Vitest).
  - Walk `src/**/*.{ts,tsx,css}`, skipping tests and `src/theme/**`.
  - Fail on any `#rrggbb` / `#rgb` that is not in the palette or the whitelist (`#ff00ff`).
  - Also fail on `rgb(a)(` literals whose RGB is off-palette.
- Extend `tools/genart/palette.test.ts` to assert that every opaque pixel in `public/art/*.png` is a palette member.
- Acceptance: the test passes on the branch. Adding `#123456` anywhere in src makes it fail.
- Verify: `npm test -- palette`

## Done when
- All phases are committed on `art/style-lock`.
- `npm test`, `npx tsc -b` and `npm run build` pass.
- `npm run dev` shows no visual regressions other than the intended ones.
- Write a summary of the changes and include before/after screenshots if possible.
