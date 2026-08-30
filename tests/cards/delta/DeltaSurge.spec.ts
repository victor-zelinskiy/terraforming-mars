import {expect} from 'chai';
import {DeltaSurge} from '../../../src/server/cards/delta/DeltaSurge';
import {DELTA_PROJECT_CARD_MANIFEST} from '../../../src/server/cards/delta/DeltaProjectCardManifest';
import {DELTA_TRACK_TAGS, DeltaProjectExpansion} from '../../../src/server/delta/DeltaProjectExpansion';
import {GameCards} from '../../../src/server/GameCards';
import {DEFAULT_GAME_OPTIONS} from '../../../src/server/game/GameOptions';
import {IGame} from '../../../src/server/IGame';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {RegolithEaters} from '../../../src/server/cards/base/RegolithEaters';
import {VictoryPointsBreakdownBuilder} from '../../../src/server/game/VictoryPointsBreakdownBuilder';
import {cast, toName} from '../../../src/common/utils/utils';
import {fakeCard, maxOutOceans, runAllActions} from '../../TestingUtils';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IPlayer} from '../../../src/server/IPlayer';

function playAllDeltaTrackTags(p: IPlayer) {
  p.playedCards.push(fakeCard({tags: DELTA_TRACK_TAGS.filter((t) => t !== undefined)}));
}

function expectDeltaVp(player: IPlayer, expected: number) {
  const builder = new VictoryPointsBreakdownBuilder();
  DeltaProjectExpansion.calculateVictoryPoints(player, builder);
  expect(builder.build().deltaProject).eq(expected);
}

