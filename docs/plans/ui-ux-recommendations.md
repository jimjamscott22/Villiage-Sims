# UI/UX and gameplay recommendations

Status checked against `main` at `4e1c497`, which includes
[PR #64](https://github.com/jimjamscott22/Villiage-Sims/pull/64) and PR #65.
Source: the “Make UI/UX better Plans” Codex conversation
(`01a0ff94-54de-7292-99c7-cafbe60a5fc0`). Checked items mean the described
feature is implemented; branch-only work is identified explicitly.

## Make the village easier to understand

- [ ] **Building inspector:** show stored inputs/output, recipe, workers and
  production blockers for the selected building. Build-menu recipe summaries
  and demolition/home-assignment actions do not satisfy this recommendation.
- [ ] **Context-sensitive sidebar:** separate Inspect / Build / Plant views.
  `src/ui/BuildMenu.tsx` still combines these in one scrolling panel.
- [ ] **Placement explanations before clicking:** retain and display the invalid
  placement reason beside the ghost. Hovering still keeps only the validity
  boolean in `src/render/Canvas.tsx`; detailed rejection appears on clicking.
- [ ] **Village attention strip:** group actionable needs/housing problems,
  focus their subjects and clear resolved alerts. Existing toasts are not this
  persistent, automatically resolving overview.
- [ ] **Resource trends and production overview:** recent gains/losses and
  grain → flour → food bottlenecks. `src/ui/ResourceBar.tsx` shows totals only.
- [ ] **Pinned objective with live progress:** keep one objective visible with
  progress and a shortcut to the relevant build category.
  `src/ui/ObjectivesPanel.tsx` remains a dropdown with a completion count.

Recommended next implementation slice remains the inspector, contextual sidebar
and placement explanations. This checklist does not authorize implementation.

## Make village life more interesting

- [ ] **Friendships and recurring encounters:** persistent preferred companions
  and occasional relationship Chronicle entries. Existing conversations are a
  foundation, not persistent friendships.
- [ ] **Seasonal village projects:** optional shared goals with visible outcomes
  and modest rewards. Existing objectives do not implement seasonal projects.
- [ ] **Work preferences:** player encouragement toward farming, hauling or
  milling while survival needs take priority.
- [x] **Small visitor events:** implemented on `main` in
  [PR #65](https://github.com/jimjamscott22/Villiage-Sims/pull/65), commit
  `4de74a9`. Rowan trades food for grain, Lark offers a Social boost for food,
  and Mira can join with Green Thumb when suitable housing is available.
  Accept/decline, expiry, costs/rewards, Chronicle and persistence are wired
  through Rust and the browser demo. Evidence: `src-tauri/data/visitors.json`,
  `src-tauri/src/sim/world/visitors.rs`, `src/state/demoWorld.ts`,
  `src/ui/VisitorPanel.tsx`; verification limits are in `progress.md`.
- [ ] **Stronger sense of place:** day/night lighting, restrained weather audio
  and settlement landmarks as a cohesive addition. Existing props, weather and
  building effects provide a foundation; the full recommendation remains open.

## Supporting performance and visual work

- [ ] **Reduce unrelated UI updates:** profile snapshot-driven React updates,
  preserve unchanged values and isolate panel subscriptions where justified.
- [x] **Art-style consistency pass:** implemented on `main` in
  PR #64, merge commit `4e1c497` (reviewed branch head `04de942`). Palette tokens,
  fallback colours, zoom steps, bitmap canvas text, 6px borders, sprite outlines,
  palette merges and guards are complete. This separate visual pass does not
  complete the six workflow recommendations above. See
  [the phase checklist](CLAUDE_CODE_PLAN.md#implementation-status).

This status update is based on source and live PR inspection. No new gameplay,
browser or native Tauri verification was performed for this documentation edit.
