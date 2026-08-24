# BONUS ACTIONS — «Фора» / Head Start, and the board hand-off

*The card grants actions taken OUTSIDE the turn's own two. This document is the
whole contract: what the server owes, what identifies a bonus action, how the
start workspace hands the screen to the board and takes it back, and why the
turn-control verbs are refused with a sentence instead of a shrug.*

---

## 0. Why the card was disabled, and what actually broke

Upstream shipped Head Start disabled (`8d3001ad70`, 2023-08-22 removed it from
the deck; `40d833c660`, 2023-10-02 commented it out of the manifest) with one
line of explanation — *«Head Start is disabled because it's not working well»* —
and a link to issue **#5852**: players took more than two actions, several
timers ran at once, preludes were played out of order. Upstream has not
re-enabled it since.

Measured, on the original implementation:

| Scenario | The card promises | What happened |
| --- | --- | --- |
| Head Start played as the FIRST prelude | 2 bonus actions | **1** |
| Head Start played as the SECOND prelude | 2 | **0** — the turn ended immediately |
| «Пас» during a bonus action | impossible | **possible** — the player sat out all of generation 1 |

Three root causes, and each of them is a rule this implementation now follows.

**① An overloaded counter.** `headStartIsInEffect()` asked
`actionsTakenThisRound < 2`. But in this engine PLAYING A PRELUDE increments
that counter (`incrementActionsTaken()` inside the prelude callback in
`takeAction`), so the number of bonuses handed out depended on the order the
player chose. → **A bonus action gets its own counter, decremented by exactly
one thing and read by exactly one thing.**

**② Phase leakage.** While the old flag was true, `takeAction` skipped the
WHOLE `if (!headStartIsInEffect)` block — including the `game.phase`
assignment, the CEO phase and the end-of-turn check — and handed the player the
*full* `getActions()` menu while `game.phase === PRELUDES`. That menu
unconditionally carries `passOption()` and `endTurnOption()`. Passing there put
the player into `passedPlayers` **after** `playerIsFinishedWithResearchPhase`
had already cleared it, so they were skipped for the whole first generation
with an unplayed prelude still in hand; in a duel `allPlayersHavePassed()` then
took the game straight to production. → **A bonus action menu is the ordinary
menu MINUS the two turn-control verbs.**

**③ No durable state.** «How many bonuses are left» was derived from the
overloaded counter, so undo / reload / Mars Maths all corrupted it. →
**Serialized, with a graceful default on old saves.**

---

## 1. The server (`Player.ts`, `HeadStart.ts`)

```ts
player.bonusActions: number         // still owed, INCLUDING the one being asked for
player.bonusActionsGranted: number  // how many this batch granted (the N/M readout)
player.bonusActionSource: CardName  // which card granted them
```

All three are serialized (`SerializedPlayer`, `?? 0` / `undefined` on old
saves). `grantBonusActions(count, source)` is ADDITIVE, so a second grant inside
one window extends the batch rather than replacing it.

`HeadStart.bespokePlay` **grants**, it does not execute: `takeAction` hands the
player a real action menu once per bonus — and the two GAINS wait as claims:

```ts
player.pendingBonusGains: Array<PendingBonusGain>   // {steel: 2} | {megacreditsPerCardInHand: 2}
```

**THE ORDERING CHOICE (official card text).** «You may take one or both actions
before gaining the M€ and/or steel, but both actions must be taken.» So nothing
is executed at play time: the gains ride the window as claims, each one a REAL
option appended to every bonus-window prompt (`appendBonusGainOptions` — the
free menu AND the nested corp prompt). Claiming resolves at TODAY's value (the
M€ read the hand AT CLAIM TIME — the strategic point) and costs no action
(`bonusGainTaken`, the `pendingPlacementCancelled` pattern: the loop re-presents
the same prompt without spending). Whatever is left when the last bonus action
is spent AUTO-RESOLVES against the hand as it stands then — the gains are
mandatory, only their order is a choice. The marker carries the rows
(`BonusActionPromptMeta.gains`: resource + live amount + option index), so the
client renders and submits structurally, never by title.

