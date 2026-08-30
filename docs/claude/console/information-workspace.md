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
summary ─┬─ vp            («Победные очки»)
         ├─ played        («Разыграно», the embedded premium table)
         ├─ extras        («Доп. ресурсы»)
         ├─ actions       («Действия», human-only)
         ├─ effects       («Эффекты», human-only)
         └─ botScreen     («Экран бота», bot-only)
              ├─ botBoard   («Планшет бота»)
              └─ botBonus   («Бонусные карты»)
```

- **B walks the TREE, one level**; at the summary it closes the overlay.
  `Y` closes from any depth. Direct shortcuts (X played · L3 extras · LT
  actions · RT effects/botBonus · R3 botScreen) land on the SAME semantic
  routes; pressed on their own route they act as B.
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

| zone (`data-zone`) | human | bot |
| --- | --- | --- |
| `vp` (col 1) | the premium live score | the SAME zone — no bot variant |
| `played` (col 2) | tableau counts (`buildPlayedZones`) | `playedPile` counts **+ the corporation** (parity: a human corp is in its tableau) |
| `cards` (col 2) | «Можно разыграть / В руке» | «Колода действий / Колода бонусов» — the shared card-potential abstraction; deck MECHANICS live on «Экран бота» |
| `extras` (col 3) | resources on cards | floaters + shipping storage BY TYPE (`marsBotExtraGroups`) |
| `actions`/`effects` (col 3, after extras) | present | HIDDEN — absence never shifts the shared zones |
| `botdoor` (col 3) | — | the R3 door to «Экран бота» |

The summary is a FOCUS RING (`infoModeState.summaryFocus`, d-pad +
`infoZoneNavigate` — column-aware, clamping): A opens the focused zone's
route; a zone with no route («Карты») and an absent zone are not focusable,
so a dead A is unexpressible. B from a detail lands the ring on the zone it
was entered from. The A-glyph rides the FOCUSED zone only; the per-zone
shortcut glyphs (X/L3/LT/RT/R3) are static — those work regardless of
focus. No separate bot corp zone, no «Треки бота» panel, no bot deck tiles
on the summary — all of it moved to «Экран бота».

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
  category, widths on the positive total) → the category legend.
- Detail (`.con-infovpd`): total → category bars on the SHARED
  max-category scale (the report's «what carried the game» rule) → the
  sources inside each category → the explaining lists (human: the real
  card rows via `buildVictoryPointsModel().cardGroups`; bot: the formula
  facts — stock × rate, adjacency, icons × difficulty).
- The bot's breakdown is REAL mid-game: `ServerModel` opens the VP gate for
  `isMarsBot` seats (its score is table-public by the Automa rules; a
  human opponent keeps the hidden-VP contract). Spec:
  `tests/models/ServerModel.spec.ts`.

## «Экран бота» — the internals hub (R3)

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
`ConsoleInfoMode.footCommands`. Summary: `LB/RB Игроки (1) · A Открыть
(enabled by the ring) · X Разыграно (2) · [R3 Экран бота (3), bot] · Y
Закрыть (0)`; depth 1: `B К обзору`; depth 2: `B Назад`; the played route
keeps the table's own grammar. Y(0) and LB/RB(1) survive the Deck bar.

## Tests

- `tests/console/infoRoute.spec.ts` — the tree, capability, ring, clamps.
- `tests/client/components/console/liveScoreModel.spec.ts` — Σ ≡ total,
  the ceremony parity (human + bot), the bot fold, TR labels, penalties.
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
