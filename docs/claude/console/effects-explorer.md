# The Effects Explorer («Информация › Эффекты»)

Full rework 2026-09-12: the effects route stopped being a dead desktop-era
`EffectBlock` grid and became a first-class explorer in the **card-actions
browse language**, with per-EFFECT grouping, live whole-game statistics and
an in-explorer detail dossier. The overview zone was rebuilt with it (its old
«Активные / Скидки» pair counted per CARD, and its discount predicate —
`signature?.discount !== undefined` over a required boolean — was always
true, so the two numbers were always equal).

## The four FAMILIES (per effect, never per card)

`effectsExplorerModel.ts` (`src/client/console/`) classifies EVERY effect
into one of four player-facing families — the summary zone's counting unit,
the browse facet (LT/RT) and the tile's rail colour:

| family | RU | EffectCategory members | rail colour |
| --- | --- | --- | --- |
| `triggers` | Триггеры | trigger, resourceAccumulation, passiveTr, passiveProduction, colonyTrade | mint |
| `discounts` | Скидки | discount, tradeDiscount, greeneryDiscount | cyan |
| `payValue` | Ценность оплаты | payment, paymentValueBonus | amber |
| `rules` | Правила | ruleChange (`corporation` is unreachable — see below) | steel |

`effectFamily(entry, card, isOnlyEffect)` is a precedence ladder, each step
spec'd (`tests/console/effectsExplorerModel.spec.ts`): structural
`valueAsPayment` → `curatedCategoryFor(cardName)` (the additive export of
`effectSummary.ts`'s four curated sets) → `FAMILY_OVERRIDES` (Helion; the
EMPTY_SIGNATURE render overrides Olympus Conference / Neptunian Power
Consultants) → printed `signature.discount` → the server-declared
`CardModel.discount` (SINGLE-effect cards only — a card-level field must
never re-family a sibling effect) → `classifyEffectSignature` with a FORCED
`'card'` source kind (a corporation's effect classifies by its NATURE, never
as «corporation»). The corpus guard
(`tests/client/components/effects/effectFamilyCoverage.spec.ts`) sweeps
`allScopeEffectCardNames()` and pins ~16 marquee expectations.

## Per-effect statistics — the CHANNEL split

