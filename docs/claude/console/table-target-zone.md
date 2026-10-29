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
   every group on screen — ALWAYS bands (the owner's decision B2, 2026-10-29: a wide, short host — the action
   composer at 4K — draws the bands smaller or scrolls honestly; a one-row variant was tried and dropped); `split`
   stays the narrow two-group case, `tabs` is the handheld fallback only. The solver shares the height between bands
   (`planPlayedTargetSizing`, mode `board`); the viewport scrolls only on a real overflow, the focused card in frame.
6. **The bot's tile** (`ConsolePlayedTargetStep`, `[data-ptsel-bot]`): the slot's chassis (same zoomed box, cursor,
   lock), a neutral glass plate — never a `.pcard` face. «ЦЕЛЬ БЕЗ КАРТЫ», the seat's dot and name, the unit's icon,
   `current → resulting` (`[data-ptsel-bot-delta]`), where the first unit comes from (`[data-ptsel-bot-storage]`).
   State is a kant and a fill (invariant 15). X has nothing to lift on it.
7. **Navigation**: the d-pad walks the MEASURED cells across bands (`stepPlayedTargetFocusAt`); **LB/RB jump band to
   band** (the first card of the next band, scrolled into frame); A chooses; B goes up to the composer (there is no list
   above the zone any more); RT declines an optional removal (the decline plate).

## Scope today

- BOTH composers open the zone from the row: the ACTION composer (Ants, Predators — the owner's examples) and the
  PLAY composer (a marked `or` of an on-play removal — `openTableTargetZone`; its answer rides `picks` +
  `nestedPickKey` like every or-option's card pick, the bot's branch the bare option). The trade target step speaks
  `board` too (bands, LB/RB).
- **A lone bot is the only target** (T14 · `soleCandidateOf` → `{kind: 'tableBot'}`): a MANDATORY removal with no
  player's card holding the resource seeds the bot branch on the row and marks it «единственная цель»; the server still
  asks, the batch answers.
- Virus (`TabbedTargetsStep`) already answers on ONE screen — the cards and the bot's row stand in the same animal
  tab, no door — but as a LIST, not this zone; moving that tab onto the zone surface is the next step.
- The reverse direction (the bot attacking the player — `ConsoleBotAttack`, `botAttackPrompt`) is untouched.

Guards: `tests/client/components/console/tableTargetZone.spec.ts`, `consolePlayedTargetModel.spec.ts` (BANDS),
e2e `console-table-target-zone.spec.ts` (fixture `table-target-ants-bot`).