`takeAction` gains one term at the top:

```ts
const bonusActionOwed = this.hasBonusAction();
if (!bonusActionOwed) {
  // …preludes, CEO phase, `game.phase`, end-of-turn — all unchanged…
}
```

so while a bonus stands **`game.phase` stays PRELUDES** and the end-of-turn
check cannot fire on a turn that has not finished handing out its bonuses. The
prelude callback's turn-end condition gained the matching term
(`preludeCardsInHand.length === 0 && !this.hasBonusAction()`), because the
prelude just played may be what granted them.

`getActions({bonusAction: true})` builds the SAME menu without `End Turn`,
without `Pass` and without the undo option, and keeps the ORDINARY action-menu
title — see §2.

**The corporation's mandatory first action IS bonus action #1.** «As your
first action» and «immediately take 2 actions» resolve to the same press, so
`takeAction` offers the `corporationInitialAction` prompt in place of the first
bonus menu (pass suppressed, gains appended, BOTH markers on one prompt) and
`spendBonusAction()` runs in its callback. The client reads the double marker
as the NESTED signature — see §4.

---

## 2. WHAT IDENTIFIES A BONUS ACTION (and what never could)

The prompt carries a structured marker, `BonusActionPromptMeta`, serialized
centrally in `ServerModel.getWaitingFor`:

```ts
{source: CardName, remaining: number, granted: number}
```

Two things it is deliberately NOT identified by:

- **not the title.** The menu keeps `ACTION_MENU_FIRST_TITLE` *on purpose*, so
  every surface that classifies an action menu — the task router, the RT/LT
  quick wheels, `isInActionSelectionPhase`, the status label — keeps
  classifying it as one. A dedicated title would have silently broken all of
  them, and a title check would have been unusable anyway (cross-cutting
  invariant 1: i18n rewrites `Message.message` in place).
- **not `game.phase`.** It is `PRELUDES` for the whole prelude phase, bonus or
  not.

**…and the marker is NOT what says the WINDOW is open.** A bonus action is a
whole TURN: the player plays a card, and the next three prompts are a payment, a
placement and whatever it triggered — none of them marked. So the window is the
server's own LEDGER, `PublicPlayerModel.bonusActions` (public on every seat),
and the marker is only the MENU's identity. Keying the window on the marker made
the start workspace try to come back in the middle of the player's own card play
and made the status chip flicker through every sub-prompt.

The client model is `src/client/console/bonusAction.ts`, and it answers **two
different questions** that must never be conflated:

| Function | Question | Reads | Consumers |
| --- | --- | --- | --- |
| `bonusActionOwed(view)` | is the window open? | the LEDGER | the chip, the withheld turn-control verbs, the workspace's yield/return |
| `bonusActionOnBoard(view)` | must the player go to the BOARD for it? | ledger + «no `startGamePrompt`» | the stage, the hand-off |

`bonusActionOnBoard` = owed **and** the prompt carries no `startGamePrompt`.
That second term is what keeps the corporation's mandatory first action — which
the start workspace serves ITSELF, with its own stage — from announcing a board
trip and (worse, once the excursion had already latched on the previous bonus)
holding the workspace hidden behind a board with nothing to do on it.

`bonusActionInStartFlow(view)` adds `generation === 1` and is what makes the
workspace SERVE the bonus after a reload has wiped every client latch — the same
honest domain discriminator `corpFirstActionInStartFlow` uses, for the same
reason.

---

## 3. THE BONUS TURN IS A TURN — the workspace lets go

```
  ПРОЛОГИ            «Фора» is played, the grant lands
     │
     ▼
  СТАРТ ПАРТИИ › ФОРА › ДЕЙСТВИЕ      the window's OVERVIEW stands inside the
     │                                 workspace: seat = «Фора», the PLAN names
     │                                 every item, the GAINS zone offers the
     │                                 ordering choice, one focused CTA
     │  A  (× the nested sub-stage first, when the corp has a mandatory move)
     ▼
  the BOARD HOME                       the workspace is GONE. Hand, colonies,
     │                                 card actions, standard projects,
     │  ×2                             milestones, tiles — an ordinary turn.
     ▼
  СТАРТ ПАРТИИ › ПРОЛОГИ › РОЗЫГРЫШ   the workspace RE-ENTERS, exactly once
```

