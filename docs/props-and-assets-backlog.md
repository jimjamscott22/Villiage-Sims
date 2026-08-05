# Props & assets backlog

An inventory of what the game currently draws, and a ranked catalogue of candidate additions —
characters, terrain, buildings, decor and effects — with the files each one would touch and a
rough cost. Nothing here is committed roadmap; it's a menu to pull from.

Roadmap source of truth remains [`docs/villagesim-spec.md`](villagesim-spec.md); milestone status
is in [`progress.md`](../progress.md).

## What exists today

| Category | Assets |
|---|---|
| Terrain bases | deep water, shallow water, sand, grass, rock — 4 variants each, plus fringes and animated foam |
| Standing terrain props | `prop.cypress` (forest tiles), `prop.peak` (mountain tiles) |
| Decor scatter | `prop.bush`, `prop.boulder`, `prop.palm`, `prop.reeds` — added in this PR |
| Buildings | hut, farm (+ field), granary, mill (animated), bakery (animated), well, 3 scaffold sizes |
| Crops | wheat, 4 growth stages, sway animation on the ripe stage |
| Characters | one villager body in 3 facings × idle/4-frame walk/lie-down, recolored into 6 dyes |
| Character VFX | 4 thought bubbles (tool, fork, zzz, speech) |
| UI | 9-slice panel, bitmap font strip, resource/season/speed icons |

All art is generated from `tools/genart/`, restricted to the 29 colors in
`tools/genart/palette.ts`, drawn at 16px native against a 32px world tile (exactly 2× via
`ART_SCALE`), and committed to `public/art/`.

## Cost model

Roughly what each kind of addition costs, in the order the work happens:

- **Decor / terrain prop** — sprite in `tools/genart/sprites/props.ts`, a placement rule in
  `src/render/tilemap.ts`, `npm run art`. No Rust, no save-format impact. *Cheapest.*
- **Building** — sprite in `tools/genart/sprites/buildings.ts`, an entry appended to
  `src-tauri/data/buildings.json`, the same entry mirrored into `DEMO_CATALOG`
  (`src/state/demoWorld.ts`). Appending is mandatory: a building's `kind` is its index in the
  catalog, so inserting in the middle rewrites existing saves. Cheap *if* it needs no new job kind.
- **Building with new behaviour** — everything above plus a job kind in `src-tauri/src/sim/jobs.rs`,
  a utility-AI consideration in `utility.rs`, and the demo-world mirror. *Expensive.*
- **Character variety** — new poses multiply across 6 dyes, so each pose is 6 atlas cells; the
  sheet is 256px wide and grows vertically, which is fine but not free.
- **Need / stat** — touches `needs.rs`, `utility.rs`, `VillagerPanel`, the snapshot wire type and
  the demo world. *Expensive, and it changes balance.*

## Candidates

### Terrain & decor (cheap, high visual return)

| Idea | Notes |
|---|---|
| Bushes, boulders, palms, reeds | **Done in this PR.** Deterministic hash scatter, hidden under building footprints. |
| Tree stumps and deadfall | Scatter on grass adjacent to forest; sells the idea that the forest was logged. Could later be driven by depleted `ResourceNode`s rather than a hash. |
| Flower patches, seasonal tint | The clock already exposes a season; a spring-only flower prop is a two-line placement rule and makes seasons legible on the map. |
| Depleted-node art | `ResourceNode.amount` is already in the sim but invisible. A stump variant for an exhausted forest tile and a rubble variant for exhausted rock would make gathering readable. Needs nodes on the wire (they aren't in the tick snapshot today). |
| Cliff / shoreline rocks | Wet-rock props on sand tiles touching deep water. |
| Dirt paths worn by villagers | Track tile traversal counts in the sim, blend a path fringe over grass. Genuinely nice, genuinely not cheap. |

### Terrain types

| Idea | Notes |
|---|---|
| Marsh / wetland | A new `Terrain` byte between shallow water and sand. Every byte added means: `Terrain` enum + `classify()` in `src-tauri/src/sim/terrain.rs`, `BASE_BY_TERRAIN`/`PRIORITY` in `src/render/tilemap.ts`, base+fringe tiles in `tools/genart/sprites/terrain.ts`, walkability in pathfinding, and `valid_terrain` decisions per building. Doable, but it's the most invasive "cheap-sounding" change on this list. |
| Snow line above the mountains | Same cost as above, plus it interacts with the season system. |
| River tiles | Needs generation work (flow from peak to sea), not just art. |

### Buildings

| Idea | Notes |
|---|---|
| Well | **Done in this PR.** 1×1 amenity, unlocks at population 4, no jobs — a village landmark and a natural hook if a thirst need ever lands. |
| Woodcutter's lodge / quarry hut | Would let gathering be assigned to a building instead of raw terrain, which is how the other jobs already work. Needs a job kind. |
| Market | A social/trade hub; `gold` exists in the resource list and is currently unused, so this is where an economy sink would go. |
| Storehouse (generic) | Granary only stores grain/flour/food. A wood/stone store is a data-only addition. |
| Chapel / meeting hall | Pure amenity for the Socialize need — a destination beats wandering to a random tile. |
| Fishing hut | New job kind against shallow-water tiles; would give coastal villages a reason to exist. |
| Fences, gates, signposts | 1×1 zero-job decorative buildings. Data + sprite only, and they let the player decorate. |

### Characters

| Idea | Notes |
|---|---|
| Child and elder body sizes | The sim already has births; a shorter sprite for a young villager would make population growth visible. Costs 6 dyes per pose. |
| Job-specific overlays | A hat or tool held per job kind, drawn as a second cell over the body — cheaper than new full bodies and it makes the AI's decisions readable. |
| Carry pose | Hauling is a real job but hauliers look identical to everyone else. A "carrying" walk cycle is the single highest-value character addition. |
| More dyes / hair variants | `VILLAGER_DYES` is a list; adding entries is nearly free and increases crowd variety. |
| Animals — sheep, chickens, gulls | Wandering non-agents (pure render-side drift) are cheap and add a lot of life. Livestock that feeds the economy is a sim feature, not a prop. |
| More traits | `traits.json` is data-only and traits are currently descriptive, with no mechanical effect. Adding entries is free; making them *matter* is the interesting work. |

### Effects & UI

| Idea | Notes |
|---|---|
| Weather (rain, snow overlay) | Already named as remaining M10 work. A particle overlay on the entity layer plus a season/weather field on the snapshot. |
| Chimney smoke, mill dust | Small animated cells anchored to a building; the mill and bakery already animate, so the pattern exists. |
| Day/night tint | A single full-screen multiply keyed off `clock.minute`. Cheap and transformative. |
| Selection and job-target markers | Selection brackets exist; a marker on the tile a villager is pathing to would make the AI legible. |

## Rules of thumb for anyone picking one up

1. Only the 29 palette colors may appear in art — the rasterizer throws otherwise.
2. Re-run `npm run art` after touching anything under `tools/genart/`, or `genart.test.ts` fails.
   The committed PNGs are the source of truth for the renderer and are compared by decoded pixels.
3. Append to `buildings.json`; never insert or reorder. `kind` is an index and saves store it.
4. Any catalog change must be mirrored into `DEMO_CATALOG` in `src/state/demoWorld.ts`, or the
   browser-demo (the only headless-testable path) drifts from the desktop build.
5. Vitest runs in Node with no DOM. Keep placement/planning logic pure and separate from painters
   so it stays testable.
