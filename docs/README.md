# Internal engineering docs

Design specs, audits, and rework plans for this fork. These are **developer notes**, not
user documentation — they explain *why* a subsystem is built the way it is and track the
work still open. Code comments across `src/` reference these files by name (e.g.
`docs/PERFORMANCE_AUDIT.md`).

The load-bearing operating manual is **[`../CLAUDE.md`](../CLAUDE.md)** (repo root); the
files here are the deeper dives it points at.

## Console / gamepad / TV
- [CONSOLE_MODE_CONCEPT.md](CONSOLE_MODE_CONCEPT.md) — console-native shell design (the default UI surface).
- [CONSOLE_FOUNDATION.md](CONSOLE_FOUNDATION.md) — VueUse foundation layer (semantic input, overflow policy, viewport).
- [CONSOLE_BLUE_ACTION_PARITY.md](CONSOLE_BLUE_ACTION_PARITY.md) — blue-card action center parity with desktop.
- [CONSOLE_TV_PREMIUM_PLAN.md](CONSOLE_TV_PREMIUM_PLAN.md) — 4K-TV premium recomposition plan.
- [GAMEPAD_SUPPORT_DESIGN.md](GAMEPAD_SUPPORT_DESIGN.md) / [GAMEPAD_SUPPORT_BRIEF.md](GAMEPAD_SUPPORT_BRIEF.md) — controller-first support design + status.

## Desktop UI / rendering / performance
- [DESKTOP_DEPRECATION_AUDIT.md](DESKTOP_DEPRECATION_AUDIT.md) — desktop-only vs shared vs console-only file inventory (read before touching a UI file).
- [REMOUNT_ANIMATION_REWORK_DESIGN.md](REMOUNT_ANIMATION_REWORK_DESIGN.md) / [REMOUNT_ANIMATION_REWORK_BRIEF.md](REMOUNT_ANIMATION_REWORK_BRIEF.md) — the no-remount update model + motion system.
- [PERFORMANCE_AUDIT.md](PERFORMANCE_AUDIT.md) / [PERF_INVESTIGATION.md](PERF_INVESTIGATION.md) — rendering/perf findings and fixes.
- [ZOOM_BUG_HANDOFF.md](ZOOM_BUG_HANDOFF.md) — zoom-rendering bug investigation notes.
- [DIAGNOSTIC_CLEANUP.md](DIAGNOSTIC_CLEANUP.md) — diagnostics/cleanup notes.

## Desktop client / transport (Electron, WebSocket)
- [ELECTRON_MIGRATION_PLAN.md](ELECTRON_MIGRATION_PLAN.md) — phased Electron desktop-client roadmap.
- [WEBSOCKET_MIGRATION_PLAN.md](WEBSOCKET_MIGRATION_PLAN.md) — realtime transport migration plan.

## Cards / expansion adaptation
- [ARES_ADAPTATION_AUDIT.md](ARES_ADAPTATION_AUDIT.md) — Ares premium-subsystem adaptation audit.
- [CHOICE_CONTEXT_AUDIT.md](CHOICE_CONTEXT_AUDIT.md) — contextual-choice modal coverage.
- [DELAYED_TARGET_AUDIT.md](DELAYED_TARGET_AUDIT.md) — no-auto-select / hidden-target triage.
- [MULTI_BRANCH_PLAY_AUDIT.md](MULTI_BRANCH_PLAY_AUDIT.md) — multi-branch play-preview coverage.
- [SPECIAL_TILE_AUDIT.md](SPECIAL_TILE_AUDIT.md) — special/off-Mars tile identity + scoring.
- [PENDING_ACTION_CANCEL_AUDIT.md](PENDING_ACTION_CANCEL_AUDIT.md) — pay-on-commit cancellability classification.
- [CORPORATION_IMPACT_AUDIT.md](CORPORATION_IMPACT_AUDIT.md) — endgame corporation-impact model.

## Events / journal / stats / endgame
- [EVENT_STAT_FOUNDATION.md](EVENT_STAT_FOUNDATION.md) — event/stat foundation + endgame storytelling.
- [JOURNAL_GAIN_AUDIT.md](JOURNAL_GAIN_AUDIT.md) — direct-mutation-bypasses-recorder audit.
- [LOGGING_EVENT_MODEL_PROPOSAL.md](LOGGING_EVENT_MODEL_PROPOSAL.md) / [LOGGING_EVENT_COVERAGE_MATRIX.md](LOGGING_EVENT_COVERAGE_MATRIX.md) — structured event model + coverage.
- [MILESTONE_AWARD_DEDUP_AUDIT.md](MILESTONE_AWARD_DEDUP_AUDIT.md) — milestone/award journal-root dedup.

## MarsBot / Automa (solo AI)
- [MARSBOT_STATUS_AUDIT.md](MARSBOT_STATUS_AUDIT.md) — bot lifecycle / player-chip status audit.
- [AUTOMA_DATA_AUDIT.md](AUTOMA_DATA_AUDIT.md) — Automa data tables audit.
- [BOT_TURN_REVIEW_CONCEPT.md](BOT_TURN_REVIEW_CONCEPT.md) — bot-turn "review" screen concept.
