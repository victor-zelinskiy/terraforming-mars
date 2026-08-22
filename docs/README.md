# Internal engineering docs

Design specs, audits, and rework plans for this fork. These are **developer notes**, not
user documentation — they explain *why* a subsystem is built the way it is and track the
work still open. Code comments across `src/` reference these files by name (e.g.
`docs/PERFORMANCE_AUDIT.md`).

The load-bearing operating manual is **[`../CLAUDE.md`](../CLAUDE.md)** (repo root); the
files here are the deeper dives it points at.

## Extracted CLAUDE.md reference
- [claude/README.md](claude/README.md) — **index of `docs/claude/**`**: the full, verbatim subsystem write-ups moved out of the root `CLAUDE.md` on 2026-07-27 (context-budget split). Not auto-loaded — read on demand. Path-scoped condensed contracts live in [`../.claude/rules/`](../.claude/rules/); the pre-split original is preserved at `../CLAUDE.md.backup.md`.

## Repo workflow / release
- [SHARED_MAIN_WORKFLOW.md](SHARED_MAIN_WORKFLOW.md) — two clones pushing to one `main`: `npm run push`, why the release version may never be derived from the local base, and what the pre-commit / push / pre-push trio each guarantee.

## Console / gamepad / TV
- [CONSOLE_MODE_CONCEPT.md](CONSOLE_MODE_CONCEPT.md) — console-native shell design (the default UI surface).
- [CONSOLE_FOUNDATION.md](CONSOLE_FOUNDATION.md) — VueUse foundation layer (semantic input, overflow policy, viewport).
- [CONSOLE_SURFACE_MOTION.md](CONSOLE_SURFACE_MOTION.md) — band-surface transition orchestration (shared shade, phase FLIP handoffs, awaiting commit hold, wheel handoff).
- [CONSOLE_WORKSPACE_STACK.md](CONSOLE_WORKSPACE_STACK.md) — the ONE depth model of a workspace: frame stack, registry, navigation verbs, anchors, persistence. Replaces the five parallel «where am I» models and the latches that soft-locked the colony-inside-hand flow.
- [CONSOLE_BLUE_ACTION_PARITY.md](CONSOLE_BLUE_ACTION_PARITY.md) — blue-card action center parity with desktop.
- [CONSOLE_TV_PREMIUM_PLAN.md](CONSOLE_TV_PREMIUM_PLAN.md) — 4K-TV premium recomposition plan.
- [COLONY_TRADE_FLOW.md](COLONY_TRADE_FLOW.md) — the premium colony-trade reward transaction (atomic tradeId manifest, merged Pluto reveal, track-reset glide).
- [GAMEPAD_SUPPORT_DESIGN.md](GAMEPAD_SUPPORT_DESIGN.md) / [GAMEPAD_SUPPORT_BRIEF.md](GAMEPAD_SUPPORT_BRIEF.md) — controller-first support design + status.
- [DEV_GUARANTEED_CARDS.md](DEV_GUARANTEED_CARDS.md) — dev tool: pin chosen cards into the first hand dealt (test-mode sub-setting, admin only).
- [TEST_CONTOUR.md](TEST_CONTOUR.md) — what «green» is allowed to mean: the chunking bug that made the whole client suite a silent no-op, the collected-count floor, wrapper auto-unmount, the `serial` cascade behind «did not run», and the probe/press disciplines E2E failures kept coming from.

