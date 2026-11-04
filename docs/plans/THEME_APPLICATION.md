# Applying the Gridwright Medieval Village look to VillageSim

- **Reference:** Gridwright, "Medieval Village: 16x16 Pixel Art Fantasy Town Tileset" (itch.io, v1.0).
- **Repo:** VillageSim `main` at `c762426`.
- **Locked spec:** STYLE_GUIDE.md, 26 art colours (including `highlight` `#f4c95d`) plus `uiBg` (27 unique colours, 28 tokens with `uiText`).
- **Reference only.** No asset from the pack is copied, traced, or imported. Every idea below is redrawn in `tools/genart` code, using palette colours only. (The pack's licence would allow shipping its tiles, but that would break the guide's "all art is generated, 26 colours" rule. See section 3.)

## 0. What I looked at, and what I could not see
- **Read:** the itch page text.
- **Downloaded and viewed:** 4 of the 7 preview images (1920×1080 PNGs), shown to me downscaled to about 1024 px wide:
  - the night demo village
  - the winter demo village
  - the roof/facade kit sheet
  - the 57-prop sheet
- **Not viewed:** two animated GIFs (I only decoded their sizes, 1920×1080 and 630×500) and one 960×208 strip.
- **Not downloaded:** the free sample or the full pack, so I have no exact pixel sizes, palette, or outline colour from the source files.
- Colour counts in the screenshots (152–425 unique) include UI text and scaling, so they are not a reliable palette size.
- Every statement about the reference's look below is a visual impression from downscaled previews, unless it quotes the page.

## 1. What in the reference is worth borrowing
From the page text, except where marked as seen:

| # | Reference trait | Source |
|---|---|---|
| R1 | "Strict 16x16 grid"; larger pieces are exact multiples (stalls 48×32, windmill 48×64, trees 32×48) and "stand on their bottom row" | page |
| R2 | Facade materials including **whitewash** and **clay tile** roofs; houses built from ridge/slope/eave roof rows over a facade row | page; seen in the kit sheet |
| R3 | **Lit night versions** of windows and counters, and wall lanterns and lamp posts in day and night versions | page; seen in the night demo (warm yellow windows on a dark blue-green scene) |
| R4 | "**No baked shadows**", leaving shadows to the engine | page |
| R5 | Every roof also comes **snow-covered**; buildings come in day, lit and winter variants | page; seen in the winter demo |
| R6 | Facade overlays: **hanging shop signs with icons and no words**, flower boxes, ivy, chimneys with animated smoke | page; seen |
| R7 | Village props: market stalls, well, fountain, notice board, signpost, barrels, crates, sacks, woodpile, benches, a cobblestone road autotile | page; seen |
| R8 | Dark outlines around props and buildings, with a muted, slightly desaturated ramp per material | seen (impression only) |

## 2. How each maps to VillageSim

### R1. Bottom-row anchoring: already true; heights differ
- VillageSim cells already stand on their footprint, with the overhang above recorded as `anchorY` (`atlas.json`, `BUILDING_SPRITES` in `tools/genart/sprites/buildings.ts` line 473).
  - hut 16×32 (anchorY 16), well 16×32 (16)
  - granary, bakery, storehouse 32×48 (16)
  - mill 32×64 (32)
- Heights that are **not** multiples of 16:
  - fence, gate, signpost 16×24
  - chicken_shelter 16×28
  - scaffolds 16×24, 32×40, 48×56
- STYLE_GUIDE.md §3 already proposes "height a multiple of 8", which all of these meet except chicken_shelter (28). **No change is needed** beyond optionally padding chicken_shelter to 32 or shrinking it to 24, which is low value.

### R2. Whitewash and clay-tile facades: VillageSim's existing look
- The hut is "whitewash, terracotta roof" (buildings.ts line 22). Its palette is terraMid/terraDark/terraLight, whitewash, shutter and ink (lines 24-29). Granary and bakery use the same ramp (lines 122-130, 170-175).
- What the reference adds is **structure**: a roof with distinct ridge, slope and eave rows (light ridge, mid slope, dark eave lip), and a facade row with window and door pieces.
- Mapping: a shared `roof()` / `facade()` helper in genart so all 5 houses use the same roof rows and tile rhythm. Today each sprite hand-paints its roof (for example "Roof triangle in headroom (y 2..15)", line 33).
- Palette: the existing terra ramp (3 steps) plus whitewash and ink. **No new colour.**

### R3. Lit night windows as separate sprites: strong fit
- Windows today are solid `shutter` #3f6f8f blocks:
  - hut x 4-7, y 18-22 (lines 47-52)
  - granary x 8-11 and 20-23, y 20-24 (lines 146-150)
