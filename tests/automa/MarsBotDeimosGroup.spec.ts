import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {marsBotDividendInfo} from '../../src/common/automa/MarsBotDividendData';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Game} from '../../src/server/Game';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {RUMOURS_PER_LOSS, SETUP_DELEGATES, SETUP_RUMOURS} from '../../src/server/automa/corps/MarsBotDeimosGroup';
import {TheDeimosGroup} from '../../src/server/cards/turmoilRedux/TheDeimosGroup';
import {TestPlayer} from '../TestPlayer';
import {seatQuiet, settleParliamentGates} from '../parliament/parliamentArrange';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

const CF9 = MarsBotCorpId.CF9_DEIMOS_GROUP;

function deimosGame(suffix: string): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation: CF9, coloniesExtension: true, turmoilReduxExpansion: true}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function rumours(game: IGame): number {
  return game.automa!.corpResources;
}

function corp() {
  return AutomaCorporations.corpFor(CF9);
}

describe('MarsBot The Deimos Group (CF9, the fork\'s own card) — «the Conspiracy Theory»', () => {
  describe('the card', () => {
    it('Mars, a least-advanced-track plate, rumours on the card, no bonus card, the Mars Parliament required', () => {
      const info = marsBotCorpInfo(CF9);
      expect(info.original).eq(CardName.THE_DEIMOS_GROUP);
      expect(info.cardNumber).eq('CF9');
      expect(info.startingTags).deep.eq([Tag.MARS]);
      expect(info.draftPriority).deep.eq({type: 'leastAdvancedTrack'});
      expect(info.requiresModules).deep.eq(['turmoilRedux']);
      expect(info.resource).eq('journalism');
      expect(info.corpBonusCards).deep.eq([]);
      expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'setup', 'effect', 'beforeActionPhase']);
    });

    it('collides with the human The Deimos Group, and drops out of a game without Turmoil Redux', () => {
      const [game, human] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true}, '-dg-collide');
      human.pickedCorporationCard = new TheDeimosGroup();
      expect(AutomaCorporations.eligibleCorpIds(game)).not.contains(CF9);
      const [plain] = testAutomaGame({}, '-dg-plain');
      expect(AutomaCorporations.eligibleCorpIds(plain)).not.contains(CF9);
    });
  });

  describe('SETUP — the first delegate and the rumour that precedes the group', () => {
    it('one delegate from the reserve on a resolution, a rumour on the card (spent at once by the before-action box), no influence bonus', () => {
      const [game, , bot] = deimosGame('-dg-setup');
      const parliament = game.parliament!;
      expect(game.automa!.corpStats.deimosSetupDelegates).eq(SETUP_DELEGATES);
      expect(parliament.votesOf(bot), 'the delegates stand on a resolution').to.be.at.least(SETUP_DELEGATES);
      // The setup's rumour is spent by the before-action-phase box the shared gate runs right after the setup.
      expect(game.automa!.corpStats.deimosPushes ?? 0).to.be.at.least(SETUP_RUMOURS);
      // The human card's +2 influence is NOT carried over (the owner, 2026-11-05).
      expect(parliament.influenceSourcesOf(bot).filter((e) => e.source === 'The Deimos Group')).deep.eq([]);
    });
  });

  describe('EFFECT — a vote MarsBot does not win puts a rumour', () => {
    it('a human or a neutral winner pays a rumour, once per sitting; MarsBot\'s own win pays nothing', () => {
      const [game, human, bot] = deimosGame('-dg-effect');
      const before = rumours(game);
      corp().onVoteDecided!(game, human.id, 101);
      expect(rumours(game)).eq(before + RUMOURS_PER_LOSS);
      corp().onVoteDecided!(game, human.id, 101);
      expect(rumours(game), 'the same sitting never pays twice').eq(before + RUMOURS_PER_LOSS);
      corp().onVoteDecided!(game, bot.id, 102);
      expect(rumours(game)).eq(before + RUMOURS_PER_LOSS);
      corp().onVoteDecided!(game, 'NEUTRAL', 103);
      expect(rumours(game)).eq(before + 2 * RUMOURS_PER_LOSS);
    });

    it('the real sitting dispatches it: a vote the human wins leaves a rumour on the card', () => {
      const [game, human, bot] = deimosGame('-dg-sitting');
      const parliament = game.parliament!;
      // A quiet table, every bot vote off it, the human's delegates on the first resolution — the human wins.
      for (let i = 0; i < parliament.slots.length; i++) {
        seatQuiet(parliament, i);
        parliament.slots[i].votes = [];
      }
      // Every delegate the human has on the first resolution — out of the bot's reach.
      for (let source = parliament.voteSource(human); source.ok; source = parliament.voteSource(human)) {
        parliament.placeVote(human, parliament.slots[0], source.source);
      }
      const before = rumours(game);
      human.popWaitingFor();
      game.playerHasPassed(human);
      game.playerIsFinishedTakingActions();
      runAllActions(game);
      settleParliamentGates(game);
      expect(parliament.lastPhase?.winner.player).eq(human.id);
      expect(parliament.lastPhase?.winner.player).not.eq(bot.id);
      expect(rumours(game) + (game.automa!.corpStats.deimosPushes ?? 0), 'the rumour arrived (or was already spent)').to.be.at.least(before + RUMOURS_PER_LOSS);
    });
  });

  describe('BEFORE ACTION PHASE — each rumour: a delegate and the hidden project', () => {
    it('2 rumours → 2 pushes of the least advanced track and up to 2 delegates; nothing left', () => {
      const [game, , bot] = deimosGame('-dg-spend');
      const automa = game.automa!;
      const parliament = game.parliament!;
      automa.corpStats.deimosPushes = 0;
      automa.corpStats.deimosDelegates = 0;
      automa.corpResources = 2;
      const votes = parliament.votesOf(bot);
      corp().beforeActionPhase!(game);
      expect(rumours(game)).eq(0);
      expect(automa.corpStats.deimosPushes).eq(2);
      expect(parliament.votesOf(bot) - votes).eq(automa.corpStats.deimosDelegates);
    });

    it('an empty reserve sends no delegate — the hidden project still advances', () => {
      const [game, , bot] = deimosGame('-dg-reserve');
      const automa = game.automa!;
      const parliament = game.parliament!;
      while (parliament.reserve(bot) > 0) {
        parliament.placeVote(bot, parliament.slots[0], 'reserve');
      }
      automa.corpStats.deimosPushes = 0;
      automa.corpStats.deimosDelegates = 0;
      automa.corpResources = 1;
      corp().beforeActionPhase!(game);
      expect(automa.corpStats.deimosDelegates).eq(0);
      expect(automa.corpStats.deimosPushes).eq(1);
      expect(rumours(game)).eq(0);
    });
  });

  describe('the dividend, its goal, save / load', () => {
    it('«Earth lobbyists»: 4 VP per 3 Earth cards of the other players; the goal reads the least advanced track; the rumours survive a save', () => {
      const [game] = deimosGame('-dg-div');
      const r = marsBotDividendInfo(CF9).rates;
      expect(r.each).eq(4);
      expect(r.per).eq(3);
      const tracks = game.automa!.board.tracks;
      for (const track of tracks) {
        track.position = Math.min(6, track.maxPosition);
      }
      tracks[0].position = 2;
      expect(corp().goal(game), 'the weakest spot').eq(2);
      game.automa!.corpResources = 3;
      const copy = Game.deserialize(game.serialize());
      expect(copy.automa!.corpResources).eq(3);
      expect(copy.automa!.corporation).eq(CF9);
    });
  });
});
