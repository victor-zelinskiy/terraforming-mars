# Action prompt audit — leftover prompts the pre-collect contract missed

**Triggered by:** Factorum's corporation action showing a generic «◈ ПОДТВЕРЖДЕНИЕ / Потратьте 3 M€, чтобы добрать карту строительства» band in the console-native shell, *after* the action workspace had already taken the confirmation.

**Status:** the in-scope classes below are FIXED and guarded by
`tests/models/actionPromptCoverage.spec.ts` (classes 1–5 and 7) and
`tests/inputs/deferredInputBatch.spec.ts` (class 6). The Turmoil AVAILABILITY class (§4,
CLASS 4) is open and recorded.

---

## 1. The contract that was broken

The premium/console action flow is a **pre-collect** design:

1. The client fetches an `ActionPreview` for the card (`src/server/models/actionPreview.ts`).
2. The composer shows every branch, cost and choice and takes ONE confirmation.
3. It sends ONE batch of responses built purely from that preview
   (`buildActionBatch` in `src/client/console/consoleActionComposer.ts`, and the
   desktop twin `PlayerHome.submitCardActionBatch`).

So **the preview is a promise about the shape of the live prompt sequence.** The batch is
byte-correct only while that promise holds. When it does not, the leftover prompt does not
fail loudly — the server simply still has a `waitingFor`, the console classifies it with
`taskFor()` and renders whatever generic surface fits. For a bare `SelectOption` that is
`{kind: 'choice', flavor: 'confirm'}` → the generic confirmation band in the screenshot.

The key clause is `ActionPreviewBranch.index`:

| preview says | the batch sends | the card's `action()` must therefore |
| --- | --- | --- |
| `index >= 0` | `{type:'or', index, response}` | return an `OrOptions` with exactly that many options |
| `index === -1`, `optionInput` set | the bare input response | return that input directly |
| `index === -1`, no `optionInput` | **nothing** | leave **no prompt at all** |

`actionPreviews.orBranches(...)` assigns `-1` to every branch when exactly one is available
(`autoResolveSingle`, on by default), documented as: *"Most bespoke `or` actions auto-resolve
a lone executable option (`if (opts.length === 1) return opts[0].cb()`)"*.

## 2. Root cause of the reported bug

`promo/Factorum` did **not** auto-resolve. It returned the lone `SelectOption` object:

```ts
if (player.energy > 0) {
  return drawBuildingCard;   // ← a SelectOption, i.e. a live prompt
}
```

So the preview said "no branch pick, submit nothing" while the server stood there holding a
forced confirmation of the only thing that could happen. Since `player.energy > 0` is the
normal case, this fired on nearly every Factorum action.

**Fix** — the sibling idiom already used by `colonies/TitanAirScrapping`:

```ts
if (options.length === 1) {
  return options[0].cb(undefined);
}
return new OrOptions(...options);
```

## 3. Why it was missed