**The announcement is not decoration.** The alternative — the board simply
appearing — reads as «the preparation is over», and it is not. So the stage does
exactly two things: it names what was granted and how much is left, and it says
where the next press goes (`Go to the board`, never «Выполнить» — the press
performs nothing, it MOVES the player) **plus the promise of the return**.

**…and it is a STAGE, not a modal — which means it has a SUBJECT.** The first
version drew the plate centred in the deployment row with the room dimmed behind
it, and that is a modal by every reading a player has: a floating panel attached
to nothing, over a greyed screen. It renders inside the workspace's own embed
zone, and that made no difference at all — *being* embedded is not the same as
*reading* embedded.

The fix is the first-action stage's own grammar, reused verbatim: the granting
card EMERGES from «РАЗЫГРАНО» into the source seat (`runEmbedSourceEmerge`),
takes the hero size (`--con-fa-seat-w`), and the plate stands BESIDE it with the
short hairline that says «these two are one object». The room recede is then the
shared stage phrase rather than a local dim — **one derived bit, `stageOwnsRoom`,
feeding one pair of phrases**, because two writers on the release/return of the
same surfaces is how a recede and a return cancel each other mid-flight.
`bonusAct.stage` therefore has a `staging` beat, and the CTA is withheld while
the seat is still rising (a verb the press cannot honour yet is a lie).

**…and the hand-off must be TOTAL.** The first implementation kept the workspace
mounted-but-hidden behind the placement excursion barrier, and that barrier is
built for a *placement*: one demand the board answers and hands straight back.
A bonus action is a whole turn, and a workspace that merely hides still owns
everything a turn needs:

| It still was | So the player got |
| --- | --- |
| the top of the workspace STACK → `workspaceHostForStep()` = `'start'` | the hand opened as a STEP teleported into the workspace's HIDDEN zone — **no cards at all** |
| a live surface with a lifetime hold → `startSceneServes` | walking to «Колонии» DEFERRED it, `mandatoryDeferredActive` went true and `actionBlockedReason` refused **every** board action with «сначала завершите текущее действие» — about a decision the player had been sent away to make, with a blinking attention chip to match |

Both are one cause, so both have one fix: `ConsoleShell.bonusTurnLive`
short-circuits `startSceneServes` to `false` for the window. `startFrameLive`
falls with it, its own watcher runs `closeWorkspaceRoot('start')`, and the stack
is EMPTY — there is no host to teleport into, no deferred task, nothing to
block anything. Every board surface then behaves correctly **by construction**
rather than by a per-surface exception.

The workspace comes back through the ordinary `startFrameLive` door
(`enterWorkspace('start')`) with every bit of its module state intact
(`consoleStartState` — the picks, the lifetime hold, the journey, the stage
latches). That path is the same one a collapse/restore already uses, so the
re-entrance is not a new lifecycle.

**The latch and its two edges.** `consoleStartState.bonusAct.stage`
(`idle` / `standing` / `onboard`) is MODULE state for the same reason `firstAct`
is — but note the asymmetry: the SCENE sets it (`A` → `onboard`) and the
always-mounted **SHELL** clears it (`bonusActionLedgerOwed` watcher), because
the scene is unmounted for the whole window and could never observe the end of
it. No debounce is needed on that edge and none would be honest: the ledger is
server state that drops only when the action is FULLY resolved.

A page RELOAD does clear the latch, and that is deliberate — re-announcing the
trip after a reload is honest; dropping the player onto a board with no
explanation is not. `bonusActionInStartFlow` (generation 1 + on-board) is what
keeps the workspace alive to do the re-announcing when no lifetime hold survives.

