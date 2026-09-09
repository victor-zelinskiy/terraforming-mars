# Premium prompt parity — audit & plan

**The failure this audit covers** (field report, 2026-09-09): playing «Потоп»
(Flooding) raised its post-placement follow-up as a *generic* console list —
two-step select→confirm (the bar advertised **X** as the commit instead of the
one-press **A** every contextual decision uses), no source card, no trigger
line, a nested `SelectPlayer` wizard behind a `›` row. The surface was
technically console-native (`ConsoleTaskHost`, `choice/generic`), but it reads
as the legacy modal because it satisfies none of the premium contract below.

This doc is the third of the prompt-audit family:
[CHOICE_CONTEXT_AUDIT.md](CHOICE_CONTEXT_AUDIT.md) (the marker
infrastructure), [PROMPT_SOURCE_AUDIT.md](PROMPT_SOURCE_AUDIT.md) (who asked /
why now). This one covers the **prompt SHAPE**: which prompts still reach the
player outside the premium presentation, and the plan to converge every
in-scope prompt on one standard.

Scope: the fork's premium modules — `base`, `corpera`, `promo`, `venus`,
`colonies`, `prelude`, `ares`, `delta` + the shared `deferredActions` /
`inputs` / `Executor` / colony engine. Frontier modules (turmoil, moon,
pathfinders, underworld, community, …) adapt with their expansions
(`docs/claude/expansion-adaptation-checklist.md`).

---

## The premium prompt standard (what "done" means)

A prompt that reaches the player as a top-level `waitingFor` is premium when
ALL FOUR hold:

1. **Marked.** It carries a server marker — `choiceContext`
   (`markChoiceContext` + the builders in `src/server/inputs/choiceContext.ts`,
   or a `cause` param on a shared helper), or one of the sibling markers
   (`placementContext`, `discardPrompt`, `deckPickPrompt`, …). The marker is
   what routes the console off the generic path: an unmarked `OrOptions` is
   `{kind:'choice', flavor:'generic'}` — native, but the legacy-looking
   two-step list.
2. **Flat.** An `OrOptions` decision is LEAF `SelectOption`s — one per outcome
   / victim — never a nested `SelectPlayer`/`SelectPayment`/`SelectAmount`
   option (a nested input renders as a two-screen wizard, and
   `buildEffectDecision` refuses the whole prompt). The reference shape is
   `StealResources.buildOptions()` / `RemoveAnyPlants.buildOptions()`:
   per-victim options with `optionMetadata` (`current → resulting` of the
   TARGET), the deliberate `skip()`, unavailable targets via
   `setDisabledOptions` with a reason, `markChoiceContext({mode:'attack'})`.
3. **One-press.** With the marker + all-leaf branches the console serves it on
   the premium decision screen (`ConsoleEffectDecision`: eyebrow, headline
   question, source dock, trigger, plates, A commits — risky options arm
   first) or, for shapes that screen refuses (a nested pick that is
   legitimate), on the CONTEXTUAL task host (source dock + one-press A). The
   two-step select→confirm contract remains only on deliberately-two-step
   kinds (`player`, `resource`, generic lists) — which the plan empties.
4. **Attributed.** The source dock names the card/colony/rule that asked, and
   `L3 Источник` opens it (PROMPT_SOURCE_AUDIT's contract).

## The reference fix — Flooding (DONE, 2026-09-09)

`src/server/cards/base/Flooding.ts` rebuilt its post-placement follow-up from
`OrOptions(SelectPlayer, skip)` to the standard attack shape:

- one flat `SelectOption` per adjacent owner **with M€**, title
  `Remove ${qty} M€ from ${player}` where `qty = min(4, attackableStock)` —
  honest for a target holding less, and MarsBot reads through its M€-supply
  proxy (`AutomaTargeting.attackableStock`);
- `removeResourceFromPlayer(...)` metadata → the victim plate shows the colour
  chip + `current → resulting`;
- broke adjacent owners become `disabledPlayerTarget(…, 'No M€ to remove')` —
  greyed with a reason, never hidden;
- nobody adjacent holds M€ → **no prompt** (the `RemoveAnyPlants` silent-no-op
  precedent), and the placement dossier says so BEFORE the tile goes down
  (`Adjacent opponents have no M€` via `placementPreview`, which now filters
  the same candidate set the follow-up offers — preview ↔ commit honesty);
- `markChoiceContext(attackEffect(this, 'An ocean tile was placed next to an
  opponent's tile.'))` → the console serves it on `ConsoleEffectDecision`,
  one-press A, source dock = the Flooding card.

Plus the screen-side copy fix the whole attack family needed:
`effectDecisionModel.headlineKeyOf` now takes the marker's `mode` — an attack
asks **«Атаковать соперника?»** (decline «Не атаковать»), a mandatory attack
(no decline) asks **«Выберите цель»**. Before this, the shape-derived headline
read an attack's cost chips (the VICTIM's loss) as the viewer paying and asked
«Заплатить?».

