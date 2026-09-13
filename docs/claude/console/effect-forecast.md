# The Effect Forecast — «Сработает» + the R3 «Эффекты» layer (as built, 2026-09-13 · iteration 2 the same day)

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

Two additive markers (iteration 2):

- **`ActionEffect.host`** — the CARD whose resource pool a chip moves, when it
  is exactly one card. Stamped by the ENGINE from the builders' own vocabulary
  (`stampHosts`: «on this card» → the reacting source, «on the played card» →
  the card being played), never typed by a hook. It is the explicit TARGET
  marker the pool rule reads (below); a player's stock / production pool and
  a target chosen in a later step («to a card») carry none.
- **`EffectForecastSource.printedEffect`** — WHICH printed effect block of the
  source a fact belongs to, declared by the CARD FILE when its blocks share
  one live channel and the channel plan cannot tell them apart (Pharmacy
  Union: the microbe half is block #0, the science half #1, in the corp box's
  render order — pinned by `effectFamilyCoverage.spec.ts`). The tile draws
  that block's graphic. It is NEVER a statistics split: the event stream
  records both halves under `card-played-by-any` (one live hook), so their
  stats honestly stay card-scoped.

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
`onTilePlaced` is a deferred `unknown`. With SEVERAL branches the tiles EVERY
available branch places are the PLAY's (`sharedTilesOf` — a multiset
intersection; an unavailable branch carries no steps and cannot vote): their
reactions stand in `facts`, and only each option's OWN remainder
(`ownTilesOf`) is asked as a branch-tied pass into `byBranch`. Imported
Hydrogen's ocean — the same step in the plants branch and in both «to another
card» branches — therefore fires the opponent's Neptunian Power Consultants
as a branch-independent fact, not inside whichever option happens to be
available. Discounts come from
`getCardCostBreakdown` (play of a project card only) with
`other = max(0, base − final − Σitems)`; payment values from
`paymentOptionsForCard` × `SPENDABLE_CARD_RESOURCES` × the card in the
tableau. A multi-branch preview fills `byBranch[pos]` per available
branch with `certainty: 'conditional'` (an `unknown` stays `unknown`).
`FORECAST_HOOK_PAIRS` is the engine's declared «live hook → forecast hook»
table, and the coverage guard's law.

**What will NOT happen is not forecast** (the «неприменимо» audit, 2026-09-13).
The engine reads the operation the RUNTIME will make, never the printed one:

