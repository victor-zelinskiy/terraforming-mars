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

**The board-input rework**: `SelectSpace.vue`/`GoToMap.vue` are DELETED — `ConsoleBoardInput.vue` (components/console) is the console-native cell-binder (same live machinery: availability/illegal classes + BRD-3 mirrors, premium hover popovers, the confirm dialog, the one `armTilePlacement` point, surgical teardown). **No load-bearing legacy file is left** — everything the console stands on is console-native or `@console-shared` (below).

Markers: `@deprecated Desktop-only UI (frozen 2026-07-15)` vs `@console-shared`; full inventory `docs/DESKTOP_DEPRECATION_AUDIT.md`.

**The SHARED layer is not deprecated** and keeps full quality bars: `src/common/` models, pure view-models (`victoryPointsModel`, `effectSummary`, `insightEngine`, `endgameFacts`, `journalView`, …), module reactive state (`journalState`, `notificationState`, `presentationFlow`, …), the premium card face (`.pcard`), `motionTokens`.

## Update model — NO remount
The game subtree (`<ConsoleShell>`) lives for the whole session; a response applies `playerView` reactively.
- **`playerkey` is the transient-UI RESET EPOCH, not a `:key`.** New transient UI state that a submit must clear MUST be reset via the epoch (module states register reset callbacks) — never assume a remount clears it.
- **Structural sharing** (`viewSnapshotShare.ts`): the root identity always changes, unchanged children keep their refs. **Never add an identity-watcher expecting per-response firing on a SUB-object of `playerView`** — watch VALUES (`gameAge`, `undoCount`, the concrete field).
- Anything that used `mounted()` to re-derive per-response state uses a value-based watcher instead.
- Rollback: `?patch=0` (no structural sharing). The `?remount=1` / `tm_remount` legacy keyed remount was RETIRED (2026-08-23) — `legacyRemount.ts` is deleted and nothing keys on `playerkey`. The baseline modules (`accentBaseline`, `tileBaseline`, cube baseline) stay — the live board diffing / hydration paths read them, not dead code.

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

## The LOBBY («Мои партии») — a source has a STATUS, and «пусто» is one of four answers
The game listing is ONE model (`mainMenu/lobbyState.ts`) over N SOURCES — this device's server plus every LAN host; `lanState.ts` is discovery only (who is out there), never listing. Four rules, each of which shipped broken once:
- **`idle` ≠ `loading` ≠ `ok` ≠ `unreachable`, and «У вас пока нет партий» may ONLY be rendered for `ok`.** A never-asked list, a failed fetch and an empty library used to print the same sentence, so a party that existed read as one that did not.
- **The identity is an INPUT, not a precondition.** It can arrive after the first frame (Steam prefill, profile roster); a screen that reads it once in `mounted()` and never watches it needs an APP RESTART to recover. `setLobbyIdentity` is the reload path.
- **Opening the screen is an unconditional REFRESH** of every source; a cross-session cache seeds the first paint and never satisfies a load. Push (`lobbyChannel.ts` → the realtime LOBBY room) is primary, the poll is a self-re-arming floor (30 s live / 5 s otherwise while open).
- **Nothing disappears silently:** a failed refresh keeps its rows; a LAN host that stops answering keeps them marked + un-enterable for a few rounds; only discovery dropping the host removes them at once.
⚠️⚠️ **And the LAN half is not a client problem at all: mDNS FINDS a host, a SOCKET says it is still there.** `bonjour-service`'s Browser emits `up` ONCE per service and never re-announces one it already holds, so a «last seen» fed from it freezes at discovery — the TTL sweep reading it deleted EVERY host 45 s after finding it, permanently, and only an app restart brought it back. That was the actual bug behind «партий по локальной сети не видно»; reworking the client did nothing for it. `lanDiscovery.ts` now re-reads presence from `browser.services` and decides liveness with a raced TCP connect — all of it in one sockets-free engine (`HostRegistry`) whose four invariants are: presence is ADDITIVE (an empty browser list removes nothing — `rebuildLinks()` on a Wi-Fi/VPN change makes it empty), only a socket removes, a hidden host keeps its own record and retries, one row per machine. The LAN section speaks in all three states (unreachable + REASON · answered-but-no-seat-with-your-name · stale) and «＋ Добавить хост по адресу» is the way in when multicast is blocked. Every trigger funnels into `refreshLobby()` — adding a trigger must never mean adding a loading path. Server side: `models/lobbyIndex.ts` (a per-game record + a revision; `IGameLoader.peek()` exists so a bulk sweep never `touch`es the cache). Full contract: `docs/claude/my-games-lobby.md`.

## Deep reference (read on demand, not auto-loaded)
`docs/claude/my-games-lobby.md`, `docs/claude/desktop-ui/` (overlays: played / effects / actions / victory-points / hand-cards, action-UI rework + philosophy, deprecation + update model), `docs/claude/journal.md`, `notifications.md`, `presentation-flow.md`, `board-information.md`, `start-game-flow.md`, `rematch-flow.md`, `modal-inputs-and-metadata-contract.md`, `premium-tooltips.md`, `terraforming-progress-hud.md`, `energy-heat-conversion.md`, `docs/DESKTOP_UI_PHILOSOPHY.md`, `docs/MODAL_INPUTS.md`.
