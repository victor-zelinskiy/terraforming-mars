# «ВТОРАЯ СМЕНА» — the bot's late-game pace rule

**Status: SHIPPED 2026-10-28, HIDDEN by the owner's decision the same day.** Contract + data + surfaces. The rule itself: `src/common/automa/SecondShift.ts`; the server half: `src/server/automa/SecondShift.ts`; guard: `tests/automa/SecondShift.spec.ts`.

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

## HIDDEN BALANCE — the rule is never announced (the owner, 2026-10-28)

«Игрок по сути не должен знать, КОГДА бот возьмёт доп. карту»: a player who knew the moment and the cap could pass «at the right time» to deny the bot its extra cards, and the difficulty would be played around instead of played against. So the rule is part of the difficulty's hidden balance:

- **No journal line of its own.** The extra card is journaled as the ordinary «${bot} played ${card}» — the same line as any action card.
- **No turn step, no review chip.** `MarsBotTurn` has no `second-shift` kind; the turn review reads an extra card's turn as any other.
- **No model field, no counter.** `MarsBotModel` carries nothing of it; the bot screen's decks plate keeps the rulebook's paragraph («passes until the next generation») and shows no count or cap. The hub is the same screen with the rule on or off — e2e `console-bot-second-shift` guards exactly that.
- **The deck count stays honest.** «Колода действий N» is the rulebook's own visible fact; an attentive player can see the bot act off an empty deck. Hiding or inflating the count would be lying, and the exploit is weak anyway: denying the bot one card costs the player their own remaining actions.
- **The only place the rule is named is the creator's switch** beside the bot's difficulty, and its note names NO number («сколько — зависит от сложности»); Easy's note says the difficulty draws none.

The server keeps `AutomaState.secondShift {generation, drawn}` for the cap (serialized, optional on old saves) — state, never a surface.

### The switch (`AutomaOptions.secondShift`)

- **Engine default OFF when the option is absent** — every pre-rule save, fixture and spec keeps its exact behaviour.
- **The creator defaults ON for a new game**: `PremiumCreateGameState.botSecondShift` (persisted; a blob saved before the rule restores ON), sent as `automa.secondShift` by `buildCreateGamePayload`. The console creator shows it as the «Вторая смена» stepper beside the difficulty in the bot editor (◄/► and A flip it); the crew row names «Вторая смена» only when it can fire (on AND cap > 0).
- A campaign inherits it through its stored `NewGameConfig` — `CampaignManager` spreads `gameOptions.automa` when it sets the corporation and the portfolio, so the switch travels with the difficulty.

## The engine's one hook

`AutomaController.resolveTurn`: the ONE place the bot would pass asks `SecondShift.take(game)` first — the card goes INTO the action deck, so the turn runs the ordinary project branch (journal «played», the corporation's hook, the human reactors, the lobbying rider, the played pile). `SecondShift.offer` is pure; only `take` draws and bumps the count.

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
- A hub section of its own for the rule overflowed the decks plate at 4K even at the fit ladder's floor (the first, announced iteration) — one more reason the plate keeps the rulebook's paragraph.
