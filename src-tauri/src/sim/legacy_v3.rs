// Frozen version-3 world layout. Villager and supporting wire layouts are unchanged.
use super::*;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub(crate) struct LegacyWorld {
    width: u32,
    height: u32,
    tile_size: u32,
    tiles: Vec<u8>,
    seed: u64,
    clock: Clock,
    catalog: Catalog,
    buildings: Vec<Building>,
    crops: Vec<Crop>,
    nodes: Vec<ResourceNode>,
    occupancy: Vec<Option<u32>>,
    resources: ResourceTotals,
    next_building_id: u32,
    next_crop_id: u32,
    next_villager_id: u32,
    villagers: Vec<Villager>,
    job_board: JobBoard,
    chronicle: Chronicle,
    unlocked: BTreeSet<String>,
    completed_objectives: BTreeSet<String>,
    #[serde(skip)]
    viewport: Viewport,
    /// When set, day rollover writes a rotating autosave into this directory.
    #[serde(skip)]
    autosave_dir: Option<PathBuf>,
    /// Last autosave slot written this session (`1..=3`).
    #[serde(skip)]
    last_autosave_slot: Option<u8>,
}


impl LegacyWorld {
    pub(crate) fn into_world(self) -> World {
        let mut world = World {
            width: self.width,
            height: self.height,
            tile_size: self.tile_size,
            tiles: self.tiles,
            seed: self.seed,
            clock: self.clock,
            catalog: self.catalog,
            buildings: self.buildings,
            crops: self.crops,
            nodes: self.nodes,
            occupancy: self.occupancy,
            resources: self.resources,
            next_building_id: self.next_building_id,
            next_crop_id: self.next_crop_id,
            next_villager_id: self.next_villager_id,
            villagers: self.villagers,
            job_board: self.job_board,
            chronicle: self.chronicle,
            unlocked: self.unlocked,
            completed_objectives: self.completed_objectives,
            viewport: self.viewport,
            autosave_dir: self.autosave_dir,
            last_autosave_slot: self.last_autosave_slot,
            encounters: Vec::new(),
            behavior: BTreeMap::new(),
            leisure_cache: Default::default(),
        };
        for v in &mut world.villagers {
            if matches!(v.state, AgentState::Socializing { .. }) {
                v.clear_path_to_idle();
                v.current_action = None;
            }
        }
        world
    }
}
