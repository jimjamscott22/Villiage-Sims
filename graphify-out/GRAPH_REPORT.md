# Graph Report - Villiage-Sims  (2026-08-29)

## Corpus Check
- 121 files · ~130,277 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1739 nodes · 3651 edges · 102 communities (89 shown, 13 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 125 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1c5b4a1f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- World
- Clock
- utility.rs
- catalog.rs
- src/commands.rs
- devDependencies
- App.tsx
- world.rs
- DemoWorld
- persist.rs
- scene.ts
- demoWorld.ts
- chronicle.rs
- .maybe_decide
- Villager
- Canvas.tsx
- types.ts
- ui.ts
- .posToTile
- .generate
- compilerOptions
- economy.rs
- chronicle.ts
- .findHaulTask
- pixelUi.ts
- resourceGet
- grid.ts
- vfx.ts
- compilerOptions
- PixelText.tsx
- World Struct (world.rs)
- build.ts
- transport.ts
- Authoritative Rust Simulation
- perfBaseline.test.ts
- tilemap.ts
- RUST · simulation thread (20 Hz · 50 ms)
- demoWorld.test.ts
- BrowserTransport
- buildings.ts
- Rust Authoritative Simulation (20 Hz Thread)
- Pixel Art Phases 1–3
- tauri.conf.json
- snapshot.rs
- Island Map Scene
- pick highest → Eat
- atlas.test.ts
- Camera
- app-icon.ts
- Village Chronicle
- WORLD
- ResourceNode
- villagers.ts
- SIM · 50 ms tick timeline
- ResourceTotals
- Genart Art Pipeline
- 1. Input Stage (User IPC Action / 50ms Sim Timer)
- String
- pathfind.ts
- TickSnapshot
- Overlay (build ghost · selection · hover — every frame in build mode)
- Utility AI
- default.json
- Tech / Unlock Tree
- Props and Assets Backlog
- VillageSim Application Icon
- vite-env.d.ts
- Economy and Production Chains
- Entity spritesheet (entities.png)
- Terrain tiles spritesheet (tiles.png)
- HUD/UI spritesheet (ui.png)
- Seeded Terrain Generation
- mpsc SimCommand Channel
- VillageSim tauri packaging asset (128x128@2x.png)
- VillageSim tauri packaging asset (128x128.png)
- VillageSim tauri packaging asset (32x32.png)
- VillageSim tauri packaging asset (64x64.png)
- VillageSim tauri packaging asset (icon.png)
- VillageSim app icon — Square107x107Logo Windows packaging icon
- VillageSim app icon — Square142x142Logo Windows packaging icon
- VillageSim app icon — Square150x150Logo Windows packaging icon
- VillageSim app icon — Square284x284Logo Windows packaging icon
- VillageSim app icon — Square30x30Logo Windows packaging icon
- VillageSim app icon — Square310x310Logo Windows packaging icon
- VillageSim app icon — Square44x44Logo Windows packaging icon
- VillageSim app icon — Square71x71Logo Windows packaging icon
- VillageSim app icon — Square89x89Logo Windows packaging icon
- VillageSim app icon — StoreLogo Windows Store packaging icon
- tsconfig.json
- Building Kind as Catalog Index
- ResourceBar
- TickSnapshot Schema
- VillagerPanel
- Milestone 1 Prove the Pipe
- Raised/recessed bevel frame for border-image panels
- Sun
- props.ts
- .isPassable
- Option

## God Nodes (most connected - your core abstractions)
1. `World` - 137 edges
2. `DemoWorld` - 117 edges
3. `grass_world()` - 42 edges
4. `Canvas()` - 31 edges
5. `Clock` - 22 edges
6. `JobBoard` - 22 edges
7. `Villager` - 21 edges
8. `BrowserTransport` - 21 edges
9. `TickSnapshot` - 21 edges
10. `SimCommand` - 20 edges

## Surprising Connections (you probably didn't know these)
- `entitySources()` --indirect_call--> `entry()`  [INFERRED]
  tools/genart/build.ts → src/state/chronicle.test.ts
- `CI Pipeline` --conceptually_related_to--> `Authoritative Rust Simulation`  [INFERRED]
  .github/workflows/ci.yml → AGENTS.md
- `Vite HTML Entry` --conceptually_related_to--> `React + Canvas Renderer`  [INFERRED]
  index.html → AGENTS.md
- `Tick Processing Pipeline` --implements--> `Authoritative Rust Simulation`  [EXTRACTED]
  docs/project-summary.md → AGENTS.md
- `Simulation/Render Split` --rationale_for--> `Authoritative Rust Simulation`  [EXTRACTED]
  README.md → AGENTS.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Authoritative Sim to Renderer IPC Pipeline** — agents_authoritative_rust_sim, docs_villagesim_spec_mpsc_commands, docs_villagesim_spec_watch_channel, agents_tick_snapshots_20hz, agents_react_canvas_renderer, readme_snapshot_interpolation [EXTRACTED 1.00]
- **M10 Persistence Chronicle Weather Bundle** — progress_m10_persistence_polish, agents_persistence, agents_autosave_rotation, agents_chronicle, agents_weather [EXTRACTED 1.00]
- **App icon visual composition** — app_icon_yellow_circle, app_icon_checkered_field, app_icon_dark_border [EXTRACTED 1.00]
- **Rust World satellite modules** — docs_diagrams_component_relationships_agents, docs_diagrams_component_relationships_utility, docs_diagrams_component_relationships_jobs, docs_diagrams_component_relationships_pathfind, docs_diagrams_component_relationships_catalog, docs_diagrams_component_relationships_chronicle, docs_diagrams_component_relationships_persist [EXTRACTED 1.00]
- **Transport interface implementations** — docs_diagrams_component_relationships_transport_if, docs_diagrams_component_relationships_tauri_trans, docs_diagrams_component_relationships_browser_trans [EXTRACTED 1.00]
- **Frontend render stack** — docs_diagrams_component_relationships_canvas, docs_diagrams_component_relationships_draw, docs_diagrams_component_relationships_atlas [EXTRACTED 1.00]
- **World entity aggregate** — docs_diagrams_data_model_world, docs_diagrams_data_model_villager, docs_diagrams_data_model_building, docs_diagrams_data_model_crop, docs_diagrams_data_model_clock, docs_diagrams_data_model_chronicle, docs_diagrams_data_model_resource_totals [EXTRACTED 1.00]
- **Authoritative sim to thin renderer flow** — docs_diagrams_high_level_architecture_rust_sim_cluster, docs_diagrams_high_level_architecture_transport, docs_diagrams_high_level_architecture_interpolation, docs_diagrams_high_level_architecture_canvas_stack [EXTRACTED 1.00]
- **Rust simulation subsystems** — docs_diagrams_high_level_architecture_world_state, docs_diagrams_high_level_architecture_clock_seasons, docs_diagrams_high_level_architecture_utility_ai, docs_diagrams_high_level_architecture_pathfinding_jobs, docs_diagrams_high_level_architecture_chronicle_persist, docs_diagrams_high_level_architecture_catalog [EXTRACTED 1.00]
- **End-to-end processing pipeline stages** — docs_diagrams_processing_pipeline_s1_input, docs_diagrams_processing_pipeline_s2_clock_crop, docs_diagrams_processing_pipeline_s3_utility_needs, docs_diagrams_processing_pipeline_s4_movement_economy, docs_diagrams_processing_pipeline_s5_population_chronicle, docs_diagrams_processing_pipeline_s6_viewport_broadcast, docs_diagrams_processing_pipeline_s7_client_interp, docs_diagrams_processing_pipeline_s8_canvas_render [EXTRACTED 1.00]
- **Authoritative simulation stages** — docs_diagrams_processing_pipeline_s2_clock_crop, docs_diagrams_processing_pipeline_s3_utility_needs, docs_diagrams_processing_pipeline_s4_movement_economy, docs_diagrams_processing_pipeline_s5_population_chronicle, docs_diagrams_processing_pipeline_s6_viewport_broadcast [INFERRED 0.85]
- **Client transport and render stages** — docs_diagrams_processing_pipeline_s7_client_interp, docs_diagrams_processing_pipeline_s8_canvas_render [INFERRED 0.85]
- **Bidirectional IPC channels** — docs_images_architecture_commands, docs_images_architecture_snapshots, docs_images_architecture_rust_sim_thread, docs_images_architecture_react_webview [EXTRACTED 1.00]
- **Rust simulation subsystems** — docs_images_architecture_world_state, docs_images_architecture_clock_seasons, docs_images_architecture_utility_ai, docs_images_architecture_economy [EXTRACTED 1.00]
- **React renderer subsystems** — docs_images_architecture_canvas_stack, docs_images_architecture_camera, docs_images_architecture_interpolation, docs_images_architecture_ui_chrome [EXTRACTED 1.00]
- **Three-layer canvas stack** — docs_images_canvas_layers_overlay_layer, docs_images_canvas_layers_entities_layer, docs_images_canvas_layers_terrain_layer [EXTRACTED 1.00]
- **Terrain type legend** — docs_images_hero_terrain_grass, docs_images_hero_terrain_forest, docs_images_hero_terrain_water, docs_images_hero_terrain_sand, docs_images_hero_terrain_rock, docs_images_hero_villager_marker [EXTRACTED 1.00]
- **Settlement scene elements** — docs_images_hero_farm_plot, docs_images_hero_house_building, docs_images_hero_workshop_building, docs_images_hero_villager_marker, docs_images_hero_path_trail [EXTRACTED 1.00]
- **Sequential sim tick snapshots** — docs_images_tick_pipeline_tick_n, docs_images_tick_pipeline_tick_n1, docs_images_tick_pipeline_tick_n2, docs_images_tick_pipeline_tick_n3 [EXTRACTED 1.00]
- **Dual-rate sim/render pipeline** — docs_images_tick_pipeline_sim_timeline, docs_images_tick_pipeline_render_timeline, docs_images_tick_pipeline_alpha_formula [EXTRACTED 1.00]
- **Candidate utility actions** — docs_images_utility_ai_action_eat, docs_images_utility_ai_action_sleep, docs_images_utility_ai_action_work, docs_images_utility_ai_action_socialize, docs_images_utility_ai_action_wander [EXTRACTED 1.00]
- **Villager needs meters** — docs_images_utility_ai_hunger, docs_images_utility_ai_energy, docs_images_utility_ai_social, docs_images_utility_ai_happiness [EXTRACTED 1.00]
- **Needs → score → pick with hysteresis** — docs_images_utility_ai_needs_panel, docs_images_utility_ai_utility_scoring, docs_images_utility_ai_pick_highest, docs_images_utility_ai_hysteresis_rule [EXTRACTED 1.00]
- **VillageSim terrain tile palette** — public_art_tiles_water_autotiles, public_art_tiles_grass_autotiles, public_art_tiles_sand_autotiles [EXTRACTED 1.00]

## Communities (102 total, 13 thin omitted)

### Community 0 - "World"
Cohesion: 0.07
Nodes (11): MovePurpose, ObjectiveCondition, ResourceNode, Fn, wander_tile(), order_move_falls_back_when_requested_villager_is_gone(), order_move_prefers_requested_villager(), BuildingView (+3 more)

### Community 1 - "Clock"
Cohesion: 0.05
Nodes (39): Default, Duration, Clock, ClockView, day_season_year_rollover(), minute_accumulates_to_day(), Rollover, rollover_reports_season_change() (+31 more)

### Community 2 - "utility.rs"
Cohesion: 0.05
Nodes (35): farm_advertises_tend_crops_slots(), granary_advertises_haul_in_m8(), Job, JobBoard, JobKind, mill_advertises_produce_and_haul(), peek_prefers_closer_job_at_equal_priority(), peek_prefers_priority_over_distance() (+27 more)

### Community 3 - "catalog.rs"
Cohesion: 0.06
Nodes (49): CropDef, BuildingStatus, BuildState, PlacementResult, PlacementValidity, BuildingDef, String, terrain_allowed() (+41 more)

### Community 4 - "src/commands.rs"
Cohesion: 0.10
Nodes (45): advance_clock(), app_state_holds_catalog(), AppState, demolish(), get_catalog(), get_chronicle(), get_terrain(), get_villager_detail() (+37 more)

### Community 5 - "devDependencies"
Cohesion: 0.04
Nodes (47): esbuild, allowScripts, esbuild@0.28.1, dependencies, react, react-dom, @tauri-apps/api, devDependencies (+39 more)

### Community 6 - "App.tsx"
Cohesion: 0.12
Nodes (16): App(), root, ChronicleBody, ResourceTotals, Floater, FloaterItemProps, FloatingText(), FloatingTextProps (+8 more)

### Community 7 - "world.rs"
Cohesion: 0.12
Nodes (42): autonomous_jobs_run_farm_to_bakery_chain(), autosave_disabled_without_directory(), autosave_rotates_through_three_slots(), chronicle_records_building_completion(), chronicle_records_season_turn(), clear_day_leaves_crops_dry_after_rollover(), completed_farm_advertises_tend_crops_and_villager_works(), construction_completes_after_build_ticks() (+34 more)

### Community 8 - "DemoWorld"
Cohesion: 0.10
Nodes (5): demoAutosaveSlot(), DemoWorld, nearestVillagerId(), villagerById(), ObjectiveCondition

### Community 9 - "persist.rs"
Cohesion: 0.10
Nodes (35): Arc, AtomicBool, Drop, JoinHandle, Mutex, Path, forward_snapshots(), AppHandle (+27 more)

### Community 10 - "scene.ts"
Cohesion: 0.10
Nodes (33): animFrame(), atlasHasEntities(), bubbleForState(), buildDrawList(), buildDrawListWithStats(), BUILDING_VFX, BuildingVfx, cellAnchorY() (+25 more)

### Community 11 - "demoWorld.ts"
Cohesion: 0.06
Nodes (35): ACTION_ORDER, ActionKind, actionRank(), AgentStateName, CarryStack, DEMO_CROPS, DEMO_SAVE_VERSION, DemoBuilding (+27 more)

### Community 12 - "chronicle.rs"
Cohesion: 0.15
Nodes (26): Item, Iterator, born(), captures_the_clock_date(), Chronicle, ChronicleBody, ChronicleBodyView, ChronicleEntry (+18 more)

### Community 13 - ".maybe_decide"
Cohesion: 0.33
Nodes (4): completed_eat_clears_action_so_hysteresis_cannot_reenter(), hungry_villager_eats_without_releasing_job(), ResourceTotals, stale_eat_action_while_idle_does_not_block_wander()

### Community 14 - "Villager"
Cohesion: 0.09
Nodes (14): CarryStack, Into, AgentState, MovePurpose, ActionKind, Option, Self, String (+6 more)

### Community 15 - "Canvas.tsx"
Cohesion: 0.11
Nodes (26): drawCell(), Canvas(), cropPlantValid(), HoverDisplay, rotatedFootprint(), BUILDING_COLORS, CROP_STAGE_COLORS, drawBuildings() (+18 more)

### Community 16 - "types.ts"
Cohesion: 0.16
Nodes (14): ClockView, ObjectiveDef, RecipeDef, SEASON_NAMES, TraitDef, UnlockCondition, WEATHER_NAMES, ClockBar() (+6 more)

### Community 17 - "ui.ts"
Cohesion: 0.07
Nodes (31): BAR_NOTCH, BAR_NOTCH_EMPTY, BRACKET_BL, BRACKET_BR, BRACKET_TL, BRACKET_TR, bracketCorner(), FONT_GLYPH_ORDER (+23 more)

### Community 18 - ".posToTile"
Cohesion: 0.18
Nodes (3): chebyshev(), fullNeeds(), recomputeHappiness()

### Community 19 - ".generate"
Cohesion: 0.13
Nodes (11): chronicle_death_entry_carries_the_name(), generated_world_has_expected_dimensions(), mill_is_locked_in_a_fresh_world(), BTreeSet, Self, TerrainSnapshot, TickSnapshot, spawns_five_villagers_on_walkable_tiles() (+3 more)

### Community 20 - "compilerOptions"
Cohesion: 0.07
Nodes (26): DOM, DOM.Iterable, src, vite/client, vite.config.ts, compilerOptions, allowImportingTsExtensions, jsx (+18 more)

### Community 21 - "economy.rs"
Cohesion: 0.20
Nodes (19): HaulEndpoint, CarryStack, derive_totals(), derive_totals_ignores_production_buffers(), HaulEndpoint, HaulTask, inventory_add(), inventory_get() (+11 more)

### Community 22 - "chronicle.ts"
Cohesion: 0.22
Nodes (12): buildingName(), CHRONICLE_EMPTY_MESSAGE, formatDivider(), formatEntry(), needsDivider(), seasonName(), SEASONS, BIRTH (+4 more)

### Community 23 - ".findHaulTask"
Cohesion: 0.10
Nodes (10): footprintTiles(), inventoryAdd(), inventoryGet(), inventoryTotal(), productionFreeCapacity(), recipeAllowsResource(), rotatedFootprint(), stockpileAccepts() (+2 more)

### Community 24 - "pixelUi.ts"
Cohesion: 0.13
Nodes (25): AtlasCell, VillagerDetail, getAtlasManifest(), getSheetSize(), loadImage(), loadUiAtlasManifest(), manifest, preloadSheetSizes() (+17 more)

### Community 25 - "resourceGet"
Cohesion: 0.25
Nodes (5): canAfford(), inventoryTake(), resourceGet(), resourceSet(), completeBuilding()

### Community 26 - "grid.ts"
Cohesion: 0.21
Nodes (9): Source, mirrorHorizontal(), remapColor(), assertPaletteHex(), BY_HEX, Rgba, Raster, BLUE (+1 more)

### Community 27 - "vfx.ts"
Cohesion: 0.12
Nodes (19): SpriteGrid, PALETTE, BuildingSprite, CROP_SPRITES, CropSprite, grid(), Pal, WHEAT_STAGE_3_SWAY (+11 more)

### Community 28 - "compilerOptions"
Cohesion: 0.10
Nodes (20): tools, compilerOptions, allowImportingTsExtensions, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 29 - "PixelText.tsx"
Cohesion: 0.23
Nodes (14): FONT_GLYPHS, FONT_SCALE, GLYPH_HEIGHT, GLYPH_WIDTH, glyphBackgroundPosition(), glyphBackgroundX(), glyphIndex(), GLYPHS_PER_ROW (+6 more)

### Community 30 - "World Struct (world.rs)"
Cohesion: 0.13
Nodes (20): Villagers & Needs (agents.rs, needs.rs), Sprite Atlas Manager (atlas.ts), BrowserTransport (DemoWorld TS Sim), Canvas Component (Canvas.tsx), Content Catalog (catalog.rs), Chronicle Event Log (chronicle.rs), Component Relationships Diagram, Render Module (drawTerrain, drawEntities, drawGhost) (+12 more)

### Community 31 - "build.ts"
Cohesion: 0.09
Nodes (32): AtlasCellDef, AtlasManifest, BuiltAtlas, BuiltSheet, packSheet(), SHEET_WIDTH, terrainSources(), hash01() (+24 more)

### Community 32 - "transport.ts"
Cohesion: 0.15
Nodes (14): classify(), DEFAULT_HEIGHT, DEFAULT_SEED, DEFAULT_TILE_SIZE, DEFAULT_WIDTH, fbm(), generateDemoTerrain(), hash2() (+6 more)

### Community 33 - "Authoritative Rust Simulation"
Cohesion: 0.15
Nodes (16): Authoritative Rust Simulation, Browser-Demo Transport, DEMO_CATALOG Mirror Constraint, React + Canvas Renderer, 20 Hz Tick Snapshots, VillageSim, Project Documenter Agent, Project Summary HTML (+8 more)

### Community 34 - "perfBaseline.test.ts"
Cohesion: 0.11
Nodes (14): buildings, crops, manifest, Facing, footprintIntersects(), packCell(), SPATIAL_CELL_TILES, terrainBlitRect() (+6 more)

### Community 35 - "tilemap.ts"
Cohesion: 0.14
Nodes (22): ART_SCALE, Atlas, loadAtlas(), loadImage(), BASE_BY_TERRAIN, BaseTerrainName, baseTerrainOf(), CORNERS (+14 more)

### Community 36 - "RUST · simulation thread (20 Hz · 50 ms)"
Cohesion: 0.12
Nodes (18): One Authoritative World, One Thin Renderer, Camera (pan · cursor zoom), Canvas stack (terrain · entities · overlay), Clock & seasons (day · season · year), commands (mpsc channel), Data-driven content (buildings.json · crops.json · traits.json), Architecture — one authoritative world, one thin renderer, Economy (resources · buildings) (+10 more)

### Community 38 - "BrowserTransport"
Cohesion: 0.09
Nodes (8): BrowserTransport, Transport, validateSlot(), PlacementResult, PlacementValidity, TickListener, Unlisten, WorldInit

### Community 39 - "buildings.ts"
Cohesion: 0.10
Nodes (21): BAKERY, bakeryFrame(), BUILDING_SPRITES, FARM, FARM_FIELD, FENCE, GATE, GRANARY (+13 more)

### Community 40 - "Rust Authoritative Simulation (20 Hz Thread)"
Cohesion: 0.17
Nodes (16): Pixel Art Atlas (public/art/tiles.png & atlas.json), 3-Layer Canvas Stack (Offscreen Terrain, Dynamic Entities, Build Ghost), Data-Driven Catalog (buildings.json & crops.json), Chronicle & Persistence (200-entry log & bincode v2), Clock & Seasons (Pause / 1x / 2x / 3x Speed), Commands Channel (mpsc), High-Level Architecture Diagram, Interpolation Engine (2-Snapshot buffer, alpha factor) (+8 more)

### Community 42 - "tauri.conf.json"
Cohesion: 0.12
Nodes (15): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+7 more)

