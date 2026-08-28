# Action prompt audit — leftover prompts the pre-collect contract missed

**Triggered by:** Factorum's corporation action showing a generic «◈ ПОДТВЕРЖДЕНИЕ / Потратьте 3 M€, чтобы добрать карту строительства» band in the console-native shell, *after* the action workspace had already taken the confirmation.

**Status:** the in-scope classes below are FIXED and guarded by
`tests/models/actionPromptCoverage.spec.ts`. The Turmoil class is open and recorded.

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

### Adjacent, not fixed
`promo/DirectedImpactors`' asteroid TARGET (`SelectCard`) is still an undeclared follow-up —
the same family as CLASS 3 but for pickers rather than payments. It arrives inside the
console's own card-pick surface rather than a generic band, so it is a step out of the
one-confirmation flow rather than a legacy-looking screen.

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

Checks 3 and 4 carry `LEFTOVER_PAYMENT_WORKLIST` / `LEFTOVER_FOLLOWUP_WORKLIST`, both
currently **empty**, and fail BOTH ways: a new leak is a regression, and an entry that no
longer leaks must be removed — so neither list can quietly become a permanent exemption.

Check 4's scope is stated honestly in the spec: `SelectOption` branches only (the family the
composer answers with a bare `{type:'option'}`, and therefore the family that can silently end
the batch), first leftover only. An `optionInput` branch would need a synthesized answer to
walk past and its shape is already covered by check 2.

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
  (`orOptionsStep` / `selectCardStep` / `inputStep` over a side-effect-free builder the live
  `action()` shares) when the surface can host it; DECLARE it (`boardPlacementStep` /
  `noteStep` / `colonyTradeStep` / `deltaAdvanceStep`) when it is inherently a board / colony
  / track interaction. Saying nothing is the only wrong answer.
- **A pre-collected `OrOptions` needs option METADATA and a TITLE.** Six rows reading «Титан»
  / «Сталь» answer a different question than the player is asking: attach
  `optionMetadata.gainStock` / `gainProduction` / … so each row carries its icon and the
  viewer's own `current → resulting`, and `setTitle` the OrOptions so the step names itself
  («ВЫБЕРИТЕ РЕСУРС») instead of falling back to the generic «ВЫБЕРИТЕ ВАРИАНТ». The console's
  reward wave reads those same `effects` to decide what flies — an option with no metadata
  gains silently.
