use super::*;
use crate::sim::visitors::{ActiveVisit, VisitDecision, VisitOutcome, VisitorKind, VisitorView};

impl World {
    /// Opportunity timing follows elapsed simulation ticks. Debug jumps stamp each
    /// transition before the destination day's weather, season entry and autosave.
    pub(crate) fn advance_visitors(&mut self, ticks: u32, jump: bool) {
        for event in self.visits.advance(ticks) {
            let mut clock = self.clock.clone();
            if jump && event.offset == ticks {
                clock.force_day_rollover();
            }
            self.chronicle.push(
                &clock,
                None,
                ChronicleBody::VisitorEvent {
                    visitor: event.visit.visitor,
                    name: event.visit.visitor.definition().name.clone(),
                    outcome: event.outcome,
                },
            );
        }
    }

    /// Existing residents keep their beds. Find the first vacant completed home
    /// connected to the village, then a distinct, unoccupied spawn in that region.
    fn visitor_home(&self) -> Option<(u32, (i32, i32))> {
        let anchor = self
            .villagers
            .iter()
            .min_by_key(|v| v.id)
            .map(|v| self.pos_to_tile(v.pos))
            .or_else(|| self.stockpile_stand())?;
        let mut homes: Vec<_> = self
            .buildings
            .iter()
            .filter(|b| self.home_capacity_of(b) > 0)
            .collect();
        homes.sort_by_key(|b| b.id);
        let used: Vec<_> = self
            .villagers
            .iter()
            .map(|v| self.pos_to_tile(v.pos))
            .collect();
        for home in homes {
            if self.home_residents(home.id).len() as u32 >= self.home_capacity_of(home) {
                continue;
            }
            let Some(stand) = self.home_stand_tile(home.id) else {
                continue;
            };
            if self.compute_path(anchor, stand).is_none() {
                continue;
            }
            let region = self.reachable_from(stand);
            if let Some(tile) = self.find_spawn_tile(stand.0, stand.1, &used, Some(&region)) {
                return Some((home.id, tile));
            }
        }
        None
    }

    fn visitor_unavailable_reason(&self, visit: ActiveVisit) -> Option<String> {
        match visit.visitor {
            VisitorKind::Merchant | VisitorKind::Musician => {
                let cost = &visit.visitor.definition().cost;
                (!self.derived_resources().can_afford(cost))
                    .then(|| format!("Requires {} food", cost["food"]))
            }
            VisitorKind::Grower => {
                if self.villagers.len() as u32 >= self.housing_capacity() {
                    Some(
                        "Requires spare population capacity and a vacant bed in completed housing"
                            .into(),
                    )
                } else if self.next_villager_id == u32::MAX || self.visits.grower_settled {
                    Some("This resident cannot join the village".into())
                } else if self.visitor_home().is_none() {
                    Some("Requires a vacant bed in completed, reachable housing and a free arrival tile".into())
                } else {
                    None
                }
            }
        }
    }

    pub(crate) fn visitor_view(&self) -> Option<VisitorView> {
        let visit = self.visits.active?;
        let def = visit.visitor.definition();
        let unavailable_reason = self.visitor_unavailable_reason(visit);
        Some(VisitorView {
            visit_id: visit.id,
            visitor: visit.visitor,
            name: def.name.clone(),
            title: def.title.clone(),
            introduction: def.introduction.clone(),
            cost: def.cost.clone(),
            reward: def.reward.clone(),
            remaining_minutes: (self.visits.remaining_ticks * 60).div_ceil(1000),
            can_accept: unavailable_reason.is_none(),
            unavailable_reason,
        })
    }

