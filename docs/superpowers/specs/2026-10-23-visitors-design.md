# Visitors with interesting offers

Approved design: three authored visitors use existing systems. Merchant trades 12 food for 8 grain; musician costs 6 food and restores 0.20 Social (cap 1) to current villagers; grower joins with Green Thumb when there is spare population capacity, a vacant completed reachable home, and a safe spawn tile. Accept/decline is optional; expiry has no penalty.

First visit after 60 in-game minutes, stay 180 minutes, next arrival 360 minutes after departure. Merchant → musician → grower, repeating; grower is skipped after settling. Pause freezes timers. Births leave one population slot available during the grower's visit without evicting residents. Offers use an accessible compact pixel UI panel and arrival toast, with exact terms, countdown, and unmet requirements.

Rust remains authoritative. Browser-demo mirrors offers. Atomic spending and visit identity prevent stale/repeated responses. Visits and chronology persist, with desktop v7→v8 and demo v4→v5 migrations. Older supported saves initialize visitors fresh. Chronicle records arrivals and outcomes.

Approaches considered: timed visits (selected for anticipation and short decisions) versus indefinite offers (simpler but no time pressure). Existing resources/traits (selected for bounded scope) versus new rare crops and baker professions (deferred). No visitor map sprites, new currencies, quest chains, profession bonuses, or rare crops. Exact timing and amounts are initial balance values.
