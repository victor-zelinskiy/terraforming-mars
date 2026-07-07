import {expect} from 'chai';
import {
  allStepsCaptured,
  buildTradeBatch,
  colonyOwnerCounts,
  effectiveTradePosition,
  freeTradeFleets,
  rewardAtPosition,
  tradeNotices,
  tradeSteps,
  trackChoiceResponse,
} from '../../../../src/client/components/colonies/colonyTradePlan';
import {ColonyTradePreviewModel} from '../../../../src/common/models/ColonyTradePreviewModel';
import {ColonyMetadata, colonyMetadata} from '../../../../src/common/colonies/ColonyMetadata';
import {ColonyBenefit} from '../../../../src/common/colonies/ColonyBenefit';
import {ColonyName} from '../../../../src/common/colonies/ColonyName';
import {CardName} from '../../../../src/common/cards/CardName';
import {CardResource} from '../../../../src/common/CardResource';
import {Resource} from '../../../../src/common/Resource';
import {Color} from '../../../../src/common/Color';
import {SelectCardModel, SelectPaymentModel} from '../../../../src/common/models/PlayerInputModel';

const PICK = {type: 'card', cards: [], max: 1, min: 1} as unknown as SelectCardModel;
const PAYMENT = {type: 'payment', amount: 9} as unknown as SelectPaymentModel;

function preview(over: Partial<ColonyTradePreviewModel> = {}): ColonyTradePreviewModel {
  return {
    colonyName: ColonyName.ENCELADUS,
    track: {current: 3, effective: 3, steps: 0, willAsk: false},
    rewardQuantity: 3,
    followUps: [],
    ...over,
  };
}

const ENCELADUS_META: ColonyMetadata = colonyMetadata({
  name: ColonyName.ENCELADUS,
  cardResource: CardResource.MICROBE,
  build: {description: '', type: ColonyBenefit.ADD_RESOURCES_TO_CARD, quantity: [3, 3, 3]},
  trade: {description: '', type: ColonyBenefit.ADD_RESOURCES_TO_CARD, quantity: [0, 1, 2, 3, 4, 4, 5]},
  colony: {description: '', type: ColonyBenefit.ADD_RESOURCES_TO_CARD},
});

