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
});
