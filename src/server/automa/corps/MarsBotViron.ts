import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {ICard, isIActionCard} from '../../cards/ICard';
import {IProjectCard} from '../../cards/IProjectCard';
import {newProjectCard} from '../../createCard';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import {MarsBotCorp} from './MarsBotCorp';

const INFO = marsBotCorpInfo(MarsBotCorpId.C25_VIRON);
/** What one blue card with a red arrow hands the bot. */
const FLOATERS_PER_CARD = 1;
/** What each of them is worth at the end. */
const VP_PER_CARD = 1;

/**
 * MarsBot Viron — official card C25:
 *
 *   STARTING TAG    microbe
 *   SETUP           Use this corporation only when playing with Venus Next or
 *                   Colonies.
 *   EFFECT          When MarsBot plays a blue card with a red arrow, it gains
 *                   a floater.
 *                   At the end of the game, MarsBot scores 1 VP for each blue
 *                   card with a red arrow in its played pile.
 *
 * THE FIRST CORPORATION THAT SCORES AT THE END. Every other one converts into
 * tempo — a track step, a tile, money that only becomes VP through the
 * difficulty's own M€ rate. This one turns the bot's own played pile into a
 * scoreboard, and the same cards pay it twice: a floater when played, a point
 * when the game is counted. There is no way for the human to remove either.
 *
 * «A BLUE CARD WITH A RED ARROW» IS THE ENGINE'S OWN PREDICATE, not a fresh
 * one: blue is `CardType.ACTIVE`, the red arrow is `isIActionCard` — the very
 * test the HUMAN Viron uses to decide which of its cards it may re-use. An
 * ACTIVE card with only an effect box (no arrow) is not one, and neither is a
 * Prelude 2 prelude that happens to carry an action.
 *
 * THE COUNT IS THE PLAYED PILE, RE-DERIVED AT SCORING TIME. The pile keeps
 * card NAMES, so the endgame clause rebuilds each card and asks the same
 * predicate — no parallel tally to drift, and a card that entered the pile by
 * any route (a turn flip, a Research & Development draw, a Neural Instance
 * fallback) counts exactly once because it is in the pile exactly once.
 *
 * THE MODULE CONDITION IS AN «OR» AND IT IS DATA (`requiresAnyModule`), the
 * C16 primitive widened: the corporation simply never enters the selection
 * pool without Venus Next or Colonies, so it cannot reach its own hooks in a
 * game where its floaters would have nowhere to live. Never a check inside a
 * hook.
 *
 * FLOATERS GO TO THE ONE POOL the bot already has (`automa.floaters`) — the
 * same counter the Venus board's «Gain Floater» cell, the Titan colony and the
 * research-phase floater spend all use. Hoverlord's milestone reads it too, so
 * this corporation can genuinely carry the bot to it.
 */
export const MarsBotViron: MarsBotCorp = {
  info: INFO,

  onProjectCardResolving(game: IGame, card: IProjectCard): void {
    const automa = game.automa;
    if (automa === undefined || !isBlueActionCard(card)) {
      return;
    }
    const bot = marsBotOf(game);
    const prior = AutomaTurnLog.getCause(game);
    AutomaTurnLog.setCause(game, {kind: 'corporation'});
    game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
    try {
      automa.floaters += FLOATERS_PER_CARD;
      game.log('${0} gained ${1} ${2} from its corporation ${3}',
        (b) => b.player(bot).number(FLOATERS_PER_CARD).cardResource(CardResource.FLOATER).string('Viron'));
    } finally {
      game.events.endScope();
      AutomaTurnLog.setCause(game, prior);
    }
    bumpCorpStat(game, 'vironActionCards');
    bumpCorpStat(game, 'vironFloaters', FLOATERS_PER_CARD);
  },

  endgameVictoryPoints(game: IGame): number {
    return vironScoringCards(game).length * VP_PER_CARD;
  },
};

/** «A blue card with a red arrow» — the human Viron's own two tests. */
export function isBlueActionCard(card: ICard): boolean {
  return card.type === CardType.ACTIVE && isIActionCard(card);
}

/** The cards in the bot's played pile this corporation scores, by name. */
export function vironScoringCards(game: IGame): ReadonlyArray<CardName> {
  const automa = game.automa;
  if (automa === undefined) {
    return [];
  }
  return automa.playedPile.filter((name) => {
    const card = newProjectCard(name);
    return card !== undefined && isBlueActionCard(card);
  });
}
