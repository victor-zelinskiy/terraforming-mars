# The Effect Forecast — «Сработает» + the R3 «Эффекты» layer (as built, 2026-09-13)

The play screen («КАРТЫ В РУКЕ › ‹карта› › РОЗЫГРЫШ», `ConsolePlayCardConfirm.vue`)
and the action screen («ДЕЙСТВИЯ КАРТ › ‹карта› › НАСТРОЙКА», `ConsoleActionComposer.vue`)
used to show only the card's OWN result. Everything the TABLE answers with —
Carbon Nanosystems' graphene for a science tag, Olympus Conference's question,
Rover Construction's 2 M€ after a city, an opponent's Pharmacy Union taking a
disease — was invisible, and discounts were applied silently («ЦЕНА 8» with no
trace of the printed 10 or who gave −2). This is the as-built contract of the
system that shows it; the agreed assignment it implements is
`effect-forecast-spec.md` (same folder). Laws first, then the pieces.

## The laws (a violation is a bug)

1. **The server is authoritative; the client derives nothing.** The forecast is
   computed on the server by the SAME predicates the live hooks read — never a
   heuristic over the printed graphic, never a simulation on a clone (a clone
   would know the deck, the queue broadcasts, the action path saves).
2. **Read-only.** No forecast hook and no engine path ever calls `defer`, `log`,
   `addResource`, `events.*` or mutates a pool — purity is spec-guarded with a
   state snapshot before/after.
3. **Co-location.** A card's forecast hook lives IN THE CARD FILE beside its live
   hook and reads the same predicates. There is no central «card → forecast»
   table; the engine only knows WHICH live hooks exist.
4. **Honesty.** A card with a live hook but no forecast hook arrives as
   `certainty: 'unknown'` («сработает, результат не рассчитан»), never as
   silence. A skipped effect names itself. A guessed ORDER is worse than none
   (the «ПОРЯДОК» band renders only when every step declares its priority).
5. **No new scroll.** The composer's right column is a `ConsoleScrollArea`; the
   row, the discount tail and the layer add zero scroll on all three profiles
   (e2e-guarded with `scrollHeight ≤ clientHeight` + zero `[console-overflow]`).
6. **Semantic input.** R3 is `stickR` through `GamepadGlyph` (keyboard `KeyV`);
   no button literal anywhere (`glyphLiteralGuard`).
7. **One flow, one crumb.** The layer is a LEVEL INSIDE the composer — never a
   surface of its own, never a workspace frame. The crumb gains a tail
   («РОЗЫГРЫШ · ЭФФЕКТЫ» → «РОЗЫГРЫШ · ЭФФЕКТЫ · ‹ИСТОЧНИК›»), the composer
   PARKS (never unmounts), B returns exactly one level with every capture, the
   payment and the cursor untouched.
8. **The forecast rides INSIDE the preview** (`ActionPreview.forecast?`) — the
   same route, the same version-keyed cache (`gameStateVersion`), zero new
   fetch sites (`serverDerivedCacheGuard` unchanged).

## The shared model — `src/common/models/EffectForecastModel.ts`

```
EffectForecast {
  facts:     EffectForecastFact[]                 // branch-independent
  byBranch?: Record<branchPos, EffectForecastFact[]>  // keyed by the POSITION in ActionPreview.branches
  discounts: {base, final, items: [{source: EventSource, amount}], other}
  paymentValues: [{source, resource, value, count}]
  coverage:  'complete' | 'partial'               // partial ⇔ at least one `unknown`
}
EffectForecastFact {
  id, source: {kind: card | corporation | automa-corporation | rule, name, owner, channel: EventTrigger}
  certainty: exact | asks | conditional | deferred | unknown | skipped | no
  recipient: {kind: you} | {kind: player, color} | {kind: bot, color}
  timing:    immediate | before-card-choices | after-card | after-placement | on-draw | unknown
  sequence?: number            // the live hook's declared Priority — ONLY when honest
  effects:   ActionEffect[]    // WHAT (current→resulting only for pools the play does not touch)
  alternatives?: [{label, effects}]   // asks: the other outcomes
  reason, reasonTag?, condition?: {text, state: met|depends|unmet, branchPos?}, note?
}
```

