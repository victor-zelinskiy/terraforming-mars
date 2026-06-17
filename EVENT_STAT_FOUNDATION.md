# Event / Stat Framework Foundation — Audit & Implementation Report

Foundation pass for the endgame insight analyzer. The driving complaint: too many
passive effects rendered the generic fallback

> «Пассивное правило — оно влияет на игру, а не накапливает показатели.»

even when the effect is genuinely measurable. This pass audits every in-scope passive
effect, fixes the root cause of the over-shown fallback, and adds structured economic
statistics with two flagship special-handlers (Trading Colony, steel/titanium value
modifiers). Scope = the same in-scope modules as the rest of the fork: `base`,
`corpera`, `promo`, `venus`, `colonies`, `prelude` (80 effect blocks).

---

## 13. Root-cause analysis (answered first — required by the brief)

**Why did so many effects show the generic "passive rule" fallback?**

The effect-summary note was chosen from a category that was classified **from the
ACCUMULATED DATA** (`classifyEffect(ctx, stat)`). With an empty stat — which is the
state of EVERY effect at the start of the game, and of every *trigger* effect until it
first fires — that classifier has nothing to key on and collapses to `ruleChange`,
whose note is the generic "passive rule" string.

So the fallback was not "this effect is untrackable"; it was **"nothing has been
recorded for it YET"** — shown identically for a brand-new discount card, an unfired
trigger, AND a genuine rule-only effect. The framework *could* see the trigger (the
hooks are wrapped in effect-scopes and impacts are tagged `passive-effect`); the UI
just couldn't *frame the empty state* by what the effect is CAPABLE of.

Two genuinely-trackable economic effect families were ALSO hidden behind the fallback
because the recorder never wrote their value:

- **steel/titanium value modifiers** (Advanced Alloys, …) — `Player.pay()` deducted
  steel/titanium but never recorded the EXTRA M€ value the modifier contributed.
- **Trading Colony's track bump** — `Colony.trade()` advanced the track and only wrote
  a TEXT log (`LogHelper.logColonyTrackIncrease`), never a structured event.

**What data was being lost:** the per-payment steel/titanium value bonus, and the
colony-track steps + extra trade reward a trade-offset effect produced.

**The fix:** (1) frame the empty-state note by the effect's render SIGNATURE
(capability), not the empty data; (2) record the two missing economic dimensions
structurally at their chokepoints, attributed to the owning card.

---

## 2–3. Audit & classification

**Method:** a signature classifier was run over all 80 in-scope effect blocks
(buckets by what each effect's render produces). Combined with the recorder-coverage
audit (which hooks are wrapped in an effect-scope), this gives the honest map below.

| Bucket (by capability) | Count | Tracking status |
| --- | --- | --- |
| Discount (cost reduction) | 13 | ✅ already tracked (`recordDiscount`) |
| Triggered gain (resource / draw / M€ on event) | 14 | ✅ tracked generically (effect-scope tagged) |
| Resource accumulation (microbe/animal/…) | 10 | ✅ tracked (`card-resource-changed`) |
| Resource-as-payment (Psychrophiles/Dirigibles/…) | 4 | ✅ tracked (`recordResourceAsPayment`) |
| Corporation abilities | 31 | ✅ tracked (per-source + corp aggregate) |
| **Economic value modifier (steel/titanium)** | 4¹ | ⛔→✅ **NEW special-handler** |
| **Trade/colony modifier (track bump)** | 2² | ⛔→✅ **NEW special-handler** |
| Trade discount (pay 1 less resource) | 2³ | ⚠️ trackable — **next iteration** (documented) |
| Genuine rule / eligibility (no numeric delta) | few⁴ | ✅ honest curated note + `ruleOnly` confidence |

¹ Advanced Alloys, Rego Plastics, Mercurian Alloys, PhoboLog (corp).
² Trading Colony, Trade Envoys (both `behavior.colonies.tradeOffset`).
³ Cryo-Sleep, Rim Freighters (`behavior.colonies.tradeDiscount`).
⁴ Adaptation Technology (±2 requirements), Protected Habitats (protection), …

Per the user's A–G taxonomy: A (direct tracked) = the first 5 rows; **B (economic
modifier)** = steel/titanium + (next) trade discount; **C (trade/colony modifier)** =
trade-offset; E (triggered passive) = the trigger bucket; **F (rule/eligibility)** =
the last row (legitimate fallback, but now an honest note, not the bare generic one);
G (truly untrackable) = none in scope — every in-scope effect now resolves to either a
measurable tally or an honest, specific rule note.

