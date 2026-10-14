# Console — the FINAL GREENERY is played ON THE BOARD

The endgame beat where a player turns leftover plants into greeneries, one at a
time, until they choose to stop. Since 2026-10-14 (the owner's decision, ledger
section AH — PL-295 / PL-296) it has **no surface of its own**: the board is the
finale. Pure model `src/client/console/finalGreenery/finalGreeneryModel.ts`; the
dossier block lives in `ConsoleContextPanel` (`finale` prop, `[data-finale-bank]`,
styles `console_final_greenery.less`); the loop lives in `ConsoleShell`.

**What a final greenery is worth depends on the ruleset** (the dossier names the
yield per cell): classic, 1 VP for the tile at the count; Turmoil Redux (project
decision Q-3), +1 TR for the tile itself through `Game.addGreenery` →
`ParliamentHandler.onGreeneryPlaced`, no oxygen (it is maxed by then), no VP.

## Why it left its dialog

It used to be a small dialog over a dimmed planet («Превратить растения в
озеленения?» + three numbers + two rows), then the board for the cell, then the
dialog again — one screen change per tile, and the planet the phase is ABOUT
hidden behind glass every time the player came back to it (the owner, on the TV:
«непремиально и некрасиво»). Now:

1. **The announce** (the mandatory gate — the player was idle through production,
   a stray press must not land anywhere) reads the PHASE: «Конец партии ·
   Финальное озеленение · A Разместить озеленение» (`consoleTaskSummary` — keyed on
   the server's `finalGreeneryPrompt` marker, never the title).
2. **A puts the board straight into placement** (`openFinalGreeneryOnBoard` → the
   ordinary nested-space hand-off `taskSpacePending`). The dossier's kicker is
   «Конец партии», its formula the exchange `8 🌱 → 1 [greenery]`, and under the
   identity stands the FINALE BLOCK — constant for the whole pick (it reads the
   stock, never the focused cell, so it never moves while the player points):
   the plant stock as OBJECTS (`finalGreeneryBank`: one greenery hex per tile the
   plants still pay for, the board's own greenery art; the rest as a hex filled
   `have / need`; a huge stock capped with «+N»), «Хватит на N» and, quieter, what
   finishing now burns. No controller prompt in the block (the dossier's law).
3. **After a landing the board simply stays in placement.** The server asks
   again; the commit hold `finalGreeneryCommitting` keeps the loop off until the
   answer has landed and the landing hero holds the foreground, then the
   `finalGreeneryActive` watcher (`flush: 'post'`) hands the next pick to the
   board — no dialog, no announce in between. A reload mid-finale is caught by the
   mount edge (`mounted()` asks the same handler).
4. **B minimizes** (`deferFinalGreenery`): the pick is dropped (nothing was sent),
   `task.deferred` is set, the board home's plate («Вернуться к финальному
   озеленению») brings it back with A. Any other cancel of the finale's pick (the
   board binder's own) is the same minimize — there is no screen behind it to
   cancel back to.
5. **The stop is a HOLD of RT** (`beginFinalGreeneryFinish` → the shared
   `consoleHoldConfirm`, key `final-greenery-finish` — the gesture «Пас» uses):
   the bar's `finalGreeneryFinishCommand()` (`hold: true`, `tone: 'danger'`,
   `priority: 0` — never dropped by the fit) draws the ring; a tap does nothing;
   letting go is a safe cancel; only at the cell-choice level (a LOCKED cell is a
   placement in progress — B steps back first). RT is the finish here, never the
   actions wheel. On completion `finishFinalGreenery` drops the pick, holds the
   loop and submits the «I am done» branch (`orOptionResponse(stopIndex)`).

The finale's numbers read the RAW prompt while the pick is out
(`finalGreeneryRawVm`) — the host's admission may blink (a bot card's flow hold,
a landing), and the stock and the finish verb must not blink with it; the
ADMITTED read (`finalGreeneryVm`) decides only when the finale may open.

## The marker

`Player.takeActionForFinalGreenery` calls `action.markFinalGreeneryPrompt({spaces})`
(`src/server/Player.ts`). `FinalGreeneryPromptMeta` carries ONLY what the client
cannot derive — the board's remaining legal spaces. Plants and
`plantsNeededForGreenery` (the discount-aware cost) ride the public player model.
Serialized in `ServerModel.getWaitingFor` — correct because this prompt is always
TOP-LEVEL. The two branches are told apart by TYPE (`space` → place, `option` →
stop), never by title.

## Guards

- `tests/client/components/console/finalGreeneryModel.spec.ts` — marker, branch
  types, the arithmetic, the bank as objects (cap / rest), the finish command,
  and the placement bar's finale branch (B = «Свернуть», RT hold only at the
  cell-choice level).
- `tests/inputs/finalGreeneryPrompt.spec.ts` — marker + serialization.
- e2e `tests/e2e/console-final-greenery.spec.ts` (fhd + tv4k) — announce → the
  board in placement with the bank (the server's plants ÷ cost); a landing → the
  board back in placement by itself; B → the plate; A → back; a TAP of RT finishes
  nothing; a HOLD finishes (the server's prompt is gone).
- The endgame journeys drive it through `consoleEndgameHarness.finishFinaleThroughPage`
  (`openFinaleOnBoard` + `holdFinishFinale`).

## B never yanks a minimized task back from another screen

`handleSectionBack` used to restore a deferred task as its FIRST branch. The
restore now sits after the section-close branches: in a section B closes that
section; on the board home B (or A on the `.con-mandatory` card) brings the task
back. Console-wide, not finale-specific.

## Reproducing it locally

The fixture `two-player-pre-endgame` (`fixtureTable`) + an API drive to the
viewer's question is the cheap route (the e2e does exactly that, the viewer
passing so the stock stays whole). A stand with the bot at the table and the
other seat moving while the console is open: `screenshots/stall/` (outside git).