Every fact answers the FIVE QUESTIONS on the server — WHAT (`effects`), WHY
(`reason` + `reasonTag`), UNDER WHAT CONDITION (`condition`), TO WHOM
(`recipient`), WHEN (`timing`). A foreign gain is written from the RECIPIENT's
point of view (`direction` = what THEY get); the client words it as
«соперник получит / потеряет». `byBranch` is keyed by the branch POSITION
because the runtime `OrOptions` index is `-1` for unavailable / auto-resolved
branches and cannot be a key. `'rule'` is the one cardless source kind — an
out-of-scope module (a party policy, the Pathfinders track) named honestly.

## The server — hooks, builders, the engine

**Hooks** (`src/server/cards/ICard.ts`, all optional, all read-only, all
returning `ReadonlyArray<EffectForecastFact>`; the analog of
`tilePlacedPreview`):

| hook | mirrors | asked by the engine for |
| --- | --- | --- |
| `cardPlayedForecast(cardOwner, activePlayer, playedCard, ctx)` | `onCardPlayed` / `onCardPlayedByAnyPlayer` | every seat's tableau in generation order, the played card included («including this») |
| `grantForecast(cardOwner, activePlayer, grant, ctx)` | `onProductionGain` / `onResourceAdded` | the branch's own `ActionEffect` chips, translated to `EffectForecastGrant` — never a re-parse of the behavior |
| `tilePlacedForecast(cardOwner, activePlayer, tile, ctx)` | `onTilePlaced` | every seat's reactors, once per tile the play / action places |
| `MarsBotCorp.humanCardPlayedForecast(game, player, card, ctx)` | `onHumanCardPlayed` | the bot's corporation (`AutomaCorporations.humanCardPlayedForecast`) |

`EffectForecastContext` (`cards/EffectForecastContext.ts`): the operation
(`play` / `action`), the tiles the operation places (`EffectForecastTile`:
type, count, counts-as flags, `offMars`), the selected branch position.

**Builders** (`cards/effectForecastPreviews.ts`): `recipientOf`, `sourceOf`,
`placesUncoveredOcean`, and one builder per degree — `exact`, `asks`
(first outcome + alternatives; timing `before-card-choices` when the declared
priority is ahead of `Priority.DEFAULT`), `deferred`, `skipped`, `no`,
`conditional`, `unknown` — plus `AFTER_CARD` / `AFTER_CARD_GAIN` (the honest
`Priority.DEFAULT` / `GAIN_RESOURCE_OR_PRODUCTION` pairs) and
`triggerSequence` (`OPPONENT_TRIGGER` when the payout is somebody else's).
Chips are the shared `actionPreviews` vocabulary (`stockGain`, `stockCost`,
`productionChange`, `cardGain`, `cardResourceGain`, `trGain`, `drawGain`) built
against the RECIPIENT.

**The engine** (`src/server/models/effectForecast.ts`) is a mirror of
`Player.onCardPlayed`: own tableau `onCardPlayed` → Turmoil policy (`unknown`,
`rule` source) → every seat in generation order `onCardPlayedByAnyPlayer` →
Pathfinders (`unknown`) → the bot corporation. Then the SECOND ORDER: the
branch's own chips become grants, every own reactor's `grantForecast` is
asked, and the CASCADE re-asks the recipients' own second-order hooks for the
first-order facts' chips (Bushes → Manutech; Decomposers' microbe → Topsoil
Contract), inheriting certainty / timing / sequence; bots are never cascaded.
Then the TILE pass for every tile of the branch (`tilesOfBranch` reads the
`boardPlacement` steps and `behavior.city.space`); a bot corporation with
`onTilePlaced` is a deferred `unknown`. Discounts come from
`getCardCostBreakdown` (play of a project card only) with
`other = max(0, base − final − Σitems)`; payment values from
`paymentOptionsForCard` × `SPENDABLE_CARD_RESOURCES` × the card in the
tableau. `stripTouchedPools` removes `current/resulting` from own facts whose
pool the operation itself moves (the client then says «сверх собственного
эффекта карты»). A multi-branch preview fills `byBranch[pos]` per available
branch with `certainty: 'conditional'` (an `unknown` stays `unknown`).
`FORECAST_HOOK_PAIRS` is the engine's declared «live hook → forecast hook»
table, and the coverage guard's law.