### Community 43 - "snapshot.rs"
Cohesion: 0.22
Nodes (14): ClockView, CropView, BuildingView, BuildingView, Option, ResourceTotals, String, Vec (+6 more)

### Community 44 - "Island Map Scene"
Cohesion: 0.15
Nodes (15): Farm Plot with Growing Crops, VillageSim Hero Banner, House Building, Island Map Scene, Dashed Villager Path, VillageSim, an autonomous village, simulated in Rust and drawn on Canvas, Forest Terrain (+7 more)

### Community 45 - "pick highest → Eat"
Cohesion: 0.17
Nodes (15): Eat (1 − hunger)² · gated on food available → 0.49, Sleep (1 − energy)² · ×1.5 at night → 0.19, Socialize (1 − social)^1.5 · partner ≤ 8 tiles → 0.10, Wander constant 0.05 floor → 0.05, Work 0.4 · priority/10 · 1/(1+dist·0.05) → 0.34, How a villager decides — utility scoring, Energy (0.56), Happiness (derived) (+7 more)

### Community 46 - "atlas.test.ts"
Cohesion: 0.33
Nodes (6): AtlasManifest, cellRect(), frameCount(), animated, single, cellFrames()

### Community 47 - "Camera"
Cohesion: 0.18
Nodes (3): Camera, MAX_ZOOM, MIN_ZOOM

