//! Focused regression scenarios from the September 2026 simulation review.
use super::*;
use crate::sim::needs::HEALTH_DAMAGE;
use crate::sim::utility::EAT_TICKS;

fn open_world(size: u32) -> World {
    let mut world = World::generate(size, size, 32, 1);
    world.tiles = vec![Terrain::Grass as u8; (size * size) as usize];
    world.occupancy = vec![None; (size * size) as usize];
    world.nodes.clear();
    world.villagers.truncate(1);
    world.villagers[0].pos = world.tile_center(0, 0);
    world.resources.wood = 1000;
    world.resources.stone = 1000;
    world.resources.grain = 0;
    world
}

fn complete(world: &mut World, kind: &str, x: i32, y: i32) -> u32 {
    world.unlocked.insert(kind.into());
    let id = world.place_building(kind, x, y, 0).unwrap().id;
    world.buildings.iter_mut().find(|b| b.id == id).unwrap().state =
        BuildState::Complete;
    world.advertise_jobs_for(id);
    id
}

fn add_inventory(world: &mut World, id: u32, resource: &str, amount: u32) {
    let building = world.buildings.iter_mut().find(|b| b.id == id).unwrap();
    inventory_add(&mut building.inventory, resource, amount);
}

fn enclose(world: &mut World, min: i32, max: i32) {
    for y in min..=max {
        for x in min..=max {
            if x == min || x == max || y == min || y == max {
                world.tiles[(y as u32 * world.width + x as u32) as usize] = Terrain::Rock as u8;
            }
        }
    }
}

#[test]
fn starving_worker_interrupts_long_trip_when_food_arrives() {
    let mut world = open_world(64);
    world.resources.food = 0;
    world.nodes.push(ResourceNode::forest((60, 0)));
    world.villagers[0].needs.set_hunger(0.001);
    world.advance();
    assert!(matches!(
        world.villagers[0].state,
        AgentState::MovingTo { purpose: MovePurpose::Work, .. }
    ));
    let job = world.villagers[0].current_job.unwrap();
    world.resources.food = 10;

    for _ in 0..400 {
        world.advance();
    }

    // Check the original id: births must not disguise a starvation death.
    let worker = world.villagers.iter().find(|v| v.id == 1)
        .expect("original worker survives");
    assert!(worker.needs.hunger > 0.9);
    assert_eq!(world.resources.food, 9);
    assert_eq!(worker.current_job, Some(job));
    assert_eq!(world.job_board.get(job).unwrap().claimed_by, Some(1));
}

#[test]
fn last_moment_meal_finishes_before_starvation_and_preserves_cargo() {
    let mut world = open_world(64);
    world.order_move_villager(60, 0, Some(1)).unwrap();
    world.villagers[0].needs.set_hunger(0.0);
    // One more tick of starvation damage would be fatal.
    world.villagers[0].needs.set_health(HEALTH_DAMAGE * 0.5);
    let cargo = CarryStack {
        resource: "grain".into(),
        amount: 3,
        dest: HaulEndpoint::Stockpile,
    };
    world.villagers[0].carrying = Some(cargo.clone());
    world.resources.food = 1;

    for _ in 0..EAT_TICKS {
        world.advance();
    }

    let worker = world.villagers.iter().find(|v| v.id == 1).unwrap();
    assert_eq!(worker.needs.hunger, 1.0);
    assert!(worker.needs.health > 0.0);
    assert_eq!(worker.carrying, Some(cargo));
    assert_eq!(world.resources.food, 0);
}

#[test]
fn inaccessible_farm_does_not_block_accessible_bakery_supply() {
    let mut world = open_world(24);
    let farm = complete(&mut world, "farm", 3, 3);
    complete(&mut world, "granary", 10, 5);
    let bakery = complete(&mut world, "bakery", 14, 9);
    add_inventory(&mut world, farm, "grain", 5);
    enclose(&mut world, 1, 7);
    world.resources.flour = 10;
    world.resources.food = 0;

    let task = world.find_haul_task((0, 0)).expect("reachable flour delivery");
    assert_eq!(task.from, HaulEndpoint::Stockpile);
    assert_eq!(task.to, HaulEndpoint::Building(bakery));
    assert_eq!(task.resource, "flour");
    for _ in 0..1500 {
        world.advance();
    }

    assert!(
        world.derived_resources().food > 0,
        "autonomous workers must produce and deliver food"
    );
    let farm = world.buildings.iter().find(|b| b.id == farm).unwrap();
    assert_eq!(inventory_get(&farm.inventory, "grain"), 5);
}

