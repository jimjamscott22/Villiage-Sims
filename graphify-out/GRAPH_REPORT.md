# Graph Report - .  (2026-09-28)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2092 nodes · 4359 edges · 137 communities (117 shown, 20 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 171 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d97750a2`
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
- World
- Villager
- Canvas.tsx
- types.ts
- ui.ts
- .pos_to_tile
- compilerOptions
- economy.rs
- chronicle.ts
- .findHaulTask
- BuildMenu.tsx
- .constructor
- palette.ts
- vfx.ts
- compilerOptions
- PixelText.tsx
- World Struct (world.rs)
- terrain.ts
- DemoSocial
- Authoritative Rust Simulation
- spatial.ts
- tilemap.ts
- RUST · simulation thread (20 Hz · 50 ms)
- demoWorld.test.ts
- transport.ts
- buildings.ts
- Rust Authoritative Simulation (20 Hz Thread)
- Pixel Art Phases 1–3
- tauri.conf.json
- snapshot.rs
- Island Map Scene
- pick highest → Eat
- build.ts
- Camera
- VillagerDetail
- app-icon.ts
- Village Chronicle
- WORLD
- ResourceNode
- villagers.ts
- SIM · 50 ms tick timeline
- ResourceTotals
- Genart Art Pipeline
- 1. Input Stage (User IPC Action / 50ms Sim Timer)
- .villager_detail
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
- LegacyWorld
- Entity spritesheet (entities.png)
- Terrain tiles spritesheet (tiles.png)
- HUD/UI spritesheet (ui.png)
- Seeded Terrain Generation
- mpsc SimCommand Channel
- VillageSim tauri packaging asset (128x128@2x.png)
- VillageSim tauri packaging asset (128x128.png)
- VillageSim tauri packaging asset (32x32.png)
- VillageSim tauri packaging asset (64x64.png)
- Deferred findings
- rotated_footprint
- social_tests.rs
- crops.ts
- intentOverlay.ts
- pathfind.rs
- Product Contract
- Needs
- Sequential implementation tasks
- LegacyWorld
- world_review_tests.rs
- buildings.rs
- dependencies
- package.json
- super::World
- VillageSim tauri packaging asset (icon.png)
- ToastStack.tsx
- agents.rs
- Terrain
- terrain.rs
- CLAUDE.md
- scripts
- demoSurvival.test.ts
- .satisfied_unlocks
- smoke-intent-overlay.mjs
- tailwindcss
- @types/node
- vitest
- @types/react-dom
- vite
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
- .posToTile
- Option

## God Nodes (most connected - your core abstractions)
1. `World` - 129 edges
2. `DemoWorld` - 129 edges
3. `grass_world()` - 50 edges
4. `Canvas()` - 35 edges
5. `Villager` - 26 edges
6. `Clock` - 24 edges
7. `JobBoard` - 24 edges
8. `VillagerDetail` - 23 edges
9. `BrowserTransport` - 22 edges
10. `TickSnapshot` - 21 edges

## Surprising Connections (you probably didn't know these)
- `entitySources()` --indirect_call--> `entry()`  [INFERRED]
  tools/genart/build.ts → src/state/chronicle.test.ts
- `entitySources()` --indirect_call--> `key()`  [INFERRED]
  tools/genart/build.ts → src/state/demoLeisure.ts
- `CI Pipeline` --conceptually_related_to--> `Authoritative Rust Simulation`  [INFERRED]
  .github/workflows/ci.yml → AGENTS.md
- `Vite HTML Entry` --conceptually_related_to--> `React + Canvas Renderer`  [INFERRED]
  index.html → AGENTS.md
- `Tick Processing Pipeline` --implements--> `Authoritative Rust Simulation`  [EXTRACTED]
  docs/project-summary.md → AGENTS.md

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

## Communities (137 total, 20 thin omitted)