### Community 49 - "app-icon.ts"
Cohesion: 0.11
Nodes (31): entry(), APP_ICON_NATIVE, APP_ICON_SCALE, APP_ICON_SIZE, DESKTOP_PNGS, downsample(), rasterForIconSize(), renderAppIcon() (+23 more)

### Community 50 - "Village Chronicle"
Cohesion: 0.24
Nodes (10): Autosave Slot Rotation, Village Chronicle, ChronicleBody Dual Serde Forms, Save/Load Persistence, Deterministic Weather, ChronicleDrawer, State of the Game Review, Clock and Seasons (+2 more)

### Community 51 - "WORLD"
Cohesion: 0.21
Nodes (12): BUILDING, CHRONICLE, CLOCK, Contains Aggregate Relationship, CROP, World Data Model ER Diagram, Logs Chronicle Relationship, Manages Clock Relationship (+4 more)

### Community 52 - "ResourceNode"
Cohesion: 0.27
Nodes (7): generate_nodes(), harvest_and_regen(), ResourceNode, Option, Self, String, Vec

### Community 53 - "villagers.ts"
Cohesion: 0.19
Nodes (12): BODY, bubble(), BUBBLES, DYE_PLACEHOLDER, Facing, grid(), paintCarry(), Pal (+4 more)

