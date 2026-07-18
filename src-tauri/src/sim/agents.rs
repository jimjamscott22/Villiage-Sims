/// Why the villager is walking to a tile (M4 only supports player orders).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MovePurpose {
    PlayerOrder,
}

/// Minimal villager FSM for Milestone 4.
#[derive(Clone, Debug, PartialEq)]
pub enum AgentState {
    Idle,
    MovingTo {
        target: (i32, i32),
        purpose: MovePurpose,
    },
}

impl AgentState {
    pub fn as_u8(&self) -> u8 {
        match self {
            Self::Idle => 0,
            Self::MovingTo { .. } => 1,
        }
    }
}

/// Ticks to wait after a failed repath before trying again.
pub const REPATH_COOLDOWN_TICKS: u32 = 20;

/// Movement speed in tiles per second (~2 tiles/s at 20 Hz → 0.1 tiles/tick).
pub const MOVE_SPEED_TILES_PER_SEC: f32 = 2.0;

#[derive(Clone, Debug)]
pub struct Villager {
    pub id: u32,
    /// World-pixel position (tile centers when snapped).
    pub pos: (f32, f32),
    pub state: AgentState,
    /// Remaining tile waypoints (tile coordinates); next waypoint is `path[0]`.
    pub path: Option<Vec<(i32, i32)>>,
    /// Ticks remaining before another repath attempt is allowed.
    pub repath_cooldown: u32,
}

impl Villager {
    pub fn new(id: u32, pos: (f32, f32)) -> Self {
        Self {
            id,
            pos,
            state: AgentState::Idle,
            path: None,
            repath_cooldown: 0,
        }
    }

    pub fn target_tile(&self) -> Option<(i32, i32)> {
        match self.state {
            AgentState::MovingTo { target, .. } => Some(target),
            AgentState::Idle => None,
        }
    }

    pub fn clear_path_to_idle(&mut self) {
        self.state = AgentState::Idle;
        self.path = None;
    }
}