**The routes**: `CardPlayPreview.ts` / `ActionPreview.ts` spread the preview
and attach `forecast` (`effectForecastForPlay` / `effectForecastForAction`);
an expired subject still answers 204.

### The scope (every card carries its hook — the allow-list is EMPTY)

`onCardPlayed` (24): Decomposers, Ecological Zone, Mars University, Media
Group, Olympus Conference, Optimal Aerobraking, Viral Enhancers · CrediCor,
Interplanetary Cinematics, Saturn Systems · Advertising, Albedo Plants, Carbon
Nanosystems, Pharmacy Union, Recyclon, Solar Logistics, Splice · Venusian
Animals · Aridor, Arklight, Martian Zoo, Spinoff Department · Point Luna, Vitor.
`onCardPlayedByAnyPlayer` (4): Saturn Systems, Pharmacy Union, Solar
Logistics, Splice. Second order (4): Manutech, Meat Industry, Topsoil
Contract, Development Manager. Tile triggers (14): Survey Card (Ares), Arctic
Algae, Herbivores, Immigrant City, Pets, Rover Construction, Mining Guild,
Tharsis Republic, Dynamic Ocean Barrier, Hospitals, Neptunian Power
Consultants, Philares, PolderTECH Dutch, Vermin. MarsBot corporations (3):
Saturn Systems (C08), Pharmacy Union (C21), Splice (C24 — delegates to the
human card's own hook, re-sourced, channel kept). Out of scope (honest
`unknown` only): Turmoil policies, Pathfinders, Moon, Underworld, CEOs.

## The client — the pure model

`src/client/console/effectForecastModel.ts` (no Vue / DOM / i18n; spec'd under
the server runner):

- **The compact row** — `compactForecastChips`: membership (`factInRow`:
  exact with chips, asks, unknown; never deferred / conditional / skipped /
  no), merging by POOL (`direction|icon|stock/production`) inside ONE degree
  (two +2 M€ sources → «+4 M€», a production step never merges with a stock
  gain), the order own exact → asks (first GAIN of the first outcome) → other
  seats (per seat, per pool — different seats never merge) → ONE «⚡ ?» for
  every unknown, the cap `FORECAST_CHIP_CAP = 4` with «+N», and the PARITY
  counters (`represented === total`, a fact feeding two pools counted once).
- **The variant reactions** — `variantReactionChips`: the branch-tied facts'
  first chips, `VARIANT_REACTION_CAP = 2` + «+N».
- **The discount tail** — `discountTail` (`base → final`, `saved`).
- **Presence** — `forecastLayerAvailable` (any fact / discount / payment
  value), `forecastRowPresent` (at least one chip): a discount-only forecast
  keeps R3 and draws no row; an empty forecast publishes nothing.
- **The eight groups** — `forecastGroups` in the fixed order
  ⚡ Вы получите · ? Вас спросят · ↳ Зависит от вашего выбора (one entry per
  AVAILABLE branch, «ничего не сработает» for an empty one) · − Скидки и
  оплата (items + «прочие» + payment values) · ▍ Получат другие · … Позже
  (deferred / unknown) · ⚠ Пропустится · ✕ Не сработает (ONLY explicit `no`
  facts). Non-empty only. `forecastSectionChips` / `cycleForecastSection` are
  the LT/RT facet; `buildForecastBrowseModel` packs each section into its own
  rows (`columns` abreast) with a stable `key` per item.
