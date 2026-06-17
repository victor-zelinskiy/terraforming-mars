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

- **Trade discount** (Cryo-Sleep / Rim Freighters `tradeDiscount`) — record the saved
  trade resources at the trade-fee chokepoint (`Colonies` traders). Trackable, same
  shape as the value-bonus handler. NOT done this pass.
- **Out-of-scope value modifiers** done generically server-side already (Lunar Steel
  [moon], Price Wars [underworld], Turmoil policies) — only the CLIENT empty-note set
  needs widening when those modules enter scope.
- `vp-granted` / `global-parameter-changed` recorder paths remain unimplemented (a
  pre-existing gap, documented in CLAUDE.md) — `stat.vp` stays empty for now.
