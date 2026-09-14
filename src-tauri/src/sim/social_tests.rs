use super::*;

fn open_world() -> World {
    let mut w = World::generate(32, 32, 32, 42);
    w.tiles.fill(Terrain::Grass as u8);
    w.occupancy.fill(None);
    w.nodes.clear();
    w.job_board = JobBoard::new();
    w.villagers.truncate(2);
    for (i, v) in w.villagers.iter_mut().enumerate() {
        v.pos = ((2 + i * 3) as f32 * 32.0 + 16.0, 80.0);
        v.clear_path_to_idle();
        v.current_action = None;
        v.needs.social = 0.4;
    }
    w.resources.wood = 1000;
    w.resources.stone = 1000;
    w.refresh_leisure_cache();
    w
}

fn complete(w: &mut World, kind: &str, x: i32, y: i32) -> u32 {
    w.unlocked.insert(kind.into());
    let id = w.place_building(kind, x, y, 0).unwrap().id;
    w.buildings.iter_mut().find(|b| b.id == id).unwrap().state = BuildState::Complete;
    w.advertise_jobs_for(id);
    w.refresh_leisure_cache();
    id
}

fn reach_chat(w: &mut World) {
    assert!(w.begin_encounter(0));
    for _ in 0..200 {
        w.advance();
        if w.encounters.first().is_some_and(|p| p.talking) { return; }
    }
    panic!("pair never started chatting");
}

#[test]
fn social_approach_then_mutual_gain_and_cooldown() {
    let mut w = open_world();
    assert!(w.begin_encounter(0));
    w.advance();
    assert!(w.villagers.iter().all(|v| v.needs.social < 0.4));
    assert_eq!(w.activity_label(&w.villagers[1]), "Waiting for Ash");
    for _ in 0..199 { if w.encounters[0].talking { break; } w.advance(); }
    assert!(w.encounters[0].talking);
    let positions: Vec<_> = w.villagers.iter().map(|v| v.pos).collect();
    let before: Vec<_> = w.villagers.iter().map(|v| v.needs.social).collect();
    for _ in 0..120 { w.advance(); }
    assert!(w.encounters.is_empty());
    for (i,v) in w.villagers.iter().enumerate() {
        assert_eq!(v.pos, positions[i]);
        assert!((v.needs.social - before[i] - (0.30 - 120.0 * super::super::needs::SOCIAL_DECAY)).abs() < 0.00002);
        assert_eq!(w.behavior[&v.id].cooldown, 400);
        assert_eq!(v.state, AgentState::Idle);
    }
}

#[test]
fn social_pair_is_exclusive_and_player_order_releases_both() {
    let mut w = open_world();
    reach_chat(&mut w);
    assert!(!w.begin_encounter(1));
    let id = w.villagers[0].id;
    w.order_move_villager(10, 2, Some(id)).unwrap();
    assert!(w.encounters.is_empty());
    assert!(matches!(w.villagers[0].state, AgentState::MovingTo { purpose: MovePurpose::PlayerOrder, .. }));
    assert_eq!(w.villagers[1].state, AgentState::Idle);
    assert!(!w.social_eligible(1));
}

#[test]
fn social_urgent_need_death_and_blocked_meeting_cancel_without_reward() {
    for reason in 0..3 {
        let mut w = open_world();
        assert!(w.begin_encounter(0));
        match reason {
            0 => w.villagers[0].needs.energy = 0.25,
            1 => { w.villagers.remove(0); },
            _ => { let (x,y) = w.encounters[0].meeting; w.tiles[y as usize * 32 + x as usize] = Terrain::DeepWater as u8; },
        }
        w.advance();
        assert!(w.encounters.is_empty());
        assert!(w.villagers.iter().all(|v| v.needs.social <= 0.4));
        assert!(w.villagers.iter().all(|v| v.current_action != Some(ActionKind::Socialize)));
    }
}

#[test]
fn social_failed_approach_times_out_and_busy_partners_are_ignored() {
    let mut w = open_world();
    w.villagers[1].state = AgentState::Sleeping { ticks_remaining: 100 };
    assert!(!w.begin_encounter(0));
    w.villagers[1].state = AgentState::Idle;
    assert!(w.begin_encounter(0));
    for _ in 0..200 { w.tick_encounters(); }
    assert!(w.encounters.is_empty());
    assert_eq!(w.behavior[&w.villagers[0].id].cooldown, 100);
    assert_eq!(w.villagers[0].needs.social, 0.4);
}

#[test]
fn social_unreachable_partner_does_not_block_reachable_one() {
    let mut w = open_world();
    w.villagers[1].pos = w.tile_center(4, 2);
    for (x,y) in [(3,2),(5,2),(4,1),(4,3)] { w.tiles[y * 32 + x] = Terrain::DeepWater as u8; }
    let id = w.next_villager_id;
    w.next_villager_id += 1;
    w.villagers.push(Villager::new(id, "Test", w.tile_center(2, 6)));
    assert!(w.begin_encounter(0));
    assert_eq!(w.encounters[0].b, id);
}

#[test]
fn social_save_continues_approach_chat_and_cooldown_identically() {
    for ticks in [0, 50, 180] {
        let mut w = open_world();
        assert!(w.begin_encounter(0));
        for _ in 0..ticks { w.advance(); }
        let saved = crate::persist::encode_world(&w).unwrap();
        let mut loaded = crate::persist::decode_world(&saved).unwrap();
        assert_eq!(saved, crate::persist::encode_world(&loaded).unwrap());
        for _ in 0..250 { w.advance(); loaded.advance(); }
        assert_eq!(crate::persist::encode_world(&w).unwrap(), crate::persist::encode_world(&loaded).unwrap());
    }
}

