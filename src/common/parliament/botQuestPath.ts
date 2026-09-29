/*
 * CAN MARSBOT REACH THIS CHAIRMAN QUEST? (Turmoil Redux, docs/TURMOIL_REDUX_MARSBOT.md §5)
 *
 * The bot never aims at the quest; its ordinary play counts toward it by the
 * principle «the same object, the bot's way»: a production step is an advance
 * of the track that a loss of that resource regresses (RB-A p.5's symmetry),
 * a card resource is a unit landing in the bot's storage area of the same
 * kind, a tile / a colony / a trade / a TR / a delegate is the deed itself.
 * Objects the bot never produces (a space city) are honestly UNREACHABLE —
 * one line in the quest block, never a silent 0/N.
 *
 * REACHABILITY IS COMPUTED, NEVER LISTED: a goal kind with no adapter, or a
 * card resource no area on the table holds, is unreachable; everything else
 * is reachable. `BOT_QUEST_PATHS` names WHERE each kind is reported — the
 * catalog guard (`tests/parliament/BotQuest.spec.ts`) walks every quest of
 * every resolution through it, so a new goal kind fails to compile here
 * before it ships silent.
 */
import {CardResource} from '../CardResource';
import {Resource} from '../Resource';
import {QuestGoal} from './ParliamentTypes';

/**
 * HOW the bot's progress on a goal kind is reported:
 *  - `engine`   — the shared engine path already reports by ACTOR (`Game.addTile`, `increaseTerraformRating`, the vote door);
 *  - `adapter`  — a bot path of its own reports through `server/automa/BotQuestEvents.ts`;
 *  - `table`    — reachable when the TABLE holds the object (a production the bot's tracks stand for, a card resource an area stores);
 *  - `conditional` — reachable only in a named condition (a special tile: the bot's corporation prints one);
 *  - `unreachable` — the bot never produces the object (a space city).
 */
export type BotQuestPath = 'engine' | 'adapter' | 'table' | 'conditional' | 'unreachable';

export type BotQuestTileKind = Extract<QuestGoal, {kind: 'tile'}>['tile'];

export const BOT_QUEST_PATHS: Readonly<Record<QuestGoal['kind'], BotQuestPath>> = {
  production: 'table',
  tag: 'adapter',
  tile: 'engine',
  colony: 'adapter',
  tr: 'engine',
  cardResource: 'table',
  delegates: 'engine',
  cardsPlayed: 'adapter',
  trade: 'adapter',
};

/** The tile kinds by their own path — a greenery / a city / a special tile is placed by the bot, a space city never. */
export const BOT_QUEST_TILE_PATHS: Readonly<Record<BotQuestTileKind, BotQuestPath>> = {
  greenery: 'engine',
  city: 'engine',
  special: 'conditional',
  spaceCity: 'unreachable',
};

/** What the TABLE offers the bot — computed by the server from the bot's board, the colony tiles and its corporation. */
export type BotQuestTable = {
  /** The resources the bot's tracks stand for (`TrackDefinition.productions`): a step of production = an advance of that track. */
  productions: ReadonlyArray<Resource>;
  /** The card resources the bot's storage holds: the kinds of the colony tiles on the table, plus the floater pool. */
  cardResources: ReadonlyArray<CardResource>;
  /** The bot places SPECIAL tiles (its corporation prints one — Philares' B27). */
  specialTiles: boolean;
};

function tileReachable(tile: BotQuestTileKind, table: BotQuestTable): boolean {
  switch (tile) {
  case 'greenery':
  case 'city':
    return true;
  case 'special':
    return table.specialTiles;
  case 'spaceCity':
    return false;
  }
}

export function botQuestReachable(goal: QuestGoal, table: BotQuestTable): boolean {
  switch (goal.kind) {
  case 'production':
    return table.productions.includes(goal.resource);
  case 'cardResource':
    return table.cardResources.includes(goal.resource);
  case 'tile':
    return tileReachable(goal.tile, table);
  case 'tag':
  case 'colony':
  case 'tr':
  case 'delegates':
  case 'cardsPlayed':
  case 'trade':
    return true;
  }
}
