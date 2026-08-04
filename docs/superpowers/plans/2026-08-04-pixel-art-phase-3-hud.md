# Pixel Art Phase 3 — HUD Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the entire HUD with Mediterranean pixel-art panels, a bitmap display font, sprite icons and segmented need bars, so the UI matches the Phase 1–2 world art while prose labels stay in Inter.

**Architecture:** Declarative `{ size, palette, rows }` grids in `tools/genart/sprites/ui.ts` rasterize into a third `ui` sheet packed alongside `tiles` and `entities`. Runtime `<PixelText>` renders caps/numbers via CSS `background-position` into the font strip; panels use CSS `border-image` on `ui.png`. HUD components keep their data flow — only presentation changes. Flat Tailwind styling remains the fallback when `ui.png` fails to load (atlas still loads; only the ui sheet is optional for graceful degradation via CSS).

**Tech Stack:** TypeScript, existing genart pipeline, React 19, Tailwind 4, Vitest 4 (Node-only tests for pure font logic).

**Spec:** `docs/superpowers/specs/2026-07-31-pixel-art-ui-redesign-design.md`

## Global Constraints

- Same as Phases 1–2: no new runtime deps; Node-only Vitest for pure logic; palette-only colors; `ART_SCALE = 2` on canvas.
- `<PixelText>` is for headings, numbers and clock only; trait names, unlock conditions, chronicle prose stay Inter.
- `border-image` + `image-rendering: pixelated` for panels — no JS panel renderer.
- Chronicle drawer gets panel chrome but keeps Inter for entry text (M10 event-log styling absorbs it later per spec).
- Selection brackets on the canvas move from vector strokes to atlas corner glyphs when the ui sheet is loaded.

## Deviations from the spec

**1. Font strip is one atlas cell (`font.strip`) with a shared glyph-order table in `src/ui/font.ts`.** Individual per-glyph cells would bloat the manifest; a horizontal strip matches the spec's `background-position` approach and keeps `PixelText` simple.

**2. Build-menu building thumbnails reuse `entities` sheet cells via `<AtlasThumb>`, not duplicate art in `ui.png`.** The spec says "building sprite from entities.png"; no need to re-author.

**3. HUD does not add animated ambient loops.** `prefers-reduced-motion` handling for Phase 3 is a no-op on the HUD itself; canvas ambient loops were wired in Phase 1–2.

## File structure

**Create**

| File | Responsibility |
|---|---|
| `tools/genart/sprites/ui.ts` | 9-slice panel, font strip, resource/season/speed icons, padlock, bar notch, bracket corners. |
| `src/ui/font.ts` | Glyph order, `glyphIndex`, `normalizePixelText` (uppercase + supported chars). |
| `src/ui/font.test.ts` | Glyph index stability; unsupported char → skip. |
| `src/ui/PixelText.tsx` | Bitmap-font spans with `aria-label`. |
| `src/ui/SegmentedBar.tsx` | Ten-notch need bar with ink outline. |
| `src/ui/AtlasThumb.tsx` | `<img>` or div background from atlas cell for build-menu thumbs. |
| `public/art/ui.png` | Generated, committed. |

**Modify**

| File | Change |
|---|---|
| `tools/genart/build.ts` | Pack `ui` sheet; manifest adds `ui.png`. |
| `src/styles.css` | `.pixel-panel`, `.pixel-focus`, `image-rendering: pixelated` utilities. |
| `src/ui/ResourceBar.tsx` | Icons + `<PixelText>` counts; pixel panel chrome. |
| `src/ui/ClockBar.tsx` | Season glyph + `<PixelText>` clock; speed icon buttons. |
| `src/ui/BuildMenu.tsx` | Entity thumbs, padlock glyph, pixel panels, focus rings. |
| `src/ui/VillagerPanel.tsx` | `<PixelText>` name heading; `<SegmentedBar>` needs. |
| `src/ui/ChronicleDrawer.tsx` | Pixel panel chrome on drawer shell. |
| `src/App.tsx` | Pixel-styled header title. |
| `src/render/scene.ts` | Atlas bracket corners when `ui.bracket` cells exist. |
| `src/render/atlas.test.ts` | Assert ui sheet cells. |
| `progress.md` | Mark Art Phase 3 complete. |

## Atlas keys (contract)

| Key | Size | Notes |
|---|---|---|
| `ui.panel` | 18×18 | 9-slice; CSS slice 6 |
| `font.strip` | 288×7 | 48 glyphs × 6px |
| `ui.icon.wood` … `ui.icon.gold` | 16×16 | Resource icons |
| `ui.icon.spring` … `ui.icon.winter` | 16×16 | Season glyphs |
| `ui.icon.pause`, `ui.icon.speed1` … `ui.icon.speed3` | 16×16 | Speed controls |
| `ui.icon.lock` | 8×8 | Locked building overlay |
| `ui.bar.notch` | 4×6 | Filled segment tile |
| `ui.bar.notch.empty` | 4×6 | Empty segment tile |
| `ui.bracket.tl/tr/bl/br` | 8×8 | Selection corners |

## Tasks

### Task 1: UI sprite authoring

- Create `tools/genart/sprites/ui.ts` with Mediterranean shutter-blue 9-slice frame (bevel top-left sun)
- Font strip: ` ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:/-%!?'+=*`
- Resource, season, speed, lock icons; bar notches; bracket corners

### Task 2: Pack ui sheet

- `uiSources()` in `build.ts`; manifest `sheets.ui = 'ui.png'`
- `npm run art`; drift test green

### Task 3: Font logic + PixelText

- `font.ts` + tests (no DOM)
- `PixelText.tsx` — caps, `aria-label`, 2× scale (12×14 display px per glyph)

### Task 4: Shared UI chrome

- `styles.css`: `.pixel-panel`, `.pixel-btn`, `.pixel-focus`
- `SegmentedBar.tsx`, `AtlasThumb.tsx`

### Task 5: Component restyle

- ResourceBar, ClockBar, BuildMenu, VillagerPanel, ChronicleDrawer, App header
- Building thumbs from entities atlas; locked padlock overlay

### Task 6: Canvas selection brackets

- `paintScene` draws four `ui.bracket.*` corners when cells exist; vector fallback preserved

### Task 7: Docs + progress

- Update `progress.md`; atlas tests for ui cells

## Definition of done

- [ ] `npm test` / `npm run build` / `npm run art` (clean tree) all pass
- [ ] `npm run dev` shows pixel HUD panels, icons, bitmap numbers/clock
- [ ] Build menu shows entity sprites; locked entries show padlock
- [ ] Villager needs use segmented bars
- [ ] Selection uses atlas brackets when ui sheet loaded
- [ ] Prose (traits, chronicle, hints) remains Inter
