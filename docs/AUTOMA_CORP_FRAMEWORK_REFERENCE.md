# MarsBot corporations — design reference (upstream framework; HISTORICAL)

**Status: IMPLEMENTED (2026-08-19)** — the production framework lives in
`src/server/automa/corps/` + `src/common/automa/MarsBotCorpData.ts`; contract:
`docs/claude/marsbot-corporations.md`; official data: `docs/AUTOMA_DATA_AUDIT.md` §10.
This document remains as the historical record of upstream's framework SHAPE (the fork
deliberately did not adopt its `IMarsBot` facade; the rules knowledge moved into the
audit + Rule Book B, which has since been transcribed in full).

**Upstream sources** (retrieve the full text with `git show <sha>` — `upstream` remote):

| sha | what |
| --- | --- |
| `8d8e335d8b` | `MarsBotCorpTypes.ts` — the corp/bot type framework (types only, no implementations) |
| `d3eed64787` | `corps/MarsBotDraftResolver.ts` — corp-driven research-draft pick + post-draft discard |
| `27bd8b963f` | `MarsBotBonusDeck.ts` — bonus deck as a `Deck<T>` subclass (we already have an equivalent) |

**Not taken as code, on purpose.** Upstream's framework posits a separate `IMarsBot`
facade object. Our bot is a **real `Player`** in `game.players` (flagged `isMarsBot`,
created in `AutomaSetup.createBotPlayer`) plus `game.automa: AutomaState`, driven by
`AutomaController`. Importing a 116-line interface with no implementations and a
mismatched facade would be dead code that rots; the *rules knowledge* below is the part
worth keeping.

---

## 1. What a MarsBot corporation has to declare

Upstream's `IMarsBotCorp` (all optional except the first three):

- `name: CardName` — the real corporation card the bot stands in for.
- `description: string` — rules summary shown to the human.
- `tags: ReadonlyArray<Tag>` — **printed corp tags count toward the bot's tag totals all
  game**. ⚠️ For us this is a real integration point: our bot's tag counts come from
  BOARD TRACKS (`AutomaTargeting.automaTagCount`), not from a tableau, so corp tags must
  be added as a constant offset there — see §4.
- `draftPriority?: MarsBotDraftPriority` — see §3.
- `trackCubes?: ReadonlyArray<{trackIndex, position, cubeType}>` — cubes seeded onto the
  bot's tracks during setup; reaching one fires `onTrackCubeTrigger`.
- `setup?(bot)` — once, right after the corp is chosen.
- `roundStart?(bot)` — every generation, at the start.
- `beforeActionPhase?(bot)` — every generation, right before the action phase.
- `effect?: MarsBotCorpEffect` — the event hooks in §2.

`CubeType = 'white' | 'black' | 'credit'` (added to `common/automa/AutomaTypes.ts`).

## 2. The corp effect hook surface (`MarsBotCorpEffect`)

This is the valuable part — it enumerates every game moment an official bot corp can
react to:

| hook | fires when |
| --- | --- |
| `onTrackCubeTrigger(bot, trackIndex, position, cubeType)` | the bot's marker reached one of this corp's cubes |
| `onProjectCardResolved(bot, card)` | the bot drew and resolved a project card |
| `onHumanCardPlayed(bot, card)` | the HUMAN played a card |
| `onTilePlaced(bot, placedByMarsBot, tileType)` | any tile landed, either side |
| `onVenusRaised(bot)` | Venus went up |
| `interceptGlobalParameterRaise(bot, parameter): boolean` | before the bot raises a global parameter; returning `true` CONSUMES the raise (parameter does not move) |
| `onMcGained(bot, amount)` | the bot's M€ supply grew |
| `onColonyPlaced(bot)` | the bot placed a colony (Colonies rule C-33) |
| `vpBonus(bot): number` | extra VP at final scoring |

## 3. Draft priorities (`MarsBotDraftPriority`)

