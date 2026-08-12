import {expect} from 'chai';
import {
  allStepsCaptured,
  buildTradeBatch,
  colonyOwnerBonusDrawsCards,
  colonyOwnerCounts,
  colonyRewardPackage,
  colonyTradeMayDrawCards,
  effectiveTradePosition,
  freeTradeFleets,
  rewardAtPosition,
  tradeNotices,
  tradeOutcome,
  tradeSteps,
  trackChoiceResponse,
  trackResetAfterBuild,
  trackResetPosition,
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
  it('trackResetPosition: the return base IS the built-colony count', () => {
    const red = 'red' as Color;
    const blue = 'blue' as Color;
    // The rule the focus stage draws as the ⟲ anchor: after a trade the marker
    // falls back to `colonies.length` (Colony.trade), so an empty colony
    // returns to position 0 and each settlement pushes the base one right.
    expect(trackResetPosition({colonies: []}, ENCELADUS_META)).to.eq(0);
    expect(trackResetPosition({colonies: [red]}, ENCELADUS_META)).to.eq(1);
    expect(trackResetPosition({colonies: [red, blue, red]}, ENCELADUS_META)).to.eq(3);
    // …and the build preview is exactly one step further.
    expect(trackResetAfterBuild({colonies: []}, ENCELADUS_META)).to.eq(1);
    expect(trackResetAfterBuild({colonies: [red, blue]}, ENCELADUS_META)).to.eq(3);
  });

  it('trackResetPosition: never past the last cell of a short track', () => {
    const red = 'red' as Color;
    const short = colonyMetadata({
      name: ColonyName.LUNA,
      build: {description: '', type: ColonyBenefit.GAIN_RESOURCES, quantity: [2, 2, 2], resource: Resource.MEGACREDITS},
      trade: {description: '', type: ColonyBenefit.GAIN_RESOURCES, quantity: [1, 2], resource: Resource.MEGACREDITS},
      colony: {description: '', type: ColonyBenefit.GAIN_RESOURCES, resource: Resource.MEGACREDITS},
    });
    expect(trackResetPosition({colonies: [red, red, red]}, short)).to.eq(1);
    expect(trackResetAfterBuild({colonies: [red, red, red]}, short)).to.eq(1);
  });

  /**
   * THE EMBEDDED-OUTCOME CLAIM IS STRUCTURAL. A colony that pays in
   * production, plants or heat must claim NOTHING: the claim's visible cost is
   * that the workspace stands a follow-up stage from submit time and refuses
   * to fold under it, which is exactly the empty dimmed box that stood over
   * Луна's finished trade until the 20 s claim backstop fired.
   */
  describe('colonyTradeMayDrawCards', () => {
    const cardTrack = colonyMetadata({
      name: ColonyName.PLUTO,
      build: {description: '', type: ColonyBenefit.DRAW_CARDS, quantity: [2, 2, 2]},
      // Position 0 pays nothing; every later position deals cards.
      trade: {description: '', type: ColonyBenefit.DRAW_CARDS, quantity: [0, 1, 2, 3, 4, 5, 6]},
      colony: {description: '', type: ColonyBenefit.DRAW_CARDS_AND_DISCARD_ONE},
    });
    const resourceTrack = colonyMetadata({
      name: ColonyName.LUNA,
      build: {description: '', type: ColonyBenefit.GAIN_PRODUCTION, quantity: [2, 2, 2], resource: Resource.MEGACREDITS},
      trade: {description: '', type: ColonyBenefit.GAIN_RESOURCES, quantity: [1, 2, 4, 7, 10, 13, 17], resource: Resource.MEGACREDITS},
      colony: {description: '', type: ColonyBenefit.GAIN_PRODUCTION, resource: Resource.MEGACREDITS},
    });

    it('is FALSE for every position of a colony that never deals cards', () => {
      for (let i = 0; i <= 6; i++) {
        expect(colonyTradeMayDrawCards(resourceTrack, i), `position ${i}`).to.eq(false);
      }
    });

    it('is TRUE from a card colony\'s zero-quantity start — a track advance is still reachable', () => {
      // The final position is not knowable at submit time (offset, `ask`
      // auto-advance and a chosen track step all move the marker forward), so
      // the question is «is there a card-dealing position at or past here».
      expect(colonyTradeMayDrawCards(cardTrack, 0)).to.eq(true);
      expect(colonyTradeMayDrawCards(cardTrack, 6)).to.eq(true);
    });

    it('stops claiming once no reachable position deals anything', () => {
      const tailIsEmpty = colonyMetadata({
        name: ColonyName.PLUTO,
        build: {description: '', type: ColonyBenefit.DRAW_CARDS, quantity: [1, 1, 1]},
        trade: {description: '', type: ColonyBenefit.DRAW_CARDS, quantity: [1, 2, 0, 0]},
        colony: {description: '', type: ColonyBenefit.DRAW_CARDS},
      });
      expect(colonyTradeMayDrawCards(tailIsEmpty, 1)).to.eq(true);
      expect(colonyTradeMayDrawCards(tailIsEmpty, 2)).to.eq(false);
    });

    it('the OWNER bonus is a separate question from the track', () => {
      expect(colonyOwnerBonusDrawsCards(cardTrack)).to.eq(true);
      expect(colonyOwnerBonusDrawsCards(resourceTrack)).to.eq(false);
    });
  });

  /**
   * «ОПЛАТА» — one grammar for every fee.
   *
   * A rail fee is tracked through the sequence (pay energy, then receive
   * energy, and the two must read continuously). A CARD fee is not on the rail
   * at all, so the only honest source of its `before → after` is the server's
   * own option metadata — without it the row printed a bare «−1» beside fully
   * dressed resource siblings, on a panel whose whole job is to add up.
   */
  describe('the payment row of the outcome', () => {
    const OUTCOME_ARGS = {
      metadata: colonyMetadata({
        name: ColonyName.GANYMEDE,
        build: {description: '', type: ColonyBenefit.GAIN_RESOURCES, resource: Resource.PLANTS, quantity: [1, 1, 1]},
        trade: {description: '', type: ColonyBenefit.GAIN_RESOURCES, resource: Resource.PLANTS, quantity: [0, 1, 2, 3, 4, 5, 6]},
        colony: {description: '', type: ColonyBenefit.GAIN_RESOURCES, resource: Resource.PLANTS, quantity: 1},
      }),
      rewardPosition: 2,
      ownColonyCount: 0,
      stocks: {megacredits: 650, steel: 0, titanium: 531, plants: 499, energy: 1, heat: 1031},
      production: {},
    };

    it('a RAIL fee reads its pair off the viewer\'s own stock, and keeps it in sequence', () => {
      const out = tradeOutcome({...OUTCOME_ARGS, payment: {icon: 'titanium', amount: 1}});
      expect(out.cost).to.deep.eq([
        {direction: 'cost', icon: 'titanium', amount: 1, current: 531, resulting: 530},
      ]);
      // …and the gain that follows is read AFTER the fee, on the same running stock.
      expect(out.gains[0]).to.include({icon: 'plants', current: 499, resulting: 501});
    });

    it('a CARD fee takes its pair from the SERVER — the rail knows nothing about floaters', () => {
      const out = tradeOutcome({
        ...OUTCOME_ARGS,
        payment: {icon: 'floater', amount: 1, resource: {current: 1, resulting: 0}},
      });
      expect(out.cost).to.deep.eq([
        {direction: 'cost', icon: 'floater', amount: 1, current: 1, resulting: 0},
      ]);
      // The card fee must NOT enter the running stock — it is not a rail metric.
      expect(out.gains[0]).to.include({icon: 'plants', current: 499, resulting: 501});
    });

    it('a card fee with no server pair still states the amount, never a wrong pair', () => {
      const out = tradeOutcome({...OUTCOME_ARGS, payment: {icon: 'data', amount: 3}});
      expect(out.cost).to.deep.eq([
        {direction: 'cost', icon: 'data', amount: 3, current: undefined, resulting: undefined},
      ]);
    });
  });
});


