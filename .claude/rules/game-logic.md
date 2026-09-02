---
description: Card authoring + per-card premium hooks (co-location, no-auto-select, no silent loss, infoText ordering).
paths:
  - "src/server/cards/**"
  - "src/server/behavior/**"
  - "src/server/deferredActions/**"
  - "src/common/cards/**"
  - "src/server/tools/cardInfo/**"
  - "tests/cards/**"
---

# Card / game-logic rules

## Adding a card — the 5 required touch points
1. Card class in `src/server/cards/<module>/<CardName>.ts` — extend `Card`, or **`ActionCard`** for an ACTIVE card with a repeatable action (it enforces the `action` behavior and wires `canAct()`/`action()`).
2. Enum entry in `src/common/cards/CardName.ts`.
3. Factory registration in the module manifest (`<Module>CardManifest.ts`; base cards → `StandardCardManifests.ts`, all aggregate in `AllManifests.ts`).
4. `metadata.renderData` via the `CardRenderer.builder()` DSL.
5. Spec in `tests/cards/<module>/<CardName>.spec.ts`.

**Prefer the declarative `behavior` DSL over imperative `bespokePlay()`.** Declarative cards are auto-covered by the preview / information / reason subsystems; a bespoke card needs hooks.

## Co-location is load-bearing — never centralize per-card hooks
Every per-card hook lives **IN the card file**, next to `canPlay`/`canAct`/`bespokePlay`, pulling wording from a thin stable builder: `cardPlayPreview?()` and `actionPreview?()` (`cards/actionPreviews.ts`), `actionUnavailableReason?()` (`cards/actionReasons.ts`), `unplayableReason?()`, `metadata.infoText`, modal metadata (`inputs/optionMetadata.ts`). This is a fork that merges upstream: when upstream changes a card, the hook is in the SAME diff/conflict and can't silently drift. A fork-only central table would merge clean and rot. All hooks are READ-ONLY (never mutate game state).

## 🚫 NO AUTO-SELECT — every targetable choice is SHOWN, even with a SINGLE candidate
The player must see WHO/WHICH card is hit and its `current → resulting` BEFORE confirming. The trap is bespoke code doing `if (candidates.length === 1) { apply directly }` — build the `SelectCard`/`SelectPlayer` instead (neither auto-resolves on one option) and pre-collect it in the preview. Mirror it in BOTH `execute()` and the read-only `previewSelect*()`. `AddResourcesToCard`/`RemoveResourcesFromCard` need explicit `autoSelect/autoselect: false`.
**Exempt:** a FIXED self-target (`filter: c => c.name === this.name` — Ants/Predators) and `OrOptions.reduce()` auto-picking the only OR BRANCH (no hidden target).
Per module, grep for `length === 1` / `length > 1` near `addResourceTo` / `removeResourceFrom` / `.attack(` / `.cb(` / `production.add` — there is NO auto-guard for this class. Record triage in `docs/DELAYED_TARGET_AUDIT.md`.

## No silent loss — a skipped effect must NAME itself
When an effect can't apply (no eligible card, no target), suppress the misleading gain chip and emit a warning that names WHICH effect was skipped: `skipped: {label, effect?}` built via `actionPreviews.warningNote(...)` / `targetStepOrWarning(...)` with a label from the shared `SKIPPED_LABEL` set — never a hand-rolled `{kind:'note', noteKind:'warning'}` literal and never a bare "no valid target". Omit `effect` when no single magnitude is honest (an either/or attack).

## A HOOK THAT ANSWERS IS NOT A HOOK THAT ACTS
Where a rule must be read TWICE — once to promise (a preview) and once to pay (the commit) — the card's hook returns WHAT IS OWED and grants nothing. `ICard.deltaMovementBonus` is the reference: `delta/deltaMovement.ts` is its single caller and both the commit and the planning projection ask that same function, so a promise and a payout cannot diverge and an effect that cannot mutate cannot re-trigger the event that called it. The other half of the same contract is that the EVENT has one commit point: `commitDeltaMovement` is the only writer of a Hydronetwork position (source-level guard: `tests/delta/deltaMovement.spec.ts`), which is what makes «any player moved» true for MarsBot without a single `if (bot)`. Full write-up: `docs/claude/delta-movement-contract.md`.

## Reasons name ONE blocker
A validation reason must name one concrete blocker — never an "X or Y" combination the player has to guess between. Check conditions in order and return the specific reason. A GENUINE disjunction ("Need 1 M€ OR an asteroid" — either enables the action) keeps its "or".

## `metadata.infoText` (structured card text)
EN-only keys (the text IS the i18n key), **ONE block per bonus** (never a run-on paragraph). Three hard, guard-enforced rules:
1. **No sequencing connective words** («then» / «afterwards» / «finally» / ordinal-less «firstly») — order carries sequence.
2. **Block order = RENDER reading order = real EXECUTION order.** Behavior-derived blocks auto-sort; authored `infoText` you order yourself. If the card's render is out of execution order, fix the RENDER.
3. **The requirement LINE must state the same rule as the requirement CHIP.** Both derive from the same `CardRequirementDescriptor`, so the prose must carry the descriptor's `max` («at most», never «at least»), its magnitude, its `all` scope and its subject noun — a `max` phrased as a minimum tells the player the OPPOSITE of the chip beside it (Pioneer Settlement, Geological Survey). Every countable branch of `requirementBlock` phrases the comparator through `comparator(max)`. Guard: `tests/cards/requirementProse.spec.ts` (EN and RU).
The generator must not drop a `behavior` sub-field (placement restrictions, adjacency bonus, counts). A VP block carries ONLY the VP rule; a block about the card's own tile must tether to it via `tokens`. Metadata riding a constructor-param default needs `: CardMetadata`.

## Guard tests ARE the worklist
`npm run make:cards` regenerates `metadata.information` + `src/genfiles/cardInfoAudit.json` (`needsCuration` / `seededRunOn` / `missingTranslations` must all be 0). Coverage specs fail WITH the exact card list: `cardPlayPreviewCoverage`, `actionReasonCoverage`, `actionUnavailableReasons`, `cardInformation`, `requirementProse`, `effectExtraction`, `actionExtraction`, `choiceContext`, `premiumCardViewModel`, `premiumCardIcons`.

**Widening scope to a new expansion → follow `docs/claude/expansion-adaptation-checklist.md` (the master to-do: which SCOPE constants to widen, per-subsystem work, per-module gotchas, done-criteria).**