- The game has no night lighting yet: no night tint in `src/render`. Night exists only in the sim and demo logic (`demoWorld.ts` lines 262-264: `NIGHT_START_MINUTE = 20*60`, `NIGHT_END_MINUTE = 6*60`). Shot list S-11 (day/night tint) is Todo.
- Mapping: new overlay cells `<building>.lit`, the same size as the base cell, transparent except the window panes, drawn on top of the base when it is night.
- Panes in `highlight` #f4c95d at the centre with a `wheat` #d9a531 inner rim and `terraLight` #e08a5a corner falloff, all in `PALETTE`.
- **[APPROVED by Jamie]** `highlight` (#f4c95d) is promoted from UI-only to the 26th art colour (keeping 27 unique colours / 28 named tokens total across `THEME`) so night windows read as a bright lantern glow even on narrow 4px panes.

### R4. "No baked shadows"
- VillageSim bakes a 1-row contact shadow in `sandShadow` into its sprites: 6 "Contact shadow" blocks across `tools/genart/sprites/*.ts`, for example hut line 59. STYLE_GUIDE.md §5 makes that the rule.
- What is worth borrowing is keeping shadows **separate from the outline**, which PR #64 already does (the shadow is painted after `outlineGrid`). See section 3 for why VillageSim should not drop them.

### R5. Winter roofs: good fit, cheap to gate
- Seasons already gate props: `prop.snowDrift` (season 3) and `prop.fallenLeaves` in `src/render/tilemap.ts`.
- No building has a winter variant; there are no matches for snow or season in `buildings.ts`.
- Mapping: `<building>.snow` overlay cells (roof cap only) in whitewash/stonePale with ink edges, chosen when `clock.season === 3`. Same gate as snowDrift. **No new colour.**

### R6. Facade overlays and signs without words: fits the no-text pixel UI
- The signpost exists (16×24, "a lettered board", line 375). There are no building signs.
- Smoke already exists as a separate effect overlay on the bakery chimney (`scene.ts` line 107; buildings.ts line 236: "smoke is a separate vfx.smoke overlay"). That is the same overlay pattern the reference uses.
- Mapping: 8×8 icon signs (wheat sheaf for the granary, loaf for the bakery, crate for the storehouse) as overlay cells, plus optional flower boxes in vegMid/terraMid. **No new colour.**

### R7. Props and road: overlaps the shot list
- Market stall → S-20 (Market).
- Cobble road autotile → S-21 (worn dirt paths). VillageSim's version should be a **sand-ramp dirt path**, not cobbles, to match its Mediterranean ground.
- Well, signpost and fence already exist.
- Barrels, crates and sacks next to the storehouse/granary are new standing props, 16×16 with an ink outline.

### R8. Dark outlines: matches the guide
- PR #64 locked a 1px ink #2b2320 outline on standing objects, and OUTLINE_PLAN.md finishes the remaining props.
- The reference's outlines look similar (impression only). Nothing new to borrow; it confirms the direction.

## 3. What NOT to borrow
- **Their palette.** The screenshots show far more than 26 colours (152–425 unique per screenshot, inflated by text and scaling). The guide locks 26 art colours, so use its ramps only.
- **Their files.** Importing would bypass genart, the palette guard test (`palette.lint.test.ts`, PR #64) and the "every pixel is a palette colour" sheet test. Also, the pack's 2× and 3× files are only scaled copies, so they add nothing.
- **Dropping baked contact shadows.** VillageSim has no runtime shadow pass. Removing the 6 sandShadow contact shadows would leave buildings floating, and §5 makes them the rule. Keep them.
- **Medieval-fantasy subjects** (smithy and armour stands, weapon racks, graveyard, watchtower, slate and thatch roofs, banners). They clash with VillageSim's Mediterranean set (cypress, palm, terracotta, whitewash, sea) and with its gameplay; there is no combat. Fantasy shop icons such as alchemist and armourer have no matching building.
- **Side-gabled, any-size houses.** VillageSim buildings have fixed catalog footprints, appended to `buildings.json` by index. A free-size house kit adds nothing gameplay can use.
- **Cobblestone streets.** The ground language here is sand, grass and rock, and roads would need sim support (S-21).
- **A separate winter tileset.** Winter is handled by season-gated overlays, not duplicated sheets (sheet-size budget: `entities.png` is 256×1024).

## 4. Prioritized changes

| Rank | Change | Effort | Shot list | New colour? |
|---|---|---|---|---|
| 1 | Day/night tint pass (prerequisite for lit windows) | M | S-11 | No (seaDeepest at partial alpha for night, terraLight for dusk, as in FEATURE_IDEAS) |
| 2 | Lit-window overlays `<b>.lit` for hut, granary, bakery, storehouse, mill | M | new S-25 (P) | No (`highlight` promoted from UI-only to 26th art colour + `wheat` + `terraLight`) |
| 3 | Shared roof/facade helpers (ridge/slope/eave rows) so the 5 houses share one rhythm; can be combined with the top-left light pass (OUTLINE_PLAN Phase 3) | M | — | No |
| 4 | Winter roof-cap overlays `<b>.snow` gated on season 3 | S-M | new S-26 (P) | No |
| 5 | Wordless 8×8 building signs (granary, bakery, storehouse) | S | new S-27 (P) | No |
| 6 | Storage props: barrel, crate, sack (16×16, ink outline) scattered beside storehouse/granary | S | new S-28 (P) | No |
| 7 | Market stall art for when the Market lands | M | S-20 | No |
| 8 | Sand-ramp dirt path autotile (when the sim tracks traffic) | L | S-21 | No |

## 5. Claude Code briefs (top 2)

Shared rules:
- No gameplay change: do not touch `src-tauri/src/sim/**`, `src/state/**` logic, `data/*.json`, or saves.
- Small commits, no push.
- Palette tokens only. After touching genart, run `npm run art`. `npm test` and `npx tsc -b` must pass.

### Brief 1: day/night tint (S-11)
- **Branch:** `render/day-night-tint`
- **Files:**
  - New `src/render/ambience.ts`: a pure function `ambienceFor(minute: number): { color: string; alpha: number }`.
  - New `src/render/ambience.test.ts`.
  - `src/render/Canvas.tsx`: one screen-space `fillRect` after entities, before UI overlays.
- **Colours:** from `THEME` / palette only.
- **Keyframes:**
  - Night (20:00–06:00, matching `NIGHT_START_MINUTE` / `NIGHT_END_MINUTE` in `demoWorld.ts` lines 263-264; read the Rust clock's night window first and use the same values): seaDeepest, α 0.45.
  - Dusk and dawn ramps (±60 min around those times): terraLight, α 0.15.
  - Day (08:00–18:00): α 0.
  - Interpolate linearly.
- **Reduced motion:** the tint still applies; that is fine because it is not motion.
- **Acceptance:**
  - Tests assert alpha = 0 at 12:00, α = 0.45 at 00:00, 0 < α < 0.45 at 06:30 and at 19:30, and that the colour is always a palette token.
  - `palette.lint.test.ts` passes, with no new hex values.
  - `perfStats` frame time at 3× speed is within 1 ms of baseline. Report both numbers.
  - No change to sim output (`cargo test` from inside `src-tauri` is unchanged; Rust files are untouched).
- **Verify:** `npm test -- ambience palette && npx tsc -b && git diff --stat -- src-tauri src/state`. The last command must be empty.

### Brief 2: lit-window overlays
- **Branch:** `art/lit-windows`
- **Depends on:** Brief 1 being merged.
- **Files:**
  - `tools/genart/sprites/buildings.ts`: add `HUT_LIT`, `GRANARY_LIT`, `BAKERY_LIT`, `STOREHOUSE_LIT` and `MILL_LIT`, each the same size as its base (16×32, 32×48 ×3, 32×64). They are transparent except the window panes, at exactly the base window coordinates (for example hut x 4-7, y 18-22; granary x 8-11 and 20-23, y 20-24). Read each base sprite for the rest.
  - Register the overlays in `BUILDING_SPRITES` as `'<b>.lit'` with the same `anchorY`.
  - `src/render/scene.ts`: when `ambienceFor(minute).alpha >= 0.3`, draw `<b>.lit` after the base building and **after** the tint, so the windows glow through the darkness. Completed buildings only, not scaffolds.
- **Colours:** pane centre in `highlight` (`#f4c95d`), 1px `wheat` (`#d9a531`) inner rim, `terraLight` (`#e08a5a`) corners, and existing `ink` mullions such as hut (5,20) and (6,20).
- **Acceptance:**
  - `npm run art` adds exactly 5 cells; the atlas goes from 459 cells to 464. Existing cell x/y/w/h are byte-identical: diff the old and new atlas with the `.lit` keys filtered out.
  - Each `.lit` cell's opaque pixels are a subset of its base's window and mullion pixel coordinates. Add this test in `genart.test.ts`.
  - Sheets have 0 off-palette and 0 partial-alpha pixels; the existing guard covers this.
  - A scene test shows `.lit` drawn at 00:00 and not at 12:00.
- **Verify:** `npm run art && npm test -- genart scene palette && npx tsc -b`

## Open decisions for Jamie
1. Allow a 26th art colour, a lamp yellow (for example #f4c95d, previously UI-only `highlight`), for glowing windows? **Approved by Jamie** (`PALETTE` now has 26 art colours; `THEME` has 27 unique colours / 28 tokens).
2. Add proposed shot-list rows S-25 to S-28 (lit windows, winter caps, signs, storage props) to SHOT_LIST.md?