Guards: `tests/cards/base/Flooding.spec.ts` (shape, marker, honest amounts,
disabled row, silent no-op), `effectDecisionModel.spec.ts` (attack headlines).

---

## Audit — what still violates the standard (2026-09-09)

### A. Attack prompts arriving unmarked (same class as Flooding) — ✅ DONE (wave 1, 2026-09-09)

| # | Where | What | Fix shipped |
| --- | --- | --- | --- |
| A1 | `cards/colonies/AirRaid.ts:67` | the mandatory 5 M€ steal was deferred **without `cause`** — while line 68's `RemoveResourcesFromCard` of the SAME play passed `cardSource(this)` | ✅ the 6th arg: `new StealResources(player, MEGACREDITS, 5, undefined, true, cardSource(this))`; guard in `AirRaid.spec.ts` |
| A2 | `colonies/Colony.ts:651` | `ColonyBenefit.STEAL_RESOURCES` built `StealResources` without `cause`; every neighbouring branch in the file passes `colonySource(this.name)` | ✅ passes `colonySource(this.name)` |
| A3 | `cards/venusNext/CometForVenus.ts` | `OrOptions(SelectPlayer, skip)` — the Flooding twin (normally pre-collected in the play composer; arrives raw on a batch divergence) | ✅ the Flooding rework: flat victims (honest `min(4, attackableStock)`), broke/untagged targets greyed with reasons (`No M€ to remove` / `No Venus tag`), all-broke → silent no-op with the preview's skipped chip, `attackEffect(this)`; spec rewritten |
| A4 | `AsteroidMiningConsortium` · `EnergyTapping` · `GreatEscarpmentConsortium` · `Hackers` · `PowerSupplyConsortium` | five bespoke `DecreaseAnyProduction` calls without `cause` — the declarative twin (`Executor.ts:589`) passes `cardSource(card)` | ✅ all five pass `cause: cardSource(this)`; representative guard in `Hackers.spec.ts` |

### B. Shared helpers with no cause/marker plumbing — B1–B4 ✅ DONE (wave 2, 2026-09-09)

| # | Where | What | State |
| --- | --- | --- | --- |
| B1 | `deferredActions/IncreaseColonyTrack.ts` | asked before EVERY trade on a colony with a track offset; had no marker at all | ✅ marked unconditionally (`colonySource(this.colony.name)`, mode `reward`, trigger = the title message — the decision screen drops server titles); the decline got `skip()`. ⚠️ Option ORDER untouched — `colonyTradePlan.trackChoiceResponse` replays a captured INDEX |
| B2 | `deferredActions/SelectResourceTypeDeferred.ts` | no `cause`; in-scope caller `MiningCard` (Mining Area / Mining Rights steel-or-titanium after the placement) | ✅ takes `cause` (mode `effect-choice`); MiningCard passes `cardSource(this)` |
| B3 | `deferredActions/SelectPaymentDeferred.ts` | `cause` existed and the card call sites didn't pass it — every deferred payment rendered with no source dock. (Correction to the first audit pass: `Executor.ts:363` DID already pass it.) | ✅ threaded at 21 sites: base `AquiferPumping` / `SearchForLife` / `WaterImportFromEuropa`; corp `UNMI`; venus `RotatorImpacts` / `ForcedPrecipitation`; promo `AsteroidRights` / `DirectedImpactors` / `EnergyMarket` / `EstablishedMethods` / `Factorum` / `IcyImpactors` / `Merger` / `StJoseph ×2` / `StrategicBasePlanning`; prelude `RobinsonIndustries` + the four `-startingMegaCredits` debt preludes; campaign `CampaignMissionSetup` (`namedCardSource(MERGER)`). **`AresHandler.ts:377` deliberately left** — its honest source is the Ares rule, not a card: decided together with B5 in wave 3 |
| B4 | `deferredActions/SelectCardDeferred.ts` | no `cause`/marker; also auto-resolves a single candidate — triaged in `DELAYED_TARGET_AUDIT.md` | ✅ takes `cause` (mode `reward`); `ares/BioengineeringEnclosure` passes `cardSource(this)` |
| B5 | `ares/AresHandler.ts:99` | the Ares adjacency animal/microbe bonus `SelectCard` — unmarked, and auto-applies on a single candidate (`:95-98`) | wave 3: mark (`systemChoice('system', …)` or the hazard-style source) + decide the payment source at `AresHandler.ts:377`; triage the auto-apply |
| B6 | `cards/base/RoboticWorkforce.ts:35` + `cards/promo/CyberiaSystems.ts:75,79` | deferred «select builder card to copy» pickers, unmarked | wave 3: `markChoiceContext(cardEffect(this, …, 'reward'))` |
| B7 | `cards/colonies/MarketManipulation.ts:87,95` | two `SelectColony`s back-to-back, no context | wave 3: `cardEffect(this, …)` on both |
| B8 | `cards/colonies/MinorityRefuge.ts:81` | `BuildColony` without the opt-in `placementContext` | wave 3 (low severity — colony is a native section kind) |

