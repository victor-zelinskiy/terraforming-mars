import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {BonusCardId, MarsBotCorpId} from '../../src/common/automa/AutomaTypes';
import {marsBotCorpInfo, corpOwningBonusCard} from '../../src/common/automa/MarsBotCorpData';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {AutomaCorporations} from '../../src/server/automa/corps/AutomaCorporations';
import {MarsBotUtopiaInvest} from '../../src/server/automa/corps/MarsBotUtopiaInvest';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

/**
 * A live Utopia Invest game. ⚠️ Its Before-Action-Phase box has ALREADY run
 * once by the first action phase (RB-B resolves those boxes after setup too),
 * so B32 is in the deck from the start and every counter is read as a DELTA.
 */
function utopiaGame(suffix: string, corporation: MarsBotCorpId = MarsBotCorpId.C39_UTOPIA_INVEST): [IGame, TestPlayer, IPlayer] {
  const [game, human, bot] = testAutomaGame({corporation}, suffix);
  game.playerIsFinishedWithResearchPhase(human);
  return [game, human, bot];
}

/** Resolve the printed bonus card directly. */
function playInvestors(game: IGame, corporation: MarsBotCorpId = MarsBotCorpId.C39_UTOPIA_INVEST) {
  return AutomaCorporations.corpFor(corporation).resolveBonusCard?.(game, BonusCardId.B32_INVESTORS);
}

function runBox(game: IGame, corporation: MarsBotCorpId = MarsBotCorpId.C39_UTOPIA_INVEST) {
  AutomaCorporations.corpFor(corporation).beforeActionPhase?.(game);
}

function positions(game: IGame): Array<number> {
  return game.automa!.board.tracks.map((track) => track.position);
}

function stat(game: IGame, key: string): number {
  return game.automa!.corpStats[key] ?? 0;
}

/** Put the mat in a known shape: index → position. */
function setTracks(game: IGame, shape: Record<number, number>) {
  for (const [index, position] of Object.entries(shape)) {
    game.automa!.board.tracks[Number(index)].position = position;
  }
}

