import {expect} from 'chai';
import {DutchMountains, DP08_ENERGY_COST} from '../../../src/server/cards/delta/DutchMountains';
import {DELTA_PROJECT_CARD_MANIFEST} from '../../../src/server/cards/delta/DeltaProjectCardManifest';
import {DELTA_TRACK_TAGS, DeltaProjectExpansion} from '../../../src/server/delta/DeltaProjectExpansion';
import {DeltaStageRewardInput} from '../../../src/server/delta/DeltaStageRewardInput';
import {GameCards} from '../../../src/server/GameCards';
import {DEFAULT_GAME_OPTIONS} from '../../../src/server/game/GameOptions';
import {IGame} from '../../../src/server/IGame';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Birds} from '../../../src/server/cards/base/Birds';
import {Fish} from '../../../src/server/cards/base/Fish';
import {BioengineeringEnclosure} from '../../../src/server/cards/ares/BioengineeringEnclosure';
import {InputResponse} from '../../../src/common/inputs/InputResponse';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {drainBatchTail} from '../../../src/server/inputs/deferredInputBatch';
import {unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {cast, toName} from '../../../src/common/utils/utils';
import {fakeCard, runAllActions} from '../../TestingUtils';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IPlayer} from '../../../src/server/IPlayer';

function playAllDeltaTrackTags(p: IPlayer) {
  p.playedCards.push(fakeCard({tags: DELTA_TRACK_TAGS.filter((t) => t !== undefined)}));
}

function logText(game: IGame): string {
  return game.gameLog.map((m) => m.message).join('\n');
}

/**
 * DP08 — DUTCH MOUNTAINS: pay 3 energy → gain the ordinary reward of the
 * current stage or a passed one (never Jovian, never a VP step), WITHOUT any
 * movement. The reward rides the ONE resolver every arrival uses
 * (`grantStageReward` → `resolveReward`), so parity with a landed reward is
 * structural; these specs pin the card's own gates — the play requirement,
 * the price, the eligibility, the no-movement contract — and the seams a
 * grant must never touch (position, stops, the generation's own advance,
 * the VP pools).
 */