/*
 * THE REWARD PACKAGE — «ВАШ ИТОГ» / «СОСТАВ НАГРАДЫ» / «ДРУГИМ ИГРОКАМ».
 *
 * The two shapes the rail has to get right are Io (one reward TYPE paid by two
 * sources — one merged total) and Miranda (two DIFFERENT rewards going to two
 * different places — two lines that must never be added together). The other
 * owners are the third: a real amount for them, and nothing of it in the
 * viewer's total.
 */
describe('colonyRewardPackage', () => {
  const IO = colonyMetadata({
    name: ColonyName.IO,
    build: {description: '', type: ColonyBenefit.GAIN_RESOURCES, resource: Resource.HEAT, quantity: [2, 2, 2]},
    trade: {description: '', type: ColonyBenefit.GAIN_RESOURCES, resource: Resource.HEAT, quantity: [2, 3, 4, 6, 7, 8, 9]},
    colony: {description: '', type: ColonyBenefit.GAIN_RESOURCES, resource: Resource.HEAT, quantity: 2},
  });
  const MIRANDA = colonyMetadata({
    name: ColonyName.MIRANDA,
    cardResource: CardResource.ANIMAL,
    build: {description: '', type: ColonyBenefit.ADD_RESOURCES_TO_CARD},
    trade: {description: '', type: ColonyBenefit.ADD_RESOURCES_TO_CARD, quantity: [0, 1, 1, 2, 2, 3, 3]},
    colony: {description: '', type: ColonyBenefit.DRAW_CARDS},
  });
  const colony = (colonies: Array<Color>) => ({colonies});

  it('Io: the track and YOUR settlement merge into ONE total, with an honest pair', () => {
    const out = tradeOutcome({
      metadata: IO, rewardPosition: 3, payment: undefined, ownColonyCount: 1,
      stocks: {heat: 1001}, production: {},
    });
    const pkg = colonyRewardPackage({gains: out.gains, metadata: IO, colony: colony(['red', 'green']), viewer: 'red'});

    // ВАШ ИТОГ — one line: 6 (track) + 2 (your colony) = 8, 1001 → 1009.
    expect(pkg.totals).has.lengthOf(1);
    expect(pkg.totals[0]).to.include({icon: 'heat', amount: 8, current: 1001, resulting: 1009});
    // СОСТАВ НАГРАДЫ — the two payers, named and separate.
    expect(pkg.sources.map((r) => [r.kind, r.count, r.amount])).to.deep.eq([
      ['track', 1, 6],
      ['ownColony', 1, 2],
    ]);
    // ДРУГИМ ИГРОКАМ — the opponent's own bonus, never in the total above.
    expect(pkg.others).to.deep.eq([{color: 'green', count: 1, amount: 2, icon: 'heat', label: undefined, production: undefined}]);
  });

  it('Miranda: different rewards to different places stay SEPARATE lines', () => {
    const out = tradeOutcome({
      metadata: MIRANDA, rewardPosition: 3, payment: undefined, ownColonyCount: 1,
      stocks: {}, production: {},
    });
    const pkg = colonyRewardPackage({gains: out.gains, metadata: MIRANDA, colony: colony(['red', 'green']), viewer: 'red'});

    expect(pkg.totals).has.lengthOf(2);
    // «+2 животных · На выбранную карту» — no stock pair exists for a card resource.
    expect(pkg.totals[0]).to.include({icon: 'animal', amount: 2, destinationKey: 'To the chosen card'});
    expect(pkg.totals[0].current).to.eq(undefined);
    // «+1 карта · В руку»
    expect(pkg.totals[1]).to.include({icon: 'cards', amount: 1, destinationKey: 'To your hand'});
    expect(pkg.sources.map((r) => [r.kind, r.amount])).to.deep.eq([['track', 2], ['ownColony', 1]]);
    expect(pkg.others).to.deep.eq([{color: 'green', count: 1, amount: 1, icon: 'cards', label: undefined, production: undefined}]);
  });

  it('several of YOUR OWN settlements aggregate into one «×N» line', () => {
    const out = tradeOutcome({
      metadata: MIRANDA, rewardPosition: 1, payment: undefined, ownColonyCount: 2,
      stocks: {}, production: {},
    });
    const pkg = colonyRewardPackage({gains: out.gains, metadata: MIRANDA, colony: colony(['red', 'red']), viewer: 'red'});
    const own = pkg.sources.find((r) => r.kind === 'ownColony');
    expect(own).to.include({count: 2, amount: 2}); // 2 colonies × 1 card
    expect(pkg.totals.find((t) => t.icon === 'cards')).to.include({amount: 2});
    expect(pkg.others).to.deep.eq([]); // both settlements are the viewer's own
  });

  it('a card that pays on EVERY trade is its own named part of your total', () => {
    const out = tradeOutcome({
      metadata: IO, rewardPosition: 1, payment: undefined, ownColonyCount: 0,
      stocks: {heat: 10, megacredits: 40}, production: {},
      flatBonuses: [{card: 'Venus Trade Hub', resource: 'megacredits', amount: 3}],
    });
    const pkg = colonyRewardPackage({gains: out.gains, metadata: IO, colony: colony([]), viewer: 'red'});
    expect(pkg.totals.map((t) => [t.icon, t.amount])).to.deep.eq([['heat', 3], ['megacredits', 3]]);
    const card = pkg.sources.find((r) => r.kind === 'card');
    expect(card).to.include({card: 'Venus Trade Hub', amount: 3});
  });

  it('a colony with no settlements pays nobody else', () => {
    const out = tradeOutcome({
      metadata: IO, rewardPosition: 2, payment: undefined, ownColonyCount: 0,
      stocks: {heat: 5}, production: {},
    });
    const pkg = colonyRewardPackage({gains: out.gains, metadata: IO, colony: colony([]), viewer: 'red'});
    expect(pkg.others).to.deep.eq([]);
    expect(pkg.totals[0]).to.include({amount: 4, current: 5, resulting: 9});
  });
});
