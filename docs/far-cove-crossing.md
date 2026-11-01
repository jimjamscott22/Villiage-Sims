# The Far Cove

Design for the next direction of VillageSim. New games are a crossing: five named people start on one beach and win by raising a hall on the opposite shore. Dated 2026-10-03, against `main` after the player retention review.

This replaces the silent six-item objective list for new games. It does not replace [`docs/villagesim-spec.md`](villagesim-spec.md). That spec still owns the simulation architecture. The retention review in [`docs/player-retention-review.html`](player-retention-review.html) is the diagnosis this design answers: the village already runs, and a session ends when the checklist is done.

## 1. Intent

The player has a destination, a series of tasks that spend the systems already in the game, and a result the chronicle can name.

A finished crossing is a win. A party with no founders left is a loss. Wintering on the near shore with thin stores fails that attempt and can be tried again in spring. After either result, the clock keeps running. The island stays playable.

The inspiration is the shape of The Oregon Trail: a named party, ordered landmarks, an outfit before the move, a pace choice, and a diary. The place is this island. The verbs stay placement, hauling, farming, and watching the utility AI. There is no hunting screen, no text-menu journey, and no disease lottery.

## 2. Player fantasy

Spring, year 1. Five villagers stand on a beach with drinking water nearby. A marker sits on the far shore. The land between them is the trail: forest, rock, and water the way the island already generates them, plus one walkable ribbon so the far shore is reachable on every seed.

They build a camp, fill a traveling stockpile, open a pass, and then break camp. The walk eats the food they carried. On the far marker they raise a hall. The chronicle records who arrived.

## 3. Decisions

These are settled for this design.

| Decision | Choice |
|---|---|
| Who travels | The whole party. The near camp is abandoned when they break camp. An expedition that leaves a permanent town behind is a later chapter. |
| When it applies | New games only. Loaded saves from before this design are free villages with no trail and no win to miss. |
| After the hall | Free play. The clock does not stop. The crossing does not start a second time on that world. |
| Win | The cove hall is complete and at least one founder is alive on the cove side of the pass. |
| Permanent loss | Every founder is dead. Children born along the way do not reopen the win. |
| Failed attempt | Winter begins, the party has not broken camp, and stored calories are under the existing winter buffer. Spring offers the march again if a founder is alive. |
| Food rule | Departure food is stockpile food, the same pool meals already use. Grain and flour left in a granary do not count as packed. |
| Gold | Hidden. This crossing does not add a trader. |
| Current objectives | Retired for new games. Their beats (shelter, a farm, a food stockpile) live inside the legs. The mill is no longer a required step. |
| Traits and job assignment | Not required to ship the crossing. The trail makes them worth doing next. |
| Player terraforming | None. The ribbon is cut at generation. |

## 4. The island

The world stays a seeded 128×128 island. Deep water, shallow water, rock, mountain, and building footprints stay impassable. Sand, grass, and forest stay walkable. Generation still uses the radial mask in `src-tauri/src/sim/terrain.rs`.

After that mask is classified, the seed picks one of eight compass directions. Two sites are chosen along that axis:

- **Embark.** The first walkable sand tile inward from the rim that can reach drinking water, with a legal hut footprint beside it. The five founders spawn there, in one connected walkable region, using the same connectivity rule as `spawn_starting_villagers`.
- **Cove.** A grass or sand pad on the opposite ray, inland of the surf, large enough for the hall.

A one-tile ribbon joins them. Impassable tiles on that ribbon are rewritten to grass at generation time, widened where a 1×1 waystation needs a legal pad beside the midpoint. Tiles off the ribbon are left wild. The same seed always produces the same embark, ribbon, pass, and cove.

The pass is the walkable ribbon tile nearest the midpoint. Pathfinding, including player move orders, treats that single tile as blocked until the waystation on its pad is complete. A storm that knocks the waystation back under construction blocks the tile again. Villagers already on the cove side of a re-closed pass stay where they are.

The camera opens on the party.

## 5. The five legs

Each leg completes in order. Completion writes one chronicle entry and a toast. The leg list is the objective panel.

Food numbers below are the departure gate, not a second hunger system. Meals still consume stockpile food through Eat. Hunger decay, thirst, sleep, and health are unchanged.

A season is 28 days (`DAYS_PER_SEASON`). One in-game day is 20 real minutes at 1×. The first winter is therefore several sessions away at 1×, and much sooner if the player leaves the clock at 3×. The legs are the goals inside a session. Winter is the campaign deadline for a party that never leaves.

### Leg 1 — Make camp