    pub(crate) fn respond_to_visitor(
        &mut self,
        visit_id: u32,
        decision: VisitDecision,
    ) -> Result<(), String> {
        let visit = self
            .visits
            .active
            .filter(|v| v.id == visit_id)
            .ok_or_else(|| "This visitor's offer is no longer available".to_string())?;
        let mut focus = None;
        let outcome = match decision {
            VisitDecision::Decline => VisitOutcome::Declined,
            VisitDecision::Accept => {
                if let Some(reason) = self.visitor_unavailable_reason(visit) {
                    return Err(reason);
                }
                match visit.visitor {
                    VisitorKind::Merchant => {
                        self.withdraw_cost(&visit.visitor.definition().cost)?;
                        self.deposit_to_stockpile("grain", 8);
                    }
                    VisitorKind::Musician => {
                        self.withdraw_cost(&visit.visitor.definition().cost)?;
                        for villager in &mut self.villagers {
                            villager.needs.social = (villager.needs.social + 0.20).min(1.0);
                            villager.needs.recompute_happiness();
                        }
                    }
                    VisitorKind::Grower => {
                        let (home, tile) = self
                            .visitor_home()
                            .ok_or("No reachable housing or arrival tile")?;
                        let mut villager = Villager::new(
                            self.next_villager_id,
                            visit.visitor.definition().name.clone(),
                            self.tile_center(tile.0, tile.1),
                        )
                        .with_traits(vec!["green_thumb".into()]);
                        villager.home = Some(home);
                        self.next_villager_id += 1;
                        self.villagers.push(villager);
                        self.visits.grower_settled = true;
                        focus = Some(tile);
                    }
                }
                VisitOutcome::Accepted
            }
        };
        self.visits.finish();
        self.chronicle.push(
            &self.clock,
            focus,
            ChronicleBody::VisitorEvent {
                visitor: visit.visitor,
                name: visit.visitor.definition().name.clone(),
                outcome,
            },
        );
        self.check_unlocks();
        self.check_objectives();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::sim::visitors::Visits;

    fn world() -> World {
        let mut w = World::generate(16, 16, 32, 42);
        w.tiles.fill(Terrain::Grass as u8);
        w.nodes.clear();
        for (i, v) in w.villagers.iter_mut().enumerate() {
            v.pos = ((8 + i) as f32 * 32.0 + 16.0, 8.0 * 32.0 + 16.0);
        }
        w
    }
    fn arrive(w: &mut World, kind: VisitorKind) -> u32 {
        w.visits = Visits::default();
        w.visits.next_index = kind as u8;
        w.advance_visitors(1000, false);
        w.visits.active.unwrap().id
    }
    fn hut(w: &mut World, x: i32, y: i32) -> u32 {
        w.resources.wood += 20;
        let id = w.place_building("hut", x, y, 0).unwrap().id;
        w.buildings.iter_mut().find(|b| b.id == id).unwrap().state = BuildState::Complete;
        id
    }
    #[test]
    fn trade_rechecks_food_and_rejects_duplicate_or_stale_responses() {
        let mut w = world();
        let id = arrive(&mut w, VisitorKind::Merchant);
        w.resources.food = 11;
        assert!(!w.visitor_view().unwrap().can_accept);
        let before = crate::persist::encode_world(&w).unwrap();
        assert!(w.respond_to_visitor(id, VisitDecision::Accept).is_err());
        assert_eq!(before, crate::persist::encode_world(&w).unwrap());
        w.resources.food = 20;
        let grain = w.resources.grain;
        w.respond_to_visitor(id, VisitDecision::Accept).unwrap();
        assert_eq!(w.resources.food, 8);
        assert_eq!(w.resources.grain, grain + 8);
        let after = crate::persist::encode_world(&w).unwrap();
        assert!(w.respond_to_visitor(id, VisitDecision::Accept).is_err());
        assert_eq!(after, crate::persist::encode_world(&w).unwrap());
        w.advance_visitors(6000, false);
        assert!(w.respond_to_visitor(id, VisitDecision::Decline).is_err());
    }
    #[test]
    fn musician_restores_social_and_happiness_up_to_full() {
        let mut w = world();
        let id = arrive(&mut w, VisitorKind::Musician);
        w.resources.food = 6;
        w.villagers[0].needs.social = 0.3;
        w.villagers[1].needs.social = 0.95;
        w.respond_to_visitor(id, VisitDecision::Accept).unwrap();
        assert_eq!(w.resources.food, 0);
        assert!((w.villagers[0].needs.social - 0.5).abs() < 0.00001);
        assert_eq!(w.villagers[1].needs.social, 1.0);
        assert_eq!(w.villagers[0].needs.happiness, 0.875);
    }
    #[test]
    fn trade_spends_food_in_storage() {
        let mut w = world();
        let granary = w.place_building("granary", 2, 2, 0).unwrap().id;
        w.resources.food = 2;
        inventory_add(
            &mut w
                .buildings
                .iter_mut()
                .find(|b| b.id == granary)
                .unwrap()
                .inventory,
            "food",
            10,
        );
        let id = arrive(&mut w, VisitorKind::Merchant);
        w.respond_to_visitor(id, VisitDecision::Accept).unwrap();
        assert_eq!(w.derived_resources().food, 0);
        assert_eq!(w.resources.grain, 8);
    }
    #[test]
    fn grower_requires_real_completed_housing_and_gets_a_unique_home_and_spawn() {
        let mut w = world();
        let id = arrive(&mut w, VisitorKind::Grower);
        assert!(w.respond_to_visitor(id, VisitDecision::Accept).is_err());
        hut(&mut w, 2, 2);
        hut(&mut w, 4, 2);
        let home = hut(&mut w, 6, 2);
        w.assign_homes();
        let used: Vec<_> = w.villagers.iter().map(|v| w.pos_to_tile(v.pos)).collect();
        let next = w.next_villager_id;
        assert!(w.visitor_view().unwrap().can_accept);
        w.respond_to_visitor(id, VisitDecision::Accept).unwrap();
        let v = w.villagers.last().unwrap();
        assert_eq!(v.id, next);
        assert_eq!(v.name, "Mira");
        assert_eq!(v.traits, vec!["green_thumb"]);
        assert_eq!(v.home, Some(home));
        assert!(!used.contains(&w.pos_to_tile(v.pos)));
        assert!(w.visits.grower_settled);
        assert!(w.respond_to_visitor(id, VisitDecision::Accept).is_err());
        assert_eq!(w.villagers.len(), 6);
        let bytes = crate::persist::encode_world(&w).unwrap();
        let mut loaded = crate::persist::decode_world(&bytes).unwrap();
        assert_eq!(crate::persist::encode_world(&loaded).unwrap(), bytes);
        assert!(loaded.visits.grower_settled);
        loaded.advance_visitors(6000, false);
        assert_eq!(loaded.visits.active.unwrap().visitor, VisitorKind::Merchant);
    }
    #[test]
    fn demolition_storm_full_and_unreachable_housing_reject_recruitment() {
        let mut w = world();
        let id = arrive(&mut w, VisitorKind::Grower);
        hut(&mut w, 2, 2);
        hut(&mut w, 4, 2);
        let home = hut(&mut w, 6, 2);
        w.assign_homes();
        w.buildings.iter_mut().find(|b| b.id == home).unwrap().state =
            BuildState::UnderConstruction { progress_ticks: 0 };
        assert!(w.respond_to_visitor(id, VisitDecision::Accept).is_err());
        w.buildings.iter_mut().find(|b| b.id == home).unwrap().state = BuildState::Complete;
        // Isolate the home from the village, leaving its first stand tile free.
        for y in 0..16 {
            w.tiles[y * 16 + 7] = Terrain::DeepWater as u8;
        }
        assert!(w.respond_to_visitor(id, VisitDecision::Accept).is_err());
        w.tiles.fill(Terrain::Grass as u8);
        w.demolish(home).unwrap();
        assert!(w.respond_to_visitor(id, VisitDecision::Accept).is_err());
        assert_eq!(w.villagers.len(), 5);
    }
    #[test]
    fn a_vacant_bed_without_an_unoccupied_arrival_tile_cannot_recruit() {
        let mut w = world();
        let id = arrive(&mut w, VisitorKind::Grower);
        hut(&mut w, 2, 2);
        hut(&mut w, 4, 2);
        hut(&mut w, 6, 2);
        w.assign_homes();
        w.tiles.fill(Terrain::DeepWater as u8);
        for i in 0..5 {
            w.tiles[2 * 16 + 7 + i] = Terrain::Grass as u8;
            w.villagers[i].pos = w.tile_center(7 + i as i32, 2);
        }
        assert!(!w.visitor_view().unwrap().can_accept);
        let before = crate::persist::encode_world(&w).unwrap();
        assert!(w.respond_to_visitor(id, VisitDecision::Accept).is_err());
        assert_eq!(before, crate::persist::encode_world(&w).unwrap());
    }

    #[test]
    fn births_leave_one_population_slot_during_grower_visit() {
        let mut w = world();
        let id = arrive(&mut w, VisitorKind::Grower);
        hut(&mut w, 2, 2);
        w.clock.tick = 200;
        w.check_population_dynamics();
        assert_eq!(w.villagers.len(), 6); // capacity 7 minus one visitor slot
        w.clock.tick = 400;
        w.check_population_dynamics();
        assert_eq!(w.villagers.len(), 6);
        w.respond_to_visitor(id, VisitDecision::Decline).unwrap();
        w.clock.tick = 600;
        w.check_population_dynamics();
        assert_eq!(w.villagers.len(), 7);
    }
    #[test]
    fn debug_jumps_do_not_count_fractional_minutes_twice() {
        for ticks in [1, 16, 999] {
            let mut direct = world();
            direct.advance_clock(1, None).unwrap();
            let mut partial = world();
            for _ in 0..ticks {
                partial.clock.advance_tick();
                partial.advance_visitors(1, false);
            }
            partial.advance_clock(1, None).unwrap();
            assert_eq!(partial.visits, direct.visits, "jump at tick {ticks}");
        }
    }

    #[test]
    fn jump_visits_are_chronological_and_not_viewport_culled() {
        let mut w = world();
        w.advance_clock(1, None).unwrap();
        assert!(w.visitor_view().is_none());
        let events: Vec<_> = w
            .chronicle
            .entries()
            .filter(|e| matches!(e.body, ChronicleBody::VisitorEvent { .. }))
            .collect();
        assert_eq!(events.len(), 6);
        assert!(events.iter().all(|e| e.day == 1));
        w.advance_visitors(w.visits.remaining_ticks, false);
        w.viewport = Viewport {
            x: -1000.0,
            y: -1000.0,
            w: 1.0,
            h: 1.0,
        };
        assert!(w.tick_snapshot().visitor.is_some());
    }
}