#[test]
fn production_haul_uses_reachable_storage_instead_of_nearest_enclosed_storage() {
    let mut world = open_world(24);
    let farm = complete(&mut world, "farm", 8, 2);
    complete(&mut world, "granary", 3, 3);
    let reachable = complete(&mut world, "granary", 18, 10);
    add_inventory(&mut world, farm, "grain", 5);
    enclose(&mut world, 1, 6);

    let task = world.find_haul_task((8, 0)).unwrap();
    assert_eq!(task.from, HaulEndpoint::Building(farm));
    assert_eq!(task.to, HaulEndpoint::Building(reachable));
}

#[test]
fn recipe_supply_skips_an_unreachable_destination() {
    let mut world = open_world(24);
    complete(&mut world, "bakery", 3, 3);
    let reachable = complete(&mut world, "bakery", 14, 9);
    enclose(&mut world, 1, 6);
    world.resources.flour = 4;

    let task = world.find_haul_task((0, 0)).unwrap();
    assert_eq!(task.from, HaulEndpoint::Stockpile);
    assert_eq!(task.to, HaulEndpoint::Building(reachable));
}

#[test]
fn recipe_supply_skips_an_unreachable_storage_source() {
    let mut world = open_world(24);
    let blocked = complete(&mut world, "granary", 3, 3);
    let reachable = complete(&mut world, "granary", 14, 3);
    let bakery = complete(&mut world, "bakery", 14, 9);
    add_inventory(&mut world, blocked, "flour", 4);
    add_inventory(&mut world, reachable, "flour", 3);
    enclose(&mut world, 1, 6);

    let task = world.find_haul_task((0, 0)).unwrap();
    assert_eq!(task.from, HaulEndpoint::Building(reachable));
    assert_eq!(task.to, HaulEndpoint::Building(bakery));
}

#[test]
fn haul_task_prefers_the_pickup_nearest_the_worker() {
    let mut world = open_world(32);
    complete(&mut world, "granary", 20, 20);
    let far = complete(&mut world, "farm", 2, 2);
    let near = complete(&mut world, "farm", 11, 2);
    add_inventory(&mut world, far, "grain", 4);
    add_inventory(&mut world, near, "grain", 4);
    let near_stand = world.building_stand_tile(near).unwrap();

    let task = world.find_haul_task(near_stand).expect("haul task");
    assert_eq!(task.from, HaulEndpoint::Building(near));
}

#[test]
fn resuming_hauler_heads_for_delivery_not_job_tile() {
    let mut world = open_world(32);
    let granary = complete(&mut world, "granary", 20, 20);
    complete(&mut world, "farm", 2, 2);
    let dest_stand = world.building_stand_tile(granary).unwrap();
    let haul_job = world
        .job_board
        .jobs()
        .iter()
        .find(|job| job.kind == JobKind::Haul)
        .map(|job| job.id)
        .expect("a haul job");
    world.villagers[0].carrying = Some(CarryStack {
        resource: "grain".into(),
        amount: 3,
        dest: HaulEndpoint::Building(granary),
    });

    world.begin_work(0, Some(haul_job));

    assert_eq!(world.villagers[0].current_job, Some(haul_job));
    assert!(matches!(
        world.villagers[0].state,
        AgentState::MovingTo { target, purpose: MovePurpose::Work } if target == dest_stand
    ));
}

fn plant_and_water_farm(world: &mut World, farm: u32) {
    for (x, y) in world.farm_footprint_tiles(farm) {
        world.plant_crop("wheat", x, y).unwrap();
    }
    for crop in &mut world.crops {
        crop.watered = true;
    }
    world.resources.grain = 0;
}

#[test]
fn idle_farm_job_does_not_trap_a_villager_in_place() {
    let mut world = open_world(24);
    let farm = complete(&mut world, "farm", 8, 8);
    plant_and_water_farm(&mut world, farm);
    let start = world.villagers[0].pos;

    let mut moved = false;
    for _ in 0..200 {
        for crop in &mut world.crops {
            crop.watered = true;
        }
        world.advance();
        moved |= world.villagers[0].pos != start;
    }
    assert!(moved, "villager should wander when the only job is unusable");
}