A hut is complete on the embark pad, and every living founder can still reach drinking water (shoreline or a completed well).

This is the current opening, pointed at the beach instead of the map center.

### Leg 2 — Pack

The player packs when the stockpile holds at least 50 food and enough wood and stone for the cove hall. The waystation is not part of this check. Pack can happen before or after the pass. Break camp cannot.

Packing writes the chronicle line and does not move resources into a new pool. Food already in the global stockpile is what travels. Food, grain, and flour sitting in building inventories stay in those buildings. Wood and stone in a storehouse stay there too.

The player’s work is the existing haul loop: get meals and building materials out of storage and into the stockpile before they leave. Crops that yield food directly (strawberry, peas, carrot) can fill the 50. The mill and bakery can too. Neither chain is mandatory.

### Leg 3 — Open the pass

The waystation is complete on the generated pad. The pass tile opens.

If a storm later reverts that building, the pass tile closes and the chronicle says the pass closed. Rebuilding opens it again. Leg 3 stays complete only while the waystation is complete. A reopened construction site puts the party back on this leg if they have not yet broken camp.

### Leg 4 — Break camp

The player gives one party order, Break camp, while all of these hold:

- Leg 2’s stockpile check still passes (food at least 50, hall materials present).
- The pass is open.
- At least one founder is alive.

Break camp abandons every building on the embark side of the pass: those buildings stop advertising jobs, and homes in them are cleared. Their inventories remain in the world and are not eaten or spent on the road. Each living founder receives a move order toward the cove pad. Urgent needs can interrupt that order the same way they interrupt a right-click move today. If stockpile food hits zero on the walk, starvation uses the existing health rule.

Starting the march during winter is allowed. Waiting through winter without the buffer is the failed attempt in section 6.

### Leg 5 — Raise the hall

The player places the cove hall on the destination pad and it reaches complete. At least one founder is alive on the cove side of the pass. That is the win. The hall occupies its own pad, and Eat or Sleep may have pulled a founder a few tiles off it, so the win checks the cove side of the ribbon rather than one exact tile.

## 6. Win and loss

**Win.** The cove hall completes with a living founder on the cove side of the pass. The chronicle names the founders still alive and the food, wood, and stone in the stockpile. A banner reads that the cove is theirs. Play continues. No further crossing legs are offered.

**Wintered short.** Winter’s first tick arrives, the party has not broken camp, and stored calories are under the buffer already computed by `winter_warning`: population × 28, counting stockpile food, grain, and flour together. The chronicle records the failed attempt. The autumn warning on day 22 stays the advance notice. Camp buildings, the pass, and a previous Pack line remain. When spring begins, if a founder is alive, Break camp is offered again once the departure check passes. People may have died during the winter through the existing hunger and thirst rules.

**Passage ended.** The last founder dies. The chronicle names the cause already used for death (starvation or dehydration, or whatever cause that death recorded). A banner says the passage has ended. The win cannot be earned on this world. Surviving children, if any, keep living under the current simulation. The island is not wiped.

Individual founder deaths before the wipe do not fail the crossing. A single survivor can still raise the hall.

## 7. Buildings

Append these to `src-tauri/data/buildings.json`. Do not insert or reorder existing entries. Mirror them into the demo catalog.

| id | role | footprint | cost | notes |
|---|---|---|---|---|
| `waystation` | the pass | 1×1 | 10 wood | Legal on the generated pad only. Complete = pass open. No jobs. |
| `cove_hall` | the win | 2×2 | 30 wood, 15 stone | Legal on the destination pad only. No jobs. |

Both are available from the start of a crossing, with no population unlock. They do not appear as free-build items on a loaded free village.

Starting stores stay 120 wood, 40 stone, and 50 food. A lean camp (hut 20 wood, farm 10 wood, well 5 wood and 15 stone, waystation 10 wood, hall 30 wood and 15 stone) fits in that pile with wood and stone left over. Adding a granary, mill, and bakery spends the stone pile down, so the player gathers rock or skips the mill and grows food crops. That is the outfit choice.

Fence, gate, and signpost stay decorative. They are not the pass. The pass is the ribbon tile plus the waystation.

Chickens stay optional. The flock does not have to reach the cove. Abandoned shelters keep their birds.

## 8. Presentation

