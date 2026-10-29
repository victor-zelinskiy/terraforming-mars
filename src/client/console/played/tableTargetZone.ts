/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «ЦЕЛЬ НА СТОЛЕ — ОДНА ЗОНА» (the owner, 2026-10-28). Ants, Predators and every «remove N <card resource> from ANY
 * card» against a table with MarsBot used to ask in TWO steps: first a list «the players' cards · the bot», and only
 * behind the door the cards themselves. The server's answer is the same `OrOptions` it always was (`[card pick?, the
 * bot, «Do not remove»?]`), now MARKED with which branch is which (`OrOptionsModel.tableTargetPrompt`); this module
 * reads that marker — never the shape, never a title — and gives the target step ONE zone: the players' groups and
 * the bot's group side by side, the bot a STAND-IN tile (it holds no card — a card face would lie).
 *
 * Pure: the composers ask it what the zone holds and what an answer sends; the wire answer is the historical one,
 * byte for byte (`{type: 'or', index: cardBranch, response: {type: 'card', cards}}` / `{… index: botBranch, response:
 * {type: 'option'}}`).
 */
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {ColonyName} from '@/common/colonies/ColonyName';
import {OptionMetadata, OrOptionsModel, PlayerInputModel, SelectCardModel, SelectOptionModel, TableTargetPromptMeta} from '@/common/models/PlayerInputModel';
import {TargetImpactChange} from '@/common/models/TargetImpactModel';

/** The bot's stand-in candidate key — no card is ever named so (the name space of `CardName` is the cards'). */
export const TABLE_TARGET_BOT_KEY = '__table-target-bot__' as CardName;

/** What the bot's tile reads: whose, the unit, `current → resulting`, where the first unit comes from. */
export type TableTargetBotStand = {
  color: Color;
  /** The unit's icon key (`microbe`, `animal`, `floater`…). */
  icon: string;
  amount: number;
  current?: number;
  resulting?: number;
  /** The server's per-pool reading (the storage row, the M€ proxy row) — verbatim. */
  changes: ReadonlyArray<TargetImpactChange>;
  storage: 'colony' | 'floaters' | 'megacredits';
  colony?: ColonyName;
};

/** The marker of an `or` that IS the table's one target zone — undefined for any other input. */
export function tableTargetOf(input: PlayerInputModel | undefined): TableTargetPromptMeta | undefined {
  return input?.type === 'or' ? (input as OrOptionsModel).tableTargetPrompt : undefined;
}

/** The players' card pick inside the zone — undefined when no player's card holds the resource (a lone bot). */
export function tableTargetCardPick(input: PlayerInputModel | undefined): SelectCardModel | undefined {
  const meta = tableTargetOf(input);
  if (meta === undefined || meta.cardBranch === undefined) {
    return undefined;
  }
  const option = (input as OrOptionsModel).options[meta.cardBranch];
  return option?.type === 'card' ? (option as SelectCardModel) : undefined;
}

/** The bot's stand-in, read off its option's own metadata (the server's numbers, never recounted). */
export function tableTargetBotStand(input: PlayerInputModel | undefined): TableTargetBotStand | undefined {
  const meta = tableTargetOf(input);
  if (meta === undefined) {
    return undefined;
  }
  const option = (input as OrOptionsModel).options[meta.botBranch] as SelectOptionModel | undefined;
  const md: OptionMetadata | undefined = option?.metadata;
  return {
    color: meta.bot.color,
    icon: md?.icon ?? '',
    amount: md?.amount ?? 0,
    ...(md?.player?.current !== undefined ? {current: md.player.current} : {}),
    ...(md?.player?.resulting !== undefined ? {resulting: md.player.resulting} : {}),
    changes: md?.player?.changes ?? [],
    storage: meta.bot.storage,
    ...(meta.bot.colony !== undefined ? {colony: meta.bot.colony} : {}),
  };
}

/** Is this candidate the bot's stand-in? */
export function isTableTargetBot(cardName: string | undefined): boolean {
  return cardName === TABLE_TARGET_BOT_KEY;
}

/** The branch an answer goes into: the bot's option, or the players' card pick. */
export function tableTargetBranch(meta: TableTargetPromptMeta, cardName: string): number | undefined {
  return isTableTargetBot(cardName) ? meta.botBranch : meta.cardBranch;
}

/** THE WIRE ANSWER of a pick in the zone — the historical `or` response, byte for byte. */
export function tableTargetResponse(meta: TableTargetPromptMeta, cardName: string): {type: 'or', index: number, response: unknown} | undefined {
  if (isTableTargetBot(cardName)) {
    return {type: 'or', index: meta.botBranch, response: {type: 'option'}};
  }
  if (meta.cardBranch === undefined) {
    return undefined;
  }
  return {type: 'or', index: meta.cardBranch, response: {type: 'card', cards: [cardName]}};
}

/** The i18n key naming where the bot's first unit comes from — honest only: a colony area by name, the floaters, M€. */
export function tableTargetBotStorageKey(stand: TableTargetBotStand): string {
  switch (stand.storage) {
  case 'colony':
    return 'Storage on ${0}';
  case 'floaters':
    return 'The bot\'s floaters';
  case 'megacredits':
    return 'From the bot\'s M€';
  }
}