- **No guard covered it.** `tests/models/actionPreviewCoverage.spec.ts` checks that every
  in-scope action card produces a *valid, non-mute, non-bare-dial* preview. Nothing compared
  the preview's declared submit shape with what the live `action()` actually asks for. The
  per-card protocol tests in `tests/models/actionPreview.spec.ts` covered the two shapes that
  *were* thought through — `index >= 0` (RegolithEaters/TitanAirScrapping) and
  `index === -1 + optionInput` (AsteroidRights' bare `SelectCard`) — but not the third:
  `index === -1` with a leftover **leaf**.
- **The console has no safety net for it, by design.** `consoleWorkspaceOutcome.ts` claims
  only `deck-check` / `draw` / `pick`. A leftover confirm is none of those, so it escapes the
  action workspace and opens standalone — which is exactly the "legacy-looking" band.
- **An earlier fix attempt aimed at the wrong half.** `reconcileBatchResponse`
  (`src/server/routes/PlayerInputBatch.ts`, with `tests/routes/PlayerInputBatch.spec.ts`)
  was written *for this exact card* — it unwraps a `{type:'or', index}` into `{type:'option'}`
  when the live input turns out not to be an `OrOptions`. But it can only reshape a branch
  response the batch **already contains**, and `autoResolveSingle` means the composer sends
  **none**: with one branch available every `index` is `-1`, so there was nothing to unwrap
  and the bare `SelectOption` stayed on screen. The mitigation was verified against a
  hand-written `{or, index:1}`, never against the batch the composer actually derives from
  the preview — which is precisely the gap the new guard closes. Reconcile is kept as defence
  in depth for the case it genuinely covers.
- **The declarative half was a written-down TODO.** `stepsForBehavior` says verbatim:
  *"Payment (`spend.megacredits`), colony build, and the less-common pickers are added as
  their card groups are migrated — until then they produce no step and the leftover prompt
  rides the graceful fallback."* On the desktop that fallback was a legacy modal and was
  tolerable; in console-native it is the defect being reported.

## 4. What else was leaking (in premium scope: base, corpera, promo, venus, colonies, prelude, ares)

Enumerated mechanically — build the preview read-only, then run the real `action()` on a
fresh game and compare. 102 in-scope action cards, three game profiles.

### CLASS 1 — leftover bare confirm
| card | shape |
| --- | --- |
| `promo/Factorum` | returned the lone `SelectOption` instead of resolving it |

Only one in scope. Out of scope, structurally identical: `community/ProjectWorkshop`,
`pathfinders/RobinHaulings`, `pathfinders/MindSetMars` (the last two return
`options.options[0]` without `.cb()`).

### CLASS 2 — preview / `action()` branch-set divergence
| card | state | symptom |
| --- | --- | --- |
| `promo/DirectedImpactors` | temperature MAXED, has an asteroid, can afford 6 M€ | preview offered 2 branches, live `OrOptions` had 1 → `{or,index:0}` ran **add** where the preview showed **remove**, `{or,index:1}` was rejected as an invalid index |
| `promo/DirectedImpactors` | Reds tax unaffordable, can afford 6 M€ | preview auto-resolved, live returned a 1-option `OrOptions` (the Factorum symptom) |

This is the worst of the set: not a redundant screen but the **wrong branch executing**.
The two readings were written out twice and drifted; they now share one private predicate
(`removeIsOffered`).

### CLASS 3 — leftover payment prompt
`SelectPaymentDeferred` prompts whenever the player can pay with anything other than plain
M€. Crucially `mustPayWithMegacredits()` also returns false for **heat-as-M€ (Helion,
Stormcraft)** and **titanium-as-M€ (Luna Trade Federation)** — properties of the PLAYER, not
of the card. So every M€ action cost is a payment prompt for those players, while only the
four cards that opted into steel/titanium (`WaterImportFromEuropa`, `AquiferPumping`,
`StJosephOfCupertinoMission`, `RotatorImpacts`) ever declared a `paymentStep`.

Declarative (`action: {spend: {megacredits: N}}`) — fixed centrally in
`models/actionPreview.ts`, which now emits the payment as the FIRST STEP of every available
branch and drops the now-duplicated flat M€ cost chip:

`base/SpaceMirrors` · `base/UndergroundDetonations` · `base/IndustrialCenter` (+ `:ares`) ·
`base/RestrictedArea` (+ `:ares`) · `venusNext/FloatingHabs`

> A branch step, not a `preStep`, even though `Executor` defers the payment before the rest
> of the behavior and `spend.heat` next to it *is* a preStep. The desktop confirm modal
> (`CardActionConfirmContent.vue`, frozen) renders only `spendHeat` inside its preSteps
> block while still counting every preStep as a required capture — a payment preStep would
> have shown nothing there and left its confirm button permanently disabled. As a branch
> step it lands in the same slot the six bespoke cards already use (`SelectPaymentV2` on
> desktop, the persistent payment panel in console), and the batch order is unchanged:
> with `branchIndex === -1` nothing sits between the activate pick and the step responses.

Bespoke — one `actionPreviews.paymentStep(...)` each, with options matching the live
deferred byte for byte:

`base/SearchForLife` · `promo/Factorum` · `promo/DirectedImpactors` · `promo/IcyImpactors` ·
`venusNext/ForcedPrecipitation` · `prelude/RobinsonIndustries`

### CLASS 4 — OPEN: Turmoil / the Reds tax
Adding a "Reds in power, nothing that can pay the tax" profile to the guard reports **~40
in-scope cards** whose preview reads the Reds TR tax (via `subAvailability` →
`collectActionBehaviorReasons`) while their live availability gate does not — several of
which then throw `Player does not have 3 M€`. `venusNext/JetStreamMicroscrappers` is the
clearest hand-checked case: the hook gates its spend branch on
`player.canAfford({cost: 0, tr: {venus: 1}})`, `action()` does not.

Not fixed here: Turmoil is outside the premium subsystem scope, and a 40-entry exemption list
would have buried the in-scope findings. The exact profile to re-enable is written out in the
guard's `PROFILES` array.

### ~~Adjacent, not fixed~~ → became CLASS 7 and shipped as a live bug
`promo/DirectedImpactors`' asteroid TARGET (`SelectCard`) was left an undeclared follow-up
with this note claiming it lands "inside the console's own card-pick surface". It does not:
the branch declares no `+N cards` gain and no `reveal`, so `branchOutcomeClaimPlan` derives
NO claim kinds, the workspace claims nothing, and the pick arrived as a standalone
«ЦЕЛЬ НА КАРТЕ» band right after the workspace confirm — reported by a player as «повторный
промт» (2026-09-11). Recorded below as CLASS 7 and closed.

### CLASS 5 — the BRANCH's own follow-up (added 2026-08-28)

**Triggered by:** Astrodrill's «получите любой стандартный ресурс» opening a standalone band
right after the workspace had taken the confirmation.

The three checks above measure the SHAPE of the branch list and one specific leftover (a
payment). None of them asks the question the player actually feels: *«I picked this branch and
confirmed — is the server done asking?»* That is a third, independent way to leak, and it is
the one this class records: a `SelectOption` branch whose `andThen` returns a **nested
`OrOptions`** the preview declared nothing about.

The full in-scope sweep (`SCOPE` = base, corpera, promo, venus, colonies, prelude, ares,
deltaProject × three profiles; every AVAILABLE branch whose runtime option is a
`SelectOption`) found exactly **three**:

| card | branch | live leftover | fix |
| --- | --- | --- | --- |
| `promo/Astrodrill` | «Gain a standard resource» | `or(6)` — which standard resource | PRE-COLLECTED: `orOptionsStep` over a side-effect-free builder shared with `action()`, every option carrying `gainStock` metadata (icon + this player's `current → resulting`) |
| `promo/CometAiming` | «Remove an asteroid resource to place an ocean» | `SelectSpace` | DECLARED: `boardPlacementStep('ocean', {tileType: OCEAN})` |
| `promo/IcyImpactors` | «Spend 1 asteroid here to place an ocean» | `SelectSpace` | DECLARED: `boardPlacementStep('ocean', {tileType: OCEAN})` |

A follow-up that CANNOT be pre-collected is not a leak — it is a **declaration**. The two
ocean branches were never going to host a board pick inside the workspace, but saying nothing
about it is not the same as saying "the board comes next": an undeclared follow-up reads to
the whole flow as «nothing happens next», so the confirm never named it and
`commitKindForBranch` could not route the commit beat to the `tile` category.

**Two client halves came with it, both general** (the server fix alone would have rendered
six bare words):
- `ConsoleActionComposer`'s `or` sub-list mapped options to bare titles
  (`resIcon: '', impact: ''`) while the PLAY composer already stood on the shared premium
  builder `consoleOrChoice.buildOrItems` — whose own header claimed both composers used it.
  Astrodrill is the FIRST in-scope ACTION card with an `or` step (the other five
  `orOptionsStep` users are all `bespokePlay` cards), which is why the stub was never
  exercised. Both composers now render the same `ActionEffectChip` rows.
- `extractPlayRewards` / `commitKindForBranch` could not see an or-step's answer, so the
  chosen resource had no reward spec and no category: the rail counters ticked with nothing
  flying to them. Both now read the CHOSEN option's server-built `OptionMetadata.effects` —
  the same authoritative vocabulary as a branch chip, never a re-derivation from the title.

Guarded by check 4 (`LEFTOVER_FOLLOWUP_WORKLIST`, empty) and at the real surface by
`tests/e2e/console-action-resource-pick.spec.ts`.

### CLASS 6 — a prompt that JUMPS AHEAD of the pre-collected one (added 2026-08-28)

**Triggered by:** Astra Mechanica. Its «верните до 2 разыгранных событий в руку» is chosen
INSIDE the play composer, on the real cards, and after the play the very same question arrived
again as a standalone «◈ ЦЕЛЬ НА КАРТЕ» band — the one thing a pre-select must never do.

Classes 1–5 all ask *"does the preview describe the right prompts?"*. This one is different:
**the preview was right, and the prompts arrived in a different ORDER.**

`Player.playCardImpl` defers the played card's own on-play input at `Priority.DEFAULT` — which
is the 17th rung of a 22-rung ladder. Everything the SAME play sets off that sits earlier
prompts FIRST, and the positional batch replay then met a question it had no answer for,
stopped, and **discarded every remaining pre-collected response**.

#### The interlopers — every prompt that can outrank a card's own on-play input

| priority | source | the prompt | reachable by |
| --- | --- | --- | --- |
| `COST` (1) | `Player.increaseTerraformRating` under Reds | `SelectPaymentDeferred` «Select how to pay for TR increase» | ANY card that raises TR / a global parameter, whenever the player can pay with something other than plain M€ (Helion, Luna, steel/titanium) — see CLASS 3, same rule |
| `BEFORE_PHARMACY_UNION` (2) | `ceos/Faraday.onCardPlayed` | `or` «Pay 3 M€ to draw a &lt;tag&gt; card / Do nothing» | ANY tag, on every 5-tag threshold |
| `PHARMACY_UNION` (3) / `SUPERPOWER` (-1) | `promo/PharmacyUnion.onCardPlayed` | `or` «Turn it face down for 3 TR / …» | a SCIENCE (or microbe+science) tag |
| `HYPERSPACE_DRIVE_PROTOTYPE` (5) | `underworld/HyperspaceDrivePrototype` | `AddResourcesToCard(SCIENCE)` target pick | a SCIENCE tag, with 2+ science-resource cards |
| `OLYMPUS_CONFERENCE` (6) | `base/OlympusConference.onCardPlayed` | `or` «add a science resource / remove one to draw» | a SCIENCE tag, once the card holds a resource |
| `DRAW_CARDS` (8) | `DrawCards` / `ChooseCards` | a keep-some pick | a trigger that draws with a choice |
| `IDENTIFY` / `EXCAVATE` (14/15) | `underworld/*SpacesDeferred` | board-space picks | an underworld trigger on the play |

`OPPONENT_TRIGGER` (4) is NOT on this list: those prompts go to the card's OWNER, i.e. another
player's `waitingFor`, and cannot displace the active player's.

#### The victims — measured, not guessed

Building `cardPlayPreview` for every in-scope project card (base, corpera, promo, venus,
colonies, prelude, ares, deltaProject) and counting pre-collected `input` steps gives **21
cards**. Of those, **12 are reachable by an interloper today**:

| card | what it pre-collects | interloper |
| --- | --- | --- |
| `promo/AstraMechanica` | the up-to-2 event return (`mergeCardSteps`) | SCIENCE tag → Olympus / Pharmacy Union / Hyperspace Drive |
| `base/Asteroid` · `base/BigAsteroid` · `base/Comet` · `base/DeimosDown` (+`:promo`, +`:ares`) · `base/GiantIceAsteroid` · `base/MiningExpedition` · `promo/SmallAsteroid` · `ares/MetallicAsteroid` | the plant-attack target (`removeAnyPlants`) | raises a global parameter → the Reds tax at `COST` |
| `colonies/JovianLanterns` | the floater target | raises TR → the Reds tax at `COST` |

The remaining nine (`Insulation`, `Hackers`, `Virus`, `CyberiaSystems`, `PublicPlans`,
`Atmoscoop`, `AtmoCollectors`, `ImpactorSwarm`, `TitanFloatingLaunchpad`) neither carry a
science tag nor raise a parameter, so nothing currently outranks them — which is a property of
today's card set, not a guarantee.

The same exposure applies to every OTHER batch producer, because they all post to the same
route: the blue-action composer, the standard-projects workspace, the colony trade composer,
the Hydronetwork commit and the ProjectInspection repeat tail.

#### The fix — the answer WAITS for its prompt instead of being thrown away

`src/server/inputs/deferredInputBatch.ts` (the replay moved out of the route, which now only
parses and serializes):

- a response refused because the live input is a DIFFERENT KIND of question is a queue jump:
  the rest of the batch is **PARKED**, not dropped;
- `drainBatchTail` runs after every single-input response (`routes/PlayerInput.ts`), so the
  moment the interloper is answered the pre-collected answer lands by itself — no second
  prompt, no re-decision;
- a response the MATCHING prompt itself refuses is a genuine divergence (the state moved since
  the preview): the tail is dropped and the player answers for real;
- `Player.takeAction` clears the park once the deferred queue has drained, so an answer can
  never survive into the action after the one it was collected for.

Nothing about rules ORDER changed: Olympus still resolves before Astra Mechanica's return, the
Reds tax is still paid before the plant attack. Only the player's already-made decision stops
being lost in between.

Guarded by `tests/inputs/deferredInputBatch.spec.ts` (Astra Mechanica × Olympus, Astra
Mechanica × Pharmacy Union, `Asteroid` × the Reds tax, plus the divergence / expiry / first-
response-throws cases).

#### Residual hazard, recorded — an interloper of the SAME input type

The batch carries no prompt IDENTITY, only responses, so «is this my prompt?» is answered by
input TYPE. That is exact for every combination in the table above (a `card` answer meeting an
`or`, an `or` answer meeting a `payment`), but it cannot tell an interloping `OrOptions` from
the card's own: a pre-collected `{type:'or', index}` would be ACCEPTED by Olympus Conference's
own `or` and run the wrong branch — the CLASS 2 failure mode, arriving by a different road.

Not reachable in the current card set: the eleven cards that pre-collect an `or` are all
plant-attacks reached only by the Reds tax (a `payment`), and the one science-tagged victim
(Astra Mechanica) pre-collects a `card`. If it ever becomes reachable the honest instrument is
to make the batch state what each response was collected FOR (the step's declared shape), not
to guess harder from the response alone.

### CLASS 7 — the chain OUTRUNS the declared steps (added 2026-09-11)

**Triggered by:** «Обстрел астероидами» (DirectedImpactors). After the workspace took the
confirmation (payment pre-collected), the asteroid-target `SelectCard` arrived as a standalone
«ЦЕЛЬ НА КАРТЕ» band — the player's «повторный промт». The card's own comment said the target
"still rides the follow-up routing"; nothing enforced that it may not.

Checks 3–4 each see one SLICE of a branch's follow-ups and each had a structural blind spot:

- check 4 **skips any branch with `steps.length > 0`** — declaring the payment made the
  undeclared card target invisible;
- check 4 walks **`SelectOption` branches only** and stops at the **first** leftover;
- check 3 probes **`SelectOption` branches only** — a payment deferred inside an
  `optionInput`'s `andThen` (AsteroidRights) was never seen.

The general statement is: **the live follow-up CHAIN of every available branch must be fully
covered by its declared steps** — each prompt consumed by the matching hosted step in order,
and whatever remains covered by a NAMED hand-off (`boardPlacement` / `colonyTrade` /
`deltaAdvance` / non-warning `note`) or by the workspace's own draw/deck-check claim
(`branchOutcomeClaimPlan` reads a `+N cards` gain chip / the `reveal` descriptor — Inventors'
Guild's buy prompt is the reference embedded flow, not a leak).

The full sweep found exactly **three**, one per follow-up kind:

| card | branch | undeclared leftover | fix |
| --- | --- | --- | --- |
| `promo/DirectedImpactors` | «Pay 6 M€ to add 1 asteroid to a card» | the target `SelectCard` after the declared payment | PRE-COLLECTED: `addToCardStep` from ONE shared options object (`asteroidTargetOptions`), live path now defers the SAME `AddResourcesToCard` (`autoSelect: false`, `cause`) — order `[payment, target]` on both sides |
| `promo/AsteroidRights` | «Add 1 asteroid to this card» | the 1 M€ `SelectPaymentDeferred` after the target `optionInput` | PRE-COLLECTED: `paymentStep` from the shared `asteroidPaymentOptions()`; the flat M€ chip drops when the step is present (CLASS 3 doctrine) |
| `promo/EnergyMarket` | «Spend 2X M€ to gain X energy» | the 2X payment after the amount dial | DECLARED: the bill's amount exists only once the dial is set, so it CANNOT be pre-collected — a `noteStep('generic', 'After confirming, choose how to pay.')`, emitted only when the payment would actually prompt (`paymentStep(player, 2) !== undefined`) |

### CLASS 8 — the answer did not say what it was collected FOR (added 2026-10-11, closed)

**Triggered by:** the owner's report — «Sponsored Academies: the card to discard is picked in the
composer, and then the discard comes as a SEPARATE prompt, although it was pre-selected; such
examples are frequent on other cards too». Reproduced as a unit (a4e6177ace): the batch
`[play, {card: Ants}]` left the `DiscardCards` prompt standing, Ants in hand, the answer parked.

**Root.** `186ddae340` (2026-09-28, the Redux Venus colony bonus «draw 1, then discard 1» in front
of a trade's reward target) widened `hiddenInfoPrompt` from the deck pick to EVERY `SelectCard`
carrying `discardPrompt`: `replayBatch` parked the tail untried and `drainBatchTail` broke on the
same test — a PRE-COLLECTED discard could never land. Not an upstream merge (the syncs touched
only `clearWarnings` in this file): a fork polish of one case, written as a rule of the prompt's
KIND, that broke the whole family. It joined a ladder of such rungs — `stagedFor` for three response
types, hidden-info for the deck pick and then for discards, `jumpedTheQueue` by type — each a guess
at «is this my question?» from the response's type or the prompt's kind. CLASS 6's «residual
hazard» was the same defect seen from the other side.

**Why nothing caught it.** `deferredInputBatch.spec.ts` had no discard case; `cardPlayPreviewCoverage`
/ `consolePlayPreviewCoverage` check the steps' SHAPE; `actionPromptCoverage` check 5 replays
ACTIONS only; e2e had no Sponsored Academies spec; and the stranded-prompt witness (`armLeakWitness`)
sees only a prompt nobody serves — a re-asked discard IS served (the hand screen in discard mode).

**The law (`src/common/inputs/preselectAddress.ts`).** A pre-collected answer carries `for: {source,
role}`; a prompt's address is read by ONE function (`promptAddressOf`) over the markers the console
already routes by — `choiceContext` → `placementContext` → `discardPrompt` → `deckPickPrompt`; a
placement by its `sourceCard`; a party question only as a grant / support pick. Roles are the input
type, `discard` for a marked discard, `deckPick` for a deck pick. `addressVerdict`:

| verdict | when | the replay |
| --- | --- | --- |
| `own` | the prompt names the answer's asker, same kind | process; a refusal = honest divergence → the tail drops, the question is asked for real |
| `foreign` | another asker, or another kind | parked UNTRIED — never offered to the wrong question |
| `anonymous` | same kind, the prompt names no asker | the positional rules (try; another TYPE parks, the same type drops) |
| unaddressed | an answer with no `for` (a client before the law) | the positional rules, byte-identical |

The two wire reshapes of `reconcileBatchResponse` (an OR-wrapped branch pick vs its card's collapsed
bare input; a bare answer vs a one-option OrOptions) are kinds that match; a placement-shaped role
(space / party / colony / deck pick) needs a NAMED asker — its anonymous prompts are by construction
somebody else's. The staged cell / resolution / colony (`stagedFor`) is the SAME address in its older
spelling (`answerAddressOf`): `stagedMismatch` / `stagedAddress` are deleted — one law. `hiddenInfoPrompt`
is the deck pick only again. `expireSupersededStagedTail` expires any answer whose address names the
standing prompt as its own. The address belongs to the batch and is stripped before `process`.

**Stamped once per family.** Server: `models/preselectAddresses.ts` — the exit pass of `cardPlayPreview`,
`actionPreview`, `corpFirstActionPreview` stamps every input step, pre-step, tabbed step and branch slot
(the step model's role; its own source, else the card's); a step the model cannot describe says so
(`selectCardStep({for})` — Sponsored Academies' `discard`); the trade preview's card target carries the
live action's own cause. Client: ONE function `addressed(response, address)` in `orderedStepResponses` /
`orderedPreResponses`, the branch slot of `buildPlayCardBatch` / `buildActionBatch` (`branchFor`, threaded
through both composers' payloads and `RepeatComposed`), and the trade's `stepResponse`.

**The residual hazard, stated.** An UNMARKED interloper of the same kind (a bespoke prompt with no
`choiceContext`) still meets an answer positionally (`anonymous`). The guard below names the in-scope
plays where it matters; a new one is fixed by marking the interloper, never by a rung.

**Guards.**
- `tests/models/cardPlayReplayCoverage.spec.ts` — the PLAY twin of check 5: every in-scope project card
  whose preview pre-collects anything, three states (clean · Olympus Conference with a resource + Pharmacy
  Union · the Reds' tax under Helion), the batch built by the composer's own pure builders (addresses and
  all), `replayBatch` on a fresh game, interlopers answered as the player would → nothing parked, the
  standing prompt never the card's own answered question (`reaskedBy`). 102 plays replayed;
  `LEFTOVER_PRESELECT_WORKLIST` empty and failing both ways. A second check: every input step and branch
  pick of an in-scope play preview is addressed.
- `deferredInputBatch.spec.ts` § Sponsored Academies (lands; parks past Olympus and lands after) and § the
  address (a card question of another asker of the same type in front of TR43's target is not tried —
  unaddressed, it eats the answer; an own refusal drops; a manual answer supersedes); `VenusRedux.spec` /
  `HabitatScience.spec` post the target addressed, as the composers do.
- The client witness `console/preselectWitness.ts` warns `RE-ASKED PRE-SELECT` when a view's prompt (any
  node) is a question the last batch answered; the e2e harness's `preselectGuard` (`consoleTest.ts`) turns
  it red on EVERY spec. e2e `console-sponsored-academies` (fhd + 4K).

**Who re-asked — the sweep.**

| | before (the old replay module, unaddressed batches) | after |
| --- | --- | --- |
| Sponsored Academies | clean · interlopers · reds — the discard never landed | lands in the play's POST; parks past Olympus and lands |
| every other in-scope play with a pre-select (102 replays) | — | — |

The sweep also caught one preview lie: a COUNTED «add to any card» that counts zero (Hydrogen to Venus
with no Jovian tag) promised a target pick the live play never asks — `stepsForBehavior` now skips a
zero count, as the Executor does.

### CLASS 9 — a question of the player's OWN TABLE asked after the commit (added 2026-10-12, TR51, closed)

**Symptom.** The play composer collected every question of the CARD (law 27), yet a play that woke a reacting card on the player's
own table — Olympus Conference with a stored science, Mars University, Pharmacy Union with no disease, Viral Enhancers, Splice (asks
the card's player), Recyclon with two microbes — raised that card's question as a separate prompt AFTER the press. The forecast had
already NAMED it before the press (`asks`, the «?» chip): an answer known in advance, asked once the move was made — the owner's
«strictly pre-select» (2026-10-12) forbids exactly that.

**Fix.** (1) Each reacting card builds its question in ONE method of its own file (`question` / `scienceQuestion` / `orderQuestion`),
read by the live `defer` AND by its `cardPlayedForecast`, which hands the `asks` fact the prompt as a preview step
(`forecast.tableQuestion` → `EffectForecastFact.preselect`, addressed `{role: 'or', source: cardSource(reacting card)}`). (2)
`models/tableQuestions.ts` — `withTableQuestions` / `playPreviewWithTableQuestions` (the route and the replay guard call the same
function) — appends those steps to `preview.preSteps` (branch-independent: they answer the PLAY). (3) The replay lands them by address:
the live queue asks the table at its own priorities, so `replayBatch` / `drainBatchTail` let the first LATER answer addressed to the
standing prompt (`own`) step forward when the head is foreign. (4) The composer renders them as rows «⚡ Сработает · <карта> · ваш выбор»
and posts them in the play's ONE POST.

**Honest follow-ups, named (not pre-selected):**

| Question | Why it stays after the press | Where it says so |
| --- | --- | --- |
| a discard FROM THE HAND behind a draw of the same play (Mars University after the card's own draw, after Olympus «remove to draw», after a first Mars University) | the card that might be discarded does not exist yet (hidden) | `HIDDEN_DRAW_NOTE` on the fact; a draw that is an OPTION above it gates the row (`reaction.afterDraw` — the composer hands it on as «ДАЛЕЕ» only when the answer above draws) |
| a second Olympus / Pharmacy Union question of the same play | whether it is asked depends on the first answer | `DEPENDS_ON_ANSWER_NOTE` |
| Neptunian Power Consultants | asked after the ocean is placed on the BOARD (the board is the commit) | the forecast's `asks` without a step |
| a deck pick, another player's decision | hidden information / not the player's choice | by construction |

**Guards.** `tests/models/cardPlayReplayCoverage.spec.ts` replays the composer's preview (table steps included) and fails on «ASKED
AFTER THE PRESS» — a question of a table card answered «as the player» after the batch that the forecast did not name an honest
follow-up; profiles `interlopers` (Olympus + Pharmacy Union) and `reactors` (Mars University, Viral Enhancers, Recyclon, Splice on
the opponent). Without the table steps it names six plays. `tests/models/tableQuestions.spec.ts` (the steps, a batch landing in any
order, the gated discard, the two hidden-draw cases, Splice). The client's witness `POST-COMMIT CHOICE`
(`preselectWitness.armPostCommitWitness` / `checkPostCommitChoice`, armed by both composers) turns any spec red through the harness's
`postCommitGuard`.

## 5. The guard

`tests/models/actionPromptCoverage.spec.ts` — walks every in-scope action card across three
profiles (`rich`, `globals maxed`, `broke`), builds the preview read-only, then runs the real
`action()` on a fresh game (through `churn`, so a declarative card's *deferred* `OrOptions` is
resolved the way the server resolves it) and asserts:

1. an action the preview auto-resolves asks nothing more (no bare `SelectOption`, no `OrOptions`);
2. the preview's declared branch indices match the live `OrOptions` option count;
3. an action that defers a promptable payment declares a payment step;
4. **a branch's own follow-up is declared** — every AVAILABLE `SelectOption` branch is walked
   on its own fresh game and whatever the server still holds afterwards must be covered by a
   step: hosted (`input` / `spendHeat`) or named (`boardPlacement` / `colonyTrade` /
   `deltaAdvance` / `note`). See CLASS 5.
5. **a branch's WHOLE follow-up chain is covered** — every available branch (`SelectOption`,
   `optionInput` and lone-auto-resolved alike) is walked to the END: each live prompt is
   answered the way the composer's captured step response would (`answerLive` — first card,
   min amount, plain-M€-first payment), consuming the declared hosted steps in order; a
   prompt arriving past them must be covered by a named hand-off or the workspace's
   draw/deck-check claim, and a KIND mismatch against the next declared step is order/shape
   drift. See CLASS 7.

Checks 3–5 carry `LEFTOVER_PAYMENT_WORKLIST` / `LEFTOVER_FOLLOWUP_WORKLIST` /
`LEFTOVER_CHAIN_WORKLIST`, all currently **empty**, and fail BOTH ways: a new leak is a
regression, and an entry that no longer leaks must be removed — so no list can quietly become
a permanent exemption.

**And for PLAYS**: `tests/models/cardPlayReplayCoverage.spec.ts` replays every in-scope play's pre-collected batch (addressed, as the composer builds it) against the live play — see CLASS 8.

Check 4's scope is stated honestly in the spec: `SelectOption` branches only (the family the
composer answers with a bare `{type:'option'}`, and therefore the family that can silently end
the batch), first leftover only. Check 5 is the general form; 3 and 4 stay for their cheaper,
more precise failure messages.

## 6. Rules of thumb for new/edited action cards

- A bespoke `action()` that builds a variable option list **must resolve a lone option**
  (`opts[0].cb(undefined)`), or declare `orBranches(..., {autoResolveSingle: false})` and
  actually return the one-option `OrOptions`.
- The preview's `available` per branch and `action()`'s push conditions must read from **one
  shared predicate**, not two copies.
- If the action defers a `SelectPaymentDeferred` with amount > 0, declare
  `actionPreviews.paymentStep(player, amount, <the SAME options>)` and drop the flat M€ chip
  when it returns a model. Do not assume "M€-only means no prompt" — Helion and Luna decide
  that, not the card.
- **If a branch's `andThen` returns another input, the branch owes a step.** Pre-collect it
  (`orOptionsStep` / `selectCardStep` / `addToCardStep` / `inputStep` over a side-effect-free
  builder the live `action()` shares) when the surface can host it; DECLARE it
  (`boardPlacementStep` / `noteStep` / `colonyTradeStep` / `deltaAdvanceStep`) when it is
  inherently a board / colony / track interaction. Saying nothing is the only wrong answer.
- **…and the debt is the WHOLE CHAIN, not the first follow-up.** One declared step does not
  license the rest of the chain: the batch answers exactly what the preview promised, so
  EVERY prompt the branch produces past its steps opens standalone (CLASS 7 — the payment was
  declared, the card target was not). Share ONE options/builder object between the preview
  step and the live deferred (`asteroidTargetOptions()` in DirectedImpactors is the pattern),
  so the two sides cannot drift. A bill whose amount is decided by an earlier step (Energy
  Market's 2X) cannot be pre-collected — declare it with a `noteStep`, gated on whether it
  would actually prompt.
- **Order is not a promise.** A pre-collected response is matched to the prompt that is
  actually waiting, and an effect the same play triggers can be waiting first (CLASS 6). Never
  build a flow that depends on the card's own input being the very next thing the server asks;
  if a new pre-collect ever needs a guarantee, the honest instrument is the `Priority` ladder,
  not the batch.
- **A pre-collected `OrOptions` needs option METADATA and a TITLE.** Six rows reading «Титан»
  / «Сталь» answer a different question than the player is asking: attach
  `optionMetadata.gainStock` / `gainProduction` / … so each row carries its icon and the
  viewer's own `current → resulting`, and `setTitle` the OrOptions so the step names itself
  («ВЫБЕРИТЕ РЕСУРС») instead of falling back to the generic «ВЫБЕРИТЕ ВАРИАНТ». The console's
  reward wave reads those same `effects` to decide what flies — an option with no metadata
  gains silently.
