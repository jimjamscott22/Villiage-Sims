# Socializing and Purposeful Movement Implementation Plan

Status: implemented 2026-09-13; full verification deferred by user request.

**Goal:** Villagers visibly meet and talk, restore their existing Social satisfaction, and spend free time visiting useful neighborhood destinations.

**Architecture:** Rust remains authoritative. A small social module coordinates pairs once per world tick; a leisure module selects reachable destinations near completed huts and wells. The browser demo mirrors these rules, while the renderer displays the resulting activity.

**Tech stack:** Existing Rust simulation, serde/bincode saves, TypeScript browser demo, React and Canvas UI, Rust tests and Vitest. No new dependencies.

**Design basis:** The conversation's approved direction: mutual conversations, hut density encouraging meetings, purposeful leisure movement, and the existing satisfaction meter. Assigned homes and walking home to sleep are deferred.

## Constraints

- Work sequentially in this session. No subagents or subagent-driven development.
- Start implementation only after approval of this plan. Implement directly, then add focused verification; no test-first loops.
- Preserve unrelated untracked `.claude/settings.local.json`, `.codex/`, and `.idea/` content.
- Keep Social stored as 0–1 and presented through the existing meter. No XP, new social skill, or friendship graph.
- Retain current happiness calculation and normal Social decay.
- Keep building catalog order and existing snapshot state codes stable.
- Keep terrain out of tick snapshots; do not add art assets or an unrelated UI redesign.
- Keep new behavior in focused modules rather than expanding the large world files unnecessarily.
- Preserve current hunger rescue, hauling cargo, job claims, and explicit move-order behavior.
- Use simulation ticks for all timers. Pause freezes behavior; speed changes scale it naturally.
- Preserve version-3 save loading. New persisted behavior requires an explicit versioned migration, not serde defaults over an incompatible bincode layout.

## Behavior specification

### Mutual conversations

1. At a decision opportunity, a villager with unmet Social may choose a nearby eligible partner. Eligibility is checked for both participants before either is reserved.
2. Eligible activities are idle and autonomous leisure movement or leisure pauses. Do not recruit from working, work travel, hauling, eating, sleeping, player-directed travel, or another conversation.
3. Both must have Hunger and Energy above 0.25 and be outside the social cooldown. The initiator must have Social below 0.85; the partner may have a fuller meter.
4. Search locally within eight tiles. Choose by reachable path length, then stable villager ID. Try another candidate when the nearest cannot be reached.
5. Reserve both villagers atomically by durable IDs. One waits while the initiator walks to a free cardinally adjacent tile. Both stand on distinct tile centers before talking begins.
6. Approach times out after 200 ticks (10 seconds at 1x). The waiting villager cannot be recruited by someone else. Do not pursue a moving target indefinitely.
7. A conversation lasts 120 ticks (6 seconds at 1x). Both gain a total of up to 0.30 Social over the duration, clamped to 1.0, with normal decay continuing. No gain while approaching or waiting.
8. Apply restoration once per pair per tick. Accumulate no completion bonus. Partial conversation gains remain if interrupted.
9. After finishing, both receive a 400-tick cooldown (20 seconds at 1x). Failed approaches receive a shorter 100-tick retry cooldown to prevent repeated pursuit.
10. New player orders, either participant reaching Hunger or Energy <= 0.25, death, invalid pairing, or loss of a usable meeting tile end the encounter for both. The ordered villager follows the order; the other returns to normal decision-making. Existing emergency hunger handling takes precedence.

Initial timing and thresholds are tuning defaults, not permanent balance promises.

### Hut density and choice of activity

- A gathering destination is a free walkable tile on the perimeter of a completed hut or well. Wells need no new catalog behavior.
- Count completed hut footprints within Chebyshev distance eight of the candidate tile. Each hut counts once; huts under construction do not count. Count only huts with a reachable perimeter from that destination, so a disconnected cluster does not provide a bonus.
- Use the same capped neighborhood bonus for selecting leisure destinations and evaluating an available conversation:

```text
density = min(reachable_completed_huts, 5)
social_score = clamp((1 - social)^1.5 * (1 + 0.10 * density), 0, 1)
destination_score = (1 + 0.15 * density) / (1 + 0.10 * path_length)
```

- Social score is zero without a valid available partner or during cooldown. The initiator threshold prevents repeated chats at a full meter.
- Huts affect opportunities and willingness to meet. They never award passive Social points or increase restoration per conversation.
- Retain utility competition with ordinary needs and work. Conversations start during free time, so dense housing cannot pull workers off every job.
- No huts are required for a nearby spontaneous conversation.

### Purposeful leisure movement

