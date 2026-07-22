import {expect} from 'chai';
import {
  buildPlayCardBatch, playComposerFootHints, FootHint, PlayFootContext,
  computePrimaryAction, buildPaymentView, playChoiceMode, foldCopiedProductionEffects,
} from '@/client/console/consolePlayCardComposer';
import {CardName} from '@/common/cards/CardName';
import {Payment} from '@/common/inputs/Payment';
import {PaymentLane} from '@/client/console/paymentPlan';
import {ActionPreviewBranch} from '@/common/models/ActionPreviewModel';

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

  it('inline quick-adjust shows SPLIT LB/RB with per-side enabled (+ keeps LT)', () => {
    const hints = playComposerFootHints(ctx({
      configurablePayment: true,
      quickAdjust: {canDecrease: true, canIncrease: false},
    }));
    const lb = hints.find((h) => h.control === 'bumperL');
    const rb = hints.find((h) => h.control === 'bumperR');
    expect(lb).to.deep.include({label: '−1', enabled: true});
    expect(rb).to.deep.include({label: '+1', enabled: false});
    // LT (detailed editor) stays available alongside quick-adjust; A is still primary.
    expect(controls(hints)).to.include('triggerL');
    expect(hints.find((h) => h.control === 'confirm')?.label).to.equal('Play now');
  });

  it('a focused amount stepper OWNS LB/RB — quick-adjust does NOT also add them', () => {
    const hints = playComposerFootHints(ctx({focusedKind: 'amount', quickAdjust: {canDecrease: true, canIncrease: true}}));
    // The combined stepper LB/RB (control2) is present; no split −1/+1 pair from quick-adjust.
    expect(hints.filter((h) => h.control === 'bumperL')).to.have.length(1);
    expect(labels(hints)).to.include('MAX');
  });

  it('A shows the FOCUSED row verb (primaryLabel) — «Разыграть» only where passed', () => {
    // A always acts on the focused row: play on the CTA, change on a pick, next
    // on a variant — the component decides the verb, the bar renders it.
    expect(playComposerFootHints(ctx({primaryLabel: 'Play now'})).find((h) => h.control === 'confirm')?.label).to.equal('Play now');
    expect(playComposerFootHints(ctx({focusedKind: 'pick', primaryLabel: 'Change'})).find((h) => h.control === 'confirm')?.label).to.equal('Change');
    expect(playComposerFootHints(ctx({focusedKind: 'variant', primaryLabel: 'Next'})).find((h) => h.control === 'confirm')?.label).to.equal('Next');
  });

  it('NEVER emits a Y (inspect) control — Y is globally reserved for the info panel', () => {
    const scenarios = [
      ctx({}), ctx({sub: 'list', subIsCardList: true}), ctx({sub: 'payment'}),
      ctx({focusedKind: 'amount'}), ctx({focusedKind: 'pick', primaryLabel: 'Change'}),
      ctx({configurablePayment: true}), ctx({quickAdjust: {canDecrease: true, canIncrease: true}}),
    ];
    for (const s of scenarios) {
      expect(controls(playComposerFootHints(s)), 'no Y control').to.not.include('inspect');
    }
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

describe('consolePlayCardComposer.buildPaymentView', () => {
  const stock = {megacredits: 65, steel: 5, titanium: 4, plants: 0, energy: 0, heat: 0};
  const steelLane: PaymentLane = {unit: 'steel', rate: 2, available: 5, reserved: false};
  const titaniumLane: PaymentLane = {unit: 'titanium', rate: 3, available: 4, reserved: false};

  it('pure M€ → NOT quick-adjustable, NOT configurable, one auto M€ chip', () => {
    const v = buildPaymentView({cost: 11, lanes: [], counts: {}, mcAvailable: 65, stock});
    expect(v.quickAdjustEligible).to.be.false;
    expect(v.configurable).to.be.false;
    expect(v.chips).to.have.length(1);
    expect(v.chips[0]).to.deep.include({isAutoBalanced: true, isAdjustable: false});
    expect(v.chips[0].effect).to.deep.include({icon: 'megacredits', amount: 11, current: 65, resulting: 54});
  });

  it('ONE alt lane (steel) → quick-adjustable; alt chip FIRST with LB/RB metadata, then auto M€', () => {
    // cost 11, 5 steel @ rate 2 = 10, +1 M€.
    const v = buildPaymentView({cost: 11, lanes: [steelLane], counts: {steel: 5}, mcAvailable: 65, stock});
    expect(v.quickAdjustEligible).to.be.true;
    expect(v.quickAdjustUnit).to.equal('steel');
    expect(v.configurable).to.be.true;
    expect(v.chips.map((c) => c.effect.icon)).to.deep.equal(['steel', 'megacredits']);
    const steelChip = v.chips[0];
    expect(steelChip).to.deep.include({isAdjustable: true});
    expect(steelChip.effect).to.deep.include({amount: 5, current: 5, resulting: 0});
    expect(steelChip.canIncrease).to.be.false; // already at max steel (5, cap = ceil(11/2)=6 but only 5 owned)
    expect(steelChip.canDecrease).to.be.true; // M€ (65) easily covers a bigger remainder
    expect(v.chips[1]).to.deep.include({isAutoBalanced: true});
  });

  it('quick-adjust canDecrease stays TRUE even when dropping the alt underpays (parity with the LT editor)', () => {
    // cost 11, 5 steel used, only 0 M€ on hand → dropping steel underpays. LB must
    // stay LIVE (the detailed lanes editor lets the player dial into underpayment);
    // the shortfall is flagged (deficit) and blocks the confirm, never the button.
    const v = buildPaymentView({cost: 11, lanes: [steelLane], counts: {steel: 5}, mcAvailable: 0, stock: {steel: 5}});
    expect(v.chips[0].canDecrease).to.be.true;
    expect(v.paymentValid).to.be.false; // 5*2=10 < 11, no M€ to top up
    expect(v.deficit).to.equal(1);
  });

  it('TWO alt lanes → NOT quick-adjustable (complex): M€ first, then each spent lane, no adjust metadata', () => {
    const v = buildPaymentView({cost: 21, lanes: [steelLane, titaniumLane], counts: {steel: 2, titanium: 1}, mcAvailable: 30, stock: {megacredits: 30, steel: 3, titanium: 2}});
    expect(v.quickAdjustEligible).to.be.false;
    expect(v.configurable).to.be.true;
    expect(v.chips.every((c) => !c.isAdjustable)).to.be.true;
    expect(v.chips.map((c) => c.effect.icon)).to.deep.equal(['megacredits', 'steel', 'titanium']);
  });

  it('overpay: a rate-remainder mix reports the M€-value spent above the cost', () => {
    // cost 11, 6 steel @2 = 12 → overpay 1 (valid, no deficit).
    const v = buildPaymentView({cost: 11, lanes: [{unit: 'steel', rate: 2, available: 6, reserved: false}], counts: {steel: 6}, mcAvailable: 65, stock: {...stock, steel: 6}});
    expect(v.paymentValid).to.be.true;
    expect(v.overpay).to.equal(1);
    expect(v.deficit).to.equal(0);
  });

  it('overpay is 0 for an exact mix, and never coexists with a deficit', () => {
    const exact = buildPaymentView({cost: 11, lanes: [steelLane], counts: {steel: 5}, mcAvailable: 65, stock});
    expect(exact.overpay).to.equal(0); // 10 + 1 auto M€
    const short = buildPaymentView({cost: 11, lanes: [steelLane], counts: {steel: 5}, mcAvailable: 0, stock: {steel: 5}});
    expect(short.overpay).to.equal(0);
    expect(short.deficit).to.equal(1);
  });

  it('a special (non-standard) alt resource shows a signed amount, no before → after', () => {
    const microbeLane: PaymentLane = {unit: 'microbes', rate: 1, available: 3, reserved: false};
    const v = buildPaymentView({cost: 3, lanes: [microbeLane], counts: {microbes: 3}, mcAvailable: 10, stock: {megacredits: 10}});
    expect(v.chips[0].effect).to.deep.equal({direction: 'cost', icon: 'microbes', amount: 3});
    expect(v.chips[0].effect.current).to.be.undefined;
  });
});

/**
 * playChoiceMode — WHICH surface hosts a pre-select choice: the composer's own
 * inline sub-list, the HAND SECTION's pick mode (every candidate in hand —
 * single AND multi-select), the «РАЗЫГРАНО» view's TABLEAU pick (every
 * candidate a played card — single, the Astra merged multi, the Cyberia
 * deduped sequential), or an honest post-submit follow-up. The regression
 * guard for the pick routing (Public Plans / SRR / Robotic Workforce / Astra).
 */
describe('consolePlayCardComposer.playChoiceMode', () => {
  const HAND = new Set<string>([CardName.ANTS, CardName.BIRDS, CardName.DECOMPOSERS]);
  const TABLE = new Set<string>([CardName.PETS, CardName.FISH]);

  function cardChoice(names: ReadonlyArray<string>, over: Record<string, unknown> = {}, choiceOver: Record<string, unknown> = {}) {
    return {
      id: 'step#0', scope: 'step', index: 0, kind: 'card',
      input: {
        type: 'card', title: 't', buttonLabel: 'b',
        cards: names.map((name) => ({name})),
        min: 1, max: 1,
        ...over,
      },
      ...choiceOver,
    } as never;
  }

  it('a single pick whose candidates are all in hand → handPick', () => {
    expect(playChoiceMode(cardChoice([CardName.ANTS, CardName.BIRDS]), HAND, TABLE)).to.equal('handPick');
  });

  it('a MULTI-select over the hand (Public Plans) → handPick, no longer a follow-up', () => {
    const c = cardChoice([CardName.ANTS, CardName.BIRDS], {min: 0, max: 2});
    expect(playChoiceMode(c, HAND, TABLE)).to.equal('handPick');
  });

  it('disabled candidates count toward the ownership check (SRR link ineligibles)', () => {
    const c = cardChoice([CardName.ANTS], {disabledCards: [{name: CardName.BIRDS}]});
    expect(playChoiceMode(c, HAND, TABLE)).to.equal('handPick');
    const off = cardChoice([CardName.ANTS], {disabledCards: [{name: CardName.LICHEN}]});
    expect(playChoiceMode(off, HAND, TABLE)).to.equal('inline');
  });

  it('a pick whose candidates are all PLAYED cards → tableauPick (single AND multi)', () => {
    expect(playChoiceMode(cardChoice([CardName.PETS]), HAND, TABLE)).to.equal('tableauPick');
    expect(playChoiceMode(cardChoice([CardName.PETS, CardName.FISH], {max: 2}), HAND, TABLE)).to.equal('tableauPick');
    const withDisabled = cardChoice([CardName.PETS], {disabledCards: [{name: CardName.FISH}]});
    expect(playChoiceMode(withDisabled, HAND, TABLE)).to.equal('tableauPick');
  });

  it('unowned candidates: a single pick stays inline, a multi stays a follow-up', () => {
    expect(playChoiceMode(cardChoice([CardName.LICHEN]), HAND, TABLE)).to.equal('inline');
    expect(playChoiceMode(cardChoice([CardName.LICHEN], {max: 2}), HAND, TABLE)).to.equal('followup');
  });

  it('a candidate-less pick / a repeat-action → followup', () => {
    expect(playChoiceMode(cardChoice([]), HAND, TABLE)).to.equal('followup');
    expect(playChoiceMode(cardChoice([CardName.PETS], {}, {repeatAction: true}), HAND, TABLE)).to.equal('followup');
  });

  it('player / amount / or / spendHeat stay inline; an unknown shape is a follow-up', () => {
    const mk = (kind: string, type: string) => ({id: 'step#0', scope: 'step', index: 0, kind, input: {type, title: ''}} as never);
    expect(playChoiceMode(mk('player', 'player'), HAND, TABLE)).to.equal('inline');
    expect(playChoiceMode(mk('or', 'or'), HAND, TABLE)).to.equal('inline');
    expect(playChoiceMode(mk('other', 'and'), HAND, TABLE)).to.equal('followup');
  });
});

/**
 * foldCopiedProductionEffects — the Cyberia / Robotic Workforce RESULT fold:
 * once a copy-target is picked, its server-computed production box folds into
 * the branch's chips (one chip per resource, current → resulting), base
 * production chips summing with the copied deltas and non-production chips
 * passing through. Desktop `resultEffects` parity.
 */
describe('consolePlayCardComposer.foldCopiedProductionEffects', () => {
  const prod = (res: string): number => ({megacredits: 3, steel: 1, titanium: 0, plants: 2, energy: 0, heat: 0} as Record<string, number>)[res] ?? 0;

  function copyBranch(over: Partial<ActionPreviewBranch> = {}): ActionPreviewBranch {
    return {
      index: -1, title: '', available: true, renderKeys: [], effects: [],
      steps: [
        {kind: 'input', input: {type: 'card', title: 't', buttonLabel: 'Copy', cards: [{name: CardName.MINE}]} as never,
          copyProductionBox: {[CardName.MINE]: {megacredits: 0, steel: 1, titanium: 0, plants: 0, energy: 0, heat: 0}}},
      ],
      ...over,
    } as ActionPreviewBranch;
  }

  it('no copy step answered → undefined (base effects untouched)', () => {
    expect(foldCopiedProductionEffects(copyBranch(), () => undefined, prod)).to.be.undefined;
  });

  it('an answered copy step folds its box into current → resulting chips', () => {
    const out = foldCopiedProductionEffects(copyBranch(), (i) => (i === 0 ? CardName.MINE : undefined), prod);
    expect(out).to.deep.equal([
      {direction: 'gain', icon: 'steel', amount: 1, current: 1, resulting: 2, note: 'production'},
    ]);
  });

  it('base production chips SUM with the copied deltas; non-production chips pass through', () => {
    const branch = copyBranch({
      effects: [
        {direction: 'gain', icon: 'steel', amount: 1, current: 1, resulting: 2, note: 'production'},
        {direction: 'gain', icon: 'megacredits', amount: 2, current: 20, resulting: 22},
      ],
    });
    const out = foldCopiedProductionEffects(branch, () => CardName.MINE, prod);
    expect(out).to.deep.equal([
      {direction: 'gain', icon: 'steel', amount: 2, current: 1, resulting: 3, note: 'production'},
      {direction: 'gain', icon: 'megacredits', amount: 2, current: 20, resulting: 22},
    ]);
  });

  it('two answered copy steps (Cyberia) aggregate per resource, negatives read as cost', () => {
    const branch = copyBranch({
      steps: [
        {kind: 'input', input: {type: 'card', title: '1', buttonLabel: 'Copy', cards: []} as never,
          copyProductionBox: {[CardName.MINE]: {megacredits: 0, steel: 1, titanium: 0, plants: 0, energy: 0, heat: 0}}},
        {kind: 'input', input: {type: 'card', title: '2', buttonLabel: 'Copy', cards: []} as never,
          copyProductionBox: {[CardName.NUCLEAR_POWER]: {megacredits: 2, steel: 0, titanium: 0, plants: 0, energy: -1, heat: 0}}},
      ],
    });
    const out = foldCopiedProductionEffects(branch, (i) => (i === 0 ? CardName.MINE : CardName.NUCLEAR_POWER), prod);
    expect(out).to.deep.equal([
      {direction: 'gain', icon: 'megacredits', amount: 2, current: 3, resulting: 5, note: 'production'},
      {direction: 'gain', icon: 'steel', amount: 1, current: 1, resulting: 2, note: 'production'},
      {direction: 'cost', icon: 'energy', amount: 1, current: 0, resulting: -1, note: 'production'},
    ]);
  });

  it('a picked candidate ABSENT from the box map (bespoke produce) contributes nothing', () => {
    const out = foldCopiedProductionEffects(copyBranch(), () => CardName.PETS, prod);
    expect(out).to.be.undefined;
  });
});
