import {expect} from 'chai';
import {EnergyMarket} from '../../../src/server/cards/promo/EnergyMarket';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectAmount} from '../../../src/server/inputs/SelectAmount';
import {Resource} from '../../../src/common/Resource';
import {PlayerInputModel, SelectAmountModel} from '../../../src/common/models/PlayerInputModel';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions} from '../../TestingUtils';
import {testGame} from '../../TestGame';
import {cast} from '../../../src/common/utils/utils';

describe('EnergyMarket', () => {
  let card: EnergyMarket;
  let player: TestPlayer;

  beforeEach(() => {
    card = new EnergyMarket();
    [/* game */, player] = testGame(1, {preludeExtension: true});
  });

  it('Can not act', () => {
    player.stock.add(Resource.MEGACREDITS, 1);
    expect(card.canAct(player)).is.not.true;
  });

  it('Can act when sufficient MC resources available', () => {
    player.stock.add(Resource.MEGACREDITS, 2);
    expect(card.canAct(player)).is.true;
  });

  it('Can act when sufficient MC (using heat) resources available', () => {
    player.canUseHeatAsMegaCredits = true;
    player.stock.add(Resource.MEGACREDITS, 1);
    player.stock.add(Resource.HEAT, 3);
    expect(card.canAct(player)).is.true;
  });

  it('Can act when energy production available', () => {
    player.production.add(Resource.ENERGY, 1);
    expect(card.canAct(player)).is.true;
  });

  it('Should act and provide options when enough MC resources and energy production available', () => {
    player.stock.add(Resource.MEGACREDITS, 2);
    player.production.add(Resource.ENERGY, 1);
    expect(card.canAct(player)).is.true;

    cast(card.action(player), OrOptions);
  });

  it('Should act when sufficient MC resources available', () => {
    player.stock.add(Resource.MEGACREDITS, 8);
    const selectAmount = cast(card.action(player), SelectAmount);
    expect(selectAmount.max).eq(4);
    const next = selectAmount.cb(3);
    expect(next).is.undefined;
    runAllActions(player.game);
    cast(player.getWaitingFor(), undefined);
    expect(player.megaCredits).eq(2);
    expect(player.energy).eq(3);
  });

  it('Should act when energy production available', () => {
    player.production.add(Resource.ENERGY, 1);
    const result = card.action(player);
    expect(result).is.undefined;

    expect(player.production.energy).to.eq(0);
    expect(player.megaCredits).to.eq(8);
  });

  // The energy dial counts what the player RECEIVES; the 2 M€ per step it charges
  // is deferred to a follow-up payment, so the dial's own `cost` hint is the ONLY
  // statement of the price before confirming. Without it the composer showed a
  // bare «выберите количество энергии» — a number with no price and no before→after.
  it('the energy dial states its price (2 M€ per step) in the preview AND the live input', () => {
    player.stock.add(Resource.MEGACREDITS, 8);
    const step = card.actionPreview(player).branches[0].steps[0];
    expect(step.kind).eq('input');
    const model = (step as {input: PlayerInputModel}).input as SelectAmountModel;
    expect(model.type).eq('amount');
    expect(model.icon).eq(Resource.ENERGY);
    expect(model.amountCost).deep.eq({icon: Resource.MEGACREDITS, perUnit: 2});
    // a spend dial never opens pre-armed at the player's whole pile
    expect(model.maxByDefault).is.false;

    // the LIVE input carries the same hints, so the native prompt reads identically
    const live = cast(card.action(player), SelectAmount).toModel();
    expect(live.icon).eq(model.icon);
    expect(live.amountCost).deep.eq(model.amountCost);
    expect(live.maxByDefault).eq(model.maxByDefault);
  });
});
