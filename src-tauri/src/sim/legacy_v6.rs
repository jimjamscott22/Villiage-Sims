// Frozen v6 layout, before the optional flock.
use super::*;
#[derive(Clone, Debug, Serialize, Deserialize)]
pub(crate) struct LegacyWorld {
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) tile_size: u32,
    pub(crate) tiles: Vec<u8>,
    pub(crate) seed: u64,
    pub(crate) clock: Clock,
    pub(crate) catalog: Catalog,
    pub(crate) buildings: Vec<Building>,
    pub(crate) crops: Vec<Crop>,
    pub(crate) nodes: Vec<ResourceNode>,
    pub(crate) occupancy: Vec<Option<u32>>,
    pub(crate) resources: ResourceTotals,
    pub(crate) next_building_id: u32,
    pub(crate) next_crop_id: u32,
    pub(crate) next_villager_id: u32,
    pub(crate) villagers: Vec<Villager>,
    pub(crate) job_board: JobBoard,
    pub(crate) chronicle: Chronicle,
    pub(crate) unlocked: BTreeSet<String>,
    pub(crate) completed_objectives: BTreeSet<String>,
    encounters: Vec<Encounter>,
    behavior: BTreeMap<u32, Behavior>,
    #[serde(skip)]
    leisure_cache: leisure::LeisureCache,
    #[serde(skip)]
    pub(crate) viewport: Viewport,
    /// When set, day rollover writes a rotating autosave into this directory.
    #[serde(skip)]
    pub(crate) autosave_dir: Option<PathBuf>,
    /// Last autosave slot written this session (`1..=3`).
    #[serde(skip)]
    pub(crate) last_autosave_slot: Option<u8>,
}

impl LegacyWorld {
    pub(crate) fn into_world(self) -> World {
        World {
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
            encounters: self.encounters,
            behavior: self.behavior,
            leisure_cache: self.leisure_cache,
            viewport: self.viewport,
            autosave_dir: self.autosave_dir,
            last_autosave_slot: self.last_autosave_slot,
            flock: None,
        }
    }
    #[cfg(test)]
    pub(crate) fn from_world(world: &World) -> Self {
        let world = world.clone();
        Self {
            width: world.width,
            height: world.height,
            tile_size: world.tile_size,
            tiles: world.tiles,
            seed: world.seed,
            clock: world.clock,
            catalog: world.catalog,
            buildings: world.buildings,
            crops: world.crops,
            nodes: world.nodes,
            occupancy: world.occupancy,
            resources: world.resources,
            next_building_id: world.next_building_id,
            next_crop_id: world.next_crop_id,
            next_villager_id: world.next_villager_id,
            villagers: world.villagers,
            job_board: world.job_board,
            chronicle: world.chronicle,
            unlocked: world.unlocked,
            completed_objectives: world.completed_objectives,
            encounters: world.encounters,
            behavior: world.behavior,
            leisure_cache: world.leisure_cache,
            viewport: world.viewport,
            autosave_dir: world.autosave_dir,
            last_autosave_slot: world.last_autosave_slot,
        }
    }
}
