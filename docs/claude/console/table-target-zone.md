# «ЦЕЛЬ НА СТОЛЕ — ОДНА ЗОНА» — the table's targets, the bot beside the players

The owner, 2026-10-28: Ants / Predators / every «remove N <card resource> from ANY card» against a table with MarsBot
used to ask in TWO steps — a list «карты игроков · бот», and only behind its door the cards. **All targets now stand
in ONE zone, grouped by owner; the bot is a group of its own with a stand-in tile (it holds no card).** Ledger PL-1119.

## Contract

1. **The wire is unchanged.** `RemoveResourcesFromCard` still answers with `OrOptions [card pick?, the bot, «Do not
   remove»?]` in that order; the answer is `{type: 'or', index: cardBranch, response: {type: 'card', cards}}` or
   `{type: 'or', index: botBranch, response: {type: 'option'}}` — byte for byte what the list sent.
2. **A structural marker, never the shape.** The wrapper carries `OrOptionsModel.tableTargetPrompt`
   (`{cardBranch?, botBranch, skipBranch?, bot: {color, storage: 'colony' | 'floaters' | 'megacredits', colony?}}`),
   serialized on `OrOptions.toModel` (nesting-safe), set by ONE builder (`RemoveResourcesFromCard.tableTargets`) for the
   live prompt AND `previewRemovalModel()` — the pre-collected answer replays. `storage` is where the FIRST unit comes
   from (`AutomaTargeting.cardResourceSourceOf` — the order `removeCardResourceFromBot` drains). Guards:
   `tests/automa/AutomaTargeting.spec.ts` § the table target marker, `promptMarkerGuard` (`markTableTargetPrompt(`).
3. **The client reads it in ONE module** (`console/played/tableTargetZone.ts`): the players' card pick, the bot's
   stand-in (`TableTargetBotStand` — its option's own metadata, never recounted), the wire answer.
4. **The model** (`buildPlayedTargetModel({…, bot})`): the bot is an owner group with `bot: true` and ONE candidate
   (`TABLE_TARGET_BOT_KEY`, `candidate.bot`), an opponent like any other (sorts before the viewer's own group); its
   section is one rail-less block. Owners without candidates are still never emitted.
5. **The layout `board`** (`planPlayedTargetLayout`): off the Deck, two or more owners stand as BANDS one under another,
   every group on screen; `split` stays the narrow two-group case, `tabs` is the handheld fallback only. The solver
   shares the height between bands (`planPlayedTargetSizing`, mode `board`); the viewport scrolls only on a real
   overflow, and the focused card is scrolled into frame.
6. **The bot's tile** (`ConsolePlayedTargetStep`, `[data-ptsel-bot]`): the slot's chassis (same zoomed box, cursor,
   lock), a neutral glass plate — never a `.pcard` face. «ЦЕЛЬ БЕЗ КАРТЫ», the seat's dot and name, the unit's icon,
   `current → resulting` (`[data-ptsel-bot-delta]`), where the first unit comes from (`[data-ptsel-bot-storage]`).
   State is a kant and a fill (invariant 15). X has nothing to lift on it.
7. **Navigation**: the d-pad walks the MEASURED cells across bands (`stepPlayedTargetFocusAt`); **LB/RB jump band to
   band** (the first card of the next band, scrolled into frame); A chooses; B goes up to the composer (there is no list
   above the zone any more); RT declines an optional removal (the decline plate).

## Scope today

- The ACTION composer (Ants, Predators — the owner's examples) opens the zone from the row. The PLAY composer and the
  trade target step speak `board` (bands, LB/RB) but the play composer's door into a marked `or` (Scientific
  Breakthrough-class plays) is still the old list → next step.
- Virus (`TabbedTargetsStep`) keeps its tabbed bot row → next step.
- The reverse direction (the bot attacking the player — `ConsoleBotAttack`, `botAttackPrompt`) is untouched.

Guards: `tests/client/components/console/tableTargetZone.spec.ts`, `consolePlayedTargetModel.spec.ts` (BANDS),
e2e `console-table-target-zone.spec.ts` (fixture `table-target-ants-bot`).