### Community 54 - "SIM · 50 ms tick timeline"
Cohesion: 0.27
Nodes (11): alpha = (now − t) / 50 ms, Simulate at 20 Hz, render at 60 fps, Alpha Interpolation Between Sim Ticks, Interpolated Villager Positions, paused → alpha frozen at 1.0, RENDER · ~16 ms frame timeline, SIM · 50 ms tick timeline, tick n snapshot (+3 more)

### Community 55 - "ResourceTotals"
Cohesion: 0.33
Nodes (5): can_afford_and_refund_round_trip(), ResourceTotals, BTreeMap, Self, String

### Community 56 - "Genart Art Pipeline"
Cohesion: 0.67
Nodes (3): Genart Art Pipeline, ART_SCALE 2x, 29-Color Art Palette

### Community 57 - "1. Input Stage (User IPC Action / 50ms Sim Timer)"
Cohesion: 0.20
Nodes (10): Processing Pipeline Diagram, Linear Tick-to-Render Pipeline, 1. Input Stage (User IPC Action / 50ms Sim Timer), 2. Clock & Crop Stage (Advance clock ticks, crop growth, season check), 3. Utility AI & Needs Stage (Decay hunger/energy/social, score actions & apply hysteresis), 4. Movement & Economy Stage (A* path step, job assignment, haul/produce/gather execution), 5. Population & Chronicle Stage (Housing capacity births/starvation deaths, log events), 6. Viewport Culling & Broadcast Stage (Cull entities outside camera margin, emit TickSnapshot to watch channel) (+2 more)

