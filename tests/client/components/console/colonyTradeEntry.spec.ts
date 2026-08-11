import {expect} from 'chai';
import {CardName} from '../../../../src/common/cards/CardName';
import {DisabledOptionModel, SelectOptionModel} from '../../../../src/common/models/PlayerInputModel';
import {
  beginCardColonyTrade,
  cardColonyTradeCard,
  clearCardColonyTrade,
  colonyStepCrumbParts,
  lockedTradePaymentIndex,
  lockedTradePaymentReason,
} from '../../../../src/client/console/colonyTrade/colonyTradeEntry';

/**
 * THE TRADE'S SECOND DOOR. «Хочу торговать» and «хочу использовать Летающую
 * платформу» start the same move; after the door they are one flow. What this
 * module owns is the only thing allowed to differ — the entry context — and the
 * one question that context answers: WHICH payment path is this trade locked to.
 */

function option(title: string, card?: CardName): SelectOptionModel {
  return {
    type: 'option', title, buttonLabel: '',
    metadata: card === undefined ?
      {kind: 'resourceRemoval', icon: 'energy', amount: 1} :
      {kind: 'resourceRemoval', icon: 'floater', amount: 1, card},
  } as unknown as SelectOptionModel;
}

describe('colonyTradeEntry — the card-sourced colony trade', () => {
  afterEach(() => {
    // Module state is bundle-shared: a leaked entry would lock the fee of every
    // later spec's trade.
    clearCardColonyTrade();
  });

  it('is EMPTY by default — the ordinary «Колонии» entry locks nothing', () => {
    expect(cardColonyTradeCard()).to.eq('');
    expect(lockedTradePaymentIndex([option('Pay 1 energy')], '')).to.eq(-1);
  });

  it('arms and clears', () => {
    beginCardColonyTrade(CardName.TITAN_FLOATING_LAUNCHPAD);
    expect(cardColonyTradeCard()).to.eq(CardName.TITAN_FLOATING_LAUNCHPAD);
    clearCardColonyTrade();
    expect(cardColonyTradeCard()).to.eq('');
  });

  /**
   * The label is translated IN PLACE on render, so a text match stops matching
   * after the first paint — and it never said which card powers the path
   * anyway. The marker is the option's own `metadata.card`.
   */
  it('finds the locked path by its CARD marker, never by its label', () => {
    const options = [
      option('Pay 1 energy'),
      option('Потратьте 1 аэростат (действие Летающая платформа)', CardName.TITAN_FLOATING_LAUNCHPAD),
      option('Pay 7 M€'),
    ];
    expect(lockedTradePaymentIndex(options, CardName.TITAN_FLOATING_LAUNCHPAD)).to.eq(1);
    // A card the prompt is not offering: no index, and no guess.
    expect(lockedTradePaymentIndex(options, CardName.DARKSIDE_SMUGGLERS_UNION)).to.eq(-1);
  });

  /** The path can be refused while the branch is still available (the card's
   *  action already used, no floaters). The reason shown is the SERVER's. */
  it('takes the blocked reason from the server\'s own disabled option', () => {
    const disabled: ReadonlyArray<DisabledOptionModel> = [{
      title: 'Pay 1 floater (use ${0} action)',
      reason: 'No floaters on this card',
      metadata: {kind: 'resourceRemoval', icon: 'floater', amount: 1, card: CardName.TITAN_FLOATING_LAUNCHPAD},
    }];
    expect(lockedTradePaymentReason(disabled, CardName.TITAN_FLOATING_LAUNCHPAD))
      .to.eq('No floaters on this card');
    expect(lockedTradePaymentReason(disabled, CardName.COLLEGIUM_COPERNICUS)).to.eq(undefined);
    expect(lockedTradePaymentReason(disabled, '')).to.eq(undefined);
  });

  /**
   * Inside «ДЕЙСТВИЯ КАРТ › ЛЕТАЮЩАЯ ПЛАТФОРМА › …» the subject slot is already
   * spent on the card, so the colony folds INTO the tail. The header is the
   * only permanent trace of where the trade came from — which is why the tail
   * has to carry both parts and never drop one.
   */
  it('folds the colony into the crumb tail, and keeps the stage alone before one is chosen', () => {
    expect(colonyStepCrumbParts('', 'Colony selection')).to.deep.eq(['Colony selection']);
    expect(colonyStepCrumbParts('Ganymede', 'Trading')).to.deep.eq(['Ganymede', 'Trading']);
    expect(colonyStepCrumbParts('Pluto', 'Card draw')).to.deep.eq(['Pluto', 'Card draw']);
    expect(colonyStepCrumbParts('', '')).to.deep.eq([]);
  });
});
