# VillageSim Milestone 8 Design

## Scope

Milestone 8 adds the economy loop: resource nodes + gathering, crop harvest into grain, building inventories with storage capacity, recipes (mill → bakery), hauling jobs, and a `ResourceBar` UI.

**Done when:** grain harvested from a farm is hauled to a granary, milled, baked, and eaten — with no manual intervention.

Out of scope: weather/storm damage (M10), housing/births (M9), traits filtering jobs, tech unlocks, villager inventory UI polish, seed markets.

## Decisions (locked)

| Topic | Choice |
|---|---|
| Resources | Add `flour` to `ResourceTotals`; keep wood/stone/grain/food/gold |
| Stockpile | Keep `World.stockpile` (renamed from lone global pool) as the starting camp store; counts as storage |
| Building inventory | Every `Building` has `inventory: BTreeMap<String, u32>` |
| ResourceTotals | Derived each snapshot: `stockpile` + sum of inventories on storage-category buildings only |
| Production buffers | Farms/mills/bakeries hold inputs/outputs in their own inventory (not counted in bar until hauled to storage) |
| Buffer cap | Production buildings: total units ≤ `30`; storage uses catalog `capacity` |
| Granary stores | `["grain", "flour", "food"]` (expanded from food-only) |
| Recipes | Parsed on `BuildingDef.recipe`; mill + bakery added to `buildings.json` |
| Mill | `grain×2 → flour×2` in 80 ticks |
| Bakery | `flour×1 → food×2` in 100 ticks |
| Harvest | TendCrops harvests ready crops into farm inventory; removes crop; auto-plant may spend `seed_cost` from farm/stockpile grain when available (else plant free if no grain — keep farms productive) |
| Seed spend | Prefer spend `seed_cost` from farm inventory then stockpile; if unaffordable, still auto-plant (no soft-lock) |
| Gather | `ResourceNode` on Forest→wood and Rock→stone tiles; deplete + slow regen; `Gather` jobs advertised for nodes with amount > 0 |
| Gather stand | Forest: stand on node tile; Rock: adjacent walkable stand |
| Haul | Granary advertises `Haul`; mill/bakery also advertise `Haul` (1 slot) so inputs arrive |
| Haul carry | Villager `carrying: Option<CarryStack { resource, amount }>` max stack 5 |
| Haul tasks | (1) production output → accepting storage; (2) storage/stockpile → production needing recipe inputs |
| Produce | `Produce` job on mill/bakery: when inputs present in building inventory, run recipe ticks, then credit outputs to building inventory |
| Eat / build costs | Withdraw from stockpile first, then storage inventories that store that resource |
| Job kinds | `TendCrops`, `Gather`, `Haul`, `Produce` |
| Nodes in snapshot | Omitted from tick payload (perf); gathering visible via resource totals + villager Work state |
| ResourceBar | New `src/ui/ResourceBar.tsx`; remove duplicate resource dl from BuildMenu |

## Architecture

1. `sim/economy.rs` — inventory helpers (deposit/withdraw/capacity), haul task finder, recipe progress on buildings, carry helpers.
2. `sim/nodes.rs` — `ResourceNode` gen from terrain, gather tick, regen.
3. Extend `resources.rs` — add `flour`; helpers to sum storage views.
4. Extend `catalog.rs` / `buildings.json` — `recipe`, mill, bakery; granary stores list; haul on mill/bakery.
5. Extend `buildings.rs` — `inventory`, `recipe_ticks` (progress toward current craft).
6. Extend `jobs.rs` — `Gather` / `Haul` / `Produce`; gather jobs keyed by node tile (`site = 0`, tile = stand).
7. Extend `agents.rs` — `carrying` on villager.
8. `world.rs` — dispatch `tick_working` by job kind; harvest; haul FSM; produce; refresh gather jobs; derive totals.
9. Frontend — `ResourceBar`, types (`flour`, recipe on defs), demoWorld parity.

## Behaviour

### Derived totals

```
totals[r] = stockpile[r] + Σ building.inventory[r]
            for buildings whose def.category == "storage"
              and def.stores contains r
```

Production buffers do **not** appear in the ResourceBar until hauled into storage/stockpile.

### Withdraw / deposit

- `withdraw(resource, amount)` pulls stockpile first, then storage buildings in id order (deterministic).
- `deposit_storage(resource, amount)` fills stockpile if it accepts (always), else storage buildings with free capacity for that resource.
- Production `deposit_building(id, …)` respects buffer cap / recipe-allowed keys.

### Harvest (TendCrops)

Each work cycle start (and once when crop becomes ready under a working tender):

1. Find ready crops on the job’s farm footprint.
2. For each (cap 1 per cycle): add `yield` into farm inventory (respect buffer); remove crop entity; emit nothing new (CropReady already fired).
3. Auto-plant as today; if `seed_cost` can be paid from farm then stockpile, spend it.

### Gathering

