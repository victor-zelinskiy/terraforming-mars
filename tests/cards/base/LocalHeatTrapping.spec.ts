import {expect} from 'chai';
import {cast} from '@/common/utils/utils';
import {Fish} from '../../../src/server/cards/base/Fish';
import {LocalHeatTrapping} from '../../../src/server/cards/base/LocalHeatTrapping';
import {Pets} from '../../../src/server/cards/base/Pets';
import {Helion} from '../../../src/server/cards/corporation/Helion';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {AndOptions} from '../../../src/server/inputs/AndOptions';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {IGame} from '../../../src/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {runAllActions} from '../../TestingUtils';
import {StormCraftIncorporated} from '../../../src/server/cards/colonies/StormCraftIncorporated';

describe('LocalHeatTrapping', () => {
  let card: LocalHeatTrapping;
  let player: TestPlayer;
  let game: IGame;
  let helion: Helion;

  beforeEach(() => {
    card = new LocalHeatTrapping();
    [game, player] = testGame(2);
    helion = new Helion();
  });

  it('Cannot play without 5 heat', () => {
    player.megaCredits = card.cost;
    player.cardsInHand = [card];
    expect(player.canPlay(card)).is.false;
    player.heat = 4;
    expect(player.canPlay(card)).is.false;
    player.heat = 5;
    expect(player.canPlay(card)).is.true;
  });

  it('Should play - no animal targets', () => {
    player.megaCredits = card.cost;
    player.heat = 6;
    player.megaCredits = 1;
    player.cardsInHand = [card];

    expect(player.canPlay(card)).is.true;

    card.play(player);

    expect(player.plants).to.eq(4);
    expect(player.heat).to.eq(1);
  });

  it('Should play - gain plants branch', () => {
    player.heat = 5;
    const pets = new Pets();
    player.playedCards.push(card, pets);

    const orOptions = cast(card.play(player), OrOptions);
    expect(orOptions.options).has.lengthOf(2); // gain plants / add animals
    expect(player.heat).to.eq(0); // heat spent up front

    orOptions.options[0].cb();
    expect(player.plants).to.eq(4);
  });

  it('cardPlayPreview pre-collects the Stormcraft heat-source payment as a preStep', () => {
    const stormcraft = new StormCraftIncorporated();
    player.playedCards.push(card, stormcraft);
    stormcraft.resourceCount = 3; // floaters available → spendHeat will prompt
    player.heat = 2;

    const preview = card.cardPlayPreview(player);
    expect(preview.preSteps).has.lengthOf(1);
    const pre = preview.preSteps![0];
    expect(pre.kind).to.eq('spendHeat');
    // The hosted input is the heat-source AndOptions, marked so SpendHeatContent reads it.
    const input = (pre as {input: {type: string, spendHeatPrompt?: {amount: number}}}).input;
    expect(input.type).to.eq('and');
    expect(input.spendHeatPrompt).to.deep.eq({amount: 5});
  });

  it('cardPlayPreview has NO heat preStep without Stormcraft floaters (heat deducted directly)', () => {
    player.heat = 5;
    player.playedCards.push(card);
    const preview = card.cardPlayPreview(player);
    expect(preview.preSteps ?? []).has.lengthOf(0);
  });

  it('the pre-collected heat payment + plant choice replay in ONE batch (Stormcraft)', () => {
    const stormcraft = new StormCraftIncorporated();
    player.playedCards.push(card, stormcraft);
    stormcraft.resourceCount = 3;
    player.heat = 1; // 1 stock heat + floaters cover the 5

    // play → the heat-source AndOptions prompts FIRST (before the plant choice).
    const heatAnd = cast(card.play(player), AndOptions);
    // Resolve it the way SpendHeatContent would: 1 stock heat + 2 floaters = 5.
    heatAnd.options[0].cb(1); // heat
    heatAnd.options[1].cb(2); // floaters
    const next = heatAnd.cb(undefined);
    // No animal card → the choice auto-resolved to "gain 4 plants" inside spendHeat's cb.
    expect(next).is.undefined;
    expect(player.heat).to.eq(0);
    expect(stormcraft.resourceCount).to.eq(1); // 3 − 2 floaters
    expect(player.plants).to.eq(4);
  });

  it('The plant/animal choice carries contextual metadata (premium modal, not bare option list)', () => {
    player.heat = 5;
    const pets = new Pets();
    player.playedCards.push(card, pets);

    const orOptions = cast(card.play(player), OrOptions);
    // When the play modal can't pre-collect it (Stormcraft inserts a heat-source
    // prompt first), this rides the follow-up — so it must render as the premium
    // ContextualChoiceContent (source card + result chips), not the bare list.
    expect(orOptions.choiceContext, 'choiceContext marker').is.not.undefined;
    expect(orOptions.choiceContext?.source.card).to.eq(card.name);
    expect(orOptions.choiceContext?.mode).to.eq('effect-choice');
    // Each option carries premium result chips (+4 plants / +2 animals to a card).
    const plantsMeta = (orOptions.options[0] as {metadata?: {effects?: ReadonlyArray<{icon: string, amount: number}>}}).metadata;
    const animalMeta = (orOptions.options[1] as {metadata?: {effects?: ReadonlyArray<{icon: string, amount: number, note?: string}>}}).metadata;
    expect(plantsMeta?.effects?.[0]).to.include({icon: 'plants', amount: 4});
    expect(animalMeta?.effects?.[0]).to.include({icon: 'animal', amount: 2, note: 'to a card'});
  });

  it('Should play - single animal target asks which card (no autoselect)', () => {
    player.heat = 5;
    const pets = new Pets();
    player.playedCards.push(card, pets);

    const orOptions = cast(card.play(player), OrOptions);
    expect(player.heat).to.eq(0);

    orOptions.options[1].cb(); // add animals → defers the target picker
    runAllActions(game);
    const select = cast(player.popWaitingFor(), SelectCard);
    expect(select.cards).has.lengthOf(1);
    select.cb([pets]);
    runAllActions(game);
    expect(pets.resourceCount).to.eq(2);
  });

  it('Should play - multiple animal targets', () => {
    player.heat = 5;
    const pets = new Pets();
    const fish = new Fish();
    player.playedCards.push(card, pets, fish);

    const orOptions = cast(card.play(player), OrOptions);
    expect(player.heat).to.eq(0);

    orOptions.options[1].cb();
    runAllActions(game);
    const select = cast(player.popWaitingFor(), SelectCard);
    expect(select.cards).has.lengthOf(2);
    select.cb([fish]);
    runAllActions(game);
    expect(fish.resourceCount).to.eq(2);
  });

  it('Cannot play as Helion if not enough heat left after paying for card', () => {
    helion.play(player);
    player.playedCards.push(helion);

    player.megaCredits = 0;
    player.heat = 5; // have to pay for card with 1 heat
    player.cardsInHand = [card];
    expect(player.canPlay(card)).is.false;
    player.megaCredits = 1;
    expect(player.canPlay(card)).is.true;
  });

  it('Helion / Stormcraft merger canPlay', () => {
    const stormcraft = new StormCraftIncorporated();
    helion.play(player);
    player.playedCards.push(helion);
    player.playedCards.push(stormcraft);
    player.cardsInHand = [card];

    function canPlay(config: {mc: number, heat: number, floaters: number, discount: number}) {
      player.megaCredits = config.mc;
      player.heat = config.heat;
      stormcraft.resourceCount = config.floaters;
      player.colonies.cardDiscount = config.discount;
      return player.canPlay(card);
    }

    // Thanks to Merger, canPlay has to solve these edge cases.
    // Case 1: Player has 5 heat and 1MC.
    // Case 2: 0 heat, 1 MC, and 3 Stormcraft resources
    // Case 3: 0 heat, 0 MC, and 3 Stormcraft resources
    // Case 4: 1 heat, 0 MC, and 3 Stormcraft resources
    // Case 5: 0 heat, 0 MC, 3 Stormcraft resources, and a 1MC card discount.

    expect(canPlay({mc: 1, heat: 5, floaters: 0, discount: 0})).is.true;
    expect(canPlay({mc: 1, heat: 0, floaters: 3, discount: 0})).is.true;
    expect(canPlay({mc: 0, heat: 0, floaters: 3, discount: 0})).is.false;
    expect(canPlay({mc: 0, heat: 0, floaters: 3, discount: 1})).is.true;
    expect(canPlay({mc: 0, heat: 6, floaters: 0, discount: 0})).is.true;
    expect(canPlay({mc: 0, heat: 4, floaters: 1, discount: 0})).is.true;
  });
});
