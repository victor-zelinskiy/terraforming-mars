import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {failedAction} from '../../src/server/automa/AutomaFailedAction';
import {forceGenerationEnd} from '../TestingUtils';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

/** What each box hands the bot. */
const PER_BOX = 1;

/** A live Celestic game. Venus is on, or the corporation could not be seated. */
function celesticGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C26_CELESTIC): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation, venusNextExtension: true}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

describe('MarsBot Celestic (C26)', () => {
  describe('the printed card', () => {
    it('prints a Venus starting tag, a Venus > Jovian priority and all four boxes', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C26_CELESTIC);
      expect(info.original).eq(CardName.CELESTIC);
      expect(info.cardNumber).eq('C26');
      expect(info.startingTags).deep.eq([Tag.VENUS]);
      expect(info.draftPriority).deep.eq({type: 'tags', tags: [Tag.VENUS, Tag.JOVIAN]});
      expect(info.requiresAnyModule).deep.eq(['venus', 'colonies']);
      expect(info.resource).is.undefined;
      expect(info.corpBonusCards).is.empty;
      expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'setup', 'effect', 'roundStart']);
    });
  });

  describe('the SETUP box', () => {
    it('hands the bot one floater', () => {
      const [game] = celesticGame('-ce-setup');
      expect(stat(game, 'celesticSetup')).eq(1);
      expect(stat(game, 'celesticFloaters')).is.at.least(PER_BOX);
      expect(game.automa!.floaters).is.at.least(PER_BOX);
    });

    it('another corporation gets none', () => {
      const [game] = celesticGame('-ce-setup-other', MarsBotCorpId.C01_CREDICOR);
      expect(game.automa!.corpStats['celesticSetup']).is.undefined;
    });
  });

  describe('the EFFECT — a Failed Action pays a floater ON TOP', () => {
    it('the usual M€ is still paid, and a floater comes with it', () => {
      const [game, , bot] = celesticGame('-ce-failed');
      const floaters = game.automa!.floaters;
      const mc = bot.megaCredits;

      failedAction(game, 'track-maxed');

      expect(bot.megaCredits, '«in ADDITION to the usual MC» — the M€ is untouched')
        .is.greaterThan(mc);
      expect(game.automa!.floaters).eq(floaters + PER_BOX);
      expect(stat(game, 'celesticFailedActions')).eq(1);
    });

    it('EVERY Failed Action route pays — they all go through the one function', () => {
      const [game] = celesticGame('-ce-failed-all');
      const floaters = game.automa!.floaters;
      const reasons = ['no-tags', 'oceans-complete', 'no-tile-space', 'awards-funded'] as const;

      for (const reason of reasons) {
        failedAction(game, reason);
      }

      expect(game.automa!.floaters).eq(floaters + reasons.length * PER_BOX);
      expect(stat(game, 'celesticFailedActions')).eq(reasons.length);
    });

    it('another corporation gets only the M€', () => {
      const [game, , bot] = celesticGame('-ce-failed-other', MarsBotCorpId.C01_CREDICOR);
      const floaters = game.automa!.floaters;
      const mc = bot.megaCredits;

      failedAction(game, 'track-maxed');

      expect(bot.megaCredits).is.greaterThan(mc);
      expect(game.automa!.floaters).eq(floaters);
    });
  });

  describe('the ROUND START box', () => {
    it('pays once when the research phase opens', () => {
      const [game] = celesticGame('-ce-round');
      const floaters = game.automa!.floaters;
      game.generation = 2;

      AutomaCorporations.onRoundStart(game);

      expect(game.automa!.floaters).eq(floaters + PER_BOX);
      expect(stat(game, 'celesticRounds')).eq(1);
    });

    it('never pays twice in one generation — a reload or an undo cannot double it', () => {
      const [game] = celesticGame('-ce-round-twice');
      game.generation = 2;

      AutomaCorporations.onRoundStart(game);
      const floaters = game.automa!.floaters;
      AutomaCorporations.onRoundStart(game);
      AutomaCorporations.onRoundStart(game);

      expect(game.automa!.floaters).eq(floaters);
      expect(stat(game, 'celesticRounds')).eq(1);
    });

    it('pays again in the NEXT generation', () => {
      const [game] = celesticGame('-ce-round-next');
      game.generation = 2;
      AutomaCorporations.onRoundStart(game);
      game.generation = 3;

      AutomaCorporations.onRoundStart(game);

      expect(stat(game, 'celesticRounds')).eq(2);
    });

    it('the REAL generation transition fires it — the wiring, not just the dispatcher', () => {
      const [game] = celesticGame('-ce-wired');
      const gen = game.generation;

      forceGenerationEnd(game);

      expect(game.generation, 'a generation really passed').eq(gen + 1);
      // Counted by the box, not by the floater pool: the bot's own turns in
      // that generation may have taken Failed Actions, which pay too.
      expect(stat(game, 'celesticRounds'), 'gotoResearchPhase ran the box exactly once').eq(1);
    });

    it('another corporation is paid nothing at round start', () => {
      const [game] = celesticGame('-ce-round-other', MarsBotCorpId.C01_CREDICOR);
      const floaters = game.automa!.floaters;
      game.generation = 2;

      AutomaCorporations.onRoundStart(game);

      expect(game.automa!.floaters).eq(floaters);
    });
  });

  describe('state', () => {
    it('the floaters, the counters and the round marker survive a save/load round trip', () => {
      const [game] = celesticGame('-ce-serialize');
      game.generation = 2;
      AutomaCorporations.onRoundStart(game);
      failedAction(game, 'track-maxed');
      const floaters = game.automa!.floaters;

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C26_CELESTIC);
      expect(restored.automa!.floaters).eq(floaters);
      expect(restored.automa!.corpStats['celesticFailedActions']).eq(1);
      expect(restored.automa!.corpRoundStartGeneration,
        'the marker travels, so the round-start box cannot re-pay after a reload').eq(2);

      restored.generation = 2;
      AutomaCorporations.onRoundStart(restored);
      expect(restored.automa!.floaters, 'and it really does not re-pay').eq(floaters);
    });

    it('a save written before this corporation existed reads the marker as «never ran»', () => {
      const [game] = celesticGame('-ce-legacy');
      const serialized = structuredClone(game.serialize());
      delete (serialized.automa as Record<string, unknown> | undefined)?.corpRoundStartGeneration;

      const restored = Game.deserialize(serialized);

      expect(restored.automa!.corpRoundStartGeneration).eq(0);
    });

    it('the corporation is reachable through the shared registry', () => {
      const [game] = celesticGame('-ce-registry');
      expect(AutomaCorporations.activeCorp(game)?.info.id).eq(MarsBotCorpId.C26_CELESTIC);
    });
  });
});
