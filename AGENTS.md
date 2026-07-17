# AGENTS.md

## Cursor Cloud specific instructions

VillageSim is a Tauri 2 desktop app: an authoritative Rust simulation (`src-tauri/`) streams
20 Hz snapshots to a React + Canvas renderer (`src/`). Standard dev/test/build commands are in
`README.md`; the milestone roadmap is in `docs/villagesim-spec.md`.

### Running / visual testing in the cloud VM

- Use the browser dev server for visual verification: `npm run dev` serves at
  `http://127.0.0.1:5173/`. When not running inside Tauri, the frontend automatically uses a
  deterministic **browser-demo** transport that reproduces island terrain + an orbiting villager,
  so the full render/interpolation/camera pipeline is testable without a desktop webview.
- The real desktop app (`npm run tauri dev` / `cargo run`) needs a display + WebKitGTK and will
  not render in the headless cloud VM. Prefer `npm run dev` for demos/screenshots here; use
  `cargo test --lib` and `cargo check` to validate the Rust side.
- Deterministic test hooks exposed on `window`: `advanceTime(ms)` and `render_game_to_text()`
  (used by the Playwright smoke flow described in the M1 plan). The browser-demo timer is paused
  when the URL has `?test=1` so time only advances via `advanceTime`.
- Camera: drag to pan, wheel to zoom (cursor-anchored). `render_game_to_text()` includes camera
  state (`x`, `y`, `zoom`, viewport size).

### Non-obvious gotchas

- `vite.config.ts` sets `build.target` to `es2020` (not the Tauri template's `safari13`). esbuild
  in Vite 8 cannot lower destructuring to Safari targets, which breaks `npm run build`; `es2020`
  output still runs on the Tauri webviews. Do not revert this to `safari13`.
- App icons in `src-tauri/icons/` are required by Tauri's `generate_context!` (build fails without
  `icon.png`). Regenerate from the source with `npm run tauri icon app-icon.png`.
- The Rust crate uses edition 2024, so a Rust toolchain `>= 1.85` is required.
- Default world is `128×128` tiles at 32px (`4096×4096` offscreen terrain cache). Keep terrain out
  of tick payloads; only `get_terrain` sends the full grid.
