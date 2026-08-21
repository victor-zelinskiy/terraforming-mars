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
player a real action menu once per bonus.

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

**The corporation's mandatory first action spends a bonus too.** It is, by its
own wording, the player's first action of the game, so `takeAction` offers the
`corporationInitialAction` prompt in place of a bonus menu (pass suppressed) and
`spendBonusAction()` runs in its callback. That prompt keeps its own marker and
its own workspace stage — see §4.

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

The client model is `src/client/console/bonusAction.ts`, and it answers **two
different questions** that must never be conflated:

| Function | Question | Consumers |
| --- | --- | --- |
| `bonusActionOwed(view)` | is a bonus outstanding at all? | the status chip, the withheld turn-control verbs |
| `bonusActionOnBoard(view)` | does the player have to GO TO THE BOARD for it? | the workspace stage, the excursion barrier |

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

## 3. The console flow — announce → hand off → return

```
  ПРОЛОГИ            «Фора» is played, the grant lands
     │
     ▼
  СТАРТ ПАРТИИ › ФОРА › ДЕЙСТВИЕ      the BRIEFING stands inside the workspace
     │                                 (kicker + 1/2, the ask, the two notes,
     │                                  A «Перейти к полю · вы вернётесь сюда»)
     │  A
     ▼
  the board                            the workspace COLLAPSES (mounted, hidden)
     │                                 the wheel/hand/std projects are all live
     │  ×2
     ▼
  СТАРТ ПАРТИИ › ПРОЛОГИ › РОЗЫГРЫШ   the workspace RETURNS, exactly once
```

**The announcement is not decoration.** The alternative — the board simply
appearing — was rejected for the same reason `startBoardExcursion` exists at
all: a workspace that hands the screen away without saying so reads as CLOSED,
and the player then treats the preparation as over. So the stage does exactly
two things: it names what was granted and how much is left, and it says where
the next press goes (`Go to the board`, never «Выполнить» — the press performs
nothing, it MOVES the player) **plus the promise that they will come back**.

**The hand-off is the excursion barrier's second cause.**
`startBoardExcursion.ts` already existed for board PLACEMENTS; a bonus action is
the same shape one level larger. The difference is only WHO opens it: a
placement yields the moment the server asks for a space, a bonus yields on the
PLAYER'S CONSENT (`consoleStartState.bonusAct.stage === 'onboard'`, set by A).

**The barrier's release** reads `bonusActionOnBoard`, raw and ungated, exactly
like `placementAsked`: it must hold across the response gap BETWEEN two
consecutive bonus actions, where the task kind is momentarily undefined and
every visual signal is quiet — without it the workspace flashes back in for a
frame between them. `actionMenu` stays out of `EXCURSION_BLOCKING_KINDS` (a
plain action menu still means the deployment is over); the bonus is counted by
its own signal.

**Module state, not component state.** `consoleStartState.bonusAct` (`idle` /
`standing` / `onboard`) lives beside `firstAct` for the same reason: the
workspace UNMOUNTS on a collapse, so a latch in the component would re-announce
a trip the player already confirmed, over a board they are already acting on.
A page RELOAD does clear it, and that is deliberate — re-announcing after a
reload is honest; dropping the player onto a board with no explanation is not.

---

## 4. The journey rail, and the one thing a progress readout may never do

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

**The stage owns the room.** While the briefing stands, `.con-start--bonusroom`
recedes the deployment QUEUE to `opacity: .16` (the briefing is centred and
would otherwise cross the remaining prelude's card). Deliberately an opacity
recede and not the first-action stage's GSAP pose: nothing moves, every rect
stays measurable for the flights that resume the moment the workspace returns,
and the beat is one press long. «РАЗЫГРАНО» keeps its light — the plate does not
reach it, and it is the record of what the player has already done.

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
| `tests/cards/promo/HeadStart.spec.ts` | 2 bonuses in BOTH prelude orders; the turn's own slots untouched; no Pass / End Turn + the marker; no one can pass out of the prelude phase (#5852); serialization incl. the pre-feature save |
| `tests/client/components/console/bonusAction.spec.ts` | the marker is the only discriminator; the 1/2 → 2/2 readout; owed ≠ on-board; the start-flow term |
| `tests/client/components/console/startBoardExcursion.spec.ts` | an owed bonus holds the barrier through the quiet gap between two bonuses; the last one releases it |
| `tests/client/components/console/consoleStartState.spec.ts` | the conditional chapter, its `available` prelude state, the crumb |
| `tests/client/components/console/consoleStartUi.spec.ts` | the CTA names the destination; the stage outranks the first-action stage |
| `tests/client/components/console/consoleQuickModel.spec.ts` | only the two turn-control slots are blocked, they name the rule, a parked decision still outranks it |
| `tests/client/components/overview/bonusActionStatus.spec.ts` | the label on every seat + the counter that counts bonuses |
| `tests/e2e/console-bonus-action-handoff.spec.ts` | the whole flow on a real board: announce → A → collapse → the wheel's refusal → both bonuses → the workspace returns |

⚠️ **An e2e may not spend the viewer's own bonus over the API.** The client
deliberately refuses a poll-driven refresh while the VIEWER holds a prompt
(partial input must survive — `WaitingFor.vue`'s `viewerHasPrompt`), so
answering this player's prompt from another HTTP client leaves the browser
looking at a state the server left minutes ago. Drive it from the page.
