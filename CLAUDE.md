# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Goals (vize1215 fork)

This is `vize1215`'s personal fork — a private/self-hosted build of the open-source `terraforming-mars` project. The active UI work is driven by these goals; weigh decisions against them when proposing or making changes:

1. **Single-screen, no-scroll play.** The active game state (board, current player's resources/tags, hand, played-cards filter, etc.) should fit on screen at typical desktop resolutions. Long pages with vertical scroll are the thing we are getting rid of — content that doesn't fit becomes an overlay or a panel, not a scroll target. The top/bottom bar-button overlays (`bar-overlay--*`) are the canonical mechanism for "secondary" content (Log, Played cards, Milestones, Awards, Standard Projects, Colonies, Cards).
2. **Steam-version visual feel.** The reference for layout density and proportion is the Asmodee Digital Steam release of *Terraforming Mars*: large central board, compact peripheral chrome, board scaled up to dominate the screen as more vertical space is freed.
3. **Ark Nova (BoardGameArena) animation feel.** When choosing animations / transitions / hover effects, lean toward the smoothness of BGA's Ark Nova implementation — short easings, subtle scale/glow on interactive elements, no hard pop-ins. Don't introduce flashy motion just because something is being changed; default to calm.
4. **Active visual refresh.** This fork explicitly wants the game to *feel* more modern than upstream. When touching UI, take the visual freedom to refresh things: sci-fi typography for panels/labels (Prototype, Orbitron-style families that ship with the repo) where the upstream choice is generic; subtle gradient/clip-path borders on grouped blocks (resource clusters, tag clusters) to give a control-panel vibe; consistent dark glassmorphic backgrounds for floating panels. The user will push back if a specific change misses, but the default is "try to improve the look" rather than "match upstream pixel-for-pixel". When in doubt, prefer the most polished option that still respects goals 1–3.

When a change has trade-offs between these goals and any other consideration (closeness to upstream, code volume, edge cases), favor the goals above unless the user says otherwise.

## Action UI Rework (in progress)

This fork is migrating the per-action UI away from upstream's generic `wf-action` + `btn-submit` radio-button form and toward **dedicated styled buttons** on each game element (milestones first, awards / standard projects / convert-plants / colonies to follow). The radio UI still exists and works — once every action type is migrated it will be hidden, not removed.

When you add a new dedicated action button, follow this contract:

1. **Tie the button to the server's action-availability logic, not to the radio render.** Walk the `playerView.waitingFor` tree (recursively, since the prompt can be nested) to find the `OrOptions` whose `title` matches the action prompt (e.g. `'Claim a milestone'`, `'Convert 8 plants into greenery'`). The server has already filtered options by every rule (cost, prerequisites, phase, opponents-have-passed, etc.) — **the option's presence in that tree IS the source of truth for "available right now."** Do not re-derive availability from raw player state on the client.
2. **Submit through `WaitingFor.onsave()`** with the nested `OrOptionsResponse` payload (`{type:'or', index:I, response:{...}}` wrapping recursively, with a `{type:'option'}` innermost). Bypasses the radio UI but is byte-for-byte identical to what `OrOptions.vue` would have sent — no server changes needed. The reference implementation lives in `PlayerHome.vue` → `findMilestoneOptionPath` + `claimMilestone`.
3. **Show the button as disabled, not hidden, when the player meets the conceptual prerequisite (e.g. score threshold) but can't act right now.** Use a `:title` tooltip with the blocker reason translated via i18n. Reasons we distinguish for milestones: insufficient M€ (`Not enough M€`), and not-your-turn / mid-sub-action (`Not your turn to take any actions`). Hiding the button is worse UX — the user is left guessing why an action they're entitled to disappeared.
4. **Don't refactor the existing radio-button stack** (`WaitingFor.vue`, `OrOptions.vue`, `SelectOption.vue`, server prompt code). They have to keep working unchanged while migration is in progress, and the eventual hide is a stylesheet flip — not a deletion.

The Milestones overlay (`MilestonesOverlay.vue` + `PlayerHome.vue` claim handlers) is the canonical example; mirror its detection + submission pattern when you wire up new action buttons.

## UI Philosophy: dedicated buttons vs. mandatory-input modals

This fork is moving toward a layout where the **Actions** section in the player home no longer exists as the catch-all bin for everything the server is waiting on. The goal is single-screen no-scroll play (CLAUDE.md goal #1), and the legacy "scroll from board to actions, pick a radio, hit submit" loop is the single biggest blocker to that.

The replacement model has two distinct kinds of prompts and a different UI surface for each:

**A. Standard top-level actions** — things the player can voluntarily choose to do on their turn from the regular action menu (`Player.getActions()` in `Player.ts`). The full list:
- Play a project card
- Trade with a colony
- Fund an award
- Claim a milestone
- Convert plants / Convert heat
- Use a standard project
- Use an active blue-card action
- Use a CEO one-per-game action
- Send a delegate (Turmoil)
- Pass
- Sell patents
- End turn (intermediate)

Each one of these gets a **dedicated, persistently-visible, styled button** somewhere on the existing UI (in the resource cluster, in the top-bar overlays, on the colony tiles, etc.). The button's enabled state mirrors the option's presence in the action OR — same contract as the milestone/award/convert pattern above. When every action in this list has its dedicated button, the radio-UI rendering will be hidden via stylesheet flip; the underlying `WaitingFor.vue` / `OrOptions.vue` keep working unchanged for the (rare) cases of nested action menus during initial-action prompts.

**B. Mandatory sub-prompts** — things the server requires before the player can do anything else: payment selection, "pick a card to discard", "choose a player to steal from", "choose a space to place a tile", color picks for global events, payment of Reds tax, etc. These don't belong in a sidebar list — they're MODAL, not optional, and they arrive in response to an earlier action (or a forced game event).

For these, the fork uses a **centered modal popup** that:
- Renders over a darkened backdrop covering the entire viewport
- Disables interaction with the rest of the UI (no clicking the board, no opening overlays, no switching displayed player)
- Cannot be dismissed by clicking outside — only by completing the prompt (or by Reset/Undo flowing through the same submission infrastructure)
- Is sci-fi-styled to match the rest of the fork (dark glass + cyan accents + L-corner ticks)
- Hosts the actual input component via `<PlayerInputFactory>` so all existing input types work without per-component rewrites

The submission infrastructure (`WaitingFor.onsave()` → POST `/api/player-input`) stays unchanged — the modal just hosts the input UI in a different place visually. When the player completes the prompt and the server responds with a new `playerView` (with `waitingFor` cleared or pointing at the next sub-prompt), the modal unmounts naturally via `v-if`.

**The first pilot of this pattern is `SelectPaymentV2` invoked via `SelectPaymentDeferred`** (Fund Award as Helion, Reds tax, party actions, card payment actions, etc.). The second pilot is the **World Government Terraforming** prompt (`OrOptions` titled `'Select action for World Government Terraforming'`). The implementation lives in `WaitingFor.vue` (top-level detection) + `MandatoryInputModal.vue` (backdrop + centered card chrome) + the hosted input component itself.

**Card selection (draft / buy cards / research)** rides the same rails. `'card'` is in `MODAL_INPUT_TYPES`, so any top-level SelectCard prompt goes through the modal hosted by `CardSelectionContent.vue`. The same component handles draft picks (`min > 0`, mandatory) and buy-card prompts (`min === 0`, optional, with per-card cost). Mode is detected via the prompt title — server's `ChooseCards.ts` always builds "Select … to buy …" for research, which triggers the cost badge + "КУПИТЬ" button label; everything else falls back to "ВЫБРАТЬ". Cost-per-card reads `cards[0].calculatedCost` (server bakes it into every CardModel via `cardsToModel({played: false})`); MC check is `playerView.thisPlayer.megacredits`. PaymentV2 after buy is NOT this modal's problem — it's a separate `SelectPaymentDeferred` the server queues after we submit `{type: 'card', cards: [...]}`, and the existing `'payment'` modal route handles it. Single-click toggles selection in local state; double-click opens our own CardZoomModal with an `#actions` slot button that mirrors the toggle (handles capture-phase dblclick to suppress Card.vue's built-in zoom). Confirm is the only path to `onsave`; minimize-to-pill is inherited from MandatoryInputModal so the player can briefly inspect the board while picks stay intact.

### Client-side payment preview (Standard Projects)

The Standard Projects overlay (`StandardProjectsOverlay.vue` mounted from `PlayerHome`) is a hybrid case: the action OR is in `waitingFor`, but the player picks the project from the OVERLAY, not from the inline radio menu. Two payment paths:

1. **No alternative resources usable** — player has only M€ that can pay (or has alt resources but the project doesn't accept them). The handler in PlayerHome submits the full M€ payment directly through `WaitingFor.onsave()` with a nested `SelectProjectCardToPlayResponse`. No modal.
2. **Alternative resources usable** — at least one non-M€ resource the project accepts is owned by the player (heat for Helion / steel for City+Prefab / titanium for Luna TF / seeds for Greenery+Soylent / Aurorai data / Spire science). A client-side payment-preview modal opens — `StandardProjectPaymentContent.vue` hosted inside `MandatoryInputModal`. The PaymentFormV2 inside lets the player dial in the resource mix. **Two actions**: Confirm submits the chosen Payment; **Cancel closes the modal without any server round-trip** and restores the Standard Projects overlay.

The Cancel button is UNIQUE to this client-side flow. Regular server-driven modals (Fund Award, WGT, etc.) can't be cancelled because the server has already committed the preceding step. Standard Projects is different because nothing has been submitted yet — the player is constructing the response client-side. When extending this pattern to other "client-driven" flows (e.g. action menu reskin if it ever happens), follow the same shape: `MandatoryInputModal` wrapper + sci-fi content component + Confirm/Cancel button pair.

When extending the pattern to other input types (SelectCard for "discard X", SelectPlayer for "steal from", etc.), the contract is:

1. **Don't gate by `type` strings inline.** Detection lives in `WaitingFor.vue`. For inputs whose `type` itself implies "must be modal" (like `'payment'`), add the type to `MODAL_INPUT_TYPES`. For specific instances of a shared type (like the WGT `OrOptions` which shares `'or'` with the regular action menu), add the title to `MODAL_OR_TITLES`. The unified `shouldRouteToModal()` predicate gates both.
2. **The hosted component must work both inside and outside the modal.** When the radio-UI legacy flow renders the same input inline, it must still function. Don't add modal-specific props or state — render the same `<PlayerInputFactory>` either way.
3. **No backdrop-click dismiss.** The modal is mandatory by definition. If you need a "cancel and pick a different action" affordance, add an explicit Reset button inside the modal that calls the existing `WaitingFor.reset()` path.

### Modal "minimize" — let the player inspect the UI before deciding

Mandatory by definition doesn't have to mean "blocks every other pixel forever." Some decisions need context the player doesn't have at the moment the prompt fires — e.g. before funding an award the player may want to compare their tableau against opponents'; before raising a global parameter via WGT they may want to check whether an opponent is one step away from a milestone bonus. Forcing them to commit blind degrades the play experience.

To handle this, `MandatoryInputModal.vue` exposes a **minimize** affordance:

- A `↗` minimize button sits in the top-right of the modal card.
- Click it: the card collapses up + fades out, the backdrop becomes click-through, a sci-fi pill appears at the top of the viewport (below the top-bar buttons, NOT covering them) labelled `AWAITING DECISION — <prompt title>` with a pulsing cyan indicator dot.
- While minimized the player can interact with the whole rest of the UI (board, sidebar, top-bar overlays, opponent tableaus) but cannot trigger new actions — every action button reads `playerView.waitingFor` to decide enabled state, and because the server is still waiting on this modal prompt, all action buttons are naturally disabled. No extra client-side blocking required.
- The pill lives in its **own** `<Teleport to="body">` (separate from the modal wrapper) so it has an INDEPENDENT stacking context. z-index 107 — above top-bar buttons (z=105) and the Awards / Milestones badge strips that hang under them (z=106), BELOW bar-overlays (z=110). When the player opens an Awards / Milestones / Standard Projects overlay to inspect info before deciding, the overlay cleanly covers the pill; closing the overlay brings the pill back. The pill defaults to `top: calc(var(--bottom-bar-button-height) + 32px)` (≈ y=68px, leaves room above for the initial-draft pill-stack which sits at top:14 with height ~34px) and is draggable — see "Draggable pills" further down.
- Click the pill (or hit Enter/Space when focused): the modal expands back to full size with the original input state intact.
- Picker-mode (board-tile selection) is mutually exclusive with minimize — entering picker auto-cancels minimize, the modal hides via picker rules instead.
- A new top-level prompt firing (e.g. one SelectPayment resolves and a follow-up SelectPayment fires) auto-resets minimize state so the player doesn't miss the new prompt.

The minimize state lives in the `MandatoryInputModal` component itself, so it resets cleanly whenever the modal unmounts (e.g. server resolves the prompt).

### Modal "picker mode" — board interaction inside a modal prompt

Some modal-hosted prompts contain options that need the player to click on the board (e.g. the WGT `OrOptions` has an `'Add an ocean'` `SelectSpace` option). The modal's opaque backdrop would block board clicks, so we have a **picker-mode** mechanic:

- `MandatoryInputModal.vue` exposes a `mandatoryModalSetPickerMode(active: boolean)` function via Vue `provide()`. The key is exported as the `MANDATORY_MODAL_PICKER_SETTER` constant.
- `OrOptions.vue` `inject`s this function (`default: undefined` so it stays optional for inline use) and calls it from its `selectedOption` watcher: `true` when the picked option's `type === 'space'`, `false` otherwise. Also called with `false` in `beforeUnmount` so the flag doesn't get stuck.
- In picker mode the modal CSS class makes the backdrop transparent + `pointer-events: none` (board clickable underneath), and the card fades + shifts to the top of the viewport so it doesn't obscure the board. Hovering the card brings it back to full opacity so the player can re-pick a different option without finishing the board interaction.

If a future modal hosts a different input type that needs board interaction (e.g. a top-level `SelectSpace`), wire it to call the same picker-mode setter from its `mounted()` / `beforeUnmount()`. Don't reinvent the mechanism per input type.

### Tile placement banner + placement lock (`PlacementBanner`)

The fork unifies the "game is waiting for a tile placement on the Mars board" UX behind a single component: `src/client/components/PlacementBanner.vue` (pill + details modal). **The contract: any time the game wants the player to click on the planet — top-level, nested, server-driven, client preview — a PlacementBanner appears so the player can't miss the state.** Banner mounts in three places, one per signal source:

- **Mandatory, top-level** (server-driven): `WaitingFor.vue` mounts it whenever `waitingfor.type === 'space'` — covers standard projects (city / greenery / aquifer placement after submit), card behavior tiles, global event placements. `cancellable: false`.
- **Cancellable** (client-driven picker preview): `PlayerHome.vue` mounts it when `convertPlantsPickerActive && convertPlantsPrompt !== undefined`. Server is still in OrOptions (action menu); the picker is a client-side preview. `cancellable: true` → details modal exposes "Отменить размещение", which emits `'cancel'`. Host wires that to its picker-toggle method.
- **Mandatory, modal-nested** (modal-driven): `MandatoryInputModal.vue` mounts it whenever its picker-mode is active. Picker-mode is set by `OrOptions.vue`'s `selectedOption` watcher when the picked option's `type === 'space'` (WGT "Add an ocean" today; any future nested SelectSpace hosted in a modal works through the same path). The picker-mode setter now passes the option's `title` alongside the active flag so the banner reads "AWAITING PLACEMENT / Add an ocean" instead of falling back to a generic name. `cancellable: false` (the host OrOptions provides the "pick a different option" affordance via its faded-on-hover modal card; exposing Cancel here would duplicate it).

Three independent signal sources need coordination so the global lock (next paragraph) sees a single boolean. That's handled by `src/client/components/placementLockState.ts` — a module-level Vue `reactive()` object. The convert-plants and server-driven sources are read directly by PlayerHome's `placementPending` computed (from `playerView.waitingFor` and `convertPlantsPickerActive`); the modal-driven source is written to `placementLockState.modalPicker` by MandatoryInputModal's `provide()`'d setter and read by the same computed. The banner title for the modal-driven source rides through `placementLockState.modalPickerTitle`. When you add a NEW signal source for board-placement waiting (e.g. a future picker that doesn't go through any of these three paths), add a flag to `placementLockState`, write to it from the new source, and OR it into PlayerHome's `placementPending` computed.

**Draggable pills.** Both PlacementBanner and the MandatoryInputModal minimized pill default-position at `top: calc(var(--bottom-bar-button-height) + 32px)` (≈ y=68px) — leaves vertical breathing room above for the initial-draft pill-stack (`.initial-draft-pills`, top:14, h:34), and still keeps the pill clear of the topmost board labels. If the player still finds the pill blocking a board hex they need to click, the pill is draggable via `src/client/components/draggable.ts` (`makeDraggable(element, position)`). Drag clamps to the viewport so the pill can't be dragged off-screen. Click-vs-drag is distinguished by a 5-px movement threshold; a no-drag click still fires the host's @click handler (open details / restore modal), a drag-then-release suppresses the click via a one-shot capture-phase listener. When you add a new "awaiting prompt" pill to the same family, wire it through `makeDraggable` in the same `mounted()` / `beforeUnmount()` pattern and use the same `:style="dragStyle"` binding (returns `{}` at default position so CSS animations / transitions on `transform` are preserved).

The legacy `.wf-select-space` prompt header (containing the "Choose a location for ocean tile" text and the `<GoToMap>` "перейти к карте" link) is hidden via `display: none` in `placement_banner.less`. `SelectSpace.vue` still mounts through `PlayerInputFactory` so its `mounted()` hook attaches board-tile click handlers and adds `.board-space--available` highlighting — only the in-flow text header disappears.

**Placement lock — turn-ending action buttons are disabled while the placement is pending.** `PlayerHome.vue` computes `placementPending` (true when either flow above is active) and a watcher toggles `body.placement-pending`. `placement_banner.less` then locks a curated list of action-button selectors. View interactions (opening Cards / Colonies / Awards / Milestones / Standard Projects overlays for inspection, browsing the hand, clicking opponent panels, reading the log, scrolling the board) stay fully interactive — only buttons that submit a turn-ending response are locked.

Lock mechanics (CSS for visuals, JS for actual blocking):
- CSS in `placement_banner.less`: each locked-selector match gets `opacity: 0.45 + filter: saturate(0.55) + cursor: not-allowed` for the visual "this is disabled right now" signal. **No `pointer-events: none`** — that would also suppress the native browser `title` tooltip we use for the explanation. **No `::after` overlay** — pseudo-elements don't intercept click events (click target is the host); the overlay-as-blocker trick doesn't work.
- JS click block in `PlayerHome.installPlacementGuards()`: a capture-phase listener on `document` runs BEFORE Vue's `@click` handlers (which compile to bubble-phase `addEventListener`). When the event target is inside a `PLACEMENT_LOCKED_SELECTORS` match, the guard calls `preventDefault` + `stopImmediatePropagation`. `stopImmediatePropagation` kills the event completely — no further listeners run, no submit happens. Capture phase guarantees the guard runs first regardless of where Vue attached the @click.
- Tooltip via the native browser `title` attribute. The same `installPlacementGuards` walks every currently-mounted locked button and sets `title="Сначала завершите текущее действие"` (translated via `translateText('Finish your current action first')`, i18n key already in `ru/ui.json`), caching any pre-existing `title` value into a `data-placement-orig-title` attribute. A capture-phase `mouseover` listener catches buttons that get mounted AFTER the lock kicks in (e.g. an overlay opening mid-placement) and applies the title on first hover. `uninstallPlacementGuards` restores originals on unlock.

**When you add a NEW dedicated action button** (per the "Action UI Rework" migration list above — sell patents, blue-card action, CEO one-per-game action, delegate placement, etc.), you MUST add its CSS class in TWO places:
1. The selector list in `src/styles/placement_banner.less` under `body.placement-pending { … }` (visual dim).
2. The `PLACEMENT_LOCKED_SELECTORS` array near the top of `src/client/components/PlayerHome.vue` (click block + tooltip).

Both must stay in sync — CSS alone won't block clicks, JS alone won't visually dim. Skipping either lets the player commit that action mid-placement, leaving the cancellable picker silently stale (cancellable case) or accepting an out-of-order submit that the server will partially process (mandatory case). Reasoning is the same as for the existing rule: while a tile placement is pending, the player must explicitly cancel via the banner before doing anything else that ends the turn.

Current locked selectors (keep in sync with the LESS file):
- `.left-panel-card-action-btn` (parent class — applies dim + click-block to any future left-panel turn button)
- `.std-project-use-btn`
- `.milestone-claim-btn`
- `.award-fund-btn`
- `.convert-action-btn--heat`
- `.convert-action-btn--plants`
- `.colony-tile__select-btn` (Select on a colony tile — trade and Build Colony both flow through it)
- `.colony-detail__select-btn` (Select inside the ColonyDetailView popout)
- `.wf-action` (legacy radio submit — temporarily catches everything still migrating; remove from the list once every action in the migration list above has its own dedicated button + selector)

**Special-cased to HIDE instead of dim** — two specific left-panel variants. Per UX call: a dimmed "Pass" in the corner during a placement reads as "stuck, maybe I should mash Pass to escape" and misleads the player. They reappear automatically when the placement is cancelled / committed (`body.placement-pending` class is removed):
- `.left-panel-card-action-btn--pass`
- `.left-panel-card-action-btn--end-turn`

**Use `visibility: hidden`, NOT `display: none`.** There's a standing UX contract that the left player panel's geometry stays stable when these buttons appear / disappear — the rest of the panel (labels, resource counters) must not reflow between turns. `display: none` collapses the layout slot and breaks this contract; `visibility: hidden` keeps the slot intact and only suppresses the paint + pointer events. If you find another button that should "hide" mid-placement, use the same `visibility: hidden` approach unless you've verified that collapsing its layout slot is genuinely safe.

Known gaps (add selectors as those flows get dedicated buttons):
- Send-delegate (Turmoil) — flows through `wf-action` for now; will need its own selector when the dedicated delegate UI lands.

If you add a button but the placement-lock list doesn't have a natural home for the selector (e.g. it's a generic name like `.btn` that's used elsewhere), make the new button-specific class first and lock that. Don't broaden the selector list with generic names — it will quickly re-disable inspection UI you want to keep open.

## Journal (game log) — premium side-panel

The bottom-bar **Log** button no longer opens a `bar-overlay`; it toggles a dedicated `journalOpen` boolean in `PlayerHome.vue` that mounts `src/client/components/journal/JournalPanel.vue` — a glass/HUD side panel pinned to the right gutter. Opening it adds `#player-home.journal-open`, which slides the Mars board LEFT via `transform: translateX(...)` on `.player_home_block--board` (see `journal.less`). **The board scale is never touched** — only the centred box is translated, so `--board-scale` / `useBoardAutoScale` stay untouched (CLAUDE goal #3). The panel occupies the freed space between the board and the right sidebar; closing it slides the board back. The journal is NOT a `bar-overlay` (z-index 95, below overlays z=110), so opening any bar-overlay cleanly covers it and closing reveals it again. `toggleJournal()` closes any active `activeOverlay` when opening so the panel isn't hidden behind one.

**Data source is reused, presentation is new.** The server side is unchanged: `GET /api/game/logs?id=&generation=` returns structured `LogMessage[]` (NOT HTML), each a template string + typed `LogMessageData[]` tokens (`LogMessageDataType`: PLAYER, CARD, CARDS, SPACE, COLONY, GLOBAL_EVENT, TILE_TYPE, AWARD, MILESTONE, PARTY, UNDERGROUND_TOKEN, …). `Log.parse()` splits a message into an ordered `(string | LogMessageData)[]`. The legacy `logpanel/` components (`LogPanel`, `LogMessageComponent`, `CardPanel`) are LEFT INTACT — still used by `SpectatorHome.vue` and `GameEnd.vue`. Do not delete them.

Component framework (`src/client/components/journal/`):
- `JournalPanel.vue` — fetch + state + **live feed**. Watches `step` (bumped on every server response): while *following latest* (`followLatest`, true when viewing the current generation) it re-fetches the current generation so new entries stream in; a new generation auto-follows. Selecting an older generation drops out of follow mode → static history; selecting the current one re-engages live. `loadEpoch` is bumped ONLY when a different generation is loaded, so the feed can tell "whole-list swap" (silent) from "appended live" (animate the tail).
- `JournalGenerationSelector.vue` — custom glass dropdown (NO native `<select>`), keyboard-operable, latest-first, outside-click close. Esc on the open menu is `.stop`ped so it closes the menu without bubbling to the panel's Esc-to-close.
- `JournalFeed.vue` — scroll container. Custom thin scrollbar (CSS only). Auto-scrolls to follow new entries only when the player is at the bottom; if scrolled up it shows an unobtrusive "New events ↓" pill instead of yanking. Append-only assumption (within a generation the log only grows) → diffs by length. `:key="index"` so the prefix is reused and only the fresh tail mounts + animates.
- `JournalEntry.vue` — one row; `NEW_GENERATION` messages render as a divider, else time gutter + tokens. `animateIn` is set only for freshly-appended live rows.
- `JournalTokenRenderer.vue` — the switchboard turning one parsed token into a semantic chip. Mirrors the legacy `typeof === 'string'` + discriminated-union narrowing structure so `vue-tsc` narrows the same way. SPACE → a "show on map" button (never leaks the raw id) that calls `boardCellHighlight.ts`.
- `JournalCardChip.vue` — a single card token. Project cards: hover → `CardPreviewPopover` (small floating `<Card>`), click → fullscreen via the existing `CardZoomModal`. **Standard projects** (detected by `getCard(name).type ∈ {standard_project, standard_action}`) → hover → `StandardProjectPreviewPopover` (compact pictogram + effect, reusing `overview/standardProjectVisuals.ts` `PROJECT_VISUAL`), and NEVER open fullscreen. `_STANDARD_PROJECT` is a dead `LogMessageDataType` — standard projects arrive as CARD tokens.
- `boardCellHighlight.ts` — premium cell pulse. Toggles `.journal-pulse` on the existing `.board-log-highlight[data_log_highlight_id]` overlay (BoardSpace/MoonSpace already render it); `journal.less` drives a calm 2–3 ring `drop-shadow` pulse. Does NOT scroll the viewport (board is fixed + slid left, so the cell is already visible — "поле не должно резко прыгать").

Conventions: prefer transform/opacity animation, honour `prefers-reduced-motion` (handled in `journal.less`), no native `title` tooltips inside the journal (use `aria-label` + visible labels). When you add a new token type, add a `v-else-if` branch in `JournalTokenRenderer.vue` and a `.journal-token--*` style; don't render raw HTML.

## Build & Development Commands

```bash
npm run build                # Full build: CSS + JSON static files, server (tsc), client (webpack)
npm run build:server         # TypeScript compile server only: tsc --build src/tsconfig.json
npm run build:client         # Webpack production bundle (runs make:cards first)
npm run build:test           # Compile tests: tsc --build tests/tsconfig.json
npm run lint                 # All lints: eslint + i18n audit + vue-tsc
npm run lint:client          # Vue type checking: vue-tsc --noEmit
npm run lint:server          # ESLint on src and tests
npm run lint:fix             # ESLint autofix
```

### Running Tests

```bash
npm run test                 # All tests (server + client)
npm run test:server          # Mocha server tests (~6700 tests)
npm run test:client          # Mochapack client component tests

# Single server test file
npx mocha --import=tsx --require tests/testing/setup.ts "tests/cards/base/Algae.spec.ts"

# Single client test file
cross-env NODE_ENV=development mochapack --require tests/client/components/setup.ts "tests/client/components/Board.spec.ts"
```

### Dev Servers

```bash
npm run dev:server           # Server with hot reload (tsx watch)
npm run dev:client           # Webpack watch mode
npm run watch:less           # CSS rebuild on change
```

## Architecture

### Three-Layer Structure

- **`src/server/`** - Game engine, card logic, routes, database. Runs on Node.js.
- **`src/client/`** - Vue 3 frontend (Options API, `defineComponent`). Bundled with Webpack.
- **`src/common/`** - Shared types, enums, and models used by both client and server. No runtime logic that depends on either side.

The `@/` import alias maps to `./src/` (configured in tsconfig paths and webpack).

### Card System

Cards are the core domain object (~1000 cards across 15 modules). Each card involves:

1. **Card class** (`src/server/cards/<module>/CardName.ts`) - Extends `Card` (or `ActionCard` for cards with repeatable actions). Defines cost, tags, requirements, behavior, and metadata. Simple cards are purely declarative via the `behavior` property. Complex cards override `bespokePlay()`, `bespokeCanPlay()`, `bespokeCanAct()`, `bespokeAction()`.
2. **CardName enum entry** (`src/common/cards/CardName.ts`) - Every card needs an enum value here.
3. **Module manifest** (`src/server/cards/<module>/<Module>CardManifest.ts`) - Registers the card's factory in a `ModuleManifest`. Base cards use `StandardCardManifests.ts`. All manifests aggregate in `AllManifests.ts`.
4. **Card renderer** - Defined inline in the card's `metadata.renderData` using the `CardRenderer.builder()` DSL.
5. **Test** (`tests/cards/<module>/CardName.spec.ts`) - Uses `testGame()` and `TestPlayer` helpers.

Card types: `EVENT`, `ACTIVE` (has action), `AUTOMATED`, `PRELUDE`, `CORPORATION`, `CEO`, `STANDARD_PROJECT`, `STANDARD_ACTION`.

**Card vs ActionCard**: Extend `Card` for automated/event cards. Extend `ActionCard` for ACTIVE cards with a repeatable action — `ActionCard` enforces that an `action` behavior is defined and provides `canAct()`/`action()` wiring automatically.

### Behavior System

The `Behavior` type (`src/server/behavior/Behavior.ts`) is a declarative DSL for card effects: production changes, resource gains/losses, tile placement, TR changes, global parameter increases, drawing cards, etc. Cards set `behavior` (on play) and/or `action` (repeatable) properties. The `BehaviorExecutor` (`src/server/behavior/Executor.ts`) interprets these at runtime. Prefer declarative `behavior` over imperative `bespokePlay()` overrides when possible.

### Deferred Actions

Player choices and multi-step effects use `DeferredAction` (`src/server/deferredActions/`). Actions are queued via `game.defer(action)` with a `Priority` and resolved in order. The `.andThen()` callback chains follow-up logic after a deferred action resolves.

### Player Inputs

When a player needs to make a choice, the server returns a `PlayerInput` (e.g., `SelectSpace`, `SelectCard`, `OrOptions`). These live in `src/server/inputs/`. The client renders the appropriate UI based on the input type.

### Game Modules (Expansions)

Each expansion has its own directory under `src/server/cards/` and a manifest. Source directories: `base`, `corporation` (Corporate Era), `promo`, `venusNext`, `colonies`, `prelude`, `prelude2`, `turmoil`, `community`, `ares`, `moon`, `pathfinders`, `ceos`, `starwars`, `underworld`, `delta`. Test directories under `tests/cards/` mostly mirror these (note `tests/cards/ceo` vs `src/server/cards/ceos`). Cross-expansion card compatibility is declared via `compatibility` in `CardFactorySpec`.

### Client Components

Vue 3 with Options API. Components are in `src/client/components/`. The root `App.ts` routes between screens. `PlayerHome.vue` is the main game view. Card rendering components are in `src/client/components/card/`. Styles use Less (`src/styles/`).

### Database

Pluggable backends in `src/server/database/`: `SQLite`, `PostgreSQL`, `LocalFilesystem`. Games are serialized/deserialized through `SerializedGame`/`SerializedPlayer` types. `GameLoader` handles caching and retrieval.

### Testing Patterns

- **`testGame(n, options?)`** (`tests/TestGame.ts`) - Creates a game with n players, returns `[game, ...players]` as a tuple. Skips initial card selection and disables Ares hazards by default.
- **`TestPlayer`** (`tests/TestPlayer.ts`) - Extends `Player` with test utilities like `popWaitingFor()`.
- **Test utilities** (`tests/TestingUtils.ts`) - Key helpers: `runAllActions(game)` (process deferred action queue), `cast(value, class)` (type-safe cast for PlayerInputs), `setOxygenLevel()`, `setTemperature()`, `addOcean()`, `addGreenery()`, `addCity()`, `fakeCard()`.
- Server card tests: instantiate the card, call `canPlay()`/`play()`/`action()`, assert state changes. Call `runAllActions(game)` after actions that queue deferred actions.
- Client tests: use `@vue/test-utils` mount/shallowMount with JSDOM setup from `tests/client/components/setup.ts`.
- Test framework: Mocha + Chai (expect style). Client tests use mochapack.

### Internationalization

Custom i18n via `src/client/directives/i18n.ts` with `v-i18n` directive. Translation files in `src/locales/`. Strings are matched by exact text content.

**Russian (ru) translations — terminology consistency.** Before inventing a new Russian translation for a term, check two sources, in order:

1. **The project itself.** Grep `src/locales/ru/` for the term (or close variants — singular/plural, case-different) and reuse the existing wording. Examples already established: `Building → Здание`, `Space → Космос`, `Science → Наука`, `Power → Энергия`, `Earth → Земля`, `Venus → Венера`, `Plant → Растение`, `Microbe → Бактерия`, `Animal → Животное`, `Event → Событие`, `Wild → Любая`, `VP → ПО`, `researching → исследование`, `passed → спасовал`. Iconography terms live in `help_iconography.json`; UI labels in `ui.json`; log templates in `log_messages.json`; game-end strings in `game_end.json`.
2. **The official Russian edition of the *Terraforming Mars* board game** (Crowd Games / «Покорение Марса»). Game-specific terms — tag names, milestone/award names, standard project labels, resource names — should match the printed Russian cards. If a project translation contradicts the board-game canon, surface the discrepancy to the user rather than silently picking one.

Never translate proper nouns that look like player names or English card names already in the player log unless they appear in a translation file.

**NEVER modify the Russian translation of an English key you didn't introduce yourself.** The same English string can appear in many places — log messages, card descriptions, tooltips, UI labels — each with its own context. Changing `"Convert" → "Превратить"` to make your new button read nicely will silently rewrite "Convert" everywhere else in the game (action logs, card flavor text, etc.) and break the meaning. Instead, **introduce a new English key** for your UI element (e.g. `"Spend"` or `"Convert plants action button"`) and add its translation. If you really must reuse an existing key, first `grep` every usage of that English string in `src/client/`, `src/server/` and the other `src/locales/<lang>/` files, confirm the new wording fits ALL of them, and call it out in your summary.

**Before adding a translation key, `grep` for the EXACT key across ALL files in `src/locales/<lang>/` to make sure it doesn't already exist.** The static-json build tool (`src/tools/make_static_json.ts:85`) aggregates every JSON file under a language directory into a single dictionary and **throws on duplicate keys** with `ru: Repeated translation for [...]`. The duplicate can be in `ui.json`, `UI_cards.json`, `game_end.json`, `log_messages.json`, `help_iconography.json`, etc. — same key in two files crashes the build. Run e.g. `grep -nE '^\s*"card":' src/locales/ru/*.json` for every key you intend to add. If a match exists and its translation already fits your use, reuse it (don't add a duplicate). If the existing translation doesn't fit, pick a different more-specific English key for your context.

### Centering UI under a `<Card>`

`.card-container` carries a legacy **asymmetric** margin from `src/styles/cards.less:90`: `margin: 15px 30px 10px 0px`. This was originally for inter-card spacing in grid layouts (OtherPlayer played-cards row, SortableCards hand, etc.).

The 30-px right margin makes a wrapping element's bounding box **30 px wider than the visible card**. The card silhouette sits flush-left within that box; the right 30 px is empty space. **Any centered UI placed under the card (in a flex column / grid column whose width is driven by the card)** will land ~15 px right of the card's visual centre because the parent centers the wider bounding box, not the visible card.

**Rule:** when you mount custom UI (buttons, badges, status chips) below a `<Card>` in a flex column / grid column and expect it to read as centered on the card silhouette, **zero out `.card-container`'s margin in your wrapper's scope**:

```less
.your-slot-wrapper > .card-container {
    margin: 0;
}
```

Don't try to compensate by shifting the UI manually (e.g. `margin-left: -15px`) — `.card-container`'s margin changes with zoom (the media-query ladder in `card_selection.less` scales `.card-container` between 1.0 and 0.68) and the offset would drift across breakpoints.

The reference implementation is `.card-selection__card-clickable > .card-container { margin: 0; }` in `src/styles/card_selection.less`. Mirror that pattern for any new flow that stacks UI under a Card (e.g. future hand-card "РАЗЫГРАТЬ" button, opponent-tableau action buttons).

Inter-card horizontal spacing in your grid should be owned by the parent container (`gap`, `grid-column-gap`, etc.) — independent of `.card-container`'s own margin, which only matters for legacy non-flex layouts.

### Logging

Game actions are logged via `game.log()` and `player.log()` which accept template strings with `${player}`, `${card}`, `${amount}` style placeholders and corresponding `LogMessageData` entries. Log statements appear in the game's action log visible to players.

## Style Guide

- Follow the style of the code around the file. If this is a new file, follow the style of the code in the directory.
- ESLint uses flat config (`eslint.config.mjs`). Run `npm run lint:fix` for autofix.
