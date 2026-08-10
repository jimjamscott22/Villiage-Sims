# Graph Report - .  (2026-08-10)

## Corpus Check
- 197 files · ~144,590 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1803 nodes · 3560 edges · 140 communities (124 shown, 16 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 161 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- World Haul Movement
- Clock Weather Crops
- Jobs and Utility AI
- Buildings Catalog Pathfind
- Sim Commands AppState
- NPM Package Dependencies
- Milestone Design Specs
- World Construction Tests
- DemoWorld Simulation
- Persist Threading Runtime
- Scene Atlas Rendering
- DemoWorld Agent Actions
- Chronicle Event Log
- World Economy Tests
- Agent Needs States
- Canvas Entity Drawing
- Terrain Sprite Generation
- UI Sprite Chrome
- DemoWorld Action Begin
- World Generation Tests
- TypeScript App Config
- Economy Resource Totals
- Chronicle Frontend Format
- DemoWorld Job Helpers
- Build Menu UI
- DemoWorld Build Economy
- Genart Grid Palette
- Crop Prop Sprites
- Tools TypeScript Config
- App Clock Resource Bars
- Component Relationship Diagram
- Genart Atlas Builder
- Demo Terrain Generation
- Authoritative Architecture Docs
- Spatial Culling Helpers
- Tilemap Terrain Props
- Architecture Overview Diagram
- DemoWorld Unit Tests
- Browser Transport Layer
- Building Sprite Frames
- High-Level Architecture Diagram
- Transport IPC Methods
- Tauri App Configuration
- Snapshot View Models
- Hero Banner Illustration
- Utility AI Scoring Diagram
- Atlas Sprite Loader
- Camera Pan Zoom
- Pixel Font Rendering
- Genart PNG Pipeline
- Chronicle Persistence Weather
- World Data Model Diagram
- Resource Node Gathering
- Villager Sprite Frames
- Tick Interpolation Pipeline
- Resource Afford Refund
- Pixel Art Pipeline Docs
- Processing Pipeline Diagram
- DemoWorld Snapshot Views
- Pathfinding Algorithm
- Snapshot Interpolation Buffer
- Canvas Layers Diagram
- Needs Jobs Pathfinding Docs
- Tauri Capabilities Config
- Building Placement Unlocks
- Props Progression Docs
- Application Brand Icon
- Vite Env Game Commands
- Economy Production Chain
- Milestone 3 Design Spec
- Entity Art Spritesheet
- Terrain Art Spritesheet
- HUD UI Art Spritesheet
- Terrain Camera Docs
- Command Channel Ownership
- Tauri Icon 128 Retina
- Tauri Icon 128
- Tauri Icon 32
- Tauri Icon 64
- Android Hdpi Launcher
- Android Hdpi Foreground
- Android Hdpi Round
- Android Mdpi Launcher
- Android Mdpi Foreground
- Android Mdpi Round
- Android Xhdpi Launcher
- Android Xhdpi Foreground
- Android Xhdpi Round
- Android Xxhdpi Launcher
- Android Xxhdpi Foreground
- Android Xxhdpi Round
- Android Xxxhdpi Launcher
- Android Xxxhdpi Foreground
- Android Xxxhdpi Round
- Primary App Icon
- iOS Icon 20 1x
- iOS Icon 20 2x Variant
- iOS Icon 20 2x
- iOS Icon 20 3x
- iOS Icon 29 1x
- iOS Icon 29 2x Variant
- iOS Icon 29 2x
- iOS Icon 29 3x
- iOS Icon 40 1x
- iOS Icon 40 2x Variant
- iOS Icon 40 2x
- iOS Icon 40 3x
- iOS Icon 512
- iOS Icon 60 2x
- iOS Icon 60 3x
- iOS Icon 76 1x
- iOS Icon 76 2x
- iOS Icon 83.5 2x
- Windows Square107 Icon
- Windows Square142 Icon
- Windows Square150 Icon
- Windows Square284 Icon
- Windows Square30 Icon
- Windows Square310 Icon
- Windows Square44 Icon
- Windows Square71 Icon
- Windows Square89 Icon
- Windows Store Logo
- Root TypeScript Config
- Building Catalog Indexing
- Economy Resource Bar Docs
- TickSnapshot Viewport Docs
- Villager Traits Panel
- Milestone 1 Plan Docs
- Nine-Slice Panel Chrome
- Hero Sun Motif
- Milestone 5 Design Spec
- Milestone 6 Design Spec
- Milestone 7 Design Spec
- Milestone 8 Design Spec
- Pixel Art UI Design Spec
- Event Log Design Spec

## God Nodes (most connected - your core abstractions)
1. `World` - 133 edges
2. `DemoWorld` - 112 edges
3. `grass_world()` - 42 edges
4. `Canvas()` - 30 edges
5. `Clock` - 22 edges
6. `JobBoard` - 22 edges
7. `BrowserTransport` - 21 edges
8. `SimCommand` - 20 edges
9. `AppState` - 19 edges
10. `Villager` - 19 edges

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

## Communities (140 total, 16 thin omitted)

### Community 0 - "World Haul Movement"
Cohesion: 0.07
Nodes (14): HaulTask, MovePurpose, ResourceNode, rotated_footprint(), Fn, wander_tile(), order_move_falls_back_when_requested_villager_is_gone(), order_move_prefers_requested_villager() (+6 more)

### Community 1 - "Clock Weather Crops"
Cohesion: 0.05
Nodes (39): Default, Duration, Clock, ClockView, day_season_year_rollover(), minute_accumulates_to_day(), Rollover, rollover_reports_season_change() (+31 more)

### Community 2 - "Jobs and Utility AI"
Cohesion: 0.06
Nodes (35): farm_advertises_tend_crops_slots(), granary_advertises_haul_in_m8(), Job, JobBoard, JobKind, mill_advertises_produce_and_haul(), peek_prefers_closer_job_at_equal_priority(), peek_prefers_priority_over_distance() (+27 more)

### Community 3 - "Buildings Catalog Pathfind"
Cohesion: 0.06
Nodes (44): CropDef, BuildState, PlacementResult, PlacementValidity, BuildingDef, String, terrain_allowed(), BuildingDef (+36 more)

### Community 4 - "Sim Commands AppState"
Cohesion: 0.10
Nodes (45): advance_clock(), app_state_holds_catalog(), AppState, demolish(), get_catalog(), get_chronicle(), get_terrain(), get_villager_detail() (+37 more)

### Community 5 - "NPM Package Dependencies"
Cohesion: 0.04
Nodes (47): esbuild, allowScripts, esbuild@0.28.1, dependencies, react, react-dom, @tauri-apps/api, devDependencies (+39 more)

### Community 6 - "Milestone Design Specs"
Cohesion: 0.05
Nodes (45): Milestone 1 Design, Browser-Demo Transport, Snapshot Interpolation, Tick Loop (20 Hz), TickSnapshot, World, Milestone 2 Design, Camera Pan/Zoom (+37 more)

### Community 7 - "World Construction Tests"
Cohesion: 0.10
Nodes (23): footprint_tiles(), Vec, clear_day_leaves_crops_dry_after_rollover(), completed_farm_advertises_tend_crops_and_villager_works(), construction_completes_after_build_ticks(), day_rollover_clears_water_and_paused_skips_advance(), demolish_farm_clears_jobs_and_returns_villager_to_idle(), demolish_farm_removes_crops() (+15 more)

### Community 8 - "DemoWorld Simulation"
Cohesion: 0.10
Nodes (5): demoAutosaveSlot(), DemoWorld, fullNeeds(), recomputeHappiness(), ChronicleBody

### Community 9 - "Persist Threading Runtime"
Cohesion: 0.10
Nodes (35): Arc, AtomicBool, Drop, JoinHandle, Mutex, Path, forward_snapshots(), AppHandle (+27 more)

### Community 10 - "Scene Atlas Rendering"
Cohesion: 0.09
Nodes (33): Atlas, buildings, crops, manifest, animFrame(), atlasHasEntities(), BAKERY_TICKS_PER_FRAME, bubbleForState() (+25 more)

### Community 11 - "DemoWorld Agent Actions"
Cohesion: 0.07
Nodes (33): ACTION_ORDER, ActionKind, actionRank(), AgentStateName, CarryStack, DEMO_CROPS, DEMO_SAVE_VERSION, DemoBuilding (+25 more)

### Community 12 - "Chronicle Event Log"
Cohesion: 0.15
Nodes (26): Item, Iterator, born(), captures_the_clock_date(), Chronicle, ChronicleBody, ChronicleBodyView, ChronicleEntry (+18 more)

### Community 13 - "World Economy Tests"
Cohesion: 0.13
Nodes (29): Building, BTreeMap, autonomous_jobs_run_farm_to_bakery_chain(), autosave_disabled_without_directory(), completed_eat_clears_action_so_hysteresis_cannot_reenter(), derived_totals_ignore_farm_buffer_and_include_granary(), gather_job_adds_wood_to_stockpile(), gather_jobs_include_reachable_wood_and_stone_nodes() (+21 more)

### Community 14 - "Agent Needs States"
Cohesion: 0.10
Nodes (14): CarryStack, Into, AgentState, MovePurpose, ActionKind, Option, Self, String (+6 more)

### Community 15 - "Canvas Entity Drawing"
Cohesion: 0.13
Nodes (21): drawCell(), Canvas(), cropPlantValid(), rotatedFootprint(), BUILDING_COLORS, CROP_STAGE_COLORS, drawBuildings(), drawCrops() (+13 more)

### Community 16 - "Terrain Sprite Generation"
Cohesion: 0.12
Nodes (23): SHEET_WIDTH, terrainSources(), hash01(), PaletteName, BASE_TERRAINS, BaseTerrain, borderDistance(), depthAt() (+15 more)

### Community 17 - "UI Sprite Chrome"
Cohesion: 0.07
Nodes (30): BAR_NOTCH, BAR_NOTCH_EMPTY, BRACKET_BL, BRACKET_BR, BRACKET_TL, BRACKET_TR, bracketCorner(), FONT_GLYPH_ORDER (+22 more)

### Community 18 - "DemoWorld Action Begin"
Cohesion: 0.12
Nodes (3): chebyshev(), wanderTile(), wrapU64()

### Community 19 - "World Generation Tests"
Cohesion: 0.10
Nodes (16): autosave_rotates_through_three_slots(), chronicle_death_entry_carries_the_name(), chronicle_records_building_completion(), chronicle_records_season_turn(), generated_world_has_expected_dimensions(), mill_is_locked_in_a_fresh_world(), BTreeSet, PathBuf (+8 more)

### Community 20 - "TypeScript App Config"
Cohesion: 0.07
Nodes (26): DOM, DOM.Iterable, src, vite/client, vite.config.ts, compilerOptions, allowImportingTsExtensions, jsx (+18 more)

### Community 21 - "Economy Resource Totals"
Cohesion: 0.19
Nodes (20): HaulEndpoint, CarryStack, derive_totals(), derive_totals_ignores_production_buffers(), HaulEndpoint, HaulTask, inventory_add(), inventory_get() (+12 more)

### Community 22 - "Chronicle Frontend Format"
Cohesion: 0.17
Nodes (14): CanvasProps, buildingName(), CHRONICLE_EMPTY_MESSAGE, formatDivider(), formatEntry(), needsDivider(), seasonName(), SEASONS (+6 more)

### Community 23 - "DemoWorld Job Helpers"
Cohesion: 0.14
Nodes (7): inventoryAdd(), inventoryTotal(), productionFreeCapacity(), recipeAllowsResource(), stockpileAccepts(), storageAccepts(), storageFreeCapacity()

### Community 24 - "Build Menu UI"
Cohesion: 0.15
Nodes (17): VillagerDetail, BuildMenu(), BuildMenuProps, formatCost(), formatRecipe(), barNotchVars(), cellBgPosition(), fontStripOrigin() (+9 more)

### Community 25 - "DemoWorld Build Economy"
Cohesion: 0.18
Nodes (7): canAfford(), footprintTiles(), inventoryGet(), inventoryTake(), resourceGet(), resourceSet(), rotatedFootprint()

### Community 26 - "Genart Grid Palette"
Cohesion: 0.21
Nodes (11): mirrorHorizontal(), rasterizeGrid(), remapColor(), assertPaletteHex(), BY_HEX, PALETTE, Rgba, toRgba() (+3 more)

### Community 27 - "Crop Prop Sprites"
Cohesion: 0.11
Nodes (20): SpriteGrid, BuildingSprite, CROP_SPRITES, CropSprite, grid(), Pal, WHEAT_STAGE_3_SWAY, WHEAT_STAGES (+12 more)

### Community 28 - "Tools TypeScript Config"
Cohesion: 0.10
Nodes (20): tools, compilerOptions, allowImportingTsExtensions, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 29 - "App Clock Resource Bars"
Cohesion: 0.16
Nodes (16): App(), root, ClockView, RecipeDef, ResourceTotals, SEASON_NAMES, TraitDef, UnlockCondition (+8 more)

### Community 30 - "Component Relationship Diagram"
Cohesion: 0.13
Nodes (20): Villagers & Needs (agents.rs, needs.rs), Sprite Atlas Manager (atlas.ts), BrowserTransport (DemoWorld TS Sim), Canvas Component (Canvas.tsx), Content Catalog (catalog.rs), Chronicle Event Log (chronicle.rs), Component Relationships Diagram, Render Module (drawTerrain, drawEntities, drawGhost) (+12 more)

### Community 31 - "Genart Atlas Builder"
Cohesion: 0.14
Nodes (16): entry(), AtlasCellDef, AtlasManifest, buildAtlas(), BuiltAtlas, BuiltSheet, entitySources(), fromSprite() (+8 more)

### Community 32 - "Demo Terrain Generation"
Cohesion: 0.16
Nodes (13): classify(), DEFAULT_HEIGHT, DEFAULT_SEED, DEFAULT_TILE_SIZE, DEFAULT_WIDTH, fbm(), generateDemoTerrain(), hash2() (+5 more)

### Community 33 - "Authoritative Architecture Docs"
Cohesion: 0.12
Nodes (19): Authoritative Rust Simulation, Browser-Demo Transport, DEMO_CATALOG Mirror Constraint, React + Canvas Renderer, 20 Hz Tick Snapshots, VillageSim, Project Documenter Agent, Project Summary HTML (+11 more)

### Community 34 - "Spatial Culling Helpers"
Cohesion: 0.18
Nodes (9): footprintIntersects(), packCell(), SPATIAL_CELL_TILES, terrainBlitRect(), tileInBounds(), TileSpatialIndex, VIEW_CULL_MARGIN_TILES, visibleTileBounds() (+1 more)

### Community 35 - "Tilemap Terrain Props"
Cohesion: 0.19
Nodes (16): BASE_BY_TERRAIN, BaseTerrainName, baseTerrainOf(), CORNERS, decorFor(), hash01(), isWater(), planTile() (+8 more)

### Community 36 - "Architecture Overview Diagram"
Cohesion: 0.12
Nodes (18): One Authoritative World, One Thin Renderer, Camera (pan · cursor zoom), Canvas stack (terrain · entities · overlay), Clock & seasons (day · season · year), commands (mpsc channel), Data-driven content (buildings.json · crops.json · traits.json), Architecture — one authoritative world, one thin renderer, Economy (resources · buildings) (+10 more)

### Community 38 - "Browser Transport Layer"
Cohesion: 0.20
Nodes (4): BrowserTransport, validateSlot(), TickListener, Unlisten

### Community 39 - "Building Sprite Frames"
Cohesion: 0.14
Nodes (16): BAKERY_FRAMES, bakeryFrame(), BUILDING_SPRITES, FARM, FARM_FIELD, GRANARY, grid(), HUT (+8 more)

### Community 40 - "High-Level Architecture Diagram"
Cohesion: 0.17
Nodes (16): Pixel Art Atlas (public/art/tiles.png & atlas.json), 3-Layer Canvas Stack (Offscreen Terrain, Dynamic Entities, Build Ghost), Data-Driven Catalog (buildings.json & crops.json), Chronicle & Persistence (200-entry log & bincode v2), Clock & Seasons (Pause / 1x / 2x / 3x Speed), Commands Channel (mpsc), High-Level Architecture Diagram, Interpolation Engine (2-Snapshot buffer, alpha factor) (+8 more)

### Community 41 - "Transport IPC Methods"
Cohesion: 0.12
Nodes (4): Transport, PlacementResult, PlacementValidity, WorldInit

### Community 42 - "Tauri App Configuration"
Cohesion: 0.12
Nodes (15): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+7 more)

