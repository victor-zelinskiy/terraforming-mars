import {expect} from 'chai';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestGame';
import {DELTA_TRACK_TAGS, DeltaProjectExpansion, DP04_ADVANCE} from '../../src/server/delta/DeltaProjectExpansion';
import {DeltaProjectInput} from '../../src/server/delta/DeltaProjectInput';
import {CardResource} from '../../src/common/CardResource';
import {CardName} from '../../src/common/cards/CardName';
import {RegolithEaters} from '../../src/server/cards/base/RegolithEaters';
import {StormSurgeBarrier} from '../../src/server/cards/delta/StormSurgeBarrier';
import {fakeCard, runAllActions} from '../TestingUtils';
import {cast} from '@/common/utils/utils';
import {IPlayer} from '@/server/IPlayer';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {OrOptions} from '../../src/server/inputs/OrOptions';

/**
 * «ЕСЛИ НЕ ВЫБРАЛ, ЗНАЧИТ НЕ НАДО» — the conscious decline of a landing
 * stage's TARGET-bearing reward.
 *
 * Positions 7 (repeat a used blue action) and 9 (which card takes the animals)
 * are the only two rewards that need a target, and the console warns once
 * before a confirm that has none. Past that warning the second press is a
 * DECISION, not an omission: the batch carries it on the move's own step
 * (`{deltaProject, waiveReward}`), so the server resolves the advance and asks
 * NOTHING afterwards — the player who declined a target may not be handed a
 * prompt for it three beats later, over whatever screen they moved on to.
 *
 * The two properties that make it safe are asserted together everywhere here:
 * the follow-up must be GONE (nothing waiting, no resources moved) and the
 * forfeit must be NAMED in the journal (the console-wide «no silent loss» —
 * a declined effect states itself, it never evaporates).
 */
function playAllDeltaTrackTags(p: IPlayer) {
  p.playedCards.push(fakeCard({tags: DELTA_TRACK_TAGS.filter((t) => t !== undefined)}));
}

function logHas(game: IGame, fragment: string): boolean {
  return game.gameLog.some((entry) => entry.message.includes(fragment));
}