- **an ocean that cannot land** — `PlaceOceanTile.execute` returns without a
  prompt once the oceans are maxed (`canAddOcean`), and a two-ocean card with
  one ocean left places ONE. The declarative walker (`stepsForBehavior`) now
  emits the ocean `boardPlacement` step clamped to the oceans remaining (none
  left → no step, so the composer promises no «клетка под океан» either — the
  card's own `maxoceans` warning says why), and `tilesOfBranch` clamps a
  BASE ocean tile the same way on its own, for a bespoke preview that did not
  (a composite laid over an ocean is not a new ocean and is never clamped);
- **a gain that changes nothing** — a chip with `resulting <= current` (a
  parameter already at its cap) is no grant for the second-order hooks
  (`grantOfEffect`); an «add to a card» with no eligible card was already no
  chip at all (the preview suppresses it and speaks through its warning);
- **a lone branch the rules refuse** (a blocked action's setup) grants and
  places nothing — its reactions would describe an operation that cannot run;
  with several branches the refused ones were already skipped.

**The POOL rule** (`stripTouchedPools` over `chipPool`, after `stampHosts`):
`current → resulting` survives only on a pool the operation does not touch
ITSELF; where it does, the arrow goes and the client says «сверх собственного
эффекта карты». A pool is:

- a **card resource** — `icon + host card` (`microbe|card:Decomposers`). The
  card's own «on this card» touches the PLAYED card's pool only, so
  Decomposers', Ecological Zone's or Carbon Nanosystems' arrow on their OWN
  card survives a play that stores the same resource on itself; Splice's
  microbe «on the played card» loses its arrow. A host-less chip («to a card»,
  a target chosen later) is the wildcard: an own one touches every pool of
  that icon, a reaction's is touched by any own chip of that icon;
- a **player's resource** — `icon|player`: stock AND production collapse into
  ONE pool for the arrow test. Two arrows about one resource — the card's own
  «1 → 2 производство» and Manutech's «0 → 2» stock beside it — read as a
  contradiction on one screen, so Manutech's energy loses its arrow when the
  card raises energy production (the spec's third scenario); Media Group's
  M€ beside an Asteroid keeps it. A foreign recipient's pool is never the
  actor's own.

**The reasons** are ONE i18n key per tag in the player's grammar —
`tagReason(tag)` / `anyPlayerTagReason(tag)` in `effectForecastPreviews.ts`
(«You play a card with a science tag» → «Вы играете карту с меткой науки»;
the twelve premium-scope tags are named, a tag outside them keeps the
parameterised `${0}` sentence filled from `reasonTag`). The eighteen hook
sites call the helper; no hook types the sentence.

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
  no); every chip a **BARE DELTA** (`rowChip`: direction, icon, amount, the
  unit suffix — no arrow, no note, no basis, no host; those readings live in
  the layer) with a `production` flag for the pool; merging by the key
  `direction | icon | stock/production` inside ONE degree and ONE recipient
  (two +2 M€ sources → «+4 M€»; a microbe on Decomposers and a microbe on the
  played card → «+2 🦠» — the ASSIGNMENT is not in the key; a production
  step never merges with a stock gain; «+1 🦠» and «+1 🦠 ?» never merge —
  degrees are separate maps; a gain and a LOSS of one pool stay two chips — a
  net the server never computed is not a merge), the order own exact → asks
  (first GAIN of the first outcome) → other seats (per seat, per degree, per
  pool — different seats never merge) → ONE «⚡ ?» for every unknown, the cap
  `FORECAST_CHIP_CAP = 4` with «+N», and the PARITY counters
  (`represented === total`, a fact feeding two pools counted once).
- **The variant reactions** — `variantReactionChips`: ONLY `byBranch[pos]`,
  the same bare deltas merged by the same key (own → asked → other seats),
  `VARIANT_REACTION_CAP = 2` + «+N», with `total` for the aria reading.
- **The WHEN vocabulary** — `timingLabel(timing, operation)`: an immediate
  reaction is «сразу после розыгрыша» for a play and «сразу после выполнения»
  for an action (`'Right after the action'`); every other moment reads the
  same on both screens. `forecastMetaLine(item, operation)` rides it.
- **The discount tail** — `discountTail` (`base → final`, `saved`).
- **Presence** — `forecastLayerAvailable` (any fact / discount / payment
  value), `forecastRowPresent` (at least one chip): a discount-only forecast
  keeps R3 and draws no row; an empty forecast publishes nothing.
- **The eight groups** — `forecastGroups` in the fixed order
  ⚡ Вы получите · ? Вас спросят · ⚡ Зависит от вашего выбора (one entry per
  AVAILABLE branch, «ничего не сработает» for an empty one — it wears the SAME
  bolt the option cards' «⚡ сработает» note carries, so the legend is learnt
  by adjacency; the «↳» arrow told the player nothing) · − Скидки и
  оплата (items + «прочие» + payment values) · ▍ Получат другие · … Позже
  (deferred / unknown) · ⚠ Пропустится · ✕ Не сработает (ONLY explicit `no`
  facts). Non-empty only. `forecastSectionChips` / `cycleForecastSection` are
  the LT/RT facet; `buildForecastBrowseModel` packs each section into its own
  rows (`columns` abreast) with a stable `key` per item.
- **The «ПОРЯДОК» band** — `forecastOrderBand`: asks + deferred facts (+ the
  selected branch's) sorted by timing rank then declared `sequence`, with the
  card-choice and cell markers interleaved; ONLY when there are two or more
  and every one declares `sequence`.
- **Attribution** — `attributeFactToEffect(channel, entries, printedEffect?)`:
  the block the card FILE declared wins (`source.printedEffect`, Pharmacy
  Union); else the explorer's channel plan (`expectedChannelsFor`): one
  candidate on the fact's channel, or the single effect of a one-effect card;
  else `undefined` and the tile falls back to the honest «Эффект этой карты».
  `attributeItemToEffect` extends it to discount / payment items.
- `TIMING_LABEL`, `CERTAINTY_LABEL`, `factBeyondOwnEffect`, `forecastMetaLine`.

## The surfaces

**The row** (`ConsoleForecastRow.vue`, `.con-forecast`): the EFFECTS BOLT
(`.con-forecast__bolt`, `@con-amber` — warm amber-orange, so it can never be
read as the ENERGY resource, whose lightning is violet; the one glyph of this
whole language, shared with the option cards' note and the layer's group
headers) · «Сработает:» · chips · `<GamepadGlyph control="stickR"/>`.
NOT a focus stop (no cursor, no selection, no A); a click opens the layer.
Every chip is a BARE DELTA («+1 ⬡», «+1 🃏 ?», «▍☣ +1», «▍−4 M€» — never
«⬡ 0 → 1», never «на разыгранную карту»; those readings live in the layer's
meta line, dossier and detail stage, where «было → станет» is allowed for an
untouched pool). Four chip forms, all the shared `ActionEffectChip` in the
compact family: own = the ordinary mint gain chip; asks = the same chip + a
round cyan «?» badge (text, no sprite); other = a STEEL chassis (never mint)
with the seat's colour BAR on the leading edge and a DOT before the number
(`player_bg_color_*` — bots included), and a LOSS wears the SPEND tone
(`--loss`: the amber rim over the warm plate the «Будет потрачено» chips
wear) so it reads by tone, never by comparing numbers; unknown = ONE dashed
steel «⚡ ?»; «+N» past the cap. A production step keeps its identity
without a word through the PRODUCTION PLATE on its icon (`--production`: the
card art's own brown box). On the play screen the row is one more UNIT of
the level-2 cluster (`.con-composer__rescat--forecast`) — same rhythm, same
type, ONE line at 1080 and 4K for the four-fact microbe play (e2e-pinned),
at most a second cluster line on the Deck; on the action screen it is the
formula's FOURTH SIDE (`__hero-side--forecast` with the `__hero-label`
«Сработает», caption-less) or ONE line under the rule when there is no
formula. Absent from the DOM while the forecast is empty; nothing is
reserved while it loads (it arrives with the preview).

**The «⚡ сработает» note** (`ConsoleForecastReactions.vue`,
`.con-forecast__vfx`) rides INSIDE the option cards, on the SAME line as the
option's own chips (`__variant-chips` / `__branch-formula`): a thin vertical
seam, the bolt + the word «сработает» as a note (the zone caption in
miniature — `$t('Will trigger')` lowercased by CSS, no second key), the
branch's bare chips (two + «+N», merged by the row's key) with the seat dot,
bar and «?» badge where they apply. ONE flex item that never wraps inside:
when the line runs out the whole group takes the next line, caption and
chips together. The option cards grew no taller for it at 1080 and 4K
(e2e-pinned per option), and the row below never repeats these chips.

**The discount tail** (`ConsolePaymentPanel` `discount` prop): «ОПЛАТА ·
ЦЕНА 10 → 8» in the «было → станет» vocabulary + a mint «−2» pill,
line-height-bound so the head's height never moves (the panel's layout-shift
contract; spec-pinned). Without a discount the head is byte-identical to
before. Sources live in the layer only.

**FREE** (`ConsolePaymentPanel` `free` prop, `.con-pay--free`): when the
server's `calculatedCost === 0` — a printed zero (Indentured Workers:
«ЦЕНА 0 · БЕСПЛАТНО», no arrow, no pill) or discounts that ate the cost
(Insulation under Earth Catapult: «ЦЕНА 2 → 0 · −2 · БЕСПЛАТНО») — the block
collapses to its head plus the «БЕСПЛАТНО» accent (`__free`: tracked caps,
mint, the crumb stage's own .8rem / 700 / .12rem voice, no glow, no motion).
No rows, no verdict, no editor hint; the composer's `payFree` also empties
the quick-adjust dial, refuses `openPaymentEditor`, publishes no LT and
reports the payment ready without a press — the commit rail holds the
cursor on open and one A plays. It is a DIFFERENT composition, not a paint
change, static for the composer's session; only a state change that
re-prices the card above zero unfolds the block back (the one layout shift
the block allows). The action screen is untouched (actions are never
discounted).

**The radiogroup's AXIS** (`variantGroupNav` in `consolePlayCardComposer.ts`,
pure; `measureVariantAxis` in the composer): the «ИЛИ» options move the way
they look. Side by side (`row` — every option card at the same `offsetTop`),
←→ switch the options with wrap, ↑ leaves to the previous ring stop (none
above the first option ⇒ stay), ↓ to the next stop after the LAST option (a
pick row, else the commit rail — bounded by the commit gate, so an unmade
choice keeps the cursor in the group), and ↑ from just below RE-ENTERS on the
option the cursor left (`variantReturnIdx`, kept by a `focusIdx` watcher).
Stacked (`column` — the Deck), the group declines every press: the ordinary
±1 walk moves ↑↓ and ←→ stay inert. The axis is MEASURED (a
`useResizeObserver` on `.con-composer__variants`, re-armed when a preview
lands), never a JS copy of the container query's 47rem threshold; it is
published as `data-variant-axis` for the guards, and the bar reads
`◄► Вариант` (`dpadH` + the existing `Option` key) while the cursor stands
in a side-by-side group. Selection stays a PRESS — the three-state grammar
(cursor / answer / commit) is untouched, and the action composer is not
(its branches stand in a list and already walk ↑↓).

