import {Tag} from '../../../common/cards/Tag';
import {BonusCardId} from '../../../common/automa/AutomaTypes';
import {MarsBotCorpId, marsBotCorpInfo} from '../../../common/automa/MarsBotCorpData';
import {IGame} from '../../IGame';
import {IPlayer} from '../../IPlayer';
import {Board} from '../../boards/Board';
import {Space} from '../../boards/Space';
import {AutomaTerraformer} from '../AutomaTerraformer';
import {AutomaTurnLog} from '../AutomaTurnLog';
import {drawAndResolveProjectCard} from '../AutomaCardDraw';
import {bumpCorpStat, marsBotOf} from '../AutomaUtil';
import type {BonusCardOutcome} from '../AutomaBonusCards';
import {MarsBotCorp} from './MarsBotCorp';
import {MarsBotDividendResult, dividendResult, perUnitTerm} from '../../../common/automa/MarsBotDividend';
import {marsBotDividendInfo} from '../../../common/automa/MarsBotDividendData';
import {otherPlayersCardsWithTag, pileCount} from './MarsBotDividendReads';

const INFO = marsBotCorpInfo(MarsBotCorpId.CF6_HARTLAN_HEATING);

/** EFFECT — the heat one tile of MarsBot's puts on the card. */
export const HEAT_PER_TILE = 2;
/** BEFORE ACTION PHASE — the heat production (the human card's 2 heat production). */
export const HEAT_PRODUCTION = 2;
/** BC6 — the heat one season step costs. */
export const SEASON_HEAT = 11;

/**
 * MarsBot Hartlan Heating — CF6, the FORK'S OWN bot card (the owner, 2026-11-03) for the Turmoil Redux corporation
 * TR80. «The Construction Boiler» — the owner chose it over a district heating grid fed by every city on Mars and a
 * «winter tariff» that pays while Mars is cold: the human card's «a green card that places a tile → 6 heat», in the
 * bot's own terms — MarsBot has no cards in a hand, but it BUILDS, and every tile it lays heats the boiler.
 *
 *   STARTING TAGS        Space, Building
 *   EFFECT               Each tile MarsBot places — a city, a greenery or an ocean — puts 2 heat on this card.
 *   BEFORE ACTION PHASE  Heat production: 2 heat on this card. Add Heating Season (BC6) to MarsBot's action deck.
 *
 *   BC6 HEATING SEASON   For every full 11 heat on the card, MarsBot spends them, raises the temperature 1 step AND
 *                        draws and resolves a project card (the human card's two halves: heat warms Mars, «12 heat →
 *                        2 cards»); a warm Mars gives the card alone. Less heat: nothing — the boiler keeps heating.
 *                        Recurs every generation.
 *
 * THE BOILER IS NOT MARSBOT'S HEAT. MarsBot has no heat stock (a human «remove heat» hits its M€ stand-in); the boiler
 * is the ordinary on-card socket (`corpResources`) — so an attack never cools it, and the capsule shows the table how
 * close the next season is.
 *
 * THE BALANCE (measured 2026-11-03, 30 seeded 8-generation games, the human passing — §20): a temperature step alone
 * is worth ≈ 0.75 VP to the bot (8 heat → a step: 85.5 VP; even 4 heat: 90.7) — the temperature is not the bot's
 * engine, so the season pays the human card's OTHER half too, a card. Step + card per 8 heat ran 101.3, per 10 96.2 /
 * 108.7, per 12 92.7 / 105.8; per 11 (final) 94.3, with Venus + Colonies + Prelude 107.4 (C38 94.1 / 105.3 · C42
 * 96.3 / 107.8). The 2 heat a tile and the 2 heat production are the human card's own numbers.
 */
