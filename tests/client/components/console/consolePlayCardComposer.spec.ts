import {expect} from 'chai';
import {buildPlayCardBatch, playComposerFootHints, FootHint, PlayFootContext} from '@/client/console/consolePlayCardComposer';
import {CardName} from '@/common/cards/CardName';
import {Payment} from '@/common/inputs/Payment';

const DIAL_CONTROLS = ['bumperL', 'bumperR', 'triggerR'];
function hasDialControl(hints: ReadonlyArray<FootHint>): boolean {
  return hints.some((h) => DIAL_CONTROLS.includes(h.control) || (h.control2 !== undefined && DIAL_CONTROLS.includes(h.control2)));
}
function labels(hints: ReadonlyArray<FootHint>): Array<string> {
  return hints.map((h) => h.label);
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
    return {sub: 'none', subIsCardList: false, focusedKind: 'none', hasPaymentLanes: false, canConfirm: true, paymentReady: true, ...over};
  }

  it('AUTO payment (no non-M€ lanes) shows NO dial controls and no payment verb', () => {
    const hints = playComposerFootHints(ctx({focusedKind: 'payment', hasPaymentLanes: false}));
    expect(hasDialControl(hints)).to.be.false;
    expect(labels(hints)).to.not.include('Payment');
    expect(labels(hints)).to.deep.equal(['Navigate', 'Inspect', 'Cancel']);
  });

  it('manual payment (non-M€ lanes) offers "Payment" to open the lanes — still no dial in review', () => {
    const hints = playComposerFootHints(ctx({focusedKind: 'payment', hasPaymentLanes: true}));
    expect(labels(hints)).to.include('Payment');
    expect(hasDialControl(hints)).to.be.false;
  });

  it('the payment SUB is the only review→sub place LB/RB/RT appear', () => {
    const hints = playComposerFootHints(ctx({sub: 'payment'}));
    expect(hasDialControl(hints)).to.be.true;
    expect(labels(hints)).to.include('MAX');
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

  it('a variant/pick row offers Select, no dial controls', () => {
    for (const focusedKind of ['variant', 'pick'] as const) {
      const hints = playComposerFootHints(ctx({focusedKind}));
      expect(labels(hints)).to.include('Select');
      expect(hasDialControl(hints)).to.be.false;
    }
  });

  it('the Play CTA row carries the gated confirm', () => {
    const enabled = playComposerFootHints(ctx({focusedKind: 'play', canConfirm: true}));
    expect(enabled.find((h) => h.label === 'Play now')?.enabled).to.equal(true);
    const disabled = playComposerFootHints(ctx({focusedKind: 'play', canConfirm: false}));
    expect(disabled.find((h) => h.label === 'Play now')?.enabled).to.equal(false);
    expect(hasDialControl(enabled)).to.be.false;
  });

  it('a card list sub offers Inspect; a non-card list does not', () => {
    expect(labels(playComposerFootHints(ctx({sub: 'list', subIsCardList: true})))).to.include('Inspect');
    expect(labels(playComposerFootHints(ctx({sub: 'list', subIsCardList: false})))).to.not.include('Inspect');
  });
});
