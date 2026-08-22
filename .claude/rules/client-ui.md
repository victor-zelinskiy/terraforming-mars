---
description: Shared client rules — desktop freeze, no-remount update model, tooltips, Card hosting, server-authoritative availability.
paths:
  - "src/client/**"
  - "src/styles/**"
---

# Client UI rules

## Desktop UI is BEING DELETED in waves (policy 2026-08-22; frozen since 2026-07-15)
The fallback guarantee is DROPPED: the future desktop UI will be built FROM the console shell, so frozen desktop code is dead weight scheduled for deletion, never a surface to fix. **Wave 1 (done)**: console unconditional (`consoleModeState.enabled` always true; `?console=0` / stored `tm_console_mode='0'` never read again; the settings shell switch and hold-Menu toggle removed), App.vue no longer references `PlayerHome` or the desktop-only overlays. **Wave 2 (done)**: `WaitingFor.vue` is HEADLESS (poll chain + submit funnel + cinematic holds + the `SelectSpace` board binder — zero prompt rendering); the radio/modal input stack is DELETED (`PlayerInputFactory`, the leaf renderers, `MandatoryInputModal`, `ModalInputHost`, `PlayerHome`, `Sidebar`, the playgrounds, the spectator feature); the degenerate `projectCard` prompt renders natively in `ConsoleTaskHost` (pick → pay); standard projects/actions moved to the premium face. Remaining frozen files go by import graph in later waves (floors, locales and the upstream-sync «keep deleted» policy ride those waves).

**Wave 3 (done)**: the unreachable desktop subgraph deleted by import graph (desktop journal/overlays/TopBar chain/initialDraft, desktop main menu + create screens; `/new-game` lands in the console creator). **Wave 4 (done)**: CEOs joined the premium face and the legacy `Card.vue` renderer family is DELETED — `CardFace.vue` (the facade every host imports) is premium-only; the render-DSL `CardRenderData` tree STAYS (shared by journal popovers, MarsBot faces, effect chips).

**The transport rework (post-wave-4)**: `WaitingFor.vue` is DELETED. The game transport is the `console/transport/gameTransport.ts` MODULE (poll chain + `submitInput`/`submitBatch`/`cancelPlacement` + the cinematic holds + view apply); `ConsoleBoardBinder.vue` owns its lifecycle and renders only the legacy `SelectSpace` board cell-binder. The WS channel (realtimeService, default-ON end to end) is the primary update signal; the poll is the bounded fallback.

⚠️ **LOAD-BEARING legacy — the console stands on it:**
1. `SelectSpace.vue` (+`GoToMap.vue`) — the board cell-binder mounted by `ConsoleBoardBinder`; its `mounted()`/`saveData()` are the console's one tile-submit path.
2. Everything `@console-shared` (below) — not desktop at all.

Markers: `@deprecated Desktop-only UI (frozen 2026-07-15)` vs `@console-shared`; full inventory `docs/DESKTOP_DEPRECATION_AUDIT.md`.

**The SHARED layer is not deprecated** and keeps full quality bars: `src/common/` models, pure view-models (`victoryPointsModel`, `effectSummary`, `insightEngine`, `endgameFacts`, `journalView`, …), module reactive state (`journalState`, `notificationState`, `presentationFlow`, …), the premium card face (`.pcard`), `motionTokens`.

## Update model — NO remount
The game subtree (`<ConsoleShell>`) lives for the whole session; a response applies `playerView` reactively.
- **`playerkey` is the transient-UI RESET EPOCH, not a `:key`.** New transient UI state that a submit must clear MUST be reset via the epoch (module states register reset callbacks) — never assume a remount clears it.
- **Structural sharing** (`viewSnapshotShare.ts`): the root identity always changes, unchanged children keep their refs. **Never add an identity-watcher expecting per-response firing on a SUB-object of `playerView`** — watch VALUES (`gameAge`, `undoCount`, the concrete field).
- Anything that used `mounted()` to re-derive per-response state uses a value-based watcher instead.
- Rollback ladder: `?patch=0` (no sharing), `?remount=1` (legacy keyed remount). The baseline modules (`accentBaseline`, `tileBaseline`, cube baseline) exist to carry that mode — not dead code.

## Prompt detection + submission (load-bearing)
- **Availability is SERVER-authoritative.** Walk the `waitingFor` `OrOptions` tree; the option's PRESENCE is the source of truth. Submit via `gameTransport.submitInput()` with the nested `OrOptionsResponse` payload — byte-identical to the historical radio UI, no server change. Never re-derive availability from raw player state.
- **⚠️ NEVER detect a prompt by its title text.** i18n mutates `Message.message` IN PLACE on render, so an English-text match silently stops matching after the first render (this leaked a legacy modal back in). Use a server marker (`startGamePrompt`, `choiceContext`, `placementContext`, `awardFundingPrompt`, `reveal`) or another structural signal. The one surviving title check (the action menu) is safe only because that title isn't mutated.
- Show a blocked action DISABLED with a reason, not hidden.
- **The transport renders nothing.** `gameTransport.ts` owns poll/submit/holds/view-apply; `ConsoleBoardBinder` mounts only the `SelectSpace` cell-binder. Never add UI to the transport, never submit around it.

## Tooltips — the native `title` attribute is BANNED
Use the shared `.premium-tooltip(@max-width)` LESS mixin + `:data-hint`. **Host `data-hint` on a NON-disabled wrapper** — a disabled `<button>` never fires `:hover`, and that is exactly where a "why disabled" hint is needed. Every disabled control must carry a reason. The mixin forces `position: relative`.

**Disabled visuals:** never dim with whole-element `opacity` (goes see-through over the board) — dim via `filter` + muted text, keeping the element opaque.

## Hosting a `<Card>`
- Import **`card/CardFace.vue`** (the facade), never legacy `Card.vue` directly.
- A clickable wrapper that opens its own fullscreen MUST suppress the card's built-in zoom with `@click.capture.stop`, else two viewers open.
- A persistent `<Card>` that re-points across cards needs `:key="cardName"` (legacy `Card.vue` resolves render data in `data()`).
- **Centering UI under a card:** `.card-container` has an asymmetric legacy margin (`15px 30px 10px 0`). Zero it in your wrapper scope (`.your-slot > .card-container { margin: 0 }`) — never compensate with a negative margin (it drifts across zoom breakpoints). Inter-card spacing belongs to the parent's `gap`.

## State that must survive the reset epoch
Per-game UI state (overlay open flags, filters, selections, picks) lives in **module-level reactive files** (`journalState`, `playedCardsViewState`, `handFilterState`, `actionsOverlayState`, `sellPatentsState`, …) and panels that must outlive it are mounted at **App level**, not inside PlayerHome.

## Deep reference (read on demand, not auto-loaded)
`docs/claude/desktop-ui/` (overlays: played / effects / actions / victory-points / hand-cards, action-UI rework + philosophy, deprecation + update model), `docs/claude/journal.md`, `notifications.md`, `presentation-flow.md`, `board-information.md`, `start-game-flow.md`, `rematch-flow.md`, `modal-inputs-and-metadata-contract.md`, `premium-tooltips.md`, `terraforming-progress-hud.md`, `energy-heat-conversion.md`, `docs/DESKTOP_UI_PHILOSOPHY.md`, `docs/MODAL_INPUTS.md`.