**Skipped reactions** speak the row's own language, never the composer's
amber `__warn` strip (that strip names the CARD's own lost effects — an
opponent's Neptunian «cannot afford 5 M€» once stood there as a big brown
block, a different surface's voice for something that was not even the
viewer's loss). YOUR OWN reaction with nowhere to apply (Mars University with
no other card in hand, Pharmacy Union's TR under an unaffordable Reds tax) is
a fifth chip form of the row: the lost GAIN as a struck, muted chip (the
shared chip's `skipped` face) with a «⚠» badge — the glyph of the layer's
«Пропустится» group — placed after the other seats' chips and before «⚡ ?»,
merged by pool, counted in the parity. A FOREIGN seat's skipped reaction never
reaches the row: it is not the viewer's loss, and the layer's «Пропустится»
names it under its owner with the reason. Inside an «ИЛИ» option a tied
reaction keeps a degree that already says «will not run» (`asBranchFact`:
skipped stays skipped, no stays no, unknown stays unknown; only the firing
degrees read `conditional`), so the option's «⚡ сработает» note never
promises a question whose owner cannot pay.

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
карты», ПОЧЕМУ with the tag icon bound to the sentence's LAST WORD in a
`nowrap` pair (`__fq-tail` — «…с меткой науки ⚛» never breaks before the
icon), УСЛОВИЕ with its state pill and «выбрано», КОМУ with the seat dot,
КОГДА through `timingLabel(timing, operation)` — the explorer's `operation`
prop, `'action'` from the action composer) + the full rule + ONE quiet
«За партию» line once the seat's stats arrive (a bot / rule source claims
nothing). On the Deck the browse plate keeps THREE lines — ЧТО · ПОЧЕМУ ·
КОГДА; the condition and the recipient wait for the detail stage (five lines
pushed the groups under the scroll). A on a
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
the timing labels incl. `Right after the action` → «Сразу после выполнения»,
`Answer inside this play`, `Not calculated`, `Other discounts`, `Nothing will
trigger`, `Beyond the card's own effect`, `Effect of this card`, `If you
choose «${0}»`, …); the hooks' reasons / notes / rule names in
`src/locales/ru/effect_forecast.json` — the tag reasons are ONE key per tag
in the genitive («You play a card with a science tag» → «Вы играете карту с
меткой науки», «Any player plays a card with a microbe tag» → «Любой игрок
играет карту с меткой микроба»; twelve tags × two families), with the
parameterised `You play a card with a ${0} tag` kept only as the fallback
for a tag outside the premium scope. Existing keys are reused where they
existed (`Effects`, `You will receive`, `Later`, `Condition met`, `Do
nothing`, the prompt labels, `Free` → «Бесплатно» for the FREE accent,
`Option` → «Вариант» for the radiogroup hint).

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
- `tests/console/effectForecastModel.spec.ts` — the pure client model (36):
  bare deltas, the merge key (assignment out, degree / recipient / direction
  in), the production flag, the variant merge, `timingLabel` per operation,
  the depends bolt, `printedEffect` attribution.