#[test]
fn claim_on_a_job_that_became_unusable_is_swapped_for_a_usable_one() {
    let mut world = open_world(24);
    let farm = complete(&mut world, "farm", 8, 8);
    let other = complete(&mut world, "farm", 14, 14);
    plant_and_water_farm(&mut world, farm);
    // The second farm is empty, with seed available, so its tending job is usable.
    world.resources.grain = 20;
    let stale = world
        .job_board
        .jobs()
        .iter()
        .find(|j| j.site == farm && j.kind == JobKind::TendCrops)
        .map(|j| j.id)
        .unwrap();
    let usable = world
        .job_board
        .jobs()
        .iter()
        .find(|j| j.site == other && j.kind == JobKind::TendCrops)
        .map(|j| j.id)
        .unwrap();
    for crop in world.crops.iter_mut() {
        crop.watered = true;
    }
    // Only the immature-farm job is unusable; make sure the empty farm is not planted.
    let id = world.villagers[0].id;
    assert!(world.job_board.claim_id(stale, id));
    world.villagers[0].current_job = Some(stale);
    world.villagers[0].current_action = Some(ActionKind::Work);
    world.villagers[0].state = AgentState::Idle;

    world.maybe_decide(0);

    assert_eq!(world.villagers[0].current_job, Some(usable));
}

#[test]
fn stale_claim_with_no_alternative_falls_through_to_another_action() {
    let mut world = open_world(24);
    let farm = complete(&mut world, "farm", 8, 8);
    plant_and_water_farm(&mut world, farm);
    let stale = world
        .job_board
        .jobs()
        .iter()
        .find(|j| j.site == farm && j.kind == JobKind::TendCrops)
        .map(|j| j.id)
        .unwrap();
    let id = world.villagers[0].id;
    assert!(world.job_board.claim_id(stale, id));
    world.villagers[0].current_job = Some(stale);
    world.villagers[0].current_action = Some(ActionKind::Work);
    world.villagers[0].state = AgentState::Idle;

    world.maybe_decide(0);

    assert_ne!(world.villagers[0].current_action, Some(ActionKind::Work));
    assert!(
        !matches!(world.villagers[0].state, AgentState::Idle)
            || world.villagers[0].current_action.is_some()
            || world.has_leisure_intent(0),
        "villager must take another action in the same decision"
    );
}

#[test]
fn fence_on_a_diagonal_flank_forces_a_repath() {
    let mut world = open_world(8);
    world.order_move_villager(1, 1, Some(1)).unwrap();
    let start = world.villagers[0].pos;
    // (1,0) flanks the (0,0) -> (1,1) diagonal; the path's own tiles stay free.
    complete(&mut world, "fence", 1, 0);
    world.invalidate_paths_if_needed();
    world.advance();

    let path = world.villagers[0].path.clone().unwrap_or_default();
    assert_ne!(path, vec![(1, 1)], "diagonal corner cut survived");
    let pos = world.villagers[0].pos;
    // Legal route goes via (0,1): x must not advance before y does.
    assert!(pos.0 <= start.0 + 0.01, "villager cut the corner: {pos:?}");
}

fn carrying_hauler_after_site_removed(demolish_site: bool) -> World {
    let mut world = open_world(32);
    let granary = complete(&mut world, "granary", 20, 20);
    complete(&mut world, "farm", 2, 2);
    let (haul_job, site) = world
        .job_board
        .jobs()
        .iter()
        .find(|job| job.kind == JobKind::Haul)
        .map(|job| (job.id, job.site))
        .expect("a haul job");
    world.villagers[0].carrying = Some(CarryStack {
        resource: "grain".into(),
        amount: 3,
        dest: HaulEndpoint::Building(granary),
    });
    world.begin_work(0, Some(haul_job));
    assert!(matches!(world.villagers[0].state, AgentState::MovingTo { .. }));
    let grain_before = world.resources.grain;
    if demolish_site {
        world.demolish(site).unwrap();
    } else {
        let released = world.job_board.remove_site(site);
        world.clear_released_work_claims(released);
    }
    assert_eq!(world.villagers[0].current_job, None);
    assert!(world.resources.grain >= grain_before);
    world
}

#[test]
fn demolishing_the_haul_site_returns_carried_cargo() {
    let world = carrying_hauler_after_site_removed(true);
    assert!(world.villagers[0].carrying.is_none(), "cargo stranded on worker");
}

#[test]
fn cleared_work_claim_returns_carried_cargo() {
    let world = carrying_hauler_after_site_removed(false);
    assert!(world.villagers[0].carrying.is_none(), "cargo stranded on worker");
}
