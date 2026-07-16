import {SelectProjectCardToPlay} from '../../../src/server/inputs/SelectProjectCardToPlay';
import {expect} from 'chai';
import {EccentricSponsor} from '../../../src/server/cards/prelude/EccentricSponsor';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions} from '../../TestingUtils';
import {NitrogenRichAsteroid} from '../../../src/server/cards/base/NitrogenRichAsteroid';
import {testGame} from '../../TestGame';
import {cast} from '../../../src/common/utils/utils';
import {PreludesExpansion} from '../../../src/server/preludes/PreludesExpansion';

describe('EccentricSponsor', () => {
  let eccentricSponsor: EccentricSponsor;
  let player: TestPlayer;

  beforeEach(() => {
    eccentricSponsor = new EccentricSponsor();
    [/* game */, player] = testGame(1);
  });

  it('Gets card discount', () => {
    expect(eccentricSponsor.getCardDiscount(player)).to.eq(0);
    player.lastCardPlayed = eccentricSponsor.name;
    expect(eccentricSponsor.getCardDiscount(player)).to.eq(25);
  });

  // canPlay answers "does this prelude do anything?" BEFORE it is played — the
  // 25 M€ discount is not active yet, so it must be simulated. `false` makes
  // selectPreludeToPlay warn (`preludeFizzle`) + fizzle it for 15 M€ on pick.
  describe('canPlay', () => {
    it('is true when a card becomes affordable with the 25 M€ off', () => {
      const nitrogenRichAsteroid = new NitrogenRichAsteroid();
      player.cardsInHand = [nitrogenRichAsteroid];
      player.megaCredits = 6; // 31 - 25 = 6

      expect(player.canPlay(nitrogenRichAsteroid)).is.false; // not without the discount
      expect(eccentricSponsor.canPlay(player)).is.true;
    });

    it('is false when even the 25 M€ off leaves nothing playable', () => {
      const nitrogenRichAsteroid = new NitrogenRichAsteroid();
      player.cardsInHand = [nitrogenRichAsteroid];
      player.megaCredits = 5; // 31 - 25 = 6 > 5

      expect(eccentricSponsor.canPlay(player)).is.false;
    });

    it('is false with an empty hand', () => {
      player.cardsInHand = [];
      expect(eccentricSponsor.canPlay(player)).is.false;
    });

    it('agrees with what playing it actually finds (no false negative)', () => {
      const nitrogenRichAsteroid = new NitrogenRichAsteroid();
      player.cardsInHand = [nitrogenRichAsteroid];
      player.megaCredits = 6;

      expect(eccentricSponsor.canPlay(player)).is.true;

      // The real follow-up must find the same card — a false negative would
      // have silently robbed the player of the prelude.
      player.playCard(eccentricSponsor);
      runAllActions(player.game);
      const select = cast(player.popWaitingFor(), SelectProjectCardToPlay);
      expect(select.cards).deep.eq([nitrogenRichAsteroid]);
    });

    // The whole point of the override: the player is TOLD before committing,
    // and picking it settles for the 15 M€ instead of an empty round trip.
    it('drives the preludeFizzle warning + the 15 M€ settle on pick', () => {
      player.cardsInHand = [new NitrogenRichAsteroid()];
      player.megaCredits = 0;

      const select = PreludesExpansion.selectPreludeToPlay(player, [eccentricSponsor]);
      expect(eccentricSponsor.warnings.has('preludeFizzle'), 'the UI is warned').is.true;

      select.process({type: 'card', cards: [eccentricSponsor.name]});
      runAllActions(player.game);
      expect(player.megaCredits).eq(15);
    });

    it('carries NO fizzle warning while something is playable', () => {
      player.cardsInHand = [new NitrogenRichAsteroid()];
      player.megaCredits = 6;

      PreludesExpansion.selectPreludeToPlay(player, [eccentricSponsor]);
      expect(eccentricSponsor.warnings.has('preludeFizzle')).is.false;
    });

    it('leaves the live hand exactly as it found it (probe is restorative)', () => {
      const nitrogenRichAsteroid = new NitrogenRichAsteroid();
      player.cardsInHand = [nitrogenRichAsteroid];
      player.megaCredits = 0;

      // Baseline: the real, discount-free playability pass.
      player.getPlayableCards();
      const warnings = Array.from(nitrogenRichAsteroid.warnings);
      const costs = nitrogenRichAsteroid.additionalProjectCosts;

      eccentricSponsor.canPlay(player);

      // The hand is on screen during the prelude phase — it must not be left
      // describing a discount that is not active yet.
      expect(Array.from(nitrogenRichAsteroid.warnings)).deep.eq(warnings);
      expect(nitrogenRichAsteroid.additionalProjectCosts).deep.eq(costs);
      expect(player.megaCredits).eq(0);
      expect(player.cardsInHand).deep.eq([nitrogenRichAsteroid]);
    });
  });

  it('Should play', () => {
    const nitrogenRichAsteroid = new NitrogenRichAsteroid();
    player.cardsInHand = [nitrogenRichAsteroid];
    player.megaCredits = 6;

    expect(player.getCardCost(nitrogenRichAsteroid)).eq(31);
    expect(player.canPlay(nitrogenRichAsteroid)).is.false;

    player.playCard(eccentricSponsor);
    runAllActions(player.game);
    const selectProjectCardToPlay = cast(player.popWaitingFor(), SelectProjectCardToPlay);
    expect(selectProjectCardToPlay.cards).deep.eq([nitrogenRichAsteroid]);

    expect(player.getCardCost(nitrogenRichAsteroid)).eq(6);
    expect(player.canPlay(nitrogenRichAsteroid)).is.true;
  });

  it('Fizzle', () => {
    const nitrogenRichAsteroid = new NitrogenRichAsteroid();
    player.cardsInHand = [nitrogenRichAsteroid];
    player.megaCredits = 0;

    expect(player.getCardCost(nitrogenRichAsteroid)).eq(31);
    expect(player.canPlay(nitrogenRichAsteroid)).is.false;

    player.playCard(eccentricSponsor);
    runAllActions(player.game);
    cast(player.popWaitingFor(), undefined);
    expect(player.megaCredits).eq(15);
    expect(player.cardsInHand).deep.eq([nitrogenRichAsteroid]);
  });
});
