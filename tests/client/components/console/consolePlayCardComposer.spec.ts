import {expect} from 'chai';
import {
  buildPlayCardBatch, playComposerFootHints, FootHint, PlayFootContext,
  computePrimaryAction, paymentChips,
} from '@/client/console/consolePlayCardComposer';
import {CardName} from '@/common/cards/CardName';
import {Payment} from '@/common/inputs/Payment';
import {PaymentLane} from '@/client/console/paymentPlan';

const DIAL_CONTROLS = ['bumperL', 'bumperR', 'triggerR'];
function hasDialControl(hints: ReadonlyArray<FootHint>): boolean {
  return hints.some((h) => DIAL_CONTROLS.includes(h.control) || (h.control2 !== undefined && DIAL_CONTROLS.includes(h.control2)));
}
function labels(hints: ReadonlyArray<FootHint>): Array<string> {
  return hints.map((h) => h.label);
}
function controls(hints: ReadonlyArray<FootHint>): Array<string> {
  return hints.map((h) => h.control);
}

/**
 * The console play-card batch must be BYTE-IDENTICAL to
 * PlayerHome.submitPlayCardBatch — i.e. the on-play variant/target choices are
 * ENCODED in the batch (pre-selected), not deferred to a follow-up. This is the
 * regression guard for the console↔desktop pre-select parity.
 */
describe('consolePlayCardComposer.buildPlayCardBatch', () => {
  const payment = {...Payment.EMPTY, megacredits: 12};

  it('no-branch card → just the wrapped play response', () => {
    const batch = buildPlayCardBatch({
      playPath: [1, 0],
      cardName: CardName.ACQUIRED_COMPANY,
      payment,
      branchIndex: -1,
      preResponses: [],
      optionResponse: undefined,
      stepResponses: [],
    });
    expect(batch).to.deep.equal([
      {type: 'or', index: 1, response: {type: 'or', index: 0, response: {type: 'projectCard', card: CardName.ACQUIRED_COMPANY, payment}}},
    ]);
  });

  it('on-play OR variant (Artificial Photosynthesis) → play + branch pick, NOT deferred', () => {
    const batch = buildPlayCardBatch({
      playPath: [2],
      cardName: CardName.ARTIFICIAL_PHOTOSYNTHESIS,
      payment,
      branchIndex: 1, // "increase plant production 1"
      preResponses: [],
      optionResponse: undefined,
      stepResponses: [],
    });
    expect(batch).to.deep.equal([
      {type: 'or', index: 2, response: {type: 'projectCard', card: CardName.ARTIFICIAL_PHOTOSYNTHESIS, payment}},
      {type: 'or', index: 1, response: {type: 'option'}},
    ]);
  });

  it('empty playPath (mandatory play-from-hand) → the bare projectCard response first', () => {
    const batch = buildPlayCardBatch({
      playPath: [],
      cardName: CardName.ACQUIRED_COMPANY,
      payment,
      branchIndex: -1,
      preResponses: [],
      optionResponse: undefined,
      stepResponses: [],
    });
    expect(batch).to.deep.equal([{type: 'projectCard', card: CardName.ACQUIRED_COMPANY, payment}]);
  });

  it('pre-branch + step responses replay in order', () => {
    const pre = {type: 'and', responses: [{type: 'amount', amount: 3}, {type: 'amount', amount: 0}]};
    const step = {type: 'card', cards: [CardName.ANTS]};
    const batch = buildPlayCardBatch({
      playPath: [0],
      cardName: CardName.ANTS,
      payment,
      branchIndex: 0,
      preResponses: [pre],
      optionResponse: undefined,
      stepResponses: [step],
    });
    expect(batch).to.deep.equal([
      {type: 'or', index: 0, response: {type: 'projectCard', card: CardName.ANTS, payment}},
      pre,
      {type: 'or', index: 0, response: {type: 'option'}},
      step,
    ]);
  });

  it('lone auto-resolved branch (branchIndex < 0) with a direct optionResponse → bare, no OR wrap', () => {
    const optionResponse = {type: 'amount', amount: 4};
    const batch = buildPlayCardBatch({
      playPath: [0],
      cardName: CardName.INSULATION,
      payment,
      branchIndex: -1,
      preResponses: [],
      optionResponse,
      stepResponses: [],
    });
    expect(batch).to.deep.equal([
      {type: 'or', index: 0, response: {type: 'projectCard', card: CardName.INSULATION, payment}},
      optionResponse,
    ]);
  });

  it('branch pick nests a direct optionResponse into the OR wrapper', () => {
    const optionResponse = {type: 'card', cards: [CardName.ANTS]};
    const batch = buildPlayCardBatch({
      playPath: [],
      cardName: CardName.ANTS,
      payment,
      branchIndex: 2,
      preResponses: [],
      optionResponse,
      stepResponses: [],
    });
    expect(batch).to.deep.equal([
      {type: 'projectCard', card: CardName.ANTS, payment},
      {type: 'or', index: 2, response: optionResponse},
    ]);
  });
});

