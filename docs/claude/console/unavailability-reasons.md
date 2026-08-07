# Unavailability reasons — never a bare "недоступно"

**The rule (CLAUDE.md invariants 2, 4, 5):** availability is SERVER-authoritative and every disabled
control carries a CONCRETE reason. A reason names ONE blocker; it never makes the player guess
between "X or Y", and it never states something the code did not verify.

The failure this file exists to prevent: a player holding **510 M€** opened «СТАНДАРТНЫЕ ПРОЕКТЫ»,
found «КОЛОНИЯ» greyed out, and was told «Сейчас недоступно». The real cause — every colony tile was
full — was invisible to the client, and the client's own fallback ("cost > my M€ → not enough money")
would have been a *different* lie.

## The three reason engines (one family, one shape)

All three produce `UnplayableReason[]` (`src/common/cards/UnplayableReason.ts`) and all three take
their per-card wording from a **co-located hook in the card file**, never a fork-only central table —
so an upstream change to the gate lands in the same diff as its reason and the two cannot drift.

| Engine | Answers | Hook | Model field |
| --- | --- | --- | --- |
| `models/unplayableReasons.ts` | why a card in HAND can't be played | `ICard.unplayableReason?` | `CardModel.unplayableReasons` |
| `models/actionUnavailableReasons.ts` | why a blue card's ACTION can't be used | `ICard.actionUnavailableReason?` | `CardModel.actionReasons` |
| **`models/standardProjectReasons.ts`** | why a STANDARD PROJECT can't be used | `ICard.actionUnavailableReason?` (same hook) | `CardModel.actionReasons` |

### Why standard projects needed their own engine
They are the ONE family the menu deliberately lists while NOT actable (`Player.getStandardProjectOption`
passes a parallel `enabled` array), and their gate is bespoke: a free space for the tile, an open
colony slot, moon land, corruption, cards in hand. `isIProjectCard` and `isIActionCard` are both false
for them, so neither older engine ever saw them, and `SelectCardToPlay.toModel` had a `disabledReasons`
slot it never filled. The client was left guessing by construction.

### Wiring
`ModelUtils.cardsToModel` → the `enabled?.[index] === false` branch → `isIStandardProjectCard(card)`
→ `standardProjectUnavailableReasons(player, card)` → `model.actionReasons`. No opt-in flag: `enabled`
is only ever false for a standard project in this menu, and the call never re-runs `canAct` (pricey
for the placement projects — the caller already established unavailability).

