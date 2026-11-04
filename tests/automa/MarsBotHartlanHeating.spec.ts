import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {MAX_TEMPERATURE} from '../../src/common/constants';
import {BonusCardId, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {marsBotDividendInfo} from '../../src/common/automa/MarsBotDividendData';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Game} from '../../src/server/Game';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {HEAT_PER_TILE, HEAT_PRODUCTION, SEASON_HEAT} from '../../src/server/automa/corps/MarsBotHartlanHeating';
import {HartlanHeating} from '../../src/server/cards/turmoilRedux/HartlanHeating';
import {TestPlayer} from '../TestPlayer';
import {runAllActions, setTemperature} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

const CF6 = MarsBotCorpId.CF6_HARTLAN_HEATING;
const BC6 = BonusCardId.BC6_HEATING_SEASON;

function hartlanGame(suffix: string): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation: CF6}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function boiler(game: IGame): number {
  return game.automa!.corpResources;
}

function resolve(game: IGame) {
  const outcome = resolveBonusCard(game, BC6);
  routeBonusCard(game, BC6, outcome);
  runAllActions(game);
  return outcome;
}

describe('MarsBot Hartlan Heating (CF6, the fork\'s own card) — «the Construction Boiler»', () => {
  describe('the card', () => {
    it('Space + Building, the boiler of heat, its own BC6, no module condition', () => {
      const info = marsBotCorpInfo(CF6);
      expect(info.original).eq(CardName.HARTLAN_HEATING);
      expect(info.cardNumber).eq('CF6');
      expect(info.startingTags).deep.eq([Tag.SPACE, Tag.BUILDING]);
      expect(info.resource).eq('heat');
      expect(info.corpBonusCards).deep.eq([BC6]);
      expect(info.requiresModules).is.undefined;
      expect(info.draftPriority).deep.eq({type: 'tags', tags: [Tag.BUILDING]});
      expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'effect', 'beforeActionPhase']);
    });

    it('collides with the human Hartlan Heating', () => {
      const [game, human] = testAutomaGame({}, '-hh-collide');
      human.pickedCorporationCard = new HartlanHeating();
      expect(AutomaCorporations.eligibleCorpIds(game)).not.contains(CF6);
    });
  });

  describe('EFFECT + BEFORE ACTION PHASE — the boiler heats', () => {
    it('a city, a greenery and an ocean of the bot each put 2 heat; a human tile puts nothing', () => {
      const [game, human, bot] = hartlanGame('-hh-tiles');
      const before = boiler(game);
      game.addCity(bot, game.board.getAvailableSpacesForCity(bot)[0]);
      game.addGreenery(bot, game.board.getAvailableSpacesForGreenery(bot)[0]);
      game.addOcean(bot, game.board.getAvailableSpacesForOcean(bot)[0]);
      expect(boiler(game)).eq(before + 3 * HEAT_PER_TILE);
      game.addGreenery(human, game.board.getAvailableSpacesForGreenery(human)[0]);
      expect(boiler(game)).eq(before + 3 * HEAT_PER_TILE);
    });

    it('the before-action box adds the heat production and deals BC6 once (deltas only — it already ran once)', () => {
      const [game] = hartlanGame('-hh-bap');
      const automa = game.automa!;
      expect(automa.corpStats.hartlanProductionHeat).eq(HEAT_PRODUCTION);
      expect(automa.recurringBonusCards).contains(BC6);
      automa.actionDeck = automa.actionDeck.filter((e) => !(e.kind === 'bonus' && e.id === BC6));
      const before = boiler(game);
      AutomaCorporations.corpFor(CF6).beforeActionPhase!(game);
      AutomaCorporations.corpFor(CF6).beforeActionPhase!(game);
      expect(boiler(game)).eq(before + 2 * HEAT_PRODUCTION);
      expect(automa.actionDeck.filter((e) => e.kind === 'bonus' && e.id === BC6)).has.length(1);
    });
  });

  describe('BC6 HEATING SEASON — every full 11 heat: a temperature step and a card', () => {
    it('23 heat → two portions: +2 °C steps, two cards played, 1 heat left; the card recurs', () => {
      const [game] = hartlanGame('-hh-season');
      game.automa!.corpResources = 2 * SEASON_HEAT + 1;
      const temperature = game.getTemperature();
      const pile = game.automa!.playedPile.length;
      expect(resolve(game)).eq('discard');
      expect(game.getTemperature(), 'two steps of 2 °C (a played card may add its own)').to.be.at.least(temperature + 4);
      expect(game.automa!.playedPile.length).eq(pile + 2);
      expect(game.automa!.corpStats.seasonSteps).eq(2);
      expect(game.automa!.corpStats.seasonCards).eq(2);
      // The two cards' own tiles may heat the boiler again — at least the leftover heat is there.
      expect(boiler(game)).to.be.at.least(1);
      expect(game.automa!.recurringBonusCards).contains(BC6);
    });

    it('a warm Mars: the portion buys the card alone — no Failed Action for the maxed temperature', () => {
      const [game, , bot] = hartlanGame('-hh-warm');
      setTemperature(game, MAX_TEMPERATURE);
      game.automa!.corpResources = SEASON_HEAT;
      const pile = game.automa!.playedPile.length;
      const mc = bot.megaCredits;
      resolve(game);
      expect(game.getTemperature()).eq(MAX_TEMPERATURE);
      expect(game.automa!.playedPile.length).eq(pile + 1);
      expect(game.automa!.corpStats.seasonSteps ?? 0).eq(0);
      expect(bot.megaCredits, 'no Failed Action compensation for the temperature').to.be.lessThan(mc + 5);
    });

    it('less than 11 heat → nothing at all', () => {
      const [game] = hartlanGame('-hh-short');
      game.automa!.corpResources = SEASON_HEAT - 1;
      const temperature = game.getTemperature();
      const pile = game.automa!.playedPile.length;
      resolve(game);
      expect(boiler(game)).eq(SEASON_HEAT - 1);
      expect(game.getTemperature()).eq(temperature);
      expect(game.automa!.playedPile.length).eq(pile);
    });
  });

  describe('the dividend, its goal, save / load', () => {
    it('«Heating contracts»: 3 VP per 5 building cards of the other players; the goal counts temperature requirements; the boiler survives a save', () => {
      const [game] = hartlanGame('-hh-div');
      const corp = AutomaCorporations.corpFor(CF6);
      const r = marsBotDividendInfo(CF6).rates;
      expect(r.each).eq(3);
      expect(r.per).eq(5);
      const goal = corp.goal(game);
      game.automa!.playedPile.push(CardName.ARCHAEBACTERIA); // a temperature requirement (max −18 °C)
      game.automa!.playedPile.push(CardName.MINE); // no requirement
      expect(corp.goal(game)).eq(goal + 1);
      game.automa!.corpResources = 7;
      const copy = Game.deserialize(game.serialize());
      expect(copy.automa!.corpResources).eq(7);
      expect(copy.automa!.corporation).eq(CF6);
    });
  });
});
