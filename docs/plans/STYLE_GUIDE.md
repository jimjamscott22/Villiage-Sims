# VillageSim Art Style Guide (v1, locked)

Implementation status: the style-lock plan's phases A–I are complete on
`main` in [PR #64](https://github.com/jimjamscott22/Villiage-Sims/pull/64), merge
commit `4e1c497` (reviewed branch head `04de942`). See the [phase checklist](CLAUDE_CODE_PLAN.md#implementation-status).
The proposal labels and pixel counts below describe the original `f30bcf5`
baseline; they are retained as design history, not a current implementation audit.
Rules outside phases A–I, such as uniform sprite lighting and future sprite-size
conventions, have not been newly audited or marked complete.

Based on the repo at commit `f30bcf5`. **[PROPOSAL]** marks a rule that is new. Everything unmarked is already true in the repo.

## 1. Locked palette: 27 colours (25 art + 2 UI-only)

Starting point: `tools/genart/palette.ts` defines **29** colours (the earlier review said 33; that was a miscount). All 29 appear in the sheets.
**[PROPOSAL]** Four merges take it to **25 art colours**. Adding `uiBg` and `highlight` gives **27 locked tokens**. `uiText` is an alias of `whitewash`, not a new colour.

| Name | Hex | Ramp | Role | Current px |
|---|---|---|---|---|
| seaDeepest | #0e3f52 | sea 1 | deep-water base | 338 |
| seaDeep | #12556b | sea 2 | water; **[PROPOSAL]** button hover (replaces #2f5562) | 2149 |
| seaMid | #1f7f92 | sea 3 | water | 1130 |
| seaShallow | #2fa0a8 | sea 4 | shallows | 1874 |
| foam | #a8e0dc | sea 5 | shoreline foam | 638 |
| sandShadow | #8a7455 | sand 1 | ground shade, **contact shadows** | 7651 |
| sandMid | #c9b483 | sand 2 | sand; absorbs stoneLight | 4014 (+1734) |
| sandLight | #e0cfa0 | sand 3 | sand highlight | 5805 |
| vegDarkest | #2a4430 | veg 1 | foliage shade | 233 |
| vegDark | #3d5f39 | veg 2 | forest | 1274 |
| vegMid | #5c7a3e | veg 3 | grass | 1700 |
| vegLight | #8fa249 | veg 4 | grass highlight | 1419 |
| vegPale | #b5bb6a | veg 5 | crop and foliage tips | 114 |
| stoneShadow | #6b5f4e | stone 1 | stone shade | 643 |
| stoneMid | #9c8b70 | stone 2 | stone | 1079 |
| stonePale | #dcd2bd | stone 3 | stone highlight | 1719 |
| whitewash | #f2ece0 | stone 4 | walls; absorbs sandPale; **= uiText** | 2889 (+118) |
| terraDark | #a54428 | terra 1 | roofs, shade; absorbs terraDeep | 4528 (+31) |
| terraMid | #c05a34 | terra 2 | roofs, clothing | 1481 |
| terraLight | #e08a5a | terra 3 | roof highlight | 1071 |
| shutter | #3f6f8f | accent | shutters, active button, focus ring | 1026 |
| wheat | #d9a531 | accent | wheat, gold accents | 1021 |
| ink | #2b2320 | neutral 1 | outlines, darkest value | 9860 |
| uiPanel | #1b3038 | ui 1 | panel fill; absorbs uiRecess | 72 (+278) |
| uiRaised | #26454f | ui 2 | button and chip fill | 158 |

Merges, with RGB distance between the pair:
1. stoneLight #b8a68c → sandMid (23.8)
2. sandPale #f2e8c8 → whitewash (24.3)
3. uiRecess #14242a → uiPanel (19.7)
4. terraDeep #7a3320 → terraDark (lowest-use colour, 31 px)

Considered and rejected: seaDeepest ↔ uiRaised (24.9). They belong to different layers (world vs UI).

**Final locked count: 25 art + uiBg + highlight = 27 tokens.** The table above is complete.

UI-only tokens **[PROPOSAL]**:

| Token | Hex | Role | Replaces (code occurrences) |
|---|---|---|---|
| uiBg | #17211b | app background, text outline | #17211b (10), #0b151c (1), #1c2a21 (1), #1a1510 (2) |
| highlight | #f4c95d | selection, intent arrows, tag borders | #f4c95d (8), #ffd700 (1), #e6c84a (1) |
| uiText | alias of whitewash #f2ece0 | body text | #f7f4e9 (14), #fff6d5 (3), #f4e8d0 (1) |

Other mappings:
- #d4cfc0 and #c5c0a8 → stonePale and stoneMid
- #b6f28a (debug/positive green, 3) → vegPale
- #d4a85a → wheat
- #a8b0b5 → stonePale
- #2f5562 (hover) → seaDeep
- #ff00ff stays as the debug "missing" colour only, and is whitelisted.

## 2. Pixel rules
- Art is drawn at 16px and shown at ×2 (`ART_SCALE = 2` in `src/render/atlas.ts`) on a 32px world grid (`DEFAULT_TILE_SIZE = 32` in the Rust code, `world.rs`).
- Nearest-neighbour everywhere: `imageSmoothingEnabled = false` (already set, `Canvas.tsx` lines 398 and 537) and `image-rendering: pixelated` in CSS (already set).
- **[PROPOSAL]** Zoom is limited to 0.25, 0.5, 1, 2, 3, 4. Today it is continuous (factor 1.1 per notch, `Canvas.tsx:843`; clamp 0.25–4.0, `camera.ts:1-2`).
- Camera position snaps to device pixels (already done, `camera.ts` ~lines 68-76).
- All art uses palette colours only, at full opacity (already true: no partial alpha found in any sheet).

## 3. Sprite and tile spec (from atlas.json)

| Sheet | Size | Cell sizes (count) |
|---|---|---|
| tiles.png | 256×128 | terrain/fringe/foam 16×16 (88) |
| entities.png | 256×1024 | see list below |
| ui.png | 256×32 | icons 16×16 (14), 8×8 (5), bar notch 4×6 (2), panel 18×18 (1), font.strip 144×14 (1) |
| panel.png | 18×18 | 9-slice frame, 6px slice |

entities.png cells:
- villager 16×24 (279 cells)
- hut 16×32
- well 16×32
- granary, bakery, storehouse 32×48
- mill 32×64, 4 frames
- farm 48×48 and 16×24
- fence, gate, signpost 16×24
- chicken_shelter 16×28
- chicken 12×14 (1–2 frames) and 6×7
- crops 16×16 (1–2 frames)
- bubble 8×8
- scaffold 16×24, 32×40, 48×56
- props 16×16, 16×24, 16×32

Rules:
- Sprite width is a multiple of 16, except small actors (chicken 12×14, bubble 8×8).
- Height may extend above the tile footprint, with the overhang recorded as `anchorY`.
- **[PROPOSAL]** New sprites use footprint × 16 for width and a height that is a multiple of 8.

## 4. Outline rule [PROPOSAL, partly true today]
- Standing objects (buildings, villagers, chickens, fences, gates, signposts, shelters, scaffolds, standing props) get a 1px `ink` outline.
- Ground items (terrain, crops, ground props) get no outline.
- Current share of each sprite's edge pixels that are ink:

| Already outlined | Ink % | Missing outline | Ink % |
|---|---|---|---|
| bubble | 100 | fence | 0 |
| bakery | 64 | gate | 0 |
| mill | 51 | signpost | 0 |
| granary | 51 | chicken_shelter | 0 |
| storehouse | 40 | chicken | 2 |
| hut | 38 | | |
| villager | 37 | | |
| scaffold | 37 | | |
| well | 21 | | |

- Crops (wheat 2%, carrot 0%, peas 1%, strawberry 4%) already follow the rule.

## 5. Light and shadow
- Contact shadow under standing objects, in `sandShadow` (already done in `buildings.ts` at "Contact shadow" lines 59 and 304).
- **[PROPOSAL]** Light comes from the top-left. Highlights go on top/left faces and the shade ramp on right/bottom faces.
- No cast shadows.
- Night and weather tinting happens at render time, not in the sprites.

## 6. Fonts
- HTML UI: Pixelify Sans (`@fontsource/pixelify-sans`, `styles.css:7`), with the 1px uiBg outline (`.pixel-text-outline`).
- **[PROPOSAL]** Canvas labels (name tags, intent labels, thought bubbles, debug overlay) use the bitmap `font.strip`: 6×7 glyphs, 48 glyphs, ×2 scale (`src/ui/font.ts`).
- Fonts to replace:
  - `nameTags.ts:7` (`ui-sans-serif`)
  - `intentOverlay.ts:151` (`ui-sans-serif`)
  - `drawEntities.ts:17` (`ui-monospace`)
  - `Canvas.tsx:545` (`ui-monospace`)
- The strip is uppercase-only, so canvas text is shown in uppercase (already done by `normalizePixelText`).

## 7. UI 9-slice
- Frame source is `panel.png`, 18×18, with a 6px slice.
- **[PROPOSAL]** Every frame uses `border-width: 6px` so the frame shows at exactly 1:1.
  - Correct today: `.pixel-panel` (`styles.css:19`).
  - Wrong today: `.pixel-btn` (`styles.css:28`) and `.pixel-chip` (`styles.css:54`) use 4px.
- Fills: panel = uiPanel, button/chip = uiRaised, hover = seaDeep **[PROPOSAL]**, active/focus = shutter.

## 8. Naming
- Atlas keys are dotted, lowercase: `<group>.<thing>[.<variant>]`, for example `ui.bar.notch`, `ui.bar.notch.empty`, `font.strip`.
- Multi-word groups use snake_case (`chicken_shelter`).
- Sheets are named by layer: `tiles`, `entities`, `ui`, `panel`.
- Palette names are camelCase `ramp + step`.
- **[PROPOSAL]** The project is "VillageSim" everywhere. The GitHub repo name "Villiage-Sims" is a known misspelling (rename is optional).

## 9. Deviations to fix

| # | Where | What |
|---|---|---|
| 1 | src/ code | 35 of 38 hex values are off-palette (full file:line list in CLAUDE_CODE_PLAN.md, Phase B) |
| 2 | drawTerrain.ts:5-11 | 7 fallback terrain colours off-palette |
| 3 | drawEntities.ts:3-4 | 7 fallback building/crop colours off-palette |
| 4 | camera.ts / Canvas.tsx:843 | continuous zoom (×1.1 per notch) |
| 5 | nameTags.ts:7, intentOverlay.ts:151, drawEntities.ts:17, Canvas.tsx:545 | system fonts on canvas |
| 6 | styles.css:28, :54 | 4px border on a 6px slice |
| 7 | fence, gate, signpost, chicken_shelter (0% ink); chicken (2%) | missing outlines |
| 8 | palette.ts | 4 near-duplicate or low-use colours to merge |
