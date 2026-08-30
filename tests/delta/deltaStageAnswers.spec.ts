import {expect} from 'chai';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestGame';
import {DELTA_TRACK_TAGS, DeltaProjectExpansion} from '../../src/server/delta/DeltaProjectExpansion';
import {DeltaSurge} from '../../src/server/cards/delta/DeltaSurge';
import {BioengineeringEnclosure} from '../../src/server/cards/ares/BioengineeringEnclosure';
import {Birds} from '../../src/server/cards/base/Birds';
import {Fish} from '../../src/server/cards/base/Fish';
import {CardName} from '../../src/common/cards/CardName';
import {InputResponse} from '../../src/common/inputs/InputResponse';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {drainBatchTail, parkedBatchTailLength} from '../../src/server/inputs/deferredInputBatch';
import {fakeCard, runAllActions} from '../TestingUtils';
import {cast} from '@/common/utils/utils';
import {IPlayer} from '@/server/IPlayer';

/**
 * THE INVOCATION PLAN — the `answers` field of the `{deltaProject}` move step.
 *
 * Every stage-level ask the player pre-answered is CONSUMED by the server's
 * own reward resolution: the same closures the prompt's options run, the same
 * deferred actions, the same eligibility filters. A stale entry degrades to
 * that ONE stage's ordinary prompt; a composed repeat's nested responses are
 * parked for the prompts the repeated action raises and drained exactly the
 * way a direct activation's batch tail is. What this replaces is the
 * positional response stream, whose three silent loss modes — parked behind
 * the stage-5 hidden draw, wiped whole by one value refusal, swallowed by the
 * wrong stage's same-shaped prompt — all ended as a re-asked question the
 * player had already answered.
 */
function playAllDeltaTrackTags(p: IPlayer) {
  p.playedCards.push(fakeCard({tags: DELTA_TRACK_TAGS.filter((t) => t !== undefined)}));
}

function logText(game: IGame): string {
  return game.gameLog.map((m) => m.message).join('\n');
}