---

## 4. Framework changes (the structured stat layer was EXTENDED, not duplicated)

The existing `GameEvent` stream **is** the structured stat layer; it was extended
rather than building a parallel `EffectStatEvent` table (which would drift). Two new
EXACT, signed economic dimensions:

- `EventImpact.paymentValueBonus?: {resource: 'steel'|'titanium'; amountSpent; bonusValue}[]`
- `EventImpact.colonyTrackAdvanced?: {colony; steps; extraReward}[]`
- New tags `payment-bonus` / `colony-track` (both also `passive-effect`).
- `aggregate.ts`: new `SourceStats.paymentValueBonus` (`{steel,titanium,bonusValue,count}`)
  and `SourceStats.colonyTrack` (`{steps,extraReward,count,colonies}`), folded in
  `foldImpact`, mirrored onto `EffectOverlayStat` + `PlayerStats` (so the per-player
  economy aggregate — the endgame-analyzer feed — carries them too).
- `EventRecorder.recordPaymentValueBonus` / `recordColonyTrackBonus`.
- `ApiGameJournalEvents` excludes the two analytics-only tags (mirrors `resource-payment`)
  so the overlay sees them but the journal isn't duplicated.

## 5. Special handlers implemented

**Steel/titanium value modifier** (`Player.recordPaymentValueBonus`, called from
`pay()`): each declarative `behavior.steelValue` / `behavior.titanumValue` card is
found in the tableau and credited the EXACT extra value (`spent × its +N`). Generic —
covers every such card across all expansions automatically; imperative modifiers
(Price Wars, Turmoil policies) stay honestly unattributed. **Confidence: exact.**

**Trading Colony track bump** (`Colony.recordTradeTrackBonus`, called from BOTH the
auto and the player-choice track-advance paths): records the track steps + the EXACT
extra trade reward (`quantity[after] − quantity[before]`), attributed to the
`behavior.colonies.tradeOffset` card(s) — split sequentially when several apply so
each card's extra reward is exact. The reward's **M€ value is deliberately NOT
estimated** (depends on each colony's mapping). **Confidence: partial** (exact facts,
no M€ valuation) — this is the brief's "don't over-claim value" rule made explicit.

## 6. UI changes (`effectSummary` + `EffectDetailsPanel`)

- New categories `paymentValueBonus` ("Payment value bonus" → extra value + spent
  under effect) and `colonyTrade` ("Colony track advanced" → steps + extra reward +
  a **per-colony breakdown**).
- **Root-cause fix:** an empty effect now frames its note by render signature /
  special-card kind, so an unfired trigger reads "this effect hasn't triggered yet"
  and a discount reads "applies when you play a matching card" — the bare "passive
  rule" note is now reserved for effects with NO measurable output.
- A **confidence chip** (Exact / Partial / Rule effect) surfaces how quantifiable each
  tally is.

## 8. Confidence model

`EffectConfidence = 'exact' | 'partial' | 'ruleOnly'`. exact = precise tally (discounts,
value bonus, resources); partial = exact facts, no M€ valuation (colony track); ruleOnly
= a rule with no numeric delta. Surfaced as a chip; never fabricates a disputed value.

## 9. Tests / guards

- `tests/events/economicStats.spec.ts` — records steel/titanium bonus + colony-track
  bonus, and aggregates them (NEW).
- `tests/events/effectSummary.spec.ts` — new-category VMs + the root-cause empty-note
  fix + rule-only confidence (extended).
- `tests/client/components/effects/effectSummaryCoverage.spec.ts` — still green (no
  dead summaries); the machine-checkable audit of acceptance criterion #3.
