import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleActionComposer from '@/client/components/console/ConsoleActionComposer.vue';
import {
  RUNTIME_NAVIGATION_STEP_KINDS, isRuntimeNavigationStep, runtimeNavigationSteps,
} from '@/client/console/consoleActionComposer';

/**
 * A PLAN DOES NOT WALK THROUGH DOORS.
 *
 * «Летающая платформа» has two branches: add a floater, or SPEND one to trade
 * for free. Activated normally the trade branch is a DOOR — its confirm hands
 * the player to a colony and the real commit is there. Chosen as a Hydronetwork
 * stage-7 REPEAT it is a PLAN, and the door leads nowhere: no action is being
 * taken, so the server is offering no trade to walk into. The composer asked
 * `waitingFor` for that trade anyway, got an honest «нет», and refused its own
 * confirm — a screen whose whole command bar read «X ОСМОТРЕТЬ · B ОТМЕНА»
 * with no way forward.
 *
 * The plan captures the CARD and the BRANCH and stops; the server parks those
 * responses and raises the colony pick as the copy's own follow-up.
 */

const GlyphStub = {name: 'GamepadGlyph', props: ['control'], template: '<i class="glyph-stub" />'};

const PLAYER_VIEW: any = {
  id: 'p1',
  thisPlayer: {color: 'blue', name: 'Me', megacredits: 47, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0, tableau: []},
  players: [{color: 'blue', name: 'Me', tableau: []}],
  game: {generation: 1},
  cardsInHand: [],
  // ⚠️ NO `waitingFor`: that is precisely the state a repeat plan is composed
  // in — the Hydronetwork summary is not a live trade prompt.
};

function entryFor(cardName: string) {
  return {
    group: {key: cardName, cardName, isCorporation: false, isDisabled: false, nodes: [{key: cardName + '#0', actionNode: undefined, renderRoot: undefined, text: undefined}]},
    cardName,
    isCorporation: false,
    state: {status: 'available', activatable: true, reasons: [], softReason: undefined},
  } as any;
}

/** The server's own preview for «Летающая платформа»: floater, or trade. */
const PAD_PREVIEW: any = {
  cardName: 'Titan Floating Launch-Pad',
  branches: [
    {index: 0, title: 'Add 1 floater to this card', available: true, renderKeys: [],
      effects: [{direction: 'gain', icon: 'floaters', amount: 1, current: 1, resulting: 2}], steps: []},
    {index: 1, title: 'Spend 1 floater to trade for free', available: true, renderKeys: [],
      effects: [{direction: 'cost', icon: 'floaters', amount: 1, current: 1, resulting: 0}],
      steps: [{kind: 'colonyTrade', card: 'Titan Floating Launch-Pad'}]},
  ],
  preSteps: [],
};

function factory(repeatPickDisabled: boolean) {
  return mount(ConsoleActionComposer, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
    props: {
      playerView: PLAYER_VIEW,
      entry: entryFor('Titan Floating Launch-Pad'),
      preview: PAD_PREVIEW,
      nodeIndex: 0,
      repeatPickDisabled,
      publishCommands: !repeatPickDisabled,
      commitLabel: repeatPickDisabled ? 'Select this action' : 'Confirm action',
    },
  });
}

describe('runtime-navigation steps — a plan defers the door', () => {
  it('the kind set is declared once and read structurally', () => {
    expect([...RUNTIME_NAVIGATION_STEP_KINDS].sort())
      .to.deep.equal(['boardPlacement', 'colonyTrade', 'deltaAdvance']);
    expect(isRuntimeNavigationStep({kind: 'colonyTrade', card: 'X'} as any)).to.equal(true);
    expect(isRuntimeNavigationStep({kind: 'input', input: {type: 'amount'}} as any)).to.equal(false);
    expect(runtimeNavigationSteps(PAD_PREVIEW.branches[1]).length).to.equal(1);
    expect(runtimeNavigationSteps(PAD_PREVIEW.branches[0]).length).to.equal(0);
    expect(runtimeNavigationSteps(undefined).length).to.equal(0);
  });

  it('ACTIVATING: the trade branch is a door — blocked without a live trade prompt', async () => {
    const w = factory(false);
    const vm = w.vm as any;
    vm.selectedPos = 1;
    await w.vm.$nextTick();
    expect(vm.tradeEntryCard, 'the branch declares its trade').to.equal('Titan Floating Launch-Pad');
    expect(vm.tradeEntryDoor, 'and it IS the door while activating').to.equal('Titan Floating Launch-Pad');
    // No `waitingFor` → the server is offering no trade → the door is refused,
    // honestly and with the server's own words. This is the CORRECT behaviour
    // for an activation; it was the bug for a plan.
    expect(vm.tradeEntryBlockedReason, 'refused').to.not.equal(undefined);
    expect(vm.commitGate.kind, 'so the commit is withheld').to.equal('blocked');
    w.unmount();
  });

  it('PLANNING a repeat: the door is deferred, and the confirm is live', async () => {
    const w = factory(true);
    const vm = w.vm as any;
    vm.selectedPos = 1;
    await w.vm.$nextTick();
    expect(vm.navigationDeferred, 'this composer is planning').to.equal(true);
    // The STRUCTURAL fact is unchanged — the branch still declares its trade,
    // and the «оплата на выбранной колонии» note still reads. Only the DOOR
    // is deferred.
    expect(vm.tradeEntryCard).to.equal('Titan Floating Launch-Pad');
    expect(vm.tradeEntryDoor, 'nothing to walk into yet').to.equal(undefined);
    expect(vm.tradeEntryBlockedReason, 'so nothing is blocked on it').to.equal(undefined);
    expect(vm.commitGate.kind, 'the plan can be confirmed').to.equal('ready');
    // …and the verb is the PLAN's verb, not «Выбрать колонию».
    expect(vm.commitVerbKey).to.equal('Select this action');
    w.unmount();
  });

  it('…and confirming the plan emits the BRANCH, never the colony door', async () => {
    const w = factory(true);
    const vm = w.vm as any;
    vm.selectedPos = 1;
    await w.vm.$nextTick();
    vm.submit();
    await w.vm.$nextTick();
    expect(w.emitted('colony-trade'), 'the door never opens from a plan').to.equal(undefined);
    const confirms = w.emitted('confirm');
    expect(confirms, 'the plan is confirmed').to.not.equal(undefined);
    const payload = (confirms as Array<Array<any>>)[0][0];
    expect(payload.branchIndex, 'the trade branch').to.equal(1);
    expect(payload.stepResponses, 'and no composed target — the colony is asked for at the repeat')
      .to.deep.equal([]);
    w.unmount();
  });
});