**The corporation's first action pulls the player back**, and should: that
prompt carries a `startGamePrompt` marker, so `bonusActionOnBoard` is false, the
workspace serves it on its own «ПЕРВОЕ ДЕЙСТВИЕ» stage, and the next bonus menu
sends the player out again with no second announcement (they already consented
to the window).

## 4. THE NESTED FIRST ACTION — an explicit SUB-STAGE of the window

Both markers on one prompt (`bonusActionNestedFirstAction`) make the corp's
mandatory move the bonus window's ITEM #1 — but the window does NOT open on it.
It opens on the OVERVIEW (seat = «Фора», the plan, the gains), and the mandatory
move is a sub-stage the player DESCENDS INTO by an explicit press, because a
stage that swaps its own subject uninvited reads as «where am I, and who is
asking» — exactly the confusion the first version shipped.

- **The OVERVIEW comes first.** `firstActionEntryDue` returns FALSE while
  nested — the first-action machine can only be entered through the overview's
  CTA («Перейти к первому действию · внутри этого экрана»,
  `enterBonusSubStage`). The PLAN names the descent before it happens: item 1
  «Обязательное первое действие» wearing the CORP's chip, item 2 the free board
  action — so the press is informed, never a surprise.
- **The descent is a SEAT SWAP** — the workspace's one subject slot changes
  hands on screen: «Фора» settles back into «РАЗЫГРАНО»
  (`runEmbedSourceSettle`) and the corporation emerges into the same seat
  (`runEmbedSourceEmerge`) — the Merger acquisition's swap phrases, reused
  verbatim. `bonusAct.stage` walks `standing → staging → standing`; the CTA is
  withheld during `staging` (a verb the press cannot honour yet is a lie).
