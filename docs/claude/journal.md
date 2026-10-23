<!-- Reference material moved out of the root CLAUDE.md (2026-07-27 context-budget reorg).
     NOT auto-loaded. Read on demand when working on this subsystem. Verbatim, unedited. -->

## Journal (game log) — premium side-panel

The bottom-bar **Log** button no longer opens a `bar-overlay`; it toggles `journalState.open` (module-level reactive in `src/client/components/journal/journalState.ts`) and `src/client/components/journal/JournalPanel.vue` — a glass/HUD side panel pinned to the right gutter — is mounted at **App level** (`App.vue`, next to `DraftFlowOverlay`).

**Why App-level + module-state, not PlayerHome `data()`:** `App.vue` mounts `<player-home :key="playerkey">` and bumps `playerkey` on every server response — a full remount of the PlayerHome subtree. If the open flag lived in PlayerHome `data()` (or the panel were mounted inside PlayerHome), every board update would reset/destroy it and the journal would close itself + lose its generation/scroll. Mounting the panel at App level (it survives the remount, like the draft overlay) and keeping the flag in `journalState` makes it remount-proof: once opened it stays open until explicitly closed, preserving selected generation, scroll position and live-follow across updates. PlayerHome only READS `journalState.open` (the `journalOpen` computed → drives the `#player-home.journal-open` board-slide class + Log button active state) and WRITES it (`toggleJournal()`, which also closes any active `activeOverlay` so the journal isn't hidden behind one).

Opening it adds `#player-home.journal-open`, which slides the Mars board LEFT via `transform: translateX(...)` on `.player_home_block--board` (see `journal.less`). **The board scale is never touched** — only the centred box is translated, so `--board-scale` / `useBoardAutoScale` stay untouched (CLAUDE goal #3). The panel occupies the freed space between the board and the right sidebar; closing it slides the board back. The journal is NOT a `bar-overlay` (z-index 95). (`#player-home` creates no stacking context, so the App-level panel's z-index composes correctly with PlayerHome's overlays.)

**The journal has priority on screen space — non-modal overlays yield to it.** While the journal is open, the NON-MODAL overlays (`.bar-overlay`, `.top-bar-dropdown`, `.legacy-ui-overlay--open`) pull their `right` edge in to stop just left of the journal (`#player-home.journal-open <selector> { right: calc(var(--right-sidebar-width) + var(--journal-overlay-clearance)) }` in `journal.less`), so they shrink to the free area instead of covering it — same CSS-variable available-space mechanism as the board slide. `--journal-overlay-clearance = journal-gap + journal-width + 16px` breathing room; a `right` transition animates the adjust when the journal is toggled while an overlay is open. **Modals are the explicit exception** (`MandatoryInputModal`, `CardZoomModal`, the colonies overlay, draft overlay) — they are NOT in that selector list and may overlap the journal freely. When you add a new non-modal overlay that should yield to the journal, add its selector to those two rules in `journal.less`.

**Data source is reused, presentation is new.** The server side is unchanged: `GET /api/game/logs?id=&generation=` returns structured `LogMessage[]` (NOT HTML), each a template string + typed `LogMessageData[]` tokens (`LogMessageDataType`: PLAYER, CARD, CARDS, SPACE, COLONY, GLOBAL_EVENT, TILE_TYPE, AWARD, MILESTONE, PARTY, UNDERGROUND_TOKEN, …). `Log.parse()` splits a message into an ordered `(string | LogMessageData)[]`. The legacy `logpanel/` components (`LogPanel`, `LogMessageComponent`, `CardPanel`) are LEFT INTACT — still used by `SpectatorHome.vue` and `GameEnd.vue`. Do not delete them.

Component framework (`src/client/components/journal/`):
- `JournalPanel.vue` — fetch + state + **live feed**. Watches `step` (bumped on every server response): while *following latest* (`followLatest`, true when viewing the current generation) it re-fetches the current generation so new entries stream in; a new generation auto-follows. Selecting an older generation drops out of follow mode → static history; selecting the current one re-engages live. `loadEpoch` is bumped when a different generation is loaded OR the player filter changes, so the feed can tell "whole-list swap / soft re-filter" (silent fade + scroll-to-bottom) from "appended live" (animate the tail). Header is two rows: title+close, then the generation + player-filter dropdowns.
- `JournalGenerationSelector.vue` — custom glass dropdown (NO native `<select>`), keyboard-operable, latest-first, outside-click close. Esc on the open menu is `.stop`ped so it closes the menu without bubbling to the panel's Esc-to-close.
- `JournalFilterSelector.vue` + `journalFilter.ts` — player filter dropdown (ВСЕ / each player with their colour dot / ТОЛЬКО СОПЕРНИКИ). Reuses the `journal-genselect__*` chrome so it's a visual twin of the generation selector; only mounted when `players.length > 1`. Filter persists across generation changes (it's panel state, App-level so it survives the playerkey remount). Filtering is on STRUCTURED data only (`journalFilter.ts` `messagePassesFilter`): a message involves a colour if `message.data` has a matching `PLAYER` token, OR (for the viewer) it's a private "You …" message (`message.playerId !== undefined` — the server only sends the viewer their own privates). `opponents` = has any non-viewer PLAYER token (hides your own / "Вы …" lines). `NEW_GENERATION` dividers + player-less system lines carry no PLAYER token so they drop out of player/opponent filters (kept in 'all'). The panel renders `filteredMessages` so a live entry that fails the filter never changes the list length → no jump.
- `JournalFeed.vue` — scroll container. Custom thin scrollbar (CSS only). Auto-scrolls to follow new entries only when the player is at the bottom; if scrolled up it shows an unobtrusive "New events ↓" pill instead of yanking. Append-only assumption (within a generation the log only grows) → diffs by length. `:key="index"` so the prefix is reused and only the fresh tail mounts + animates.
- `JournalEntry.vue` — one row; `NEW_GENERATION` messages render as a divider, else time gutter + tokens. `animateIn` is set only for freshly-appended live rows.
- `JournalTokenRenderer.vue` — the switchboard turning one parsed token into a semantic chip. Mirrors the legacy `typeof === 'string'` + discriminated-union narrowing structure so `vue-tsc` narrows the same way. SPACE → a "show on map" button (never leaks the raw id) that calls `boardCellHighlight.ts`.
- `JournalCardChip.vue` — a single card token. Project cards: hover → `CardPreviewPopover` (small floating `<Card>`), click → fullscreen via the existing `CardZoomModal`. **Standard projects** (detected by `getCard(name).type ∈ {standard_project, standard_action}`) → hover → `StandardProjectPreviewPopover` (compact pictogram + effect, reusing `overview/standardProjectVisuals.ts` `PROJECT_VISUAL`), and NEVER open fullscreen. `_STANDARD_PROJECT` is a dead `LogMessageDataType` — standard projects arrive as CARD tokens.
- `JournalColonyChip.vue` + `ColonyPreviewPopover.vue` — a COLONY token shows a read-only colony MINI-CARD on hover (mirrors `JournalCardChip`'s hover pattern: `HOVER_DELAY=160ms`, captures the chip's `getBoundingClientRect()` as the anchor, `beforeUnmount` clears the timer). The popover is Teleported to body (floats above the feed's clipping), `pointer-events: none`, and REUSES the overlay's `<ColonyTile :colony="simpleColonyModel(name)" mode="view" :selectable="false" />` — `journal.less`'s `.journal-colony-preview` (z 12700) zooms it `0.86` and hides the tile's `.colony-tile__select-btn` / `.colony-tile__reason` so it reads as a pure preview. NO click-to-fullscreen (a colony isn't a card). Positioning mirrors `CardPreviewPopover` (prefer left of the anchor, flip right, clamp to viewport).
- `JournalMaChip.vue` + `MaPreviewPopover.vue` — a MILESTONE / AWARD token shows its RULE DESCRIPTION on hover (the same text the Milestones / Awards overlay floating tooltip shows), pulled from the static manifest via `getMilestone(name).description` / `getAward(name).description` (in a `try/catch` → `''` so an unknown name degrades silently). `.journal-ma-preview` (z 12700) is dark glass with a gold rim for `--milestone` / purple for `--award` (`__kicker` «Достижение»/«Награда» + `__name` + `__desc`). **`MaPreviewPopover`'s `name` prop is typed `MilestoneName | AwardName | ''`** — the empty-string sentinel MUST be in the union or `vue-tsc` flags the `name === ''` guard as a no-overlap comparison. Same hover/anchor/teleport mechanics as the colony chip. (Both chips are MULTI-ROOT — the inline token span + the teleported popover — wired into `JournalTokenRenderer.vue`'s `COLONY` / `AWARD` / `MILESTONE` `v-else-if` branches, replacing the former plain `.journal-token--*` spans. They're reused OUTSIDE the journal too — the drawn-cards reveal source link hosts `JournalColonyChip` directly.)
- `boardCellHighlight.ts` — premium cell pulse. Toggles `.journal-pulse` on the existing `.board-log-highlight[data_log_highlight_id]` overlay (BoardSpace/MoonSpace already render it); `journal.less` drives a calm 2–3 ring `drop-shadow` pulse. Does NOT scroll the viewport (board is fixed + slid left, so the cell is already visible — "поле не должно резко прыгать").

Conventions: prefer transform/opacity animation, honour `prefers-reduced-motion` (handled in `journal.less`), no native `title` tooltips inside the journal (use `aria-label` + visible labels). When you add a new token type, add a `v-else-if` branch in `JournalTokenRenderer.vue` and a `.journal-token--*` style; don't render raw HTML.


## THE EVENT'S OBJECT (PL-577, 2026-10-17)

A journal group leads with what it is ABOUT: `JournalGroup.subject` = the FIRST card the header names — its own art
(the thumb tier, cropped to a tile ringed in the category accent) for a play / an action / a corporation, a standard
project's pictogram (`standardProjectVisual`) for a standard project or action; the Delta Project («Гидросеть») and a
card with no art show nothing. Console only (`.con-journal .journal-group__object` in `journal.less`, rem; TV 3.3rem,
handheld 2.1rem). The column of sentences reads as a column of events with their objects; the header keeps its own
line beside the object.

## «ПРОПУЩЕНО» — a skipped effect is a ROW (2026-09-30)

An effect the engine could NOT apply (no card can hold the resource, no opponent can be hit, the deck is empty)
arrives as the structured event `effect-skipped` (`impact.skipped = {label, reason, effect?}`, written by the ONE
function `deferredActions/skippedEffect.recordSkippedEffect` under the live scope). `buildEventChildren` turns it
into its own row (`bucket: 'skipped'`): the source chip, a «ПРОПУЩЕНО» badge, the effect's label, its magnitude as
a STRUCK chip, the cause in italics — never merged (two lost effects are two statements) and read LAST (tier 4:
after the gains, after the cost). The magnitude rides `vm.skipped.chip`, deliberately OUTSIDE `vm.chips`, so no
pill, cluster or «+N» count ever sums a lost «+4» as a gain. Why a structured row and not the text log alone:
`JournalGroup` renders a chain's EVENT rows and hides its text children whenever any event row exists — a skip
written only to `game.log` was invisible in exactly the chains that also moved something. Contract:
`.claude/rules/game-logic.md` § No silent loss.

## THE GENERATION'S INCOME IS ONE GROUP (TR61, 2026-10-17)

The production phase used to write past the recorder, so the journal of a generation ended with «спасовал» and the
next generation's first play. Now every seat's phase is ONE root `production-phase-income` (category `production`,
`.journal-group--production` — an amber accent) with its rows by SOURCE PART (`journalEventChild.ts`): «Рейтинг
терраформирования → [M€] +N» (`{kind: 'production', part: 'rating'}`, first), «Преобразование энергии → [⚡] −N [🔥] +N»
(`part: 'conversion'`), «Доход → [M€] +3 [steel] +2 …» (the bare `production` source, one chip per value) and the
`onProductionPhase` hooks' rows under their own card sources. The group's object is none (no card); the summary tab
reads the same events through `productionIncomeByPlayerGeneration`. The notification layer shows nothing for the
category by policy (the console's generation scene is the announcement — `notificationContentPolicy.announcedElsewhere`).
Guards: `tests/events/productionIncomeJournal.spec.ts`; e2e `console-generation-scene` § E.

## ХРОНИКА (CH, 2026-10-23 — «ЖУРНАЛ — ХРОНИКА, НЕ ЛОГ»)

The owner's 4K frame (`screenshots/tv-profile/tv-4k/08-journal.png`) read the panel as a console log: equal chips with
arrows, 70 px art, «15:24» on every line, a draw as a sheet of names. The owner chose **M1 «карточка события»** (batch
2026-10-23; M2 «material only» and M3 «chronicle pages» were the alternatives — frames under
`screenshots/journal-chronicle/`). What stands now — paint and the group's own layout; the model (`journalView`,
`journalEventChild`, the chip tokens shared with the toasts), the popovers, the modes, the pager and the live feed are
untouched:

- **An EVENT is a CARD** on the panel's CF glass (`console.less` § THE CHRONICLE): `.journal-group` is a grid — the
  object's art (`journal-group__object`, the thumb tier 3 : 2, 4.6rem base / 5.2rem TV = 208 px at 4K / 3.6rem Deck)
  BESIDE the headline (`__root`, display face, 1.15rem on TV) and the consequences under it (`__children`, one tier
  quieter); the category's accent is the card's left bevel (the free spine is hidden). The time and the object stand
  OUTSIDE `__root` in the template so the card lays out as one grid (`journal-group--object` adds the art column).
- **The time ONCE per run** — `consoleJournalModel.journalTimeShown` over the rendered nodes (a stamp shows where it
  changes; a generation divider starts a new run) → the `timeShown` prop of `JournalGroup` / `JournalEntry`. The full
  date is the stamp's `aria-label` — never a native `title`.
- **An arrow only where something flows to ANOTHER seat** (`JournalChildRow`: `vm.player !== undefined` — «у кого →
  кому»); **the group's own card is not repeated** as the source of its rows (`ownCard` prop, every row kind).
- **A draw reads as cards** — `JournalCardFan` (`ConsoleCardFaceLite` faces, ≤ 6, «+N»): a search's thrown-away cards
  (quiet, the hook `data-journal-search-discard` + `data-card` on each face) and a flat entry naming two or more cards
  (kept, mint kant). The fan replaces the chips IN THE JOURNAL ONLY — `JournalTokenRenderer` (shared with the toasts)
  is unchanged.
- **A generation is a plate** across the feed (`journal-gen-divider__label`), never a hairline.
- **Row pieces size by content in the console** — journal.less authors chips / labels / badges for the desktop in px
  (19 / 18 px) and the rem icons outgrew them (rows overlapped): `.con-journal` gives them `height: auto;
  min-height: 1.45em`; an empty lead (own source hidden) reserves no column.
- **The focus is the cursor grammar** — `.con-cursor-ring` on `.con-journal__node`, `.con-cursor-on()` on `--focused`.
- Everything is scoped to `.con-journal`: the toasts' chips (`.con-notif__tokens`) keep their paint — the stand checks
  their computed styles before = after.

Stand: `tests/e2e/console-journal-chronicle.spec.ts` (tv4k · fhd · deck, fixture `journal-chronicle` — generation 1
PLAYED through the real doors: named skips, a card action, another seat's attack, a search draw, the income); the
probe's table (time per group, arrows, chips, ink, under the TV floor, clipped, art px, `title`) is in the ledger, CH.