- **The «ПОРЯДОК» band** — `forecastOrderBand`: asks + deferred facts (+ the
  selected branch's) sorted by timing rank then declared `sequence`, with the
  card-choice and cell markers interleaved; ONLY when there are two or more
  and every one declares `sequence`.
- **Attribution** — `attributeFactToEffect(channel, entries)` through the
  explorer's channel plan (`expectedChannelsFor`): one candidate on the fact's
  channel, or the single effect of a one-effect card; else `undefined` and
  the tile falls back to the honest «Эффект этой карты». `attributeItemToEffect`
  extends it to discount / payment items.
- `TIMING_LABEL`, `CERTAINTY_LABEL`, `factBeyondOwnEffect`, `forecastMetaLine`.

## The surfaces

**The row** (`ConsoleForecastRow.vue`, `.con-forecast`): ⚡ in the TRIGGERS
family's mint · «Сработает:» · chips · `<GamepadGlyph control="stickR"/>`.
NOT a focus stop (no cursor, no selection, no A); a click opens the layer.
Four chip forms, all the shared `ActionEffectChip` in the compact family:
own = the ordinary mint gain chip; asks = the same chip + a round cyan «?»
badge (text, no sprite); other = a STEEL chassis (never mint) with the seat's
colour BAR on the leading edge and a DOT before the number (`player_bg_color_*`
— bots included); unknown = ONE dashed steel «⚡ ?»; «+N» past the cap. On
the play screen the row is one more UNIT of the level-2 cluster
(`.con-composer__rescat--forecast`) — same rhythm, same type, zero added
height where the width allows; on the action screen it is the formula's
FOURTH SIDE (`__hero-side--forecast` with the `__hero-label` «Сработает»,
caption-less) or ONE line under the rule when there is no formula. Absent
from the DOM while the forecast is empty; nothing is reserved while it loads
(it arrives with the preview).

**The «↳» reactions** ride INSIDE the option cards (`.con-forecast__vchip` in
`__variant-chips` / `__branch-formula`): what the table adds if THIS branch
is chosen, next to the branch's own chips — and never repeated in the row.

**The discount tail** (`ConsolePaymentPanel` `discount` prop): «ОПЛАТА ·
ЦЕНА 10 → 8» in the «было → станет» vocabulary + a mint «−2» pill,
line-height-bound so the head's height never moves (the panel's layout-shift
contract; spec-pinned). Without a discount the head is byte-identical to
before. Sources live in the layer only.

**Skipped reactions** (Mars University with no other card) ride the existing
`__warn` strip with the source name and the lost magnitude.

**The layer** (`.con-composer__fxlayer` → `.con-composer__fxpanel[data-forecast-surface]`
hosting `ConsoleEffectsExplorer mode="forecast"`): an ABSOLUTE overlay of the
composer's work column (`position: relative` on `__playright` / `__actright`),
so opening it can never re-flow the frame — the two states are stacked layers
of ONE zone. Never a copy of the explorer: the SAME component, with
`mode`, `explorerUi` (its own cursors — `forecastExplorerUi(host)`, never the
Information workspace's), `forecast`, `players` (names / colours / live
tableaux of every seat), `branches`, `selectedBranchPos` (live from the
composer — no request), `statsByColor`, `orderFlags`. Facets = the eight
groups; the «ПОРЯДОК» band above the grid; sections span the grid with the
group glyph; the tiles run ONE PER ROW (the layer stands in half a band
beside the dossier — two abreast truncated both the source name and the
caption at 4K); each tile = source name (+ owner plate for a foreign seat;
the name owns the whole head — a truncated source is the one thing a
forecast tile may never show) · the attributed printed graphic + caption ·
the META line = the forecast FOR THIS PLAY (chips, «спросит … или …»,
«после размещения», «не рассчитано»); the dossier column = face + group chip + «ЧТО ПРОИЗОЙДЁТ»
(the five questions in fixed order: ЧТО with «сверх собственного эффекта
карты», ПОЧЕМУ with the tag icon, УСЛОВИЕ with its state pill and «выбрано»,
КОМУ with the seat dot, КОГДА) + the full rule + ONE quiet «За партию» line
once the seat's stats arrive (a bot / rule source claims nothing). A on a
tile = the explorer's own descend into the detail stage — «ЧТО ПРОИЗОЙДЁТ»
FIRST, the printed rule, then `ConsoleEffectSummary` quietly; LB/RB step
items across sections; X inspects the source card; B one level; R3 closes
the whole layer.

**Input**: R3 at the review / setup level opens (and is published in the bar
only when `forecastLayerAvailable`); while the layer is open the composer
routes every intent to the explorer (`onForecastIntent`), B folds the dossier
first then the layer, R3 closes it outright. The layer lives ONLY at the
review level: a pick, the payment editor, a submit in flight, the landing
scene, the commit phases or a card change fold it INSTANTLY
(`armForecastInstantFold`). The nested repeat-pick composer (`publishCommands:
false`) never opens one. The command bar mirrors the explorer's own contract
while open (`explorerUi.barCommands`) — «Open · Inspect · Sections · Back ·
Close» / «Other effects · Inspect · Back · Close».

