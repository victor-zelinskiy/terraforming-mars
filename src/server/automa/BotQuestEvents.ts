/*
 * THE BOT'S DEEDS, REPORTED TO THE CHAIRMAN QUEST (docs/TURMOIL_REDUX_MARSBOT.md §5).
 *
 * The ONE module the bot's own paths report through, by the principle «the
 * same object, the bot's way»:
 *  - a PROJECT CARD the bot resolves — its PRINTED tags (`AutomaResolver.
 *    printedTags`, the event tag included) and its TYPE, reported BEFORE the
 *    tag loop, so a Failed Action (a card with no tags, a maxed track) never
 *    cancels a card that WAS played; a wild tag counts for nothing by itself
 *    (the tracker matches exactly, as for a human);
 *  - a TRACK ADVANCE — one step of every production the track stands for
 *    (`TrackDefinition.productions`: the building track is steel, the Earth
 *    track heat…), whatever advanced it (a tag, «advance another track», a
 *    storage exchange, a corporation cube); a regression reports nothing;
 *  - a COLONY the bot builds and a TRADE it makes — its own paths deliberately
 *    bypass `Colony.addColony` / `Colony.trade` (they ignore the printed
 *    reward), so the engine's hooks never see them;
 *  - a CARD RESOURCE — a unit landing in the bot's storage area of that kind:
 *    the colony tile's own kind (`colonyCardResources` — Miranda animals,
 *    Enceladus microbes, Pluto Redux data), the floater pool for floaters
 *    (Titan, the Venus board's cells, Invasive Species).
 * Tiles, TR and delegates need no adapter: the engine reports them by ACTOR
 * (`Game.addTile`, `increaseTerraformRating`, `placeBotDelegate`).
 *
 * WHAT COUNTS is the tracker's rule, not this module's: `QuestTracker.eligible`
 * accepts the bot's deed only under ITS OWN TURN (the `automa-turn` root) —
 * a corporation box at the research → action gate, the political phase, a
 * human's trade on the bot's colony are not its deeds.
 */
import {CardResource} from '../../common/CardResource';
import {Resource} from '../../common/Resource';
import {colonyCardResources} from '../../common/colonies/ColonyMetadata';
import {ColonyName} from '../../common/colonies/ColonyName';
import {MarsBotCorpId} from '../../common/automa/MarsBotCorpData';
import {BotQuestTable} from '../../common/parliament/botQuestPath';
import {IGame} from '../IGame';
import {IProjectCard} from '../cards/IProjectCard';
import {QuestEvent, QuestTracker} from '../parliament/quests/QuestTracker';
import {AutomaResolver} from './AutomaResolver';
import {MarsBotTrack} from './MarsBotBoard';
import {marsBotOf} from './AutomaUtil';

/**
 * WHAT THE TABLE OFFERS THE BOT — the reachability table (`botQuestReachable`)
 * computed from the game: the productions its tracks stand for, the card
 * resources its storage can hold (every colony tile's own kind, and floaters
 * — Invasive Species pays one in any game with Colonies, which Turmoil Redux
 * requires), and whether its corporation prints a special tile (Philares).
 */
export function botQuestTableOf(game: IGame): BotQuestTable {
  const automa = game.automa;
  const productions = new Set<Resource>();
  const cardResources = new Set<CardResource>();
  if (automa !== undefined) {
    for (const track of automa.board.tracks) {
      for (const resource of track.definition.productions) {
        productions.add(resource);
      }
    }
  }
  for (const colony of game.colonies) {
    for (const resource of colonyCardResources(colony.metadata)) {
      cardResources.add(resource);
    }
  }
  if (game.gameOptions.coloniesExtension || game.gameOptions.venusNextExtension) {
    cardResources.add(CardResource.FLOATER);
  }
  return {
    productions: [...productions],
    cardResources: [...cardResources],
    specialTiles: automa?.corporation === MarsBotCorpId.C22_PHILARES,
  };
}

export class BotQuestEvents {
  /** A project card the bot resolves — its printed tags and its type, before any tag does anything. */
  public static cardPlayed(game: IGame, card: IProjectCard): void {
    BotQuestEvents.report(game, {kind: 'tag', tags: AutomaResolver.printedTags(card)});
    BotQuestEvents.report(game, {kind: 'cardsPlayed', cardType: card.type});
  }

  /** A track advanced one step — one step of every production it stands for. */
  public static trackAdvanced(game: IGame, track: MarsBotTrack): void {
    for (const resource of track.definition.productions) {
      BotQuestEvents.report(game, {kind: 'production', resource, amount: 1});
    }
  }

  public static colonyBuilt(game: IGame): void {
    BotQuestEvents.report(game, {kind: 'colony'});
  }

  public static traded(game: IGame): void {
    BotQuestEvents.report(game, {kind: 'trade'});
  }

  /** `count` units landed in the storage area of `colony` — of the tile's own card-resource kind(s), if it has any. */
  public static storage(game: IGame, colony: ColonyName, count: number): void {
    const tile = game.colonies.find((c) => c.name === colony);
    if (tile === undefined) {
      return;
    }
    for (const resource of colonyCardResources(tile.metadata)) {
      BotQuestEvents.report(game, {kind: 'cardResource', resource, amount: count});
    }
  }

  /** `count` floaters joined the bot's pool. */
  public static floaters(game: IGame, count: number): void {
    BotQuestEvents.report(game, {kind: 'cardResource', resource: CardResource.FLOATER, amount: count});
  }

  private static report(game: IGame, event: QuestEvent): void {
    if (game.automa === undefined || game.parliament === undefined) {
      return;
    }
    QuestTracker.report(marsBotOf(game), event);
  }
}
