# VillageSim Milestone 1 Design

## Scope

Milestone 1 proves the full desktop simulation pipe without introducing later gameplay systems. The deliverable is a runnable Tauri 2 application that shows checkerboard terrain and one fake villager moving smoothly in a deterministic circle.

The slice includes the Rust simulation thread, the Tauri command and event boundary, React canvas rendering, snapshot interpolation, and a browser-only deterministic adapter for automated visual checks. Terrain generation, camera controls, building placement, pathfinding, needs, jobs, persistence, and production UI remain out of scope.

## Architecture

The implementation has three boundaries:

1. `src-tauri/src/sim/` is a framework-independent Rust simulation core. `World` owns the fixed terrain and current tick. A dedicated `std::thread` advances the world at 20 Hz and sends the latest `TickSnapshot` through a `tokio::sync::watch` channel.
2. `src-tauri/src/` is the Tauri adapter. It owns shared channel state, exposes `get_terrain`, and forwards watched snapshots as `tick` events. Tauri handlers never access or mutate `World` directly.
3. `src/` is a React renderer. A transport abstraction retrieves terrain and subscribes to ticks. The canvas renderer keeps the latest two snapshots and interpolates the villager on each animation frame.

The Tauri path is authoritative. The browser adapter implements the same frontend transport interface for Playwright and local browser development. It is deterministic and exists only to exercise the rendering loop without a desktop webview.

## Rust Components

- `sim/world.rs` defines the fixed `32 x 24` checkerboard, terrain byte layout, and deterministic fake-villager position for a given tick.
- `sim/mod.rs` defines the 20 Hz simulation loop and its stop behavior.
- `snapshot.rs` defines compact serializable terrain and tick payloads.
- `commands.rs` exposes `get_terrain` from immutable startup data held in Tauri state.
- `lib.rs` creates the channels, starts the simulation thread, forwards watch updates through `AppHandle::emit`, registers commands, and shuts the thread down when the app exits.
- `main.rs` delegates to the library entry point.

The initial command response is:

```text
TerrainSnapshot { width, height, tile_size, tiles }
```

Each tick event contains:

```text
TickSnapshot { tick, villagers: [{ id, x, y }] }
```

Coordinates are world pixels. Terrain uses two byte values solely for the M1 checkerboard.

## Frontend Components

- `state/transport.ts` defines `getTerrain()` and `listenToTicks()` and selects the Tauri or browser implementation.
- `state/snapshot.ts` stores previous/current snapshots and provides clamped interpolation by villager ID.
- `render/Canvas.tsx` owns canvas sizing, terrain caching, the animation frame loop, fullscreen handling, and cleanup.
- `render/drawTerrain.ts` draws checkerboard tiles.
- `render/drawEntities.ts` draws interpolated villagers.
- `App.tsx` provides the game viewport and compact connection/tick status.

React effects capture their active listener, animation frame, and DOM references and dispose them explicitly. This keeps development Strict Mode from creating duplicate subscriptions or animation loops.

## Data Flow

At startup, the frontend subscribes to tick events and requests terrain. Once terrain arrives, it caches the static terrain layer and begins rendering. Rust advances the fake villager every 50 ms while the browser renders at display refresh rate.

On each tick, the snapshot store shifts current to previous and records the new snapshot with its receipt time. On each animation frame, interpolation alpha is calculated as elapsed time divided by 50 ms and clamped to `0..1`. Villagers missing from the previous snapshot render at their current position.

The browser adapter uses the same snapshot and drawing code. It exposes:

- `window.advanceTime(ms)` to advance deterministic demo ticks and render frames.
- `window.render_game_to_text()` to return concise JSON containing the coordinate system, connection mode, tick, terrain dimensions, and visible villager positions.

Pressing `F` toggles fullscreen. Browser resizing and fullscreen changes resize the canvas without changing simulation state.

## Error Handling

Terrain initialization failures prevent rendering and show a compact error state. Tick-listener setup failures do the same. Errors are also included in `render_game_to_text()` so automated checks can diagnose a blank or disconnected canvas.

A closed Rust watch channel ends the forwarding task without retrying or panicking. Thread startup and event emission errors are logged with enough context for local diagnosis. No automatic recovery or reconnection system is added in M1.

## Verification

Testing remains proportional to this proof-of-pipe milestone:

- Rust unit tests cover checkerboard layout and deterministic villager positions at known ticks.
- TypeScript unit tests cover first-snapshot behavior, ID matching, and interpolation clamping.
- Cargo and frontend build checks verify integration.
- One Playwright gameplay smoke flow advances time, inspects `render_game_to_text()`, checks the browser console, captures a screenshot, and verifies that the checkerboard and moving villager are visible.
- A local Tauri development smoke run confirms that the desktop process starts and uses the real command/event transport when GUI execution is available.

Milestone 1 is complete when the checkerboard is visible, the villager moves smoothly between 20 Hz updates, text state agrees with the rendered state, focused tests and builds pass, and `progress.md` records the original request plus the next milestone boundary.