### Community 0 - "World"
Cohesion: 0.06
Nodes (13): ObjectiveCondition, ActionKind, Behavior, BTreeSet, BuildingView, Encounter, PathBuf, ResourceTotals (+5 more)

### Community 1 - "Clock"
Cohesion: 0.05
Nodes (39): Default, Duration, Clock, ClockView, day_season_year_rollover(), minute_accumulates_to_day(), Rollover, rollover_reports_season_change() (+31 more)

### Community 2 - "utility.rs"
Cohesion: 0.05
Nodes (36): farm_advertises_tend_crops_slots(), granary_advertises_haul_in_m8(), Job, JobBoard, JobKind, mill_advertises_produce_and_haul(), peek_prefers_closer_job_at_equal_priority(), peek_prefers_priority_over_distance() (+28 more)

### Community 3 - "catalog.rs"
Cohesion: 0.19
Nodes (19): CropDef, BuildingDef, builtin_catalog_loads_buildings_and_crops(), Catalog, decor_buildings_are_jobless_and_appended_last(), JobDef, ObjectiveCondition, ObjectiveDef (+11 more)

### Community 4 - "src/commands.rs"
Cohesion: 0.10
Nodes (46): advance_clock(), app_state_holds_catalog(), AppState, demolish(), get_catalog(), get_chronicle(), get_terrain(), get_villager_detail() (+38 more)

### Community 5 - "devDependencies"
Cohesion: 0.13
Nodes (15): esbuild, devDependencies, esbuild, @tailwindcss/vite, @tauri-apps/cli, tsx, @types/react, typescript (+7 more)

### Community 6 - "App.tsx"
Cohesion: 0.15
Nodes (19): App(), isTypingTarget(), sameLabels(), root, buildTagLabels(), hasUnlabelledVillager(), lowestNeed(), ROSTER_STATS (+11 more)

### Community 7 - "world.rs"
Cohesion: 0.11
Nodes (46): advance_until(), auto_plant_candidates_follow_season_and_seed_cost(), autonomous_jobs_run_farm_to_bakery_chain(), autosave_disabled_without_directory(), autosave_rotates_through_three_slots(), chronicle_records_season_turn(), clear_day_leaves_crops_dry_after_rollover(), completed_eat_clears_action_so_hysteresis_cannot_reenter() (+38 more)

### Community 8 - "DemoWorld"
Cohesion: 0.11
Nodes (4): openWorld(), DemoWorld, fullNeeds(), recomputeHappiness()

### Community 9 - "persist.rs"
Cohesion: 0.10
Nodes (39): Arc, AtomicBool, Drop, JoinHandle, Mutex, Path, forward_snapshots(), AppHandle (+31 more)

### Community 10 - "scene.ts"
Cohesion: 0.07
Nodes (46): Atlas, AtlasCell, AtlasManifest, cellRect(), frameCount(), loadAtlas(), loadImage(), animated (+38 more)

### Community 11 - "demoWorld.ts"
Cohesion: 0.05
Nodes (42): villager(), ACTION_ORDER, ActionKind, actionRank(), AgentStateName, CarryStack, DEMO_CROPS, DEMO_SAVE_VERSION (+34 more)

### Community 12 - "chronicle.rs"
Cohesion: 0.15
Nodes (26): born(), captures_the_clock_date(), Chronicle, ChronicleBody, ChronicleBodyView, ChronicleEntry, ChronicleEntryView, coalesces_same_site_same_day() (+18 more)

### Community 13 - "World"
Cohesion: 0.09
Nodes (14): BuildingKey, HutFootprint, Destination, leisure_hash(), LeisureCache, Vec, World, Behavior (+6 more)

### Community 14 - "Villager"
Cohesion: 0.17
Nodes (7): Into, ActionKind, Option, Self, String, Vec, Villager

### Community 15 - "Canvas.tsx"
Cohesion: 0.12
Nodes (23): drawCell(), Canvas(), cropPlantValid(), HoverDisplay, rotatedFootprint(), BUILDING_COLORS, CROP_STAGE_COLORS, drawBuildings() (+15 more)

