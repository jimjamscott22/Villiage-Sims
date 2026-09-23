// Frozen version-4 layouts: villagers before thirst/health (v5) replaced the
// starvation counter. Version 3 saves share this villager layout.
use super::*;
use crate::sim::agents::ActionKind;
use crate::sim::needs::{HEALTH_DAMAGE, Needs};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub(crate) struct LegacyNeeds {
    hunger: f32,
    energy: f32,
    social: f32,
    happiness: f32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub(crate) struct LegacyVillager {
    id: u32,
    name: String,
    pos: (f32, f32),
    state: AgentState,
    needs: LegacyNeeds,
    current_job: Option<u32>,
    path: Option<Vec<(i32, i32)>>,
    repath_cooldown: u32,
    current_action: Option<ActionKind>,
    carrying: Option<CarryStack>,
    traits: Vec<String>,
    starvation_ticks: u32,
}

impl LegacyVillager {
    /// Thirst starts full; health carries over any starvation already underway.
    pub(crate) fn into_villager(self) -> Villager {
        let mut villager = Villager::new(self.id, self.name, self.pos).with_traits(self.traits);
        villager.state = self.state;
        villager.current_job = self.current_job;
        villager.path = self.path;
        villager.repath_cooldown = self.repath_cooldown;
        villager.current_action = self.current_action;
        villager.carrying = self.carrying;
        let mut needs = Needs::full();
        needs.hunger = self.needs.hunger;
        needs.energy = self.needs.energy;
        needs.social = self.needs.social;
        needs.set_health(1.0 - self.starvation_ticks as f32 * HEALTH_DAMAGE);
        needs.recompute_happiness();
        villager.needs = needs;
        villager
    }
}

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
    villagers: Vec<LegacyVillager>,
    job_board: JobBoard,
    chronicle: Chronicle,
    unlocked: BTreeSet<String>,
    completed_objectives: BTreeSet<String>,
    encounters: Vec<Encounter>,
    behavior: BTreeMap<u32, Behavior>,
}

impl LegacyWorld {
    /// Re-express a current world in the version-4 layout, for migration tests.
    #[cfg(test)]
    pub(crate) fn from_world(world: &World, starvation_ticks: u32) -> Self {
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
            villagers: world
                .villagers
                .into_iter()
                .map(|v| LegacyVillager {
                    id: v.id,
                    name: v.name,
                    pos: v.pos,
                    state: v.state,
                    needs: LegacyNeeds {
                        hunger: v.needs.hunger,
                        energy: v.needs.energy,
                        social: v.needs.social,
                        happiness: v.needs.happiness,
                    },
                    current_job: v.current_job,
                    path: v.path,
                    repath_cooldown: v.repath_cooldown,
                    current_action: v.current_action,
                    carrying: v.carrying,
                    traits: v.traits,
                    starvation_ticks,
                })
                .collect(),
            job_board: world.job_board,
            chronicle: world.chronicle,
            unlocked: world.unlocked,
            completed_objectives: world.completed_objectives,
            encounters: world.encounters,
            behavior: world.behavior,
        }
    }

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
            villagers: self
                .villagers
                .into_iter()
                .map(LegacyVillager::into_villager)
                .collect(),
            job_board: self.job_board,
            chronicle: self.chronicle,
            unlocked: self.unlocked,
            completed_objectives: self.completed_objectives,
            encounters: self.encounters,
            behavior: self.behavior,
            leisure_cache: Default::default(),
            viewport: Viewport::default(),
            autosave_dir: None,
            last_autosave_slot: None,
        }
    }
}
