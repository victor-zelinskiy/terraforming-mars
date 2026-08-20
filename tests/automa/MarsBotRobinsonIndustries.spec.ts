import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {BonusCardId, MARSBOT_MAX_TRACK_POSITION, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {corpOwningBonusCard, marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

const B28 = BonusCardId.B28_DIVERSIFICATION;
/** The printed setup gift. */
const SETUP_MC = 10;
/** What B28 charges. */
const COST_MC = 4;
/** The Failed Action compensation on Normal — what a maxed board pays instead. */
const FAILED_ACTION_MC = 5;

/** A live Robinson Industries game with the corporation seated (setup + gen-1 BAP run). */
function robinsonGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C15_ROBINSON_INDUSTRIES): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

function b28Count(game: IGame): number {
  return game.automa!.actionDeck.filter((e) => e.kind === 'bonus' && e.id === B28).length;
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

function at(game: IGame, index: number): number {
  return game.automa!.board.tracks[index].position;
}

/** Park every track on `position` — the tie the printed card resolves «topmost». */
function levelTracks(game: IGame, position: number) {
  game.automa!.board.tracks.forEach((t) => {
    t.position = position;
  });
}

describe('MarsBot Robinson Industries (C15) + B28 Diversification', () => {
  describe('the printed card', () => {
    it('prints no starting tag and no draft priority — a setup box and a before-action-phase box', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C15_ROBINSON_INDUSTRIES);
      expect(info.original).eq(CardName.ROBINSON_INDUSTRIES);
      expect(info.cardNumber).eq('C15');
      expect(info.startingTags).is.empty;
      expect(info.draftPriority).is.undefined;
      expect(info.resource).is.undefined;
      expect(info.trackCubes).is.undefined;
      expect(info.corpBonusCards).deep.eq([B28]);
      expect(info.sections.map((s) => s.kind)).deep.eq(['setup', 'beforeActionPhase']);
      expect(corpOwningBonusCard(B28)?.id, 'B28 belongs to Robinson Industries').eq(MarsBotCorpId.C15_ROBINSON_INDUSTRIES);
    });
  });

  describe('the SETUP box', () => {
    it('hands MarsBot exactly 10 M€ more than a corporation with no gift', () => {
      const [, , robinson] = robinsonGame('-ri-setup');
      // C01 has no Setup box and no starting tags either, so the ONLY
      // difference between the two openings is this card's printed gift.
      const [, , credicor] = robinsonGame('-ri-setup-base', MarsBotCorpId.C01_CREDICOR);
      expect(robinson.megaCredits - credicor.megaCredits).eq(SETUP_MC);
      expect(robinson.megaCredits).is.at.least(SETUP_MC);
    });

    it('seeds no cubes and no white markers — the mat is untouched', () => {
      const [game] = robinsonGame('-ri-mat');
      expect(AutomaCorporations.cubesOf(game)).is.empty;
      expect(marsBotCorpInfo(MarsBotCorpId.C15_ROBINSON_INDUSTRIES).whiteMarkerTracks).is.undefined;
    });
  });

  describe('B28 lifecycle — a corporation-owned recurring action card', () => {
    it('generation 1: the Before-Action-Phase box puts exactly one B28 in the deck and in the recurring pool', () => {
      const [game, human] = testAutomaGame({corporation: MarsBotCorpId.C15_ROBINSON_INDUSTRIES}, '-ri-g1');
      expect(b28Count(game), 'the deck was built before the corporation existed').eq(0);

      game.playerIsFinishedWithResearchPhase(human);

      expect(b28Count(game)).eq(1);
      expect(game.automa!.recurringBonusCards.filter((id) => id === B28)).has.length(1);
    });

    it('never duplicates itself, however often the box runs', () => {
      const [game] = robinsonGame('-ri-idempotent');
      // Force the box open again (an undo or a reload replays the gate) —
      // twice, so a missing presence check would show up as two or three.
      for (let i = 0; i < 2; i++) {
        game.automa!.corpBapGeneration = 0;
        AutomaCorporations.onActionPhaseStart(game);
      }
      expect(b28Count(game)).eq(1);
      expect(game.automa!.recurringBonusCards.filter((id) => id === B28)).has.length(1);
    });

    it('a generation that already consumed B28 gets it back — one, not two', () => {
      const [game] = robinsonGame('-ri-reinsert');
      const automa = game.automa!;
      automa.actionDeck = automa.actionDeck.filter((e) => !(e.kind === 'bonus' && e.id === B28));
      expect(b28Count(game)).eq(0);

      automa.corpBapGeneration = 0;
      AutomaCorporations.onActionPhaseStart(game);

      expect(b28Count(game)).eq(1);
      expect(automa.recurringBonusCards.filter((id) => id === B28)).has.length(1);
    });

    it('a reload keeps exactly one B28 in the deck and the pool', () => {
      const [game] = robinsonGame('-ri-load');
      const restored = Game.deserialize(structuredClone(game.serialize()));
      expect(restored.automa!.actionDeck.filter((e) => e.kind === 'bonus' && e.id === B28)).has.length(1);
      expect(restored.automa!.recurringBonusCards.filter((id) => id === B28)).has.length(1);
      expect(restored.automa!.corpBapGeneration).eq(1);
    });

    it('another corporation never sees B28', () => {
      const [game] = robinsonGame('-ri-other', MarsBotCorpId.C01_CREDICOR);
      expect(b28Count(game)).eq(0);
      expect(game.automa!.recurringBonusCards).not.contains(B28);
    });
  });

  describe('B28 — the push', () => {
    it('advances the track that lags furthest behind', () => {
      const [game, , bot] = robinsonGame('-ri-push');
      levelTracks(game, 8);
      game.automa!.board.tracks[THARSIS_TRACK.SCIENCE].position = 4; // Science #5 is blank.
      bot.megaCredits = 10;

      resolveBonusCard(game, B28);

      expect(at(game, THARSIS_TRACK.SCIENCE), 'the laggard moved').eq(5);
      expect(at(game, THARSIS_TRACK.BUILDING), 'nothing else did').eq(8);
      expect(stat(game, 'diversificationPushes')).eq(1);
      expect(stat(game, 'diversificationPlayed')).eq(1);
    });

    it('a tie goes to the TOPMOST track', () => {
      const [game, , bot] = robinsonGame('-ri-tie');
      levelTracks(game, 3); // Building #4 is blank — no cascade, no tile.
      bot.megaCredits = 10;

      resolveBonusCard(game, B28);

      expect(at(game, THARSIS_TRACK.BUILDING), 'the topmost track of the tie').eq(4);
      expect(at(game, THARSIS_TRACK.SPACE)).eq(3);
      expect(stat(game, 'diversificationPushes')).eq(1);
    });
  });

  describe('B28 — «loses 4 MC, if able»', () => {
    it('pays the full 4 M€ when it can', () => {
      const [game, , bot] = robinsonGame('-ri-pay');
      levelTracks(game, 3);
      bot.megaCredits = 10;

      resolveBonusCard(game, B28);

      expect(bot.megaCredits).eq(10 - COST_MC);
      expect(stat(game, 'diversificationMc')).eq(COST_MC);
      expect(stat(game, 'diversificationFree')).eq(0);
    });

    it('pays NOTHING below 4 M€ — «if able» is all-or-nothing, never a partial payment', () => {
      const [game, , bot] = robinsonGame('-ri-poor');
      levelTracks(game, 3);
      bot.megaCredits = 3;

      resolveBonusCard(game, B28);

      expect(bot.megaCredits, 'not a single M€ left the bank').eq(3);
      expect(stat(game, 'diversificationMc')).eq(0);
      expect(stat(game, 'diversificationFree')).eq(1);
      expect(stat(game, 'diversificationPushes'), 'the push happened anyway').eq(1);
    });

    it('exactly 4 M€ is enough', () => {
      const [game, , bot] = robinsonGame('-ri-exact');
      levelTracks(game, 3);
      bot.megaCredits = COST_MC;

      resolveBonusCard(game, B28);

      expect(bot.megaCredits).eq(0);
      expect(stat(game, 'diversificationMc')).eq(COST_MC);
    });
  });

  describe('B28 — a board with nothing left to push', () => {
    it('takes the official Failed Action and still pays, out of what that action produced', () => {
      const [game, , bot] = robinsonGame('-ri-maxed');
      levelTracks(game, MARSBOT_MAX_TRACK_POSITION);
      bot.megaCredits = 0;

      resolveBonusCard(game, B28);

      // The printed order proves itself: the advance is attempted FIRST (a
      // maxed board pays the 5 M€ Failed Action compensation), and only then
      // does the card charge its 4.
      expect(bot.megaCredits).eq(FAILED_ACTION_MC - COST_MC);
      expect(stat(game, 'diversificationPushes'), 'nothing moved').eq(0);
      expect(stat(game, 'diversificationPlayed')).eq(1);
      expect(stat(game, 'diversificationMc')).eq(COST_MC);
    });
  });

  describe('B28 — its fate', () => {
    it('returns to the recurring holding, never to the discard and never destroyed', () => {
      const [game, , bot] = robinsonGame('-ri-fate');
      levelTracks(game, 3);
      bot.megaCredits = 10;

      const outcome = resolveBonusCard(game, B28);
      routeBonusCard(game, B28, outcome);

      expect(outcome).eq('discard');
      expect(game.automa!.bonusDiscard).not.contains(B28);
      expect(game.automa!.destroyedBonusCards).not.contains(B28);
      expect(game.automa!.recurringBonusCards).contains(B28);
    });

    it('a foreign bonus card is refused by the corporation', () => {
      const [game] = robinsonGame('-ri-foreign');
      expect(() => resolveBonusCard(game, BonusCardId.B23_RAPID_SPROUTING)).to.throw();
    });
  });

  describe('state', () => {
    it('the counters survive a save/load round trip', () => {
      const [game, , bot] = robinsonGame('-ri-serialize');
      levelTracks(game, 3);
      bot.megaCredits = 10;
      resolveBonusCard(game, B28);

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C15_ROBINSON_INDUSTRIES);
      expect(restored.automa!.corpStats['diversificationPushes']).eq(1);
      expect(restored.automa!.corpStats['diversificationMc']).eq(COST_MC);
      expect(restored.automa!.recurringBonusCards).contains(B28);
    });
  });
});
