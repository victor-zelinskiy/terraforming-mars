import {defineComponent, h, nextTick, ref} from 'vue';
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
 *
 * The picker is a `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). The creator stands it under
 * `ref="devCards"` and hands it the pad THROUGH THAT REF — so its contract with its parent (`handleIntent` and nothing
 * else) is read off a host's ref; `openZoom` is reached through `wrapper.vm`, which sees the setup state in a test
 * build and is no part of that contract.
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
  // Exposes what the real viewer does: its members and its ROOT by the one name a host reads it by (`rootEl` — a
  // Vapor child's ref answers no `$el`, components/rootEl.ts); the host opens only once it finds that element.
  setup(_, {emit, expose, slots}) {
    const root = ref<HTMLElement | null>(null);
    expose({
      // JSDOM path: no landing geometry → the host opens vanilla (show()).
      measureLanding: async (): Promise<undefined> => undefined,
      show: (): void => {},
      prev: (): void => {},
      next: (): void => {},
      close: (): void => emit('close'),
      rootEl: root,
    });
    return () => h('div', {ref: root, class: 'zoom-stub'}, [slots.side?.({nonce: 1, closing: false}), slots.actions?.()]);
  },
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

/** Every row the picker asked its scroll area to keep in view — through its `scroll` ref. */
const kept: Array<Element | null> = [];
const ConsoleScrollAreaStub = defineComponent({
  name: 'ConsoleScrollArea',
  setup(_, {expose, slots}) {
    const root = ref<HTMLElement | null>(null);
    expose({
      ensureVisible: (el: Element | null): void => {
        kept.push(el);
      },
      rootEl: root,
    });
    return () => h('div', {ref: root}, slots.default?.());
  },
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

  it('a PARENT\'s ref sees `handleIntent` and nothing else; through it the pad walks the levels, the cursored row is kept in view, and B on the top level asks to close', async () => {
    const closed = {count: 0};
    // Mounted the way the creator mounts it: under a host with a string ref, the pad handed over through that ref.
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleDevCardPicker, {
        ref: 'devCards',
        onClose: () => {
          closed.count++;
        },
      })]),
    });
    const host = mount(Host, {global: {...globalConfig.global, stubs: SHARED_STUBS}});
    /** Exactly the creator's read: `devCards.value ?? undefined`, typed by the one member it calls. */
    const picker = (host.vm.$refs.devCards ?? undefined) as {handleIntent(intent: GamepadIntent): boolean} | undefined;
    if (picker === undefined) {
      throw new Error('the host holds no ref to the picker');
    }
    expect(Object.keys(picker), 'exactly what the picker exposes').to.deep.eq(['handleIntent']);
    const leaked = ['view', 'pickedCursor', 'moduleCursor', 'cardCursor', 'module', 'openZoom', 'openModules', 'toggleAt', 'removeAt', 'root', 'scroll']
      .filter((key) => (picker as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);

    // PICKED: nothing rigged — the one row is «＋ Add card», and it wears the cursor.
    expect(host.findAll('.cm-drow').map((row) => row.classes().includes('cm-drow--cursor'))).to.deep.eq([true]);
    expect(host.find('.cm-devcards__empty').exists()).to.eq(true);
    expect(host.find('.cm-devcards__crumb').exists(), 'the top level has no crumb').to.eq(false);

    // A → MODULES; ▼ moves the cursor, and the row that wears it — found inside the picker's own root — is kept in view.
    expect(picker.handleIntent(A)).to.eq(true);
    await nextTick();
    await nextTick();
    const modules = () => host.findAll('.cm-drow--module');
    expect(modules().length).to.be.greaterThan(1);
    expect(host.find('.cm-devcards__crumb').exists()).to.eq(true);
    kept.length = 0;
    expect(picker.handleIntent({kind: 'nav', dir: 'down', repeat: false})).to.eq(true);
    await nextTick();
    await nextTick();
    expect(modules().map((row) => row.classes().includes('cm-drow--cursor')).indexOf(true)).to.eq(1);
    expect(kept).to.have.length(1);
    expect(kept[0], 'the cursored module row').to.eq(modules()[1].element);

    // A → that module's CARDS: the cursor lands on a card, never on a group heading.
    picker.handleIntent(A);
    await nextTick();
    expect(host.find('.cm-devcards__group').exists()).to.eq(true);
    expect(host.findAll('.cm-drow--cursor')).to.have.length(1);

    // B is one level per press — and only the top level's B asks the creator to close.
    picker.handleIntent(B);
    await nextTick();
    expect(modules().length).to.be.greaterThan(1);
    picker.handleIntent(B);
    await nextTick();
    expect(host.find('.cm-drow--add').exists()).to.eq(true);
    expect(closed.count, 'the inner levels never close the picker').to.eq(0);
    expect(picker.handleIntent(B)).to.eq(true);
    expect(closed.count).to.eq(1);
  });
});
