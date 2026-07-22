import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleActionComposer from '@/client/components/console/ConsoleActionComposer.vue';

// Stub the gamepad glyphs (footer decoration) — the test is about the premium
// RENDER of branch options + inputs, not the glyph chips.
const GlyphStub = {name: 'GamepadGlyph', props: ['control'], template: '<i class="glyph-stub" />'};

const PLAYER_VIEW: any = {
  id: 'p1',
  thisPlayer: {color: 'blue', name: 'Me', megacredits: 47, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0, tableau: []},
  players: [{color: 'blue', name: 'Me'}],
  game: {generation: 1},
  cardsInHand: [],
};

function entryFor(cardName: string) {
  return {
    group: {key: cardName, cardName, isCorporation: false, isDisabled: false, nodes: [{key: cardName + '#0', actionNode: undefined, renderRoot: undefined, text: undefined}]},
    cardName,
    isCorporation: false,
    state: {status: 'available', activatable: true, reasons: [], softReason: undefined},
  } as any;
}

function factory(preview: any, cardName = 'Robinson Industries', nodeIndex = 0) {
  return mount(ConsoleActionComposer, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
    props: {playerView: PLAYER_VIEW, entry: entryFor(cardName), preview, nodeIndex},
  });
}

function prod(icon: string) {
  return {direction: 'gain', icon, amount: 1, current: 0, resulting: 1, note: 'production'};
}
const M4 = {direction: 'cost', icon: 'megacredits', amount: 4, current: 47, resulting: 43};

