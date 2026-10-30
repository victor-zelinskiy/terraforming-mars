/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «ЦЕЛЬ НА СТОЛЕ — ОДНА ЗОНА» (the owner, 2026-10-28). Ants, Predators and every «remove N <card resource> from ANY
 * card» against a table with MarsBot used to ask in TWO steps: first a list «the players' cards · the bot», and only
 * behind the door the cards themselves. The server's answer is the same `OrOptions` it always was (`[card pick?, the
 * bot, «Do not remove»?]`), now MARKED with which branch is which (`OrOptionsModel.tableTargetPrompt`); this module
 * reads that marker — never the shape, never a title — and gives the target step ONE zone: the players' groups and
 * the bot's group side by side.
 *
 * A target that is a PLAYER, not a card (the bot's animals, a player's plants — Virus) stands in the zone as a STAND-IN
 * TILE on a slot's chassis (it holds no card — a card face would lie), keyed `__stand__:<colour>:<unit>` so a player
 * may have one per unit. It reads WHO and the unit attacked, `current → resulting` OF THAT UNIT — never how the bot's
 * engine pays (its storage areas, its M€ supply standing in): at the table the bot is one more player (the owner,
 * 2026-10-30; the server speaks so already — `targetImpact.ts`).
 *
 * Pure: the composers ask it what the zone holds and what an answer sends; the wire answer is the historical one,
 * byte for byte.
 */
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {CardModel} from '@/common/models/CardModel';
import {Message} from '@/common/logs/Message';
import {TabbedPlantTarget, TabbedTargetsStep} from '@/common/models/ActionPreviewModel';
import {OptionMetadata, OrOptionsModel, PlayerInputModel, SelectCardModel, SelectOptionModel, TableTargetPromptMeta} from '@/common/models/PlayerInputModel';
import {TargetImpactChange} from '@/common/models/TargetImpactModel';

const STAND_PREFIX = '__stand__:';

/** The stand-in candidate key of a player's unit — no card is ever named so (`CardName` is the cards' name space). */
export function tableTargetStandKey(color: string, icon: string): CardName {
  return `${STAND_PREFIX}${color}:${icon}` as CardName;
}

/** Is this candidate a player's stand-in tile (never a card)? */
export function isTableTargetStand(cardName: string | undefined): boolean {
  return cardName !== undefined && cardName.startsWith(STAND_PREFIX);
}

/**
 * What a stand-in tile reads: whose (`color`), the unit attacked, `current → resulting` OF THAT UNIT (the server's one
 * row). A stand the rules SHOW but never let be chosen (a player whose plants are protected) carries its `refused`
 * reason — shown, never hidden, never chosen.
 */
export type TableTargetStand = {
  key: CardName;
  color: Color;
  /** The unit's icon key (`Microbe`, `Animal`, `plants`…). */
  icon: string;
  amount: number;
  current?: number;
  resulting?: number;
  /** The server's reading — ONE row of the unit attacked. */
  changes: ReadonlyArray<TargetImpactChange>;
  refused?: string | Message;
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
export function tableTargetBotStand(input: PlayerInputModel | undefined): TableTargetStand | undefined {
  const meta = tableTargetOf(input);
  if (meta === undefined) {
    return undefined;
  }
  const option = (input as OrOptionsModel).options[meta.botBranch] as SelectOptionModel | undefined;
  const md: OptionMetadata | undefined = option?.metadata;
  const icon = md?.icon ?? '';
  return {
    key: tableTargetStandKey(meta.bot.color, icon),
    color: meta.bot.color,
    icon,
    amount: md?.amount ?? 0,
    ...(md?.player?.current !== undefined ? {current: md.player.current} : {}),
    ...(md?.player?.resulting !== undefined ? {resulting: md.player.resulting} : {}),
    changes: md?.player?.changes ?? [],
  };
}

/** THE WIRE ANSWER of a pick in the zone — the historical `or` response, byte for byte. */
export function tableTargetResponse(meta: TableTargetPromptMeta, cardName: string): {type: 'or', index: number, response: unknown} | undefined {
  if (isTableTargetStand(cardName)) {
    return {type: 'or', index: meta.botBranch, response: {type: 'option'}};
  }
  if (meta.cardBranch === undefined) {
    return undefined;
  }
  return {type: 'or', index: meta.cardBranch, response: {type: 'card', cards: [cardName]}};
}

/**
 * VIRUS («remove up to 2 animals from ANY card OR up to 5 plants from ANY player», `TabbedTargetsStep`) AS ONE ZONE:
 * the animal cards stand in their owners' groups, every player-target is a STAND-IN tile in its player's group — the
 * bot's animals, each player's plants. A protected player's plants stand REFUSED with the server's reason (shown, never
 * chosen); a refused animal CARD stays out, like every protected holder of a taking step (`playedTargetShortfalls`).
 *
 * The answer is the step's own: `pickKeys` maps a zone candidate to the step's target key (`buildTabbedTargets` —
 * `a<card>` · `ap<colour>` · `p<colour>`), whose response is the top-level `or` answer, verbatim.
 */
export type TabbedTargetZone = {
  cards: ReadonlyArray<CardModel>;
  stands: ReadonlyArray<TableTargetStand>;
  /** zone key (a card's name / a stand key) → the step's target key. A refused stand has none. */
  pickKeys: ReadonlyMap<string, string>;
};

export function tabbedTargetZone(step: TabbedTargetsStep): TabbedTargetZone {
  const cards: Array<CardModel> = [];
  const stands: Array<TableTargetStand> = [];
  const pickKeys = new Map<string, string>();
  const standOf = (t: TabbedPlantTarget, icon: string, amount: number, pickKey: string): void => {
    const key = tableTargetStandKey(t.color, icon);
    stands.push({
      key, color: t.color, icon, amount, current: t.current, resulting: t.resulting,
      changes: [{icon, from: t.current, to: t.resulting, scope: 'stock'}],
      ...(t.disabled === true ? {refused: t.reason ?? ''} : {}),
    });
    if (t.disabled !== true) {
      pickKeys.set(key, pickKey);
    }
  };
  const animal = step.animal;
  if (animal !== undefined) {
    if (animal.input !== undefined && animal.branchIndex !== undefined) {
      for (const card of animal.input.cards) {
        if (card.isDisabled !== true) {
          cards.push(card);
          pickKeys.set(card.name, 'a' + card.name);
        }
      }
    }
    for (const t of animal.targets ?? []) {
      standOf(t, animal.icon, animal.amount, 'ap' + t.color);
    }
  }
  for (const t of step.plant?.targets ?? []) {
    standOf(t, step.plant?.icon ?? 'plants', step.plant?.amount ?? 0, 'p' + t.color);
  }
  return {cards, stands, pickKeys};
}