describe('DeltaSurge', () => {
  let card: DeltaSurge;
  let game: IGame;
  let player: TestPlayer;
  let opponent: TestPlayer;

  beforeEach(() => {
    card = new DeltaSurge();
    [game, player, opponent] = testGame(2, {deltaProjectExpansion: true});
  });

  describe('metadata and gating', () => {
    it('matches the printed card', () => {
      expect(card.name).eq(CardName.DELTA_SURGE);
      expect(card.type).eq(CardType.ACTIVE);
      expect(card.cost).eq(22);
      expect(card.tags).deep.eq([Tag.SCIENCE]);
      expect(card.metadata.cardNumber).eq('DP07');
      expect(card.requirements).deep.eq([]);
      expect(card.getVictoryPoints(player)).eq(0);
      expect(card.grantsDeltaTraversalRewards).is.true;
    });

    it('is dealt only with the Delta Project module, once', () => {
      expect(DELTA_PROJECT_CARD_MANIFEST.projectCards[CardName.DELTA_SURGE]).is.not.undefined;
      const withModule = new GameCards({...DEFAULT_GAME_OPTIONS, deltaProjectExpansion: true}).getProjectCards().map(toName);
      const withoutModule = new GameCards(DEFAULT_GAME_OPTIONS).getProjectCards().map(toName);
      expect(withModule.filter((n) => n === CardName.DELTA_SURGE)).has.length(1);
      expect(withoutModule).to.not.contain(CardName.DELTA_SURGE);
    });
  });

  describe('ocean placement (immediate)', () => {
    it('places one ocean through the shared pipeline', () => {
      const oceansBefore = game.board.getOceanSpaces().length;
      const trBefore = player.terraformRating;
      player.playCard(card);
      runAllActions(game);
      const selectSpace = cast(player.popWaitingFor(), SelectSpace);
      selectSpace.cb(selectSpace.spaces[0]);
      expect(game.board.getOceanSpaces().length).eq(oceansBefore + 1);
      expect(player.terraformRating).eq(trBefore + 1);
    });

    it('fizzles gracefully when the oceans are maxed (standard policy)', () => {
      maxOutOceans(player);
      const trBefore = player.terraformRating;
      player.playCard(card);
      runAllActions(game);
      expect(player.popWaitingFor()).is.undefined;
      expect(player.terraformRating).eq(trBefore);
    });
  });

  describe('traversal plan (the ONE shared builder)', () => {
    it('without the card: intermediates are skipped by the standing rule', () => {
      expect(DeltaProjectExpansion.traversalRewardModifier(player)).is.undefined;
      expect(DeltaProjectExpansion.traversalSteps(player, 0, 3)).deep.eq([
        {position: 1, rewarded: false, skipped: 'standing-rule'},
        {position: 2, rewarded: false, skipped: 'standing-rule'},
        {position: 3, rewarded: true},
      ]);
    });

    it('with the card: every crossed stage pays, except the positional 2 VP', () => {
      player.playedCards.push(card);
      expect(DeltaProjectExpansion.traversalRewardModifier(player)?.name).eq(CardName.DELTA_SURGE);
      expect(DeltaProjectExpansion.traversalSteps(player, 8, 11)).deep.eq([
        {position: 9, rewarded: true},
        {position: 10, rewarded: false, skipped: 'vp-step'},
        {position: 11, rewarded: true},
      ]);
    });

    it('the preview carries the plan and names the modifier — and stays byte-identical without it', () => {
      playAllDeltaTrackTags(player);
      player.energy = 3;
      const bare = DeltaProjectExpansion.getPreview(player);
      expect(bare.traversalModifierCard).is.undefined;
      expect(bare.destinations[2].traversal).is.undefined;

      player.playedCards.push(card);
      const modified = DeltaProjectExpansion.getPreview(player);
      expect(modified.traversalModifierCard).eq(CardName.DELTA_SURGE);
      expect(modified.destinations[2].traversal).deep.eq([
        {position: 1, rewarded: true},
        {position: 2, rewarded: true},
        {position: 3, rewarded: true},
      ]);
    });
  });

  describe('multi-step movement with Delta Surge', () => {
    beforeEach(() => {
      player.playedCards.push(card);
      playAllDeltaTrackTags(player);
    });

    it('a one-step advance grants nothing extra', () => {
      player.energy = 1;
      DeltaProjectExpansion.advance(player, 1);
      runAllActions(game);
      const orOptions = cast(player.popWaitingFor(), OrOptions);
      orOptions.options[0].cb();
      expect(player.steel).eq(2);
      runAllActions(game);
      expect(player.popWaitingFor()).is.undefined;
    });

    it('a multi-step advance pays every crossed stage IN PATH ORDER', () => {
      player.energy = 4;
      DeltaProjectExpansion.advance(player, 4);
      expect(player.deltaProjectData!.position).eq(4);
      // Nothing resolves before the queue runs — the payout is ordered steps.
      expect(player.production.megacredits).eq(0);

      // Stage 1 asks FIRST (steel or plants)…
      runAllActions(game);
      const stage1 = cast(player.popWaitingFor(), OrOptions);
      expect(stage1.options[0].title).eq('Gain 2 steel');
      stage1.options[0].cb();
      expect(player.steel).eq(2);
      // …then stage 2 (energy or heat production)…
      runAllActions(game);
      const stage2 = cast(player.popWaitingFor(), OrOptions);
      expect(stage2.options[0].title).eq('Increase energy production 1 step');
      stage2.options[1].cb();
      expect(player.production.heat).eq(1);
      // …then stage 3 and the destination stage 4 resolve on their own.
      runAllActions(game);
      expect(player.popWaitingFor()).is.undefined;
      expect(player.production.megacredits).eq(2);
      expect(player.production.titanium).eq(1);
    });

    it('the crossed stage-5 draw PAUSES the payout until it is answered', () => {
      player.energy = 2;
      player.deltaProjectData!.position = 4;
      player.playedCards.push(fakeCard({tags: [Tag.PLANT]}));
      const plantTags = player.tags.count(Tag.PLANT);

      DeltaProjectExpansion.advance(player, 2);
      runAllActions(game);
      // The crossed stage 5 deals its 4 cards; stage 6 has NOT resolved yet.
      const draw = cast(player.popWaitingFor(), SelectCard);
      expect(draw.cards.length).eq(4);
      expect(player.plants).eq(0);
      draw.cb([draw.cards[0], draw.cards[1]]);
      expect(player.cardsInHand.length).eq(2);
      // Only now the destination stage 6 pays its plants.
      runAllActions(game);
      expect(player.plants).eq(plantTags);
    });

    it('crossing stages 7/8/9: the repeat pick, the jovian tag and the animals all pay, in order', () => {
      player.energy = 4;
      player.deltaProjectData!.position = 6;
      const regolith = new RegolithEaters();
      player.playedCards.push(regolith);
      player.actionsThisGeneration.add(CardName.REGOLITH_EATERS);
      const animalCard = fakeCard({resourceType: CardResource.ANIMAL, name: 'AnimalHost' as CardName});
      player.playedCards.push(animalCard);

      DeltaProjectExpansion.advance(player, 4);
      runAllActions(game);
      // Crossed stage 7 asks which used action to repeat…
      const repeat = cast(player.popWaitingFor(), SelectCard);
      expect(repeat.cards).includes(regolith);
      repeat.cb([regolith]);
      runAllActions(game);
      expect(regolith.resourceCount).eq(1);
      // …stage 8 granted the jovian, stage 9 (single host) auto-applied,
      // and the destination 10 is the positional 2 VP claim.
      expect(player.tags.extraJovianTags).eq(1);
      expect(animalCard.resourceCount).eq(2);
      expect(player.deltaProjectData!.position).eq(10);
      expectDeltaVp(player, 2);
    });

    it('9 → 11: the crossed 2 VP stage pays nothing; the 5 VP destination scores normally', () => {
      player.energy = 2;
      player.deltaProjectData!.position = 9;
      DeltaProjectExpansion.advance(player, 2);
      runAllActions(game);
      expect(player.popWaitingFor()).is.undefined;
      expect(player.deltaProjectData!.position).eq(11);
      // Only the FINAL position scores — never 2+5.
      expectDeltaVp(player, 5);
    });

    it('8 → 10: the crossed stage 9 pays; the 2 VP DESTINATION is claimed normally', () => {
      player.energy = 2;
      player.deltaProjectData!.position = 8;
      const animalCard = fakeCard({resourceType: CardResource.ANIMAL, name: 'AnimalHost' as CardName});
      player.playedCards.push(animalCard);

      DeltaProjectExpansion.advance(player, 2);
      runAllActions(game);
      expect(animalCard.resourceCount).eq(2);
      expectDeltaVp(player, 2);
    });

    it('10 → 11: a one-step move off the 2 VP slot stays the standard move', () => {
      player.energy = 1;
      player.deltaProjectData!.position = 10;
      DeltaProjectExpansion.advance(player, 1);
      runAllActions(game);
      expect(player.popWaitingFor()).is.undefined;
      expectDeltaVp(player, 5);
    });

    it('an OPPONENT\'s multi-step move is not modified', () => {
      playAllDeltaTrackTags(opponent);
      opponent.energy = 3;
      DeltaProjectExpansion.advance(opponent, 3);
      runAllActions(game);
      // Only the destination (stage 3) paid — no stage 1/2 prompts arose.
      expect(opponent.popWaitingFor()).is.undefined;
      expect(opponent.production.megacredits).eq(2);
      expect(opponent.steel).eq(0);
    });

    it('two separate one-step advances never merge into a traversal', () => {
      player.energy = 2;
      DeltaProjectExpansion.advance(player, 1);
      runAllActions(game);
      cast(player.popWaitingFor(), OrOptions).options[0].cb();
      expect(player.steel).eq(2);
      runAllActions(game);

      DeltaProjectExpansion.advance(player, 1);
      runAllActions(game);
      const stage2 = cast(player.popWaitingFor(), OrOptions);
      stage2.options[0].cb();
      runAllActions(game);
      expect(player.popWaitingFor()).is.undefined;
      // Each move paid its own destination and nothing else.
      expect(player.production.energy).eq(1);
      expect(player.production.megacredits).eq(0);
    });

    it('per-position waives: decline the crossed 7 and 9 by name, keep the rest', () => {
      player.energy = 4;
      player.deltaProjectData!.position = 6;
      const regolith = new RegolithEaters();
      player.playedCards.push(regolith);
      player.actionsThisGeneration.add(CardName.REGOLITH_EATERS);
      const animalCard = fakeCard({resourceType: CardResource.ANIMAL, name: 'AnimalHost' as CardName});
      player.playedCards.push(animalCard);

      DeltaProjectExpansion.advance(player, 4, undefined, {waivedTargetPositions: [7, 9]});
      runAllActions(game);
      // No target prompt arose; the declines are NAMED (no silent loss).
      expect(player.popWaitingFor()).is.undefined;
      expect(regolith.resourceCount).eq(0);
      expect(animalCard.resourceCount).eq(0);
      expect(player.tags.extraJovianTags).eq(1);
      const log = game.gameLog.map((m) => m.message).join('\n');
      expect(log).to.contain('declined to reuse a card action');
      expect(log).to.contain('declined to add animals');
    });

    it('a waive of one position leaves the other stage asking', () => {
      player.energy = 3;
      player.deltaProjectData!.position = 6;
      const regolith = new RegolithEaters();
      player.playedCards.push(regolith);
      player.actionsThisGeneration.add(CardName.REGOLITH_EATERS);
      const animalCard = fakeCard({resourceType: CardResource.ANIMAL, name: 'AnimalHost' as CardName});
      player.playedCards.push(animalCard);

      DeltaProjectExpansion.advance(player, 3, undefined, {waivedTargetPositions: [7]});
      runAllActions(game);
      // 7 declined, 8 paid, the destination 9 auto-applied its single host.
      expect(regolith.resourceCount).eq(0);
      expect(animalCard.resourceCount).eq(2);
      expect(player.tags.extraJovianTags).eq(1);
    });

    it('a crossed choice is granted but never recorded as a STOP', () => {
      player.energy = 2;
      DeltaProjectExpansion.advance(player, 2);
      runAllActions(game);
      cast(player.popWaitingFor(), OrOptions).options[0].cb();
      runAllActions(game);
      const dest = cast(player.popWaitingFor(), OrOptions);
      dest.options[1].cb();
      expect(player.steel).eq(2);
      expect(player.production.heat).eq(1);
      // History: ONE stop (the landing), carrying ITS choice; the crossed
      // stage 1 left no stop and its answer was not written anywhere else.
      const stops = player.deltaProjectData!.stops!;
      expect(stops).has.length(1);
      expect(stops[0].position).eq(2);
      expect(stops[0].choice).eq(1);
    });

    it('the journal names the activation when crossed stages pay', () => {
      player.energy = 2;
      DeltaProjectExpansion.advance(player, 2);
      const log = game.gameLog.map((m) => m.message).join('\n');
      expect(log).to.contain('grants the reward of every stage crossed');
    });

    it('9 → 11 names the 2 VP exclusion, and nothing is granted for it', () => {
      player.energy = 2;
      player.deltaProjectData!.position = 9;
      DeltaProjectExpansion.advance(player, 2);
      const log = game.gameLog.map((m) => m.message).join('\n');
      // Nothing extra paid → no activation line; the omission is still named.
      expect(log).to.not.contain('grants the reward of every stage crossed');
      expect(log).to.contain('crossed the 2 VP stage');
    });

    it('payment is untouched: an unaffordable multi-step still throws before mutating', () => {
      player.energy = 2;
      expect(() => DeltaProjectExpansion.advance(player, 3)).to.throw();
      expect(player.deltaProjectData!.position).eq(0);
      expect(player.energy).eq(2);
    });
  });
});
