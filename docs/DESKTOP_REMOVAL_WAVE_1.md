# Desktop Removal — Wave 1: the entry-point cut (2026-08-22)

Policy change (owner directive, 2026-08-22): the frozen desktop UI is **dead
weight scheduled for deletion**, not a fallback — the future desktop will be
rewritten from scratch on top of the console shell. The old «nothing is
deleted» guarantee is dropped (CLAUDE.md + `.claude/rules/client-ui.md`
updated; memory `desktop-ui-deprecated` updated).

Wave 1 is the REVERSIBLE entry-point cut: nothing on disk is deleted yet —
App.vue simply stops referencing the desktop shell and its App-level overlay
stack, and the console becomes unconditional. One commit, easily revertable,
zero console-runtime behaviour change (every removed branch was already
mounted only when `!consoleModeState.enabled`).

## What changed

1. **`consoleModeState.enabled` is unconditionally `true`.**
   `initialEnabled()` returns true; `?console=0`, the stored
   `tm_console_mode='0'` opt-out, `consoleModeExplicitlyDisabled()` and the
   OFF direction of `setConsoleMode()` are inert (the `tm_console_perf_lite`
   precedent: old installs boot normally, the key is never read again). The
   module keeps its API shape — the Electron auto-enable heuristics and the
   fullscreen plumbing still ride it; the consented entry prompt can never
   fire (it only ever offered the way back in).
2. **App.vue**: the `<player-home>` branch is gone (ConsoleShell mounts for
   every in-game screen), along with the desktop-only App-level overlays —
   DraftFlowOverlay, StartGameFlowOverlay, DrawCardRevealFlow,
   RevealResultOverlay, MaCeremonyOverlay, BotTurnReviewOverlay, the desktop
   JournalPanel, RevealedCardsModal — and the desktop-only helpers
   (`playerHomeHasOpenOverlay`/`preserveOpenOverlay`, `hasDrawReveal`,
   `journalState` passthrough, the desktop `primeStartSetupReveal` poll-path
   branch). Every one of these flows is served natively by the console
   (ConsoleTaskHost / start scene / ConsoleRevealOverlay / MA ceremony /
   ConsoleBotTurnReview / ConsoleJournalPanel / the console reveal family).
3. **The shell switch is gone**: the settings «Интерфейс → Оболочка» row
   (main-menu-only) and the hold-Menu (≥650 ms) shell toggle — a long Menu
   hold now behaves like a short press. `MENU_HOLD_MS` removed.