describe('Hydronetwork — declining a landing stage target reward', () => {
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    [game, player] = testGame(2, {deltaProjectExpansion: true});
  });

  describe('position 7 (repeat a used blue action)', () => {
    function seat(): RegolithEaters {
      player.energy = 7;
      playAllDeltaTrackTags(player);
      player.deltaProjectData!.position = 6;
      const regolith = new RegolithEaters();
      player.playedCards.push(regolith);
      player.actionsThisGeneration.add(CardName.REGOLITH_EATERS);
      return regolith;
    }

    it('declining asks nothing and names the forfeit', () => {
      const regolith = seat();

      DeltaProjectExpansion.advance(player, 1, undefined, {waiveTargetReward: true});
      runAllActions(game);

      // The move itself happened…
      expect(player.deltaProjectData!.position).eq(7);
      // …and the question it would have asked is GONE, not postponed.
      expect(player.popWaitingFor()).is.undefined;
      expect(regolith.resourceCount).eq(0);
      expect(logHas(game, 'declined to reuse a card action')).is.true;
    });

    it('NOT declining still asks — the waive is opt-in, never a default', () => {
      seat();

      DeltaProjectExpansion.advance(player, 1);
      runAllActions(game);

      expect(player.popWaitingFor()).is.not.undefined;
    });

    it('a decline with NOTHING to decline stays silent (the ordinary fizzle)', () => {
      player.energy = 7;
      playAllDeltaTrackTags(player);
      player.deltaProjectData!.position = 6;

      DeltaProjectExpansion.advance(player, 1, undefined, {waiveTargetReward: true});
      runAllActions(game);

      expect(player.popWaitingFor()).is.undefined;
      // No candidate existed, so nothing was given up — the journal must not
      // report a decision the player never made.
      expect(logHas(game, 'declined to reuse a card action')).is.false;
    });
  });

  describe('position 9 (which card receives the animals)', () => {
    function seat() {
      player.energy = 9;
      playAllDeltaTrackTags(player);
      player.deltaProjectData!.position = 8;
      const first = fakeCard({resourceType: CardResource.ANIMAL, name: 'AnimalHostA' as CardName});
      const second = fakeCard({resourceType: CardResource.ANIMAL, name: 'AnimalHostB' as CardName});
      player.playedCards.push(first, second);
      return {first, second};
    }

    it('declining places no animals, asks nothing and names the forfeit', () => {
      const {first, second} = seat();

      DeltaProjectExpansion.advance(player, 1, undefined, {waiveTargetReward: true});
      runAllActions(game);

      expect(player.deltaProjectData!.position).eq(9);
      expect(player.popWaitingFor()).is.undefined;
      expect(first.resourceCount).eq(0);
      expect(second.resourceCount).eq(0);
      expect(logHas(game, 'declined to add animals')).is.true;
    });

    it('NOT declining still asks', () => {
      seat();

      DeltaProjectExpansion.advance(player, 1);
      runAllActions(game);

      expect(player.popWaitingFor()).is.not.undefined;
    });

    it('a decline with no eligible host stays silent', () => {
      player.energy = 9;
      playAllDeltaTrackTags(player);
      player.deltaProjectData!.position = 8;

      DeltaProjectExpansion.advance(player, 1, undefined, {waiveTargetReward: true});
      runAllActions(game);

      expect(logHas(game, 'declined to add animals')).is.false;
    });
  });

  describe('a NON-target landing ignores the waive entirely', () => {
    it('position 6 still pays its plants', () => {
      player.energy = 6;
      playAllDeltaTrackTags(player);
      player.deltaProjectData!.position = 5;
      const before = player.plants;

      DeltaProjectExpansion.advance(player, 1, undefined, {waiveTargetReward: true});
      runAllActions(game);

      // Only the two TARGET-bearing rewards are waivable; everything else
      // resolves exactly as it always did.
      expect(player.plants).greaterThan(before);
    });
  });

  describe('the wire carries the decision on the MOVE step', () => {
    it('DeltaProjectInput reads `waiveReward` off the response BEFORE the callback', () => {
      const input = new DeltaProjectInput([1, 2]);
      let seenAtCallback: boolean | undefined;
      input.andThen(() => {
        seenAtCallback = input.waiveReward;
        return undefined;
      });

      input.process({type: 'deltaProject', amount: 1, waiveReward: true});

      // The callbacks read the flag off the input itself, so it has to be set
      // by the time they run — that ordering IS the contract.
      expect(seenAtCallback).is.true;
      expect(input.waiveReward).is.true;
    });

    it('an ordinary response leaves it false (byte-identical historical shape)', () => {
      const input = new DeltaProjectInput([1]);
      input.andThen(() => undefined);
      input.process({type: 'deltaProject', amount: 1});
      expect(input.waiveReward).is.false;
    });

    it('the standard action honours it end to end', () => {
      player.energy = 7;
      playAllDeltaTrackTags(player);
      player.deltaProjectData!.position = 6;
      const regolith = new RegolithEaters();
      player.playedCards.push(regolith);
      player.actionsThisGeneration.add(CardName.REGOLITH_EATERS);

      const actions = cast(player.getActions(), OrOptions);
      const advance = cast(
        actions.options.find((o) => o instanceof SelectOption && o.title === 'Advance on the Hydronetwork track'),
        SelectOption);
      const input = cast(advance.cb(undefined), DeltaProjectInput);
      input.process({type: 'deltaProject', amount: 1, waiveReward: true});
      runAllActions(game);

      expect(player.deltaProjectData!.position).eq(7);
      expect(player.popWaitingFor()).is.undefined;
      expect(regolith.resourceCount).eq(0);
    });

    it('the CARD door (Storm Surge Barrier) honours it too', () => {
      player.energy = 7;
      playAllDeltaTrackTags(player);
      player.deltaProjectData!.position = 6;
      const regolith = new RegolithEaters();
      player.playedCards.push(regolith);
      player.actionsThisGeneration.add(CardName.REGOLITH_EATERS);
      const card = new StormSurgeBarrier();
      player.playedCards.push(card);

      // The card's advance branch — its own `DP04_ADVANCE` context, the same
      // shared pipeline, and therefore the same waive.
      expect(DeltaProjectExpansion.getValidAdvanceSteps(player, DP04_ADVANCE)).includes(1);
      const action = card.action(player);
      const advance = action instanceof OrOptions ?
        cast(action.options.find((o) => o instanceof SelectOption && o.title.toString().includes('advance on the Hydronetwork')), SelectOption) :
        undefined;
      const input = cast(advance === undefined ? action : advance.cb(undefined), DeltaProjectInput);
      input.process({type: 'deltaProject', amount: 1, waiveReward: true});
      runAllActions(game);

      expect(player.deltaProjectData!.position).eq(7);
      expect(player.popWaitingFor()).is.undefined;
      expect(regolith.resourceCount).eq(0);
    });
  });
});