describe('consolePlayCardComposer.playComposerFootHints', () => {
  function ctx(over: Partial<PlayFootContext> = {}): PlayFootContext {
    return {
      sub: 'none', subIsCardList: false, hasRows: true, focusedKind: 'variant',
      configurablePayment: false, paymentReady: true, primaryLabel: 'Play now', primaryEnabled: true, ...over,
    };
  }

  it('AUTO payment (not configurable) shows NO dial controls and NO LT verb', () => {
    const hints = playComposerFootHints(ctx({configurablePayment: false}));
    expect(hasDialControl(hints)).to.be.false;
    expect(controls(hints)).to.not.include('triggerL');
    expect(labels(hints)).to.not.include('Configure payment');
  });

  it('configurable payment shows LT «Configure payment» (secondary, never A)', () => {
    const hints = playComposerFootHints(ctx({configurablePayment: true}));
    const lt = hints.find((h) => h.control === 'triggerL');
    expect(lt?.label).to.equal('Configure payment');
    // A stays the primary action, not the payment entry.
    expect(hints.find((h) => h.control === 'confirm')?.label).to.equal('Play now');
    expect(hasDialControl(hints)).to.be.false;
  });

  it('the payment SUB is the only review→sub place LB/RB/RT appear', () => {
    const hints = playComposerFootHints(ctx({sub: 'payment'}));
    expect(hasDialControl(hints)).to.be.true;
    expect(labels(hints)).to.include('MAX');
    // LT is not offered inside the sub (already in it).
    expect(controls(hints)).to.not.include('triggerL');
  });

  it('a focused amount stepper gets LB/RB and MAX', () => {
    const hints = playComposerFootHints(ctx({focusedKind: 'amount'}));
    expect(hasDialControl(hints)).to.be.true;
    expect(labels(hints)).to.include('MAX');
  });

  it('a focused spend-heat stepper gets LB/RB but NOT MAX', () => {
    const hints = playComposerFootHints(ctx({focusedKind: 'spendHeat'}));
    expect(hints.some((h) => h.control === 'bumperL')).to.be.true;
    expect(labels(hints)).to.not.include('MAX');
  });

  it('the A verb + enabled come from the primary state (no dial on a variant)', () => {
    const ready = playComposerFootHints(ctx({focusedKind: 'variant', primaryLabel: 'Play now', primaryEnabled: true}));
    expect(ready.find((h) => h.control === 'confirm')).to.deep.include({label: 'Play now', enabled: true});
    expect(hasDialControl(ready)).to.be.false;
    const blocked = playComposerFootHints(ctx({primaryLabel: 'Play now', primaryEnabled: false}));
    expect(blocked.find((h) => h.control === 'confirm')?.enabled).to.equal(false);
  });

  it('a card list sub offers Inspect; a non-card list does not', () => {
    expect(labels(playComposerFootHints(ctx({sub: 'list', subIsCardList: true})))).to.include('Inspect');
    expect(labels(playComposerFootHints(ctx({sub: 'list', subIsCardList: false})))).to.not.include('Inspect');
  });

  it('no navigable rows → no Navigate hint', () => {
    expect(labels(playComposerFootHints(ctx({hasRows: false})))).to.not.include('Navigate');
  });
});

describe('consolePlayCardComposer.computePrimaryAction', () => {
  const base = {branchSelectable: true, paymentReady: true, firstUnresolvedStepRowIndex: undefined};

  it('all resolved + payment valid → ready (A plays)', () => {
    expect(computePrimaryAction(base).kind).to.equal('ready');
  });

  it('an unresolved step → need-preselect at that row (A leads there)', () => {
    expect(computePrimaryAction({...base, firstUnresolvedStepRowIndex: 2})).to.deep.equal({kind: 'need-preselect', rowIndex: 2});
  });

  it('an unresolved step is only reported once payment/branch are OK', () => {
    // payment blocks first (a step still pending is masked until payment is fixed).
    expect(computePrimaryAction({...base, paymentReady: false, firstUnresolvedStepRowIndex: 1}).kind).to.equal('blocked-payment');
  });

  it('no selectable branch → blocked-requirement with a reason', () => {
    const st = computePrimaryAction({...base, branchSelectable: false});
    expect(st.kind).to.equal('blocked-requirement');
    expect((st as {reason: string}).reason).to.be.a('string').and.not.equal('');
  });
});

describe('consolePlayCardComposer.paymentChips', () => {
  const stock = {megacredits: 19, steel: 2, titanium: 4, plants: 0, energy: 0, heat: 0};
  const steelLane: PaymentLane = {unit: 'steel', rate: 2, available: 2, reserved: false};
  const titaniumLane: PaymentLane = {unit: 'titanium', rate: 3, available: 4, reserved: false};

  it('M€ + steel → two cost chips with было → стало', () => {
    const chips = paymentChips({lanes: [steelLane], counts: {steel: 2}, mcSpent: 8, stock});
    expect(chips).to.deep.equal([
      {direction: 'cost', icon: 'megacredits', amount: 8, current: 19, resulting: 11},
      {direction: 'cost', icon: 'steel', amount: 2, current: 2, resulting: 0},
    ]);
  });

  it('pure M€ → a single M€ chip', () => {
    const chips = paymentChips({lanes: [], counts: {}, mcSpent: 12, stock: {megacredits: 29}});
    expect(chips).to.deep.equal([{direction: 'cost', icon: 'megacredits', amount: 12, current: 29, resulting: 17}]);
  });

  it('titanium spend shows its own delta; a 0-spend lane is omitted', () => {
    const chips = paymentChips({lanes: [steelLane, titaniumLane], counts: {steel: 0, titanium: 1}, mcSpent: 5, stock});
    expect(chips.map((c) => c.icon)).to.deep.equal(['megacredits', 'titanium']);
    expect(chips[1]).to.deep.include({amount: 1, current: 4, resulting: 3});
  });

  it('a special (non-standard) payment resource shows a signed amount, no delta', () => {
    const microbeLane: PaymentLane = {unit: 'microbes', rate: 1, available: 3, reserved: false};
    const chips = paymentChips({lanes: [microbeLane], counts: {microbes: 3}, mcSpent: 0, stock: {}});
    expect(chips).to.deep.equal([{direction: 'cost', icon: 'microbes', amount: 3}]);
  });
});