- **Markers.** Embark, pass, and cove draw on the overlay from trail state. They are not buildings.
- **Leg list.** The objectives panel lists the five legs, the current departure numbers (food, wood, stone against the gates), and the season. Completing a leg is visible without opening the chronicle.
- **Break camp.** One control, disabled with a stated reason when food, materials, or the pass is short.
- **Gold.** Remove the gold chip from the resource bar until a later design gives it a sink.
- **Banners.** One for the win, one for the passage ending, one for wintered short. They do not pause the sim.
- **Ghosts.** Waystation and cove hall use their atlas cells when the placement ghosts are drawn. A refused pad explains that the building belongs on its marker.

Weather on the map and the other picture notes in the retention review are unchanged by this design. A storm that closes the pass should be visible in the chronicle even before a rain overlay exists.

## 9. Chronicle, commands, saves

Append chronicle variants. Do not insert them in front of existing ones: `ChronicleBody` is stored with bincode’s externally tagged indices.

New entries:

- camp established
- rations packed
- pass opened
- pass closed
- camp broken
- wintered short
- cove raised
- passage ended

New commands, drained on the sim thread like the others:

- pack rations
- break camp

Placement of the waystation and the hall uses the existing place command, rejected when the footprint is not the generated pad.

Trail state is part of the world: direction, ribbon, pass tile, pads, current leg, whether camp has been abandoned, whether the crossing is won or permanently lost. It persists. The next save version migrates older worlds in as free villages (`crossing: none`) so an old hamlet is not suddenly late for a march.

Browser-demo rules match, including generation of the ribbon and the departure checks. Births and deaths remain desktop-only, as they are today, so a demo session cannot show a birth and cannot show a passage ended unless a founder death is added to the demo later. Win, pack, pass, break camp, and wintered short can be tested in the demo with the starting five.

## 10. Requirements

- R1. A new game generates a deterministic embark, ribbon, pass pad, and cove pad, and spawns the five founders at the embark in one water-reaching region.
- R2. The pass tile blocks all pathing until the waystation on its pad is complete, and blocks again if that building leaves the complete state.
- R3. Legs advance in order and each completion is written to the chronicle once. A storm that uncompletes the waystation before break camp returns the party to the pass leg and writes pass closed.
- R4. Pack and Break camp read stockpile food, wood, and stone. Building inventories do not satisfy the gates.
- R5. Break camp abandons embark-side jobs and homes and gives each living founder a move order toward the cove pad. Urgent needs may interrupt that order.
- R6. The win is a completed cove hall with at least one living founder on the cove side of the pass. The sim then stays in free play.
- R7. Winter’s first tick, before break camp, with stored calories under the existing winter buffer, records wintered short and allows another departure next spring if a founder remains.
- R8. The death of the last founder records passage ended and retires the win on that world.
- R9. Saves written before this design load as free villages. New crossing state round-trips.
- R10. The demo catalog and crossing rules match the desktop rules for everything the demo already simulates.

## 11. Acceptance

- Given a fixed seed, two new games produce the same embark, ribbon, and cove.
- Given the founders on the beach, the pass tile rejects a move order onto it before the waystation exists, and accepts one after the waystation completes.
- Given 50 food in a granary and an empty stockpile, Pack is refused. Given that food hauled into the stockpile and the hall’s wood and stone in the stockpile, Pack is accepted.
- Given a packed party and an open pass, Break camp clears homes and jobs on the near side and the founders path toward the cove.
- Given a completed hall and one living founder on the cove side of the pass, the chronicle records the cove and further legs are gone. A founder who stepped off the hall footprint to eat still counts.
- Given no break camp, a short calorie store, and the tick winter begins, the chronicle records wintered short. On the next spring, with a founder alive and the departure check met, Break camp is available.
- Given the last founder’s death, the cove hall cannot win the crossing.
- Given a save from the previous version, load shows no trail markers and no break-camp control.

## 12. Out of scope

- A gold trader, wages, or a festival sink.
- Trait modifiers, even though Fast Walker, Green Thumb, and Strong Back should eventually change the march. Shipping the trail comes first.
- Per-villager job assignment. Break camp is the party order.
- Friendship, kinship, and a second settlement chapter after the win.
- Moving the chicken flock, a hunting scene, random illness, or a separate traveling map.
- Player-dug tunnels or player-built bridges that edit terrain.
- Making fence and gate generally passable. Only the ribbon’s pass tile has the new block.
- Shortening the 28-day season. If playtests show the first winter never arrives in a real campaign, that is a clock change of its own, not part of turning the legs on.

## 13. What comes after a played crossing

Once a party has reached the cove or died on the way, the retention follow-ons have a subject. Trait sentences can change who survives the walk. A midpoint trader can give gold a sink. A second season at the cove can be a new goal, because the hall is no longer the end of wanting something.

None of those ship inside the first crossing.
