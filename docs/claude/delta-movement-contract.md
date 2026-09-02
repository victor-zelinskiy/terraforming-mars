# The Hydronetwork MOVEMENT CONTRACT — one fact of actual movement

*Read this before writing anything that reacts to, projects, or performs a position change on the Delta Project («Гидросеть») track.*

Source: `src/server/delta/deltaMovement.ts` · guard: `tests/delta/deltaMovement.spec.ts` · first consumer: `src/server/cards/delta/SocialHeating.ts` (DP09).

---

## THE DEFECT IT CLOSED

Two pipelines wrote `deltaProjectData.position`:

| writer | published a movement fact? |
| --- | --- |
| `DeltaProjectExpansion.advance` (standard action, DP03's bonus move, DP04's card action) | yes — `onDeltaTrackAdvance` over the mover's own tableau |
| `AutomaDeltaProject.resolve` (the Solo Delta Project reference card) | **no** — it assigned `progress.position` itself |

The rules agreed (the bot's step legality is a deliberate twin of the human's); only the *announcement* did not. So any rule of the shape «when somebody moves on the track…» had to pick a pipeline to trust, and would have needed a bot-shaped special case to be complete — the exact thing a card must never contain.

## THE CONTRACT

**`commitDeltaMovement(player, requested, cause, journal?)` is the ONLY writer of a track position.** Both pipelines call it; both therefore publish the same fact. `tests/delta/deltaMovement.spec.ts` reads `src/server/**` and fails with the offending file if a second writer ever appears. Deserialization is the one legitimate exception — it assigns the whole `deltaProjectData` object, which is state RESTORATION and deliberately publishes nothing.

```
commitDeltaMovement
  ├─ write the position                     (from → to, throws past the end of the track)
  ├─ journal?(movement)                     the caller's OWN voice: stop record + log lines
  └─ publish
       ├─ mover's tableau  · onDeltaTrackAdvance(player, steps)     (Development Manager)
       └─ EVERY tableau    · deltaMovementBonus(owner, movement)    (Social Heating)
```

`DeltaMovement` carries: mover, `from`, `to`, **`steps` (the COMMITTED distance, `to - from`)**, `requested` (context only — never a reward input), `cause` (`standard` / `card` / `automa`), `generation`, and `key`.

### The invariants

- **Actual, not requested.** A rule reads `steps`. A move the rules cut short pays for the cells really crossed.
- **Zero is not a movement.** A non-positive request writes nothing and publishes nothing, so «no movement» and «a movement of nothing» cannot be confused.
- **Exactly once per commit, synchronously, inside the caller's journal scope.** An effect it triggers lands in the same correlation chain; a re-render, a reconnect, a replayed animation or a stale callback cannot produce a second one.
- **Identity needs no counter.** `key` (`<color>:<from>-><to>`) is unique by construction — positions only increase. Ordering/idempotency of everything the fact causes ride the EventRecorder's correlation chain, which the caller has already opened.
- **Order is fixed:** the mover's own hooks first (a movement-triggered gain precedes a reward-triggered one), then the table-wide ones, then the stage reward resolution.

## THE HOOK IS A PURE ANSWER

```ts
// ICard
deltaMovementBonus?(cardOwner: IPlayer, movement: DeltaMovement): DeltaMovementBonus | undefined;
```

It ANSWERS «what do I owe»; it never grants, logs, defers or moves anything. That is what makes **one function serve two readers**:

- the **COMMIT** pays it out inside the movement's event scope (`stock.add(..., {from: {card}})` → the journal reads «⟨card⟩ → +N ⟨resource⟩» under the move that caused it, and the affected-player notification machinery picks it up with no card-specific wiring);
- the **PLANNING PROJECTION** (`DeltaProjectExpansion.projectedMovementBonuses`) asks the same function with a `plannedDeltaMovement` — a fact that has not happened.

A promise and a payout therefore cannot diverge, and an effect that cannot mutate cannot re-trigger the movement that called it.

## THE PROJECTION ON THE WIRE

`DeltaMovementBonusProjection` = `{card, resource, amount, before, after}`.

- **Standard advance:** one per destination on `DeltaTrackDestination.movementBonuses` (`getPreview`), so the amount already reflects that destination's legality-checked step count.
- **Card-granted move:** the same shape on `DeltaAdvanceOffer.movementBonuses` — filled by `BonusDeltaAdvance` (DP03) and `StormSurgeBarrier.advanceOffer` (DP04), so both provenances promise in one vocabulary.
- Absent when nothing is owed ⇒ the historical payload of a table with no such card is byte-identical.