- Replace the normal random-wander fallback with a visit to a reachable nearby hut/well perimeter tile, followed by an 80-tick pause (4 seconds at 1x).
- Search destinations within 16 tiles. Rank a bounded shortlist deterministically; route-check up to eight candidates. Avoid the previous destination when another valid candidate exists.
- Distribute candidates using a stable mix of seed, villager ID, and visit count before stable score tie-breaking. Do not send everyone to the first catalog entry.
- Reserve leisure destination tiles and conversation meeting tiles against other leisure reservations; use distinct perimeter tiles and keep at least one access tile available. This does not introduce general collision avoidance for work paths.
- Commit to the chosen route. Reconsider on arrival, invalid destination, player order, urgent need, or an eligible conversation. Check newly available work at the existing decision cadence during leisure travel and pauses; release the leisure reservation when work wins.
- If no building destination is reachable, make a short reachable local stroll with the same arrival pause. Avoid immediate return to the last tile when alternatives exist. If no route exists, idle with the existing retry cooldown.
- Demolition, new construction, and storm damage invalidate affected destinations. Release reservations and select a replacement at the next decision opportunity.
- Defer home assignments, sleep destinations, meal destinations, schedules, new traits, group chats, and relationships.

## Sequential implementation tasks

### 1. Establish saved-state compatibility and behavior data

Files: `src-tauri/src/persist.rs`, new `src-tauri/src/sim/legacy_v3.rs`, `src-tauri/src/sim/agents.rs`, `src-tauri/src/sim/world.rs`, `src-tauri/src/sim/mod.rs`, new `src-tauri/src/sim/social.rs`.

- [ ] Capture a small version-3 save fixture with the current encoder before changing serialized types. Include a villager in the legacy one-sided Socializing state.
- [ ] Freeze the version-3 World/Villager layouts in the compatibility module. Reuse unchanged supporting types only where their serialized layouts remain identical.
- [ ] Add explicit behavior data: pair participant IDs, phase, meeting tile, remaining duration; per-villager cooldown, leisure destination, previous destination, and visit count. Keep pair ownership in one world-level collection, not independently ticking duplicate records.
- [ ] Append any new enum variants; retain existing numeric snapshot codes. Store approach waiting explicitly so it cannot be mistaken for actual conversation.
- [ ] Write version 4; decode version 3 through its frozen representation. Preserve needs, IDs, buildings, inventories, paths, jobs, clock, objectives, and chronicle. Convert legacy Socializing to Idle without a reward, clearing the stale action and path. Initialize new behavior data empty.
- [ ] Validate loaded pair IDs, uniqueness, meeting positions, phases, and timers. Reject structurally invalid version-4 social data with a clear load error. Rebuild derived destination caches and reservations from persisted intent.
- [ ] Verify the old fixture loads and that a version-4 save round-trips the new fields. No commits or writes to real user save slots are included in this task.

Deliverable: existing villages can load after the state extension, with no social-meter reset.

### 2. Implement paired conversation lifecycle

Files: `src-tauri/src/sim/social.rs`, `src-tauri/src/sim/agents.rs`, `src-tauri/src/sim/utility.rs`, `src-tauri/src/sim/world.rs`, new `src-tauri/src/sim/social_tests.rs`.

- [ ] Put serializable encounter data and pure scoring/eligibility helpers in `social.rs`. Keep World integration methods in the same module as a focused `impl World`, using narrow crate-visible accessors where needed rather than exposing every field.
- [ ] Add candidate selection, route validation, atomic reservations, waiting/approach transitions, and once-per-world-tick restoration.
- [ ] Run pair updates at a defined point after villager movement. A newly arrived pair starts earning on the following tick, making gains independent of villager vector order.
- [ ] Integrate cancellation with targeted move orders, hunger/energy handling, death, and route invalidation. Release both sides' reservations exactly once.
- [ ] Remove the old proximity-only restore behavior. Preserve the existing Social meter and happiness recomputation through `Needs::add_social`.
- [ ] Add focused scenarios after implementation: mutual gain while stopped; no gain while approaching; unavailable partner; competing initiators; unreachable nearest partner; timeout; player interruption; urgent hunger; death; and no stale reservations.

Deliverable: two available villagers visibly stop together and receive only earned satisfaction.

### 3. Add neighborhood destinations and committed leisure movement

Files: new `src-tauri/src/sim/leisure.rs`, new `src-tauri/src/sim/leisure_tests.rs`, `src-tauri/src/sim/mod.rs`, `src-tauri/src/sim/utility.rs`, `src-tauri/src/sim/world.rs`, `src-tauri/src/sim/agents.rs`.

