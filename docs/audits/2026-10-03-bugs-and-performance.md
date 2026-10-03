# VillageSim bug and performance audit

Date: 2026-10-03. Baseline: `3c0981a`. Application code was not changed.

Five actionable findings were identified. The highest priority is a measured simulation stall during hauling decisions. Passing tests do not cover the reproduced planting, newborn placement, and save continuation cases below.

Severity: **P1 / High** means a major responsiveness or gameplay failure; **P2 / Medium** means incorrect behavior in a specific supported scenario. Effort: **S** is a localized change; **M** requires coordinated state or simulation changes. These are estimates, not implementation specifications.

## 1. Hauling decisions can stall the simulation for seconds — P1 / High, M

Sources: [job_actionable](../../src-tauri/src/sim/world.rs#L1426), [maybe_decide](../../src-tauri/src/sim/world.rs#L1151), [find_haul_task](../../src-tauri/src/sim/world.rs#L905), [nearest_storage_for](../../src-tauri/src/sim/world.rs#L869). Browser counterpart: [jobActionable](../../src/state/demoWorld.ts#L2159) and [findHaulTask](../../src/state/demoWorld.ts#L2700).

Each candidate Haul job calls the same worker-relative global task search. That search walks production sources and storage destinations and runs route searches inside those loops. Workers can repeat that search while scoring different advertised Haul slots, claiming a slot, and executing it. Much of this work is identical within a decision. `building_stand_tile` also searches buildings again while resolving endpoints.

**Measured evidence:** an optimized diagnostic executable compiled the repository's actual Rust simulation, snapshot, and persistence modules using the project's locked dependency versions. Each case advanced 30 ticks on a controlled 128×128 grass map with water along its left edge. Resource nodes were removed to isolate building jobs. Villagers began Idle near the centre. Each building pair was a completed farm with 10 grain and a completed empty granary, spaced ten tiles apart. Farm and granary jobs were advertised through the real job board.

| Villagers | Buildings | Jobs | Median tick | Maximum tick |
|---:|---:|---:|---:|---:|
| 5 | 0 | 0 | 0.003 ms | 0.174 ms |
| 5 | 10 | 15 | 0.003 ms | 3.757 ms |
| 25 | 20 | 30 | 0.006 ms | 90.430 ms |
| 50 | 50 | 75 | 0.011 ms | 8,709.754 ms |
| 50 | 50 | 50, with granary hauling jobs disabled | 0.013 ms | 3.988 ms |

Another run with the locked dependencies reached **14,235.791 ms** in the 50-villager / 50-building case. The 50 ms budget at 1×, and approximately 16.7 ms budget at 3×, are exceeded by a wide margin. Most later ticks are cheap because villagers are already travelling; the low median and even the sampled 95th percentile conceal the decision spike. Disabling hauling jobs while retaining the buildings and villagers isolates hauling as the dominant cost in this scenario. This does not attribute every millisecond to A* or certify normal-play steady-state performance.

The simulation publishes snapshots and handles further commands on the same thread after this work. A large decision spike therefore stops desktop updates and command responses. The equivalent demo algorithm executes on the browser main thread, although its large-settlement cost was not separately measured.

**Suggested fix:** compute a haul candidate once per worker decision and reuse it across Haul slots and action startup; use cached connected components to reject unreachable endpoints before constructing routes. Avoid evaluating every source/storage path before distance-ranking candidates. Ensure any cache accounts for topology and inventory changes. Check worst-tick latency after load, construction, and simultaneous job release as well as average throughput. Preserve deterministic candidate ordering.

## 2. Births bypass the connectivity checks used for starting villagers — P2 / Medium, S–M

Source: [check_population_dynamics](../../src-tauri/src/sim/world/population.rs#L38), particularly its call to `find_walkable_near` at line 50. Compare the starting-villager connectivity and water-access checks later in the same file.

At a birth boundary, the simulation chooses an open tile near the map centre without requiring that tile to connect to a living villager or a water source. Starting villagers use stronger checks, but births do not reuse them.

**Reproduction:** generate a 32×32 world, replace terrain with grass, add shallow water at x=0, and move the five existing villagers to tile (2,2). Enclose tiles (12..20,12..20) with a mountain ring at x/y=11 and 21. Add one completed hut outside the ring and advance from tick 199 to 200. Villager 6 appears at **(16,16)**. A flood fill from the parent region reports that tile as unreachable. The original villagers can reach the outer water; the newborn's enclosed region contains neither shoreline nor a well.

**Impact:** births can put villagers outside the functioning settlement with no way to join it or obtain water, creating avoidable dehydration deaths unless the player supplies water in that region. This is a Rust gameplay finding; the demo intentionally has no births.

**Suggested fix:** choose a spawn in a living villager's connected region and apply the existing water-access rules. If no valid spawn exists, defer the birth. Do not fall back to an unrelated central region.

## 3. Manual planting bypasses all seed costs — P2 / Medium, S

Sources: [World::plant_crop](../../src-tauri/src/sim/world/commands_handler.rs#L287), [DemoWorld.plantCrop](../../src/state/demoWorld.ts#L1625), and [crops.json](../../src-tauri/data/crops.json). Automatic planting correctly checks and spends seed costs through `can_afford_seed_cost` / `spend_seed_cost` and their demo equivalents.

Manual planting checks the crop definition, farm completion, and tile occupancy, then appends a crop without checking or spending its `seed_cost`.

**Reproduction in both simulations:** create a completed empty farm, set grain and food to zero, and manually plant wheat on an empty farm tile. Planting succeeds, one crop exists, and both resource values remain zero. Wheat declares a one-grain seed cost. The demo reproduction used the actual `DemoWorld` module imported in the browser; the Rust reproduction used the actual world command method.

**Impact:** the player can create crops indefinitely without the inputs required by autonomous farming. This undermines the seed economy and gives manual and automatic planting different resource rules.

**Suggested fix:** validate and spend the declared seed cost before committing a manual crop, using the same farm-buffer / stockpile policy as automatic planting. Reject insufficient inputs without allocating a crop or consuming partial costs. Mirror the change in Rust and the demo.

## 4. Save/load changes authoritative behavior after failed water searches — P2 / Medium, M

Sources: [Villager.water_search_cooldown](../../src-tauri/src/sim/agents.rs#L145), [tick_villager_at](../../src-tauri/src/sim/world.rs#L1067), [maybe_decide](../../src-tauri/src/sim/world.rs#L1182), and [begin_drink](../../src-tauri/src/sim/world.rs#L1287).

The water-search cooldown is marked `serde(skip)`, but it changes survival interruption and utility eligibility. Loading resets it to zero, so the same serialized state can resume differently from an uninterrupted world.

**Reproduction:** in a grass world with no water or wells, keep one thirsty villager and advance once. Its failed search sets the cooldown to **200**. Encode and decode that world: the original cooldown is 200 and the loaded cooldown is 0, although the encoded worlds are byte-identical. Advance both once more. Their encoded worlds differ: the uninterrupted villager wanders toward **(18,21)** and the loaded villager toward **(9,18)**.

**Impact:** saving and loading breaks deterministic continuation in this scenario and immediately changes a villager's plan. The existing save round-trip tests pass because they do not exercise this cooldown state. This reproduction establishes divergence, not a general save corruption or resource-loss claim.

**Suggested fix:** persist the cooldown with an appropriate save-version migration, or redesign it so that resetting runtime-only search throttling cannot change authoritative decisions. Adding the field to bincode serialization requires explicit compatibility handling; a simple removal of `serde(skip)` is insufficient.

## 5. Viewport synchronization falls behind scrolling and resizing — P2 / Medium, S

Sources: [scheduleViewportSync](../../src/render/Canvas.tsx#L257), [resize](../../src/render/Canvas.tsx#L280), the edge-scroll caller at [line 399](../../src/render/Canvas.tsx#L399), and server-side [building_views](../../src-tauri/src/sim/world.rs#L2053).

The camera schedules a trailing 100 ms debounce during movement. Edge scrolling repeats this every animation frame, continually cancelling the pending update. Normal sustained dragging has the same scheduling pattern. Separately, `resize` synchronizes the viewport only during the initial camera fit, so later window-size changes update the canvas without updating the simulation's culling rectangle.

**Browser evidence:** a temporary wrapper recorded calls to the actual transport's `setViewport`. During one second of edge scrolling, camera x moved from **703.664** to **1,101.669**, but there were **zero viewport calls**. One call arrived after moving the pointer away from the edge. Resizing changed the rendered viewport height from **1,101 to 592 pixels** without sending a viewport call. Instrumentation was restored after the checks.

**Impact:** the simulation keeps sending buildings for an old rectangle while the camera displays new ground. Newly visible buildings can disappear until scrolling stops; enlarging a window can leave buildings missing until another camera action triggers synchronization. The probe confirmed stale communication; it did not capture an actual building disappearing on screen.

**Suggested fix:** use throttling with a maximum update delay during movement and send the final rectangle when movement stops. Synchronize after every effective resize, including layout-driven changes to the canvas container; a `ResizeObserver` can cover those changes. Retain the existing immediate sync for explicit camera jumps.

## Other performance observations

These are follow-up profiling candidates, not additional confirmed bottlenecks:

- [Canvas tick handling](../../src/render/Canvas.tsx#L600) serializes every snapshot again with `JSON.stringify` to measure its size even when `?perf=1` is absent. Gate this diagnostic cost behind the performance flag.
- [App.onSnapshot](../../src/App.tsx#L199) assigns fresh resource, clock, and unlock objects to React state on every snapshot. That redraws the HUD at tick frequency, including paused desktop snapshots. Measure component commit costs before adding equality guards or reducing HUD update frequency.
- [tick_snapshot](../../src-tauri/src/sim/world.rs#L462) sends all villagers and crops; building snapshots alone are culled server-side. Keep this distinction in mind when estimating payload growth. In the controlled 50-villager / 50-building probe, snapshots were approximately 12.2 KB and snapshot construction averaged about 0.008 ms in one run. Snapshot construction was not the dominant measured cost.
- Save writes and autosaves perform encoding and synchronous file I/O on the simulation thread. No disk-latency bottleneck was measured in this audit. The rename fallback in [persist.rs](../../src-tauri/src/persist.rs#L157) removes the existing slot before a second rename attempt; failure recovery deserves a separate fault-injection check. No save-loss incident was reproduced here.

## Verification and limits

| Check | Result |
|---|---|
| `npm.cmd test -- --maxWorkers=1` | 299 tests passed in 31 files |
| `npm.cmd run build` | Passed: TypeScript and Vite production build |
| `cargo test --manifest-path src-tauri/Cargo.toml --lib -j 1 -- --test-threads=1` | 185 tests passed |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -j 1 -- -D warnings` | Passed |
| Optimized Rust scenario probes | Seed-cost bypass, disconnected birth, and save continuation divergence reproduced; hauling spike measured with locked dependencies |
| Browser smoke, local port 5186, `?test=1&perf=1` | Atlas loaded; chicken placement produced three chicken views; saved state reloaded at tick 0 with flock intact and no game error; edge-scroll/resize communication measured |
| Canvas draw-cost sample | 120 sampled frames: median 6.7 ms, p95 7.1 ms, maximum 7.6 ms; 1,736 of 1,970 props drawn, with five villagers and three chickens |
| Console | No VillageSim warnings or application errors observed; one missing `favicon.ico` 404 |
| Native Tauri interaction/performance | Not run |
| Multi-season/high-population soak, full Rust/demo conformance, heap/GPU profiling, injected disk failures | Not run |

The browser sample used a paused-by-test timer and a view showing most of the map at a 1440×900 browser viewport. The reported frame cost is the app's Canvas draw timer, not total frame latency, React commit time, or a native-webview frame-rate guarantee. The Rust workloads were synthetic diagnostic states, not a recording of an established village's full economic cycle. Temporary diagnostics and the preview server were removed/stopped after reporting; no dependencies, application files, or existing tests were modified.

Previously fixed starvation-during-travel, storm cargo cleanup, job-switch claims, and blocked recipe-output recovery were not reclassified as new findings. The known lack of demo births/deaths and the absence of broad automated Rust/demo conformance remain coverage limits.

## Start here

1. Fix viewport synchronization and manual seed spending as small, contained changes.
2. Address hauling latency next: it has the highest measured impact and needs worst-tick timing acceptance.
3. Reuse spawn connectivity/water checks for births.
4. Resolve water cooldown persistence with an explicit save migration and uninterrupted-versus-loaded continuation coverage.
