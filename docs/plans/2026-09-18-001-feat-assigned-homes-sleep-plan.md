---
title: "Assigned Homes Sleep Journey - Plan"
type: feat
date: 2026-09-18
topic: assigned-homes-sleep
artifact_contract: ce-unified-plan/v1
artifact_readiness: requirements-only
product_contract_source: ce-brainstorm
execution: code
---

# Assigned Homes Sleep Journey - Plan

## Goal Capsule

- **Objective:** Give each villager a lasting hut home so that when Sleep wins on the existing Energy need, housed villagers walk home, rest there, and leave when rested — with auto bed fill and player reassignment.
- **Product authority:** This plan owns residence assignment and the Sleep-at-home journey only. Ideation follow-ons (household births, leisure preference for own hut, chronicle family arcs, soft nap-without-residence, interior bed props) are not active scope.
- **Open blockers:** None. Remaining forks are deferred to planning.

## Product Contract

### Summary

Villagers hold a home on a completed hut. Beds auto-fill from hut housing capacity; the player can reassign later. When Sleep wins utility and the villager has a home, they path there, sleep, then emerge. Without a home, Sleep behaves as today (in place). Success is regular exhaustion visits home.

### Problem Frame

Huts already add to Pop capacity and attract leisure, but Sleep restores energy wherever the villager stands. Huts read as capacity widgets; rest has no address. Players need to see exhausted villagers go home and leave when rested.

### Key Decisions