### Community 43 - "Snapshot View Models"
Cohesion: 0.20
Nodes (14): ClockView, CropView, BuildingView, BuildingView, Option, ResourceTotals, String, Vec (+6 more)

### Community 44 - "Hero Banner Illustration"
Cohesion: 0.15
Nodes (15): Farm Plot with Growing Crops, VillageSim Hero Banner, House Building, Island Map Scene, Dashed Villager Path, VillageSim, an autonomous village, simulated in Rust and drawn on Canvas, Forest Terrain (+7 more)

### Community 45 - "Utility AI Scoring Diagram"
Cohesion: 0.17
Nodes (15): Eat (1 − hunger)² · gated on food available → 0.49, Sleep (1 − energy)² · ×1.5 at night → 0.19, Socialize (1 − social)^1.5 · partner ≤ 8 tiles → 0.10, Wander constant 0.05 floor → 0.05, Work 0.4 · priority/10 · 1/(1+dist·0.05) → 0.34, How a villager decides — utility scoring, Energy (0.56), Happiness (derived) (+7 more)

### Community 46 - "Atlas Sprite Loader"
Cohesion: 0.21
Nodes (12): ART_SCALE, AtlasCell, AtlasManifest, cellRect(), frameCount(), loadAtlas(), loadImage(), animated (+4 more)

