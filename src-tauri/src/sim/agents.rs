use super::economy::CarryStack;
use super::needs::Needs;

pub use super::utility::{ActionKind, EAT_TICKS, SLEEP_TICKS, SOCIALIZE_TICKS};

/// Why the villager is walking to a tile.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MovePurpose {
    PlayerOrder,
    Work,
    Wander,
}

/// Villager FSM + utility-driven activity states (Milestone 7).
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum AgentState {
    Idle,
    MovingTo {
        target: (i32, i32),
        purpose: MovePurpose,
    },
    Working {
        job: u32,
        ticks_remaining: u32,
    },
    Eating {
        ticks_remaining: u32,
    },
    Sleeping {
        ticks_remaining: u32,
    },
    Socializing {
        ticks_remaining: u32,
    },
}

impl AgentState {
    pub fn as_u8(&self) -> u8 {
        match self {
            Self::Idle => 0,
            Self::MovingTo { .. } => 1,
            Self::Working { .. } => 2,
            Self::Eating { .. } => 3,
            Self::Sleeping { .. } => 4,
            Self::Socializing { .. } => 5,
        }
    }

    pub fn label(&self) -> &'static str {
        match self {
            Self::Idle => "Idle",
            Self::MovingTo { purpose, .. } => match purpose {
                MovePurpose::PlayerOrder => "Moving",
                MovePurpose::Work => "Going to work",
                MovePurpose::Wander => "Wandering",
            },
            Self::Working { .. } => "Working",
            Self::Eating { .. } => "Eating",
            Self::Sleeping { .. } => "Sleeping",
            Self::Socializing { .. } => "Socializing",
        }
    }

    pub fn is_decidable(&self) -> bool {
        matches!(self, Self::Idle | Self::Working { .. })
    }
}

/// Ticks to wait after a failed repath before trying again.
pub const REPATH_COOLDOWN_TICKS: u32 = 20;

/// Movement speed in tiles per second (~2 tiles/s at 20 Hz → 0.1 tiles/tick).
pub const MOVE_SPEED_TILES_PER_SEC: f32 = 2.0;

/// Duration of one tend-crops work cycle before looping.
pub const WORK_CYCLE_TICKS: u32 = 40;

/// Default job priority for advertised building jobs.
pub const DEFAULT_JOB_PRIORITY: u8 = 10;

pub const STARTING_VILLAGER_NAMES: [&str; 5] = ["Ash", "Briar", "Cora", "Dale", "Ellis"];

#[derive(Clone, Debug)]
pub struct Villager {
    pub id: u32,
    pub name: String,
    /// World-pixel position (tile centers when snapped).
    pub pos: (f32, f32),
    pub state: AgentState,
    pub needs: Needs,
    pub current_job: Option<u32>,
    /// Remaining tile waypoints (tile coordinates); next waypoint is `path[0]`.
    pub path: Option<Vec<(i32, i32)>>,
    /// Ticks remaining before another repath attempt is allowed.
    pub repath_cooldown: u32,
    /// Last chosen utility action (for hysteresis).
    pub current_action: Option<ActionKind>,
    /// Goods in transit for a Haul job.
    pub carrying: Option<CarryStack>,
}

impl Villager {
    pub fn new(id: u32, name: impl Into<String>, pos: (f32, f32)) -> Self {
        Self {
            id,
            name: name.into(),
            pos,
            state: AgentState::Idle,
            needs: Needs::full(),
            current_job: None,
            path: None,
            repath_cooldown: 0,
            current_action: None,
            carrying: None,
        }
    }

    pub fn target_tile(&self) -> Option<(i32, i32)> {
        match self.state {
            AgentState::MovingTo { target, .. } => Some(target),
            _ => None,
        }
    }

    pub fn clear_path_to_idle(&mut self) {
        self.state = AgentState::Idle;
        self.path = None;
    }

    pub fn begin_eating(&mut self) {
        self.path = None;
        self.state = AgentState::Eating {
            ticks_remaining: EAT_TICKS,
        };
        self.current_action = Some(ActionKind::Eat);
    }

    pub fn begin_sleeping(&mut self) {
        self.path = None;
        self.state = AgentState::Sleeping {
            ticks_remaining: SLEEP_TICKS,
        };
        self.current_action = Some(ActionKind::Sleep);
    }

    pub fn begin_socializing(&mut self) {
        self.path = None;
        self.state = AgentState::Socializing {
            ticks_remaining: SOCIALIZE_TICKS,
        };
        self.current_action = Some(ActionKind::Socialize);
    }
}
