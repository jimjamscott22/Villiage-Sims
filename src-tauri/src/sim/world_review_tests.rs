//! Focused regression scenarios from the September 2026 simulation review.
use super::*;
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
    world.villagers[0].starvation_ticks = 299;
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
    assert_eq!(worker.starvation_ticks, 0);
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
