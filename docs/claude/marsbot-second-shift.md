# «ВТОРАЯ СМЕНА» — the bot's late-game pace rule

**Status: SHIPPED 2026-10-28** (the owner's decision after the box campaign with the Manutech holding). Contract + data + surfaces. The rule itself: `src/common/automa/SecondShift.ts`; the server half: `src/server/automa/SecondShift.ts`; guard: `tests/automa/SecondShift.spec.ts`.

## The problem (measured, not felt)

The bot's action deck is rebuilt every generation by the rulebook (`AutomaResearch.buildActionDeck`: 3 project cards, 4 on Brutal, +1 for 5 floaters, plus the top bonus and the recurring cards) — a **constant 6–7 actions** whatever the generation. A human engine in Turmoil Redux runs 12–15 turns a generation from the 7th on. Measured on the owner's **25 finished Redux games** (`C:\Projects\Mods\tm-real-games\redux-full`):

- from generation 7 the bot takes **about a third** of the best human's actions;
- it **passes FIRST in 75–91 %** of the late generations, then sits out while the humans keep building;
- its tracks therefore stall exactly when the dividend clauses need them — Manutech's third mark (#15) was reached by **0.2 tracks per game**.

A dividend recalibration alone would only lower the bar; the owner's point was that the bot should **stay in a long generation**, not be paid more for leaving it.

## The rule

> While at least one player is still acting in the generation, MarsBot does not pass when its action deck runs out: it draws an extra project card off the project deck and resolves it exactly as any other action card — up to the difficulty's cap per generation.

| Difficulty | Cap per generation |
| --- | --- |
| Easy | 0 (the rule is off) |
| Normal | 1 |
| Hard | 2 |
| Brutal | 3 |

Nothing changes in a generation the bot outlasts (the first four, every short game, every generation where the humans pass first): the trigger is the bot's EMPTY deck while a human is still in the round. A player who passed is not «acting»; the bot itself never counts. When no project card is left to draw, the bot passes.

### The switch (`AutomaOptions.secondShift`)

- **Engine default OFF when the option is absent** — every pre-rule save, fixture and spec keeps its exact behaviour.
- **The creator defaults ON for a new game**: `PremiumCreateGameState.botSecondShift` (persisted; a blob saved before the rule restores ON), sent as `automa.secondShift` by `buildCreateGamePayload`. The console creator shows it as the «Вторая смена» stepper beside the difficulty in the bot editor (◄/► and A flip it; the note under the editor reads the cap for the chosen difficulty, or that Easy has none, or that the rule is off); the crew row names «Вторая смена» only when it can fire (on AND cap > 0).
- A campaign inherits it through its stored `NewGameConfig` — `CampaignManager` spreads `gameOptions.automa` when it sets the corporation and the portfolio, so the switch travels with the difficulty.

## Where it shows

| Surface | What |
| --- | --- |
| The engine | `AutomaController.resolveTurn`: the ONE place the bot would pass asks `SecondShift.take(game)` first — the card goes INTO the action deck, so the turn runs the ordinary project branch (journal «played», the corporation's hook, the human reactors, the lobbying rider, the played pile). |
| State | `AutomaState.secondShift: {generation, drawn}` (serialized; optional on old saves). |
| Journal | `SECOND_SHIFT_LOG` — «${bot} остаётся в поколении, пока игроки ходят — дополнительная карта N из M». |
| Turn script | step `{kind: 'second-shift', index, cap, message}` BEFORE the `reveal`; consumed-log family. |
| Turn review | `BotTurnReview.secondShift` → the amber chip «Вторая смена — дополнительная карта N из M» over the card strip (`.mbr__shift`). |
| Model | `MarsBotModel.secondShift: {cap, drawn}` — present only while the rule is enabled for the game. |
| Bot screen | the hub's DECKS plate: the action deck's OWN paragraph tells the rule with the difficulty's cap (`marsBotGuide.ts`, ctx `secondShiftCap` → `SECOND_SHIFT_DECK_KEY`) — it REPLACES the rulebook's «passes until the next generation» sentence, which the rule undoes (a section of its own overflowed the plate even at the fit ladder's floor at 4K); the live counter «drawn/cap» is a token in the plate's objects row (`ConsoleMarsBotSections.vue` `[data-bot-second-shift]`); nothing of it when the game has no rule. e2e: `console-bot-second-shift` (ON: the paragraph, the counter 0/2 on Hard, every plate holds its content on the TV; OFF: the rulebook's pass, no counter). |

## Manutech now — the first beneficiary

The third mark of «Производственные циклы» moved **#15 → #13** (goals untouched). The FULL recalibration of every track-based clause (C13, C15, C19, C29, …) is deliberately **after** the pace rule has real games behind it — re-marking against pre-rule tracks would bake the stall in. `docs/claude/marsbot-dividends-calibration.md` keeps the C29 row annotated.

## The pace bench

```
npx tsx scripts/marsbot-pace-bench.ts <snapshots-dir> [--cards=3] [--finals=<dir>]
```

Reads mid-game snapshots copied from the box (`~/.config/terraforming-mars/embedded/db/files/history/`), deserializes each with a no-op database, resolves N extra project cards for the bot and measures the track / TR / M€ yield per card, then projects the finals from `--finals` (the finished games) under the policy. It is a MEASURE, not a simulator of the humans — use it to size a cap, never to claim a win-rate.

## Gotchas

- `Game.deserialize` of an action-phase save calls `Game.save` → the bench installs a no-op `IDatabase` first.
- The live tracks are `automa.board.tracks` (`automa.tracks` is the serialized shape).
- `AutomaState.ts` is CRLF — a `\n`-anchored string replace silently misses; use the Edit tool or a CRLF-normalizing helper.
- The offer is pure (`SecondShift.offer`); only `take` draws, journals and notes the step — the model reads `cap` / `drawn` without touching the deck.
