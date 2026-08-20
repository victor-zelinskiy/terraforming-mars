import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {BonusCardId, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {corpOwningBonusCard, marsBotCorpInfo} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

const B24 = BonusCardId.B24_SUPPLY_AND_DEMAND;
/** What B24 withdraws when the card can cover it. */
const WITHDRAWAL_MC = 3;

/** A live Factorum game with the corporation seated (setup + gen-1 BAP run). */
function factorumGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C20_FACTORUM): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

/** Park a track one space below `position` so the next advance lands on it. */
function park(game: IGame, trackIndex: number, position: number) {
  game.automa!.board.tracks[trackIndex].position = position;
}

function onCard(game: IGame): number {
  return game.automa!.corpResources;
}

function b24InDeck(game: IGame): number {
  return game.automa!.actionDeck.filter((e) => e.kind === 'bonus' && e.id === B24).length;
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

describe('MarsBot Factorum (C20) + B24 Supply and Demand', () => {
  describe('the printed card', () => {
    it('prints a power starting tag, a white building marker and owns B24', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C20_FACTORUM);
      expect(info.original).eq(CardName.FACTORUM);
      expect(info.cardNumber).eq('C20');
      expect(info.startingTags).deep.eq([Tag.POWER]);
      expect(info.draftPriority).is.undefined;
      expect(info.trackCubes).is.undefined;
      expect(info.resource, 'the card stores M€').eq('megacredits');
      expect(info.whiteMarkerTracks).deep.eq([Tag.BUILDING]);
      expect(info.markerLegend, 'a marker always names what it reminds of').is.a('string').and.not.empty;
      expect(info.corpBonusCards).deep.eq([B24]);
      expect(info.sections.map((s) => s.kind)).deep.eq(['setup', 'effect', 'beforeActionPhase']);
      expect(corpOwningBonusCard(B24)?.id, 'B24 belongs to Factorum').eq(MarsBotCorpId.C20_FACTORUM);
    });
  });

  describe('the SETUP box — a reminder, nothing else', () => {
    it('paints the building track marker and puts NOTHING on the card', () => {
      const [game] = factorumGame('-fa-setup');
      expect(AutomaCorporations.whiteMarkerTrackIndexes(game)).deep.eq([THARSIS_TRACK.BUILDING]);
      // The starting POWER tag may have advanced its own track, but the till
      // starts empty — only BUILDING fills it.
      expect(onCard(game), 'the till starts empty').eq(0);
      expect(AutomaCorporations.cubesOf(game), 'a marker is not a track cube').is.empty;
    });
  });

  describe('the EFFECT — the building track fills the till', () => {
    it('one advance of the building track puts 1 M€ ON THE CARD, not in the bank', () => {
      const [game, , bot] = factorumGame('-fa-fill');
      const before = bot.megaCredits;
      park(game, THARSIS_TRACK.BUILDING, 3); // #4 prints nothing.

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      expect(onCard(game)).eq(1);
      expect(bot.megaCredits, 'the bot itself gained nothing').eq(before);
      expect(stat(game, 'factorumStored')).eq(1);
    });

    it('every advance counts — a run of them stacks up', () => {
      const [game] = factorumGame('-fa-stack');
      for (const target of [3, 12, 13]) { // #4, #13 and #14 print nothing loud.
        park(game, THARSIS_TRACK.BUILDING, target);
        AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);
      }
      expect(onCard(game)).is.at.least(3);
    });

    it('another track pays the card nothing', () => {
      const [game] = factorumGame('-fa-othertrack');
      park(game, THARSIS_TRACK.SCIENCE, 4); // Science #5 prints nothing.
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.SCIENCE);
      expect(onCard(game)).eq(0);
      expect(stat(game, 'factorumStored')).eq(0);
    });

    it('a MAXED building track pays nothing — a refused advance is not an advance', () => {
      const [game] = factorumGame('-fa-maxed');
      const track = game.automa!.board.tracks[THARSIS_TRACK.BUILDING];
      track.position = track.maxPosition;

      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      expect(onCard(game)).eq(0);
    });

    it('another corporation on the building track stores nothing', () => {
      const [game] = factorumGame('-fa-othercorp', MarsBotCorpId.C01_CREDICOR);
      park(game, THARSIS_TRACK.BUILDING, 3);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);
      expect(game.automa!.corpResources).eq(0);
      expect(game.automa!.corpStats['factorumStored']).is.undefined;
    });
  });

  describe('B24 lifecycle', () => {
    it('is in the deck and in the recurring pool from generation 1', () => {
      const [game] = factorumGame('-fa-b24');
      expect(b24InDeck(game)).eq(1);
      expect(game.automa!.recurringBonusCards.filter((id) => id === B24)).has.length(1);
    });

    it('stays in the holding pool, never in the discard', () => {
      const [game] = factorumGame('-fa-b24-fate');
      const outcome = resolveBonusCard(game, B24);
      routeBonusCard(game, B24, outcome);
      expect(outcome).eq('discard');
      expect(game.automa!.bonusDiscard).not.contains(B24);
      expect(game.automa!.recurringBonusCards).contains(B24);
    });

    it('a foreign bonus card is refused by the corporation', () => {
      const [game] = factorumGame('-fa-foreign');
      expect(() => resolveBonusCard(game, BonusCardId.B23_RAPID_SPROUTING)).to.throw();
    });
  });

  describe('B24 — «3 MC, or as much as possible»', () => {
    it('takes the full 3 M€ off a card that can cover it', () => {
      const [game, , bot] = factorumGame('-fa-full');
      game.automa!.corpResources = 5;
      const before = bot.megaCredits;

      resolveBonusCard(game, B24);

      expect(bot.megaCredits).eq(before + WITHDRAWAL_MC);
      expect(onCard(game)).eq(2);
      expect(stat(game, 'factorumWithdrawn')).eq(WITHDRAWAL_MC);
      expect(stat(game, 'supplyDemandEmpty')).eq(0);
    });

    it('takes PARTIALLY when the card holds less — not all-or-nothing', () => {
      const [game, , bot] = factorumGame('-fa-partial');
      game.automa!.corpResources = 2;
      const before = bot.megaCredits;
      const power = game.automa!.board.tracks[THARSIS_TRACK.ENERGY].position;

      resolveBonusCard(game, B24);

      expect(bot.megaCredits, 'everything that was there').eq(before + 2);
      expect(onCard(game)).eq(0);
      expect(game.automa!.board.tracks[THARSIS_TRACK.ENERGY].position,
        'a take of 2 is still a take — the fallback stays shut').eq(power);
      expect(stat(game, 'supplyDemandEmpty')).eq(0);
    });

    it('ONE M€ on the card is still a take, and the power track stays put', () => {
      const [game, , bot] = factorumGame('-fa-one');
      game.automa!.corpResources = 1;
      const before = bot.megaCredits;
      const power = game.automa!.board.tracks[THARSIS_TRACK.ENERGY].position;

      resolveBonusCard(game, B24);

      expect(bot.megaCredits).eq(before + 1);
      expect(game.automa!.board.tracks[THARSIS_TRACK.ENERGY].position).eq(power);
    });

    it('an EMPTY card advances the power track instead', () => {
      const [game, , bot] = factorumGame('-fa-empty');
      game.automa!.corpResources = 0;
      park(game, THARSIS_TRACK.ENERGY, 7); // Energy #8 prints nothing.
      const before = bot.megaCredits;

      resolveBonusCard(game, B24);

      expect(game.automa!.board.tracks[THARSIS_TRACK.ENERGY].position).eq(8);
      expect(bot.megaCredits, 'nothing was cashed').eq(before);
      expect(stat(game, 'supplyDemandEmpty')).eq(1);
      expect(stat(game, 'factorumWithdrawn')).eq(0);
    });
  });

  describe('the loop, end to end', () => {
    it('build → the till fills → the card cashes it out', () => {
      const [game, , bot] = factorumGame('-fa-loop');
      const before = bot.megaCredits;
      for (const target of [3, 12, 13]) {
        park(game, THARSIS_TRACK.BUILDING, target);
        AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);
      }
      const stored = onCard(game);
      expect(stored).is.at.least(3);

      resolveBonusCard(game, B24);

      expect(onCard(game)).eq(stored - WITHDRAWAL_MC);
      expect(bot.megaCredits).is.at.least(before + WITHDRAWAL_MC);
    });
  });

  describe('state', () => {
    it('the till and the counters survive a save/load round trip', () => {
      const [game] = factorumGame('-fa-serialize');
      park(game, THARSIS_TRACK.BUILDING, 3);
      AutomaResolver.advanceTrack(game, THARSIS_TRACK.BUILDING);

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C20_FACTORUM);
      expect(restored.automa!.corpResources).eq(1);
      expect(restored.automa!.corpStats['factorumStored']).eq(1);
      expect(restored.automa!.recurringBonusCards).contains(B24);
    });
  });
});