### Community 47 - "Camera Pan Zoom"
Cohesion: 0.18
Nodes (3): Camera, MAX_ZOOM, MIN_ZOOM

### Community 48 - "Pixel Font Rendering"
Cohesion: 0.27
Nodes (12): FONT_GLYPHS, FONT_SCALE, GLYPH_HEIGHT, GLYPH_WIDTH, glyphBackgroundPosition(), glyphBackgroundX(), glyphIndex(), GLYPHS_PER_ROW (+4 more)

### Community 49 - "Genart PNG Pipeline"
Cohesion: 0.26
Nodes (10): ART_DIR, chunk(), concat(), crc32(), CRC_TABLE, decodePng(), encodePng(), SIGNATURE (+2 more)

### Community 50 - "Chronicle Persistence Weather"
Cohesion: 0.20
Nodes (12): Autosave Slot Rotation, Village Chronicle, ChronicleBody Dual Serde Forms, Save/Load Persistence, Deterministic Weather, ChronicleDrawer, State of the Game Review, chronicleSeq Refetch Pattern (+4 more)

### Community 51 - "World Data Model Diagram"
Cohesion: 0.21
Nodes (12): BUILDING, CHRONICLE, CLOCK, Contains Aggregate Relationship, CROP, World Data Model ER Diagram, Logs Chronicle Relationship, Manages Clock Relationship (+4 more)