- **Residence + Sleep journey, not soft nearest-hut naps or interior beds.** Specific homes without furniture systems. (session-settled: user-directed — chosen over soft naps / bed props: matches "places they live" without new placeables.) Governs R1, R4, R5.
- **Hybrid assignment: auto-fill beds, player can reassign.** (session-settled: user-directed — chosen over auto-only or player-only: less micromanagement, still controllable.) Governs R2, R3.
- **Homeless Sleep stays in place.** Homes upgrade rest; they do not hard-gate Sleep. (session-settled: user-directed — chosen over restless/no-Sleep or temporary guest beds: preserves today's loop when beds are full or a hut is gone.) Governs R6.
- **Exhaustion = existing Energy / Sleep utility.** No new exhaustion meter. (session-settled: user-directed — chosen over a dedicated home-only threshold: reuse the decision players already see.) Governs R4.
- **Bed count follows existing per-hut `houses` capacity.** Default affirmed at synthesis confirm. Governs R2.
- **Player reassignment ships in this pass** as a light hut/villager action, not a full household manager. Affirmed at synthesis confirm. Governs R3.

### Actors

- **Player** — places/demolishes huts, optionally reassigns who lives where, watches Sleep journeys.
- **Villager (sim)** — holds at most one home; when Sleep wins and housed, travels home, rests, then resumes normal AI.
- **Hut (completed building with housing capacity)** — provides a fixed number of resident beds.

### Key Flows

**F1. Auto home claim**
1. A villager needs a home (spawn, birth, or lost previous home) and a completed hut has a free bed.
2. The sim assigns that hut as their home.
3. Player-visible residence is queryable (panel/inspection).

**F2. Exhaustion Sleep at home**
1. Sleep wins utility (existing Energy scoring).
2. If the villager has a reachable home, they path to it, enter Sleeping there, restore Energy, then leave and become Idle (or resume normal decisioning).
3. If they have no home, or home is unreachable / invalid, they Sleep in place as today (R6).

**F3. Player reassignment**
1. Player selects a villager or hut and chooses a valid completed hut with capacity (or free a bed by moving someone).
2. The villager's home updates immediately for future Sleep journeys.
3. Mid-journey Sleep toward an old home repaths or falls back per planning; product intent: new home applies as soon as practical without trapping the villager.

**F4. Home lost**
1. Home hut is demolished or otherwise ceases to be a valid completed residence.
2. Villager becomes homeless; next Sleep uses R6 until reassigned (auto or player).

### Requirements

**Residence**

- R1. Each villager may hold at most one home, referring to a completed hut that provides housing.
- R2. Free beds on completed huts auto-fill for villagers who need a home, using the same per-hut housing capacity already used for population (`houses` on the hut definition; currently 2 per hut).
- R3. The player can reassign a villager's home among valid completed huts without a full household-management screen — a light selection/action on villager or hut is enough.

**Sleep journey**

- R4. When Sleep wins on the existing Energy/Sleep utility and the villager has a valid home, they travel to that home before entering the Sleeping rest state.
- R5. After resting at home completes, the villager leaves the home location and returns to normal decisioning (emerge), so rest is visibly tied to the dwelling.
- R6. When the villager has no home, or their home is missing/unreachable for that Sleep attempt, Sleep proceeds in place as it does today.

**Persistence & parity**

- R7. Home assignment persists across save/load with the world.
- R8. Browser-demo behavior matches the desktop rules for home assignment and Sleep-at-home for the villagers the demo simulates (demo still need not implement births/deaths).

### Acceptance Examples

- AE1. Covers R4, R5. Given a villager with a home and low Energy so Sleep wins, when they act, they path to their hut, show Sleeping there, then leave afterward.
- AE2. Covers R6. Given a villager with no home and Sleep winning, when they act, they Sleep where they stand without requiring a hut.
- AE3. Covers R2. Given a free bed on a completed hut and a homeless villager, when auto-assignment runs, that villager's home becomes that hut and bed count used does not exceed the hut's `houses` capacity.
- AE4. Covers R3. Given a player reassignment to another completed hut with space, when the next Sleep wins, the villager paths to the new home.
- AE5. Covers R6, F4. Given a villager whose home hut is demolished, when Sleep next wins, they Sleep in place until they receive a new home.
- AE6. Covers R7. Given assigned homes, when the player saves and loads, home assignments are unchanged.

### Success Criteria

- In a normal play session, housed villagers with rising Tiredness/Sleep choice make **regular visible trips to their homes** to rest, then leave — not only Sleeping in fields or worksites.
- Homeless or oversubscribed villagers still recover Energy via in-place Sleep so the village does not soft-lock.

### Scope Boundaries

**Deferred for later**

- Births requiring an empty household slot
- Leisure preference for own hut
- Chronicle / family naming of households
- Housed-happiness modifiers while sleeping at home
- Interior bed props / furniture
- Soft "nap at nearest hut" without lasting residence

**Outside this pass**

- New exhaustion meter separate from Energy/Sleep
- Full household manager UI
- Raids, visitors, or trade systems

### Dependencies / Assumptions

- Hut buildings already expose housing capacity via catalog `houses` (verified: hut `houses: 2`; capacity = base 5 + sum of completed `houses`).
- Design spec already sketches `home: Option<BuildingId>` though the live agent struct does not store it yet.
- M11 deferred assigned homes and walk-home-to-sleep; this plan picks that deferred work back up.
- Leisure hut-perimeter destinations remain separate from residence Sleep destinations.

### Outstanding Questions

**Resolve Before Planning**

- None.

**Deferred to Planning**

- Exact player reassignment affordance (villager panel vs hut selection vs both) within the "light UI" bar of R3.
- Precise stand/sleep tile relative to the hut footprint (perimeter vs interior tile) while preserving emerge readability.
- Behavior when the path to home is blocked mid-journey (repath, cancel to in-place Sleep, or Idle).
- Save-format / migration details for adding home on villagers.

### Sources / Research

- `docs/villagesim-spec.md` — villager `home: Option<BuildingId>` in design sketch; Sleep utility on Energy.
- `docs/superpowers/plans/2026-09-13-socializing-and-purposeful-movement.md` — homes/sleep destinations deferred.
- `src-tauri/src/sim/agents.rs` — live `Villager` has no `home` field; Sleep starts in place.
- `src-tauri/src/sim/world.rs` — `housing_capacity()`, Sleep tick restores Energy without travel.
- `src-tauri/data/buildings.json` — hut `houses: 2`.
- `src-tauri/src/sim/leisure.rs` — completed hut/well leisure perimeters (adjacent, not residence).
- Ideation seed: `docs/ideation/2026-09-18-villagesim-feature-additions-ideation.html` (idea 3, narrowed in brainstorm).
