use pathfinding::prelude::astar;

use super::terrain::Terrain;

/// Maximum A* node expansions before abandoning the search.
pub const MAX_EXPANSIONS: usize = 4000;

/// Orthogonal step cost (scaled so diagonal ≈ √2).
const ORTHO_COST: u32 = 1000;
/// Diagonal step cost ≈ 1414 (√2 × 1000).
const DIAG_COST: u32 = 1414;

const NEIGHBOR_DELTAS: [(i32, i32); 8] = [
    (1, 0),
    (-1, 0),
    (0, 1),
    (0, -1),
    (1, 1),
    (1, -1),
    (-1, 1),
    (-1, -1),
];

/// Terrain kinds that block walking (matches the villagesim spec).
pub fn terrain_passable(terrain: Terrain) -> bool {
    matches!(terrain, Terrain::Sand | Terrain::Grass | Terrain::Forest)
}

/// Find a tile path from `start` to `goal` using 8-directional A*.
///
/// `passable(x, y)` must return true for walkable tiles (including start/goal).
/// Diagonal moves require both adjacent orthogonal tiles to be passable (no corner-cutting).
/// Returns `None` when no path exists or the expansion cap is hit.
pub fn find_path(
    start: (i32, i32),
    goal: (i32, i32),
    width: i32,
    height: i32,
    passable: &dyn Fn(i32, i32) -> bool,
) -> Option<Vec<(i32, i32)>> {
    if start == goal {
        return Some(vec![start]);
    }
    if !in_bounds(start, width, height)
        || !in_bounds(goal, width, height)
        || !passable(start.0, start.1)
        || !passable(goal.0, goal.1)
    {
        return None;
    }

    let mut expansions = 0usize;
    let result = astar(
        &start,
        |&(x, y)| {
            expansions = expansions.saturating_add(1);
            if expansions > MAX_EXPANSIONS {
                return Vec::new();
            }
            successors(x, y, width, height, passable)
        },
        |&(x, y)| heuristic(x, y, goal.0, goal.1),
        |&pos| pos == goal,
    );

    result.map(|(mut path, _cost)| {
        // Drop the start tile; callers already know where the agent is.
        if !path.is_empty() {
            path.remove(0);
        }
        path
    })
}

fn in_bounds(pos: (i32, i32), width: i32, height: i32) -> bool {
    pos.0 >= 0 && pos.1 >= 0 && pos.0 < width && pos.1 < height
}

fn heuristic(x: i32, y: i32, gx: i32, gy: i32) -> u32 {
    let dx = (x - gx).unsigned_abs();
    let dy = (y - gy).unsigned_abs();
    let diag = dx.min(dy);
    let ortho = dx.max(dy) - diag;
    diag * DIAG_COST + ortho * ORTHO_COST
}

fn successors(
    x: i32,
    y: i32,
    width: i32,
    height: i32,
    passable: &dyn Fn(i32, i32) -> bool,
) -> Vec<((i32, i32), u32)> {
    let mut out = Vec::with_capacity(8);
    for &(dx, dy) in &NEIGHBOR_DELTAS {
        let nx = x + dx;
        let ny = y + dy;
        if !in_bounds((nx, ny), width, height) || !passable(nx, ny) {
            continue;
        }
        let diagonal = dx != 0 && dy != 0;
        if diagonal {
            // No corner-cutting: both flanking orthogonals must be walkable.
            if !passable(x + dx, y) || !passable(x, y + dy) {
                continue;
            }
            out.push(((nx, ny), DIAG_COST));
        } else {
            out.push(((nx, ny), ORTHO_COST));
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn grid_passable(blocked: &[(i32, i32)]) -> impl Fn(i32, i32) -> bool + '_ {
        move |x, y| !blocked.iter().any(|&(bx, by)| bx == x && by == y)
    }

    #[test]
    fn path_goes_around_a_wall() {
        // 5×5 open grid with a vertical wall blocking the direct route.
        let wall: Vec<(i32, i32)> = (0..4).map(|y| (2, y)).collect();
        let path = find_path((0, 0), (4, 0), 5, 5, &grid_passable(&wall)).expect("path");
        assert!(!path.is_empty());
        assert_eq!(*path.last().unwrap(), (4, 0));
        for &(x, y) in &path {
            assert!(
                !wall.contains(&(x, y)),
                "path stepped on wall tile ({x},{y})"
            );
        }
        // Must detour south of the wall (y reaches 4) or around its open bottom.
        assert!(path.iter().any(|&(x, y)| x == 2 && y == 4 || y >= 3));
    }

    #[test]
    fn no_path_when_goal_enclosed() {
        let blocked = vec![(1, 0), (0, 1), (1, 1)];
        let path = find_path((0, 0), (2, 0), 3, 3, &grid_passable(&blocked));
        assert!(path.is_none());
    }

    #[test]
    fn diagonal_cannot_cut_corner_through_impassable() {
        // Start (0,1), goal (1,0). Tile (1,1) and (0,0) layout:
        //   . #     goal is (1,0) blocked? Actually:
        // (0,0)=blocked, (1,0)=goal open, (0,1)=start, (1,1)=blocked
        // Direct diagonal from start to goal would cut through blocked corners.
        let blocked = vec![(0, 0), (1, 1)];
        let path = find_path((0, 1), (1, 0), 2, 2, &grid_passable(&blocked));
        assert!(
            path.is_none(),
            "diagonal corner cut should be forbidden; got {path:?}"
        );
    }

    #[test]
    fn path_invalid_when_goal_impassable() {
        let blocked = vec![(3, 3)];
        assert!(find_path((0, 0), (3, 3), 4, 4, &grid_passable(&blocked)).is_none());
    }

    #[test]
    fn terrain_passability_matches_spec() {
        assert!(!terrain_passable(Terrain::DeepWater));
        assert!(!terrain_passable(Terrain::ShallowWater));
        assert!(!terrain_passable(Terrain::Rock));
        assert!(!terrain_passable(Terrain::Mountain));
        assert!(terrain_passable(Terrain::Sand));
        assert!(terrain_passable(Terrain::Grass));
        assert!(terrain_passable(Terrain::Forest));
    }

    #[test]
    fn start_equals_goal_returns_single_tile() {
        let path = find_path((2, 2), (2, 2), 5, 5, &grid_passable(&[])).unwrap();
        assert_eq!(path, vec![(2, 2)]);
    }
}