### Community 16 - "types.ts"
Cohesion: 0.14
Nodes (16): ClockView, CropView, ObjectiveCondition, RecipeDef, ResourceTotals, SEASON_NAMES, TraitDef, UnlockCondition (+8 more)

### Community 17 - "ui.ts"
Cohesion: 0.07
Nodes (32): AUTUMN_LEAF, BAR_NOTCH, BAR_NOTCH_EMPTY, BRACKET_BL, BRACKET_BR, BRACKET_TL, BRACKET_TR, bracketCorner() (+24 more)

### Community 19 - ".pos_to_tile"
Cohesion: 0.12
Nodes (14): MovePurpose, chronicle_death_entry_carries_the_name(), chronicle_records_building_completion(), generated_world_has_expected_dimensions(), mill_is_locked_in_a_fresh_world(), Self, TerrainSnapshot, spawns_five_villagers_on_walkable_tiles() (+6 more)

### Community 20 - "compilerOptions"
Cohesion: 0.07
Nodes (26): DOM, DOM.Iterable, src, vite/client, vite.config.ts, compilerOptions, allowImportingTsExtensions, jsx (+18 more)

### Community 21 - "economy.rs"
Cohesion: 0.12
Nodes (28): HaulEndpoint, HaulTask, Building, BTreeMap, CarryStack, derive_totals(), derive_totals_ignores_production_buffers(), HaulEndpoint (+20 more)

### Community 22 - "chronicle.ts"
Cohesion: 0.20
Nodes (13): buildingName(), CHRONICLE_EMPTY_MESSAGE, formatDivider(), formatEntry(), needsDivider(), seasonName(), SEASONS, BIRTH (+5 more)

### Community 23 - ".findHaulTask"
Cohesion: 0.14
Nodes (12): canAfford(), inventoryAdd(), inventoryGet(), inventoryTake(), inventoryTotal(), productionFreeCapacity(), recipeAllowsResource(), resourceGet() (+4 more)

### Community 24 - "BuildMenu.tsx"
Cohesion: 0.13
Nodes (24): getAtlasManifest(), getSheetSize(), loadImage(), loadUiAtlasManifest(), manifest, preloadSheetSizes(), sheetSizes, AtlasThumb() (+16 more)

### Community 25 - ".constructor"
Cohesion: 0.21
Nodes (3): key(), footprintTiles(), rotatedFootprint()

### Community 26 - "palette.ts"
Cohesion: 0.23
Nodes (6): Source, BY_HEX, Rgba, Raster, BLUE, RED

### Community 27 - "vfx.ts"
Cohesion: 0.19
Nodes (12): SpriteGrid, BuildingSprite, CropSprite, PropSprite, DUST_FRAMES, dustFrame(), grid(), Pal (+4 more)

### Community 28 - "compilerOptions"
Cohesion: 0.10
Nodes (20): tools, compilerOptions, allowImportingTsExtensions, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 29 - "PixelText.tsx"
Cohesion: 0.24
Nodes (13): FONT_GLYPHS, FONT_SCALE, GLYPH_HEIGHT, GLYPH_WIDTH, glyphBackgroundPosition(), glyphBackgroundX(), glyphIndex(), GLYPHS_PER_ROW (+5 more)

### Community 30 - "World Struct (world.rs)"
Cohesion: 0.13
Nodes (20): Villagers & Needs (agents.rs, needs.rs), Sprite Atlas Manager (atlas.ts), BrowserTransport (DemoWorld TS Sim), Canvas Component (Canvas.tsx), Content Catalog (catalog.rs), Chronicle Event Log (chronicle.rs), Component Relationships Diagram, Render Module (drawTerrain, drawEntities, drawGhost) (+12 more)

