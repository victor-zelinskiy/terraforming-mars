import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleProductionLoss from '@/client/components/console/ConsoleProductionLoss.vue';
import {SelectProductionToLoseModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Units} from '@/common/Units';
import {ProductionLossSource} from '@/common/models/ProductionLossSource';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';

const A: GamepadIntent = {kind: 'press', button: 'confirm'}; // → assign −1
const X: GamepadIntent = {kind: 'press', button: 'secondary'}; // → confirm
const B: GamepadIntent = {kind: 'press', button: 'back'}; // → defer
const DOWN: GamepadIntent = {kind: 'nav', dir: 'down', repeat: false};

function view(cost: number, prod: Partial<Units>, source?: ProductionLossSource): PlayerViewModel {
  const model: SelectProductionToLoseModel = {
    title: `Choose ${cost} unit(s) of production to lose`,
    buttonLabel: 'Save',
    type: 'productionToLose',
    payProduction: {cost, units: {...Units.EMPTY, ...prod}},
    source,
  };
  return {waitingFor: model, players: []} as unknown as PlayerViewModel;
}

function mountWith(v: PlayerViewModel) {
  return mount(ConsoleProductionLoss, {
    global: {
      ...globalConfig.global,
      // `console-source-dock` is GLOBAL in the real app (it renders the card
      // face, whose import chain zeroes a mochapack spec) — so it is stubbed
      // here rather than resolved. Its own contract is guarded by
      // `promptSource.spec.ts` + the e2e probe; what this file owns is WHICH
      // view the surface hands it and WHICH verbs it publishes.
      stubs: {'GamepadGlyph': true, 'console-source-dock': ConsoleSourceDockStub},
    },
    props: {playerView: v},
  });
}

/** Mirrors the real dock's root classes so the layout assertions still mean
 *  something without dragging the card renderer into this bundle. */
const ConsoleSourceDockStub = {
  props: {view: {type: Object, required: true}, compact: Boolean},
  template: `<div class="con-src" :class="{
      'con-src--compact': compact,
      'con-src--plate': view.card === undefined,
      'con-src--hazard': view.tone === 'hazard',
    }">
      <div v-if="view.card !== undefined" class="con-src__card"/>
      <div v-else class="con-src__plate"/>
      <div v-if="view.ruleKey !== undefined" class="con-src__rule"/>
    </div>`,
};