describe('colonyTradePlan', () => {
  it('tradeSteps: payment first (M€ path only), then track choice, then card targets', () => {
    const p = preview({
      megacreditsPayment: PAYMENT,
      track: {current: 2, effective: 3, steps: 1, willAsk: true},
      followUps: [
        {kind: 'trackChoice', steps: 1},
        {kind: 'cardTarget', role: 'colonyBonus', resource: CardResource.MICROBE, amount: 1, pick: PICK, lost: false},
        {kind: 'cardTarget', role: 'tradeReward', resource: CardResource.MICROBE, amount: 3, pick: PICK, lost: false},
      ],
    });
    expect(tradeSteps(p, true).map((s) => s.kind)).to.deep.eq(['payment', 'trackChoice', 'cardTarget', 'cardTarget']);
    expect(tradeSteps(p, false).map((s) => s.kind)).to.deep.eq(['trackChoice', 'cardTarget', 'cardTarget']);
  });

  it('tradeSteps: auto / lost targets are not interactive steps', () => {
    const p = preview({
      followUps: [
        {kind: 'cardTarget', role: 'tradeReward', resource: CardResource.MICROBE, amount: 3, auto: CardName.TARDIGRADES, lost: false},
      ],
    });
    expect(tradeSteps(p, false)).to.deep.eq([]);
    const notices = tradeNotices(p);
    expect(notices).has.length(1);
    expect(notices[0]).to.deep.include({kind: 'autoTarget', card: CardName.TARDIGRADES});
  });

  it('tradeNotices: lost resources and after-confirm notes', () => {
    const p = preview({
      followUps: [
        {kind: 'cardTarget', role: 'tradeReward', resource: CardResource.MICROBE, amount: 3, lost: true},
        {kind: 'note', role: 'colonyBonus', note: 'copyTrade'},
      ],
    });
    const notices = tradeNotices(p);
    expect(notices[0].kind).to.eq('lostResource');
    expect(notices[1].kind).to.eq('afterConfirm');
  });

  it('trackChoiceResponse maps the chosen advance to the OrOptions index', () => {
    // Options: [3 steps, 2 steps, 1 step, don't].
    expect(trackChoiceResponse(3, 3)).to.deep.eq({type: 'or', index: 0, response: {type: 'option'}});
    expect(trackChoiceResponse(3, 1)).to.deep.eq({type: 'or', index: 2, response: {type: 'option'}});
    expect(trackChoiceResponse(3, 0)).to.deep.eq({type: 'or', index: 3, response: {type: 'option'}});
  });

  it('buildTradeBatch wraps the trade and appends captured steps in order', () => {
    const steps = tradeSteps(preview({
      followUps: [
        {kind: 'cardTarget', role: 'colonyBonus', resource: CardResource.MICROBE, amount: 1, pick: PICK, lost: false},
        {kind: 'cardTarget', role: 'tradeReward', resource: CardResource.MICROBE, amount: 3, pick: PICK, lost: false},
      ],
    }), false);
    const batch = buildTradeBatch({
      tradePath: [2],
      paymentIndex: 1,
      colonyName: ColonyName.ENCELADUS,
      steps,
      captures: {0: CardName.TARDIGRADES, 1: CardName.GHG_PRODUCING_BACTERIA},
    });
    expect(batch).to.deep.eq([
      {
        type: 'or', index: 2, response: {
          type: 'and',
          responses: [
            {type: 'or', index: 1, response: {type: 'option'}},
            {type: 'colony', colonyName: ColonyName.ENCELADUS},
          ],
        },
      },
      {type: 'card', cards: [CardName.TARDIGRADES]},
      {type: 'card', cards: [CardName.GHG_PRODUCING_BACTERIA]},
    ]);
  });

  it('buildTradeBatch truncates at the first uncaptured step', () => {
    const steps = tradeSteps(preview({
      megacreditsPayment: PAYMENT,
      followUps: [
        {kind: 'cardTarget', role: 'tradeReward', resource: CardResource.MICROBE, amount: 3, pick: PICK, lost: false},
      ],
    }), true);
    expect(steps.map((s) => s.kind)).to.deep.eq(['payment', 'cardTarget']);
    // The payment was NOT captured — the card pick after it must not be sent.
    const batch = buildTradeBatch({
      tradePath: [],
      paymentIndex: 0,
      colonyName: ColonyName.ENCELADUS,
      steps,
      captures: {1: CardName.TARDIGRADES},
    });
    expect(batch).has.length(1);
    expect(allStepsCaptured(steps, {1: CardName.TARDIGRADES})).is.false;
    expect(allStepsCaptured(steps, {0: {megacredits: 9}, 1: CardName.TARDIGRADES})).is.true;
  });

  it('rewardAtPosition resolves per-position quantity and array resources', () => {
    expect(rewardAtPosition(ENCELADUS_META, 4)).to.deep.eq({
      type: ColonyBenefit.ADD_RESOURCES_TO_CARD,
      quantity: 4,
      resource: undefined,
      cardResource: CardResource.MICROBE,
    });
    const luna = colonyMetadata({
      name: ColonyName.LUNA,
      build: {description: '', type: ColonyBenefit.GAIN_PRODUCTION, quantity: [2, 2, 2], resource: Resource.MEGACREDITS},
      trade: {description: '', type: ColonyBenefit.GAIN_RESOURCES, quantity: [1, 2, 4, 7, 10, 13, 17], resource: Resource.MEGACREDITS},
      colony: {description: '', type: ColonyBenefit.GAIN_RESOURCES, quantity: 2, resource: Resource.MEGACREDITS},
    });
    expect(rewardAtPosition(luna, 3).quantity).to.eq(7);
    expect(rewardAtPosition(luna, 3).resource).to.eq(Resource.MEGACREDITS);
    // Clamped to the track bounds.
    expect(rewardAtPosition(luna, 99).quantity).to.eq(17);
  });

  it('effectiveTradePosition applies the offset (capped), honours shouldIncreaseTrack=no', () => {
    const colony = {trackPosition: 5, colonies: [], isActive: true, name: ColonyName.LUNA, visitor: undefined};
    expect(effectiveTradePosition(colony, ENCELADUS_META, 0)).to.eq(5);
    expect(effectiveTradePosition(colony, ENCELADUS_META, 2)).to.eq(6);
    const noAdvance = colonyMetadata({
      name: ColonyName.TITANIA,
      build: {description: '', type: ColonyBenefit.GAIN_RESOURCES, quantity: [1, 1, 1], resource: Resource.TITANIUM},
      trade: {description: '', type: ColonyBenefit.LOSE_RESOURCES, quantity: [0, 0, 0, 1, 2, 3, 4], resource: Resource.TITANIUM},
      colony: {description: '', type: ColonyBenefit.GAIN_VP, quantity: 1},
      shouldIncreaseTrack: 'no',
    });
    expect(effectiveTradePosition(colony, noAdvance, 2)).to.eq(5);
  });

  it('freeTradeFleets / colonyOwnerCounts', () => {
    expect(freeTradeFleets({fleetSize: 2, tradesThisGeneration: 1})).to.eq(1);
    expect(freeTradeFleets({fleetSize: 1, tradesThisGeneration: 1})).to.eq(0);
    const red = 'red' as Color;
    const blue = 'blue' as Color;
    expect(colonyOwnerCounts({colonies: [red, blue, red]})).to.deep.eq([
      {color: red, count: 2},
      {color: blue, count: 1},
    ]);
  });
});
