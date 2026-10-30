# «ЦЕЛЬ НА СТОЛЕ — ОДНА ЗОНА» — the table's targets, the bot beside the players

The owner, 2026-10-28: Ants / Predators / every «remove N <card resource> from ANY card» against a table with MarsBot
used to ask in TWO steps — a list «карты игроков · бот», and only behind its door the cards. **All targets now stand
in ONE zone, grouped by owner; a target that is a PLAYER, not a card (the bot's unit, a player's plants) is a stand-in
tile in its owner's group.** Ledger PL-1119; Virus and the bot's encapsulation PL-1121…1122 (2026-10-30).

**THE BOT IS ONE MORE PLAYER AT THE TABLE** (the owner, 2026-10-30): «то что это может быть мегакредиты бота — это
условность, которую надо инкапсулировать от UI». Its storage areas (Enceladus / Miranda / Ganymede …) and its M€
supply standing in for the unit attacked are how its ENGINE pays — no surface ever shows them: before the commit the
tile reads ONE row of the unit attacked (`targetImpact.ts` — its attackable stock summed), after it the log and the
event stream carry ONE loss of that unit (`AutomaTargeting.removeFromBot` / `removeCardResourceFromBot` →
`EventRecorder.recordBotStandInLoss`; the engine's own M€ deduction is `stock.deduct(…, {log: false, record: false})`).

## Contract

1. **The wire is unchanged.** `RemoveResourcesFromCard` still answers with `OrOptions [card pick?, the bot, «Do not
   remove»?]` in that order; the answer is `{type: 'or', index: cardBranch, response: {type: 'card', cards}}` or
   `{type: 'or', index: botBranch, response: {type: 'option'}}` — byte for byte what the list sent.
2. **A structural marker, never the shape.** The wrapper carries `OrOptionsModel.tableTargetPrompt`
   (`{cardBranch?, botBranch, skipBranch?, bot: {color}}` — WHO, never how the bot's engine pays), serialized on
   `OrOptions.toModel` (nesting-safe), set by ONE builder (`RemoveResourcesFromCard.tableTargets`) for the live prompt
   AND `previewRemovalModel()` — the pre-collected answer replays. Guards: `tests/automa/AutomaTargeting.spec.ts` § the
   table target marker, `promptMarkerGuard` (`markTableTargetPrompt(`).
3. **The client reads it in ONE module** (`console/played/tableTargetZone.ts`): the players' card pick, the bot's
   stand-in (`tableTargetBotStand` — its option's own metadata, never recounted), the wire answer; and Virus's zone
   (`tabbedTargetZone` — below).
4. **The model** (`buildPlayedTargetModel({…, stands})`): every stand-in joins its OWNER's group (a group of its own
   for a player with no card here — the bot), keyed `tableTargetStandKey(colour, unit)` (`__stand__:…`, never a card
   name), `candidate.stand`; an opponent like any other (sorts before the viewer's own group). The stand-ins close
   their group as one rail-less section (`playedTargetSections` → `stand: true`). A REFUSED stand (protected plants)
   is a near miss (`blocked`): shown, never counted, never chosen.
5. **The layout `board`** (`planPlayedTargetLayout`): off the Deck, two or more owners stand as BANDS one under another,
   every group on screen — ALWAYS bands (the owner's decision B2, 2026-10-29: a wide, short host — the action
   composer at 4K — draws the bands smaller or scrolls honestly; a one-row variant was tried and dropped); `split`
   stays the narrow two-group case, `tabs` is the handheld fallback only. The solver shares the height between bands
   (`planPlayedTargetSizing`, mode `board`); the viewport scrolls only on a real overflow, the focused card in frame.
6. **The stand-in tile** (`ConsolePlayedTargetStep`, `[data-ptsel-bot]` + `[data-ptsel-stand="<unit>"]`): the slot's
   chassis (same zoomed box, cursor, lock), a neutral glass plate — never a `.pcard` face. «ЦЕЛЬ БЕЗ КАРТЫ», the seat's
   dot and name, the unit's icon (`[data-ptsel-bot-icon]`), `current → resulting` OF THAT UNIT
   (`[data-ptsel-bot-delta]`); a refused one under the near miss's scrim with «✕ <reason>». State is a kant and a fill
   (invariant 15). X has nothing to lift on it.
7. **Navigation**: the d-pad walks the MEASURED cells across bands (`stepPlayedTargetFocusAt`); **LB/RB jump band to
   band** (the first card of the next band, scrolled into frame); A chooses; B goes up to the composer (there is no list
   above the zone any more); RT declines an optional removal (the decline plate).

## Scope today

- BOTH composers open the zone from the row: the ACTION composer (Ants, Predators — the owner's examples) and the
  PLAY composer (a marked `or` of an on-play removal — `openTableTargetZone`; its answer rides `picks` +
  `nestedPickKey` like every or-option's card pick, the bot's branch the bare option). The trade target step speaks
  `board` too (bands, LB/RB).
- **VIRUS** (`TabbedTargetsStep` — «up to 2 animals from ANY card OR up to 5 plants from ANY player»): A on its row in
  the PLAY composer opens the SAME zone (`openTabbedZone` — the `playedTarget` sub with `tabbed: <step>`): the animal
  cards in their owners' groups, the bot's ANIMALS and every other player's PLANTS as stand-ins (a protected player's
  plants shown refused), RT its decline. The answer is the step's own target key (`buildTabbedTargets` — `a<card>` ·
  `ap<colour>` · `p<colour>`, `pickKeys`) and its top-level `or` response, verbatim — the draft and the batch are the
  historical ones. The flat list stays only for a step with nothing to point at.
- **A lone bot is the only target** (T14 · `soleCandidateOf` → `{kind: 'tableBot'}`): a MANDATORY removal with no
  player's card holding the resource seeds the bot branch on the row and marks it «единственная цель»; the server still
  asks, the batch answers.
- The reverse direction (the bot attacking the player — `ConsoleBotAttack`, `botAttackPrompt`) is untouched.

Guards: `tests/client/components/console/tableTargetZone.spec.ts`, `tabbedTargetZone.spec.ts`,
`consolePlayedTargetModel.spec.ts` (BANDS), `tests/automa/AutomaTargeting.spec.ts` § the loss reads as the unit
attacked, `tests/inputs/targetImpact.spec.ts`; e2e `console-table-target-zone.spec.ts` (fixture
`table-target-ants-bot`), `console-virus-table-zone.spec.ts` (fixture `table-target-virus-bot`).
