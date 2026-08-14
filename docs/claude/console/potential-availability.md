# Potential availability — «мог бы» vs «могу прямо сейчас»

**The rule:** every green number in the console means ONE thing — *how many of these the player could
do in the current game state* — and it does not move because the turn moved. Whether the move can be
SUBMITTED right now is a second, separate question, asked only where something is actually submitted.

The failure this file exists to prevent: «Сейчас не ваш ход» was treated as an ordinary
unavailability reason. So on an opponent's turn the RT wheel's «КАРТЫ 4» simply vanished, the hand
went grey with «✕ Нельзя разыграть» over cards that were entirely legal, the Hydronetwork stage
showed a red «Сейчас недоступно» directly under three green ✓ ticks, and a colony whose track the
player could afford refused them with a red ✕. Every one of those statements was about the clock and
every one of them read as a statement about the object. Worse, the numbers were only ever visible on
the player's own turn — which is precisely the moment they have the least use for planning.

---

## 1. The two states

| State | Means | Where it is used |
| --- | --- | --- |
| **POTENTIALLY AVAILABLE** | the move would be entirely legal in the CURRENT game state if it were this player's window | every green count (wheel badges, the RT bar badge, «можно выполнить», «Можно разыграть») |
| **EXECUTABLE NOW** | potentially available AND actually submittable — the player's window, no owed decision, no other execution gate | every commit / press / CTA |

`executableNow ⊆ potentiallyAvailable` — enforced, not assumed (see §5, the sponsor-discount trap).

## 2. The structured blocker — `src/common/availability/AvailabilityBlocker.ts`

Each blocker declares its OWN answer to both questions. It is deliberately not derived from «is this
temporary» and not derived from the colour — a future gate (a paused game, a spectator seat) states
its semantics rather than inheriting them.

```ts
export type AvailabilityBlocker = {
  code: BlockerCode;              // NOT_YOUR_TURN | FINISH_CURRENT_ACTION | EXECUTION_GATE | DOMAIN
  blocksExecutionNow: boolean;    // the Commit stays disabled
  affectsPotentialCount: boolean; // it drops out of the green number
  tone: 'warning' | 'danger';     // the visual register
};

potentiallyAvailable = blockers.every((b) => !b.affectsPotentialCount);
executableNow        = blockers.every((b) => !b.blocksExecutionNow);
```

| Code | blocksExecutionNow | affectsPotentialCount | tone |
| --- | --- | --- | --- |
| `NOT_YOUR_TURN` | ✔ | ✘ | warning |
| `FINISH_CURRENT_ACTION` | ✔ | ✘ | warning |
| `EXECUTION_GATE` (other non-domain gates) | ✔ | ✘ | warning |
| `DOMAIN` (cost, requirement, target, per-generation usage, no fleet, no payment path…) | ✔ | ✔ | danger |

**The classification is STRUCTURAL** (cross-cutting invariant 1 — i18n mutates `Message.message` in
place, so a text match silently stops matching after the first render). It keys off
`UnplayableReasonType`: `turn` / `phase` are the two types the CLIENT adds to describe the action
WINDOW (the server cannot know whose turn the viewer thinks it is); everything the server produces is
by construction about the card.

### Mixed causes — the domain reason wins
`primaryBlocker` / `primaryReason` put a real rule ahead of a turn gate, so «Сейчас не ваш ход» can
never mask «Нужна метка». An element with BOTH leaves the count, stays red, and shows the useful
line; the turn gate may remain as a secondary calm marker but never as the headline.

## 3. The server projection — `src/server/models/potentialActions.ts`