The server's `/api/game/effect-stats` aggregate gained an additive
`byChannel` field (`src/common/events/aggregate.ts`): every passive-effect
event classifies into an `EffectStatChannel` — the firing hook's
`EventTrigger` (recovered from the `effect-triggered` marker directly or via
a bounded same-source `parentId` walk — deferred impacts share the captured
scope, so Pets' city-deferred animal still lands on `'tile-placed'`), or a
tag-identified marker-less family (`discount`, `resource-payment`,
`payment-bonus`, the colony trio). Anything unclassifiable is honestly
`'unattributed'`. **No recorder or serialization change** — old saves
recompute and degrade to `unattributed` → the card-scoped fallback. ⚠️
Channel trigger counts are NOT a partition of the card-level total (payment
channels count events the total deliberately excludes).

`effectChannels.ts` (`src/client/components/effects/`, @console-shared) maps
effects to channels: structural rules (valueAsPayment → `resource-payment`,
discount → `discount`) + `CURATED_EFFECT_CHANNELS` (Carbon Nanosystems,
Solar Logistics, Pets — an EMPTY set means «this effect never tallies», the
Pets-rule case). `perEffectStat` splits a multi-effect card's stat ONLY when
the plan is complete + pairwise disjoint and the aggregate left no
`unattributed` residue; otherwise `scope: 'card'` keeps today's honest
`cardScoped` presentation. The split feeds `getEffectSummary` UNFORKED: a
successful split passes `effectCount: 1, siblingIcons: []` (real trigger
count, no card-scope caption). The pinned worklist of unsplittable
multi-effect cards (Advanced Alloys, Pharmacy Union, PolderTECH Dutch,
Splice) lives in the coverage spec — a NEW multi-effect card failing the
plan lands there and must decide.

Client cache: `effectStatsStore.ts` — keyed `gameStateVersion(view)#color`
(the serverDerivedCacheGuard law; pinned in its `covered` list), SWR, per-
seat retention across LB/RB, stale-response drop. `ConsoleInfoMode` owns the
`ensureEffectStats` watcher (on the store's OWN key); the explorer takes
`stats` as a prop. `undefined` stats = loading — **no surface claims a
number** (tile metas render nothing, the zone line is absent, the dossier
shows a skeleton).

## The surfaces

**The zone** (`ConsoleInfoMode` summary, `[data-zone="effects"]`): non-zero
family rows (dot in the rail colour + count) + the quiet whole-game line
(«Срабатываний: N · Сэкономлено: M M€») once the stats land.

**Browse** (`ConsoleEffectsExplorer.vue`, `.con-efx`, host `.con-info__efxhost`):
the card-actions grid re-hosted read-only — left DOSSIER column (source card
face = zoom slot + descend FLIP thumb, family chip, full unclamped rule,
«Эффект i из N»; composed by `resolveDetailFit`, never scrolled), right
2-column grid (Deck: 1) of per-CARD groups: plate (name + live resource
chip) + one TILE per effect with the fixed slot anatomy (`--efx-*` tokens
**value-mirror `--act-*`** — change both or diverge deliberately; the LESS
blocks in `console.less` / `console_tv.less` say so in their headers). Tile
zones: head («Эффект N» way-finder + family chip) · canvas (render-DSL
graphic, `fitActionCanvases` with the `--efx-fit` options) · caption
(`actionDescTier` ladder) · META — the honest one-liner (`effectTileMeta`):
stat / «Ещё не срабатывал» / «Статистика всей карты» / nothing while
loading. Multi-effect groups are `--wide` (tiles abreast, NO «или» seam —
effects are conjunctive).

**Detail** (a LAYER inside the explorer — the score explorer's MA-inspection
precedent, NOT an infoRoute node): A on a tile arms the descend rects
SYNCHRONOUSLY and unfolds the dossier out of the tile
(`consoleEffectsFocusMotion.ts` — the action-focus phrase with `effect-*`
descend keys and the seven selectors re-pointed; timings identical). Hero
card (FLIP destination) + `[data-unfold-surface]`: printed rule (large) +
`ConsoleEffectSummary.vue` («За партию»: headline, confidence chip, trigger
count, impact lines, current value, breakdown, note, last generation). LB/RB
step the SIBLING effect in the standing stage (`playEffectsDetailStep` — a
directional patch, never a re-descend; the fold target re-arms to the
stepped tile). B folds one level; a seat switch drops the detail INSTANTLY
(`armEffectsInstantFold`).

**Crumb**: `effectsStagePath()` (campaign pattern, pre-translated) —
«ЭФФЕКТЫ» → «ЭФФЕКТЫ · <КАРТА>»; the tail only ever advances.
**Route entry**: unfold out of `[data-zone="effects"]` (rect captured in the
LEAVE hook), B folds back — the campaign/extras branches' sibling in
`detailZoneEnter/Leave`.

## Input

Browse: d-pad grid (`stepActionRows` verbatim) · A descend · X inspect the
source card (one console zoom, `slotZoomOrigin`, `onBrowse` moves the
cursor) · LB/RB seat switch · LT/RT family facet · R3 reset · RS scroll.
Detail: LB/RB sibling effect · X inspect the hero · B fold. The shell's
`handleInfoIntent` effects branch is layer-conditional on
`effectsExplorerLayer()` (the played-categories bumper grammar);
`consumeEffectsBack()` is asked before `infoBack()`. Bar sets are the
explorer's own (`effectsExplorerUi.barCommands`, returned verbatim by
`footCommands`). ⚠️ The browse thumb's and the hero's `data-zoom-slot` bind
MUTUALLY EXCLUSIVELY on the layer — two slots with one key land the zoom's
close flight in the invisible parked thumb.

## Reuse contract (future hosts)

The explorer is host-agnostic: `cards` (ANY card set), `color`, `stats`
props; module cursors reset via `resetEffectsExplorer()`; the host owns the
frame, the crumb (via `effectsStagePath`) and the stats fetch. A future
«effects this play would trigger» surface feeds a filtered card set + its
own stats resolution and reuses everything (model, tiles, families, motion).

## Guards

`tests/events/effectChannelStats.spec.ts` (the split, deferred recovery,
foreign-nesting, unattributed, actions-stay-clean) ·
`tests/events/effectSummary.spec.ts` § per-effect channel adapter ·
`tests/console/effectsExplorerModel.spec.ts` ·
`tests/console/effectStatsStore.spec.ts` ·
`tests/routes/ApiGameEffectStats.spec.ts` ·
`tests/client/components/effects/effectFamilyCoverage.spec.ts` (corpus) ·
e2e `tests/e2e/console-effects-explorer.spec.ts` (three profiles + reduced
motion; the journey plays Carbon Nanosystems BEFORE Olympus Conference so
the on-screen statistics are the server's own recorded facts).