**A state-version change under an open composer** (an opponent's move, a WS
push): the action composer's preview is the version-keyed
`actionPreviewStore` (SWR — it re-asks by itself); the play composer now
re-asks too (`stateVersion` watcher → `refreshPreview`), and the answer
replaces the standing preview IN PLACE only when `samePreviewShape` holds
(same branches, steps and pre-steps — every capture is keyed by a position,
so a re-shaped answer is left alone and the player's answers stand). The old
forecast keeps painting while the new one is on the wire; a chip whose value
moved re-mounts (the row keys its chips on identity + value, the layer keys
each meta line on its values) and plays the 100 ms opacity flick the cell
dossier plays on a changed value; the open layer updates in place and the
explorer's nearest-survivor cursor rule keeps the focus.

**Crumb**: `forecastStageText(host, baseKey)` (`consoleEffectForecast.ts`) —
the composer's stage word + «ЭФФЕКТЫ» + the source at the detail, joined
pre-translated; the hand section renders it RAW (`ConsoleHandStage.raw` →
`ConsoleWsHead.stageRaw`), the card-actions head through `focusKickerRaw`,
and the command bar's context reads the same composite. The tail only ever
advances.

**Motion** (`consoleForecastFocusMotion.ts`, keys `forecast-row` /
`forecast-press`): the descend phrase verbatim — COMMIT (the `--descend` flare
on the row) → RELEASE of the row's content → the work column RECEDES into the
press point (`[data-forecast-browse]`: the play composer's `ConsoleScrollArea`,
the action composer's `.con-composer__surface`) → UNFOLD of the panel from the
row's rect → REVEAL cascade of the explorer's zones; B / R3 reverse it into
the remembered rect. Reduced motion snaps through a microtask. Timings mirror
the effects / action focus phrases. The rect is armed SYNCHRONOUSLY in the
R3 / click handler (armed rects expire in 1 s).

**Profiles**: `console_tv.less` extends the `.con-efx` ladder (never
duplicates it) for the forecast classes, every type ≥ the .8rem floor;
the handheld ladder folds the dossier into a top plate (no face) and keeps
the grid single-column; the row's chips shrink on the compact tokens.

## i18n

UI keys in `src/locales/ru/console.json` (`Will trigger` → «Сработает»,
the eight group labels, `Order`, `What will happen`, `What/Why/When/To whom`,
the timing labels, `Answer inside this play`, `Not calculated`, `Other
discounts`, `Nothing will trigger`, `Beyond the card's own effect`, `Effect of
this card`, `If you choose «${0}»`, …); the hooks' reasons / notes / rule
names in the new `src/locales/ru/effect_forecast.json` (tag reasons are
parameterised — `You play a card with a ${0} tag`, filled from `reasonTag`
through `reasonParams`). Existing keys are reused where they existed
(`Effects`, `You will receive`, `Later`, `Condition met`, `Do nothing`, the
prompt labels).

## Guards

- `tests/models/effectForecast.spec.ts` — purity (serialize before/after +
  event / queue counts), the empty table, the own walk, asks, «including
  this», the opponent recipient, `unknown` → `coverage: 'partial'`, discounts,
  payment values, the tile pass, `byBranch` positions, second order + the
  cascade, the arrow strip, `no` almosts, the action forecast, the bot seat.
- `tests/models/effectForecastCoverage.spec.ts` — the WORKLIST: every in-scope
  card with a live trigger hook has its forecast twin (`FORECAST_HOOK_PAIRS`);
  `ALLOWED` is empty; every bot corporation with `onHumanCardPlayed` has
  `humanCardPlayedForecast`; anti-vacuous floor.
- `tests/models/effectForecastParity.spec.ts` — EXECUTION PARITY: every hooked
  card × trigger × own/foreign: an `asks` fact meets a prompt whose
  `choiceContext.source.card` is the fact's source; every exact / deferred
  fact meets an `effect-triggered` event of the same source card, channel and
  recipient colour after the prompts are answered and the queue drained.
- `tests/routes/effectForecastRoute.spec.ts` — both previews carry the
  forecast; 204 unchanged.
- `tests/console/effectForecastModel.spec.ts` — the pure client model (28).
- `tests/client/components/console/consolePaymentPanel.spec.ts` — the
  discount tail + its zero-element layout-shift claim;
  `consolePlayCardComposer.spec.ts` / `consoleActionFlow.spec.ts` — R3 is
  published only with a non-empty forecast, review / setup level only.
- `serverDerivedCacheGuard`, `glyphLiteralGuard`, `consoleTvTypeFloor`,
  `effectFamilyCoverage`, `effectCaption` — unchanged and green.
- e2e `tests/e2e/console-effect-forecast.spec.ts` over the `effect-forecast`
  fixture (2p: blue Manutech with Carbon Nanosystems, Olympus Conference at
  one science, Rover Construction, Earth Catapult, Decomposers, Viral
  Enhancers, Meat Industry, Livestock; red Pharmacy Union), three presets +
  reduced motion, 0 `waitForTimeout`: the row + badge + the discount head
  (Geological Survey), R3 → the groups → A → the dossier → B / R3 back with
  the head height and the cursor intact → A → the play and the SERVER's
  graphene; the opponent chips in red after the own chips and the question
  (Nitrite Reducing Bacteria — four chips, the cap's edge) + «Получат
  другие» naming the owner; the «↳» reactions + «Зависит от выбора»
  (Artificial Photosynthesis — the row keeps only the science reactions);
  the discount-only layer (Power Plant); the action screen's fourth side
  (Livestock → Meat Industry); the fit sweep + zero `[console-overflow]` on
  every preset. Screenshots in `screenshots/effect-forecast/<preset>/`.

## Gotchas paid for

- **`byBranch` keys are branch POSITIONS.** The runtime `OrOptions` index is
  `-1` for every unavailable / auto-resolved branch, so it cannot key
  anything; the composer's cursor index is what both sides share.
- **The played card is a reactor of its own play.** `Player.onCardPlayed`
  pushes the card into `playedCards` BEFORE the fan-out, so a card with an
  `onCardPlayed` hook fires on itself (Olympus Conference's own science tag);
  the engine adds the played card to the reactor set when it is not yet in
  the tableau.
- **Honest priorities beat neat ones.** Media Group / Splice's owner half
  ride `GainResourcesDeferred` (`GAIN_RESOURCE_OR_PRODUCTION`), so they land
  BEHIND the card player's `DEFAULT` question — the parity spec answers the
  reactor prompts before looking for the events, and the band orders by the
  declared priority, never by the hook's file order.
- **A bot corporation that delegates keeps the HUMAN channel.** MarsBot
  Splice runs the human card's own line under `card-played-by-any`; the
  forecast re-sources it as the corporation but keeps that channel, or the
  parity guard cannot match the event.
- **The explorer's cursors are per HOST.** A composer's layer and the
  Information workspace's explorer can never share `focusKey` / `detail`
  (`createEffectsExplorerUi`), so «B inside the layer» can never fold the
  info panel's dossier and vice versa.
- **Type-check the template's optional chains.** `entry!.effectNode` does not
  compile in a template (the spec forbids `!` there); the explorer routes them
  through script-side accessors (`ftileEffectNodeOf`) behind the `v-if`.
- **The fixture, not the wizard.** Playing Carbon Nanosystems + Olympus
  Conference + Rover Construction + Earth Catapult through the real hand
  flow costs more M€ than generation 1 holds; the e2e boots the generated
  `effect-forecast` fixture (`npm run e2e:fixtures`) — the corporations are
  dealt deterministically through `customCorporationsList` + `startingCorporations: 1`
  (the dealt list is read when `SelectInitialCards` is BUILT, so replacing
  `dealtCorporationCards` afterwards is refused by the prompt). The generator
  rewrites EVERY fixture's timestamps — restore the untouched ones with
  `git checkout` so the diff stays the new fixture alone.
- **The cap is honest about opponents.** The row orders own → asks → others
  → «⚡ ?» and folds past four, so a play with three own chips folds the
  opponent's INTO «+N» (Topsoil Contract's second-order M€ did exactly that
  in the first fixture) — the layer's «Получат другие» is the reading then,
  never a re-ordering of the row.
- **The row never shrinks beside its neighbours.** As a `flex: 0 1 auto`
  cluster unit it shrank and wrapped its caption onto one line and its chips
  onto the next; `flex: 0 0 auto` makes it take the NEXT cluster line whole
  when the first cannot hold it.
