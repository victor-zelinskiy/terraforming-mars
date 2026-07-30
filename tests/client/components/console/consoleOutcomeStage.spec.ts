import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleActionComposer from '@/client/components/console/ConsoleActionComposer.vue';
import {
  claimWorkspaceOutcome, markWorkspaceOutcomePresenting, resetWorkspaceOutcome, workspaceOutcomeState,
} from '@/client/console/consoleWorkspaceOutcome';

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

/** AI Central-shaped: one branch whose only effect is a card GAIN. */
function drawPreview(cardName: string) {
  return {
    card: cardName, isCorporation: false, kind: 'declarative',
    branches: [{
      index: -1, title: '', available: true, renderKeys: [],
      effects: [{direction: 'gain', icon: 'cards', amount: 2, note: 'draw'}],
      steps: [],
    }],
  };
}

function factory(cardName = 'AI Central') {
  return mount(ConsoleActionComposer, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
    props: {playerView: PLAYER_VIEW, entry: entryFor(cardName), preview: drawPreview(cardName), nodeIndex: 0},
  });
}

describe('ConsoleActionComposer — the EMBEDDED outcome stage', () => {
  // Module state is BUNDLE-SHARED under mochapack.
  afterEach(() => resetWorkspaceOutcome());

  it('no outcome → the configuration surface owns the column and publishes NO teleport slot', () => {
    const w = factory();
    expect(w.find('[data-embed-slot="workspace-reveal"]').exists()).to.eq(false);
    expect(w.find('.con-composer__ctadock').exists()).to.eq(true);
    expect(workspaceOutcomeState.embedSlot).to.eq('');
    w.unmount();
  });

  it('PENDING: the zone stands from submit time — it is the teleport target, and it narrates the beat', async () => {
    const w = factory();
    await w.setProps({outcome: {kind: 'pending'}});
    await w.vm.$nextTick();

    // The target exists BEFORE any artifact arrives — a teleport whose target
    // is missing drops its content on the floor.
    expect(w.find('[data-embed-slot="workspace-reveal"]').exists()).to.eq(true);
    expect(workspaceOutcomeState.embedSlot).to.eq('[data-embed-slot="workspace-reveal"]');
    // The beat NAMES the stage; it does not apologise for a wait. The loading
    // affordance appears only once the card has landed and the server is still
    // silent — the flight itself is the state until then.
    expect(w.find('.con-composer__revealstatus').text()).to.contain('Card draw');
    expect(w.find('.con-composer__revealstatus-spin').exists()).to.eq(false);
    // The landing slot the deck flight aims at is standing.
    expect(w.find('.con-composer__revealslot--beat').exists()).to.eq(true);
    // The decision column yielded.
    expect(w.find('.con-composer__ctadock').exists()).to.eq(false);
    w.unmount();
  });

  it('the beat YIELDS once something is re-homed in — never a spinner behind live content', async () => {
    const w = factory();
    await w.setProps({outcome: {kind: 'pending'}});
    claimWorkspaceOutcome('card-actions', 'AI Central', ['draw']);
    markWorkspaceOutcomePresenting();
    await w.vm.$nextTick();

    expect(w.find('[data-embed-slot="workspace-reveal"]').exists()).to.eq(true);
    // The beat's own slot + status yield to the re-homed content.
    expect(w.find('.con-composer__revealslot--beat').exists()).to.eq(false);
    w.unmount();
  });

  it('the zone is the SAME element in pending and draw — the arrival must not move the column', async () => {
    const w = factory();
    await w.setProps({outcome: {kind: 'pending'}});
    await w.vm.$nextTick();
    const pending = w.find('[data-embed-slot="workspace-reveal"]').element;

    await w.setProps({outcome: {kind: 'draw'}});
    await w.vm.$nextTick();
    const drawn = w.find('[data-embed-slot="workspace-reveal"]').element;
    expect(drawn).to.eq(pending);
    w.unmount();
  });

  it('the pad is SWALLOWED during the outcome — a press can never leak back into the configuration rows', async () => {
    const w = factory();
    await w.setProps({outcome: {kind: 'draw'}});
    await w.vm.$nextTick();

    (w.vm as any).handleIntent({kind: 'press', button: 'confirm'});
    (w.vm as any).handleIntent({kind: 'press', button: 'back'});
    // Post-commit: nothing re-fires, nothing cancels. The shell routes the pad
    // straight to the re-homed presenter instead.
    expect(w.emitted('confirm')).to.eq(undefined);
    expect(w.emitted('cancel')).to.eq(undefined);
    w.unmount();
  });

  it('unmount RETRACTS the slot — a stale selector would teleport the next batch into a detached node', async () => {
    const w = factory();
    await w.setProps({outcome: {kind: 'pending'}});
    await w.vm.$nextTick();
    expect(workspaceOutcomeState.embedSlot).to.not.eq('');

    w.unmount();
    expect(workspaceOutcomeState.embedSlot).to.eq('');
  });

  it('leaving the outcome (fold back to setup) also retracts the slot', async () => {
    const w = factory();
    await w.setProps({outcome: {kind: 'draw'}});
    await w.vm.$nextTick();
    expect(workspaceOutcomeState.embedSlot).to.not.eq('');

    await w.setProps({outcome: undefined});
    await w.vm.$nextTick();
    expect(workspaceOutcomeState.embedSlot).to.eq('');
    expect(w.find('.con-composer__ctadock').exists()).to.eq(true);
    w.unmount();
  });
});