export const MarsBotHartlanHeating: MarsBotCorp = {
  info: INFO,

  /** The end-game DIVIDEND this corporation pays as a HOLDING of the bot's portfolio. */
  dividend(game: IGame): MarsBotDividendResult {
    const r = marsBotDividendInfo(MarsBotCorpId.CF6_HARTLAN_HEATING).rates;
    return dividendResult([
      perUnitTerm('Cards with a building tag the other players played', otherPlayersCardsWithTag(game, Tag.BUILDING), r.each, r.per),
    ]);
  },

  /** The box's GOAL — its own count, measured apart from the formula (docs/claude/marsbot-dividend-goals-catalog.md). */
  goal(game: IGame): number {
    return pileCount(game, (card) => card.requirements.some((req) => req.temperature !== undefined));
  },

  onTilePlaced(game: IGame, player: IPlayer, space: Space): void {
    if (player.isMarsBot !== true) {
      return;
    }
    if (Board.isCitySpace(space) || Board.isGreenerySpace(space) || Board.isUncoveredOceanSpace(space)) {
      boiler(game, HEAT_PER_TILE, 'hartlanTileHeat');
    }
  },

  beforeActionPhase(game: IGame): void {
    const automa = game.automa;
    if (automa === undefined) {
      return;
    }
    boiler(game, HEAT_PRODUCTION, 'hartlanProductionHeat');
    if (!automa.recurringBonusCards.includes(BonusCardId.BC6_HEATING_SEASON)) {
      automa.recurringBonusCards.push(BonusCardId.BC6_HEATING_SEASON);
    }
    const present = automa.actionDeck.some((entry) => entry.kind === 'bonus' && entry.id === BonusCardId.BC6_HEATING_SEASON);
    if (!present) {
      automa.actionDeck.splice(game.rng.nextInt(automa.actionDeck.length + 1), 0, {kind: 'bonus', id: BonusCardId.BC6_HEATING_SEASON});
      game.log('${0} shuffled Heating Season into its action deck', (b) => b.player(marsBotOf(game)));
    }
  },

  resolveBonusCard(game: IGame, id: BonusCardId): BonusCardOutcome {
    if (id !== BonusCardId.BC6_HEATING_SEASON) {
      throw new Error(`MarsBot Hartlan Heating does not own bonus card ${id}`);
    }
    return heatingSeason(game);
  },
};

/** Heat into the boiler — a corporation effect, attributed and logged once per arrival. */
function boiler(game: IGame, count: number, stat: string): void {
  const automa = game.automa;
  if (automa === undefined || count <= 0) {
    return;
  }
  const bot = marsBotOf(game);
  const prior = AutomaTurnLog.getCause(game);
  AutomaTurnLog.setCause(game, {kind: 'corporation'});
  game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
  try {
    automa.corpResources += count;
    game.log('${0} put ${1} heat on its corporation ${2}', (b) => b.player(bot).number(count).string('Hartlan Heating'));
  } finally {
    game.events.endScope();
    AutomaTurnLog.setCause(game, prior);
  }
  bumpCorpStat(game, stat, count);
}

/** BC6 Heating Season. Always ends in the recurring holding (never destroyed). */
function heatingSeason(game: IGame): BonusCardOutcome {
  const automa = game.automa;
  if (automa === undefined) {
    return 'discard';
  }
  bumpCorpStat(game, 'seasonPlayed');
  const bot = marsBotOf(game);
  if (automa.corpResources < SEASON_HEAT) {
    AutomaTurnLog.setBonusBranch(game, {key: 'Less than ${0} heat in the boiler — no season this generation', params: [`${SEASON_HEAT}`]});
    game.log('${0} has less than ${1} heat in its boiler — no season this generation', (b) => b.player(bot).number(SEASON_HEAT));
    return 'discard';
  }
  let steps = 0;
  let cards = 0;
  const prior = AutomaTurnLog.getCause(game);
  AutomaTurnLog.setCause(game, {kind: 'corporation'});
  game.events.beginEffect(bot, {kind: 'corporation', card: INFO.original, owner: bot.color}, 'automa-corporation');
  try {
    while (automa.corpResources >= SEASON_HEAT) {
      automa.corpResources -= SEASON_HEAT;
      bumpCorpStat(game, 'seasonHeat', SEASON_HEAT);
      if (game.getTemperature() < game.max.temperature) {
        // The shared raise: a law that diverts it, the TR, the bonuses and the journal line are its own.
        game.log('${0} spent ${1} heat from its boiler to raise the temperature', (b) => b.player(bot).number(SEASON_HEAT));
        AutomaTerraformer.raiseTemperature(game);
        steps++;
        bumpCorpStat(game, 'seasonSteps');
      } else {
        game.log('${0} spent ${1} heat from its boiler — Mars is warm enough, only the card', (b) => b.player(bot).number(SEASON_HEAT));
      }
      // The human card's other half — heat into cards — in the bot's currency: one drawn and resolved.
      if (drawAndResolveProjectCard(game)) {
        cards++;
        bumpCorpStat(game, 'seasonCards');
      }
    }
  } finally {
    game.events.endScope();
    AutomaTurnLog.setCause(game, prior);
  }
  AutomaTurnLog.setBonusBranch(game, {key: 'The boiler paid ${0} temperature step(s) and ${1} card(s)', params: [`${steps}`, `${cards}`]});
  return 'discard';
}