describe('Hydronetwork — declared stage answers (the invocation plan)', () => {
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    [game, player] = testGame(2, {deltaProjectExpansion: true});
    playAllDeltaTrackTags(player);
  });

  describe('choice stages (1/2)', () => {
    it('a declared reward choice is consumed with no prompt and recorded as the stop choice', () => {
      player.energy = 2;
      player.deltaProjectData!.position = 1;

      DeltaProjectExpansion.advance(player, 1, undefined, {answers: [{position: 2, rewardChoice: 1}]});
      runAllActions(game);

      expect(player.popWaitingFor()).is.undefined;
      expect(player.production.heat).eq(1);
      const stops = player.deltaProjectData!.stops!;
      expect(stops[stops.length - 1]).deep.include({position: 2, choice: 1});
    });

    it('an out-of-range declared choice degrades to the ordinary prompt', () => {
      player.energy = 2;
      player.deltaProjectData!.position = 1;

      DeltaProjectExpansion.advance(player, 1, undefined, {answers: [{position: 2, rewardChoice: 5}]});
      runAllActions(game);

      const prompt = cast(player.popWaitingFor(), OrOptions);
      expect(prompt.options[0].title).eq('Increase energy production 1 step');
    });
  });

  describe('position 9 (animal target)', () => {
    let birds: Birds;
    let fish: Fish;

    beforeEach(() => {
      player.energy = 2;
      player.deltaProjectData!.position = 8;
      birds = new Birds();
      fish = new Fish();
      // TWO candidates — the prompt WOULD genuinely ask.
      player.playedCards.push(birds, fish);
    });

    it('a declared target receives the animals with no prompt', () => {
      DeltaProjectExpansion.advance(player, 1, undefined, {answers: [{position: 9, selectedCard: CardName.BIRDS}]});
      runAllActions(game);

      expect(player.popWaitingFor()).is.undefined;
      expect(birds.resourceCount).eq(2);
      expect(fish.resourceCount).eq(0);
    });

    it('a STALE declared target degrades to the live prompt with only real candidates', () => {
      DeltaProjectExpansion.advance(player, 1, undefined, {answers: [{position: 9, selectedCard: CardName.PETS}]});
      runAllActions(game);

      const prompt = cast(player.popWaitingFor(), SelectCard);
      expect(prompt.cards.map((c) => c.name)).to.have.members([CardName.BIRDS, CardName.FISH]);
      expect(birds.resourceCount).eq(0);
    });
  });

  describe('position 7 (repeat a used blue action) with nested answers', () => {
    let enclosure: BioengineeringEnclosure;
    let birds: Birds;
    let fish: Fish;

    function seat(targets: 'two' | 'one'): void {
      player.energy = 7;
      player.deltaProjectData!.position = 6;
      enclosure = new BioengineeringEnclosure();
      enclosure.resourceCount = 2;
      birds = new Birds();
      player.playedCards.push(enclosure, birds);
      if (targets === 'two') {
        fish = new Fish();
        player.playedCards.push(fish);
      }
      player.actionsThisGeneration.add(CardName.BIOENGINEERING_ENCLOSURE);
    }

    it('the declared repeat runs the REAL action and the parked nested answer lands on its prompt', () => {
      seat('two');

      DeltaProjectExpansion.advance(player, 1, undefined, {answers: [{
        position: 7,
        selectedCard: CardName.BIOENGINEERING_ENCLOSURE,
        repeatResponses: [{type: 'card', cards: [CardName.BIRDS]}] as ReadonlyArray<InputResponse>,
      }]});
      runAllActions(game);

      // The root pick was consumed (never re-asked); the action's OWN target
      // prompt stands (two candidates — never auto), and the single-input
      // route's drain is what feeds the parked nested answer.
      drainBatchTail(player);
      runAllActions(game);

      expect(player.popWaitingFor()).is.undefined;
      expect(birds.resourceCount).eq(1);
      expect(enclosure.resourceCount).eq(1);
      expect(logText(game)).to.contain('reused');
    });

    it('a stale repeat card degrades to the ordinary root prompt', () => {
      seat('two');

      // Regolith Eaters is not even in play — the plan is stale.
      DeltaProjectExpansion.advance(player, 1, undefined, {answers: [{
        position: 7, selectedCard: CardName.REGOLITH_EATERS,
      }]});
      runAllActions(game);

      const prompt = cast(player.popWaitingFor(), SelectCard);
      expect(prompt.cards.map((c) => c.name)).deep.eq([CardName.BIOENGINEERING_ENCLOSURE]);
    });

    describe('inside a multi-stage traversal (Delta Surge)', () => {
      beforeEach(() => {
        player.playedCards.push(new DeltaSurge());
      });

      it('a deck stop at 5 does not lose the stage-7 plan: no question is re-asked', () => {
        seat('two');
        player.deltaProjectData!.position = 4;
        player.energy = 4;

        DeltaProjectExpansion.advance(player, 4, undefined, {answers: [{
          position: 7,
          selectedCard: CardName.BIOENGINEERING_ENCLOSURE,
          repeatResponses: [{type: 'card', cards: [CardName.BIRDS]}] as ReadonlyArray<InputResponse>,
        }]});
        runAllActions(game);

        // The crossed stage 5 deals its cards — the HIDDEN-information stop.
        const draw = cast(player.popWaitingFor(), SelectCard);
        expect(draw.cards.length).eq(4);
        draw.cb([draw.cards[0], draw.cards[1]]);
        runAllActions(game);

        // Past the stop: stage 6 paid, stage 7 CONSUMED the plan (no root
        // re-ask) and raised only the action's own target prompt — which the
        // route's drain answers from the parked nested plan.
        drainBatchTail(player);
        runAllActions(game);

        expect(player.popWaitingFor()).is.undefined;
        expect(birds.resourceCount).eq(1);
        expect(enclosure.resourceCount).eq(1);
        // The destination stage 8 still paid its jovian tag.
        expect(player.tags.extraJovianTags).eq(1);
      });

      it('an auto-resolved nested target leaves NO stray answer for the next stage', () => {
        // ONE eligible target → SelectCardDeferred auto-resolves and the
        // parked {card:[Birds]} is never consumed. The stage boundary clears
        // it, so stage 9's own UNPLANNED ask still rises as a real prompt
        // instead of being silently swallowed by the leftover.
        seat('one');
        player.deltaProjectData!.position = 6;
        player.energy = 3;

        DeltaProjectExpansion.advance(player, 3, undefined, {answers: [{
          position: 7,
          selectedCard: CardName.BIOENGINEERING_ENCLOSURE,
          repeatResponses: [{type: 'card', cards: [CardName.BIRDS]}] as ReadonlyArray<InputResponse>,
        }]});
        runAllActions(game);

        // The leftover was dropped at the stage boundary…
        expect(parkedBatchTailLength(player)).eq(0);
        // …the repeat itself landed (auto-resolved single target)…
        expect(birds.resourceCount).eq(1);
        expect(enclosure.resourceCount).eq(1);
        // …and stage 9 asks its own question for real (Birds + the enclosure
        // itself are both animal hosts — two candidates).
        const stage9 = cast(player.popWaitingFor(), SelectCard);
        expect(stage9.cards.map((c) => c.name)).to.have.members(
          [CardName.BIRDS, CardName.BIOENGINEERING_ENCLOSURE]);
        // The prompt is real: answering it is what moves the animals.
        expect(birds.resourceCount).eq(1);
      });
    });
  });
});