### Community 31 - "terrain.ts"
Cohesion: 0.12
Nodes (24): SHEET_WIDTH, terrainSources(), hash01(), PaletteName, toRgba(), BASE_TERRAINS, BaseTerrain, borderDistance() (+16 more)

### Community 32 - "DemoSocial"
Cohesion: 0.11
Nodes (15): Behavior, BehaviorHost, compareTile(), DemoLeisure, Destination, distance(), idle(), LeisureBuilding (+7 more)

### Community 33 - "Authoritative Rust Simulation"
Cohesion: 0.15
Nodes (16): Authoritative Rust Simulation, Browser-Demo Transport, DEMO_CATALOG Mirror Constraint, React + Canvas Renderer, 20 Hz Tick Snapshots, VillageSim, Project Documenter Agent, Project Summary HTML (+8 more)

### Community 34 - "spatial.ts"
Cohesion: 0.16
Nodes (10): footprintIntersects(), packCell(), SPATIAL_CELL_TILES, terrainBlitRect(), TileBounds, tileInBounds(), TileSpatialIndex, VIEW_CULL_MARGIN_TILES (+2 more)

### Community 35 - "tilemap.ts"
Cohesion: 0.15
Nodes (20): ART_SCALE, BASE_BY_TERRAIN, BaseTerrainName, baseTerrainOf(), CORNERS, decorFor(), DecorPick, hash01() (+12 more)

### Community 36 - "RUST · simulation thread (20 Hz · 50 ms)"
Cohesion: 0.12
Nodes (18): One Authoritative World, One Thin Renderer, Camera (pan · cursor zoom), Canvas stack (terrain · entities · overlay), Clock & seasons (day · season · year), commands (mpsc channel), Data-driven content (buildings.json · crops.json · traits.json), Architecture — one authoritative world, one thin renderer, Economy (resources · buildings) (+10 more)

### Community 37 - "demoWorld.test.ts"
Cohesion: 0.09
Nodes (7): complete(), internals(), reachChat(), DEMO_CATALOG, completeBuilding(), nearestVillagerId(), villagerById()

### Community 38 - "transport.ts"
Cohesion: 0.07
Nodes (21): classify(), DEFAULT_HEIGHT, DEFAULT_SEED, DEFAULT_TILE_SIZE, DEFAULT_WIDTH, fbm(), generateDemoTerrain(), hash2() (+13 more)

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

### Community 46 - "build.ts"
Cohesion: 0.17
Nodes (16): AtlasCellDef, AtlasManifest, buildAtlas(), BuiltAtlas, BuiltSheet, entitySources(), fromSprite(), packSheet() (+8 more)

### Community 47 - "Camera"
Cohesion: 0.13
Nodes (9): Camera, MAX_ZOOM, MIN_ZOOM, drawNameTags(), MIN_TAG_ZOOM, NameTagPlacement, nameTagPlacements(), staggerTag() (+1 more)

### Community 48 - "VillagerDetail"
Cohesion: 0.14
Nodes (9): CanvasProps, Catalog, ObjectiveDef, VillagerDetail, BuildMenuProps, conditionText(), ObjectivesPanel(), ObjectivesPanelProps (+1 more)

### Community 49 - "app-icon.ts"
Cohesion: 0.12
Nodes (26): APP_ICON_NATIVE, APP_ICON_SCALE, APP_ICON_SIZE, DESKTOP_PNGS, downsample(), rasterForIconSize(), renderAppIcon(), renderAppIconNative() (+18 more)

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

### Community 58 - ".villager_detail"
Cohesion: 0.31
Nodes (5): roster_lists_every_living_villager_by_id(), BTreeMap, Result, String, VillagerDetail

### Community 59 - "pathfind.ts"
Cohesion: 0.36
Nodes (7): DELTAS, findPath(), heuristic(), IMPASSABLE, pack(), terrainPassable(), unpack()

