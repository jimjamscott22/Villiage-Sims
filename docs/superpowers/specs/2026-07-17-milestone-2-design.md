# VillageSim Milestone 2 Design

## Scope

Milestone 2 replaces the M1 checkerboard with seeded procedural terrain and adds a navigable camera. The deliverable is a runnable app that shows a recognizable island (coastline, forest, mountains) and supports pan/zoom at 60fps while keeping the M1 simulation pipe (20 Hz tick, fake orbiting villager, interpolation).

Out of scope: building placement, pathfinding, needs/jobs, clock/crops, viewport culling of entities, save/load, and production UI.

## Architecture

M1 boundaries stay intact:

1. `src-tauri/src/sim/` remains framework-independent. `World` gains a seed and generates terrain bytes once at construction.
2. Tauri still exposes `get_terrain` once and streams `tick` events. M2 adds `set_viewport` so the frontend can report the camera frustum (stored for M3+ culling; unused for simulation decisions in M2).
3. The React renderer keeps the offscreen terrain cache, but the visible canvas is viewport-sized and applies a camera transform each frame.

## Rust Components

- `sim/terrain.rs` — `Terrain` enum (`DeepWater`…`Mountain` as `u8`), elevation+moisture generation via the `noise` crate, island radial falloff, thresholding.
- `sim/world.rs` — `World::generate(width, height, tile_size, seed)` replaces `checkerboard`. Default world is `128×128` tiles at 32px with seed `42`.
- `commands.rs` — keep `get_terrain`; add `set_viewport(x, y, w, h)` that records the latest camera bounds in `AppState`.
- Fake villager orbit math stays; it orbits the world center in world pixels.

### Terrain generation

Two FBM simplex/Perlin layers (~4 octaves, frequency ~0.03):

1. Elevation, then multiply by a smooth radial falloff so map edges become ocean (produces an island).
2. Moisture from a second noise instance with a seed offset.

Threshold elevation first (deep water → shallow → sand → land → rock → mountain), then split land into Grass vs Forest by moisture. Same seed must produce identical `tiles` bytes.

## Frontend Components

- `render/camera.ts` — pan/zoom state, world↔screen transforms, cursor-anchored zoom, clamp zoom to `0.25…4.0`.
- `render/drawTerrain.ts` — seven terrain colors; still paints the full offscreen cache once.
- `render/Canvas.tsx` — viewport-sized canvas (`devicePixelRatio`), camera transform each frame, middle-drag pan, edge-scroll pan, wheel zoom; debounce `set_viewport` (~100ms) after camera changes.
- `state/transport.ts` — browser-demo generates a deterministic island with the same thresholds (demo-only; not byte-identical to Rust). Tauri path calls `set_viewport` when available.

## Data Flow

Startup: frontend requests terrain once, paints the offscreen layer at full world pixel size, centers the camera on the world, and starts listening to ticks. Each animation frame clears the viewport canvas, applies `setTransform(zoom, …)`, blits the offscreen terrain, and draws interpolated villagers.

Camera input never mutates the sim. `set_viewport` is fire-and-forget for M2.

## Verification

- Rust: same seed → identical terrain bytes; different seed → different bytes; generated map contains water, grass/forest, and rock/mountain.
- TypeScript: camera zoom-at-point keeps the cursor world position stable; interpolation tests from M1 still pass.
- Browser smoke: island colors visible, pan/zoom moves the view, villager still interpolates, `render_game_to_text` reports terrain dimensions and camera.
- `cargo test --lib`, `npm test`, `npm run build` all pass.

Milestone 2 is complete when a seeded island is visible and pannable/zoomable at 60fps with the M1 villager still moving smoothly.
