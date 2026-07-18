# VillageSim Milestone 4 Design

## Scope

Milestone 4 replaces the fake orbiting villager with one real agent that pathfinds on the tile grid. The player right-clicks a walkable tile; the villager walks there via A*, routing around impassable terrain and buildings. If a building is placed on the active path, the path is invalidated and recomputed (or the agent falls back to Idle briefly and retries).

**Done when:** the villager navigates around an obstacle you place in its path mid-walk.

Out of scope: needs decay, job board, utility AI, crops, clock/speed UI, multiple autonomous goals beyond “go to clicked tile.” Keep M3 placement/demolish intact.

## Architecture

M3 boundaries stay intact. Additions:

1. `sim/pathfind.rs` — A* over the grid (`pathfinding` crate), 8-directional, diagonal cost √2, no corner-cutting through impassable diagonals; node expansion cap ~4000.
2. `sim/agents.rs` — single villager with `AgentState::{Idle, MovingTo { target, purpose, path }}`; each tick advances along the cached path in continuous world coords (~2 tiles/second).
3. New command: `move_villager_to { x, y }` (or `order_move`) pushed through the existing `mpsc` channel.
4. Frontend: right-click → world tile → invoke move command. Optional thin path polyline overlay for debugging (nice-to-have, not required for done).

Passability matches the spec: DeepWater, ShallowWater, Rock, Mountain impassable; building-occupied tiles impassable; Grass/Sand/Forest walkable.

## Rust details

### Villager (M4 slice)

```rust
pub struct Villager {
    pub id: u32,
    pub pos: (f32, f32),       // world pixels
    pub state: AgentState,
    pub path: Option<Path>,    // remaining tile waypoints
}

pub enum AgentState {
    Idle,
    MovingTo { target: (i32, i32), purpose: MovePurpose },
}

pub enum MovePurpose {
    PlayerOrder,
}
```

Spawn one villager near map center on a walkable tile at world start (replace orbital fake motion).

### Pathfinding

- Input: start tile, goal tile, passability closure over `World`.
- Output: sequence of tile centers (or tile coords) cached on the villager.
- On each tick while `MovingTo`: move toward next waypoint at ~2 tiles/s; when waypoints empty → `Idle`.
- Invalidate when: occupancy changes on any remaining path tile, or goal becomes impassable. Then repath once; on failure → `Idle` + short cooldown (do not repath every tick).

### IPC

```rust
#[tauri::command]
async fn move_villager_to(x: i32, y: i32) -> Result<(), String>
```

Optional: include `villager_id` later; M4 has exactly one villager.

`TickSnapshot.villagers` already carries `{ id, x, y }`; may add `state: u8` if cheap (Idle=0, Moving=1) for UI/debug.

## Frontend details

- Right-click on canvas (not in build mode, or always): `screen → world → tile` → `transport.moveVillagerTo(tx, ty)`.
- Middle-drag pan and left-click place/select from M3 unchanged.
- Browser-demo: port the same A* (or a simple BFS) into `DemoWorld` so cloud smoke can exercise move + obstacle.

## Verification

- Rust unit: A* around a wall; no-path case; path invalidation when a tile becomes occupied.
- Integration: order move to a tile → villager position approaches target over ticks.
- Browser smoke: right-click grass → villager walks; place hut on path → villager repaths around it.
- `cargo test --lib`, `npm test`, `npm run build` pass.

## Explicit non-goals

Needs, jobs, Working/Eating/Sleeping states, utility AI, crops, seasons — all M5+.