#[test]
fn social_v3_fixture_preserves_satisfaction_and_migrates_legacy_action() {
    let w = crate::persist::decode_world(include_bytes!("../../tests/fixtures/social-v3.bin")).unwrap();
    assert_eq!(w.villagers[0].needs.social, 0.4);
    assert_eq!(w.villagers[0].state, AgentState::Idle);
    assert_eq!(w.villagers[0].current_action, None);
    assert!(w.encounters.is_empty());
    assert_eq!(w.world_init(4).save_version, 4);
}

#[test]
fn social_invalid_save_pair_is_rejected() {
    let mut w = open_world();
    assert!(w.begin_encounter(0));
    w.encounters[0].b = w.encounters[0].a;
    let bytes = crate::persist::encode_world(&w).unwrap();
    assert!(crate::persist::decode_world(&bytes).unwrap_err().contains("invalid social encounter"));
}

#[test]
fn leisure_density_counts_only_completed_reachable_huts_and_caps() {
    let mut w = open_world();
    complete(&mut w, "hut", 10, 10);
    assert_eq!(w.hut_density((9,10)), 1);
    let incomplete = w.place_building("hut", 14, 10, 0).unwrap().id;
    w.refresh_leisure_cache();
    assert_eq!(w.hut_density((9,10)), 1);
    for x in 0..32 { w.tiles[8 * 32 + x] = Terrain::DeepWater as u8; }
    w.leisure_cache = Default::default();
    w.refresh_leisure_cache();
    assert_eq!(w.hut_density((10,7)), 0);
    w.demolish(incomplete).unwrap();
    for (x,y) in [(14,10),(10,14),(14,14),(6,10),(6,14)] { complete(&mut w,"hut",x,y); }
    assert_eq!(w.hut_density((12,12)), 5);
}

#[test]
fn leisure_destination_is_reserved_committed_and_demolition_invalidates() {
    let mut w = open_world();
    let hut = complete(&mut w,"hut",8,8);
    for v in &mut w.villagers { v.needs.social = 1.0; }
    w.begin_leisure(0); w.begin_leisure(1);
    let first = w.behavior[&w.villagers[0].id].destination;
    assert!(first.is_some());
    assert_ne!(first, w.behavior[&w.villagers[1].id].destination);
    w.advance();
    assert_eq!(first,w.behavior[&w.villagers[0].id].destination);
    w.demolish(hut).unwrap();
    w.prepare_behavior_tick();
    assert!(w.behavior.values().all(|b| b.destination.is_none()));
}

#[test]
fn leisure_arrival_pauses_and_then_avoids_previous_destination() {
    let mut w = open_world();
    complete(&mut w,"well",7,7);
    w.villagers.truncate(1);
    w.villagers[0].needs.social = 1.0;
    w.begin_leisure(0);
    for _ in 0..200 { if w.behavior[&w.villagers[0].id].pause > 0 { break; } w.advance(); }
    let id = w.villagers[0].id;
    assert_eq!(w.behavior[&id].pause,80);
    let old = w.behavior[&id].destination;
    let pos = w.villagers[0].pos;
    for _ in 0..79 { w.advance(); assert_eq!(w.villagers[0].pos,pos); }
    w.advance();
    assert_ne!(w.behavior[&id].destination,old);
}

#[test]
fn leisure_yields_to_work_and_social_does_not_interrupt_workers() {
    let mut w = open_world();
    w.villagers[0].needs.social = 1.0;
    w.begin_leisure(0);
    w.resources.grain = 20;
    let farm = complete(&mut w,"farm",9,9);
    w.advance();
    assert!(w.villagers[0].current_job.is_some());
    assert!(!w.social_eligible(0));
    assert_eq!(w.behavior[&w.villagers[0].id].destination,None);
    for _ in 0..300 { w.advance(); }
    assert!(w.crops.iter().any(|c| w.buildings.iter().find(|b| b.id == farm).is_some_and(|b| c.tile.0 >= b.origin.0 && c.tile.1 >= b.origin.1)));
}

#[test]
fn social_clustered_huts_increase_participation_across_seeds() {
    let mut totals = [0_u64; 2];
    for seed in [7, 42, 123] {
        for (layout, total) in totals.iter_mut().enumerate() {
            let mut w = open_world();
            w.seed = seed;
            w.villagers = (0..6).map(|i| {
                let mut v = Villager::new(i + 1, format!("V{i}"), w.tile_center(2 + (i % 2) as i32 * 3, 2 + (i / 2) as i32 * 3));
                v.needs.social = 0.4;
                v
            }).collect();
            w.next_villager_id = 7;
            let positions = if layout == 0 { [(10,10),(13,10),(10,13),(13,13)] }
                else { [(4,20),(20,4),(20,20),(26,26)] };
            for (x,y) in positions { complete(&mut w,"hut",x,y); }
            // Freeze births, while retaining identical six-villager populations and needs.
            for tick in 0..4000 {
                w.clock.advance_tick();
                for v in &mut w.villagers { v.needs.tick_decay(); }
                w.prepare_behavior_tick();
                for i in 0..w.villagers.len() { w.tick_villager_at(i); }
                w.tick_encounters();
                let talking = w.encounters.iter().filter(|p| p.talking).count();
                if tick < 1200 { *total += talking as u64; }
                assert!(w.encounters.iter().all(|p| p.remaining > 0));
                w.validate_behavior().unwrap();
            }
        }
    }
    assert!(totals[1] > 0, "scattered housing must still allow conversation");
    assert!(totals[0] > totals[1], "clustered versus scattered talking ticks: {totals:?}");
}

