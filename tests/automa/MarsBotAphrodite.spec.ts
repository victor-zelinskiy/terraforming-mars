import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {BonusCardId, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {resolveBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {newCorporationCard} from '../../src/server/createCard';
import {VENUS_TRACK_INDEX} from '../../src/server/automa/boards/VenusMarsBot';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

/** What ONE step of Venus pays. */
const MC_PER_STEP = 2;

/** A live Aphrodite game. Venus is on, or the corporation could not be seated. */
function aphroditeGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C28_APHRODITE): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation, venusNextExtension: true}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

describe('MarsBot Aphrodite (C28)', () => {
  describe('the printed card', () => {
    it('prints a plant starting tag, a three-tag priority and a Venus module condition', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C28_APHRODITE);
      expect(info.original).eq(CardName.APHRODITE);
      expect(info.cardNumber).eq('C28');
      expect(info.startingTags).deep.eq([Tag.PLANT]);
      expect(info.draftPriority).deep.eq({type: 'tags', tags: [Tag.PLANT, Tag.ANIMAL, Tag.VENUS]});
      expect(info.requiresModules).deep.eq(['venus']);
      expect(info.requiresAnyModule).is.undefined;
      expect(info.resource).is.undefined;
      expect(info.trackCubes).is.undefined;
      expect(info.corpBonusCards).is.empty;
      expect(info.sections.map((s) => s.kind)).deep.eq(['draftPriority', 'setup', 'effect']);
    });
  });

  describe('the EFFECT — a cut of every Venus step', () => {
    it('the OPPONENT raising Venus pays the bot', () => {
      const [game, human, bot] = aphroditeGame('-ap-human');
      const before = bot.megaCredits;

      game.increaseVenusScaleLevel(human, 1);

      expect(bot.megaCredits).eq(before + MC_PER_STEP);
      expect(stat(game, 'aphroditeSteps')).eq(1);
      expect(stat(game, 'aphroditeMc')).eq(MC_PER_STEP);
    });

    it('the BOT raising Venus pays it just the same', () => {
      const [game, , bot] = aphroditeGame('-ap-bot');
      const before = bot.megaCredits;

      AutomaResolver.performTrackAction(game, 'venus', VENUS_TRACK_INDEX);

      expect(bot.megaCredits, 'the raise itself brings TR, the corporation brings M€')
        .is.at.least(before + MC_PER_STEP);
      expect(stat(game, 'aphroditeSteps')).eq(1);
    });

    it('is PER STEP — a two-step raise pays double, the twin\'s own reading', () => {
      const [game, human, bot] = aphroditeGame('-ap-twostep');
      const before = bot.megaCredits;

      game.increaseVenusScaleLevel(human, 2);

      expect(bot.megaCredits).eq(before + 2 * MC_PER_STEP);
      expect(stat(game, 'aphroditeSteps')).eq(2);
      expect(stat(game, 'aphroditeMc')).eq(2 * MC_PER_STEP);
    });

    it('a raise that CANNOT happen pays nothing — Venus already complete', () => {
      const [game, human, bot] = aphroditeGame('-ap-maxed');
      while (game.getVenusScaleLevel() < 30) {
        game.increaseVenusScaleLevel(human, 1);
      }
      const before = bot.megaCredits;
      const steps = stat(game, 'aphroditeSteps');

      game.increaseVenusScaleLevel(human, 1);

      expect(bot.megaCredits, 'a refused raise is not a raise').eq(before);
      expect(stat(game, 'aphroditeSteps')).eq(steps);
    });

    it('a raise CLAMPED by the ceiling pays only for the steps that landed', () => {
      const [game, human, bot] = aphroditeGame('-ap-clamped');
      while (game.getVenusScaleLevel() < 28) {
        game.increaseVenusScaleLevel(human, 1);
      }
      const before = bot.megaCredits;
      const steps = stat(game, 'aphroditeSteps');

      game.increaseVenusScaleLevel(human, 3); // Only ONE step fits.

      expect(game.getVenusScaleLevel()).eq(30);
      expect(stat(game, 'aphroditeSteps') - steps, 'one step, one payment').eq(1);
      expect(bot.megaCredits).eq(before + MC_PER_STEP);
    });

    it('another corporation collects nothing from the same raise', () => {
      const [game, human, bot] = aphroditeGame('-ap-other', MarsBotCorpId.C01_CREDICOR);
      const before = bot.megaCredits;

      game.increaseVenusScaleLevel(human, 1);

      expect(bot.megaCredits).eq(before);
      expect(game.automa!.corpStats['aphroditeSteps']).is.undefined;
    });
  });

  describe('«or the card Government Intervention» — the printed parenthetical', () => {
    it('B16 pays it, even though that raise grants no TR or bonuses', () => {
      const [game, , bot] = aphroditeGame('-ap-b16');
      // B16 raises Venus on ODD generations; force one and make sure the
      // Martian branch cannot take the card instead.
      game.generation = 1;
      const before = bot.megaCredits;
      const venus = game.getVenusScaleLevel();
      const tr = bot.terraformRating;

      resolveBonusCard(game, BonusCardId.B16_GOVERNMENT_INTERVENTION);

      expect(game.getVenusScaleLevel(), 'the World Government raised Venus').eq(venus + 2);
      expect(bot.terraformRating, 'with no TR, exactly as B16 prints').eq(tr);
      expect(stat(game, 'aphroditeSteps'), 'and the corporation was paid anyway').eq(1);
      expect(bot.megaCredits).eq(before + MC_PER_STEP);
    });

    it('another corporation is paid nothing for the same intervention', () => {
      const [game, , bot] = aphroditeGame('-ap-b16-other', MarsBotCorpId.C01_CREDICOR);
      game.generation = 1;
      const before = bot.megaCredits;

      resolveBonusCard(game, BonusCardId.B16_GOVERNMENT_INTERVENTION);

      expect(bot.megaCredits).eq(before);
    });
  });

  describe('the human twin', () => {
    it('the engine pays the HUMAN Aphrodite the same rate from the same place', () => {
      // The two entities print one rule; this is the number the bot inherits.
      const [game, human] = aphroditeGame('-ap-twin', MarsBotCorpId.C01_CREDICOR);
      const before = human.megaCredits;
      human.playedCards.push(newCorporationCard(CardName.APHRODITE)!);

      game.increaseVenusScaleLevel(human, 2);

      expect(human.megaCredits - before, 'the twin is 2 M€ per STEP').is.at.least(2 * MC_PER_STEP);
    });
  });

  describe('state', () => {
    it('the counters survive a save/load round trip', () => {
      const [game, human] = aphroditeGame('-ap-serialize');
      game.increaseVenusScaleLevel(human, 1);

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C28_APHRODITE);
      expect(restored.automa!.corpStats['aphroditeMc']).eq(MC_PER_STEP);
    });

    it('the corporation is reachable through the shared registry', () => {
      const [game] = aphroditeGame('-ap-registry');
      expect(AutomaCorporations.activeCorp(game)?.info.id).eq(MarsBotCorpId.C28_APHRODITE);
    });
  });
});