### Community 58 - "String"
Cohesion: 0.16
Nodes (9): footprint_tiles(), rotated_footprint(), Vec, BTreeMap, PlacementValidity, Result, String, VillagerDetail (+1 more)

### Community 59 - "pathfind.ts"
Cohesion: 0.36
Nodes (7): DELTAS, findPath(), heuristic(), IMPASSABLE, pack(), terrainPassable(), unpack()

### Community 60 - "TickSnapshot"
Cohesion: 0.14
Nodes (11): CanvasProps, BUILDING_STATUS_LABELS, hoverTargetAt(), HoverTargetInput, rotatedFootprint(), catalog, VILLAGER_STATE_LABELS, SnapshotBuffer (+3 more)

### Community 61 - "Overlay (build ghost · selection · hover — every frame in build mode)"
Cohesion: 0.36
Nodes (8): Build Ghost Overlay, Three stacked canvases, redrawn at different rates, Entities (buildings · crops · villagers — redrawn every frame), Isometric Three-Layer Stack Illustration, Redraw Rate Separation, Offscreen Terrain Buffer, Overlay (build ghost · selection · hover — every frame in build mode), Terrain (tiles — drawn on load, patched only on dirty tiles)

### Community 62 - "Utility AI"
Cohesion: 0.40
Nodes (5): Milestone 4 Villager FSM, Villager Needs, A* Pathfinding, Action Hysteresis Margin, Utility AI