describe('ConsoleActionComposer — premium render', () => {
  it('a multi-branch action (Robinson) renders branch OPTION CARDS with chips, never a bare text list', () => {
    const w = factory({
      card: 'Robinson Industries', isCorporation: true, kind: 'bespoke',
      branches: [
        {index: 0, title: 'Increase steel production 1 step', available: true, renderKeys: [], effects: [M4, prod('steel')], steps: []},
        {index: 1, title: 'Increase titanium production 1 step', available: true, renderKeys: [], effects: [M4, prod('titanium')], steps: []},
      ],
    });
    // Two premium branch option cards (the radiogroup) — not a "choose option" row.
    expect(w.findAll('.con-composer__branch')).to.have.length(2);
    // Each branch renders its cost/gain chips (2 per branch = 4 total).
    expect(w.findAll('.con-composer__branch .action-effect-chip')).to.have.length(4);
    // NONE fall back to a bare title (all have chips).
    expect(w.findAll('.con-composer__branch-title')).to.have.length(0);
    // The old "ACTION OPTION → выберите вариант" review row is gone.
    expect(w.findAll('.con-composer__row')).to.have.length(0);
    // Resource icons render on the chips (premium, not text).
    expect(w.findAll('.con-composer__branch .action-effect-chip__icon').length).to.be.greaterThan(0);
    w.unmount();
  });

  it('a disabled branch is SHOWN with its reason (never hidden)', () => {
    const w = factory({
      card: 'Electro Catapult', isCorporation: false, kind: 'declarative',
      branches: [
        {index: 0, title: 'plants', available: true, renderKeys: [], effects: [{direction: 'cost', icon: 'plants', amount: 1, current: 5, resulting: 4}, {direction: 'gain', icon: 'megacredits', amount: 7, current: 0, resulting: 7}], steps: []},
        {index: -1, title: 'steel', available: false, unavailableReason: 'Not enough steel', renderKeys: [], effects: [{direction: 'cost', icon: 'steel', amount: 1, current: 0, resulting: 0}, {direction: 'gain', icon: 'megacredits', amount: 7, current: 0, resulting: 7}], steps: []},
      ],
    }, 'Electro Catapult');
    expect(w.findAll('.con-composer__branch')).to.have.length(2);
    const disabled = w.find('.con-composer__branch--disabled');
    expect(disabled.exists()).to.eq(true);
    expect(disabled.find('.con-composer__branch-reason').text()).to.contain('steel');
    w.unmount();
  });

  it('a single-branch amount action (Hi-Tech Lab) renders the hero + an inline stepper, no branch cards', () => {
    const w = factory({
      card: 'Hi-Tech Lab', isCorporation: false, kind: 'bespoke',
      branches: [{
        index: -1, title: '', available: true, renderKeys: [],
        effects: [{direction: 'gain', icon: 'cards', amount: 1, note: 'draw'}],
        steps: [{kind: 'input', input: {type: 'amount', title: 'Select amount of energy to spend', min: 1, max: 5, maxByDefault: false, icon: 'energy', amountResult: {icon: 'cards', perUnit: 1}}}],
      }],
    }, 'Hi-Tech Lab');
    // No branch radiogroup for a single-branch card.
    expect(w.findAll('.con-composer__branch')).to.have.length(0);
    // The hero formula is shown.
    expect(w.find('.con-composer__hero').exists()).to.eq(true);
    // An inline amount stepper, seeded at min (1).
    const stepper = w.find('.con-composer__stepper');
    expect(stepper.exists()).to.eq(true);
    expect(stepper.find('.con-composer__stepper-value').text()).to.eq('1');
    w.unmount();
  });

  it('a bare confirm-only preview shows the plain confirm line (never a broken empty panel)', () => {
    const w = factory({
      card: 'X', isCorporation: false, kind: 'dynamic',
      branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []}],
    }, 'X');
    expect(w.findAll('.con-composer__branch')).to.have.length(0);
    expect(w.find('.con-composer__hero--plain').exists()).to.eq(true);
    w.unmount();
  });

  // ── The ACTION FOCUS stage (the in-frame recompose iteration) ────────────

  it('renders as the IN-FRAME stage: hero card slot (FLIP anchor + zoom slot) and NO modal header', () => {
    const w = factory({
      card: 'Regolith Eaters', isCorporation: false, kind: 'declarative',
      branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [M4], steps: []}],
    }, 'Regolith Eaters');
    expect(w.find('.con-composer--stage').exists()).to.eq(true);
    const slot = w.find('[data-action-focus-card]');
    expect(slot.exists()).to.eq(true);
    expect(slot.attributes('data-zoom-slot')).to.eq('Regolith Eaters');
    expect(slot.attributes('data-motion-anchor')).to.eq('card:Regolith Eaters');
    // The identity line lives in the frame header (ConsoleCardActions) now.
    expect(w.find('.con-composer__kicker').exists()).to.eq(false);
    expect(w.find('.con-composer__name').exists()).to.eq(false);
    w.unmount();
  });

  it('the CTA lives in the pinned DOCK outside the scroll (always on screen)', () => {
    const w = factory({
      card: 'X', isCorporation: false, kind: 'dynamic',
      branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []}],
    }, 'X');
    expect(w.find('.con-composer__ctadock .con-composer__cta').exists()).to.eq(true);
    expect(w.find('.con-composer__scroll .con-composer__cta').exists()).to.eq(false);
    w.unmount();
  });

  it('a disabled CTA names the FIRST missing decision (honest hint, never mute)', () => {
    const w = factory({
      card: 'Y', isCorporation: false, kind: 'declarative',
      branches: [{
        index: -1, title: '', available: true, renderKeys: [], effects: [],
        steps: [{kind: 'input', input: {type: 'card', title: 'Select card', buttonLabel: 'Select', cards: [{name: 'Tardigrades'}, {name: 'Regolith Eaters'}], min: 1, max: 1}}],
      }],
    }, 'Y');
    expect(w.find('.con-composer__cta--off').exists()).to.eq(true);
    expect(w.find('.con-composer__cta-hint').text()).to.contain('Choose a card');
    w.unmount();
  });

  it('X emits inspect-source (the console-wide inspect verb) — it NEVER confirms', () => {
    const w = factory({
      card: 'X', isCorporation: false, kind: 'dynamic',
      branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []}],
    }, 'X');
    (w.vm as any).handleIntent({kind: 'press', button: 'secondary'});
    expect(w.emitted('inspect-source')).to.have.length(1);
    expect(w.emitted('confirm')).to.eq(undefined);
    w.unmount();
  });

  it('A on an amount row ADVANCES toward the CTA («Далее») instead of a silent no-op', () => {
    const w = factory({
      card: 'Hi-Tech Lab', isCorporation: false, kind: 'bespoke',
      branches: [{
        index: -1, title: '', available: true, renderKeys: [],
        effects: [{direction: 'gain', icon: 'cards', amount: 1, note: 'draw'}],
        steps: [{kind: 'input', input: {type: 'amount', title: 'Select amount of energy to spend', min: 1, max: 5, maxByDefault: false, icon: 'energy', amountResult: {icon: 'cards', perUnit: 1}}}],
      }],
    }, 'Hi-Tech Lab');
    expect((w.vm as any).focusedRowKind).to.eq('amount');
    (w.vm as any).handleIntent({kind: 'press', button: 'confirm'});
    expect((w.vm as any).ctaFocused).to.eq(true);
    // ...and nothing was submitted by that press.
    expect(w.emitted('confirm')).to.eq(undefined);
    w.unmount();
  });

  it('shows the live stored resource on the source card (decision-relevant pool)', () => {
    const view = {
      ...PLAYER_VIEW,
      thisPlayer: {...PLAYER_VIEW.thisPlayer, tableau: [{name: 'Regolith Eaters', resources: 3}]},
    };
    const w = mount(ConsoleActionComposer, {
      ...globalConfig,
      global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
      props: {
        playerView: view,
        entry: entryFor('Regolith Eaters'),
        preview: {
          card: 'Regolith Eaters', isCorporation: false, kind: 'declarative',
          branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []}],
        },
        nodeIndex: 0,
      },
    });
    const meta = w.find('.con-composer__cardmeta');
    expect(meta.exists()).to.eq(true);
    expect(meta.text()).to.contain('3');
    w.unmount();
  });
});