### Community 52 - "Resource Node Gathering"
Cohesion: 0.27
Nodes (7): generate_nodes(), harvest_and_regen(), ResourceNode, Option, Self, String, Vec

### Community 53 - "Villager Sprite Frames"
Cohesion: 0.20
Nodes (11): BODY, bubble(), BUBBLES, DYE_PLACEHOLDER, Facing, grid(), Pal, VILLAGER_DYES (+3 more)

### Community 54 - "Tick Interpolation Pipeline"
Cohesion: 0.27
Nodes (11): alpha = (now − t) / 50 ms, Simulate at 20 Hz, render at 60 fps, Alpha Interpolation Between Sim Ticks, Interpolated Villager Positions, paused → alpha frozen at 1.0, RENDER · ~16 ms frame timeline, SIM · 50 ms tick timeline, tick n snapshot (+3 more)

### Community 55 - "Resource Afford Refund"
Cohesion: 0.33
Nodes (5): can_afford_and_refund_round_trip(), ResourceTotals, BTreeMap, Self, String

### Community 56 - "Pixel Art Pipeline Docs"
Cohesion: 0.22
Nodes (10): Genart Art Pipeline, ART_SCALE 2x, 29-Color Art Palette, Decoded-Pixel Drift Test, Pixel Art Phase 1 Terrain Plan, Pixel Art Phase 2 Entities Plan, Y-Sorted Scene Pass, PixelText Bitmap Font (+2 more)