describe('DutchMountains', () => {
  let card: DutchMountains;
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    card = new DutchMountains();
    [game, player] = testGame(2, {deltaProjectExpansion: true});
  });

  describe('metadata and registration', () => {
    it('matches the printed card', () => {
      expect(card.name).eq(CardName.DUTCH_MOUNTAINS);
      expect(card.type).eq(CardType.ACTIVE);
      expect(card.cost).eq(13);
      expect(card.tags).deep.eq([Tag.EARTH]);
      expect(card.metadata.cardNumber).eq('DP08');
      expect(card.getVictoryPoints(player)).eq(0);
      expect(card.requirements).deep.eq([{deltaPosition: 4, count: 4}]);
    });

    it('is dealt only with the Delta Project module, once', () => {
      expect(DELTA_PROJECT_CARD_MANIFEST.projectCards[CardName.DUTCH_MOUNTAINS]).is.not.undefined;
      const withModule = new GameCards({...DEFAULT_GAME_OPTIONS, deltaProjectExpansion: true}).getProjectCards().map(toName);
      const withoutModule = new GameCards(DEFAULT_GAME_OPTIONS).getProjectCards().map(toName);
      expect(withModule.filter((n) => n === CardName.DUTCH_MOUNTAINS)).has.length(1);
      expect(withoutModule).to.not.contain(CardName.DUTCH_MOUNTAINS);
    });
  });

  describe('the position-4 play requirement', () => {
    beforeEach(() => {
      player.megaCredits = card.cost;
    });

    it('position 3 does not satisfy it; position 4 and later do', () => {
      player.deltaProjectData!.position = 3;
      expect(player.canPlay(card)).is.not.true;
      player.deltaProjectData!.position = 4;
      expect(player.canPlay(card)).is.true;
      player.deltaProjectData!.position = 11;
      expect(player.canPlay(card)).is.true;
    });

    it('the unmet requirement names itself with the honest progress', () => {
      player.deltaProjectData!.position = 3;
      const reasons = unplayableReasons(player, card);
      const req = reasons.find((r) => r.requirement === true);
      expect(req?.message).eq('Requires ${0} step(s) advanced on the Hydronetwork');
      expect(req?.params).deep.eq(['4']);
      // The «now: N» badge carries the live progress — the position IS the
      // steps-moved count.
      expect(req?.current).eq(3);
      expect(card.canPlay(player)).is.not.true;
    });
  });

  describe('action availability and the 3-energy price', () => {
    beforeEach(() => {
      playAllDeltaTrackTags(player);
      player.deltaProjectData!.position = 4;
    });

    it('needs 3 energy AND at least one claimable stage', () => {
      player.energy = DP08_ENERGY_COST - 1;
      expect(card.canAct(player)).is.false;
      expect(card.actionUnavailableReason(player)?.message).eq('Not enough energy');
      player.energy = DP08_ENERGY_COST;
      expect(card.canAct(player)).is.true;

      player.deltaProjectData!.position = 0;
      expect(card.canAct(player)).is.false;
      expect(card.actionUnavailableReason(player)?.message)
        .eq('No reached Hydronetwork stage offers a claimable reward');
    });

    it('charges exactly 3 energy at the claim — choosing costs nothing', () => {
      player.energy = 5;
      const input = cast(card.action(player), DeltaStageRewardInput);
      // The input exists; nothing is spent yet.
      expect(player.energy).eq(5);
      input.process({type: 'deltaStageReward', position: 3});
      runAllActions(game);
      // 3 energy paid; stage 3 (+2 M€ production) granted once.
      expect(player.energy).eq(2);
      expect(player.production.megacredits).eq(2);
    });

    it('a failed validation spends nothing', () => {
      player.energy = 5;
      const input = cast(card.action(player), DeltaStageRewardInput);
      expect(() => input.process({type: 'deltaStageReward', position: 9})).to.throw();
      expect(player.energy).eq(5);
      expect(player.production.megacredits).eq(0);
    });

    it('reward energy cannot retroactively pay the toll', () => {
      // Stage 2's reward is +1 energy PRODUCTION (not stock) — but the shape
      // that matters: the toll check happens before the grant resolves.
      player.energy = 2;
      const input = cast(card.action(player), DeltaStageRewardInput);
      expect(() => input.process({type: 'deltaStageReward', position: 2})).to.throw();
      expect(player.energy).eq(2);
    });
  });

  describe('stage eligibility (semantic, server-authoritative)', () => {
    it('claimable = reached ∧ has a path tag ∧ not Jovian', () => {
      playAllDeltaTrackTags(player);
      player.deltaProjectData!.position = 4;
      expect(DeltaProjectExpansion.rewardClaimableStages(player)).deep.eq([1, 2, 3, 4]);
      player.deltaProjectData!.position = 7;
      expect(DeltaProjectExpansion.rewardClaimableStages(player)).deep.eq([1, 2, 3, 4, 5, 6, 7]);
      // Standing ON the Jovian stage: it is excluded, everything before it is in.
      player.deltaProjectData!.position = 8;
      expect(DeltaProjectExpansion.rewardClaimableStages(player)).deep.eq([1, 2, 3, 4, 5, 6, 7]);
      // Past it (incl. both VP terminals): Jovian and the VP cells stay out.
      player.deltaProjectData!.position = 11;
      expect(DeltaProjectExpansion.rewardClaimableStages(player)).deep.eq([1, 2, 3, 4, 5, 6, 7, 9]);
    });

    it('the start position claims nothing; no module data claims nothing', () => {
      expect(DeltaProjectExpansion.rewardClaimableStages(player)).deep.eq([]);
      const [, bare] = testGame(2);
      expect(DeltaProjectExpansion.rewardClaimableStages(bare)).deep.eq([]);
    });

    it('a crafted request for an excluded or future stage is refused before anything mutates', () => {
      playAllDeltaTrackTags(player);
      player.deltaProjectData!.position = 11;
      player.energy = 5;
      for (const illegal of [0, 8, 10, 11]) {
        const input = cast(card.action(player), DeltaStageRewardInput);
        expect(() => input.process({type: 'deltaStageReward', position: illegal}),
          `position ${illegal}`).to.throw();
      }
      expect(player.energy).eq(5);
      // …and grantStageReward itself re-validates against the LIVE position.
      expect(() => DeltaProjectExpansion.grantStageReward(player, 8, {source: card.name})).to.throw();
      expect(() => DeltaProjectExpansion.grantStageReward(player, 10, {source: card.name})).to.throw();
    });
  });

  describe('the grant is reward-only — never a movement', () => {
    beforeEach(() => {
      playAllDeltaTrackTags(player);
      player.deltaProjectData!.position = 6;
      player.energy = 5;
    });

    function claim(position: number, answer?: InputResponse & {type: 'deltaStageReward'}): void {
      const input = cast(card.action(player), DeltaStageRewardInput);
      input.process(answer ?? {type: 'deltaStageReward', position});
      runAllActions(game);
    }

    it('position, stops, the generation advance and the VP pools are untouched', () => {
      const stopsBefore = (player.deltaProjectData!.stops ?? []).length;
      claim(3);
      expect(player.deltaProjectData!.position).eq(6);
      expect((player.deltaProjectData!.stops ?? []).length).eq(stopsBefore);
      expect(player.deltaProjectData!.usedThisGeneration).is.not.true;
      expect(player.production.megacredits).eq(2);
      expect(logText(game)).to.contain('claimed the');
    });

    it('an already-rewarded stage may be claimed again (parity with the resolver)', () => {
      // The player historically stopped on 3 — the claim pays it AGAIN.
      player.deltaProjectData!.stops = [{position: 3, generation: 1}];
      claim(3);
      expect(player.production.megacredits).eq(2);
    });

    it('a claimed CHOICE stage consumes the declared answer and never rewrites stop history', () => {
      player.deltaProjectData!.stops = [{position: 2, generation: 1, choice: 0}];
      claim(2, {type: 'deltaStageReward', position: 2, answer: {position: 2, rewardChoice: 1}});
      expect(player.production.heat).eq(1);
      // The historical stop keeps ITS choice — a grant is not a stop.
      expect(player.deltaProjectData!.stops![0].choice).eq(0);
    });

    it('a claimed choice stage with NO declared answer asks the ordinary prompt', () => {
      const input = cast(card.action(player), DeltaStageRewardInput);
      input.process({type: 'deltaStageReward', position: 2});
      runAllActions(game);
      expect(player.energy).eq(2);
      const prompt = player.popWaitingFor();
      expect(prompt).is.not.undefined;
    });

    it('a claimed target stage consumes the declared card once, through the real pipeline', () => {
      player.deltaProjectData!.position = 9;
      const birds = new Birds();
      const fish = new Fish();
      player.playedCards.push(birds, fish);
      claim(9, {type: 'deltaStageReward', position: 9, answer: {position: 9, selectedCard: CardName.BIRDS}});
      expect(player.popWaitingFor()).is.undefined;
      expect(birds.resourceCount).eq(2);
      expect(fish.resourceCount).eq(0);
      expect(player.deltaProjectData!.position).eq(9);
    });

    it('a claimed REPEAT stage runs the real action with its nested plan — no re-asked prompt', () => {
      player.deltaProjectData!.position = 7;
      const enclosure = new BioengineeringEnclosure();
      enclosure.resourceCount = 2;
      const birds = new Birds();
      const fish = new Fish();
      player.playedCards.push(enclosure, birds, fish);
      player.actionsThisGeneration.add(CardName.BIOENGINEERING_ENCLOSURE);

      claim(7, {type: 'deltaStageReward', position: 7, answer: {
        position: 7,
        selectedCard: CardName.BIOENGINEERING_ENCLOSURE,
        repeatResponses: [{type: 'card', cards: [CardName.BIRDS]}] as ReadonlyArray<InputResponse>,
      }});
      // The action's own target prompt was raised and the parked nested answer
      // lands through the route's ordinary drain — never a second question.
      drainBatchTail(player);
      runAllActions(game);
      expect(player.popWaitingFor()).is.undefined;
      expect(birds.resourceCount).eq(1);
      expect(enclosure.resourceCount).eq(1);
      expect(player.deltaProjectData!.position).eq(7);
    });

    it('the answer must describe the claimed stage', () => {
      const input = cast(card.action(player), DeltaStageRewardInput);
      expect(() => input.process({type: 'deltaStageReward', position: 2,
        answer: {position: 3, rewardChoice: 0}})).to.throw();
      expect(player.energy).eq(5);
    });

    it('the claimed stage-5 draw raises the ordinary keep-pick (hidden information stays a prompt)', () => {
      claim(5);
      const draw = cast(player.popWaitingFor(), SelectCard);
      expect(draw.cards.length).eq(4);
      expect(player.deltaProjectData!.position).eq(6);
    });
  });

  describe('reward parity with the ordinary arrival', () => {
    it('a claimed stage-6 reward equals the landed one (per plant tag), via the one resolver', () => {
      playAllDeltaTrackTags(player);
      player.deltaProjectData!.position = 6;
      player.energy = 5;
      const plantTags = player.tags.count(Tag.PLANT);

      const input = cast(card.action(player), DeltaStageRewardInput);
      input.process({type: 'deltaStageReward', position: 6});
      runAllActions(game);
      expect(player.plants).eq(plantTags);

      // The ordinary movement onto stage 6 pays the identical amount.
      const [game2, other] = testGame(2, {deltaProjectExpansion: true});
      playAllDeltaTrackTags(other);
      other.deltaProjectData!.position = 5;
      other.energy = 1;
      DeltaProjectExpansion.advance(other, 1);
      runAllActions(game2);
      expect(other.plants).eq(other.tags.count(Tag.PLANT));
      expect(other.plants).eq(plantTags);
    });

    it('the ordinary movement action stays available after a claim', () => {
      playAllDeltaTrackTags(player);
      player.deltaProjectData!.position = 4;
      player.energy = 5;
      const input = cast(card.action(player), DeltaStageRewardInput);
      input.process({type: 'deltaStageReward', position: 3});
      runAllActions(game);
      expect(player.deltaProjectData!.usedThisGeneration).is.not.true;
      expect(DeltaProjectExpansion.maxSteps(player)).to.be.greaterThan(0);
    });
  });
});
