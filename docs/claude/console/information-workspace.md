# The Information Workspace (Y) — the overlay workspace

Stage 3 of the information-panel rework (2026-08-30; stages 1–2b 2026-07-29
are folded in below). «Информация» is a full WORKSPACE in language and
navigation — the ConsoleWsHead crumb, semantic routes, one command-bar
contract — while staying an independent OVERLAY layer: it opens OVER any
surface (board, any workspace, a minimized prompt), never touches the
workspace STACK, and closing restores the exact captured context.

## The overlay contract (why it is NOT a stack frame)

- `Y` opens over ANYTHING; `openInfoMode` captures a SNAPSHOT of the
  transient cursors (`infoModeState.ts` — sheet/hand/board/colony indices,
  sale picks, cell focus) and closing restores them; the workspace STACK is
  never entered, so the surface below keeps its route, step, phase, claims
  and picks by construction. A placement prompt that arrived while open is
  the one exception: close lands on the board (the mandatory surface).
- While open the pad belongs to the panel (`handleIntent`'s
  `infoModeState.open` branch); everything ABOVE it in the chain (mandatory
  announce A, notification-toast B, endgame scene, cinematics) deliberately
  outranks it. A second Y closes; `openInfoMode` is idempotent (no double
  instance can exist).
- `.con-main--info` rides `open || closing` (the `closing` latch is released
  by the panel's own after-leave hook — `settleInfoModeClose`); the endgame
  seal ASKS before closing (a latch belongs to the WORK, not the attempt).
- Read-only is structural: no route submits anything; the embedded
  «Разыграно» is display-only; the transport is untouched.

## Routes (`infoRoute.ts` — pure, spec'd in `tests/console/infoRoute.spec.ts`)

```
summary ─┬─ vp            («Победные очки» — the score explorer's overview)
         │    └─ vpCategory  (ONE category's detail; param vpCategoryKey)
         │         └─ vpCards  (a card family's table; param vpCardsGroup)
         ├─ played        («Разыграно», the embedded premium table)
         ├─ extras        («Доп. ресурсы»)
         ├─ actions       («Действия», human-only)
         ├─ effects       («Эффекты», human-only)
         └─ botScreen     («Экран бота», bot-only)
              ├─ botBoard   («Планшет бота»)
              └─ botBonus   («Бонусные карты»)
```

The vp subtree's stage names are DYNAMIC (the selected category / family) —
`scoreStagePath` in `scoreExplorerModel.ts` supplies the tail; the static
`infoRouteStagePath` skips the '' placeholders. The params live beside the
route in `infoModeState` (`vpCategoryKey` / `vpCardsGroup`), so LB/RB keeps
the SEMANTIC depth («Карты» stay «Картами», «Ресурсные» — «Ресурсными»);
they are written by the explorer's descend verbs and cleared by its own
fold-completion (never by the shell mid-fold — the departing panel still
renders from them).

- **B walks the TREE, one level**; at the summary it closes the overlay.
  `Y` closes from any depth. **The per-route DIRECT shortcuts are RETIRED
  (extras rework, 2026-09-10)**: X/L3/LT/RT/R3 open nothing — every section
  opens through the focus ring + A only (the model that scales to new
  blocks without new physical bindings). X stays a CONTEXTUAL verb inside
  screens that inspect an object (the played table, the two explorers).
- **LB/RB switches the PARTICIPANT, never the place.** The route survives
  the seat ring; a route the new participant cannot serve KEEPS the route
  and presents the workspace FALLBACK («Не применимо», `.con-info__na`) at
  the same depth — never a silent reset (the old `reconcileInfoDetail`
  did exactly that and is gone). Capability is ONE table
  (`infoRouteApplies`), read by the router, the bar, the ring and the
  fallback alike; entering an inapplicable route from the summary is
  REFUSED (the fallback exists for arriving-by-seat-switch only).
- **The crumb** is ConsoleWsHead: `ИНФОРМАЦИЯ › <участник> › <раздел>` —
  root fixed, the participant is the SUBJECT (recomposes on LB/RB), the
  route is the STAGE tail; depth 2 reads as the hosted-step phrase
  («ЭКРАН БОТА · ПЛАНШЕТ БОТА»). Identity chips + corp/difficulty ride the
  trailing slot (`.con-info__meta`, the `data-insp-slide` target).

## ONE participant summary (`.con-info__layout`)

Three columns, ONE canonical layout for every participant; the SHARED
zones sit at the same coordinates (e2e-guarded ±2px):

| zone (`data-zone` / body) | human | bot |
| --- | --- | --- |
| `extras` (col 0 — **the RAIL SATELLITE**, not a panel block) | card-resource cells | the bot's real pools (`marsBotExtraGroups`) |
| `vp` (col 1) | the premium live score | the SAME zone — no bot variant |
| `played` (col 2) | tableau counts (`buildPlayedZones`) | `playedPile` counts **+ the corporation** (parity: a human corp is in its tableau) |
| `actions`/`effects` (col 3) | present | HIDDEN — absence never shifts the shared zones |
| `botdoor` (col 3) | — | the bot's door to «Экран бота» (an ordinary ring stop) |

**THE EXTRAS ZONE IS THE RAIL SATELLITE** (`.con-res-aux`, extras rework
2026-09-10): the persistent ДОП.РЕСУРСЫ column beside the left rail is the
zone's ONE physical body — the panel renders no duplicate. It is mounted
through the whole overlay (an empty seat shows the honest «—» plate + the
«ДОП. РЕСУРСЫ» caption — both absolutely seated, so the cells' geometry
never moves), rides above the panel's dim on the host stacking
(`.con-main--info .con-res-host` z11561), and is PIXEL-IDENTICAL to its
board pose by construction (same node, same anchor — e2e-sampled per frame
in `console-extras-explorer.spec.ts`). The bot seat fills the same cells
from its real pools; an inspected seat's cells carry NO `data-aux-resource`
landing anchors (resource flights must never aim at a foreign column).

**The old «КАРТЫ» readout zone is GONE (hand-dock integration, 2026-09):
the HAND DOCK is the ONE physical representation of the inspected seat's
hand** for the workspace's whole lifetime — the real pack + «КАРТЫ n/m» for
the viewer, a read-only closed fan + the exact public count for another
human (`cardsInHandNbr`), the SAME fan over the bot's action deck
(`actionDeckSize` — the deck it plays from and, empty, passes on). The
bonus deck stays on «Экран бота», where the deck MECHANICS live. Contract:
`hand-dock-presence.md` § THE INSPECTION CONTEXT; model:
`handDock/dockInspection.ts`.

The summary is a FOCUS RING (`infoModeState.summaryFocus`, d-pad +
`infoZoneNavigate` — column-aware, clamping; the satellite is the leftmost
column, the initial focus stays `vp`): A opens the focused zone's route;
every zone opens one (a pure-readout zone would advertise a dead A and is
forbidden — `infoRoute.spec.ts` pins it); an absent zone is not focusable.
B from a detail lands the ring on the zone it was entered from (`botScreen`
family → `botdoor`). **No zone carries a button badge** — the ONE bottom
bar names the press contextually («A Открыть: Разыграно», `labelParams` on
ConsoleCommand); a satellite cell click selects the type AND opens the
extras screen. No separate bot corp zone, no «Треки бота» panel, no bot
deck tiles on the summary — all of it moved to «Экран бота».

## The LIVE SCORE (`liveScoreModel.ts`) — one system with the finale

`buildLiveScoreModel(breakdown, {isBot, hasMoon, hasPathfinders, hasDelta})`
is a POLICY REUSE of the endgame: `FINAL_SCORING_SEGMENTS` (each segment
pulls exactly ONE field the server's builder summed — Σ ≡ total by
construction) grouped by `SCORE_CATEGORY_TABLE` (the ceremony's order and
keys, which are also the `.con-eg-cat--<key>` colour classes) with
`AUTOMA_SEGMENT_FAMILY` dissolving the bot's summands into the card
families (mcToVp → resource, neuralInstance → conditional, cardVp/corpVp →
fixed). **No opaque «Подсчёт бота» exists anywhere in the live UI.**
Category stability is per-GAME: the six core categories always render
(honest dim 0), moon/tracks/delta by table configuration, the penalty row
appends only when real — an LB/RB switch morphs VALUES, never re-composes
the list. Parity is spec-guarded against `buildConsoleEndgameVm` values
(`tests/client/components/console/liveScoreModel.spec.ts`).

- Summary zone (`.con-infovp`): total → ONE segmented bar (one hue per
  category, widths on the positive total) → the category legend. The
  `data-vpx-total` / `data-vpx-bar` / `data-vpx-block` anchors are the
  SHARED ELEMENTS of the explorer's entry.
- THE SCORE EXPLORER (`ConsoleScoreExplorer.vue`, `.con-vpx` — replaces the
  old `.con-infovpd` bar list): ONE component for the whole vp subtree
  (constant zone key — a level change is its own FLIP phrase, never an
  out-in blink). Levels are LAYERS of one surface (the overview parks under
  a category, the category under a table — cursors survive B for free);
  the descends ride `workspaceDescend` (unfold out of the pressed tile /
  fold back into it). Pure models in `scoreExplorerModel.ts`:
  · `buildScoreOverview` — tiles in ceremony order, `sharePct` =
    value/positiveTotal (THE one bar semantic; the max-category detail
    scale is retired), zero tiles stay IN the list as a quiet pose;
  · `buildTrProvenance` — Σ named rows ≡ the displayed rating (base /
    handicap / parameters / hazards / `cardEntries` sources with card ids
    and generations / the honest `legacyUnknown` residual);
  · `buildCardsHub` + `buildCardGroupTable` — the three family doors, then
    rows with the SERVER's own formula (`detailsCards[].mechanics`:
    shape / each / per / counted from the engine Counter — the client
    computes no rule), sorted by current VP desc (stored resources break
    ties, zeros below); pseudo-rows (Turmoil / Colony VP / bribe) are
    facts, never fake cards; `buildBotGroupFacts` is the bot's fold;
  · fact builders for milestones / awards (places + standings + ties) /
    cities (`detailsCities` — every owned city's own contribution) /
    greenery / hydro (track position) / penalties (every loss named).
  The PREVIEW column is the focused row's live tableau `CardModel`; X goes
  through the ONE console zoom inspector (`slotZoomOrigin` on the preview
  slot — physical origin, LB/RB browses the rows via `onBrowse`, B lands
  the card back; never the endgame's two-instance duplicate). Cursors +
  the explorer's command contract live in `consoleScoreExplorer.ts`
  (`scoreExplorerUi.barCommands` — ConsoleInfoMode republishes verbatim).
  The summary ⇄ explorer entry is `scoreExplorerMotion.ts`: proxy handoff
  for the total + bar (arm on leave, FLIP on enter, reveal-then-remove —
  the total provably never misses a frame; e2e frame probe) + the grid
  unfolding out of the legend's rect. ⚠ Reduced motion: an out-in hook's
  `done` must be a MICROTASK (`Promise.resolve().then(done)`) — a
  synchronous `done` wedges Vue's swap (the old zone stays mounted).

  ITERATION 2 (2026-08-31) — the SOURCE-LEDGER contract + MA inspection:
  · A category card NEVER draws a share track (an empty track reads as
    unfinished progress). The top segmented bar is the ONE share surface;
    each card carries a `ScoreLedger` — `chain` (an arithmetic story,
    «20 старт · +1 фора», honest «ещё N» cut), `medallions` (the REAL
    earned MA emblems — `assets/ma/<maArtSlug(name)>.png`, the workspace's
    own art) or `empty` (one quiet sentence). Uniform card geometry: a
    zero category changes INK only.
  · FOCUS↔SEGMENT: the focused/selected category's stripe stays lit, the
    others dim (`litKey`); a ZERO category lights nothing (no stripe
    exists) and the absolute share line answers «0 ПО» (`shareKey`). The
    line never pushes the bar's geometry.
  · The SHARED TOTAL keeps one structure on both sides of the handoff —
    no contextual label inside `data-vpx-total` (the «Всего»-in-one-state
    morph snap; e2e structure probe).
  · `descendCascade` animates every element to its OWN resting opacity
    (inline cleared, computed read) — a zero row can never flash bright
    mid-cascade (the measured zero-state flicker; e2e frame samplers on
    both directions).
  · TR is an ARITHMETIC STORY: `TrProvenanceRow.running` walks
    «20 → 21 → … = TR» (spec: the chain ends at the displayed rating).
  · MILESTONES/AWARDS are COLLECTIONS of real earned laurels
    (`buildMilestoneCollection`/`buildAwardCollection` — entries ONLY from
    `detailsMilestones/Awards`, enriched from the public MA models:
    threshold/score, funder, resolved standings with shared places, ties;
    award places speak LOCALIZED sentences, never the raw '1st').
    X opens the MA INSPECTION — a read-only layer inside the explorer
    (not a route): the entry's emblem FLIPs into the hero pedestal (the
    source art holds `visibility: hidden` — one physical object), the
    dossier unfolds from the entry's rect, B folds everything back
    (`consumeScoreBack` — the shell asks it before `infoBack`), a seat
    switch drops it instantly (`dropInspect`).
  · ACTUAL DATA ONLY, everywhere: cities are the REAL owned tiles
    (`detailsCities[].cardName` names the tile's card — Ganymede Colony;
    a plain city stays «Город»), hydro shows the position + the ONE
    APPLIED VP slot (never future slots), zero categories render one
    empty sentence — no placeholder rows, no future slots, no fake
    entities anywhere (a REAL card at 0 VP stays visible with its
    formula — that is a different thing from a placeholder).
- The bot's breakdown is REAL mid-game: `ServerModel` opens the VP gate for
  `isMarsBot` seats (its score is table-public by the Automa rules; a
  human opponent keeps the hidden-VP contract). Spec:
  `tests/models/ServerModel.spec.ts`.

## THE EXTRAS EXPLORER (`ConsoleExtrasExplorer.vue`, `.con-exr`) — «Доп. ресурсы»

The extras route is a full workspace screen (extras rework 2026-09-10; the
old scrolling section list is DELETED). The architecture in one sentence:
**the rail satellite is the TYPE NAVIGATION and the pixel-anchored half of
the screen; the panel hosts only the selected type's content.**

- **State**: `consoleExtrasExplorer.ts` (`extrasExplorerUi` — selected
  `typeKey`, `typeCursor`, `zone: 'types' | 'cards'`, `cardCursor`;
  `barCommands` published verbatim through `ConsoleInfoMode.footCommands`;
  reset on every info-mode open). The satellite paints the cursor
  (`__cell--cursor`) and the selection (`__cell--active`) FROM this state —
  one owner, the column and the screen can never disagree. Focused ≠
  selected: the cursor moves freely, A commits the type (a CHOICE IS A
  PRESS), and the content swap slides from the pressed cell's direction.
- **Model**: `extrasExplorerModel.ts` (pure, spec'd in
  `tests/console/extrasExplorerModel.spec.ts`). The type list is
  `additionalResourceGroups` (first-appearance order, ZERO holders
  included — the same derivation the satellite renders). Per-card VP is
  the SERVER's own `detailsCards[].mechanics` row: per-card flooring by
  construction, `special` clauses named CONDITIONAL and never folded into
  the linear «ПО от ресурсов» sum, a holder's non-resource VP kept in its
  own bucket (no double count). A hidden score (zeroed breakdown) keeps
  the PRINTED rule from the manifest and withholds every number. Payment
  grants (`railMcBadges.cardBound`) belong to the ENABLING card alone;
  protection marks ride `railProtections.cardResources`.
- **Composition**: HERO (type icon + name + total + «Накопителей: N» +
  honest chips: VP sum / conditional / actions / «Оплата: 1 = N M€» /
  «под защитой») → GALLERY (real premium faces via CardFace lightweight,
  strict pages — 4 per page, 3 on the Deck, the page DERIVED from the
  cursor; per-card meta plate UNDER the face: ×N + the VP chip, a zero
  count calms its ink only) → the FACT STRIP (fixed height: name · ×N ·
  the printed rule `per → each ПО` · «Сейчас: N ПО» · «M до следующего
  ПО» (linear per>1 only) · usage chips). The bot fill lists its pools
  (colony areas / the common floater pool) — no card faces, no VP rows.
- **Input**: the shell forwards the pad while the route is up (global
  Y/LB/RB/B stay global); ←/→ cross between the column and the gallery
  (left at card 0 returns to the column), the gallery edge IS the page
  turn. X (and the unadvertised A alias) opens the ONE console zoom
  inspector (`slotZoomOrigin` on `[data-exr-card]` slots; `onBrowse`
  drives the cursor so the derived page follows and B lands on the very
  card being read).
- **Motion**: the screen UNFOLDS OUT OF the satellite column
  (`descendUnfold` from the column's live rect in the detail-zone enter
  hook — no proxy handoff needed: the column itself is the continuity)
  and FOLDS BACK INTO it on B; type/page swaps are directional out-in
  beats that SNAP under reduced motion (microtask `done`) and while the
  zoom viewer is open (its slot hold must not chase a transition).
- **Empty state**: a seat with no holders gets the full honest room
  («Нет карт, способных хранить ресурсы») and the satellite's «—» plate;
  the route stays enterable (the ring stop exists for every seat).

## «Экран бота» — the internals hub (the botdoor zone)

Everything explaining HOW the algorithm works: the corporation's RULES read
(`.con-info__block--botcorp`, the ordinary premium face + difficulty), the
decks + discard/reshuffle notes, the storage split + the 5→track rule, the
M€→VP ladder (`mcPerVp` from the live breakdown) + the Hard/Brutal card-VP
clause, and the two FOCUSABLE deep entries (`.con-botscr__entry`,
`infoModeState.botScreenFocus`): «Планшет бота» (MarsBotTracks large + the
teaching guide) and «Бонусные карты» (the open piles). A d-pad press at the
ring's edge degrades to a plain scroll, so the sections below the entries
stay reachable.

## The MarsBot rail — the PARTICIPANT presentation (`marsBotRailModel.ts`)

Parity with the human geometry, not a technical panel:

- economy rows: the M€ supply always; the corporation's own store when it
  is a REAL resource (Ecoline/Ecotec plants, Philares/Spire science, the
  M€ bank) — floaters are «Доп. ресурсы» now, cube markers are state and
  never rows. `.con-res__rows--bot` RESERVES the six-row height, so МЕТКИ
  never changes its vertical anchor across a seat switch.
- МЕТКИ: the SAME tag matrix (`consoleAvailableTags` cells), counts from
  the printed tracks — the track position IS the engine's tag count
  (`AutomaTargeting.effectiveTagCount`); one track fills every of its tag
  cells (POWER+JOVIAN share a number — that is the rule); a tag no track
  serves reads «—» with `.con-tagmx__cell--na` (never a lying 0). The old
  progress-bar «Треки бота» array lives on «Планшет бота» only.

## Motion

- Open/dismiss — the `info-mode` surface-motion branches (unfold from the
  rail seam, own dim, content cascade over `.con-info__head` +
  `.con-info__col`).
- Route swap — a DIRECTED out-in beat (`detailZone*` hooks): descending
  rises from below, B sinks back; depth is read from `infoRouteDepth`.
  A seat switch keeps the key (routes are semantic) → instant patch, the
  beat is the `inspectSwitchMotion` slide; rapid presses coalesce.
- Reduced motion: snaps (clear props), both axes.

## Command bar

PanelOwner `'infoMode'` via consolePanelUi; per-route sets in
`ConsoleInfoMode.footCommands`. Summary: `LB/RB Игроки (1) · A Открыть:
<зона> (contextual — `labelParams`; disabled with no target) · Y Закрыть
(0)`; depth 1: `B К обзору`; depth 2: `B Назад`; the played route keeps
the table's own grammar; the two explorers publish their own sets
(`scoreExplorerUi` / `extrasExplorerUi` `.barCommands`, returned
verbatim). Y(0) and LB/RB(1) survive the Deck bar.

## Tests

- `tests/console/infoRoute.spec.ts` — the tree (vp subtree included),
  capability, ring (satellite column first, botdoor), clamps.
- `tests/console/extrasExplorerModel.spec.ts` — the extras model: order +
  zeros, per-card flooring, conditional vs linear, no double count, the
  hidden-score rule fallback, payment attribution, navigation/paging.
- `tests/e2e/console-extras-explorer.spec.ts` — the satellite PIXEL
  CONTRACT (per-frame sampler over board → summary → extras → back: rect,
  value text, opacity), the screen journey (zero holder, no-VP holder,
  zoom round trip, seat switch to the bot's empty state), three profiles +
  the flow video (`screenshots/extras-explorer/<preset>/`).
- `tests/console/dockInspection.spec.ts` — the dock's inspection seat:
  source selection (self / human / bot / legacy corpless), the fan cap +
  exact count, the compact-pose geometry parity.
- `tests/client/components/console/consoleHandDockInspection.spec.ts` —
  the dock's guest presentation: read-only by construction, the bay's
  three-state priority, privacy shape of the DOM, a11y count.
- `tests/client/components/console/liveScoreModel.spec.ts` — Σ ≡ total,
  the ceremony parity (human + bot), the bot fold, TR labels, penalties.
- `tests/client/components/console/scoreExplorerModel.spec.ts` — the
  explorer levels: share math (Σ sharePct ≡ 100), TR provenance Σ ≡ TR,
  family tables (formulas, sorting, zeros, pseudo-rows), bot facts,
  award standings, the dynamic stage path, the grid clamps.
- `tests/calculateVictoryPoints.spec.ts` — the read-model extension:
  `detailsCards[].mechanics` (per/fixed/special + the floor invariant)
  and `detailsCities` (per-city contribution, opponents' greenery counts).
- `tests/e2e/console-score-explorer.spec.ts` — the whole vertical on three
  profiles: no-scroll overview, the shared-element entry (frame probe: the
  total never misses a frame), TR Σ, formulas, preview → X fullscreen →
  B (slot yields, focus survives), family sorting, bot parity at depth,
  the B chain, reduced motion; also the screenshot + flow-video source
  (`screenshots/score-explorer/<preset>/`).
- `tests/client/components/console/infoModeState.spec.ts` — lifecycle +
  route reset on open/close.
- `tests/client/components/console/marsBotRailModel.spec.ts` — economy
  honesty, the matrix parity, «not tracked», the extras adapter, the
  no-double-count invariant.
- `tests/client/components/console/ConsoleResourcePanel.spec.ts` — the bot
  rail markup (matrix, no production, reserved height, «—»).
- `tests/models/ServerModel.spec.ts` — the bot VP gate.
- `tests/e2e/console-info-workspace.spec.ts` — the full contract per
  display profile (standard / tv-4k / deck): geometry, crumb, zone parity
  (±2px), route preservation, the fallback, «Экран бота» depth walk, the
  embedded table, restore, reduced motion; also the screenshot source
  (`screenshots/info-workspace/<preset>/`).