4. Kept deliberately (shared or still-reachable): NotificationLayer,
   TurnHandoffLayer (no-ops in console), EnergyConversionOverlay,
   HazardCleanupOverlay, AdditionalResourceDetailOverlay, GameExitButton,
   RematchLayer, EndgameExperience (the console's «Обзор партии» host),
   `spectator-home` (desktop-shaped; its fate is an OPEN product decision),
   the create/menu/auth/admin screens, and the playgrounds.

## Measured result (production webpack, same config)

| Metric | before | after | Δ |
| --- | --- | --- | --- |
| `main.js` (minified) | 2 173 770 B | 1 953 901 B | **−219 869 B (−10.1 %)** |
| client module graph (unminified) | ~26.8 MB | 23.68 MB | **−3.1 MB** |
| `player-home` async chunk | emitted | not emitted | — |

Biggest evictions (unminified module sizes): handCards −609 KB, PlayerHome
−492 KB, overview −467 KB, initialDraft −379 KB, playedCards −234 KB,
startGameFlow −180 KB, hydronetwork −131 KB, colonies −130 KB, marsbot
−104 KB, journal −92 KB, drawnCards −65 KB. `components/actions` fell only
19 KB — the desktop actions overlay graph is still reachable from another
root (spectator / WaitingFor's modal-input renderers); that attribution is
exactly what the later waves' import-graph pass is for.

Boot effect: −10 % of `main.js` parse/eval on every start (Deck included) +
the never-mounted overlay components' module-init work. Stale
`build/chunks/player-home.js*` files from earlier builds are dead artifacts
(webpack does not clean old chunks) — nothing references them.

## Load-bearing legacy — NOT touchable in this wave (replace first)

1. **`WaitingFor.vue`** — the transport: the poll chain + every submission
   (`onsave()`), mounted headless inside ConsoleShell (`.con-wf-host`).
   Wave 2 candidate: extract a headless transport module, then delete the
   radio UI. Its modal-input renderers keep `components/modalInputs` (and
   part of `components/actions`) in the bundle.
2. **Legacy `Card.vue`** — the live face for CEOs / standard projects
   (`CardFace.vue` routing; `ConsoleCardFaceLite`'s legacy branch + icon
   CSS). Premium pass first.
3. **`MandatoryInputModal`** — the honest fallback for the degenerate
   `projectCard` prompt shape (console-ui rules).
4. The `@console-shared` layer (board engine, `.pcard`, view-models,
   journal/notification/presentation modules, `motionTokens`) — not desktop.

## Open product decisions (deliberately NOT taken in wave 1)

- **Spectator** (`spectator-home`) — desktop-shaped, no console equivalent.
  Deleting it removes the feature; building a console spectator is its own
  chunk of work. It keeps a slice of the desktop graph (board panels) alive
  in the bundle until decided.
- Mouse-first browser play now lands in the console shell too (it is fully
  mouse-operable; the dock/wheel/bars take clicks), but the couch-first
  layout on a small desktop window is a different ergonomic — acceptable per
  the console-first policy.

## Runtime smoke (long-game probe, deck-docked-tv ×4, wave-1 build)

Both probe tests green (all invariants: hazard drift 0, no animation
restarts, listeners flat 273, heap ~19.4 MB flat, ingest applied). The LIVE
document is byte-identical to the pre-wave build (paint census: 2344 nodes
in both). Wheel cold 134→113 ms, warm p50 71→53 ms, late 65→59 ms in the
smoke run — direction consistent with −10 % main.js parse/eval, though a
single run carries MAD ~6.

One noted, non-blocking observation: the CDP `Nodes` metric (which counts
DETACHED-but-referenced nodes too) sits ~+1.1 k higher from BOOT onward
(5364 vs 4266 before any interaction) and stays FLAT across all workspace
trips (5510×3) with identical listener counts — i.e. a constant boot-time
detached-tree delta, not a leak and not rendered DOM. Heap-snapshot
attribution of that retained tree is queued for wave 2.

## Tests

- Updated to the new semantics: `consoleModeBoot.spec.ts` (nothing vetoes
  the console; `?console=0` / stored '0' ignored), `App.spec.ts` (the
  overlay-preserve path is gone — a poll refresh always bumps the reset
  epoch), `AppNoRemount.spec.ts` (the no-remount contract re-pinned on the
  CONSOLE shell element; the legacy `tm_remount` flag can no longer recreate
  the game subtree — it only ever keyed `<player-home>`),
  `consoleSettingsModel.spec.ts` (no `shell` row in any context).
- Specs that mount desktop components DIRECTLY (PlayerHome.spec,
  StartGameFlowOverlay.spec, …) still pass — the files exist until their
  deletion wave, at which point the client-suite floor (4000) gets
  re-derived.

## Next waves (in order)

1. **Headless transport extraction** out of `WaitingFor.vue`; then the radio
   stack + `modalInputs` renderers become deletable.
2. **Premium pass for CEO / standard-project faces**; then legacy `Card.vue`
   internals + legacy icon CSS become deletable.
3. **Console fallback for the degenerate `projectCard` prompt**; then
   `MandatoryInputModal` becomes deletable.
4. **Spectator decision** (delete vs console spectator).
5. **File deletion by import graph** (leaves inward): desktop components,
   their specs (re-derive the client floor), orphaned locale keys, desktop
   LESS; record the upstream-sync «keep deleted» resolution policy in
   `docs/SHARED_MAIN_WORKFLOW.md`.
