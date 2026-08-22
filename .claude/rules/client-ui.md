---
description: Shared client rules — desktop freeze, no-remount update model, tooltips, Card hosting, server-authoritative availability.
paths:
  - "src/client/**"
  - "src/styles/**"
---

# Client UI rules

## Desktop UI is BEING DELETED in waves (policy 2026-08-22; frozen since 2026-07-15)
The fallback guarantee is DROPPED: the future desktop UI will be built FROM the console shell, so the frozen `PlayerHome.vue` + overlay stack are dead weight scheduled for deletion, never a surface to fix. **Wave 1 (done)**: console unconditional (`consoleModeState.enabled` always true; `?console=0` / stored `tm_console_mode='0'` never read again; the settings shell switch and hold-Menu toggle removed), App.vue no longer references `PlayerHome` / DraftFlowOverlay / StartGameFlowOverlay / DrawCardRevealFlow / RevealResultOverlay / MaCeremonyOverlay / BotTurnReviewOverlay / desktop JournalPanel / RevealedCardsModal. Files remain on disk until later waves remove them by import graph (floors, locales and the upstream-sync «keep deleted» policy ride those waves).

⚠️ **LOAD-BEARING legacy — the console stands on these; replace BEFORE deleting:**
1. `WaitingFor.vue` — the transport (poll chain + every submission via `onsave()`), mounted headless inside ConsoleShell. Extract a headless module first.
2. Legacy `Card.vue` renderer — the LIVE face for CEOs only (routed by `CardFace.vue`; `ConsoleCardFaceLite`'s legacy branch + its icon CSS); standard projects/actions moved to the premium face in wave 2. Premium pass first.
3. `MandatoryInputModal` — the honest fallback for the degenerate `projectCard` prompt (console-ui rules § shell sections). Console equivalent first.
4. Everything `@console-shared` (below) — not desktop at all.

Markers: `@deprecated Desktop-only UI (frozen 2026-07-15)` vs `@console-shared`; full inventory `docs/DESKTOP_DEPRECATION_AUDIT.md`.

**The SHARED layer is not deprecated** and keeps full quality bars: `src/common/` models, pure view-models (`victoryPointsModel`, `effectSummary`, `insightEngine`, `endgameFacts`, `journalView`, …), module reactive state (`journalState`, `notificationState`, `presentationFlow`, …), the premium card face (`.pcard`), `motionTokens`.

## Update model — NO remount
`<player-home>` lives for the whole session; a response applies `playerView` reactively.
- **`playerkey` is the transient-UI RESET EPOCH, not a `:key`.** New transient PlayerHome state that a submit must clear MUST be reset in `resetTransientUi()` — never assume a remount clears it.
- **Structural sharing** (`viewSnapshotShare.ts`): the root identity always changes, unchanged children keep their refs. **Never add an identity-watcher expecting per-response firing on a SUB-object of `playerView`** — watch VALUES (`gameAge`, `undoCount`, the concrete field).
- Anything that used `mounted()` to re-derive per-response state uses a value-based watcher instead.
- Rollback ladder: `?patch=0` (no sharing), `?remount=1` (legacy keyed remount). The baseline modules (`accentBaseline`, `tileBaseline`, cube baseline) exist to carry that mode — not dead code.

## Prompt detection + submission (load-bearing)
- **Availability is SERVER-authoritative.** Walk the `waitingFor` `OrOptions` tree; the option's PRESENCE is the source of truth. Submit via `WaitingFor.onsave()` with the nested `OrOptionsResponse` payload — byte-identical to the radio UI, no server change. Never re-derive availability from raw player state.
- **⚠️ NEVER detect a prompt by its title text.** i18n mutates `Message.message` IN PLACE on render, so an English-text match silently stops matching after the first render (this leaked a legacy modal back in). Use a server marker (`startGamePrompt`, `choiceContext`, `placementContext`, `awardFundingPrompt`, `reveal`) or another structural signal. The one surviving title check (the action menu) is safe only because that title isn't mutated.
- Show a blocked action DISABLED with a reason, not hidden.
- Don't refactor the legacy radio stack (`WaitingFor.vue` / `OrOptions.vue` / `SelectOption.vue`) — it must keep working until a stylesheet flip hides it.
- **`PLACEMENT_LOCKED_SELECTORS` must stay in sync in TWO places** when adding a turn-ending button: the array in `PlayerHome.vue` (JS click-block) AND `src/styles/placement_banner.less` (visual dim). CSS alone won't block clicks; JS alone won't dim.

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