## Desktop UI / rendering / performance
- [DESKTOP_DEPRECATION_AUDIT.md](DESKTOP_DEPRECATION_AUDIT.md) — desktop-only vs shared vs console-only file inventory (read before touching a UI file).
- [DESKTOP_UI_PHILOSOPHY.md](DESKTOP_UI_PHILOSOPHY.md) — dedicated buttons vs mandatory-input modals (frozen desktop spec / console-port design ref), extracted from CLAUDE.md.
- [MODAL_INPUTS.md](MODAL_INPUTS.md) — modern modal-input components (ModalInputHost router, Modern* inputs, contextual-choice, option-metadata prose), extracted from CLAUDE.md. Routing invariants + the metadata CHECKLIST stay in CLAUDE.md.
- [REMOUNT_ANIMATION_REWORK_DESIGN.md](REMOUNT_ANIMATION_REWORK_DESIGN.md) / [REMOUNT_ANIMATION_REWORK_BRIEF.md](REMOUNT_ANIMATION_REWORK_BRIEF.md) — the no-remount update model + motion system.
- [PERFORMANCE_AUDIT.md](PERFORMANCE_AUDIT.md) / [PERF_INVESTIGATION.md](PERF_INVESTIGATION.md) — rendering/perf findings and fixes.
- [PLAYED_TABLEAU_PERFORMANCE.md](PLAYED_TABLEAU_PERFORMANCE.md) — the full-tableau («Разыграно») performance iteration: the GSAP `<html>`-reparent + root-`:has()` whole-document-recalc root causes, bounded flights / staged mount / thumb art tier, probe + seeds.
- [STEAM_DECK_PERF_ITERATION_1.md](STEAM_DECK_PERF_ITERATION_1.md) — the first Steam-Deck long-game iteration: the paint baseline made permanent (con-perf-lite removed), the hazard-tile `v-show`-restart root cause, the wheel pre-warm off the critical path, the per-second ambient-cost cuts (leak detector / animation-hold tick / notification poller / server log-window scans), the seeded gen-11 scenario + probe, before/after numbers.
- [STEAM_DECK_PERF_ITERATION_2.md](STEAM_DECK_PERF_ITERATION_2.md) — the docked-Deck iteration: the TV-4K-at-1080p measurement (uiScale=1 — no 4K raster, hypothesis disproven), the idle-compositor census (7 ambient loops), the two new settings («Упрощённые графические эффекты» / «Меньше движения» with the OS-OR-override policy and the loops-don't-loop CSS bridge), the overlay-stats server memo, the 4-combo matrix.
- [STEAM_DECK_PERF_ITERATION_3.md](STEAM_DECK_PERF_ITERATION_3.md) — the systemic iteration: the busy-idle root cause (box-shadow loops ⇒ full pipeline ~58×/s ⇒ compositor-only pseudo-element loops, idle jank 13→0 with identical visuals), idle-adaptive gamepad drivers, raw-tree structural sharing (commit 9.3→2.4 ms), identity-stable MA HUD zones, presence-bridge record filtering, the hand-album thumb art tier (48→5.3 MB), probe v2 (warm-up/p50/p95/MAD, phase attribution, REAL rival-action ingest cycles), payload/server/allocations disproven as bottlenecks.
- [DESKTOP_REMOVAL_WAVE_1.md](DESKTOP_REMOVAL_WAVE_1.md) — the desktop-deletion policy change + wave 1 (the reversible entry-point cut): console unconditional, PlayerHome + 8 App-level desktop overlays unreferenced (main.js −10.1 %, −3.1 MB of module graph), the load-bearing legacy list (WaitingFor transport / legacy Card.vue / MandatoryInputModal), open spectator decision, the next-waves plan.
- [DESKTOP_REMOVAL_WAVE_2.md](DESKTOP_REMOVAL_WAVE_2.md) — the input stack dies: WaitingFor goes HEADLESS (poll + submit funnel + SelectSpace binder only), the radio/modal renderers + PlayerHome + spectator DELETED (107 files, main.js −13.9 % cumulative), the degenerate `projectCard` prompt goes console-native in ConsoleTaskHost (pick → pay), standard projects/actions join the premium face (`standard` theme, cost badge by type), the verification battery + the traps every future wave inherits (vue-tsc's `.vue`-shim blindness, tail-masked exit codes, orphan specs by import graph).
- [TRANSPORT_REWORK.md](TRANSPORT_REWORK.md) — WaitingFor.vue retired: the game transport is the `console/transport/gameTransport.ts` module (poll chain, `submitInput`/`submitBatch`/`cancelPlacement`, the cinematic-gate pipeline as `transportHolds`, view apply, turn presentation) with `ConsoleBoardBinder.vue` owning the lifecycle + the `SelectSpace` cell-binder; the WS channel confirmed PRIMARY (push-notify + guarded fetch, default-ON end to end, 20 s fallback poll while healthy) with the state-over-WS option deliberately declined; e2e submits + longgame ingest green on the module.
- [DESKTOP_REMOVAL_WAVE_3.md](DESKTOP_REMOVAL_WAVE_3.md) — waves 3–4: the unreachable desktop subgraph deleted by import graph (−44 239 lines: desktop journal/overlays/TopBar chain/initialDraft, the desktop main menu + create screens; `/new-game` lands in the console creator), CEOs join the premium face (`ceo` theme, `.pcard-ceo-ident` band, OPG marker, the prose rule zone, `printedLayout`; RU CEO locale created) and legacy `Card.vue` + its subcomponent family die (the shared `CardRenderData` DSL tree stays), the admin-only console Playground hub (three dev stands on one `ConsolePlaygroundStand` chassis) + the menu audit; main.js −15.6 % cumulative, one load-bearing legacy piece left (the headless transport).
- [ZOOM_BUG_HANDOFF.md](ZOOM_BUG_HANDOFF.md) — zoom-rendering bug investigation notes.
- [DIAGNOSTIC_CLEANUP.md](DIAGNOSTIC_CLEANUP.md) — diagnostics/cleanup notes.

## Desktop client / transport (Electron, WebSocket)
- [ELECTRON_MIGRATION_PLAN.md](ELECTRON_MIGRATION_PLAN.md) — phased Electron desktop-client roadmap.
- [WEBSOCKET_MIGRATION_PLAN.md](WEBSOCKET_MIGRATION_PLAN.md) — realtime transport migration plan.
- [EMBEDDED_SERVER.md](EMBEDDED_SERVER.md) — host-as-server app modes: embedded server in a utility process, LAN discovery/join, future WebRTC public hosting.

## Cards / expansion adaptation
- [UPSTREAM_DEFERRED_WORKLIST.md](UPSTREAM_DEFERRED_WORKLIST.md) — upstream work reviewed but NOT taken, with the blockers and the port plan: the action-card → declarative `behavior` conversions, and the global-events DSL cluster. Read before re-auditing either.
- [ARES_ADAPTATION_AUDIT.md](ARES_ADAPTATION_AUDIT.md) — Ares premium-subsystem adaptation audit.
- [CHOICE_CONTEXT_AUDIT.md](CHOICE_CONTEXT_AUDIT.md) — contextual-choice modal coverage.
- [PROMPT_SOURCE_AUDIT.md](PROMPT_SOURCE_AUDIT.md) — "why did this prompt come to me?": which prompts name their source card, and which console surfaces show it.
- [DELAYED_TARGET_AUDIT.md](DELAYED_TARGET_AUDIT.md) — no-auto-select / hidden-target triage.
- [MULTI_BRANCH_PLAY_AUDIT.md](MULTI_BRANCH_PLAY_AUDIT.md) — multi-branch play-preview coverage.
- [SPECIAL_TILE_AUDIT.md](SPECIAL_TILE_AUDIT.md) — special/off-Mars tile identity + scoring.
- [PLACEMENT_PREVIEW_AUDIT.md](PLACEMENT_PREVIEW_AUDIT.md) — what the player must know BEFORE placing a tile: card-driven, trigger-driven and progress gaps.
- [PENDING_ACTION_CANCEL_AUDIT.md](PENDING_ACTION_CANCEL_AUDIT.md) — pay-on-commit cancellability classification.
- [CORPORATION_IMPACT_AUDIT.md](CORPORATION_IMPACT_AUDIT.md) — endgame corporation-impact model.

## Events / journal / stats / endgame
- [EVENT_STAT_FOUNDATION.md](EVENT_STAT_FOUNDATION.md) — event/stat foundation + endgame storytelling.
- [ENDGAME_STORYTELLING.md](ENDGAME_STORYTELLING.md) — endgame insight-engine iteration history (Iter 5–17), extracted from CLAUDE.md.
- [JOURNAL_GAIN_AUDIT.md](JOURNAL_GAIN_AUDIT.md) — direct-mutation-bypasses-recorder audit.
- [LOGGING_EVENT_MODEL_PROPOSAL.md](LOGGING_EVENT_MODEL_PROPOSAL.md) / [LOGGING_EVENT_COVERAGE_MATRIX.md](LOGGING_EVENT_COVERAGE_MATRIX.md) — structured event model + coverage.
- [MILESTONE_AWARD_DEDUP_AUDIT.md](MILESTONE_AWARD_DEDUP_AUDIT.md) — milestone/award journal-root dedup.

## MarsBot / Automa (solo AI)
- [MARSBOT_STATUS_AUDIT.md](MARSBOT_STATUS_AUDIT.md) — bot lifecycle / player-chip status audit.
- [AUTOMA_DATA_AUDIT.md](AUTOMA_DATA_AUDIT.md) — Automa data tables audit (§9 = official FAQ card-specific rules + coverage status; §10 = MarsBot corporations, Rule Book B transcribed).
- [claude/marsbot-corporation-checklist.md](claude/marsbot-corporation-checklist.md) — **the checklist for adding a MarsBot corporation** (read this before implementing one).
- [claude/marsbot-corporations.md](claude/marsbot-corporations.md) — the MarsBot corporation framework contract (registry/data/behavior, the selection gate, track cubes, B23 recurring lifecycle, the Ecoline plant-attack FAQ, corp stats).
- [AUTOMA_PROMO_MULTIPLAYER_FRAME.md](AUTOMA_PROMO_MULTIPLAYER_FRAME.md) — binding design frame for MarsBot promo adaptation + future multiplayer-with-bot mode (two modes, no global card patches, positive-production policy, per-card hook rules).
- [BOT_TURN_REVIEW_CONCEPT.md](BOT_TURN_REVIEW_CONCEPT.md) — bot-turn "review" screen concept.
- [AUTOMA_CORP_FRAMEWORK_REFERENCE.md](AUTOMA_CORP_FRAMEWORK_REFERENCE.md) — HISTORICAL: upstream's types-only corp framework shape (the implementation deliberately did not adopt its facade — see claude/marsbot-corporations.md).