### Community 60 - "TickSnapshot"
Cohesion: 0.18
Nodes (10): BUILDING_STATUS_LABELS, hoverTargetAt(), HoverTargetInput, rotatedFootprint(), catalog, VILLAGER_STATE_LABELS, villagerHoverDetail(), SnapshotBuffer (+2 more)

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

### Community 69 - "LegacyWorld"
Cohesion: 0.14
Nodes (17): LegacyNeeds, LegacyVillager, LegacyWorld, ActionKind, Behavior, BTreeMap, BTreeSet, CarryStack (+9 more)

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

### Community 79 - "Deferred findings"
Cohesion: 0.11
Nodes (18): Assessment, C1. Villagers could starve during travel while food was available — P1, S, C2. One unreachable pickup could block food logistics elsewhere — P1, M, Critical fixes included, Current execution model, Deferred findings, Determinism, weather, and testing observations, R1. Haulers discard pickup intent and take unnecessary return trips — P2, M (+10 more)

### Community 80 - "rotated_footprint"
Cohesion: 0.21
Nodes (11): footprint_tiles(), rotated_footprint(), Vec, PlacementResult, PlacementValidity, Result, String, super::World (+3 more)

### Community 81 - "social_tests.rs"
Cohesion: 0.24
Nodes (16): complete(), leisure_arrival_pauses_and_then_avoids_previous_destination(), leisure_density_counts_only_completed_reachable_huts_and_caps(), leisure_destination_is_reserved_committed_and_demolition_invalidates(), leisure_yields_to_work_and_social_does_not_interrupt_workers(), open_world(), reach_chat(), World (+8 more)

### Community 82 - "crops.ts"
Cohesion: 0.18
Nodes (17): CARROT_STAGE_3_SWAY, CARROT_STAGES, carrotStage(), CROP_SPRITES, grid(), Pal, PEAS_STAGE_2_SWAY, PEAS_STAGES (+9 more)

### Community 83 - "intentOverlay.ts"
Cohesion: 0.20
Nodes (12): ACTIVITY_LABELS, drawIntentOverlay(), IntentCamera, intentLabel(), IntentPlan, PlanIntentInput, planIntentOverlay(), PURPOSE_LABELS (+4 more)

### Community 84 - "pathfind.rs"
Cohesion: 0.22
Nodes (14): diagonal_cannot_cut_corner_through_impassable(), find_path(), grid_passable(), heuristic(), in_bounds(), no_path_when_goal_enclosed(), path_goes_around_a_wall(), Fn (+6 more)

### Community 85 - "Product Contract"
Cohesion: 0.12
Nodes (15): Acceptance Examples, Actors, Assigned Homes Sleep Journey - Plan, Dependencies / Assumptions, Goal Capsule, Key Decisions, Key Flows, Outstanding Questions (+7 more)

### Community 86 - "Needs"
Cohesion: 0.25
Nodes (6): decay_clamps_at_zero(), decay_reduces_hunger_over_ticks(), health_falls_per_empty_need_and_regenerates_when_fed(), Needs, Self, starving_from_full_health_is_fatal_after_about_300_ticks()

### Community 87 - "Sequential implementation tasks"
Cohesion: 0.14
Nodes (13): 1. Establish saved-state compatibility and behavior data, 2. Implement paired conversation lifecycle, 3. Add neighborhood destinations and committed leisure movement, 4. Mirror behavior in the browser demo and expose activity, 5. Verify behavior and finish the handoff, Behavior specification, Constraints, Efficient execution (+5 more)

### Community 88 - "LegacyWorld"
Cohesion: 0.17
Nodes (10): LegacyWorld, BTreeSet, Catalog, Option, PathBuf, ResourceNode, ResourceTotals, String (+2 more)

### Community 89 - "world_review_tests.rs"
Cohesion: 0.47
Nodes (11): add_inventory(), complete(), enclose(), inaccessible_farm_does_not_block_accessible_bakery_supply(), last_moment_meal_finishes_before_starvation_and_preserves_cargo(), open_world(), production_haul_uses_reachable_storage_instead_of_nearest_enclosed_storage(), recipe_supply_skips_an_unreachable_destination() (+3 more)

