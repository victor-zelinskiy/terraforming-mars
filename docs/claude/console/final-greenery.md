# Console — the FINAL GREENERY screen

The endgame beat where a player turns leftover plants into greeneries, one at a
time, until they choose to stop. Console-native surface `ConsoleFinalGreenery.vue`
(`.con-finale`), pure model `src/client/console/finalGreenery/finalGreeneryModel.ts`.

## Why it is not just another optional decision

Structurally this prompt is an ordinary two-branch `OrOptions` and the console
used to render it as exactly that — two calm rows, «Выберите место на поле →»
and «Не размещать озеленение». The second row is **not** a decline: it calls
`playerIsDoneWithGame` and ENDS THAT PLAYER'S GAME, irreversibly, while their
remaining plants are still worth victory points.

`ConsoleEffectDecision` teaches the player that the quiet card at the bottom of
a decision screen is a harmless "no thanks". Reusing it here would teach the
most expensive misclick in the match. So the finale gets its own screen where

* the conversion is the live, green, repeatable offer;
* finishing is red-amber, explained, and **commits only on a second press** —
  the armed state says out loud what the next press does;
* moving the d-pad away always disarms.

Nothing is dimmed to signal danger (dim reads as "unavailable"); colour and
wording carry it, and both are `box-shadow` / text so `con-perf-lite` cannot
strip the warning away. The command bar's armed line uses the new
`ConsoleCommand.tone: 'danger'` (red) instead of `highlight` — the bar's mint
highlight means "claimable, go ahead", which is the one thing a destructive
confirm must never say.

## The marker

`Player.takeActionForFinalGreenery` calls `action.markFinalGreeneryPrompt({spaces})`
(`src/server/Player.ts`). `FinalGreeneryPromptMeta` carries ONLY what the client
cannot derive — the board's remaining legal spaces. Plants and
`plantsNeededForGreenery` (the discount-aware cost) already ride the public
player model and are read there.

Serialized in `ServerModel.getWaitingFor` — correct here because this prompt is
always TOP-LEVEL (contrast `discardPrompt`, which rides `SelectCard.toModel()`
because a discard is routinely nested).

The two branches are told apart by **TYPE** (`space` → place, `option` → stop),
never by title. Specs: `tests/inputs/finalGreeneryPrompt.spec.ts` (marker +
serialization) and `tests/client/components/console/finalGreeneryModel.spec.ts`
(the two-press contract, the arithmetic, the pad).

## Flow

1. The prompt arrives ANNOUNCED — the mandatory gate (`consoleMandatoryGate`)
   shows «Выполнить финальное озеленение · A Открыть». That is deliberate: the
   player was idle through the production phase and a stray press must not land
   on this screen.
2. `A` on «Разместить озеленение» emits `space-pick` → `taskSpacePending` →
   the BOARD serves the placement (`setConsoleTaskSpacePlacement` keeps the leak
   detector quiet; there is no registrable selector for an always-mounted
   surface). `B` there cancels and the finale re-mounts.
3. After each placement the server asks again; the surface re-mounts fresh, so
   focus returns to «Разместить» and any arming is dropped.

   **The commit window is held** (`finalGreeneryCommitting`). The board releases
   the pick the instant the cell is confirmed, but `waitingFor` still holds the
   finale prompt for the whole round-trip — so without the hold the screen
   re-mounts immediately and BLINKS over the greenery's landing animation (the
   placement hero only takes the foreground once the answer arrives). The hold
   is released one tick after the next response, which is the frame by which the
   hero is armed. Set in `onFinalGreenerySpacePick` → `onTaskSpacePicked`.
4. `A` twice on «Завершить свою партию» submits the leaf → `playerIsDoneWithGame`.
5. `B` defers (minimize to look at the board) like every other mandatory task.
   A deferred task is reachable again **only from the board home** — see below.

## B never yanks a minimized task back from another screen

`handleSectionBack` used to restore a deferred task as its FIRST branch, as a
global fallback. That made `B` inside any other section (the hand, colonies,
hydro) re-open the minimized prompt instead of closing the screen the player was
looking at — the moment anything was deferred, `B` stopped meaning "one calm step
back". The restore now sits after the section-close branches, so:

* in a section → `B` closes that section (board home);
* on the board home → `B` (or `A` on the `.con-mandatory` card, which only
  renders there) brings the task back;
* the inspection modes stay BELOW the restore, because "minimize to look at the
  board" is exactly what deferring is for.

This is console-wide, not finale-specific.

## Reproducing it locally

There is no cheap in-game route — the beat needs a terraformed Mars, a player
holding plants, and the production phase behind them. Build a save directly:

* `Game.newInstance(...)`, then **wait ~2 s** — `newInstance`'s own save is async
  and fire-and-forget, and will UPSERT over yours at the same `save_id`;
* max temperature/oxygen/oceans, give the viewer plants;
* `game.phase = Phase.PRODUCTION` **and `game.generation > 1`** — deserialize's
  "nobody has played a corporation yet" proxy (`generation === 1`) bounces the
  save back to `gotoInitialResearchPhase()` and you get the initial-cards prompt
  instead;
* bump `lastSaveId` above anything the server will write, then `saveGame`;
* restart the server (`GameLoader` caches the participant list at startup, so a
  game added underneath it 404s until it restarts).

On load, `Game.deserialize` sees `PRODUCTION && gameIsOver() &&
isDoneWithFinalProduction()` and calls `takeNextFinalGreeneryAction()`.