- [ ] Implement perimeter candidate generation, completed-hut density, ranking, bounded reachability checks, reservation, and destination history.
- [ ] Cache building-derived candidates/density until completion, demolition, occupancy changes, or storm damage invalidates them. Keep caches transient and rebuild after load. Partner availability remains live.
- [ ] Integrate destination travel and arrival pauses into leisure choice. Reuse current path-following and repath logic; keep work and manual movement semantics intact.
- [ ] Allow interruption for work at decision opportunities without reselecting valid leisure routes every tick.
- [ ] Add scenarios for huts versus no huts, density cap, disconnected huts, incomplete huts, equal-population clustered/scattered layouts, destination distribution, recent-destination avoidance, invalidation, and no-destination fallback.
- [ ] Confirm an available reachable job still progresses and cargo remains conserved when new social opportunities appear.

Deliverable: free-time travel has a visible destination and hut clusters produce more social opportunities.

### 4. Mirror behavior in the browser demo and expose activity

Files: new `src/state/demoSocial.ts`, new `src/state/demoLeisure.ts`, `src/state/demoWorld.ts`, `src/state/demoWorld.test.ts`, `src/state/types.ts`, `src-tauri/src/snapshot.rs`, `src-tauri/src/sim/world.rs`, `src/ui/VillagerPanel.tsx`, `src/render/drawEntities.ts`; locate the existing `render_game_to_text` hook for its activity fields.

- [ ] Mirror the Rust constants, ranking rules, tick ordering, pair ownership, and cancellation rules in focused TypeScript modules. Preserve the demo's documented absence of births/deaths.
- [ ] Include new state in in-memory demo save/load. Restore active encounters and cooldowns consistently with Rust.
- [ ] Expose a compact activity kind and partner ID in tick views; resolve partner/destination names for selected-villager detail. Keep existing consumers working when optional detail is absent.
- [ ] Display labels such as `Meeting Ash`, `Waiting for Ash`, `Talking to Ash`, `Heading to the well`, and `Taking a break`.
- [ ] Reuse the existing thought-bubble painter for a small conversation indicator throughout actual talking. Do not rely on the short action-thought TTL to indicate a six-second conversation.
- [ ] Keep the current Social bar, label, and scale. Extend the text smoke hook with activity, partner, destination, and Social where appropriate.
- [ ] Add equivalent deterministic Rust/demo scenarios for pair timing, score changes, cooldowns, density ranking, interruption, and save/load. Compare these feature-specific results without starting a repository-wide parity project.

Deliverable: the browser demo and desktop describe and simulate the same new behavior.

### 5. Verify behavior and finish the handoff

- [ ] Run focused Rust social/leisure/persistence cases and the affected demo tests as each task lands. Tests must check observable behavior rather than repeat the formulas alone.
- [ ] Run final checks once: `cargo test --manifest-path src-tauri/Cargo.toml --lib`, `cargo check --manifest-path src-tauri/Cargo.toml`, `npm test`, `npm run build`, and `git diff --check`.
- [ ] Verify new-save continuation: saving mid-approach, mid-chat, and mid-cooldown then loading must produce the same future social state as an uninterrupted simulation.
- [ ] Run a deterministic multi-villager scenario through enough ticks for repeated chats and completed work. Assert no duplicate participation, permanently waiting villagers, stranded cargo, or indefinite leisure starvation of available work.
- [ ] Use browser-demo `?test=1` with `advanceTime` and `render_game_to_text` to inspect approach, stop, bubbles, Social gain, cooldown, player interruption, and destination invalidation. Check Pause/1x/3x, not just screenshots.
- [ ] Compare clustered and scattered completed huts at equal population, jobs, needs, and seed over multiple deterministic seeds. Dense layouts should produce higher aggregate conversation participation; isolated layouts must still allow chats. Use a controlled initial Social deficit so the starting full meter does not hide the feature.
- [ ] Update `progress.md` and the relevant behavior/persistence notes in `README.md` or `docs/villagesim-spec.md`. Describe the actual tuned constants and version-3 compatibility.
- [ ] Report changes, checks, any pre-existing failures, and desktop-only checks not performed. Do not commit, merge, or push without the user's instruction.

## Efficient execution

- Use this plan as the scope boundary; inspect only affected functions and callers after the initial context pass.
- Keep tool output small and retain a short record of changed paths and passed checks. Avoid repeatedly printing complete world files.
- Implement one task at a time; add its meaningful regression scenarios afterward. Broaden checks once at the end, rerunning only when changes or failures justify it.
- Reuse existing pathfinding, meter UI, bubbles, test fixtures, and save infrastructure. Add no generalized AI framework or new dependency.
- Work without subagents. This avoids duplicating repository context; it is an efficiency strategy, not a guaranteed token reduction or fixed budget.
