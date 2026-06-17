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

---

# ═══════════════════════════════════════════════════════════════════
# ITERATION 3 — analysis-ready fact layer for the endgame analyzer
# ═══════════════════════════════════════════════════════════════════

Goal: move from aggregate-ONLY stats ("how much did X give?") to an ANALYSIS-READY
fact layer the future analyzer turns into a story ("WHEN, WHO was hit, what was the
turning point, which engine actually worked"). No parallel system — every new view is
DERIVED from the existing `GameEvent` stream (the per-event detail IS the stream).

## What was added

**1. Timeline aggregation** (`aggregate.ts`). `aggregateByPlayerGeneration(events)` →
`Map<Color, Map<gen, PlayerStats>>` — every key stat (economy / params / draws /
attacks) per player PER GENERATION, so a consumer can plot "when the engine kicked
in / the late-game economy burst". (`aggregateByGeneration` per-source already existed.)

**2. Attack / victim breakdown** (closes the Iteration-2 gap). `eventAttacker(e)` reads
the attacker behind a victim-loss event (recipient via `target.player` for a steal,
else the source card's owner for a destroy — the notification model's logic generalised
to any viewer). `actionVictimBreakdown(events, attacker)` attributes per-ACTION victims
(for the Actions overlay), `aggregateAttacks(events)` is the whole-game attack ledger
(play + action). Both reuse the SAME structured loss events the negative notifications
read — no duplication. `EffectOverlayStat.victims` is populated by `actionOverlayStats`,
and the Actions-overlay "This game" section renders a "Цели" block (victim colour dot +
resources lost + ×hits). So "Удалено у соперников: растения −7 · Цели: …" is now real.

**3. Fact Engine** (`src/common/events/endgameFacts.ts`, PURE, dependency-injected).
`buildEndgameFacts(events, {cardHasAction?, finalGeneration?})` → `EndgameFact[]`. This is
the `GameEvents/Stats → Facts → (later) Insights` middle arrow — it builds facts but
deliberately writes NO insight prose (§17). Fact types produced: **economy** (saved M€ +
value bonus + trade-discount units, per player), **actionUsage** (per blue/corp action:
activations + gains + cards drawn + last gen), **passiveEffect** (per passive source),
**globalParameter** (per player: per-parameter steps + the top source card — "who moved
the planet"), **colony** (trades + track bonus + trade discount), **negativeInteraction**
(per attacker→victim, what was lost), **engineTiming** (played-gen + activations +
**neverActivated / lowUsage** = "built but not activated"), **notableEvent** (the single
biggest discount / draw / attack). Each fact carries `metrics` (structured numbers, never
prose), `confidence` (exact/partial/approximate/ruleOnly), `severity` (a 0..1 ranking
hint), `relatedEventIds`, and `tags`. Ids are content-derived (no Date/random) → fully
deterministic + snapshot-testable. The engine is pure (no manifest import) — the
"is this an action card" predicate for engine-timing is INJECTED so it runs anywhere.

**4. Coverage guards** (`tests/client/components/effects/trackerCoverageGuard.spec.ts`).
A repeatable, machine-checkable audit (so a gap can't slip in via a screenshot): it
flags any in-scope PASSIVE effect whose render SIGNATURE is measurable (result icons /
discount / value-as-payment) yet whose empty summary collapses to the bare "passive
rule" — currently ZERO (the Iteration-1 signature-driven note + the special-card sets
hold). Plus an ACTIVE-action guard: the usage summary never dead-states, and a
measurable recorded stat classifies to a value kind (not bare `usage`).

**5. Fixtures** (`tests/events/endgameFactFixtures.ts`). A `FactStream` builder + 6
synthetic analyzer scenarios — economy engine / colony engine / blue-action engine /
negative interaction / global-parameter pusher / engine-built-but-unused — the seed of
the suite a future analyzer is tested against. The Fact Engine spec runs over them.

## §19 — required answers

1. **Added:** timeline (`aggregateByPlayerGeneration`), attack/victim breakdown
   (`eventAttacker`/`actionVictimBreakdown`/`aggregateAttacks` + UI), the pure Fact
   Engine (`endgameFacts.ts`), coverage guards, and analyzer fixtures.
2. **Per-event details now available:** the raw `GameEvent` stream already carries
   per-event generation / source / impact (cost+gain) / target / correlationId /
   category / confidence-able tags — the fact layer + timeline + victim breakdown make
   those queryable WITHOUT a parallel store.
3. **Facts buildable now:** economy / actionUsage / passiveEffect / globalParameter /
   colony / negativeInteraction / engineTiming / notableEvent (see above).
4. **Coverage guards added:** suspicious-passive-effect guard + active-action coverage
   guard (both machine-checkable tests).
5. **Suspicious gaps found:** none in scope (the guard list is empty).
6. **Gaps fixed:** the action victim/target gap (Iteration-2 remainder) is closed.
7. **Legitimate ruleOnly/actionOnly kept:** genuine no-output passive rules (Protected
   Habitats, Adaptation Technology, …) stay `ruleChange`/`ruleOnly`; activation-only
   actions stay `usage`/`ruleOnly` — both honest, not "missing tracker".
8. **Fixtures added:** 6 scenarios (economy / colony / blue-action / negative / global /
   unused-engine).
9. **Ready for the analyzer:** facts + timeline + per-source/per-player aggregates +
   victim breakdown are a deterministic, replayable, snapshot-tested base.
10. **For Iteration 4:** the debug VIEW/route over facts; reveal/search FACTS (the
    reveal data lives on `LogMessage.reveal`, not the GameEvent stream — needs a small
    structural bridge); per-event before/after snapshots (needs player-state-at-time);
    the first insight modules (prose) on top of the facts.

**Is the base ready for the first analyzer modules?** YES — `buildEndgameFacts(events)`
gives typed, ranked, deterministic facts; an insight module is now "read facts → phrase".
**Weak data:** VP (no mid-game stream event — endgame breakdown only); reveal/search
(structural marker exists on the log, not yet a fact); attack before/after values.
**Confidence caution:** keep energy/titanium-saved + colony-reward as UNIT facts (the
`partial` confidence) — never auto-convert to M€; cards-drawn is a count, not a M€ value.

## Tests / verification (Iteration 3)

`tests/events/endgameFacts.spec.ts` (fact engine over fixtures), `factAggregates.spec.ts`
(timeline + victim breakdown + attack ledger + `eventAttacker`), `endgameFactFixtures.ts`
(the 6 scenarios), `trackerCoverageGuard.spec.ts` (the suspicious/coverage audit),
`actionUsageSummary.spec.ts` (victim line). Server build, `vue-tsc` (0), `make:json`
(no dupes), eslint on touched files, and the events/colonies suites all green.

## Deferred to Iteration 4 (honest)

- A debug VIEW/route exposing facts/per-player stats (the engine is invokable in tests
  for now — development visibility exists, a UI does not).
- Reveal/search FACTS (bridge `LogMessage.reveal` markers into the fact layer).
- Per-event before/after resource snapshots (needs player-state-at-time, not in the
  stream today).
- The first INSIGHT modules (prose) — intentionally NOT started this iteration (§17).

---

# ═══════════════════════════════════════════════════════════════════
# ITERATION 4 — Fact Debug + Missing Bridges
# ═══════════════════════════════════════════════════════════════════

Goal: make the facts VISIBLE on a real game, close the remaining bridges (reveal/search,
before/after), strengthen notable facts, widen fixtures, and prepare the insight
integration path — WITHOUT starting the prose/storytelling layer. Same architecture
rule: everything DERIVED from the existing `GameEvent` stream.

## §10 — required report

**1. What was added.** (a) A DEBUG ROUTE `/api/game/endgame-facts` returning the typed
`EndgameFact[]` for a game, with server-side filters (`player` / `type` / `confidence` /
`tag` / `generation` / `minSeverity`); `cardHasAction` is derived from the game's own
played cards (via `isIActionCard`) so engine-timing works. (b) A **reveal/search facts
bridge**: a `card-revealed` GameEvent (counts + semantics ONLY, never names) emitted at
the 3 public reveal sites → `revealFacts`. (c) **Before/after snapshots** on resource /
production losses. (d) Extended **notable** facts. (e) 5 more fixtures (→ 11). (f) The
**InsightContext** fact bridge + selection helpers.

**2. How to see facts/debug.** `GET /api/game/endgame-facts?id=<your player/spectator
id>` (open in a browser / curl) → the full fact list; add `&type=economy` /
`&player=red` / `&minSeverity=0.5` / `&tag=attack` / `&generation=7` to filter. It's
dev-only visibility (JSON), exactly the "what facts were born, how strong, what's
missing" view. A richer in-game debug OVERLAY is deferred (the route gives full
visibility now).

**3. Reveal/search facts connected.** `EventRecorder.recordCardReveal(player, source,
{origin, result, count, found})` emits a `card-revealed` event (tag `reveal`, analytics-
only) at PublicPlans (hand show), SearchForLife + AsteroidDeflectionSystem (deck reveal,
with the `found` search-hit flag). `endgameFacts.revealFacts` → per source: `revealed`
(deck) / `shown` (hand) / `searchHits` / `events`. **Privacy:** only the 3 PUBLIC sites
emit; a PRIVATE draw never does (guarded — "a private draw does NOT create a public
reveal event"); the fact carries COUNTS only, never card names.

**4. Before/after snapshots added.** `recordResourceDelta` now takes the live post-value
(threaded from `Stock.add` / `Production.add`, which mutate before recording) and writes
`EventImpact.snapshot = {resource, scope, before: after − amount, after}` — so a loss
reads "plants 506 → 504", not just "−2". Covers the most important STOCK + PRODUCTION
cases (steal / destroy / transfer / reduction); card-resource + VP before/after are the
documented partials.

**5. Notable facts extended.** Added: biggest reveal, biggest production loss, the
strongest single-generation **economy burst** (from the per-player timeline, pinned to
its generation), and the **most-used blue action** — on top of the existing biggest
discount / draw / attack.

**6. Fixtures added.** `revealSearchStream`, `shownHandStream`, `productionTransferStream`
(with a before/after snapshot + the mirror attacker gain), `lateEconomyBurstStream`,
`mixedWinnerStream` — bringing the analyzer scenario suite to **11** (economy / colony /
blue-action / negative / global / unused-engine / reveal / shown-hand / transfer /
late-burst / mixed).

**7. Coverage guards strengthened.** The `trackerCoverageGuard` (suspicious measurable-
but-rule-only passive effects = zero; active-action coverage) is joined by the reveal
INTEGRATION guards (`revealAndSnapshot.spec.ts`): a public deck reveal IS recorded + a
private draw is NOT, and a loss carries a snapshot. The fact-engine reveal/notable/
transfer paths are guarded over the fixtures.

**8. Gaps remaining.** A richer in-game debug OVERLAY (the route is the visibility now);
card-resource / VP before/after snapshots (stock+production done); reveal coverage as a
static source-scan guard (the wiring is integration-tested instead — a NEW reveal card
must call `recordCardReveal`, documented). `vp-granted` stays non-applicable (no mid-game
VP event in the engine).

**9. Ready for the first fact-based endgame insights?** YES. `buildEndgameFacts(events)`
is visible (route), bridged (reveal + before/after), ranked (severity), honest
(confidence), and snapshot-tested over 11 scenarios; `InsightContext.facts` + the
`facts*`/`topX` selectors give analyzers a clean read path with NO rewrite of the
existing engine.

**10. First insight modules to build next (Iteration 5).** Start with the highest-signal,
lowest-ambiguity facts: (i) **economy engine** ("X сэкономил N M€ через скидки/титан"),
(ii) **blue-action engine / unused engine** (engineTiming facts read cleanly), (iii)
**attack pressure** (negativeInteraction + before/after), (iv) **terraforming attribution**
(globalParameter top-source), (v) **reveal/search advantage**. Each is a "read facts →
phrase" module behind the existing deterministic insight machinery.

## Tests / verification (Iteration 4)

`tests/events/endgameFacts.spec.ts` (reveal / notable / transfer / mixed over fixtures),
`revealAndSnapshot.spec.ts` (REAL reveal recording + privacy + snapshot),
`endgameFactFixtures.ts` (11 scenarios). Server build, `vue-tsc` (0), `make:json` (no
dupes), eslint on touched files, and the events/colonies/Game/Player/notification/journal
suites all green.

## Architecture notes / cautions

- The `card-revealed` + the analytics-only tags (`reveal`) are EXCLUDED from the journal
  route (the journal already shows the reveal via its log) — no duplication.
- `snapshot` is per-event detail (read by the analyzer / future journal-before-after),
  NOT aggregated — it stays on the resource/production event it decorates.
- The Fact Engine remains PURE + manifest-injected; the route supplies `cardHasAction`
  from the live game. The insight bridge is OPT-IN (`facts?` is optional) — wiring the
  feed into `generateInsights` is the Iteration-5 step, intentionally not done here (§8).

---

# ═══════════════════════════════════════════════════════════════════
# ITERATION 5 — fact-based endgame STORYTELLING + premium UI
# ═══════════════════════════════════════════════════════════════════

Goal: turn "data ready" into "the final screen tells the STORY of THIS game". The
fact layer (Iterations 1–4) is now WIRED into the endgame insight engine, the selector
ranks by impact/rarity/drama (not just priority), and «Как сложилась партия» renders a
premium hierarchy (hero → key moments → details → show more). The prose layer is
deliberately a FIRST wave — honest, fact-derived, never inventing M€/VP.

## What was added

**1. Story model (insightEngine.ts).** `InsightCandidate` gained (all OPTIONAL → legacy
analyzers unchanged): `family` (15 story families), `uiVariant` (hero/major/normal/
compact/legendary/…), `storyCluster` (diversity key), `scores` (`impact`/`rarity`/`drama`/
`confidence`/`relevance`, 0..1), `relatedFactIds`/`relatedPlayers`/`relatedCards`/
`relatedGeneration`, and selector-set `rankSection` + `finalScore`.

**2. Smart selector `selectStoryInsights`.** Ranks by `finalScore` = priority + a
fact-score bonus (`impact·40 + rarity·60 + drama·40 + relevance·20`) SCALED by
`confidence` (a shaky `partial` fact can't dominate). Picks ONE hero (a decisive verdict
or rarity≥0.7 / drama≥0.8 / `uiVariant:'hero'|'legendary'`), then a diverse PRIMARY band
(≤1 per cluster, rare facts ≥0.6 break through), a looser SECONDARY band, and HIDDEN
("show more"). Honours `suppresses`. Deterministic (id tiebreak). `generateInsights` now
runs the base analyzers + the FACT analyzers → `selectStoryInsights`.

**3. Facts WIRED into the engine.** `EndgameExperience` fetches `/api/game/endgame-facts`
once on mount + derives `playerCards` from the view, passing both into
`buildEndgameModel` → `generateInsights(ctx.facts, ctx.playerCards)`. Graceful: before
the fetch resolves / on an old game / in JSDOM, `facts` is undefined and the engine falls
back to the base template analyzers (no error, no empty screen).

**4. First-wave FACT analyzers** (on `ctx.facts`): `analyzeEconomyFacts` (economy engine +
**economy-underdog win**), `analyzeBlueActionFacts` (most-used action + **unused engine**),
`analyzeNegativeDramaFacts` (most-targeted player + **Predators** rare raid), `analyzeVerminDrama`
(**Vermin** city-pressure, via `playerCards`), `analyzeGlobalParameterFacts` (who moved the
planet), `analyzeRevealFacts` (card-flow edge), `analyzeColonyFacts` (colony engine). Each
is THRESHOLDED (only fires when genuinely notable) + honest with confidence ("measured
value" / units, never invented M€).

**5. Rare/decisive → HERO UI.** Tiebreaker (legendary), photo-finish (hero) and late-
comeback (hero) carry `uiVariant` + high `scores`, so the selector makes them the hero
of the story with a cinematic treatment — no longer a small card lost in the grid.

**6. Premium UI (EndgameOverviewTab + endgame.less).** A HERO card (large, glowing,
legendary gold variant), a KEY-MOMENTS grid, a COMPACT details grid, and a "Show more
analysis" toggle for the hidden band. Per-FAMILY accent tints (economy gold, blueAction
cyan, negativeDrama red, rareEvent violet, …). `prefers-reduced-motion` honoured.

## §17 — required report

- **Analyzers added:** 7 fact-based (economy, blueAction, negativeDrama, vermin, global,
  reveal, colony) on top of the 9 base template analyzers (kept as the fallback layer).
- **Facts used:** economy / actionUsage / engineTiming / negativeInteraction /
  globalParameter / reveal / colony — plus `playerCards` for card-presence (Vermin/Predators).
- **UI variants:** hero, legendary, major, normal, compact (+ family accents + show-more).
- **Rare scenarios covered:** tiebreaker (legendary hero), photo-finish + late-comeback
  (hero), economy-underdog win, unused/never-activated engine, most-targeted player,
  Predators 6+ animal raid, Vermin city-pressure.
- **What remains for Iteration 6:** more first-wave analyzers (standard-project strategy,
  category multi-dominance depth, runner-up story, biggest-single-fact notables); a
  candidate-scoring DEBUG panel (the route shows facts; finalScore/rankSection are on
  each insight but not yet surfaced in a dev UI); richer per-family card layouts
  (attacker/victim split, savings chips, activation counters); and broader phrasing
  variety.

## Honesty / confidence

- Economy/colony savings → "measured value" / units; NEVER a fake exact M€ from
  cards-drawn or partial rewards. `confidence` scales `finalScore` (a `partial` fact
  can't out-shout an `exact` one at equal magnitude — guarded).
- Vermin reads "pressure on cities" (no fabricated VP delta — there is no mid-game VP
  event); confidence `0.6`.

## Tests / verification

`tests/client/components/endgame/factInsights.spec.ts` (12 tests: each fact analyzer
fires; tiebreaker→hero; graceful no-facts fallback; selector cluster-dedup + rare
breakthrough; finalScore ranking; partial-confidence scaling). The existing
`insightEngine.spec.ts` + `endgameModel.spec.ts` + `EndgameOverviewTab.spec.ts` still
pass (the model extension + new UI are backward-compatible). Server build, `vue-tsc` (0),
`make:json` (no dupes — Predators/Vermin/Terraformer badges REUSE existing card/profile
translations), eslint on touched files all green.

## Non-breaking guarantees

Old games / missing facts → base insights (graceful). Solo mode still returns []. The
reveal facts carry counts only (no private leak). No runtime errors when `ctx.facts` is
absent. The existing overview bars / tabs / duel / podium are untouched.

---

# ═══════════════════════════════════════════════════════════════════
# ITERATION 6 — Deep Story Expansion («Как сложилась партия»)
# ═══════════════════════════════════════════════════════════════════

Goal: the second quality leap — from "first fact-based insights appeared" to "the
final screen genuinely notices the unique shape of THIS game". Additive on the
Iteration-5 foundation (no rewrite): more fact analyzers, deeper economy/action/global
reads, precise Vermin/Predators, a runner-up story, category structure, standard-project
strategy, unused potential, notable single moments, selector tuning + candidate debug.

## What was added

**1. Runner-up story** (`analyzeRunnerUpStory`, family `runnerUpStory`): the category the
runner-up out-scored the winner in vs. what the winner answered with ("X was stronger in
TR, but Y answered with cards — and that decided it") + "had the better economy but
couldn't convert it". Comparison/compact UI.

**2. Category structure** (`analyzeCategoryStructure`): TWO-PILLAR win ("built on two
pillars: cards +12 and awards +8" — suppresses the soft single-pillar line) vs. SECONDARY
strength ("not just TR: also a +6 edge in cards"). No category spam — only meaningful
structure.

**3. Standard-project strategy** (`analyzeStandardProjectStrategy`): a NEW server fact
`standardProject` (per player: project count + the parameter steps they drove — derived
from `category:'standard-project'` roots, NO invented data) → "infrastructure plan: N
standard projects, M parameter steps" / "Plan B when the card engine ran thin".

**4. Unused potential** (`analyzeUnusedPotential`): a big leftover M€ pile (`player.megacredits`)
— "money with nowhere to go" (loser) / "plenty of unspent runway" (winner) — joining the
existing never-activated-engine fact. Analytical, not toxic.

**5. Notable single moments** (`analyzeNotableMoments`): the biggest one-off beats from the
`notableEvent` facts — e.g. a late single-generation economy burst pinned to its gen.

**6. Vermin 2.0** — FALSE-POSITIVE FIX: reads the actual ANIMALS on Vermin (threaded via
`ctx.cardResources` from the view; absent → no claim). Played-but-empty Vermin yields NO
insight; ≥4 animals + a city-heavy opponent → a rare insight (stronger at ≥8, and when the
Vermin owner builds fewer cities themselves). Never a fabricated VP delta — only "pressure".

**7. Predators 2.0** — source-aware (the attacker owns Predators) + threshold-tuned: 6+
animals = rare/major raid, 3–5 = a normal hunt (picks the biggest such hit).

**8–10. Deeper economy / blue-action / global** reads layered in (economy underdog +
burst; most-used + unused engine; who-moved-the-planet) — all confidence-aware.

**11. UI** — new family accents (`runnerUpStory` / `cardStory` / `turningPoint` /
`boardStory`) on top of the Iteration-5 hero/primary/secondary/show-more hierarchy.

**12. Debug visibility** — `buildInsightCandidates(ctx)` returns EVERY candidate (base +
fact) with `finalScore`, sorted, BEFORE selection (the selected ones also carry
`rankSection`/`family`/`storyCluster`/`scores` on the rendered insight) — the data a dev
needs to tune thresholds + see why a candidate was/wasn't picked.

**13. Selector tuning** — PRIMARY now sorts by `finalScore` (strongest story first), with
the legacy `GROUP_ORDER` only as a stable tiebreak, so strong fact insights are no longer
buried behind legacy groups. Rare ≥0.6 still breaks the cluster dedup; the hero is the
single biggest beat.

## §17 — required report

- **Analyzers added (Iteration 6):** runner-up story, category structure, standard-project
  strategy, unused potential, notable moments (+ Vermin/Predators upgraded to 2.0,
  Predators threshold-tiered). 12 fact analyzers total now.
- **Facts used:** + the new `standardProject` fact + `ctx.cardResources` (Vermin animals);
  everything else reuses economy / actionUsage / engineTiming / negativeInteraction /
  globalParameter / reveal / colony / notableEvent.
- **UI variants/families:** runnerUpStory (comparison), cardStory, turningPoint, boardStory
  accents added; hero/major/normal/compact/legendary unchanged.
- **Rare scenarios improved:** Vermin (precise, no false positive), Predators (source-aware,
  tiered). Runner-up + two-pillar + standard-project + unused-money are new story angles.
- **Iteration-7 frontier:** richer per-family card CHIPS (attacker/victim split, savings/
  activation/leftover chips — the families/data are ready, the chip layout is the work); a
  dev candidate-scoring PANEL UI (the data is exposed via `buildInsightCandidates` + the
  rendered insights' `finalScore`); exact per-source Predators attribution + Vermin VP delta
  if the engine ever emits a scoring-time fact; broader phrasing variety.

## Honesty / confidence (unchanged discipline)

Standard-project = counts + parameter steps (no invented VP). Vermin = "pressure" (no fake
VP; confidence 0.6). Economy = "measured value"/units. `finalScore` scales by confidence so
a `partial` fact can't out-shout an `exact` one at equal magnitude (guarded).

## Tests / verification

`tests/client/components/endgame/factInsights.spec.ts` extended to 19 (runner-up, two-pillar,
standard-project, unused money, notable burst, Vermin with/without animals, Predators normal
tier, `buildInsightCandidates` debug). Existing `insightEngine`/`endgameModel`/`EndgameOverviewTab`
specs unchanged (25 + 3). Server build, `vue-tsc` (0), `make:json` (no dupes), eslint on
touched files all green.

## Non-breaking guarantees

All new analyzers are additive + thresholded; the 9 base template analyzers remain the
fallback. Old games / missing facts / missing cardResources → graceful (no Vermin false
positive, no errors). Solo → []. Deterministic. The reveal/SP facts carry counts only.