### Community 63 - "default.json"
Cohesion: 0.25
Nodes (7): core:default, main, description, identifier, permissions, $schema, windows

### Community 64 - "Tech / Unlock Tree"
Cohesion: 0.50
Nodes (4): World::satisfied_unlocks, BuildMenu, Well Building, Tech / Unlock Tree

### Community 65 - "Props and Assets Backlog"
Cohesion: 0.33
Nodes (6): Terrain Props (defining + decor), Props and Assets Backlog, Authoritative Sim Architecture, Housing Capacity, M9 Population and Progression, Milestone Roadmap M1–M10

### Community 66 - "VillageSim Application Icon"
Cohesion: 0.47
Nodes (6): VillageSim Application Icon, Green Checkered Field Background, Dark Green Square Border, Minimalist Flat Icon Design, Grid World Metaphor, Central Yellow Circle

### Community 70 - "Entity spritesheet (entities.png)"
Cohesion: 0.67
Nodes (4): Building sprites (houses, windmill, well), Entity spritesheet (entities.png), Environment props (trees, bush, rock, grass, fence), Villager walk/idle/sleep sprites (colored shirts)

### Community 71 - "Terrain tiles spritesheet (tiles.png)"
Cohesion: 0.67
Nodes (4): Green grass autotile edge and fill tiles, Tan sand/dirt autotile edge and fill tiles, Terrain tiles spritesheet (tiles.png), Teal water/coast autotile edge and fill tiles