### Community 90 - "buildings.rs"
Cohesion: 0.18
Nodes (5): BuildingStatus, BuildState, PlacementResult, PlacementValidity, String

### Community 91 - "dependencies"
Cohesion: 0.22
Nodes (9): @fontsource/pixelify-sans, dependencies, @fontsource/pixelify-sans, react, react-dom, @tauri-apps/api, react, react-dom (+1 more)

### Community 92 - "package.json"
Cohesion: 0.22
Nodes (8): allowScripts, esbuild@0.28.1, engines, node, name, private, type, version

### Community 93 - "super::World"
Cohesion: 0.44
Nodes (3): Option, Vec, super::World

### Community 94 - "VillageSim tauri packaging asset (icon.png)"
Cohesion: 1.00
Nodes (3): VillageSim tauri packaging asset (icon.png), VillageSim app icon — Primary VillageSim app icon (512×512), Yellow circle on green checkerboard VillageSim brand mark

### Community 95 - "ToastStack.tsx"
Cohesion: 0.29
Nodes (6): ChronicleBody, KIND_STYLES, Toast, ToastItemProps, ToastStack(), ToastStackProps

### Community 96 - "agents.rs"
Cohesion: 0.29
Nodes (3): AgentState, MovePurpose, CarryStack

### Community 97 - "Terrain"
Cohesion: 0.29
Nodes (7): BuildingDef, terrain_allowed(), terrain_from_name(), terrain_passable(), Option, Self, Terrain

### Community 98 - "terrain.rs"
Cohesion: 0.39
Nodes (6): classify(), different_seeds_diverge(), generate_terrain(), island_contains_water_land_and_highlands(), Vec, same_seed_is_reproducible()

### Community 99 - "CLAUDE.md"
Cohesion: 0.29
Nodes (5): Architecture, Art pipeline, Commands, Non-obvious gotchas, What this is

### Community 100 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, art, build, dev, tauri, test, test:watch

### Community 102 - ".satisfied_unlocks"
Cohesion: 0.40
Nodes (3): BTreeSet, String, super::World

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
Cohesion: 0.10
Nodes (20): BOULDER, BUSH, CACTUS, campfire(), CAMPFIRE_FRAMES, CYPRESS, DEADFALL, DRIFTWOOD (+12 more)

### Community 149 - "Option"
Cohesion: 0.13
Nodes (6): gather_job_adds_wood_to_stockpile(), gather_jobs_include_reachable_wood_and_stone_nodes(), order_move_falls_back_when_requested_villager_is_gone(), order_move_prefers_requested_villager(), Option, ResourceNode

## Knowledge Gaps
- **402 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+397 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `entitySources()` connect `build.ts` to `.constructor`, `chronicle.ts`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `World` connect `World` to `Clock`, `utility.rs`, `world.rs`, `chronicle.rs`, `World`, `Villager`, `.pos_to_tile`, `economy.rs`, `Option`, `.villager_detail`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `DemoWorld` connect `DemoWorld` to `DemoSocial`, `demoSurvival.test.ts`, `demoWorld.test.ts`, `transport.ts`, `App.tsx`, `demoWorld.ts`, `.posToTile`, `VillagerDetail`, `.isPassable`, `chronicle.ts`, `.findHaulTask`, `.constructor`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `Canvas()` (e.g. with `.recordFrame()` and `.setDrawStats()`) actually correct?**
  _`Canvas()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _402 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `World` be split into smaller, more focused modules?**
  _Cohesion score 0.061343204653622425 - nodes in this community are weakly interconnected._
- **Should `Clock` be split into smaller, more focused modules?**
  _Cohesion score 0.05352112676056338 - nodes in this community are weakly interconnected._