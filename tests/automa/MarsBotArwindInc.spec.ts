import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {BonusCardId, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {marsBotDividendInfo} from '../../src/common/automa/MarsBotDividendData';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Game} from '../../src/server/Game';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {LAUNCH_FIGHTERS} from '../../src/server/automa/corps/MarsBotArwindInc';
import {ChairmanSeat} from '../../src/server/parliament/quests/ChairmanSeat';
import {ArwindInc} from '../../src/server/cards/turmoilRedux/ArwindInc';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

const CF5 = MarsBotCorpId.CF5_ARWIND_INC;
const BC5 = BonusCardId.BC5_OFF_THE_SLIPWAY;

function arwindGame(suffix: string): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation: CF5, coloniesExtension: true, turmoilReduxExpansion: true}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function hangar(game: IGame): number {
  return game.automa!.corpResources;
}

function resolve(game: IGame) {
  const outcome = resolveBonusCard(game, BC5);
  routeBonusCard(game, BC5, outcome);
  runAllActions(game);
  return outcome;
}

describe('MarsBot Arwind Inc. (CF5, the fork\'s own card) — «the Orbital Shipyard»', () => {
  describe('the card', () => {
    it('a Space tag, the hangar of fighters, its own BC5, the Mars Parliament required', () => {
      const info = marsBotCorpInfo(CF5);
      expect(info.original).eq(CardName.ARWIND_INC);
      expect(info.cardNumber).eq('CF5');
      expect(info.startingTags).deep.eq([Tag.SPACE]);
      expect(info.resource).eq('fighter');
      expect(info.corpBonusCards).deep.eq([BC5]);
      expect(info.requiresModules).deep.eq(['turmoilRedux']);
      expect(info.sections.map((s) => s.kind)).deep.eq(['setup', 'effect', 'beforeActionPhase']);
    });

    it('collides with the human Arwind Inc.; never seated without the Parliament', () => {
      const [game, human] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true}, '-ar-collide');
      expect(AutomaCorporations.eligibleCorpIds(game)).contains(CF5);
      human.pickedCorporationCard = new ArwindInc();
      expect(AutomaCorporations.eligibleCorpIds(game)).not.contains(CF5);
      const [plain] = testAutomaGame({}, '-ar-plain');
      expect(AutomaCorporations.eligibleCorpIds(plain)).not.contains(CF5);
    });
  });

  describe('EFFECT — the hangar fills', () => {
    it('its own Space tag put the first fighter («including this»)', () => {
      const [game] = arwindGame('-ar-start');
      expect(game.automa!.corpStats.arwindSpaceFighters).to.be.at.least(1);
    });

    it('a space tag puts a fighter; any other tag does not', () => {
      const [game] = arwindGame('-ar-tag');
      const corp = AutomaCorporations.corpFor(CF5);
      const before = hangar(game);
      corp.onTagResolved!(game, Tag.SPACE);
      expect(hangar(game)).eq(before + 1);
      corp.onTagResolved!(game, Tag.JOVIAN);
      corp.onTagResolved!(game, Tag.BUILDING);
      expect(hangar(game)).eq(before + 1);
    });

    it('each step of MarsBot\'s Agenda marker puts a fighter — one dispatch per walk, through the real walk', () => {
      const [game, , bot] = arwindGame('-ar-agenda');
      const before = hangar(game);
      const walk = ChairmanSeat.walkAgenda(bot, game.parliament!, 2, {reason: 'quest'});
      runAllActions(game);
      expect(walk?.steps.length).eq(2);
      expect(hangar(game)).eq(before + 2);
      expect(game.automa!.corpStats.arwindAgendaFighters).eq(2);
    });

    it('a HUMAN walk puts nothing on the bot\'s card', () => {
      const [game, human] = arwindGame('-ar-human');
      const before = hangar(game);
      ChairmanSeat.walkAgenda(human, game.parliament!, 1, {reason: 'quest'});
      runAllActions(game);
      expect(hangar(game)).eq(before);
    });
  });

  describe('BC5 OFF THE SLIPWAY — fighters launch a space card off the deck', () => {
    it('3 fighters: a space card is revealed and resolved, the others discarded; its own space tag refuels the hangar', () => {
      const [game] = arwindGame('-ar-launch');
      game.automa!.corpResources = LAUNCH_FIGHTERS;
      const pile = game.automa!.playedPile.length;
      const discards = game.projectDeck.discardPile.length;
      const stats = game.automa!.corpStats;
      expect(resolve(game)).eq('discard');
      expect(stats.slipwayLaunches).eq(1);
      const launched = game.automa!.playedPile.slice(pile);
      expect(launched.length, 'one card played').eq(1);
      const card = game.projectDeck.discardPile.slice(discards); // only non-space cards went there
      for (const c of card) {
        expect(AutomaResolver.printedTags(c)).not.contains(Tag.SPACE);
      }
      expect(hangar(game), 'the launch spent 3; the ship\'s space tag(s) put fighters back').to.be.at.least(1);
      expect(game.automa!.recurringBonusCards).contains(BC5);
    });

    it('fewer than 3 fighters → nothing at all', () => {
      const [game] = arwindGame('-ar-short');
      game.automa!.corpResources = LAUNCH_FIGHTERS - 1;
      const pile = game.automa!.playedPile.length;
      expect(resolve(game)).eq('discard');
      expect(hangar(game)).eq(LAUNCH_FIGHTERS - 1);
      expect(game.automa!.playedPile.length).eq(pile);
    });
  });

  describe('the dividend, its goal, save / load', () => {
    it('«Fleet contracts»: 3 VP per 5 space cards the other players played; the goal counts space events; the hangar survives a save', () => {
      const [game] = arwindGame('-ar-div');
      const corp = AutomaCorporations.corpFor(CF5);
      const r = marsBotDividendInfo(CF5).rates;
      expect(r.each).eq(3);
      expect(r.per).eq(5);
      const goal = corp.goal(game);
      game.automa!.playedPile.push(CardName.ASTEROID); // a space event
      game.automa!.playedPile.push(CardName.SATELLITES); // a space card, not an event
      expect(corp.goal(game)).eq(goal + 1);
      game.automa!.corpResources = 4;
      const copy = Game.deserialize(game.serialize());
      expect(copy.automa!.corpResources).eq(4);
      expect(copy.automa!.corporation).eq(CF5);
    });
  });
});