- `tests/models/effectForecast.spec.ts` § the POOL rule — Decomposers +
  Nitrite Reducing Bacteria (arrow kept, host stamped), Splice + the same
  (the played card's pool, no arrow), Manutech + Artificial Photosynthesis
  (the player's energy pool, no arrow), and the rule over synthetic chips;
  § the card-declared printed block and the per-tag reasons.
- `tests/client/components/console/consolePaymentPanel.spec.ts` — the
  discount tail + its zero-element layout-shift claim; the FREE composition
  (head + accent only, printed zero vs discounted zero, a different
  composition rather than a paint change); `consolePlayCardComposer.spec.ts`
  — `variantGroupNav` (row / column, wrap, bounded ↓, the memory) and the
  `◄► Вариант` hint; `consoleActionFlow.spec.ts` — R3 is published only with
  a non-empty forecast, review / setup level only.
- `tests/client/components/effects/effectFamilyCoverage.spec.ts` — Pharmacy
  Union stays on the card-scoped worklist WITH the reason (one live channel
  for two blocks), and its printed blocks' order (#0 microbe, #1 science) is
  pinned for the forecast's `printedEffect`.
- `serverDerivedCacheGuard`, `glyphLiteralGuard`, `consoleTvTypeFloor`,
  `effectCaption` — unchanged and green.
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
  (Livestock → Meat Industry) and its «сразу после выполнения»; the fit
  sweep + zero `[console-overflow]` on every preset. Iteration 2 added: the
  microbe row reads on ONE line at 1080 and 4K (`expectRowOneLine` — caption,
  chips and the R3 key share a top edge) and the level-2 cluster takes at
  most two lines on the Deck; no arrow / no note inside the row; red's loss
  wears `--loss`; Pharmacy Union's tile draws its printed block; the «⚡
  сработает» note stands on each option's OWN chip line (per-option line
  count 1 at 1080 and 4K); the radiogroup axis (`data-variant-axis="row"` at
  1080: → switches, A selects without moving, ↓ reaches the rail, ↑ returns to
  the same option, the bar reads «Вариант»; `column` on the Deck: ↓ walks, →
  inert); the FREE composition for Indentured Workers (printed zero) and
  Insulation (2 → 0), LT changing nothing, the rail holding the cursor on
  open, one A playing it and the SERVER's M€ unchanged — the last play of
  the journey, because it is blue's second action of the turn. Screenshots
  in `screenshots/effect-forecast/<preset>/` (`7b-variant-axis`,
  `10-free-printed`, `10-free-discounted` are new).

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
- **A note is a second line at 4K.** «⬡ 0→1», «+1 на разыгранную карту ?»
  and «▍🟡 30→26» each read true and together pushed the microbe row onto a
  second line even on the TV, and the Deck cluster onto three. The row is
  bare by contract now; the layer is where the arrow and the note live.
- **Pharmacy Union's two blocks ride ONE live channel.** The spec's first
  reading («effect 1 by `card-played`, effect 2 by `card-played-by-any`») is
  not what the recorder does: the card has only `onCardPlayedByAnyPlayer`, so
  `Player.onCardPlayed` wraps BOTH halves in `card-played-by-any`. A curated
  channel plan to that effect would have zeroed the science half's stats and
  handed its TR to the microbe block — a dishonest split. The card stays on
  the card-scoped worklist; the forecast tile gets its graphic through the
  card-declared `printedEffect` instead, and the render order of the blocks
  (#0 microbe, #1 science — the OPPOSITE of the spec's numbering) is pinned.
- **Stock and production collapse for the arrow test.** The pool key names
  the scope, but Manutech's «0 → 2 energy» beside the card's own «1 → 2
  производство» was the spec's own «strip it» scenario: one resource, two
  arrows, two bases, one screen. The arrow goes; the delta and «сверх
  собственного эффекта карты» stay.
- **A graphic's two classes sit on ONE node.** The forecast tile's printed
  block is `<span class="con-efx__graphic card-container">` — an e2e
  selector written as a descendant pair (`.con-efx__graphic .card-container`)
  matched nothing while the screenshot showed the block drawn. Assert
  `.con-efx__graphic.card-container`.
- **A shared tile rides EVERY option's steps.** `gainOrAddResourceBranches`
  (Imported Hydrogen, Large Convoy) and the declarative OR walker append the
  card's own placement to each available branch's steps, so a per-branch tile
  pass files the ocean under the option — and with two options refused for
  lack of a target, the opponent's Neptunian question showed up INSIDE the
  «+3 растения» card as if it depended on choosing the plants (reported
  2026-09-13). The engine's comment promised «the tiles every available
  branch shares»; the code passed `[]`. `sharedTilesOf` / `ownTilesOf` are
  the rule now, spec-pinned on that very table.
- **The preview promised a placement the runtime skips.** `stepsForBehavior`
  pushed the ocean step unconditionally, so with the oceans maxed the composer
  read «Далее: клетка под океан» and the forecast claimed Arctic Algae's
  plants and an opponent's Neptunian question for a tile `PlaceOceanTile`
  never places. The staged-parity spec had pinned that compromise («the step
  remains, only the staged payload is absent»); the step is gone now, on both
  layers (the walker's clamp and the engine's own).
- **The e2e journey has a TURN BUDGET.** Blue has two actions; Geological
  Survey is the first play, so the FREE play (Insulation) is the last step of
  the journey — a second play earlier would hand the turn to red and refuse
  every later composer. Indentured Workers (an EVENT, `lastCardPlayed`'s −8
  for the next card) is only inspected, never played, so no later scenario
  inherits its discount.
