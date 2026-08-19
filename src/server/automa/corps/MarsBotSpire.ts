import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {IProjectCard} from '../../cards/IProjectCard';
import {AutomaTilePlacer} from '../AutomaTilePlacer';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {failedAction} from '../AutomaFailedAction';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';
import {MarsBotDraftResolver} from './MarsBotDraftResolver';

/** The printed thresholds of card C45. */
const TAGS_FOR_SCIENCE = 2;
const SCIENCE_FOR_CITY = 10;

/**
 * MarsBot Spire — official card C45:
 *
 *   Starting tag     Earth (resolved at setup like a revealed card's tag —
 *                    the framework advances the Earth track once)
 *   DRAFT PRIORITY   Most tags
 *   EFFECT           When resolving a card with 2 or more tags, place a
 *                    science resource on this card.
 *   BEFORE ACTION    If there are 10 or more science resources on this card,
 *   PHASE            remove 10 science resources from here, and MarsBot
 *                    places a city tile and gains 1 TR.
 *
 * The identity/art/lore reference is the HUMAN Spire (PC05, Prelude 2). Only
 * the reference: no Prelude 2 gameplay, no human Spire rules (50 M€ start,
 * draw-4-discard-3, standard-project discount) exist here, and referencing
 * `CardName.SPIRE` does not enable the Prelude 2 module anywhere.
 *
 * "2 or more tags" and the "most tags" draft count both read the PRINTED
 * top-right tag row (`MarsBotDraftResolver.printedTagCount` →
 * `AutomaResolver.printedTags`): the wild and event icons are printed tags
 * the bot genuinely resolves. The draft pick/protection itself (save ALL
 * max-tag cards, discard one of the others, nothing when all four tie —
 * RB-B p.2 "Special Cases") is data-driven via `info.draftPriority`.
 *
 * The science lives in `AutomaState.corpResources` (serialized, public). The
 * city goes through the standard `AutomaTilePlacer.placeCity` pipeline
 * (tie-breakers, Ares avoidance, bot placement-bonus rules, human on-tile
 * triggers).
 */
export const MarsBotSpire: MarsBotCorp = {
  info: marsBotCorpInfo(MarsBotCorpId.C45_SPIRE),

  onProjectCardResolving(game: IGame, card: IProjectCard): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    if (MarsBotDraftResolver.printedTagCount(card) < TAGS_FOR_SCIENCE) {
      return;
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: this.info.original, owner: bot.color}, 'automa-corporation');
    try {
      automa.corpResources++;
      game.log('${0} placed a science resource on its corporation ${1} (${2} total)',
        (b) => b.player(bot).string('Spire').number(automa.corpResources));
    } finally {
      game.events.endScope();
    }
    bumpCorpStat(game, 'scienceAdded');
    bumpCorpStat(game, 'multiTagCards');
    AutomaTurnLog.setCause(game, prior);
  },

  beforeActionPhase(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined || automa.corpResources < SCIENCE_FOR_CITY) {
      return;
    }
    const bot = marsBotOf(game);
    // Its own journal group + notification — a corporation-driven action that
    // happens OUTSIDE any bot turn (between research and the action phase).
    game.events.beginAction(bot, {kind: 'corporation', card: this.info.original, owner: bot.color}, {category: 'corporation-action'});
    try {
      automa.corpResources -= SCIENCE_FOR_CITY;
      game.log('${0} removed ${1} science resources from its corporation ${2}',
        (b) => b.player(bot).number(SCIENCE_FOR_CITY).string('Spire'));
      bumpCorpStat(game, 'scienceSpent', SCIENCE_FOR_CITY);
      if (game.board.getAvailableSpacesForCity(bot).length === 0) {
        // The city cannot be placed → official Failed Action compensation;
        // the TR clause below still resolves (a separate printed effect).
        failedAction(game, 'no-tile-space');
      } else {
        AutomaTilePlacer.placeCity(game);
        bumpCorpStat(game, 'citiesPlaced');
      }
      bot.increaseTerraformRating(1, {log: true});
      bumpCorpStat(game, 'trGained');
    } finally {
      game.events.endScope();
    }
  },
};