### Community 57 - "Processing Pipeline Diagram"
Cohesion: 0.20
Nodes (10): Processing Pipeline Diagram, Linear Tick-to-Render Pipeline, 1. Input Stage (User IPC Action / 50ms Sim Timer), 2. Clock & Crop Stage (Advance clock ticks, crop growth, season check), 3. Utility AI & Needs Stage (Decay hunger/energy/social, score actions & apply hysteresis), 4. Movement & Economy Stage (A* path step, job assignment, haul/produce/gather execution), 5. Population & Chronicle Stage (Housing capacity births/starvation deaths, log events), 6. Viewport Culling & Broadcast Stage (Cull entities outside camera margin, emit TickSnapshot to watch channel) (+2 more)

### Community 58 - "DemoWorld Snapshot Views"
Cohesion: 0.22
Nodes (5): stateByte(), stateLabel(), nearestVillagerId(), villagerById(), BuildingView

### Community 59 - "Pathfinding Algorithm"
Cohesion: 0.36
Nodes (7): DELTAS, findPath(), heuristic(), IMPASSABLE, pack(), terrainPassable(), unpack()

### Community 60 - "Snapshot Interpolation Buffer"
Cohesion: 0.36
Nodes (4): SnapshotBuffer, resources, TickSnapshot, VillagerView

### Community 61 - "Canvas Layers Diagram"
Cohesion: 0.36
Nodes (8): Build Ghost Overlay, Three stacked canvases, redrawn at different rates, Entities (buildings · crops · villagers — redrawn every frame), Isometric Three-Layer Stack Illustration, Redraw Rate Separation, Offscreen Terrain Buffer, Overlay (build ghost · selection · hover — every frame in build mode), Terrain (tiles — drawn on load, patched only on dirty tiles)