Each corp names ONE priority, used twice — to pick during the draft, and to protect
cards from the post-draft discard:

- `{type: 'tags', tags: [...]}` — pick a card carrying one of those tags; **every** card
  carrying one is protected from the discard.
- `{type: 'mostExpensive'}` — pick/protect the highest-cost card(s).
- `{type: 'mostTags'}` — pick/protect the card(s) with the most tags.
- `{type: 'leastAdvancedTrack'}` — pick a card whose tag maps to the bot's least-advanced
  track; protection re-reads the same track (it cannot have moved — tracks only advance
  once the bot starts resolving cards).

Post-draft discard rule: shuffle the drafted cards, then discard the **first unprotected
card in shuffled order**; at most one card leaves, and a priority that protects
everything loses nothing. (Compare with our corpless rule in `AutomaDraft.endRound` +
`AutomaResearch.finishDraftedActionDeck`: shuffle, discard 1; Brutal and the floater
spend keep all 4.)

## 4. What our architecture would need to add

Mapping upstream's `IMarsBot` facade onto our code — most of it already exists:

| upstream `IMarsBot` member | our equivalent today |
| --- | --- |
| `player` / `game` / `board` | `marsBotOf(game)` / `game` / `game.automa.board` |
| `mcSupply`, `gainMc` | the bot is a real `Player` → `player.stock` / `stock.add` (keeps journal + event recorder attribution) |
| `floaterCount`, `addFloaters`, `spendFloaters` | `AutomaState.floaters` |
| `raiseTR`, `advanceTrack`, `raiseTemperature`, `placeOcean/City/Greenery` | `AutomaTerraformer`, `MarsBotBoard.tracks[i].advance()`, `AutomaTilePlacer` |
| `drawAndResolveProjectCard*`, `drawProjectCardsToActionDeck` | `AutomaResearch` / `AutomaResolver` |
| bonus-deck manipulation | `AutomaState.bonusDeck / bonusDiscard / destroyedBonusCards / recurringBonusCards / setAsideBonusCards` + `AutomaBonusCards` |
| `maybePlaceRandomColony` | `AutomaColonies` |

**Genuinely missing, would have to be added:**

1. **Corp identity in `AutomaState`** + serialization (`SerializedAutomaState`), degrading
   gracefully on old saves (absent ⇒ no corp) per the DB rule.
2. **`getCorpState(key)` / `setCorpState(key, value)`** — arbitrary per-corp counters,
   serialized with the bot. Missing keys read as 0.
3. **Track cubes** — cube positions per track + the set of cubes that already triggered
   (upstream keys them `"trackIndex:position"`), serialized.
4. **Corp tags feeding the track-based tag count** — our cross-player tag counting goes
   through `Counter.ts` → `AutomaTargeting.automaTagCount` (tracks), which knows nothing
   about a corp card. Printed corp tags must be added there, or a human card counting
   "any player's Building tags" will under-count the bot.
5. **A hook dispatch point per moment in §2** — our controller does not currently emit
   `onHumanCardPlayed` / `onTilePlaced` / `interceptGlobalParameterRaise`. The interceptor
   is the awkward one: it must sit *before* `AutomaTerraformer` raises a parameter.

## 5. Fork rules that apply when we implement this

- **Bot gains go through `stock.add` / `production.add`**, never direct field mutation —
  otherwise the journal and the event recorder never see them (`server.md` § Event stream).
- Per-corp logic is **co-located** with its corp definition, not in a central table
  (CLAUDE.md invariant 8), so an upstream change to that corporation collides visibly.
- New serialized fields must **degrade gracefully on old saves**.
- Coverage/guard specs are the worklist: widening bot scope starts by widening their
  `SCOPE` sets (see `docs/claude/expansion-adaptation-checklist.md`).
- The bot's rules data is audited in `docs/AUTOMA_DATA_AUDIT.md` — corp tables belong there.