Wave 1+2 guards: `tests/deferredActions/promptCause.spec.ts` gained rows for
`IncreaseColonyTrack` (marker + the skip + the pinned option order),
`SelectResourceTypeDeferred`, `SelectCardDeferred` and `SelectPaymentDeferred`;
`CometForVenus.spec.ts` mirrors `Flooding.spec.ts`; `AirRaid.spec.ts` /
`Hackers.spec.ts` assert the marker on the live prompt.

### C. Nested-input wizard shapes still in the tree

Normally rendered premium INSIDE the action/play composer (the branch pick is
pre-collected), so the raw two-screen wizard surfaces only on a batch
divergence / reconnect. Cheap hardening: mark the `OrOptions` with
`effectChoice(this)` so even the raw fallback is contextual (source dock +
one-press); flatten only where the nested input is a fixed-price
`SelectPayment` (the St. Joseph rule — CHOICE_CONTEXT_AUDIT § "A PAID branch
is a LEAF option").

- `action()` shapes: `ExtremeColdFungus.ts:86` (SelectCard),
  `BioPrintingFacility.ts:106`, `AsteroidRights.ts:145`, `Astrodrill.ts:174` +
  its `standardResourceOptions` `:129`, `CometAiming.ts:166`,
  `SelfReplicatingRobots.ts:110` (×2 SelectCard),
  `SulphurEatingBacteria.ts:92` (SelectAmount), `TitanShuttles.ts:84`
  (SelectAmount).
- `cards/promo/NeptunianPowerConsultants.ts:61` — marked, but nests a
  `SelectPayment` for a FIXED 5 M€: flatten to a leaf + `SelectPaymentDeferred`
  (its own family already did — `StJosephOfCupertinoMission.ts:179-203`).
- Marked-but-nested (shape OK, refused by the decision screen by design, the
  contextual task host serves them): `MarsUniversity.ts:53`, `Virus.ts:86`,
  `RemoveResourcesFromCard.ts:107,127`.

### D. Out of scope (adapt with their expansions — recorded so they are not re-found)

`CorrosiveRainDeferredAction.ts:22` (turmoil global event, no marker),
`RemoveOceanTile.ts:21` (bare `SelectSpace` — bypasses `createMarsSelectSpace`,
so no `placementContext`/`illegalSpaces`; callers turmoil-only),
`inputs/GainResources.ts` (unmarked `AndOptions` — the in-scope Venus consumer
supplies its own `markVenusBonusPrompt`; turmoil/pathfinders consumers do not),
`GainAnyResourceButScienceDeferred` nested shape (underworld-only caller),
`Executor.ts:396` `spend.resourceFromAnyCard` without `cause` (latent — no
in-scope card uses it; one-token fix when one does).

### Fixed since the last audit (recorded)

`PlaceHazardTile` now routes through `createMarsSelectSpace` and always
carries a committed `placementContext` (PROMPT_SOURCE_AUDIT «WHAT REMAINS»
row #3 is closed).

### The console router red list (unchanged)

`composite` (an unmarked `AndOptions` — the honest carve-out) and `unknown`
(frontier input kinds) — pinned in `consoleTaskRouter.spec.ts`. Nothing in
scope lands there; the generic `choice` flavor is the actual gap this plan
empties.

---

## The plan — waves, each independently shippable

**Wave 1 — the attack family completes (highest player exposure).** ✅ DONE
2026-09-09 — see the A table above for what shipped.

**Wave 2 — shared helpers gain `cause` (B1–B4).** ✅ DONE 2026-09-09 — see the
B table above. `AresHandler.ts:377` rides wave 3's source decision.

**Wave 3 — the deferred pickers name themselves (B5–B8).**
B5 needs a decision first (what IS the source of an Ares adjacency bonus —
the hazard rule vs the adjacent tile's card), same as the old hazard row;
B6/B7 are `markChoiceContext(cardEffect(this, …))`; B4/B5 auto-resolve triage
lands in `DELAYED_TARGET_AUDIT.md`.

**Wave 4 — wizard hardening (C).**
Mark every `action()` OrOptions with `effectChoice(this)` (co-located, one
line per card; the composer path is unaffected — it never reads the marker);
flatten Neptunian Power Consultants per the St. Joseph rule. This makes the
divergence/reconnect fallback contextual everywhere.

**Wave 5 — the guard that keeps it true.**
Extend `tests/models/choiceContext.spec.ts` (or a new corpus spec) into the
worklist guard the project style demands: enumerate the in-scope deferred /
triggered prompt producers and FAIL with the list of unmarked ones — so a new
card cannot add an anonymous prompt without the suite naming it. Without this
wave the audit rots the way CHOICE_CONTEXT_AUDIT's «Already premium» section
did (it described desktop surfaces that have since been deleted).

**Explicitly NOT in the plan:** frontier items (§D) — they ride the
expansion-adaptation checklist; the `composite`/`unknown` red list (documented
carve-outs); the deliberately-two-step `player`/`resource` task-host kinds
(they empty as their producers migrate to marked flat shapes).
