import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {MAX_OCEAN_TILES} from '../../src/common/constants';
import {BonusCardId, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {marsBotDividendInfo} from '../../src/common/automa/MarsBotDividendData';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Board} from '../../src/server/boards/Board';
import {Game} from '../../src/server/Game';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {DIKE_COST, POLDERS_BEFORE_BURN, drainableSpaces} from '../../src/server/automa/corps/MarsBotPolderTechDutch';
import {PolderTechDutch} from '../../src/server/cards/promo/PolderTechDutch';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

const CF3 = MarsBotCorpId.CF3_POLDERTECH_DUTCH;
const BC3 = BonusCardId.BC3_INPOLDERING;

function polderGame(suffix: string): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation: CF3}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function resolve(game: IGame) {
  const outcome = resolveBonusCard(game, BC3);
  routeBonusCard(game, BC3, outcome);
  runAllActions(game);
  return outcome;
}

/** Bot greeneries standing on spaces reserved for oceans — the polders. */
function polders(game: IGame, bot: IPlayer) {
  return game.board.spaces.filter((s) => s.spaceType === SpaceType.OCEAN && Board.isGreenerySpace(s) && s.player?.id === bot.id);
}

describe('MarsBot PolderTECH Dutch (CF3, the fork\'s own card) — «the Polder»', () => {
  describe('the card', () => {
    it('an Earth tag, a plant-then-Earth draft plate, setup / effect / before-action-phase boxes, its own BC3, no module condition', () => {
      const info = marsBotCorpInfo(CF3);
      expect(info.original).eq(CardName.POLDERTECH_DUTCH);
      expect(info.cardNumber).eq('CF3');
      expect(info.startingTags).deep.eq([Tag.EARTH]);
      expect(info.corpBonusCards).deep.eq([BC3]);
      expect(info.requiresModules).is.undefined;
      expect(info.draftPriority).deep.eq({type: 'tags', tags: [Tag.PLANT, Tag.EARTH]});
      expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'setup', 'effect', 'beforeActionPhase']);
    });

    it('collides with the human PolderTECH Dutch', () => {
      const [game, human] = testAutomaGame({}, '-pd-collide');
      human.pickedCorporationCard = new PolderTechDutch();
      expect(AutomaCorporations.eligibleCorpIds(game)).not.contains(CF3);
    });
  });

  describe('SETUP — an ocean and a greenery beside it', () => {
    it('the bot owns a greenery touching an ocean from the first generation', () => {
      const [game, , bot] = polderGame('-pd-setup');
      expect(game.board.getOceanSpaces().length, 'the ocean').to.be.at.least(1);
      const touching = game.board.spaces.filter((s) => Board.isGreenerySpace(s) && s.player?.id === bot.id &&
        game.board.getAdjacentSpaces(s).some((n) => Board.isOceanSpace(n)));
      expect(touching.length, 'the greenery beside it').to.be.at.least(1);
      expect(game.automa!.corpStats.polderSetupGreeneries).eq(1);
    });
  });

  describe('EFFECT — wind and land pay 1 M€ each', () => {
    it('an ocean and a greenery of the bot each pay it 1 M€; a human tile pays nothing', () => {
      const [game, human, bot] = polderGame('-pd-pay');
      const stats = game.automa!.corpStats;
      const wind = stats.polderWindMc ?? 0;
      const land = stats.polderLandMc ?? 0;
      const ocean = game.board.getAvailableSpacesForOcean(bot)[0];
      game.addOcean(bot, ocean);
      expect(stats.polderWindMc).eq(wind + 1);
      const green = game.board.getAvailableSpacesForGreenery(bot)[0];
      game.addGreenery(bot, green);
      expect(stats.polderLandMc).eq(land + 1);
      game.addGreenery(human, game.board.getAvailableSpacesForGreenery(human)[0]);
      expect(stats.polderLandMc).eq(land + 1);
    });
  });

  describe('BC3 INPOLDERING — paid land won from the sea, burnt after the third', () => {
    it('pays 10 M€ and lays a greenery on an ocean space — no longer an ocean space for anyone', () => {
      const [game, human, bot] = polderGame('-pd-one');
      bot.megaCredits = 30;
      const oceans = game.board.getOceanSpaces().length;
      expect(resolve(game)).eq('discard');
      const won = polders(game, bot);
      expect(won).has.length(1);
      expect(bot.megaCredits).to.be.lessThan(30 - DIKE_COST + 10); // paid (icons / oceans may pay a little back)
      expect(game.automa!.corpStats.polderDikeMc).eq(DIKE_COST);
      expect(game.board.getOceanSpaces().length, 'a polder is no ocean').eq(oceans);
      expect(game.board.getAvailableSpacesForOcean(human).map((s) => s.id)).not.contains(won[0].id);
      expect(game.automa!.recurringBonusCards).contains(BC3);
    });

    it('cannot pay → nothing at all', () => {
      const [game, , bot] = polderGame('-pd-poor');
      bot.megaCredits = DIKE_COST - 1;
      resolve(game);
      expect(polders(game, bot)).has.length(0);
      expect(bot.megaCredits).eq(DIKE_COST - 1);
    });

    it('the third polder destroys the card — out of the recurring pool for good', () => {
      const [game, , bot] = polderGame('-pd-burn');
      // The card is played by being DRAWN — out of the deck it was dealt into.
      game.automa!.actionDeck = game.automa!.actionDeck.filter((e) => !(e.kind === 'bonus' && e.id === BC3));
      for (let i = 1; i <= POLDERS_BEFORE_BURN; i++) {
        bot.megaCredits = 30;
        const outcome = resolve(game);
        expect(outcome, `polder ${i}`).eq(i === POLDERS_BEFORE_BURN ? 'destroy' : 'discard');
      }
      expect(polders(game, bot)).has.length(POLDERS_BEFORE_BURN);
      expect(game.automa!.recurringBonusCards).not.contains(BC3);
      AutomaCorporations.corpFor(CF3).beforeActionPhase!(game);
      expect(game.automa!.actionDeck.some((e) => e.kind === 'bonus' && e.id === BC3), 'never dealt again').is.false;
    });

    it('THE NINE OCEANS ARE SACRED: no polder when the free ocean spaces only just cover the oceans still to place', () => {
      const [game, , bot] = polderGame('-pd-safe');
      const free = game.board.spaces.filter((s) => s.spaceType === SpaceType.OCEAN && s.tile === undefined && s.player === undefined);
      const left = MAX_OCEAN_TILES - game.board.getOceanSpaces().length;
      // Claim free ocean spaces (a neutral cube) until exactly `left` remain.
      for (const s of free.slice(0, Math.max(0, free.length - left))) {
        s.player = game.players.find((p) => !p.isMarsBot); // reserved → not free
      }
      expect(drainableSpaces(game)).has.length(0);
      bot.megaCredits = 30;
      const oceans = game.board.getOceanSpaces().length;
      resolve(game);
      expect(polders(game, bot)).has.length(0);
      expect(game.board.getOceanSpaces().length, 'an ocean instead').eq(oceans + 1);
    });
  });

  describe('the dividend, its goal, save / load', () => {
    it('«Dikes»: 6 VP per bot greenery next to an ocean; the goal counts building tags; the polders survive a save', () => {
      const [game, , bot] = polderGame('-pd-div');
      const corp = AutomaCorporations.corpFor(CF3);
      const r = marsBotDividendInfo(CF3).rates;
      const dikes = game.board.spaces.filter((s) => Board.isGreenerySpace(s) && s.player?.id === bot.id &&
        game.board.getAdjacentSpaces(s).some((n) => Board.isOceanSpace(n))).length;
      expect(corp.dividend(game).vp).eq(dikes * r.each);
      const before = corp.goal(game);
      game.automa!.playedPile.push(CardName.MINE); // a building tag
      expect(corp.goal(game)).eq(before + 1);
      bot.megaCredits = 30;
      resolve(game);
      const copy = Game.deserialize(game.serialize());
      expect(polders(copy, copy.players.find((p) => p.isMarsBot)!)).has.length(1);
    });
  });
});
