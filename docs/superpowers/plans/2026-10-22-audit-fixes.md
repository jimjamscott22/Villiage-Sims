# Audit fixes implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Resolve audit findings 3 and 5: manual seed-cost bypass and stale viewport synchronization.

**Architecture:** Reuse the automatic planting seed transaction in both command handlers. Replace the camera debounce with a bounded trailing throttle and observe container size changes.

**Tech Stack:** Rust simulation, TypeScript, React Canvas, Vitest.

**Spec:** `docs/audits/2026-10-03-bugs-and-performance.md`, findings 3 and 5.

## Global constraints

- Preserve farm-buffer-first seed spending and reject insufficient funds atomically.
- Validate crop, completed farm and occupancy before spending or allocating a crop id.
- Keep viewport updates within 100 ms during motion; send the final rectangle after motion stops.
- Preserve immediate synchronization for explicit camera jumps and cancel pending work on unmount.
- Keep Vitest tests free of browser globals; no catalog/save-format/dependency changes.

## Review focus

- Exhausted seeds: repeated planting must fail without consuming ids or resources.
- Farm inventory and stockpile: local seeds take priority and shortfalls use stockpile.
- Invalid requests: unknown crops, incomplete farms and occupied tiles must not spend seeds.
- Continuous movement: repeated scheduling must not postpone updates indefinitely.
- Container-only resize and disposal: update the rectangle, disconnect observers and cancel timers.

### Task 1: Charge manual seed costs in both simulations

**Files:** `src-tauri/src/sim/world/commands_handler.rs`, `src-tauri/src/sim/world_review_tests.rs`, `src/state/demoWorld.ts`, `src/state/demoWorld.test.ts`; existing planting fixture setup in Rust tests as needed.

**Interfaces:** Consume `spend_seed_cost` / `spendSeedCost`; retain existing public planting signatures and errors.

- [x] Write regressions for zero seeds, local-first spending, stockpile fallback, food seeds and invalid requests.
- [x] Run targeted regressions and confirm failure on the old command handlers.
- [x] Call the existing spending helper after validation and before crop allocation; report `insufficient seeds` on failure.
- [x] Supply explicit seeds to older planting fixtures, preserving their original assertions.
- [x] Run frontend and Rust simulation tests.

### Task 2: Bound viewport synchronization latency

**Files:** `src/render/viewportSync.ts`, `src/render/viewportSync.test.ts`, `src/render/Canvas.tsx`.

**Interfaces:** `createViewportSync(send: () => void, intervalMs = 100)` returns `schedule()`, `syncNow()` and `cancel()`; callbacks read the latest camera rectangle.

- [x] Write fake-timer regressions for sustained movement, final updates, immediate jumps and cancellation.
- [x] Run regressions before implementation and confirm failure. The missing scheduler import failed initially; a separate browser probe reproduced zero updates during sustained scrolling and after resizing on the original Canvas.
- [x] Implement the scheduler and integrate it into Canvas; synchronize effective resizes and observe the container with `ResizeObserver`.
- [x] Run targeted tests, full frontend tests and production build.
- [x] Exercise scrolling, dragging, camera jumps and window/container resizing in a browser when runtime access permits.

### Task 3: Record verification and review

- [x] Review the complete diff and record verified outcomes and limitations in the audit resolution notes and `progress.md`.
- [x] Leave changes reviewable in the provided cloud checkout; no publish or merge.
