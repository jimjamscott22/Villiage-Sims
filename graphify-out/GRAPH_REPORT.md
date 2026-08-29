# Graph Report - Villiage-Sims  (2026-08-29)

## Corpus Check
- 137 files · ~160,960 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1854 nodes · 3661 edges · 150 communities (129 shown, 21 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 162 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ffad3541`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- World
- Clock
- utility.rs
- catalog.rs
- src/commands.rs
- devDependencies
- Tick Loop (20 Hz)
- world.rs
- DemoWorld
- persist.rs
- scene.ts
- demoWorld.ts
- chronicle.rs
- .maybe_decide
- Villager
- Canvas.tsx
- terrain.ts
- ui.ts
- .generate
- compilerOptions
- economy.rs
- chronicle.ts
- .findHaulTask
- App.tsx
- .placeBuilding
- grid.ts
- vfx.ts
- compilerOptions
- weather.rs
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
- Transport
- tauri.conf.json
- snapshot.rs
- Island Map Scene
- pick highest → Eat
- atlas.ts
- Camera
- crops.rs
- rasterizeGrid
- Village Chronicle
- WORLD
- ResourceNode
- villagers.ts
- SIM · 50 ms tick timeline
- ResourceTotals
- Genart Art Pipeline
- 1. Input Stage (User IPC Action / 50ms Sim Timer)
- .place_building
- pathfind.ts
- types.ts
- Overlay (build ghost · selection · hover — every frame in build mode)
- Utility AI
- default.json
- Tech / Unlock Tree
- Props and Assets Backlog
- VillageSim Application Icon
- vite-env.d.ts
- Economy and Production Chains
- BuildMenu
- Entity spritesheet (entities.png)
- Terrain tiles spritesheet (tiles.png)
- HUD/UI spritesheet (ui.png)
- Seeded Terrain Generation
- mpsc SimCommand Channel
- VillageSim tauri packaging asset (128x128@2x.png)
- VillageSim tauri packaging asset (128x128.png)
- VillageSim tauri packaging asset (32x32.png)
- VillageSim tauri packaging asset (64x64.png)
- VillageSim android packaging asset (ic_launcher.png)
- VillageSim android packaging asset (ic_launcher_foreground.png)
- VillageSim android packaging asset (ic_launcher_round.png)
- VillageSim android packaging asset (ic_launcher.png)
- VillageSim android packaging asset (ic_launcher_foreground.png)
- VillageSim android packaging asset (ic_launcher_round.png)
- VillageSim android packaging asset (ic_launcher.png)
- VillageSim android packaging asset (ic_launcher_foreground.png)
- VillageSim android packaging asset (ic_launcher_round.png)
- VillageSim android packaging asset (ic_launcher.png)
- VillageSim android packaging asset (ic_launcher_foreground.png)
- VillageSim android packaging asset (ic_launcher_round.png)
- VillageSim android packaging asset (ic_launcher.png)
- VillageSim android packaging asset (ic_launcher_foreground.png)
- VillageSim android packaging asset (ic_launcher_round.png)
- VillageSim tauri packaging asset (icon.png)
- VillageSim ios packaging asset (AppIcon-20x20@1x.png)
- VillageSim ios packaging asset (AppIcon-20x20@2x-1.png)
- VillageSim ios packaging asset (AppIcon-20x20@2x.png)
- VillageSim ios packaging asset (AppIcon-20x20@3x.png)
- VillageSim ios packaging asset (AppIcon-29x29@1x.png)
- VillageSim ios packaging asset (AppIcon-29x29@2x-1.png)
- VillageSim ios packaging asset (AppIcon-29x29@2x.png)
- VillageSim ios packaging asset (AppIcon-29x29@3x.png)
- VillageSim ios packaging asset (AppIcon-40x40@1x.png)
- VillageSim ios packaging asset (AppIcon-40x40@2x-1.png)
- VillageSim ios packaging asset (AppIcon-40x40@2x.png)
- VillageSim ios packaging asset (AppIcon-40x40@3x.png)
- VillageSim ios packaging asset (AppIcon-512@2x.png)
- VillageSim ios packaging asset (AppIcon-60x60@2x.png)
- VillageSim ios packaging asset (AppIcon-60x60@3x.png)
- VillageSim ios packaging asset (AppIcon-76x76@1x.png)
- VillageSim ios packaging asset (AppIcon-76x76@2x.png)
- VillageSim ios packaging asset (AppIcon-83.5x83.5@2x.png)
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
- M1 Implementation Plan
- Raised/recessed bevel frame for border-image panels
- Sun
- Milestone 5 Design
- Milestone 6 Design
- Milestone 7 Design
- Milestone 8 Design
- Pixel Art UI Redesign Design
- Event Log / Village Chronicle Design
- props.ts
- resourceGet
- Season
- .isPassable
- .snapshot
- buildings.rs
- .listenToTicks
- PlacementValidity
- app-icon.test.ts
- Option

## God Nodes (most connected - your core abstractions)
1. `World` - 133 edges
2. `DemoWorld` - 112 edges
3. `grass_world()` - 42 edges
4. `Canvas()` - 31 edges
5. `Clock` - 22 edges
6. `JobBoard` - 22 edges
7. `BrowserTransport` - 21 edges
8. `TickSnapshot` - 21 edges
9. `SimCommand` - 20 edges
10. `AppState` - 19 edges

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
- **Pixel Art Redesign Phases 1–3** — progress_art_phases, docs_superpowers_plans_2026_07_31_pixel_art_phase_1_terrain_plan, docs_superpowers_plans_2026_08_04_pixel_art_phase_2_entities_plan, docs_superpowers_plans_2026_08_04_pixel_art_phase_3_hud_plan, agents_genart_pipeline [EXTRACTED 1.00]
- **M1 Authoritative Simulation Pipe** — docs_superpowers_specs_2026_07_16_milestone_1_design_tick_loop, docs_superpowers_specs_2026_07_16_milestone_1_design_world, docs_superpowers_specs_2026_07_16_milestone_1_design_tick_snapshot, docs_superpowers_specs_2026_07_16_milestone_1_design_snapshot_interpolation, docs_superpowers_specs_2026_07_16_milestone_1_design_browser_demo_transport [EXTRACTED 1.00]
- **Grain Harvest to Food Economy Chain** — docs_superpowers_specs_2026_07_19_milestone_5_design_tend_crops, docs_superpowers_specs_2026_07_20_milestone_6_design_crops, docs_superpowers_specs_2026_07_24_milestone_8_design_haul_jobs, docs_superpowers_specs_2026_07_24_milestone_8_design_recipes, docs_superpowers_specs_2026_07_24_milestone_8_design_economy_loop, docs_superpowers_specs_2026_07_24_milestone_8_design_resource_bar [EXTRACTED 1.00]
- **Chronicle Sync and Persistence** — docs_superpowers_specs_2026_08_02_event_log_design_village_chronicle, docs_superpowers_specs_2026_08_02_event_log_design_chronicle_seq, docs_superpowers_specs_2026_08_02_event_log_design_chronicle_body, docs_superpowers_specs_2026_08_02_event_log_design_watch_channel_event_loss, docs_superpowers_specs_2026_08_02_event_log_design_chronicle_drawer [EXTRACTED 1.00]
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

## Communities (150 total, 21 thin omitted)

### Community 0 - "World"
Cohesion: 0.10
Nodes (7): MovePurpose, ResourceNode, Fn, wander_tile(), BuildingView, Vec, World

### Community 1 - "Clock"
Cohesion: 0.17
Nodes (9): Default, Duration, Clock, ClockView, day_season_year_rollover(), minute_accumulates_to_day(), Rollover, rollover_reports_season_change() (+1 more)

### Community 2 - "utility.rs"
Cohesion: 0.06
Nodes (35): farm_advertises_tend_crops_slots(), granary_advertises_haul_in_m8(), Job, JobBoard, JobKind, mill_advertises_produce_and_haul(), peek_prefers_closer_job_at_equal_priority(), peek_prefers_priority_over_distance() (+27 more)

### Community 3 - "catalog.rs"
Cohesion: 0.08
Nodes (42): CropDef, BuildingDef, terrain_allowed(), BuildingDef, builtin_catalog_loads_buildings_and_crops(), Catalog, decor_buildings_are_jobless_and_appended_last(), JobDef (+34 more)

### Community 4 - "src/commands.rs"
Cohesion: 0.10
Nodes (45): advance_clock(), app_state_holds_catalog(), AppState, demolish(), get_catalog(), get_chronicle(), get_terrain(), get_villager_detail() (+37 more)

### Community 5 - "devDependencies"
Cohesion: 0.04
Nodes (47): esbuild, allowScripts, esbuild@0.28.1, dependencies, react, react-dom, @tauri-apps/api, devDependencies (+39 more)

### Community 6 - "Tick Loop (20 Hz)"
Cohesion: 0.05
Nodes (45): Milestone 1 Design, Browser-Demo Transport, Snapshot Interpolation, Tick Loop (20 Hz), TickSnapshot, World, Milestone 2 Design, Camera Pan/Zoom (+37 more)

### Community 7 - "world.rs"
Cohesion: 0.12
Nodes (37): autonomous_jobs_run_farm_to_bakery_chain(), autosave_disabled_without_directory(), autosave_rotates_through_three_slots(), clear_day_leaves_crops_dry_after_rollover(), construction_completes_after_build_ticks(), day_rollover_clears_water_and_paused_skips_advance(), demolish_farm_removes_crops(), derived_totals_ignore_farm_buffer_and_include_granary() (+29 more)

### Community 8 - "DemoWorld"
Cohesion: 0.10
Nodes (4): demoAutosaveSlot(), DemoWorld, fullNeeds(), recomputeHappiness()

### Community 9 - "persist.rs"
Cohesion: 0.10
Nodes (35): Arc, AtomicBool, Drop, JoinHandle, Mutex, Path, forward_snapshots(), AppHandle (+27 more)

### Community 10 - "scene.ts"
Cohesion: 0.09
Nodes (35): Atlas, animFrame(), atlasHasEntities(), bubbleForState(), buildDrawList(), buildDrawListWithStats(), BUILDING_VFX, BuildingVfx (+27 more)

### Community 11 - "demoWorld.ts"
Cohesion: 0.06
Nodes (33): ACTION_ORDER, ActionKind, actionRank(), AgentStateName, CarryStack, chebyshev(), DEMO_CROPS, DEMO_SAVE_VERSION (+25 more)

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
Nodes (23): drawCell(), Canvas(), cropPlantValid(), HoverDisplay, rotatedFootprint(), BUILDING_COLORS, CROP_STAGE_COLORS, drawBuildings() (+15 more)

### Community 16 - "terrain.ts"
Cohesion: 0.21
Nodes (16): terrainSources(), hash01(), PaletteName, toRgba(), BaseTerrain, borderDistance(), depthAt(), Edge (+8 more)

### Community 17 - "ui.ts"
Cohesion: 0.07
Nodes (31): BAR_NOTCH, BAR_NOTCH_EMPTY, BRACKET_BL, BRACKET_BR, BRACKET_TL, BRACKET_TR, bracketCorner(), FONT_GLYPH_ORDER (+23 more)

### Community 19 - ".generate"
Cohesion: 0.13
Nodes (13): chronicle_death_entry_carries_the_name(), chronicle_records_building_completion(), chronicle_records_season_turn(), generated_world_has_expected_dimensions(), mill_is_locked_in_a_fresh_world(), BTreeSet, Self, TerrainSnapshot (+5 more)

### Community 20 - "compilerOptions"
Cohesion: 0.07
Nodes (26): DOM, DOM.Iterable, src, vite/client, vite.config.ts, compilerOptions, allowImportingTsExtensions, jsx (+18 more)

### Community 21 - "economy.rs"
Cohesion: 0.26
Nodes (17): CarryStack, derive_totals(), derive_totals_ignores_production_buffers(), HaulEndpoint, HaulTask, inventory_add(), inventory_get(), inventory_take() (+9 more)

### Community 22 - "chronicle.ts"
Cohesion: 0.22
Nodes (12): buildingName(), CHRONICLE_EMPTY_MESSAGE, formatDivider(), formatEntry(), needsDivider(), seasonName(), SEASONS, BIRTH (+4 more)

### Community 23 - ".findHaulTask"
Cohesion: 0.24
Nodes (6): inventoryTotal(), productionFreeCapacity(), recipeAllowsResource(), stockpileAccepts(), storageAccepts(), storageFreeCapacity()

### Community 24 - "App.tsx"
Cohesion: 0.07
Nodes (50): App(), root, DemoSaveState, ClockView, ResourceTotals, VillagerDetail, getAtlasManifest(), getSheetSize() (+42 more)

### Community 25 - ".placeBuilding"
Cohesion: 0.26
Nodes (3): footprintTiles(), inventoryAdd(), rotatedFootprint()

### Community 26 - "grid.ts"
Cohesion: 0.24
Nodes (8): mirrorHorizontal(), remapColor(), assertPaletteHex(), BY_HEX, Rgba, Raster, BLUE, RED

### Community 27 - "vfx.ts"
Cohesion: 0.12
Nodes (19): SpriteGrid, PALETTE, BuildingSprite, CROP_SPRITES, CropSprite, grid(), Pal, WHEAT_STAGE_3_SWAY (+11 more)

### Community 28 - "compilerOptions"
Cohesion: 0.10
Nodes (20): tools, compilerOptions, allowImportingTsExtensions, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 29 - "weather.rs"
Cohesion: 0.17
Nodes (12): autosave_slot_for(), distribution_covers_all_kinds(), mix(), Option, Self, storm_damage_index(), storm_index_in_range(), Weather (+4 more)

### Community 30 - "World Struct (world.rs)"
Cohesion: 0.13
Nodes (20): Villagers & Needs (agents.rs, needs.rs), Sprite Atlas Manager (atlas.ts), BrowserTransport (DemoWorld TS Sim), Canvas Component (Canvas.tsx), Content Catalog (catalog.rs), Chronicle Event Log (chronicle.rs), Component Relationships Diagram, Render Module (drawTerrain, drawEntities, drawGhost) (+12 more)

### Community 31 - "build.ts"
Cohesion: 0.12
Nodes (17): AtlasCellDef, AtlasManifest, BuiltAtlas, BuiltSheet, packSheet(), SHEET_WIDTH, Source, pack() (+9 more)

### Community 32 - "transport.ts"
Cohesion: 0.20
Nodes (12): classify(), DEFAULT_HEIGHT, DEFAULT_SEED, DEFAULT_TILE_SIZE, DEFAULT_WIDTH, fbm(), generateDemoTerrain(), hash2() (+4 more)

### Community 33 - "Authoritative Rust Simulation"
Cohesion: 0.12
Nodes (19): Authoritative Rust Simulation, Browser-Demo Transport, DEMO_CATALOG Mirror Constraint, React + Canvas Renderer, 20 Hz Tick Snapshots, VillageSim, Project Documenter Agent, Project Summary HTML (+11 more)

### Community 34 - "perfBaseline.test.ts"
Cohesion: 0.11
Nodes (14): buildings, crops, manifest, Facing, footprintIntersects(), packCell(), SPATIAL_CELL_TILES, terrainBlitRect() (+6 more)

### Community 35 - "tilemap.ts"
Cohesion: 0.16
Nodes (19): BASE_BY_TERRAIN, BaseTerrainName, baseTerrainOf(), CORNERS, decorFor(), DecorPick, hash01(), isWater() (+11 more)

### Community 36 - "RUST · simulation thread (20 Hz · 50 ms)"
Cohesion: 0.12
Nodes (18): One Authoritative World, One Thin Renderer, Camera (pan · cursor zoom), Canvas stack (terrain · entities · overlay), Clock & seasons (day · season · year), commands (mpsc channel), Data-driven content (buildings.json · crops.json · traits.json), Architecture — one authoritative world, one thin renderer, Economy (resources · buildings) (+10 more)

### Community 39 - "buildings.ts"
Cohesion: 0.10
Nodes (21): BAKERY, bakeryFrame(), BUILDING_SPRITES, FARM, FARM_FIELD, FENCE, GATE, GRANARY (+13 more)

### Community 40 - "Rust Authoritative Simulation (20 Hz Thread)"
Cohesion: 0.17
Nodes (16): Pixel Art Atlas (public/art/tiles.png & atlas.json), 3-Layer Canvas Stack (Offscreen Terrain, Dynamic Entities, Build Ghost), Data-Driven Catalog (buildings.json & crops.json), Chronicle & Persistence (200-entry log & bincode v2), Clock & Seasons (Pause / 1x / 2x / 3x Speed), Commands Channel (mpsc), High-Level Architecture Diagram, Interpolation Engine (2-Snapshot buffer, alpha factor) (+8 more)

### Community 41 - "Transport"
Cohesion: 0.15
Nodes (3): Transport, PlacementResult, WorldInit

### Community 42 - "tauri.conf.json"
Cohesion: 0.12
Nodes (15): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+7 more)

### Community 43 - "snapshot.rs"
Cohesion: 0.20
Nodes (14): ClockView, CropView, BuildingView, BuildingView, Option, ResourceTotals, String, Vec (+6 more)

### Community 44 - "Island Map Scene"
Cohesion: 0.15
Nodes (15): Farm Plot with Growing Crops, VillageSim Hero Banner, House Building, Island Map Scene, Dashed Villager Path, VillageSim, an autonomous village, simulated in Rust and drawn on Canvas, Forest Terrain (+7 more)

### Community 45 - "pick highest → Eat"
Cohesion: 0.17
Nodes (15): Eat (1 − hunger)² · gated on food available → 0.49, Sleep (1 − energy)² · ×1.5 at night → 0.19, Socialize (1 − social)^1.5 · partner ≤ 8 tiles → 0.10, Wander constant 0.05 floor → 0.05, Work 0.4 · priority/10 · 1/(1+dist·0.05) → 0.34, How a villager decides — utility scoring, Energy (0.56), Happiness (derived) (+7 more)

### Community 46 - "atlas.ts"
Cohesion: 0.29
Nodes (9): ART_SCALE, AtlasCell, AtlasManifest, cellRect(), frameCount(), loadAtlas(), loadImage(), animated (+1 more)

### Community 47 - "Camera"
Cohesion: 0.18
Nodes (3): Camera, MAX_ZOOM, MIN_ZOOM

### Community 48 - "crops.rs"
Cohesion: 0.18
Nodes (13): Crop, crop_ready_emits_once(), CropDef, CropView, growth_requires_water_and_season(), BTreeMap, Option, Self (+5 more)

### Community 49 - "rasterizeGrid"
Cohesion: 0.18
Nodes (17): entry(), buildAtlas(), entitySources(), fromSprite(), uiSources(), rasterizeGrid(), main(), ART_DIR (+9 more)

### Community 50 - "Village Chronicle"
Cohesion: 0.20
Nodes (12): Autosave Slot Rotation, Village Chronicle, ChronicleBody Dual Serde Forms, Save/Load Persistence, Deterministic Weather, ChronicleDrawer, State of the Game Review, chronicleSeq Refetch Pattern (+4 more)

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
Cohesion: 0.22
Nodes (10): Genart Art Pipeline, ART_SCALE 2x, 29-Color Art Palette, Decoded-Pixel Drift Test, Pixel Art Phase 1 Terrain Plan, Pixel Art Phase 2 Entities Plan, Y-Sorted Scene Pass, PixelText Bitmap Font (+2 more)

### Community 57 - "1. Input Stage (User IPC Action / 50ms Sim Timer)"
Cohesion: 0.20
Nodes (10): Processing Pipeline Diagram, Linear Tick-to-Render Pipeline, 1. Input Stage (User IPC Action / 50ms Sim Timer), 2. Clock & Crop Stage (Advance clock ticks, crop growth, season check), 3. Utility AI & Needs Stage (Decay hunger/energy/social, score actions & apply hysteresis), 4. Movement & Economy Stage (A* path step, job assignment, haul/produce/gather execution), 5. Population & Chronicle Stage (Housing capacity births/starvation deaths, log events), 6. Viewport Culling & Broadcast Stage (Cull entities outside camera margin, emit TickSnapshot to watch channel) (+2 more)

### Community 58 - ".place_building"
Cohesion: 0.14
Nodes (15): footprint_tiles(), rotated_footprint(), Vec, completed_farm_advertises_tend_crops_and_villager_works(), demolish_farm_clears_jobs_and_returns_villager_to_idle(), demolish_refunds_cost_and_clears_occupancy(), hut_places_on_grass_and_rejects_water(), place_building_rejects_a_locked_kind() (+7 more)

### Community 59 - "pathfind.ts"
Cohesion: 0.36
Nodes (7): DELTAS, findPath(), heuristic(), IMPASSABLE, pack(), terrainPassable(), unpack()

### Community 60 - "types.ts"
Cohesion: 0.10
Nodes (19): CanvasProps, hoverTargetAt(), HoverTargetInput, rotatedFootprint(), catalog, VILLAGER_STATE_LABELS, SnapshotBuffer, resources (+11 more)

### Community 61 - "Overlay (build ghost · selection · hover — every frame in build mode)"
Cohesion: 0.36
Nodes (8): Build Ghost Overlay, Three stacked canvases, redrawn at different rates, Entities (buildings · crops · villagers — redrawn every frame), Isometric Three-Layer Stack Illustration, Redraw Rate Separation, Offscreen Terrain Buffer, Overlay (build ghost · selection · hover — every frame in build mode), Terrain (tiles — drawn on load, patched only on dirty tiles)

### Community 62 - "Utility AI"
Cohesion: 0.25
Nodes (8): M4 Pathfinding Plan, M5 Needs and Jobs Plan, M7 Utility AI Plan, Milestone 4 Villager FSM, Villager Needs, A* Pathfinding, Action Hysteresis Margin, Utility AI

### Community 63 - "default.json"
Cohesion: 0.25
Nodes (7): core:default, main, description, identifier, permissions, $schema, windows

### Community 64 - "Tech / Unlock Tree"
Cohesion: 0.33
Nodes (6): World::satisfied_unlocks, BuildMenu, Well Building, Ghost Preview Placement, M3 Building Placement Plan, Tech / Unlock Tree

### Community 65 - "Props and Assets Backlog"
Cohesion: 0.33
Nodes (6): Terrain Props (defining + decor), Props and Assets Backlog, Authoritative Sim Architecture, Housing Capacity, M9 Population and Progression, Milestone Roadmap M1–M10

### Community 66 - "VillageSim Application Icon"
Cohesion: 0.47
Nodes (6): VillageSim Application Icon, Green Checkered Field Background, Dark Green Square Border, Minimalist Flat Icon Design, Grid World Metaphor, Central Yellow Circle

### Community 68 - "Economy and Production Chains"
Cohesion: 0.50
Nodes (4): TendCrops Job, Grain→Flour→Food Chain, Economy and Production Chains, Job Board

### Community 69 - "BuildMenu"
Cohesion: 0.50
Nodes (4): Milestone 3 Design, BuildMenu, Building Catalog, satisfied_unlocks

### Community 70 - "Entity spritesheet (entities.png)"
Cohesion: 0.67
Nodes (4): Building sprites (houses, windmill, well), Entity spritesheet (entities.png), Environment props (trees, bush, rock, grass, fence), Villager walk/idle/sleep sprites (colored shirts)

### Community 71 - "Terrain tiles spritesheet (tiles.png)"
Cohesion: 0.67
Nodes (4): Green grass autotile edge and fill tiles, Tan sand/dirt autotile edge and fill tiles, Terrain tiles spritesheet (tiles.png), Teal water/coast autotile edge and fill tiles

### Community 72 - "HUD/UI spritesheet (ui.png)"
Cohesion: 0.67
Nodes (4): HUD icons (resources, bag, scroll, sun, tools), HUD/UI spritesheet (ui.png), Pixel font glyphs A–Z, 0–9, punctuation, Clock speed control icons (pause/play/fast-forward)

### Community 73 - "Seeded Terrain Generation"
Cohesion: 0.67
Nodes (3): M2 Terrain + Camera Plan, Seeded Terrain Generation, 128x128 World Grid Model

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

### Community 79 - "VillageSim android packaging asset (ic_launcher.png)"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher.png), VillageSim app icon — Android hdpi launcher icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 80 - "VillageSim android packaging asset (ic_launcher_foreground.png)"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher_foreground.png), VillageSim app icon — Android hdpi adaptive launcher foreground, Yellow circle on green checkerboard VillageSim brand mark

### Community 81 - "VillageSim android packaging asset (ic_launcher_round.png)"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher_round.png), VillageSim app icon — Android hdpi round launcher icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 82 - "VillageSim android packaging asset (ic_launcher.png)"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher.png), VillageSim app icon — Android mdpi launcher icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 83 - "VillageSim android packaging asset (ic_launcher_foreground.png)"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher_foreground.png), VillageSim app icon — Android mdpi adaptive launcher foreground, Yellow circle on green checkerboard VillageSim brand mark

### Community 84 - "VillageSim android packaging asset (ic_launcher_round.png)"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher_round.png), VillageSim app icon — Android mdpi round launcher icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 85 - "VillageSim android packaging asset (ic_launcher.png)"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher.png), VillageSim app icon — Android xhdpi launcher icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 86 - "VillageSim android packaging asset (ic_launcher_foreground.png)"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher_foreground.png), VillageSim app icon — Android xhdpi adaptive launcher foreground, Yellow circle on green checkerboard VillageSim brand mark

### Community 87 - "VillageSim android packaging asset (ic_launcher_round.png)"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher_round.png), VillageSim app icon — Android xhdpi round launcher icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 88 - "VillageSim android packaging asset (ic_launcher.png)"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher.png), VillageSim app icon — Android xxhdpi launcher icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 89 - "VillageSim android packaging asset (ic_launcher_foreground.png)"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher_foreground.png), VillageSim app icon — Android xxhdpi adaptive launcher foreground, Yellow circle on green checkerboard VillageSim brand mark

### Community 90 - "VillageSim android packaging asset (ic_launcher_round.png)"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher_round.png), VillageSim app icon — Android xxhdpi round launcher icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 91 - "VillageSim android packaging asset (ic_launcher.png)"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher.png), VillageSim app icon — Android xxxhdpi launcher icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 92 - "VillageSim android packaging asset (ic_launcher_foreground.png)"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher_foreground.png), VillageSim app icon — Android xxxhdpi adaptive launcher foreground, Yellow circle on green checkerboard VillageSim brand mark

### Community 93 - "VillageSim android packaging asset (ic_launcher_round.png)"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher_round.png), VillageSim app icon — Android xxxhdpi round launcher icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 94 - "VillageSim tauri packaging asset (icon.png)"
Cohesion: 1.00
Nodes (3): VillageSim tauri packaging asset (icon.png), VillageSim app icon — Primary VillageSim app icon (512×512), Yellow circle on green checkerboard VillageSim brand mark

### Community 95 - "VillageSim ios packaging asset (AppIcon-20x20@1x.png)"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-20x20@1x.png), VillageSim app icon — iOS AppIcon 20×20@1x, Yellow circle on green checkerboard VillageSim brand mark

### Community 96 - "VillageSim ios packaging asset (AppIcon-20x20@2x-1.png)"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-20x20@2x-1.png), VillageSim app icon — iOS AppIcon 20×20@2x (variant), Yellow circle on green checkerboard VillageSim brand mark

### Community 97 - "VillageSim ios packaging asset (AppIcon-20x20@2x.png)"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-20x20@2x.png), VillageSim app icon — iOS AppIcon 20×20@2x, Yellow circle on green checkerboard VillageSim brand mark

### Community 98 - "VillageSim ios packaging asset (AppIcon-20x20@3x.png)"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-20x20@3x.png), VillageSim app icon — iOS AppIcon 20×20@3x, Yellow circle on green checkerboard VillageSim brand mark

### Community 99 - "VillageSim ios packaging asset (AppIcon-29x29@1x.png)"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-29x29@1x.png), VillageSim app icon — iOS AppIcon 29×29@1x, Yellow circle on green checkerboard VillageSim brand mark

### Community 100 - "VillageSim ios packaging asset (AppIcon-29x29@2x-1.png)"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-29x29@2x-1.png), VillageSim app icon — iOS AppIcon 29×29@2x (variant), Yellow circle on green checkerboard VillageSim brand mark

### Community 101 - "VillageSim ios packaging asset (AppIcon-29x29@2x.png)"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-29x29@2x.png), VillageSim app icon — iOS AppIcon 29×29@2x, Yellow circle on green checkerboard VillageSim brand mark

### Community 102 - "VillageSim ios packaging asset (AppIcon-29x29@3x.png)"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-29x29@3x.png), VillageSim app icon — iOS AppIcon 29×29@3x, Yellow circle on green checkerboard VillageSim brand mark

### Community 103 - "VillageSim ios packaging asset (AppIcon-40x40@1x.png)"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-40x40@1x.png), VillageSim app icon — iOS AppIcon 40×40@1x, Yellow circle on green checkerboard VillageSim brand mark

### Community 104 - "VillageSim ios packaging asset (AppIcon-40x40@2x-1.png)"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-40x40@2x-1.png), VillageSim app icon — iOS AppIcon 40×40@2x (variant), Yellow circle on green checkerboard VillageSim brand mark

### Community 105 - "VillageSim ios packaging asset (AppIcon-40x40@2x.png)"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-40x40@2x.png), VillageSim app icon — iOS AppIcon 40×40@2x, Yellow circle on green checkerboard VillageSim brand mark

### Community 106 - "VillageSim ios packaging asset (AppIcon-40x40@3x.png)"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-40x40@3x.png), VillageSim app icon — iOS AppIcon 40×40@3x, Yellow circle on green checkerboard VillageSim brand mark

### Community 107 - "VillageSim ios packaging asset (AppIcon-512@2x.png)"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-512@2x.png), VillageSim app icon — iOS AppIcon 512@2x, Yellow circle on green checkerboard VillageSim brand mark

### Community 108 - "VillageSim ios packaging asset (AppIcon-60x60@2x.png)"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-60x60@2x.png), VillageSim app icon — iOS AppIcon 60×60@2x, Yellow circle on green checkerboard VillageSim brand mark

### Community 109 - "VillageSim ios packaging asset (AppIcon-60x60@3x.png)"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-60x60@3x.png), VillageSim app icon — iOS AppIcon 60×60@3x, Yellow circle on green checkerboard VillageSim brand mark

### Community 110 - "VillageSim ios packaging asset (AppIcon-76x76@1x.png)"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-76x76@1x.png), VillageSim app icon — iOS AppIcon 76×76@1x, Yellow circle on green checkerboard VillageSim brand mark

### Community 111 - "VillageSim ios packaging asset (AppIcon-76x76@2x.png)"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-76x76@2x.png), VillageSim app icon — iOS AppIcon 76×76@2x, Yellow circle on green checkerboard VillageSim brand mark

### Community 112 - "VillageSim ios packaging asset (AppIcon-83.5x83.5@2x.png)"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-83.5x83.5@2x.png), VillageSim app icon — iOS AppIcon 83.5×83.5@2x, Yellow circle on green checkerboard VillageSim brand mark

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

### Community 141 - "resourceGet"
Cohesion: 0.28
Nodes (5): canAfford(), inventoryGet(), inventoryTake(), resourceGet(), resourceSet()

### Community 142 - "Season"
Cohesion: 0.23
Nodes (5): Option, Result, Self, String, Season

### Community 144 - ".snapshot"
Cohesion: 0.22
Nodes (5): demoStormDamageIndex(), demoWeatherFor(), mixU64(), nearestVillagerId(), villagerById()

### Community 145 - "buildings.rs"
Cohesion: 0.24
Nodes (6): Building, BuildState, PlacementResult, PlacementValidity, BTreeMap, String

### Community 149 - "Option"
Cohesion: 0.13
Nodes (7): HaulEndpoint, HaulTask, BuildingDef, storage_accepts(), ActionKind, Option, PathBuf

## Knowledge Gaps
- **361 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+356 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `entry()` connect `rasterizeGrid` to `chronicle.ts`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `entitySources()` connect `rasterizeGrid` to `grid.ts`, `build.ts`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `World` connect `World` to `Clock`, `utility.rs`, `world.rs`, `persist.rs`, `chronicle.rs`, `.maybe_decide`, `Villager`, `crops.rs`, `buildings.rs`, `.generate`, `Option`, `economy.rs`, `.place_building`, `weather.rs`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `Canvas()` (e.g. with `.recordFrame()` and `.setDrawStats()`) actually correct?**
  _`Canvas()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _361 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `World` be split into smaller, more focused modules?**
  _Cohesion score 0.09506531204644413 - nodes in this community are weakly interconnected._
- **Should `utility.rs` be split into smaller, more focused modules?**
  _Cohesion score 0.05734767025089606 - nodes in this community are weakly interconnected._