// The test i18n plugin returns the English key (with ${0} substituted) — mirrors
// the desktop ModernProductionToLose spec, so we can assert on the key text.
describe('ConsoleProductionLoss (view)', () => {
  it('always renders all six production rows', () => {
    expect(mountWith(view(1, {steel: 1})).findAll('.con-prodloss__row')).to.have.length(6);
  });

  it('builds a diegetic title from cost (bypasses the baked server string)', () => {
    expect((mountWith(view(1, {steel: 1})).vm as any).titleText).to.eq('Reduce a production');
    expect((mountWith(view(2, {steel: 3})).vm as any).titleText).to.eq('Reduce production by 2');
  });

  // The cause now renders through the SHARED source dock — same component,
  // same grammar and same slot as every other decision surface. A hazard has
  // no card to show, so it keeps the plate + the rule that explains it.
  it('shows the hazard cause plate when forced by an adjacent hazard', () => {
    const w = mountWith(view(1, {steel: 1}, {type: 'hazard'}));
    expect(w.find('.con-src--hazard').exists()).to.be.true;
    expect(w.find('.con-src__plate').exists()).to.be.true;
    expect(w.find('.con-src__rule').exists()).to.be.true;
    // Nothing to inspect → the bar must not advertise a source verb.
    expect((w.vm as any).footCommands.some((c: any) => c.label === 'Source')).to.be.false;
  });

  it('a CARD cause renders the real premium card face + the L3 verb', () => {
    const w = mountWith(view(1, {steel: 1}, {type: 'card', card: 'Caesar' as any}));
    expect(w.find('.con-src__card').exists()).to.be.true;
    expect(w.find('.con-src--hazard').exists()).to.be.false;
    expect((w.vm as any).sourceCard).to.eq('Caesar');
    expect((w.vm as any).footCommands.some((c: any) => c.control === 'stickL' && c.label === 'Source')).to.be.true;
  });

  it('no source at all → no dock, no verb (never an empty column)', () => {
    const w = mountWith(view(1, {steel: 1}));
    expect(w.find('.con-src').exists()).to.be.false;
    expect((w.vm as any).footCommands.some((c: any) => c.label === 'Source')).to.be.false;
  });

  it('cost 1: a lone reducible production is pre-selected and confirms in one press', async () => {
    // megacredits at the −5 floor (disabled) → only steel is reducible.
    const w = mountWith(view(1, {megacredits: -5, steel: 1}));
    await w.vm.$nextTick();
    expect((w.vm as any).ready).to.be.true;
    (w.vm as any).handleIntent(X);
    expect(w.emitted('submit')?.[0][0]).to.deep.eq({type: 'productionToLose', units: {...Units.EMPTY, steel: 1}});
  });

  it('cost 1: selecting another production MOVES the single loss (single-pick)', async () => {
    // megacredits reducible (prod 5 → focus starts there), steel reducible.
    const w = mountWith(view(1, {megacredits: 5, steel: 2}));
    (w.vm as any).handleIntent(A); // pick megacredits
    await w.vm.$nextTick();
    (w.vm as any).handleIntent(DOWN); // focus steel
    (w.vm as any).handleIntent(A); // MOVES the −1 onto steel
    await w.vm.$nextTick();
    (w.vm as any).handleIntent(X);
    expect(w.emitted('submit')?.[0][0]).to.deep.eq({type: 'productionToLose', units: {...Units.EMPTY, steel: 1}});
  });

  it('cost 2: splits one loss across two productions', async () => {
    // Only plants (max 2) and energy (max 1) are reducible; mc at floor, rest 0.
    const w = mountWith(view(2, {megacredits: -5, plants: 2, energy: 1}));
    (w.vm as any).handleIntent(A); // plants −1 (focus starts on plants)
    (w.vm as any).handleIntent(DOWN); // focus energy
    (w.vm as any).handleIntent(A); // energy −1
    await w.vm.$nextTick();
    expect((w.vm as any).ready).to.be.true;
    (w.vm as any).handleIntent(X);
    expect(w.emitted('submit')?.[0][0]).to.deep.eq({type: 'productionToLose', units: {...Units.EMPTY, plants: 1, energy: 1}});
  });

  it('cost 2: takes both steps off one production', async () => {
    const w = mountWith(view(2, {megacredits: -5, plants: 3}));
    (w.vm as any).handleIntent(A); // plants −1
    (w.vm as any).handleIntent(A); // plants −2
    await w.vm.$nextTick();
    (w.vm as any).handleIntent(X);
    expect(w.emitted('submit')?.[0][0]).to.deep.eq({type: 'productionToLose', units: {...Units.EMPTY, plants: 2}});
  });

  it('LB (bumperL) takes a step back off the focused production', async () => {
    const w = mountWith(view(2, {megacredits: -5, plants: 3}));
    (w.vm as any).handleIntent(A); // plants −1
    (w.vm as any).handleIntent(A); // plants −2
    (w.vm as any).handleIntent({kind: 'press', button: 'bumperL'} as GamepadIntent); // undo one
    await w.vm.$nextTick();
    expect((w.vm as any).lossFor('plants')).to.eq(1);
    expect((w.vm as any).ready).to.be.false;
  });

  it('a production at the floor is shown DISABLED with the "already at minimum" note', () => {
    const w = mountWith(view(1, {megacredits: -5, steel: 1}));
    const mcRow = w.findAll('.con-prodloss__row')[0]; // megacredits is first
    expect(mcRow.classes()).to.include('con-prodloss__row--disabled');
    expect(mcRow.find('.con-prodloss__note').text()).to.contain('Production already at minimum');
  });

  it('a cost-2 loss shows a "can only reduce by N" note on a single-step production', () => {
    const w = mountWith(view(2, {megacredits: -5, plants: 3, energy: 1}));
    const energyRow = w.findAll('.con-prodloss__row')[4]; // energy index
    expect(energyRow.classes()).to.not.include('con-prodloss__row--disabled'); // still selectable
    expect(energyRow.find('.con-prodloss__note').text()).to.contain('Can only reduce by 1');
  });

  it('does not submit before the full loss is distributed', () => {
    const w = mountWith(view(2, {megacredits: -5, plants: 3}));
    (w.vm as any).handleIntent(A); // only 1 of 2
    (w.vm as any).handleIntent(X); // X while not ready → no-op
    expect(w.emitted('submit')).to.be.undefined;
  });

  it('B minimizes (defers) without submitting', () => {
    const w = mountWith(view(1, {steel: 1}));
    (w.vm as any).handleIntent(B);
    expect(w.emitted('defer')).to.have.length(1);
    expect(w.emitted('submit')).to.be.undefined;
  });
});