### Community 72 - "HUD/UI spritesheet (ui.png)"
Cohesion: 0.67
Nodes (4): HUD icons (resources, bag, scroll, sun, tools), HUD/UI spritesheet (ui.png), Pixel font glyphs A–Z, 0–9, punctuation, Clock speed control icons (pause/play/fast-forward)

### Community 74 - "mpsc SimCommand Channel"
Cohesion: 0.67
Nodes (3): mpsc SimCommand Channel, No Arc Mutex World, Exclusive World Ownership via Command Channel

### Community 75 - "VillageSim tauri packaging asset (128x128@2x.png)"
Cohesion: 1.00
Nodes (3): VillageSim tauri packaging asset (128x128@2x.png), VillageSim app icon — 128×128@2x retina desktop app icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 76 - "VillageSim tauri packaging asset (128x128.png)"
Cohesion: 1.00
Nodes (3): VillageSim tauri packaging asset (128x128.png), VillageSim app icon — 128×128 desktop app icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 77 - "VillageSim tauri packaging asset (32x32.png)"
Cohesion: 1.00
Nodes (3): VillageSim tauri packaging asset (32x32.png), VillageSim app icon — 32×32 desktop app icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 78 - "VillageSim tauri packaging asset (64x64.png)"
Cohesion: 1.00
Nodes (3): VillageSim tauri packaging asset (64x64.png), VillageSim app icon — 64×64 desktop app icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 94 - "VillageSim tauri packaging asset (icon.png)"
Cohesion: 1.00
Nodes (3): VillageSim tauri packaging asset (icon.png), VillageSim app icon — Primary VillageSim app icon (512×512), Yellow circle on green checkerboard VillageSim brand mark