On world gen, create a node for every Forest and Rock tile:

- Forest: `wood`, amount = 5, max = 5
- Rock: `stone`, amount = 4, max = 4
- Regen: +1 per `200` ticks while `amount < max`

Each tick (or when jobs refresh): ensure up to `N` unclaimed Gather jobs exist for nodes with `amount > 0` (stand tile walkable). Priority `8`.

While Working Gather: every cycle, if node still has amount, decrement 1 and deposit 1 wood/stone into stockpile (gatherers deliver to camp directly — no haul required for raw mats in M8). Depleted node → release job.

### Produce

While Working Produce at mill/bakery:

- If `recipe_ticks == 0` and inputs available in **this building’s** inventory: consume inputs, set `recipe_ticks = recipe.ticks`.
- Else if `recipe_ticks > 0`: decrement; at 0 add outputs to building inventory (buffer cap; spill discarded only if over cap — tests size batches to fit).

### Hauling

Haul job site is the building that advertised it (granary/mill/bakery). While Working:

**If not carrying:** find best task (deterministic scan):

1. Any production building with output resources that some storage (incl. stockpile-via-deposit) accepts → haul to nearest storage that can store them.
2. Else any storage/stockpile with a resource a production building’s recipe needs (and building has room) → haul there.

Path to source building stand (or stockpile = nearest walkable to map center camp tile). On arrival pick up up to 5 units into `carrying`.

**If carrying:** path to destination stand; on arrival deposit; clear carrying.

Simplified M8 pathing: reuse `MovingTo { purpose: Work }` between pickups; `Working` only while at site executing pick/drop or waiting for a task. If no task, stay Working and idle the cycle (keep claim).

Stockpile access tile: world center walkable tile used as the camp stand for withdrawals/deposits involving stockpile.

### Placement / demolish

- Costs withdraw via `withdraw`.
- Refund deposits into stockpile.
- Demolish: dump building inventory into stockpile (fitting capacity; overflow lost only if somehow over — stockpile uncapped in M8).

### Eat

`begin_eat` withdraws 1 food via `withdraw("food", 1)`.

## Catalog data

```json
{
  "id": "granary",
  "stores": ["grain", "flour", "food"],
  "capacity": 500,
  "jobs": [{ "kind": "haul", "slots": 1 }]
},
{
  "id": "mill",
  "name": "Mill",
  "footprint": [2, 2],
  "cost": { "wood": 30, "stone": 20 },
  "build_ticks": 80,
  "category": "production",
  "valid_terrain": ["grass", "sand"],
  "recipe": { "inputs": { "grain": 2 }, "outputs": { "flour": 2 }, "ticks": 80 },
  "jobs": [
    { "kind": "produce", "slots": 1 },
    { "kind": "haul", "slots": 1 }
  ]
},
{
  "id": "bakery",
  "name": "Bakery",
  "footprint": [2, 2],
  "cost": { "wood": 25, "stone": 15 },
  "build_ticks": 80,
  "category": "production",
  "valid_terrain": ["grass", "sand"],
  "recipe": { "inputs": { "flour": 1 }, "outputs": { "food": 2 }, "ticks": 100 },
  "jobs": [
    { "kind": "produce", "slots": 1 },
    { "kind": "haul", "slots": 1 }
  ]
}
```

Farm gains no haul job — farm buffer is emptied by granary/mill haulers pulling outputs (task finder scans all production buildings).

## IPC / snapshot

- `resources` field remains; now derived.
- No new commands required.
- Optional: building inventories omitted from tick (panel later); ResourceBar uses totals only.
- `VillagerDetail` may show `carrying` as optional string for debug — skip unless cheap.

## Frontend

- `ResourceBar`: wood, stone, grain, flour, food, gold in header row under ClockBar (or above canvas).
- BuildMenu drops its Resources `<dl>`.
- `demoWorld.ts` mirrors harvest, inventories, haul, produce, gather, flour, derived totals.
- Faster crop ticks in demo optional — keep real timing; tests jump clock / force ready.

## Tests

- Recipe parse + mill/bakery in catalog.
- Harvest adds grain to farm inventory; ready crop removed.
- Derived totals ignore production buffers; include granary + stockpile.
- Haul moves grain farm → granary; totals update.
- Produce: mill consumes grain emits flour; bakery flour → food.
- Gather depletes forest node and adds wood to stockpile.
- Integration: forced ready wheat → harvest → haul → mill → haul → bakery → haul food → eat withdraws food.
- Frontend: ResourceBar renders flour; demo chain smoke.

## Acceptance checklist

- [ ] Place farm, mill, bakery, granary; villagers tend, harvest, haul, mill, bake without player micromanagement.
- [ ] ResourceBar shows all six resources.
- [ ] Eating still works from storage/stockpile food.
- [ ] Gathering increases wood/stone over time from nodes.
- [ ] `cargo test --lib` + `npm test` + `npm run build` green.
