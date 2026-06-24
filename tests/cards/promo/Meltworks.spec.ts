import {expect} from 'chai';
import {Meltworks} from '../../../src/server/cards/promo/Meltworks';
import {StormCraftIncorporated} from '../../../src/server/cards/colonies/StormCraftIncorporated';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {IGame} from '../../../src/server/IGame';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {runAllActions} from '../../TestingUtils';
import {AndOptions} from '../../../src/server/inputs/AndOptions';
import {cast} from '../../../src/common/utils/utils';

describe('Meltworks', () => {
  let card: Meltworks;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new Meltworks();
    [game, player] = testGame(1);
  });

  it('Can not act', () => {
    player.heat = 4;
    expect(card.canAct(player)).is.not.true;
  });

  it('Should act', () => {
    player.heat = 5;
    expect(card.canAct(player)).is.true;

    card.action(player);
    expect(player.heat).to.eq(0);
    expect(player.steel).to.eq(3);
  });

  it('actionPreview pre-collects the Stormcraft heat-source payment as a preStep', () => {
    const stormcraft = new StormCraftIncorporated();
    player.playedCards.push(stormcraft);
    stormcraft.resourceCount = 3; // floaters available → spendHeat will prompt
    player.heat = 1;

    const preview = actionPreview(player, card);
    expect(preview.preSteps).has.lengthOf(1);
    const pre = preview.preSteps![0];
    expect(pre.kind).to.eq('spendHeat');
    const input = (pre as {input: {type: string, spendHeatPrompt?: {amount: number}}}).input;
    expect(input.type).to.eq('and');
    expect(input.spendHeatPrompt).to.deep.eq({amount: 5});
  });

  it('actionPreview has NO heat preStep without Stormcraft floaters (heat deducted directly)', () => {
    player.heat = 5;
    const preview = actionPreview(player, card);
    expect(preview.preSteps ?? []).has.lengthOf(0);
  });

  it('the pre-collected heat payment + the effect replay in ONE batch (Stormcraft)', () => {
    const stormcraft = new StormCraftIncorporated();
    player.playedCards.push(stormcraft);
    stormcraft.resourceCount = 3;
    player.heat = 1; // 1 stock heat + floaters cover the 5

    // The action's spend.heat DEFERS the heat-source AndOptions, which prompts FIRST
    // (before the steel is gained) — exactly where the batch's pre-collected response lands.
    card.action(player);
    runAllActions(game);
    const heatAnd = cast(player.popWaitingFor(), AndOptions);
    heatAnd.options[0].cb(1); // heat
    heatAnd.options[1].cb(2); // floaters
    heatAnd.cb(undefined);
    runAllActions(game);
    expect(player.heat).to.eq(0);
    expect(stormcraft.resourceCount).to.eq(1); // 3 − 2 floaters
    expect(player.steel).to.eq(3); // the remainder runs after the heat payment
  });
});