### Community 113 - "VillageSim app icon — Square107x107Logo Windows packaging icon"
Cohesion: 1.00
Nodes (3): VillageSim app icon — Square107x107Logo Windows packaging icon, VillageSim windows packaging asset (Square107x107Logo.png), Yellow circle on green checkerboard VillageSim brand mark

### Community 114 - "VillageSim app icon — Square142x142Logo Windows packaging icon"
Cohesion: 1.00
Nodes (3): VillageSim app icon — Square142x142Logo Windows packaging icon, VillageSim windows packaging asset (Square142x142Logo.png), Yellow circle on green checkerboard VillageSim brand mark

### Community 115 - "VillageSim app icon — Square150x150Logo Windows packaging icon"
Cohesion: 1.00
Nodes (3): VillageSim app icon — Square150x150Logo Windows packaging icon, VillageSim windows packaging asset (Square150x150Logo.png), Yellow circle on green checkerboard VillageSim brand mark

### Community 116 - "VillageSim app icon — Square284x284Logo Windows packaging icon"
Cohesion: 1.00
Nodes (3): VillageSim app icon — Square284x284Logo Windows packaging icon, VillageSim windows packaging asset (Square284x284Logo.png), Yellow circle on green checkerboard VillageSim brand mark

### Community 117 - "VillageSim app icon — Square30x30Logo Windows packaging icon"
Cohesion: 1.00
Nodes (3): VillageSim app icon — Square30x30Logo Windows packaging icon, VillageSim windows packaging asset (Square30x30Logo.png), Yellow circle on green checkerboard VillageSim brand mark

### Community 118 - "VillageSim app icon — Square310x310Logo Windows packaging icon"
Cohesion: 1.00
Nodes (3): VillageSim app icon — Square310x310Logo Windows packaging icon, VillageSim windows packaging asset (Square310x310Logo.png), Yellow circle on green checkerboard VillageSim brand mark

### Community 119 - "VillageSim app icon — Square44x44Logo Windows packaging icon"
Cohesion: 1.00
Nodes (3): VillageSim app icon — Square44x44Logo Windows packaging icon, VillageSim windows packaging asset (Square44x44Logo.png), Yellow circle on green checkerboard VillageSim brand mark

### Community 120 - "VillageSim app icon — Square71x71Logo Windows packaging icon"
Cohesion: 1.00
Nodes (3): VillageSim app icon — Square71x71Logo Windows packaging icon, VillageSim windows packaging asset (Square71x71Logo.png), Yellow circle on green checkerboard VillageSim brand mark

### Community 121 - "VillageSim app icon — Square89x89Logo Windows packaging icon"
Cohesion: 1.00
Nodes (3): VillageSim app icon — Square89x89Logo Windows packaging icon, VillageSim windows packaging asset (Square89x89Logo.png), Yellow circle on green checkerboard VillageSim brand mark

### Community 122 - "VillageSim app icon — StoreLogo Windows Store packaging icon"
Cohesion: 1.00
Nodes (3): VillageSim app icon — StoreLogo Windows Store packaging icon, VillageSim windows packaging asset (StoreLogo.png), Yellow circle on green checkerboard VillageSim brand mark

### Community 140 - "props.ts"
Cohesion: 0.12
Nodes (16): BOULDER, BUSH, CYPRESS, DEADFALL, DRIFTWOOD, FLOWERS, grid(), MUSHROOM (+8 more)

### Community 143 - ".isPassable"
Cohesion: 0.15
Nodes (4): actionThought(), jobThought(), wanderTile(), wrapU64()

### Community 149 - "Option"
Cohesion: 0.16
Nodes (8): HaulTask, Building, BTreeMap, BuildingDef, storage_accepts(), ActionKind, Option, PathBuf

## Knowledge Gaps
- **337 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+332 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `World` connect `World` to `Clock`, `utility.rs`, `world.rs`, `persist.rs`, `chronicle.rs`, `.maybe_decide`, `Villager`, `.generate`, `Option`, `economy.rs`, `String`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Why does `entry()` connect `app-icon.ts` to `chronicle.ts`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `entitySources()` connect `app-icon.ts` to `grid.ts`, `build.ts`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `Canvas()` (e.g. with `.recordFrame()` and `.setDrawStats()`) actually correct?**
  _`Canvas()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _337 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `World` be split into smaller, more focused modules?**
  _Cohesion score 0.0733162830349531 - nodes in this community are weakly interconnected._
- **Should `Clock` be split into smaller, more focused modules?**
  _Cohesion score 0.050351721584598295 - nodes in this community are weakly interconnected._