- Server build, `vue-tsc` (0 errors), `make:json` (no i18n dupes), and the full
  `tests/colonies` + `tests/events` + `tests/Player` suites pass.

## 11. Endgame-analyzer readiness

The per-player economy aggregate now carries `paymentValueBonus` + `colonyTrack`, so
future insights are a pure read over existing data, e.g.:
"Титановый engine дал Nastya +14 M€ эффективной стоимости", "Торговая колония дала
Victor +6 шагов треков за игру", "победа построена в т.ч. на экономике скидок".

## Acceptance-criteria status

1–3 ✅ audit + classification + fallback no longer the default. 4–7 ✅ economic stats +
steel/titanium + Trading Colony handlers. 8–9 ✅ meaningful UI + honest rule-only notes.
10 ✅ structured, endgame-ready. 11 ✅ machine-checkable coverage guard + playground.
12 ✅ fixtures (`economicStats.spec`). 13 ✅ structured-at-source, no text parsing.
14 ✅ journal/notification/endgame can consume. 15 ✅ this report. **Confidence** ✅.

## 10/15. Next iterations (honest remainder)

- **Out-of-scope value modifiers** done generically server-side already (Lunar Steel
  [moon], Price Wars [underworld], Turmoil policies) — only the CLIENT empty-note set
  needs widening when those modules enter scope.
- `vp-granted` is intentionally NOT a stream event — see Iteration 2.

---

# ═══════════════════════════════════════════════════════════════════
# ITERATION 2 — documented gaps closed + ACTIVE blue-card action stats
# ═══════════════════════════════════════════════════════════════════

## A. Documented gaps from Iteration 1 — closed

**Colony TRADE DISCOUNT (Cryo-Sleep / Rim Freighters, `behavior.colonies.tradeDiscount`).**
Now tracked, mirroring the colony-track handler. The 3 traders (`Colonies.ts`
TradeWith{Energy,Titanium,Megacredits}) call `recordTradeDiscountSaving(player, colony,
resource, baseCost)` → `events.recordTradeDiscount` → `EventImpact.tradeDiscountSaved`
(tag `trade-discount`, analytics-only) → `SourceStats.tradeDiscount` `{energy, titanium,
megacredits, count, colonies}` → a `tradeDiscount` summary category ("Trade discount"
→ Saved on trades per resource + per-colony breakdown, **confidence `partial`** — only
titanium/M€ have a clean M€ value). Saved units = `min(tradeDiscount, baseCost)`; the
Adhai card-resource discount is a separate mechanism, left unattributed. Empty-state
framed via the `TRADE_DISCOUNT_CARDS` set. Guard: `economicStats.spec.ts`.

**Global-parameter raises (`global-parameter-changed`).** The `EventImpact.globalParameter`
field + `globalParameterSteps` aggregation already existed (Iteration 1) but no event
EMITTED it. Now `Game.ts` emits one at all 4 raise sites (oxygen / temperature / oceans
/ venus) via `events.recordGlobalParameterChange(player, parameter, steps)`, attributed
to the active scope's source (the card / action / standard project that raised it) —
the "who terraformed the planet via X/Y/Z" feed for the endgame analyzer + the per-card
action stats. Tagged `global-parameter` (analytics-only, excluded from the journal,
which already shows the TR + tile; `record()` adds `passive-effect` automatically inside
an effect scope). Guard: `economicStats.spec.ts`.

**`vp-granted` — investigated, intentionally NOT a stream event.** There is NO mid-game
VP mutation in the engine (`grep` finds no `addVictoryPoint` / `victoryPoints +=` on a
player); VP is computed at ENDGAME from `card.victoryPoints` + resources, and the
`VictoryPointsOverlay` already provides the full per-source breakdown the analyzer needs.
Emitting synthetic mid-game VP events would invent data. So this "gap" is closed by
documentation, not code (the honest answer, per the "don't over-claim value" rule).

## B. ACTIVE blue-card action stats — the new foundation