- the crumb keeps the WINDOW as its subject — «СТАРТ ПАРТИИ › ФОРА › ПЕРВОЕ
  ДЕЙСТВИЕ» (`deploymentCrumb`'s nested branch), never a jump to «Корпорация»;
- the sub-stage panel wears the MANDATORY chip beside the window's counter
  («» БОНУСНОЕ ДЕЙСТВИЕ 1/2», `.con-start__firstact-bonusctx`) plus one quiet
  explaining line, and hosts the same claimable GAIN rows — the ordering choice
  rides the corp prompt too;
- **B walks back up** (`exitBonusSubStage`): seat swaps back, nothing is
  replayed, every claim already made survives — collapse ≠ close, one level;
- **the ceremony rail is SILENT while nested** (`ceremonyFocusText` /
  `ceremonyStatusText`): the seat and the chips already name the corporation
  and the obligation — the rail repeating them under the panel read as a
  second, stray announcement;
- **the leave re-asserts the room.** `runFirstActionLeave`'s nested branch sets
  `corpDone`, re-seats «Фора» (`ensureBonusSeat`) — and re-runs the room recede:
  the leave's own return brought the queue/dock back while `stageOwnsRoom`
  never blinked, so its watcher had no edge to act on;
- the rail stays on «Бонусные действия» (`deploymentFlowStage` returns
  `bonusAction` while the nested stage is live) and the standalone
  «Первое действие» chapter is ABSORBED (`firstActionAbsorbed` — a chapter the
  player never visits must not exist). A first action that arises AFTER the
  window (Merger acquiring a corporation later) is standalone again and joins
  the rail dynamically, like the Merger corp itself always has;
- `firstActionEntryDue`'s and `firstActionChainQuiet`'s «the deployment's cards
  are through» terms gain the one exception the server's own order creates:
  the nested stage runs WITH the remaining preludes still waiting in the queue
  (they come after the window) — without it the machine either never enters or
  never leaves.

The player's read of the whole window: получил бонусы (обзор: план + получения)
→ A → под-этап = обязательное действие корпорации (источник премиально сменился
на корпорацию) → возврат на обзор «2/2» → A → доска → возврат → второй пролог /
ГОТОВО.

The `.con-start` root carries `data-bonus-stage` / `data-first-stage` (the two
machines' live stages) — testability hooks that made «which machine is stuck,
and in what beat» a one-line probe instead of an afternoon.

## 4b. THE DECLARED CHAPTER — the rail knows before the play

`ClientCard.grantsBonusActions` (exported from the co-located card field, the
`hasFirstAction` pattern) lets the rail declare the bonus chapter the moment
«Фора» is among the PICKED preludes (`bonusActionsDeclaredBy`): picked preludes
WILL be played, so the chapter stands from the deployment's first frame — in
the wizard's future list and in the live rail — instead of popping in mid-flow
and re-numbering its neighbours.

## 4c. The plan, the gains zone, and the focus grammar

**The PLAN (`bonusPlan` → `.con-start__planrow--current/done/next`)** is the
window's own map: numbered rows, the mandatory item wearing the corporation's
chip, ✓ + line-through once done, a mint ring on the current one. It is derived
(the nested marker + `corpDone`), never a parallel state machine.

**The GAINS zone (`.con-start__gains`)** is a visually DISTINCT inset panel
(gold hairline — the card's own reward colour, not the stage's cyan/mint):
caption «С КАРТЫ «ФОРА» — ПОЛУЧИТЕ СЕЙЧАС ИЛИ ПОСЛЕ ДЕЙСТВИЙ» names the source
and the rule in one line; each row = a take-chip («Получить сейчас») + the LIVE
amount + the resource icon; the M€ row adds the FORMULA —
«по 2 M€ за карту в руке · сейчас N» (`BonusActionPromptMeta.gains[].perCardInHand`) —
because the rate is what the player reasons with: play cards during the window
and the claim shrinks, draw and it grows. The tail line says what happens to
whatever is never claimed. Both stage panels (the overview and the nested
sub-stage) host the same zone.

**The focus grammar separates PERFORM from CLAIM**, and it cost four separate
defects to get right — every one of them a way for one press to mean two
things.

- **The cursor is in VISUAL order.** The gain rows are drawn ABOVE the CTA, so
  the cursor indexes them `0..n-1` and the CTA is `n` (`stageCtaIdx`): ↓ walks
  toward the CTA, ↑ toward the first row. It used to be «0 = CTA, 1.. = rows»,
  which made ↓ walk UP the screen and ↑ on the CTA a dead press — from the
  couch that reads as a d-pad that drops inputs, not as an inverted list.
- **No d-pad direction is dead.** The panel is one column, so all four walk it
  (`onNav`): a direction that does nothing is indistinguishable from a lost
  press.
- **HOME IS DERIVED, NEVER SEEDED** (`stageCursor: undefined` → `stageFocusIdx`
  falls back to `stageCtaIdx`). A stored default is only correct if something
  writes it at the right moment, and a panel already standing when the scene
  mounts fires no watcher — so the cursor opened on a GAIN ROW and the bar
  offered «Получить сейчас» to a player who had pressed nothing.
- **EXACTLY ONE «A» IS LIT.** Both the CTA and every row render the glyph
  ALWAYS (`--idle` = `opacity: 0`, box reserved) and only the focused one
  paints it. Two lit A's said both plates answered the same button — which is
  how a claim happened by accident — and a `v-if` glyph re-fitted the row and
  visibly moved the whole shrink-to-fit panel on every focus change. The bar
  relabels A to match («Перейти …» / «Выполнить …» ↔ «Получить сейчас»,
  `stageGainFocused` → `startSceneCommands`), and the gains caption carries a
  quiet `dpad` hint so stepping onto a row is discoverable rather than
  remembered.

A on a row submits that gain's option (`claimStageGain`, latched by
`gainClaimPending`). ⚠️ After a claim the cursor comes home to the CTA — the
remaining row slides into the claimed one's slot, so a repeated A would
otherwise claim a gain the player never pointed at.

## 4c-bis. THE GAINS ARE PHYSICAL — the reward beat (`startBonusGain.ts`)

Every other gain in this console arrives as an OBJECT: a chip emerges from the
thing that produced it, flies to its row in the left panel, and the panel's
delta chip fires **at the touchdown** (`resourceTransfer/*` + the panel reward
hold). «Фора»'s two gains were the exception — the counter simply jumped.
The AUTO-resolve was the worse half: the server grants it inside
`spendBonusAction` while the player is on the BOARD, so on their return the only
evidence the card had ever done anything was a number that had changed while
they were not looking.

**The beat is split ARM/DETECT → SEED → OWE → FLY, because its two halves live
in different frames** (the same seed/run split `consoleHydroMarker` uses):

| step | where | why there |
| --- | --- | --- |
| `noteBonusGainRows(view)` | the shell's `playerView` watcher | the only observer that sees EVERY view, including the first after a reload mid-window. Records the pending set **only from a view that STATES it** — the payment / placement / draw prompts inside a bonus action carry no marker, and reading them as «nothing is pending» forgets the set halfway through the very action whose end resolves it. An EMPTY list on a MARKED prompt is real information. |
| `armBonusGainClaim(row, source, point)` | `claimStageGain`, at the press | the pressed ROW is the honest origin of a claim, and the response that grants the gain also ANSWERS the prompt — so the row is gone by the time the chip could fly. Its centre is measured while it is still there. |
| `seedBonusGainRewardHold(before, after)` | the transport's `seedRewardHolds` | the panel renders `committed − held`, so a hold seeded even one micro-task early flushes a phantom −N chip the commit undoes. This is the ONE seeder that needs BOTH views. |
| `bonusGainWaveDue` → `runBonusGainWave()` | `ConsoleStartScene` | the flight needs a workspace ON SCREEN with the card standing where chips can come out of it. |

**THE AMOUNT IS NEVER GUESSED.** A claim carries the server's own row amount.
The auto-resolve recomputes exactly as `Player.bonusGainAmount` does — steel is
the printed constant, M€ is `perCardInHand × the hand as it stands` — and «as it
stands» is the COMMITTED view's hand, because resolving a gain does not touch
the hand. Taking the amount off the older prompt would print a different number
from the one the player received, which is the whole strategic point of the
choice the card offers (draw and the M€ grow, play and they shrink).

**Two traps this beat paid for, both general:**

1. ⚠️ **A watcher that must fire on a MOUNT may not be `immediate`.** The
   auto-resolve is seeded while the scene does not exist, so its edge IS the
   scene's mount — and an `immediate` handler runs at SETUP, before there is any
   DOM to fly out of. The wave measured nothing, degraded to «no flight» and
   CONSUMED the very reward it existed to show. The mount edge is asked from
   `mounted()` (`runBonusGainWaveIfDue`), where the shelf is already rendered;
   the watcher covers only the later rise.
2. **A claim answered by the CLOSING response never pays twice.** Pressing
   «Получить сейчас» on the same response that spends the last action means the
   auto-resolve is what actually pays; holding the claim's amount as well would
   leave the panel short by it for the hold's whole life.

Readiness differs by half, and that is why the beat waits for a surface at all:
a CLAIM carries its captured point and only needs the deployment on screen; the
AUTO-resolve emerges from the granting card in «РАЗЫГРАНО», so it waits for
the shelf to have come BACK (`!playedDockReleased`) — flying out of a receded,
transparent shelf would put the origin somewhere the player cannot see. The hold
carries a bounded backstop (`BONUS_GAIN_HOLD_SAFETY_MS`): a surface that never
comes must not leave the rail reading a stale number for the rest of the game.

## 4d. The journey rail, and the one thing a progress readout may never do

The rail gains a CONDITIONAL chapter, `Bonus actions`, between the preludes and
the first action. It cannot be declared in advance the way a corporation's
first action can (which prelude the player draws is unknown until it is played),
so it JOINS the rail when the grant happens and STAYS, completed, afterwards
(`bonusActionSeen`).

**A rail may not move backwards.** The first version zeroed `preludesLeft`
whenever the bonus owned the flow stage, so the rail ticked «ПРОЛОГИ ✓» while a
prelude was still in the player's hand — and took the ✓ back two presses later.
Two changes fix it, and both are the point of the chapter:

- `preludesLeft` is the HONEST remaining count whatever owns the flow stage;
- while bonuses are pending the prelude chapter reads **`available`** —
  *started, but not where you are* — so exactly ONE chapter is `current`.

The rail then reads `✓КОРПОРАЦИЯ → ✓ПРОЕКТЫ → ③ПРОЛОГИ → ④БОНУСНЫЕ ДЕЙСТВИЯ →
⑤ГОТОВО` during the bonus and
`… → ③ПРОЛОГИ → ✓БОНУСНЫЕ ДЕЙСТВИЯ → …` when the player comes back — one
forward walk, no ✓ ever withdrawn.

**The stage owns the room — but «РАЗЫГРАНО» IS NOT PART OF THE ROOM.**

The QUEUE recedes (the plate is centred and would otherwise cross the remaining
prelude's card): the descend phrase, one derived bit → one pair of phrases
(`stageOwnsRoom` → `runQueueRelease` / `runQueueReturn`).

The SHELF stays. It used to recede with the queue, and that made every seat
motion end in nothing: the seated card EMERGES from «РАЗЫГРАНО» and SETTLES
back into it — and inside the bonus window it does BOTH AGAIN for the
corporation swap — so a receded shelf is a card shrinking toward a place the
player cannot see («свап карты происходит в пустоту»). `shelfOnStage`
(`stageOwnsRoom && !embedPresenting`) drives two things that therefore cannot
disagree:

- **the shelf TUCKS instead of leaving** (`.con-start--shelfstage`): the band
  caps at `--con-start-shelf-peek` (9rem) with the stacks aligned to its TOP,
  so names and art stay readable and an inner bottom shadow says the cards
  continue below the edge. Not transitioned — `max-height` is layout, and the
  change always happens under a bigger motion (the queue's recede, the seat's
  rise);
- **the stage's zone STOPS at that band** (`.con-start__embed--shelfstage`
  sets `bottom`), so the seat and its plate lay out ABOVE the shelf rather
  than over it. Both stage panels are `top: 50%` inside that zone, so one
  declaration re-centres the whole stage.

An embedded STEP (a reveal, a deck pick) still takes the WHOLE room — it needs
every pixel and nothing is flying to the shelf during it — through its own
phrase (`embedPresenting` / `embedActive` watchers). The restore pose
(`poseRoomReceded`) poses the QUEUE only, so a stage that comes back from a
collapse finds its shelf exactly where it belongs.

The result is that the swap is legible IN THE SHELF: on the overview the
prelude's place stands empty (its card is seated) while the corporation lies in
its own; in the sub-stage the two have traded. That exchange is what the e2e
asserts, and the stage's bottom edge is asserted to clear the shelf band.

---

## 5. Why «Пас» and «Пропустить ход» are refused with a sentence

The server does not offer them, so the LT wheel would have fallen back to its
generic gate: «Сейчас недоступно» on Pass and «Доступно после первого действия в
этом ходу» on Skip turn — both arithmetic about a state the player is not in,
over a menu that is plainly live and whose every other verb works.

`LtQuickContext.turnControlReason` is a reason that outranks those two verbs'
own — and ONLY those two: standard projects, the conversions and the hand stay
exactly as they were. The precedence is the same law `turnGate` already
follows: a SET-ASIDE decision (`blockedReason`) still outranks it, because the
one honest answer to «why will the game not move» is the decision the player
parked, not a rule about a verb they were not going to press.

The sentence itself lives in `bonusAction.ts`
(`BONUS_ACTION_TURN_CONTROL_REASON`) and names the RULE:
«Сначала потратьте бонусные действия — пас и завершение хода во время них
недоступны». The briefing states the same rule before the player ever meets the
refusal, so the wheel confirms something they were told rather than surprising
them.

---

## 6. The player chip — on EVERY seat

`game.phase` is PRELUDES while the bonuses are spent, so the phase-derived
«ФАЗА ПРОЛОГОВ» would describe the wrong thing — including to an OPPONENT, who
sees the board change and needs to know why. So:

- `detectWaitingForKind` returns `'bonusaction'` **structurally** (the marker,
  checked before the title walk), and it is computed for every player's public
  model — so opponents get it for free;
- `PublicPlayerModel.bonusActions` / `.bonusActionsGranted` are public, which is
  what lets the chip carry a counter;
- `ActionLabel` gains `'bonusaction'` → the presenter renders the same premium
  ACTIVE pose as a real turn (it IS the player acting on the board) with its own
  label and its own counter.

**The counter counts the BONUSES.** `statusCounterText` is ONE derivation shared
by the console chip row and the desktop player card: during the prelude phase
`actionsTakenThisRound` is counting PRELUDES PLAYED, so the ordinary derivation
would print «2/2» on the player's FIRST bonus action.

---

## 7. Guards

| Spec | What it holds |
| --- | --- |
| `tests/cards/promo/HeadStart.spec.ts` | grants-everything-executes-nothing; claim options + marker rows; M€ at CLAIM time; auto-resolve at the window's end; the NESTED corp prompt (both markers, gains riding it, spend order); both prelude orders; no Pass / End Turn (#5852); serialization incl. pending gains |
| `tests/client/components/console/bonusAction.spec.ts` | the marker is the only discriminator; the 1/2 → 2/2 readout; owed ≠ on-board; the start-flow term |
| `tests/client/components/console/startBoardExcursion.spec.ts` | a bonus action is explicitly NOT one of the barrier's causes (an action menu still means the deployment is over) |
| `tests/client/components/console/consoleStartState.spec.ts` | the conditional chapter, its `available` prelude state, the crumb |
| `tests/client/components/console/consoleStartUi.spec.ts` | the CTA names the destination; the stage outranks the first-action stage |
| `tests/client/components/console/consoleQuickModel.spec.ts` | only the two turn-control slots are blocked, they name the rule, a parked decision still outranks it |
| `tests/client/components/overview/bonusActionStatus.spec.ts` | the label on every seat + the counter that counts bonuses |
| `tests/e2e/console-first-action-draw.spec.ts` | the shelf's half of the same contract on the ORDINARY first-action stage: it stays painted under the briefing with the corp's place empty, the briefing clears its band, and the room still comes back for the drawn candidates |
| `tests/client/components/console/startBonusGain.spec.ts` | the reward beat: what a marked prompt does (and an unmarked one does not) to the pending set, the falling-edge detection, the M€ recomputed off the COMMITTED hand, the claim + close collision, the source-selector order |
| `tests/e2e/console-bonus-action-handoff.spec.ts` | the whole flow on a real board: announce (+ the steel claimed EARLY, no action spent, **flying to the panel with the row held at its pre-gain reading**) → A → the workspace is GONE → the hand as its own screen → the wheel refuses only the turn-control verbs → both bonuses → the return → the unclaimed M€ auto-resolved **and seen to arrive, out of «Фора»** |
| `tests/e2e/console-bonus-nested-first-action.spec.ts` | the nested case: both markers (+ the M€ rate) on the wire, the OVERVIEW first (plan with the corp chip, current item), the cursor's VISUAL order (↑ lands on the row nearest the CTA) with exactly one lit «A» and a panel box that does not move, the SHELF standing under the stage with the seat's place empty in it, a gain claimed ON the corp prompt costing no action, the cursor home after it, A descends (seat swaps to the corp, 1/2 chip, crumb keeps «Фора»), B walks back up with the claim intact, the rail without a standalone first-action chapter |

⚠️ **An e2e may not spend the viewer's own bonus over the API.** The client
deliberately refuses a poll-driven refresh while the VIEWER holds a prompt
(partial input must survive — `WaitingFor.vue`'s `viewerHasPrompt`), so
answering this player's prompt from another HTTP client leaves the browser
looking at a state the server left minutes ago. Drive it from the page.