### Community 62 - "Needs Jobs Pathfinding Docs"
Cohesion: 0.25
Nodes (8): M4 Pathfinding Plan, M5 Needs and Jobs Plan, M7 Utility AI Plan, Milestone 4 Villager FSM, Villager Needs, A* Pathfinding, Action Hysteresis Margin, Utility AI

### Community 63 - "Tauri Capabilities Config"
Cohesion: 0.25
Nodes (7): core:default, main, description, identifier, permissions, $schema, windows

### Community 64 - "Building Placement Unlocks"
Cohesion: 0.33
Nodes (6): World::satisfied_unlocks, BuildMenu, Well Building, Ghost Preview Placement, M3 Building Placement Plan, Tech / Unlock Tree

### Community 65 - "Props Progression Docs"
Cohesion: 0.33
Nodes (6): Terrain Props (defining + decor), Props and Assets Backlog, Authoritative Sim Architecture, Housing Capacity, M9 Population and Progression, Milestone Roadmap M1–M10

### Community 66 - "Application Brand Icon"
Cohesion: 0.47
Nodes (6): VillageSim Application Icon, Green Checkered Field Background, Dark Green Square Border, Minimalist Flat Icon Design, Grid World Metaphor, Central Yellow Circle

### Community 68 - "Economy Production Chain"
Cohesion: 0.50
Nodes (4): TendCrops Job, Grain→Flour→Food Chain, Economy and Production Chains, Job Board

### Community 69 - "Milestone 3 Design Spec"
Cohesion: 0.50
Nodes (4): Milestone 3 Design, BuildMenu, Building Catalog, satisfied_unlocks

### Community 70 - "Entity Art Spritesheet"
Cohesion: 0.67
Nodes (4): Building sprites (houses, windmill, well), Entity spritesheet (entities.png), Environment props (trees, bush, rock, grass, fence), Villager walk/idle/sleep sprites (colored shirts)

### Community 71 - "Terrain Art Spritesheet"
Cohesion: 0.67
Nodes (4): Green grass autotile edge and fill tiles, Tan sand/dirt autotile edge and fill tiles, Terrain tiles spritesheet (tiles.png), Teal water/coast autotile edge and fill tiles

### Community 72 - "HUD UI Art Spritesheet"
Cohesion: 0.67
Nodes (4): HUD icons (resources, bag, scroll, sun, tools), HUD/UI spritesheet (ui.png), Pixel font glyphs A–Z, 0–9, punctuation, Clock speed control icons (pause/play/fast-forward)

### Community 73 - "Terrain Camera Docs"
Cohesion: 0.67
Nodes (3): M2 Terrain + Camera Plan, Seeded Terrain Generation, 128x128 World Grid Model

### Community 74 - "Command Channel Ownership"
Cohesion: 0.67
Nodes (3): mpsc SimCommand Channel, No Arc Mutex World, Exclusive World Ownership via Command Channel

### Community 75 - "Tauri Icon 128 Retina"
Cohesion: 1.00
Nodes (3): VillageSim tauri packaging asset (128x128@2x.png), VillageSim app icon — 128×128@2x retina desktop app icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 76 - "Tauri Icon 128"
Cohesion: 1.00
Nodes (3): VillageSim tauri packaging asset (128x128.png), VillageSim app icon — 128×128 desktop app icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 77 - "Tauri Icon 32"
Cohesion: 1.00
Nodes (3): VillageSim tauri packaging asset (32x32.png), VillageSim app icon — 32×32 desktop app icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 78 - "Tauri Icon 64"
Cohesion: 1.00
Nodes (3): VillageSim tauri packaging asset (64x64.png), VillageSim app icon — 64×64 desktop app icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 79 - "Android Hdpi Launcher"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher.png), VillageSim app icon — Android hdpi launcher icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 80 - "Android Hdpi Foreground"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher_foreground.png), VillageSim app icon — Android hdpi adaptive launcher foreground, Yellow circle on green checkerboard VillageSim brand mark

### Community 81 - "Android Hdpi Round"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher_round.png), VillageSim app icon — Android hdpi round launcher icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 82 - "Android Mdpi Launcher"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher.png), VillageSim app icon — Android mdpi launcher icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 83 - "Android Mdpi Foreground"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher_foreground.png), VillageSim app icon — Android mdpi adaptive launcher foreground, Yellow circle on green checkerboard VillageSim brand mark