`PublicPlayerModel.potentialActions` (**self model only**, like `actionReasons` — it is planning
information and would leak an opponent's hand playability):

```ts
type PotentialActionsModel = {
  playableCards: number;  // Player.getPlayableCards()            — the action menu's own list
  cardActions: number;    // Player.getPlayableActionCards()      — canAct + not used this generation
  hydroAdvance: number;   // 0|1 — expansion on, not used this gen, DeltaProjectExpansion.maxSteps > 0
  colonyTrades: number;   // Colonies.potentialTradeCount()
};
```

The module owns **no rule of its own and must never grow one** — every number is delegated to the
validator the engine executes with. It is read-only w.r.t. game state (`canPlay` refreshes a card's
ephemeral `warnings` / `additionalProjectCosts` exactly as `unplayableReasons` already does on every
model build; guarded by a serialize-before/after spec).

### `canAdvanceDelta` is now DERIVED
`canAdvanceDelta = inActionSelection && potentialActions.hydroAdvance > 0`. It keeps its old meaning
(the bottom-bar cue, the pass warning, the button gate) and can no longer drift from the projection.
Likewise `availableBlueCardActionCount` is the same number as `potentialActions.cardActions`.

### The trade count — `min(tradeable colonies, free fleets)`, 0 with no payment path
`Colonies.potentialTradeCount()` composes the AUTHORITATIVE validators rather than restating them:
`tradeBlockedReason()` (embargo / fleet / an open colony) plus the **same `tradeHandlers()` list the
live trade action builds its payment OrOptions from** — so Titan Floating Launch-Pad, Collegium
Copernicus, Darkside Smugglers' Union, Hecate Speditions, the Adhai discount and `tradeDiscount` are
all already accounted for.

⚠️ **It is deliberately NOT folded into `tradeBlockedReason()`.** That predicate backs `canTrade()`,
which `DarksideSmugglersUnion` / `CollegiumCopernicus` / `TitanFloatingLaunchPad` use as their own
`canAct` gate — widening it would change game rules, not just the display.

## 4. The client — `src/client/console/potentialAvailability.ts`

`wheelPotentialCounts` re-derives nothing. It applies the two presentation facts the server cannot
know: the **intake clamp** (a card mid-flight into the dock is not "in hand" on any HUD readout — the
same rule the dock's «КАРТЫ n/m» line obeys) and «a category absent from this game shows nothing».
No projection (an opponent seat, an older server) degrades to zeros — the badge simply does not
render.

The RT bar badge is the SUM of the wheel it opens, so the hint and the wheel can never disagree. Its
`highlight` accent stays turn-gated: that one IS the «can I act now» question.

## 5. Per-surface adoption

| Surface | Potential | Executable now | Turn-gate presentation |
| --- | --- | --- | --- |
| Hand | `ConsoleHandEntry.potential` (`unplayableReasons` empty) | `.playable` (the server's live play offer) | slot keeps its bright pose + amber focus ring (`--notnow`), verdict bar «⏳ Не сейчас» + the amber reason rail |
| Card actions | `ActionStatus` `available ∪ soft` → `model.availableTiles` | `state.activatable` | «НЕ СЕЙЧАС» badge (already existed) + the slot's diagnostics line now amber ⏳ instead of salmon ✕ |
| Hydronetwork | `potentialActions.hydroAdvance` | `findHydroActionPath(waitingFor)` | header chip amber (already), stage badge «Не сейчас» instead of red «Сейчас недоступно», CTA reason amber ⏳ |
| Colony trade | `potentialActions.colonyTrades` | the server's `SelectColony` trade window | focus-stage verdict amber ⏳ (`--notnow`) instead of the red ✕ |

**⚠️ `playable ⊆ potential` is ENFORCED in `handEntriesAll`, not assumed.** The live offer can be
WIDER than the plain rules verdict, because a prompt may carry its own discount — Eccentric Sponsor's
play-from-hand prelude is the case. `unplayableReasons` knows nothing about it, so a card playable
only thanks to that discount would otherwise be dimmed while its own РАЗЫГРАТЬ button was live.

**The hand shelf sorts by POTENTIAL** (playable-first, CONSOLE_MODE_CONCEPT §8) so its reading order
survives the turn passing; on the viewer's own turn the two sets coincide.

## 6. What did NOT change

- **Execution stays impossible off-turn.** Every commit still gates on the server's live offer; the
  server-side guards are untouched. Nothing here submits anything.
- **No game rule moved.** `canTrade()`, `canAct()`, `canPlay()` and every card hook are as they were.
- Navigation is still free: the player may open any category and inspect it off-turn.

## 7. Guards

| Spec | Covers |
| --- | --- |
| `tests/client/components/console/potentialAvailability.spec.ts` | the blocker table, the structural classification over every `UnplayableReasonType`, both derivations, mixed-cause priority, the hand three-state mapping, `actionStatusBlocker`, and `wheelPotentialCounts` (clamp / absent category / no projection / turn-independence) |
| `tests/models/potentialActions.spec.ts` | the server projection: hydro 0/1 across every gate, trade `min(colonies, fleets)` incl. no-payment-path and a non-M€ path, delegation to `getPlayableCards`/`getPlayableActionCards`, the self-model wiring, `canAdvanceDelta` off-turn, and read-only purity |
| `consoleQuickModel.spec.ts` | all four RT badges; a zero count keeps the slot reachable and shows no badge |
| `consoleCardActions.spec.ts` | a soft tile stays in `availableTiles` with `tone: 'warning'`; rules/activated leave it |
| `hydroReasons.spec.ts` | the turn gates are warnings, a real track rule outranks them, every reason kind is classified |
| `colonyTradeReason.spec.ts` | rungs 1–3 are `DOMAIN`, rung 4 is the turn gate |

Related: `unavailability-reasons.md` (the three server reason engines that PRODUCE the domain
reasons classified here), `quick-wheel.md`.
