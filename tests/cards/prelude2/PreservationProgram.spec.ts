import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {forceGenerationEnd, testRedsCosts} from '../../TestingUtils';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {PreservationProgram} from '../../../src/server/cards/prelude2/PreservationProgram';
import {Phase} from '../../../src/common/Phase';
import {BigAsteroid} from '../../../src/server/cards/base/BigAsteroid';
import {CardName} from '../../../src/common/cards/CardName';
import {RATING_SKIP_LABEL, RATING_SKIP_REASON, ratingSkipMarkOf, skipEffects} from '../../../src/server/models/skippedRating';
import * as actionPreviews from '../../../src/server/cards/actionPreviews';
import {heatConversionMetadata} from '../../../src/server/cards/base/standardActions/ConvertHeat';
import {UnitedNationsMarsInitiative} from '../../../src/server/cards/corporation/UnitedNationsMarsInitiative';

describe('PreservationProgram', () => {
  let card: PreservationProgram;
  let player: TestPlayer;
  let game: IGame;
  let player2: TestPlayer;

  beforeEach(() => {
    card = new PreservationProgram();
    [game, player, player2] = testGame(2, {turmoilExtension: true});
  });

  it('play', () => {
    card.play(player);
    expect(player.terraformRating).eq(25);
  });

  it('Blocks first TR of each generation', () => {
    card.play(player);
    player.playedCards.push(card);

    game.phase = Phase.ACTION;

    expect(player.terraformRating).eq(25);

    player.increaseTerraformRating();
    expect(player.terraformRating).eq(25);

    player.increaseTerraformRating();
    expect(player.terraformRating).eq(26);

    player.increaseTerraformRating();
    expect(player.terraformRating).eq(27);

    forceGenerationEnd(game);

    player.increaseTerraformRating();
    expect(player.terraformRating).eq(27);

    player.increaseTerraformRating();
    expect(player.terraformRating).eq(28);
  });

  it('Allows multi TR to go partially through', () => {
    card.play(player);
    player.playedCards.push(card);

    game.phase = Phase.ACTION;

    expect(player.terraformRating).eq(25);

    player.increaseTerraformRating(3);
    expect(player.terraformRating).eq(27);
  });

  it('Compatible with Reds', () => {
    // Big asteroid raises the temperature 2 steps.
    const bigAsteroid = new BigAsteroid();
    testRedsCosts(() => player.canPlay(bigAsteroid), player, bigAsteroid.cost, 6);

    // The bump discounts the step the funnel will eat — the funnel's own three terms (`ratingSkipArmed`). The
    // harness's `setNextAgenda` pays the Reds' bonus rating in the ACTION phase (the lowest seat's +1 counts toward
    // `trThisGeneration`), so the state is re-armed before each probe: nothing gained yet this generation.
    const cb = () => {
      player.preservationProgram = true;
      player.trThisGeneration = 0;
      return player.canPlay(bigAsteroid);
    };
    testRedsCosts(cb, player, bigAsteroid.cost, 3);
  });

  it('Reds charge every step once a rating was gained this generation (the flag still standing — the funnel skips nothing then)', () => {
    const bigAsteroid = new BigAsteroid();
    const afterGain = () => {
      player.preservationProgram = true;
      player.trThisGeneration = 1;
      return player.canPlay(bigAsteroid);
    };
    testRedsCosts(afterGain, player, bigAsteroid.cost, 6);
  });

  it('only grants 4 TR when played during action phase', () => {
    game.phase = Phase.ACTION;
    card.play(player);

    expect(player.terraformRating).eq(24);
    expect(player.preservationProgram).is.false;
  });

  it('grants full 5 TR when played during action phase, after an earlier TR gain that generation', () => {
    game.phase = Phase.ACTION;

    player.increaseTerraformRating();
    expect(player.terraformRating).eq(21);

    card.play(player);

    expect(player.terraformRating).eq(26);
    expect(player.preservationProgram).is.false;
  });

  it('Reds pay for the TR when this card is played', () => {
    testRedsCosts(() => player.canPlay(card), player, 0, 15);
  });

  describe('the skip NAMES itself (P57 · FQ — invariant 4)', () => {
    beforeEach(() => {
      card.play(player);
      player.playedCards.push(card);
      game.phase = Phase.ACTION;
    });

    it('the eaten step is an `effect-skipped` fact under the card\'s own `rating-skipped` scope, with its magnitude', () => {
      player.increaseTerraformRating(3);
      const marker = game.events.events.find((e) => e.type === 'effect-triggered' && e.trigger === 'rating-skipped');
      expect(marker?.source).deep.eq({kind: 'card', card: CardName.PRESERVATION_PROGRAM, owner: player.color});
      const skipped = game.events.events.filter((e) => e.type === 'effect-skipped' && e.parentId === marker?.id);
      expect(skipped.map((e) => e.impact.skipped)).deep.eq([{
        label: RATING_SKIP_LABEL, reason: RATING_SKIP_REASON, effect: {direction: 'gain', icon: 'tr', amount: 1},
      }]);
      expect(player.terraformRating).eq(27);
      // The skip only once a generation.
      player.increaseTerraformRating();
      expect(game.events.events.filter((e) => e.type === 'effect-skipped')).length(1);
    });

    it('the card REACTS — a `skip` impact on its own record: nothing landed, nothing to fly', () => {
      player.increaseTerraformRating();
      const records = game.cardReactions.filter((r) => r.card === CardName.PRESERVATION_PROGRAM);
      expect(records).length(1);
      expect(records[0].channel).eq('rating-skipped');
      expect(records[0].impacts).deep.eq([{kind: 'skip', icon: 'tr', amount: 1, to: player.color}]);
    });

    it('the model reads `armed` → `spent` → `armed` across the generation', () => {
      expect(ratingSkipMarkOf(player)).eq('armed');
      player.increaseTerraformRating();
      expect(ratingSkipMarkOf(player)).eq('spent');
      forceGenerationEnd(game);
      expect(ratingSkipMarkOf(player)).eq('armed');
      expect(ratingSkipMarkOf(player2)).is.undefined;
    });
  });

  describe('the previews promise exactly what the funnel will do (the exit pass, `skippedRating.ts`)', () => {
    beforeEach(() => {
      card.play(player);
      player.playedCards.push(card);
      game.phase = Phase.ACTION;
    });

    it('splits the FIRST rating chip — +3 reads «+2» gained and one struck step under the card', () => {
      const out = skipEffects(player, [actionPreviews.trGain(player, 3), actionPreviews.trGain(player, 1)]);
      expect(out.map((e) => [e.amount, e.vetoed])).deep.eq([
        [2, undefined],
        [1, {card: CardName.PRESERVATION_PROGRAM, steps: 1}],
        [1, undefined],
      ]);
      expect(out[0].resulting).eq((out[0].current ?? 0) + 2);
    });

    it('a single step is struck WHOLE, and nothing is touched once the step was eaten', () => {
      expect(skipEffects(player, [actionPreviews.trGain(player, 1)]).map((e) => e.vetoed)).deep.eq([{card: CardName.PRESERVATION_PROGRAM, steps: 1}]);
      player.increaseTerraformRating();
      expect(skipEffects(player, [actionPreviews.trGain(player, 1)]).map((e) => e.vetoed)).deep.eq([undefined]);
    });

    it('nothing outside the action phase (the flag armed, the rating gained whole)', () => {
      game.phase = Phase.RESEARCH;
      expect(skipEffects(player, [actionPreviews.trGain(player, 2)]).map((e) => e.vetoed)).deep.eq([undefined]);
    });

    it('the heat conversion promises its rating struck — the temperature chip whole', () => {
      const effects = heatConversionMetadata(player, 8).effects ?? [];
      const tr = effects.filter((e) => e.icon === 'tr');
      expect(tr.map((e) => e.vetoed)).deep.eq([{card: CardName.PRESERVATION_PROGRAM, steps: 1}]);
      expect(effects.find((e) => e.icon === 'temperature')?.vetoed).is.undefined;
    });

    it('the UNMI corporation\'s +1 TR action is NO EFFECT while the skip is armed — and after the step was eaten it is not', () => {
      const unmi = new UnitedNationsMarsInitiative();
      expect(unmi.actionFutility(player)?.verdict).deep.eq({kind: 'rating-skipped', reason: RATING_SKIP_REASON});
      player.increaseTerraformRating();
      expect(unmi.actionFutility(player)).is.undefined;
    });
  });

  it('played in the action phase with nothing gained, its own preview reads «+4» and the struck step (upstream\'s +4, told)', () => {
    game.phase = Phase.ACTION;
    const effects = card.cardPlayPreview(player).branches[0].effects.filter((e) => e.icon === 'tr');
    expect(effects.map((e) => [e.amount, e.vetoed?.card])).deep.eq([[4, undefined], [1, CardName.PRESERVATION_PROGRAM]]);
    card.play(player);
    expect(player.terraformRating).eq(24);
  });

  it('played outside the action phase, its own preview reads +5 whole', () => {
    game.phase = Phase.PRELUDES;
    const effects = card.cardPlayPreview(player).branches[0].effects.filter((e) => e.icon === 'tr');
    expect(effects.map((e) => [e.amount, e.vetoed])).deep.eq([[5, undefined]]);
  });
});
