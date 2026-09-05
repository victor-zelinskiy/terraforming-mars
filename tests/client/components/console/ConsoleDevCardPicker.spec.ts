import {defineComponent, nextTick} from 'vue';
import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import ConsoleDevCardPicker from '@/client/components/console/menu/ConsoleDevCardPicker.vue';
import ConsoleMenuZoomHost from '@/client/components/console/menu/ConsoleMenuZoomHost.vue';
import {createGameState, resetCreateGameState} from '@/client/components/create/premium/createGameState';
import {closeConsoleCardZoom, consoleCardZoom, navigateConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {consoleState} from '@/client/console/consoleRouter';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';

const A: GamepadIntent = {kind: 'press', button: 'confirm'};
const B: GamepadIntent = {kind: 'press', button: 'back'};

/*
 * The dev picker no longer mounts a viewer of its own: X routes through the
 * ONE `consoleCardZoom` module and the App-level ConsoleMenuZoomHost serves
 * presentation + input (the pre-game twin of the shell's zoom host). The two
 * are tested TOGETHER over the shared module state — the exact wiring the
 * app runs (the local-mount pattern this replaced shipped desktop chrome, a
 * second card copy and a dead gamepad B).
 */

const CardZoomModalStub = defineComponent({
  name: 'CardZoomModal',
  props: {
    card: {type: Object, required: true},
    cards: {type: Array, default: undefined},
    index: {type: Number, default: 0},
    selected: {type: Boolean, default: false},
    dismissable: {type: Boolean, default: true},
    closing: {type: Boolean, default: false},
    consoleMotion: {type: Boolean, default: false},
    annotationsSuppressed: {type: Boolean, default: false},
    lore: {type: Boolean, default: false},
  },
  emits: ['navigate', 'close'],
  methods: {
    // JSDOM path: no landing geometry → the host opens vanilla (show()).
    async measureLanding(): Promise<undefined> {
      return undefined;
    },
    show(): void {},
    prev(): void {},
    next(): void {},
    close(): void {
      this.$emit('close');
    },
  },
  template: '<div class="zoom-stub"><slot name="side" :nonce="1" :closing="false" /><slot name="actions" /></div>',
});

const ConsoleCardRulesPanelStub = defineComponent({
  name: 'ConsoleCardRulesPanel',
  props: {
    cardName: {type: String, required: true},
    nonce: {type: Number, default: 0},
    closing: {type: Boolean, default: false},
  },
  template: '<aside class="console-rules-stub" />',
});

const ConsoleScrollAreaStub = defineComponent({
  name: 'ConsoleScrollArea',
  methods: {ensureVisible(): void {}},
  template: '<div><slot /></div>',
});

type PickerVm = {
  openZoom(names: ReadonlyArray<CardName>, at: number): void,
  handleIntent(intent: GamepadIntent): boolean,
};

type HostVm = {
  onIntent(intent: GamepadIntent): boolean,
};

// ONE stub set for BOTH mounts: vue-test-utils keeps a single active stub
// transformer, so with two wrappers alive the LAST mount's stubs govern every
// later re-render — a host re-rendering after the picker mounted would
// otherwise render the REAL CardZoomModal (measured: premium-card-face
// resolution failure from inside the real stage card).
const SHARED_STUBS = {
  GamepadGlyph: true,
  CardZoomModal: CardZoomModalStub,
  CardZoomCard: true,
  ConsoleCardRulesPanel: ConsoleCardRulesPanelStub,
  ConsoleScrollArea: ConsoleScrollAreaStub,
} as const;

function mountPicker() {
  return mount(ConsoleDevCardPicker, {
    global: {
      ...globalConfig.global,
      stubs: SHARED_STUBS,
    },
  });
}

function mountHost() {
  return mount(ConsoleMenuZoomHost, {
    global: {
      ...globalConfig.global,
      stubs: SHARED_STUBS,
    },
  });
}

async function settle(): Promise<void> {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

describe('ConsoleDevCardPicker fullscreen (module pipeline + pre-game host)', () => {
  let shellMountedBefore = false;

  beforeEach(() => {
    resetCreateGameState();
    closeConsoleCardZoom();
    shellMountedBefore = consoleState.shellMounted;
    consoleState.shellMounted = false;
    document.body.classList.remove('con-zoom-open');
  });

  afterEach(() => {
    closeConsoleCardZoom();
    consoleState.shellMounted = shellMountedBefore;
    document.body.classList.remove('con-zoom-open');
  });

  it('X routes through consoleCardZoom; the host serves console chrome; A toggles via the select bridge', async () => {
    const host = mountHost();
    const picker = mountPicker();
    const pickerVm = picker.vm as unknown as PickerVm;
    const hostVm = host.vm as unknown as HostVm;

    pickerVm.openZoom([CardName.ALGAE, CardName.BUSHES], 0);
    expect(consoleCardZoom.card?.name, 'module state opened').to.eq(CardName.ALGAE);
    expect(consoleCardZoom.contextLabel, 'context caption').to.eq('Guaranteed cards');
    expect(consoleCardZoom.origin.kind, 'list rows inspect textually').to.eq('textual');
    await settle();

    const zoom = host.findComponent(CardZoomModalStub);
    expect(zoom.exists(), 'host mounted the shared viewer').to.eq(true);
    expect(zoom.classes(), 'native viewer class').to.include('con-zoom');
    expect(zoom.props('consoleMotion'), 'native browse motion').to.eq(true);
    expect(zoom.props('lore'), 'native lore flank').to.eq(true);
    expect(zoom.props('annotationsSuppressed'), 'desktop callouts suppressed').to.eq(true);
    expect(host.find('.con-zoom-veil').exists(), 'native veil').to.eq(true);
    expect(host.find('.console-rules-stub').exists(), 'console rules panel').to.eq(true);
    expect(host.find('.con-zoom__bar').exists(), 'native command bar').to.eq(true);
    expect(host.find('.con-zoom__btn--select').exists(), 'select verb (bridge attached)').to.eq(true);
    expect(document.body.classList.contains('con-zoom-open'), 'body zoom ownership').to.eq(true);

    // While the viewer is open the PICKER swallows without acting — the host
    // owns the pad (the installMenuPad carve-out runs before the screen).
    expect(pickerVm.handleIntent(A), 'picker swallows under the viewer').to.eq(true);
    expect(createGameState.config.guaranteedCards.projects, 'no side effect').to.not.include(CardName.ALGAE);

    // A on the HOST rides the select bridge into the picker's guaranteed set.
    hostVm.onIntent(A);
    await nextTick();
    expect(createGameState.config.guaranteedCards.projects, 'A selects').to.include(CardName.ALGAE);
    expect(host.find('.con-zoom__state').exists(), 'selected status').to.eq(true);
    hostVm.onIntent(A);
    await nextTick();
    expect(createGameState.config.guaranteedCards.projects, 'second A deselects').to.not.include(CardName.ALGAE);
    expect(host.find('.con-zoom__state').exists(), 'selected status clears').to.eq(false);

    // Browsing re-points the module; the bridge follows the CURRENT card.
    navigateConsoleCardZoom({name: CardName.BUSHES} as CardModel, 1);
    hostVm.onIntent(A);
    expect(createGameState.config.guaranteedCards.projects, 'navigated card selects').to.include(CardName.BUSHES);

    // B closes through the host: module cleared, body ownership released.
    hostVm.onIntent(B);
    await settle();
    expect(consoleCardZoom.card, 'module cleared on B').to.eq(undefined);
    expect(document.body.classList.contains('con-zoom-open'), 'body zoom ownership cleared').to.eq(false);

    picker.unmount();
    host.unmount();
  });

  it('the picker closes the module viewer it opened when it unmounts', async () => {
    const picker = mountPicker();
    (picker.vm as unknown as PickerVm).openZoom([CardName.ALGAE], 0);
    expect(consoleCardZoom.card?.name).to.eq(CardName.ALGAE);
    picker.unmount();
    await nextTick();
    expect(consoleCardZoom.card, 'module viewer closed with its opener').to.eq(undefined);
  });
});