### Community 84 - "Android Mdpi Round"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher_round.png), VillageSim app icon — Android mdpi round launcher icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 85 - "Android Xhdpi Launcher"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher.png), VillageSim app icon — Android xhdpi launcher icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 86 - "Android Xhdpi Foreground"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher_foreground.png), VillageSim app icon — Android xhdpi adaptive launcher foreground, Yellow circle on green checkerboard VillageSim brand mark

### Community 87 - "Android Xhdpi Round"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher_round.png), VillageSim app icon — Android xhdpi round launcher icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 88 - "Android Xxhdpi Launcher"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher.png), VillageSim app icon — Android xxhdpi launcher icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 89 - "Android Xxhdpi Foreground"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher_foreground.png), VillageSim app icon — Android xxhdpi adaptive launcher foreground, Yellow circle on green checkerboard VillageSim brand mark

### Community 90 - "Android Xxhdpi Round"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher_round.png), VillageSim app icon — Android xxhdpi round launcher icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 91 - "Android Xxxhdpi Launcher"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher.png), VillageSim app icon — Android xxxhdpi launcher icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 92 - "Android Xxxhdpi Foreground"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher_foreground.png), VillageSim app icon — Android xxxhdpi adaptive launcher foreground, Yellow circle on green checkerboard VillageSim brand mark

### Community 93 - "Android Xxxhdpi Round"
Cohesion: 1.00
Nodes (3): VillageSim android packaging asset (ic_launcher_round.png), VillageSim app icon — Android xxxhdpi round launcher icon, Yellow circle on green checkerboard VillageSim brand mark

### Community 94 - "Primary App Icon"
Cohesion: 1.00
Nodes (3): VillageSim tauri packaging asset (icon.png), VillageSim app icon — Primary VillageSim app icon (512×512), Yellow circle on green checkerboard VillageSim brand mark

### Community 95 - "iOS Icon 20 1x"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-20x20@1x.png), VillageSim app icon — iOS AppIcon 20×20@1x, Yellow circle on green checkerboard VillageSim brand mark

### Community 96 - "iOS Icon 20 2x Variant"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-20x20@2x-1.png), VillageSim app icon — iOS AppIcon 20×20@2x (variant), Yellow circle on green checkerboard VillageSim brand mark

### Community 97 - "iOS Icon 20 2x"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-20x20@2x.png), VillageSim app icon — iOS AppIcon 20×20@2x, Yellow circle on green checkerboard VillageSim brand mark

### Community 98 - "iOS Icon 20 3x"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-20x20@3x.png), VillageSim app icon — iOS AppIcon 20×20@3x, Yellow circle on green checkerboard VillageSim brand mark

### Community 99 - "iOS Icon 29 1x"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-29x29@1x.png), VillageSim app icon — iOS AppIcon 29×29@1x, Yellow circle on green checkerboard VillageSim brand mark

### Community 100 - "iOS Icon 29 2x Variant"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-29x29@2x-1.png), VillageSim app icon — iOS AppIcon 29×29@2x (variant), Yellow circle on green checkerboard VillageSim brand mark

### Community 101 - "iOS Icon 29 2x"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-29x29@2x.png), VillageSim app icon — iOS AppIcon 29×29@2x, Yellow circle on green checkerboard VillageSim brand mark

### Community 102 - "iOS Icon 29 3x"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-29x29@3x.png), VillageSim app icon — iOS AppIcon 29×29@3x, Yellow circle on green checkerboard VillageSim brand mark

### Community 103 - "iOS Icon 40 1x"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-40x40@1x.png), VillageSim app icon — iOS AppIcon 40×40@1x, Yellow circle on green checkerboard VillageSim brand mark

### Community 104 - "iOS Icon 40 2x Variant"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-40x40@2x-1.png), VillageSim app icon — iOS AppIcon 40×40@2x (variant), Yellow circle on green checkerboard VillageSim brand mark

### Community 105 - "iOS Icon 40 2x"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-40x40@2x.png), VillageSim app icon — iOS AppIcon 40×40@2x, Yellow circle on green checkerboard VillageSim brand mark

### Community 106 - "iOS Icon 40 3x"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-40x40@3x.png), VillageSim app icon — iOS AppIcon 40×40@3x, Yellow circle on green checkerboard VillageSim brand mark

### Community 107 - "iOS Icon 512"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-512@2x.png), VillageSim app icon — iOS AppIcon 512@2x, Yellow circle on green checkerboard VillageSim brand mark

### Community 108 - "iOS Icon 60 2x"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-60x60@2x.png), VillageSim app icon — iOS AppIcon 60×60@2x, Yellow circle on green checkerboard VillageSim brand mark