describe('MarsBot Utopia Invest (C39)', () => {
  describe('the printed card', () => {
    it('prints TWO starting tags, owns B32 and has only a before-action-phase box', () => {
      const info = marsBotCorpInfo(MarsBotCorpId.C39_UTOPIA_INVEST);
      expect(info.original).eq(CardName.UTOPIA_INVEST);
      expect(info.cardNumber).eq('C39');
      // The corner box holds the building dome and the space starburst; the
      // HUMAN card prints a single building tag and never reaches here.
      expect(info.startingTags).deep.eq([Tag.BUILDING, Tag.SPACE]);
      expect(info.draftPriority, 'no priority plate is printed').is.undefined;
      expect(info.resource, 'nothing is stored on the card').is.undefined;
      expect(info.trackCubes).is.undefined;
      expect(info.corpBonusCards).deep.eq([BonusCardId.B32_INVESTORS]);
      expect(info.sections.map((s) => s.kind)).deep.eq(['beforeActionPhase']);
      expect(corpOwningBonusCard(BonusCardId.B32_INVESTORS)?.id).eq(MarsBotCorpId.C39_UTOPIA_INVEST);
    });

    it('is registered and answers only to its own hooks', () => {
      const corp = AutomaCorporations.corpFor(MarsBotCorpId.C39_UTOPIA_INVEST);
      expect(corp).eq(MarsBotUtopiaInvest);
      expect(corp.beforeActionPhase, 'the box that seeds its card').is.a('function');
      expect(corp.resolveBonusCard, 'its own bonus card').is.a('function');
      expect(corp.setup, 'no SETUP box is printed').is.undefined;
      expect(corp.onTrackAdvance, 'it watches nothing').is.undefined;
      expect(corp.onWouldRaiseParameter).is.undefined;
    });
  });

  describe('the BEFORE ACTION PHASE box', () => {
    it('the first action phase already holds Investors, once and recurring', () => {
      const [game] = utopiaGame('-c39-seed');
      const automa = game.automa!;
      expect(automa.recurringBonusCards, 'never in the random rotation').includes(BonusCardId.B32_INVESTORS);
      expect(automa.actionDeck.filter((e) => e.kind === 'bonus' && e.id === BonusCardId.B32_INVESTORS),
        'exactly ONE copy exists').has.length(1);
      expect(automa.bonusDeck.some((e) => e.kind === 'bonus' && e.id === BonusCardId.B32_INVESTORS),
        'and it is not in the bonus deck').is.false;
    });

    it('never adds a second copy', () => {
      const [game] = utopiaGame('-c39-idempotent');
      runBox(game);
      runBox(game);
      expect(game.automa!.actionDeck.filter((e) => e.kind === 'bonus' && e.id === BonusCardId.B32_INVESTORS)).has.length(1);
    });

    it('another corporation seeds nothing', () => {
      const [game] = utopiaGame('-c39-other', MarsBotCorpId.C01_CREDICOR);
      expect(game.automa!.recurringBonusCards).does.not.include(BonusCardId.B32_INVESTORS);
      expect(game.automa!.actionDeck.some((e) => e.kind === 'bonus' && e.id === BonusCardId.B32_INVESTORS)).is.false;
    });
  });

  describe('B32 — the EVEN generation rebalance', () => {
    it('pushes the weakest track and pulls the strongest one back', () => {
      const [game] = utopiaGame('-c39-even');
      game.generation = 2;
      // EVERY track gets a position: an unset one sits at 0 and would be the
      // laggard the card actually picks.
      setTracks(game, {[THARSIS_TRACK.BUILDING]: 4, [THARSIS_TRACK.SPACE]: 1, [THARSIS_TRACK.EVENT]: 3,
        [THARSIS_TRACK.SCIENCE]: 3, [THARSIS_TRACK.ENERGY]: 3, [THARSIS_TRACK.EARTH]: 3, [THARSIS_TRACK.BIO]: 3});
      const before = positions(game);

      playInvestors(game);

      const after = positions(game);
      expect(after[THARSIS_TRACK.SPACE], 'the weakest track went up')
        .is.greaterThan(before[THARSIS_TRACK.SPACE]);
      expect(after[THARSIS_TRACK.BUILDING], 'and the strongest came back one').eq(before[THARSIS_TRACK.BUILDING] - 1);
      expect(stat(game, 'investorsPlayed')).eq(1);
      expect(stat(game, 'investorsPushes')).eq(1);
      expect(stat(game, 'investorsRegressions')).eq(1);
      expect(stat(game, 'investorsMc'), 'the even branch pays no money').eq(0);
    });

    it('breaks BOTH ties by the topmost track', () => {
      const [game] = utopiaGame('-c39-ties');
      game.generation = 4;
      // Two tracks tie for last (1, 3) and two tie for first (0, 2).
      setTracks(game, {0: 5, 1: 2, 2: 5, 3: 2, 4: 3, 5: 3, 6: 3});
      const before = positions(game);

      playInvestors(game);

      const after = positions(game);
      expect(after[1], 'the FIRST of the tied laggards moved').is.greaterThan(before[1]);
      expect(after[3], 'the other one did not').eq(before[3]);
      expect(after[0], 'the FIRST of the tied leaders came back').eq(before[0] - 1);
      expect(after[2], 'the other leader kept its space').eq(before[2]);
    });

    it('reads BOTH targets before anything moves — the push cannot create the leader it cancels', () => {
      const [game] = utopiaGame('-c39-read-first');
      game.generation = 6;
      // A mat where the laggard's push would overtake the leader: choosing the
      // leader AFTER the push would pull the very track just advanced.
      setTracks(game, {0: 2, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1});
      const before = positions(game);

      playInvestors(game);

      const after = positions(game);
      expect(after[1], 'the laggard kept the step it was given').is.greaterThan(before[1]);
      expect(after[0], 'and the leader — read BEFORE the push — is the one pulled back').eq(before[0] - 1);
    });

    it('a track still at the start has nothing to pull back', () => {
      const [game] = utopiaGame('-c39-flat');
      game.generation = 2;
      setTracks(game, {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0});

      playInvestors(game);

      // Both clauses name the topmost track: it is pushed, then slides back.
      expect(stat(game, 'investorsPushes'), 'the push still landed').eq(1);
      expect(stat(game, 'investorsRegressions'), 'and the pull took it straight back').eq(1);
      expect(positions(game)[0]).eq(0);
    });

    it('a completed mat turns the push into the official Failed Action', () => {
      const [game, , bot] = utopiaGame('-c39-maxed');
      game.generation = 8;
      const max = game.automa!.board.tracks[0].maxPosition;
      for (const track of game.automa!.board.tracks) {
        track.position = max;
      }
      const mc = bot.megaCredits;

      playInvestors(game);

      expect(bot.megaCredits, 'the Failed Action compensation').is.at.least(mc + 5);
      expect(stat(game, 'investorsPushes'), 'nothing was pushed').eq(0);
      expect(stat(game, 'investorsRegressions'), 'but the pull still happened').eq(1);
    });
  });

  describe('B32 — the ODD generation payout', () => {
    it('pays the space number the weakest track stands on', () => {
      const [game, , bot] = utopiaGame('-c39-odd');
      game.generation = 3;
      setTracks(game, {0: 6, 1: 4, 2: 5, 3: 7, 4: 5, 5: 6, 6: 5});
      const before = positions(game);
      const mc = bot.megaCredits;

      playInvestors(game);

      expect(bot.megaCredits - mc, 'the weakest track stood on 4').eq(4);
      expect(positions(game), 'and no track moved at all').deep.eq(before);
      expect(stat(game, 'investorsMc')).eq(4);
      expect(stat(game, 'investorsPushes')).eq(0);
      expect(stat(game, 'investorsRegressions')).eq(0);
    });

    it('a weakest track still at the start pays nothing — and is not a Failed Action', () => {
      const [game, , bot] = utopiaGame('-c39-odd-zero');
      game.generation = 5;
      setTracks(game, {0: 3, 1: 0, 2: 2, 3: 4, 4: 1, 5: 1, 6: 1});
      const mc = bot.megaCredits;

      playInvestors(game);

      expect(bot.megaCredits, 'no money, no compensation').eq(mc);
      expect(stat(game, 'investorsMc')).eq(0);
      expect(stat(game, 'investorsPlayed')).eq(1);
    });
  });

  describe('lifecycle', () => {
    it('the card is never destroyed — it always returns to the recurring holding', () => {
      const [game] = utopiaGame('-c39-fate');
      game.generation = 2;
      expect(playInvestors(game)).eq('discard');
      game.generation = 3;
      expect(playInvestors(game)).eq('discard');
      expect(game.automa!.destroyedBonusCards).does.not.include(BonusCardId.B32_INVESTORS);
    });

    it('refuses a bonus card it does not own', () => {
      const [game] = utopiaGame('-c39-foreign');
      expect(() => AutomaCorporations.corpFor(MarsBotCorpId.C39_UTOPIA_INVEST)
        .resolveBonusCard?.(game, BonusCardId.B28_DIVERSIFICATION)).to.throw(/does not own/);
    });

    it('the counters and the recurring card survive a save/load round trip', () => {
      const [game] = utopiaGame('-c39-serialize');
      game.generation = 2;
      playInvestors(game);
      const played = stat(game, 'investorsPlayed');

      const restored = Game.deserialize(structuredClone(game.serialize()));

      expect(restored.automa!.corporation).eq(MarsBotCorpId.C39_UTOPIA_INVEST);
      expect(restored.automa!.recurringBonusCards).includes(BonusCardId.B32_INVESTORS);
      expect(restored.automa!.corpStats['investorsPlayed']).eq(played);
    });
  });
});