**The client never derives an amount.** `ConsoleHydroSection.movementBonuses` only chooses WHICH move is being read (an offer on the table describes that move; otherwise the plan's selected destination, and only in `plan` mode). A reward-only claim (Dutch Mountains) has no destination and lands as an empty list by construction.

## THE PRESENTATION

- **Reading:** «ДОПОЛНИТЕЛЬНО» — a SECONDARY GROUP inside the one outcome block (`ConsoleHydroGains`), never a second panel: same typography, same «сейчас → станет», the source card named. The stage reward keeps its place as *the* result. Frozen into `HydroCommitRecord.movementBonuses`, so the result stage restates exactly what the CTA promised.
- **Flight:** the bonus is caused by the MARKER TRAVELLING, not by the landed stage — so it joins the destination's own arrival wave (`hydroMovementBonus.ts`), never a scene of its own. On a multi-cell traversal it lands on the LAST leg: **one aggregate delivery**, never a chip per crossed cell.
- **Another player's move:** no workspace is captured and no modal opens. The gain is an ordinary affected-player event, so the existing filter delivers it and the card leads with «Вы получили +N [heat]»; `viewerImpactOfChain` attributes the gain to the viewer's OWN card (`ownSource`), which is why the cause line reads «Причина: ⟨игрок⟩ · Источник ⟨карта⟩» instead of claiming the opponent holds it.
- **The viewer's own move:** no self-notification — `diffRootNotifications` suppresses the viewer's own ordinary actions, and the bonus was already shown in the plan panel and again in the result.
- **A bot move:** rides the bot turn's own FIFO entry. The payout's public log line is captured into the turn script (so the theater names the source card) and the heat appears in the turn's «results» impact step, which is what makes the bot-turn card lead with the viewer's gain.

## BACKWARD MOVEMENT (Corporate Espionage, DP10)

**`commitDeltaRetreat(player, requested, cause, journal?)`** is the retreat twin, in the SAME module (the one-writer guard keeps holding by construction). The fact it publishes is the same `DeltaMovement` shape with **`steps` SIGNED negative** (`to − from`), `direction: 'backward'`, and a `cause` of the new kind `{kind: 'card-attack', card, by}` (`by` = the acting player; the fact's `player` stays the MOVED one). Rules it deliberately does NOT touch:

- the **advance hooks never fire for a retreat** (`onDeltaTrackAdvance` is about advancing; the bonus reader `resolveDeltaMovementBonuses` refuses non-positive steps — every printed movement card says «advances», so Social Heating pays nothing for a push-back);
- it floors at the track start (a zero-step «move» writes and publishes nothing — the CALLER must have refused such a target out loud);
- landing rewards are the caller's rule: **`DeltaProjectExpansion.retreat(target, {source, by})`** is the one entry point (eligibility = `retreatBlockedReason` — «vp-protected» / «track-start», the same verdict the projection shows; the landing reward = the ONE arrival resolver, ON the target; a player whose standing rule voids stage rewards — MarsBot's Solo Delta Project reading, `takesStageRewards` — still retreats, with the void clause NAMED).

**Both directions now publish the canonical `delta-position-changed` GameEvent** (`EventRecorder.recordDeltaPositionChange`: mover, `impact.deltaPosition {from,to,steps}` signed, the attacker on `target.player`/`source.owner`, tag `attack` for a card-attack) — the notification layer and any future journal read positions off THIS, never off a localized log line.

A retreat key can legitimately repeat a `from→to` pair (retreat → re-advance → retreat), so it carries the event stream's monotonic ordinal; forward keys stay unique by construction.

## THE BLOCKADE (Modular Floodgates, DP11)

**`activeDeltaBlockade(player)`** (same module) is the ONE definition of «may
this marker advance at all»: a player-targeted record on
`deltaProjectData.blockade` (`{by, card, generation}`), active ⇔ it names the
CURRENT generation. Every legality surface asks it — the human
`getValidAdvanceSteps` (which closes the standard action, DP03, DP04, DP07's
multi-step and DP10's own advance in one line), the bot twin
(`AutomaDeltaProject.getValidAdvanceSteps` + a NAMED prevented line in
`resolve`), the refusal builders (`bonusAdvanceUnavailableReason`,
`DeltaProject.actionUnavailableReason` → the shared
`DeltaProjectExpansion.blockadeReason()`), the preview
(`DeltaTrackPreviewModel.blockade`, `maxLegalSteps: 0`) — and
**`commitDeltaMovement` enforces it as the last-resort hard gate** (a caller
that skipped its pre-check throws; it can never move a blocked marker). A
RETREAT is deliberately not gated: the blockade blocks ADVANCEMENT, and the
status stays attached to the PLAYER across a legal backward move. Reward-only
grants (`grantStageReward`, DP08) never touch it.

Placement: `DeltaProjectExpansion.placeBlockade(target, {source, by})` —
eligibility `blockadeTargetBlockedReason` (`track-end` / `vp-protected` — the
gate cell may not be a VP terminal, so positions 9/10 are protected /
`already-blocked`), the journal line, and the canonical
`delta-blockade-changed` event (victim = `player`, deployer = `target.player`
+ `source.owner`, tag `attack` — the notification layer reads THIS).
Expiration: `expireBlockades(game)` from `Game.startGeneration` (NOT
`runProductionPhase`, which MarsBot skips), exactly once, steel not returned;
the generation-scoped `activeDeltaBlockade` keeps even an un-swept record
inert, so a reload on the boundary cannot resurrect one.

## ADDING THE NEXT MOVEMENT-REACTIVE CARD

1. Implement `deltaMovementBonus` in the card file (co-located — invariant 8). Return `undefined` when nothing is owed. **Do not mutate.**
2. Nothing else. The commit pays it, the preview promises it, the journal records it, the notification reaches the affected owner, the bot triggers it.
3. If the card needs to react to movement *without* granting stock (a counter, a tile), add a second hook beside `deltaMovementBonus` in `publishDeltaMovement` — do not inline a mutation into the answer function, and do not add a writer of `progress.position`.