**Root insight: the DATA was already recorded.** Every blue-card / corp / CEO action is
wrapped in `events.beginAction(player, {card}, {category: 'card-action' | 'corporation-action'
| 'ceo-action'})` (`Player.ts`), so its impacts are already attributed to the source
card. The foundation was therefore AGGREGATION + UI, not recording. The ONE recording
change: `GameEvent.category` — the root-action category is now stamped on the event (it
previously lived only in the recorder context, for the journal log), so aggregation can
tell a card's ACTION usage apart from its on-PLAY gains (both are `beginAction` roots
with the same card source).

**Aggregation** (`aggregate.ts`): `actionStatsBySource(events, owner)` folds each
action-category chain's OWN output (events sourced to the action card, or sourceless
events inheriting the scope — NOT nested OTHER-card passive effects, which stay the
effects overlay's) into per-card stats; `triggerCount` = activations. `actionOverlayStats`
is the per-player projection. Route: `/api/game/action-stats` (`ApiGameActionStats`, the
action twin of `ApiGameEffectStats`).

**UI** (`ActionDetailsPanel` "This game" section): a pure view-model `actionUsageSummary`
classifies the action by value KIND (`resource` / `conversion` / `draw` / `terraform` /
`usage`) → a headline + impact lines (gained/spent/drawn/TR/params, reusing
`effectSummary.genericLines`) + activation count + last-used generation + a confidence
chip; an unused action shows "Action not used yet — its usage stats will appear here.",
never a dead state. `ActionsOverlay` fetches the stats stale-while-revalidate (cached by
colour in `actionsOverlayState`, keyed by generation), passes the selected card's stat to
the panel (and to the hidden height-probes so the stable size includes the section).

**Coverage:** action recording + aggregation are GENERIC — EVERY blue/corp/CEO action
card is covered automatically (no per-card work). Measurable actions show exact tallies;
an activation-only action (rule/eligibility — the brief's class H) shows the activation
count with `ruleOnly` confidence. The play/action split is guarded
(`actionStats.spec.ts`: a card-PLAY gain never counts as an action).

**Journal / notifications** are untouched — the new analytics-only tags are excluded
from the journal route, and the existing root-action grouping (which the notifications
read) is unchanged; the `category` field is additive.

## Tests added (Iteration 2)

- `tests/events/economicStats.spec.ts` — trade discount + global-parameter recording.
- `tests/events/actionStats.spec.ts` — action aggregation, accumulation, play/action split.
- `tests/client/components/actions/actionUsageSummary.spec.ts` — the usage view-model
  (classification + empty state + confidence).
- `effectSummary.spec.ts` — the trade-discount category VM.

## Iteration-2 acceptance status

1 ✅ trade discounts + global-parameter paths closed; vp-granted documented as non-applicable.
2–4 ✅ audit extended; generic fallback only for genuine rule-only effects; trackable
effects covered or documented. 5 ✅ economy widened (discounts + payment value + trade
discounts + linked events). 6 ✅ meaningful effect details + honest empty states.
7–9 ✅ active blue-card action foundation: structured stats (activations / costs / gains /
linked root via correlationId / confidence) aggregated into `EffectOverlayStat`.
10 ✅ Actions overlay shows the usage summary. 11 ✅ journal / notifications compatible.
12 ✅ tests for economy + action stats. 13 ✅ coverage via the dead-summary guard + the
generic action aggregation. 14 ✅ server build / vue-tsc / make:json / eslint / tests green.
15 ✅ data for passive effects + economy + active actions no longer lost.

## Remaining for FUTURE iterations (honest)

- **Attack / victim breakdown for actions** — `actionStatsBySource` aggregates per-source
  and loses the per-event target identity, so "removed X from Victor ×2" needs a separate
  per-event attribution layer (the negative-notification stream already has the raw data).
- **Per-generation timeline + "best activation"** for actions — needs retaining per-event
  detail, not just the aggregate; deferred (the aggregate gives totals + last-used now).
- **Opportunity cost / "built but never activated"** engine analysis — needs comparing
  the action's availability history vs its usage; an endgame-analyzer concern.