### Community 109 - "iOS Icon 60 3x"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-60x60@3x.png), VillageSim app icon — iOS AppIcon 60×60@3x, Yellow circle on green checkerboard VillageSim brand mark

### Community 110 - "iOS Icon 76 1x"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-76x76@1x.png), VillageSim app icon — iOS AppIcon 76×76@1x, Yellow circle on green checkerboard VillageSim brand mark

### Community 111 - "iOS Icon 76 2x"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-76x76@2x.png), VillageSim app icon — iOS AppIcon 76×76@2x, Yellow circle on green checkerboard VillageSim brand mark

### Community 112 - "iOS Icon 83.5 2x"
Cohesion: 1.00
Nodes (3): VillageSim ios packaging asset (AppIcon-83.5x83.5@2x.png), VillageSim app icon — iOS AppIcon 83.5×83.5@2x, Yellow circle on green checkerboard VillageSim brand mark

### Community 113 - "Windows Square107 Icon"
Cohesion: 1.00
Nodes (3): VillageSim app icon — Square107x107Logo Windows packaging icon, VillageSim windows packaging asset (Square107x107Logo.png), Yellow circle on green checkerboard VillageSim brand mark

### Community 114 - "Windows Square142 Icon"
Cohesion: 1.00
Nodes (3): VillageSim app icon — Square142x142Logo Windows packaging icon, VillageSim windows packaging asset (Square142x142Logo.png), Yellow circle on green checkerboard VillageSim brand mark

### Community 115 - "Windows Square150 Icon"
Cohesion: 1.00
Nodes (3): VillageSim app icon — Square150x150Logo Windows packaging icon, VillageSim windows packaging asset (Square150x150Logo.png), Yellow circle on green checkerboard VillageSim brand mark

### Community 116 - "Windows Square284 Icon"
Cohesion: 1.00
Nodes (3): VillageSim app icon — Square284x284Logo Windows packaging icon, VillageSim windows packaging asset (Square284x284Logo.png), Yellow circle on green checkerboard VillageSim brand mark

### Community 117 - "Windows Square30 Icon"
Cohesion: 1.00
Nodes (3): VillageSim app icon — Square30x30Logo Windows packaging icon, VillageSim windows packaging asset (Square30x30Logo.png), Yellow circle on green checkerboard VillageSim brand mark

### Community 118 - "Windows Square310 Icon"
Cohesion: 1.00
Nodes (3): VillageSim app icon — Square310x310Logo Windows packaging icon, VillageSim windows packaging asset (Square310x310Logo.png), Yellow circle on green checkerboard VillageSim brand mark

### Community 119 - "Windows Square44 Icon"
Cohesion: 1.00
Nodes (3): VillageSim app icon — Square44x44Logo Windows packaging icon, VillageSim windows packaging asset (Square44x44Logo.png), Yellow circle on green checkerboard VillageSim brand mark

### Community 120 - "Windows Square71 Icon"
Cohesion: 1.00
Nodes (3): VillageSim app icon — Square71x71Logo Windows packaging icon, VillageSim windows packaging asset (Square71x71Logo.png), Yellow circle on green checkerboard VillageSim brand mark

### Community 121 - "Windows Square89 Icon"
Cohesion: 1.00
Nodes (3): VillageSim app icon — Square89x89Logo Windows packaging icon, VillageSim windows packaging asset (Square89x89Logo.png), Yellow circle on green checkerboard VillageSim brand mark

### Community 122 - "Windows Store Logo"
Cohesion: 1.00
Nodes (3): VillageSim app icon — StoreLogo Windows Store packaging icon, VillageSim windows packaging asset (StoreLogo.png), Yellow circle on green checkerboard VillageSim brand mark

## Knowledge Gaps
- **340 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+335 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `World` connect `World Haul Movement` to `Clock Weather Crops`, `Jobs and Utility AI`, `World Construction Tests`, `Persist Threading Runtime`, `Chronicle Event Log`, `World Economy Tests`, `Agent Needs States`, `World Generation Tests`, `Economy Resource Totals`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `entry()` connect `Genart Atlas Builder` to `Chronicle Frontend Format`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `entitySources()` connect `Genart Atlas Builder` to `Genart Grid Palette`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `Canvas()` (e.g. with `.recordFrame()` and `.setDrawStats()`) actually correct?**
  _`Canvas()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _340 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `World Haul Movement` be split into smaller, more focused modules?**
  _Cohesion score 0.07043167802661474 - nodes in this community are weakly interconnected._
- **Should `Clock Weather Crops` be split into smaller, more focused modules?**
  _Cohesion score 0.05352112676056338 - nodes in this community are weakly interconnected._