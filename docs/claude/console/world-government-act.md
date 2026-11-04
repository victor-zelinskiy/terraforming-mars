# THE WORLD GOVERNMENT'S ACT — two hosts of one question, one fact beside the engine's flag

**Status.** Shipped 2026-11-05 with P67 World Government Advisor (ledgers GL · GM, PL-1815…1824; commits `b689bc51fd`,
`5a5768397d`). The one source of truth for «a player acts as the World Government»: who asks the question, how the
console hosts it, what is paid and what is not, and how the client tells the borrowed SOLAR from the generation's.

## 1 · One question, three askers — read by its MARKER

`Game.worldGovernmentTerraformingInput(player, asker)` builds the government's question (one option per parameter it may
still raise, every option `annotate`d with its `GlobalParameter`; Ares extreme solo adds the hazard removal; the Moon's
options are outside the premium scope). `OrOptions.worldGovernmentPrompt` (serialized on its own `toModel` —
nesting-safe) says who asks:

| asker | when | the console |
| --- | --- | --- |
| `{source: 'solar-phase'}` | the generation's own step (end of generation; the Redux first player's debt) | the «Поддержка правительства» dialog (`choice/wgt` → `ConsoleGovernmentSupport`) |
| `{source: 'card', card}` | a card's ACTION (World Government Advisor) | normally never asked live: the action's composer pre-collects the answer (§ 3); the fallback (reload, API) is the card's contextual choice, hosted by the flow that asked — never the solar phase's dialog |
| `{source: 'colony', colony}` | a colony's bonus (Terra — module `community`, outside the scope) | the colony's contextual choice |

The title is never read — neither by the router (`consoleTaskRouter`), the transport's scale hold, nor the server's
seat classification (`ServerModel` — only `solar-phase` is «globalsupport»). A card's question is addressed to the card
(`choiceContext`), which is what lets a pre-collected answer land on it (`promptAddressOf`). The ocean option names its
source and is committed («The World Government is already acting»).

## 2 · The borrowed SOLAR and the FACT beside it

`Game.temporarySolarPhase(player, cb, asker)` flips `phase` to SOLAR — the engine's SUPPRESSION flag — runs the callback,
and defers the restore at `BACK_OF_THE_LINE`. With an asker it publishes **`GameModel.worldGovernmentAct {player,
asker}`** for exactly as long as the borrowed phase stands: the question and every placement it sets off (the 0 °C
ocean included); the restore clears it. `phase` stays the engine's truth — the fact is a separate field.

**The client reads the generation's phase through ONE helper**, `generationPhaseOf(game)`
(`src/common/game/generationPhase.ts`): `ACTION` while the act stands, `phase` otherwise. Readers:

| reader | reads |
| --- | --- |
| `playerLabels` (the seat's «ходит» / bot-turn label) · `TurnHandoffLayer` (the hand-off owner) · `ConsoleShell.viewerAskedOffTurn` | the generation's phase → the helper |
| `scaleStepRatingBeat` | the ENGINE's flag, raw — in SOLAR a scale step pays no rating, so the beat stays silent (true of the act too) |
| `ConsoleAdminRollback` | a SAVE's phase, raw — no save is taken inside the act |

Guard: `tests/console/generationPhaseGuard.spec.ts` — any other client comparison with `Phase.ACTION` / `Phase.SOLAR` is
red; the two raw readers stand in its allow-list with these reasons.

**No save inside the act** (A10): `Player.takeAction` saves only after the deferred queue — the restore included — has
drained. Pinned by `WorldGovernmentAdvisor.spec` § A10; the field is not serialized (`Game.spec` lists it).

## 3 · The card's action: the choice BEFORE the press

The action preview IS the live question — the card's `actionPreview` builds its branches from the same
`worldGovernmentTerraformingInput(player, {source: 'card'})`, read-only (the options act in `andThen`):

- one branch per printed parameter in the PRINTED order (ocean · oxygen · temperature · Venus — Venus only with Venus
  Next), every branch on the ONE printed action row (`renderKey` '0' → one tile in «ДЕЙСТВИЯ КАРТ», the choice inside
  as the variant tiles); the branch's `index` is its option's LIVE position, so the batch replays byte for byte;
- a parameter the engine no longer offers is SHOWN refused with its reason (`parameterMaxed`'s words);
- everything maxed → one empty branch, the action legal, the futility verdict «Every global parameter is at its maximum»;
- the ocean's cell is a STAGED pick before the press — `StagedPlacementModel.nestedInBranch` (the cell becomes the
  response of the batch's branch pick: `{type: 'or', index, response: {type: 'space', spaceId}}` — `nestCellInBranchPick`)
  and `government` (§ 5).

## 4 · What is paid, and what is not — `ActionEffect.world`

Every chip of a branch is a World Government move (`world: true`). By the engine's SOLAR gates (`Game.increase*`,
`addOcean`, `addTile`):

| | paid? | in the preview |
| --- | --- | --- |
| the rating of the step; the Greens / a party; RX42 veto; P57 skip; P63 / P64 / P65 / Lotus | no | no implied TR chip; the passes and the party / rating forecast skip a world branch (`isWorldGovernmentMove`) |
| RX35's replacement | no (asked only outside SOLAR) | the diversion pass skips a world branch |
| −24 / −20 °C heat production · Venus 8 % card · Venus 16 % TR · the alternative Venus board's bonus · a cell's printed bonus and ocean adjacency | no | the chip's note names it («без производства тепла», «без бонусной карты», «без бонусного РТ», «без бонуса Венеры», «без бонуса клетки») |
| the 0 °C ocean · the 8 % oxygen's temperature step | YES — for nobody | a chip of its own, `world` too («бонусный океан», «бонусный шаг») |
| a card answering ANY raise (Aphrodite, Venusian Census — a rival's too) | YES (`globalParameterRaised` is outside the reward gate) | the forecast's «сработает» on that branch |
| a tile's `onTilePlaced` reactors (Arctic Algae…) | YES (not gated by SOLAR) | the tile pass |
| the last Martian step | the game ends with the generation | the branch's note «Последний шаг: Марс терраформирован» |

A plain step carries no note: «as the World Government, no TR» is the card's own rule line above the tiles (a note
repeating it on every chip overflowed the four tiles at 4K).

## 5 · The cell dossier in the government's mode

`boardCellPreview(…, {government: true})` (route `?government=1`) reads the cell through `governmentActs(game)` —
`phase === SOLAR` OR the government reading scope — so the staged pick, made in the action phase, promises no printed
bonus, no ocean adjacency, no rating and no party answer. The same predicate made the dossier of the REAL solar phase
honest: it used to promise the printed bonus `Game.addTile` never pays in SOLAR. The client sends it from the staged
prompt's `governmentPlacement` (`fetchBoardCellPreview`'s last argument, part of the cache key).

## 6 · Witnesses and gaps

`tests/cards/prelude2/WorldGovernmentAdvisor.spec.ts` (the upstream block byte for byte + the fork's 13),
`generationPhaseGuard.spec`, `stagedNestedCell.spec`, `consoleTaskRouter.spec` 2c–2e; e2e
`console-world-government-advisor` (B · C · D · E, tv4k). Gaps: ledger PL-1824 — the dialog's model still matches the
options by their English titles; the Moon; the Redux doors pinned by unit, not by a stand; no «ПАРАМЕТР» crumb stage;
the live fallback is the card's contextual choice, not the same step surface; no storyboard / start / last-step /
second-screen stands.