### Order is deliberate — the STRUCTURAL blocker leads
A rules block survives any amount of money, so it is the honest headline; the M€ gap follows (and the
screen's wallet strip already shows it). One-line consumers take `[0]`.

`StandardProjectCard.canPlayOptions` is **public** so the explainer reads the SAME affordability
request the gate uses — a hand-built cost/TR/reserve triple would drift from `canAct`.
`Player.affordabilityDeficitFor(options)` is the generalization of `affordabilityDeficit(card)`.
A missing RESERVED cube (the Moon projects' titanium/steel) is named as a RESOURCE, not folded into
the M€ gap — `maxSpendable` goes negative there and would report a missing cube as a money problem.

### Adding a standard project
If its `canAct` is affordability-only, nothing to do. If it overrides `canAct`, add
`actionUnavailableReason(player)` right next to that override, mirroring the same checks in the same
order, returning `undefined` when its own condition is satisfied (the block is the payment).
Builders live in `src/server/cards/actionReasons.ts`.

### Aggregate reasons (Build Colony)
When N objects are each blocked, one sentence must still be exactly true.
`BuildColonyStandardProject.colonyBlocker` classifies every tile with the same checks in the same
order as `Colonies.getPlayableColonies`, then names ONE cause when a single cause explains every tile
(«Все колонии заполнены»), and otherwise reports the **inventory** («заполнено — 3, уже ваши — 2») —
a fact, not a disjunction. An "every/all" claim is only made when the count actually equals the total.

## The client contract
`consoleQuickModel.buildStdProjectItems` reads `c.actionReasons?.[0]` FIRST; the off-turn and
M€-deficit branches remain only as fallbacks for when the server sent nothing. **Never re-derive a
reason client-side when the server can know it** — a guess is right only by accident.

Guards: `tests/models/standardProjectReasons.spec.ts` (incl. the explainer → `cardsToModel` →
`CardModel.actionReasons` wiring test, which is the piece that would otherwise degrade silently) and
the "SERVER reason wins over the client M€ guess" rows in
`tests/client/components/console/consoleQuickModel.spec.ts`.

## The server sweep — where a reason could go missing, and why it can't now

An exhaustive audit of every server producer of disabled/unavailable state found the
gaps below. The fixes are deliberately **structural** (one place, can't be forgotten)
rather than per-call-site.

### Preview branches — the worst offender (18 sites, one fix)
`ActionPreviewBranch.available:false` with no `unavailableReason`. This is the reason
the repeat picker, the action confirm modal and the console composers printed
«Сейчас недоступно» or nothing: those surfaces deliberately ignore the card-level
`actionReasons` and show the BRANCH reason only. 18 `singleBranch` callers had a
co-located `actionUnavailableReason` hook and never threaded it.
**Fix:** `singleBranch` and `dynamic` (`cards/actionPreviews.ts`) now fall back to
`card.actionUnavailableReason?.(player)` themselves — the same fallback the bespoke
path in `models/actionPreview.ts` already made. The declarative single-action branch
there falls back too (its `subAvailability` scan only walks the behavior, so a card
blocked by a BESPOKE gate collected nothing).
**Guard:** `tests/models/actionPreviewReasonCoverage.spec.ts` — behavioural, not a
source sniff: it previews every in-scope action card in a fixture where most are
blocked and fails listing any branch with a blank reason. Verified to bite (it
reports exactly those 16 cards when the fallback is removed) and carries
anti-vacuous floors on cards-walked and branches-blocked.

### Templated reasons losing their params
`models/cardPlayPreview.ts` sent `unavailableReason` without `unavailableReasonParams`
(its action-preview twin always did), so «Need ${0} more M€» reached the player with a
literal, unfilled `${0}`.

### Type-level guarantees (a silent producer becomes a compile error)
- `DisabledOptionModel.reason` is **required** (`common/models/PlayerInputModel.ts`).
  All five producers already complied; the type now keeps it that way.
- `IColonyTrader.disabledReason` returns `string | Message | undefined`, and
  `undefined` has ONE documented meaning: the player doesn't own the card, so there is
  nothing to explain. Every other refusal names its blocker.

### Colony trade fee — four card traders that vanished silently
`TitanFloatingLaunchPad`, `DarksideSmugglersUnion`, `CollegiumCopernicus`,
`HecateSpeditions` implemented neither `optionMetadata` nor `disabledReason`, and
`Colonies.ts` gated the disabled row on **both**, so a player who owned the card
watched their payment path disappear. Each now mirrors its own `canUse` in order
(no floaters → already used this generation → …), and the gate is the REASON alone;
metadata stays a presentation extra. Guard: `tests/cards/colonies/colonyTraderReasons.spec.ts`.

### Draft re-pick
`Draft.ts` disabled the already-chosen card via `enabled` with no parallel reason, so
the draft screen greyed a card the player picked themselves and said «Недоступна».
Now sends `enabledReasons` (the option added for Merger).

### Self vanishing from its own picker
`DecreaseAnyProduction.blockedTargets` walked `opponents` while the candidate list is
`game.players` — so the VIEWER disappeared from the target picker, unexplained,
whenever their own production sat at the minimum.

### Known frontier (NOT fixed — needs a Moon-board reasoner)
`illegalSpaces` is auto-derived only by `createMarsSelectSpace` (Mars-only). Eight
`SelectSpace` prompts bypass it, so their dimmed cells carry no reason:
`BasePlaceMoonTile` + `PlaceSpecialMoonTile` (these two cover ALL moon placements),
`HostileTakeover` ×2, `LunarMineUrbanization`, `Eris` (community), `DesperateMeasures`
(ares), `RemoveOceanTile` (turmoil). The moon ones need a moon equivalent of
`MarsBoard.computeIllegalReasons`; the removal/hazard prompts need a `customReasoner`
plus new `PlacementIllegalReason` members, because the generic placement vocabulary
("Already has a tile") is nonsense for a prompt asking what to REMOVE. Moon /
community / turmoil are outside the premium-subsystem scope
(`docs/claude/expansion-adaptation-checklist.md`).

Also deliberately left: `Player.getActions()` never calls `setDisabledOptions`, so the
top-level action menu lists only what IS available. The console derives its own
reasons for those verbs (`turnIntents` / `consoleQuickModel` / `consoleMaModel`), and
adding a parallel disabled channel there is a larger change to the load-bearing
"availability = option PRESENCE" contract — worth doing, but not as a side effect.

## Related fixes in the same pass (2026-08-07)
- `ConsoleColoniesSection.reasonFor` pinned `myTurn: true, awaitingInput: true`, making rung 3 of
  `colonyTradeReason` always fire and rung 4 unreachable — off-turn players were told «не хватает
  ресурсов на оплату». They are props now, fed the shell's real signals.
- `ConsolePlayCardConfirm` never passed `requirementReason` to `computePrimaryAction`, so the biggest
  control on the screen read «Сейчас недоступно» while the server's concrete reason sat two rows
  above it; its `statusLabel` also said «требуется выбор» for a rules-blocked branch that offers no
  choice. Both now carry the branch reason (mirroring `ConsoleActionComposer.commitGate`).
- `consoleMaModel` re-derived milestone readiness with `claimable === true || score >= threshold`,
  letting a met-on-paper threshold override a server "no"; and its blocker tail returned «завершите
  текущее действие» while the free action menu WAS live. Now `claimable ?? threshold` (server first,
  heuristic only when the flag is absent) and a kind-specific honest tail. Same tail fixed in
  `ConsoleShell.maConfirmBlockReason`.
- `Merger` now sends `enabledReasons` (new `SelectCard` option, parallel to `enabled`), and
  `ConsoleStartScene` renders it — a disabled start-scene candidate used to hardcode
  `reason: undefined`, so it showed a bare «Недоступна» badge and nothing else.
