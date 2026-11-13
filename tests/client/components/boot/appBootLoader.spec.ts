/*
 * AppBootLoader — the app-launch screen and its GPU warm-up. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): what it shows before and after the GPU is live, the phase chain it walks on the flow
 * kernel's clock down to the module flag App's `v-if` reads, the top-layer dialog it opens through its template ref
 * and never leaves behind (R11), and the error of a warm-up child it swallows (R9 — `onErrorCaptured`). It exposes
 * nothing: App stands no ref on it.
 */
import {expect} from 'chai';
import {mount, VueWrapper} from '@vue/test-utils';
import {Component, defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import AppBootLoader from '@/client/components/boot/AppBootLoader.vue';
import {beginBootWarmup, bootWarmupState} from '@/client/components/boot/bootWarmupState';
import {motionMs} from '@/client/components/motion/motionTokens';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {CardName} from '@/common/cards/CardName';

const GPU_READY = 'tm-gpu-ready';

// The four children are warm-up scenery with specs of their own; these stand-ins say what the loader HANDS them.
// (Render functions, not template strings: the runtime compiler is not in this build.)
const CardStub = defineComponent({
  name: 'Card',
  props: {card: {type: Object, required: true}, inert: {type: Boolean, default: false}},
  render() {
    return h('i', {'class': 'card-stub', 'data-name': (this.card as {name: string}).name, 'data-inert': String(this.inert)});
  },
});
const SpaceStub = defineComponent({
  name: 'BoardSpace',
  props: {space: {type: Object, required: true}, tileView: {type: String, default: ''}, aresExtension: {type: Boolean, default: true}},
  render() {
    return h('i', {'class': 'space-stub', 'data-id': (this.space as {id: string}).id, 'data-view': this.tileView, 'data-ares': String(this.aresExtension)});
  },
});
const CubeStub = defineComponent({
  name: 'PlayerCube',
  props: {color: {type: String, required: true}, size: {type: Number, default: 0}},
  render() {
    return h('i', {'class': 'cube-stub', 'data-color': this.color, 'data-size': String(this.size)});
  },
});
const ScaleStub = defineComponent({
  name: 'ArcScale',
  props: {theme: {type: Object, required: true}, config: {type: Object, required: true}, value: {type: Number, required: true}},
  render() {
    return h('i', {'class': 'scale-stub', 'data-value': String(this.value)});
  },
});
const STUBS: Record<string, Component> = {Card: CardStub, BoardSpace: SpaceStub, PlayerCube: CubeStub, ArcScale: ScaleStub};

/** What the loader asked of its top-layer dialog, in order. jsdom's own dialog is beside the point: the loader's calls are. */
function recordDialog(wrapper: VueWrapper): Array<string> {
  const calls: Array<string> = [];
  const dialog = wrapper.find('dialog.boot-loader__warm-dialog').element as HTMLDialogElement;
  dialog.showModal = () => {
    calls.push('showModal');
  };
  dialog.close = () => {
    calls.push('close');
  };
  return calls;
}

/** main's signal that GPU compositing is live. (The WINDOW's own `Event`: node's global one is not a jsdom event.) */
function signalGpuReady(): void {
  window.dispatchEvent(new window.Event(GPU_READY));
}

function bar(wrapper: VueWrapper): string {
  return (wrapper.find('.boot-loader__progress-fill').element as HTMLElement).style.width;
}

function stage(wrapper: VueWrapper): string {
  return wrapper.find('.boot-loader__stage').text();
}

describe('AppBootLoader — the app-launch screen and its GPU warm-up', () => {
  const page = window as {__tmGpuReady?: boolean};
  let clock: ManualFlowClock;
  let mounted: Array<VueWrapper>;
  let activeBefore: boolean;
  /** One warm-up phase, as the loader paces it (no `matchMedia` here → the full beat). */
  let PHASE: number;

  function mountLoader(stubs: Record<string, Component> = STUBS): VueWrapper {
    const wrapper = mount(AppBootLoader, {...globalConfig, global: {...globalConfig.global, stubs}});
    mounted.push(wrapper);
    return wrapper;
  }

  /** The loader leaves NOW, inside the test (and is not unmounted a second time after it). */
  function leave(wrapper: VueWrapper): void {
    mounted.splice(mounted.indexOf(wrapper), 1);
    wrapper.unmount();
  }

  beforeEach(() => {
    activeBefore = bootWarmupState.active;
    clock = createManualClock(0);
    setFlowClock(clock);
    PHASE = motionMs(900);
    mounted = [];
    beginBootWarmup();
  });
  // Module state is BUNDLE-SHARED: the loaders leave on THIS clock (their scopes end with them), then the kernel's
  // clock, the warm-up flag and the page's GPU mark are put back for every later spec. (The session's «done» mark is
  // the module's own business, and this environment has no `sessionStorage` for it to write.)
  afterEach(() => {
    for (const wrapper of mounted) {
      wrapper.unmount();
    }
    setFlowClock(undefined);
    delete page.__tmGpuReady;
    bootWarmupState.active = activeBefore;
  });

  it('stands calm until the GPU is live — the status line and the bar, none of the warm-up scene; the signal starts it', async () => {
    const wrapper = mountLoader();
    const dialog = recordDialog(wrapper);

    expect(wrapper.element.tagName, 'the template starts with its root').to.eq('DIV');
    expect(wrapper.classes()).to.include('boot-loader');
    expect(wrapper.attributes('role')).to.eq('status');
    expect(wrapper.attributes('aria-label')).to.eq('Preparing the game');
    expect(stage(wrapper)).to.eq('Preparing the game');
    expect(bar(wrapper)).to.eq('8%');
    expect((wrapper.find('.boot-loader__sweep').element as HTMLElement).style.animationDelay, 'the wall-clock orbit phase').to.match(/^-?\d+ms$/);
    expect(wrapper.find('.boot-loader__warm').attributes('inert'), 'the warm-up subtree is passive').to.not.eq(undefined);
    expect(wrapper.find('.boot-loader__warm-cards').exists(), 'no card before the GPU composites').to.eq(false);
    expect(wrapper.find('.boot-loader__warm-game').exists()).to.eq(false);
    expect(wrapper.find('.boot-loader__warm-dialog-zoom .card-stub').exists()).to.eq(false);
    await nextTick();
    expect(dialog, 'the top layer is not touched yet').to.deep.eq([]);

    signalGpuReady();
    await nextTick();

    // The REAL card faces, one per render path — the first two in the states a deal hits (selected / unplayable).
    const cards = wrapper.findAll('.boot-loader__warm-cards > .boot-loader__warm-card');
    expect(cards.map((c) => c.find('.card-stub').attributes('data-name'))).to.deep.eq([
      CardName.ECOLINE, CardName.THARSIS_REPUBLIC, CardName.TREES, CardName.PREDATORS, CardName.COMET, CardName.DONATION,
    ]);
    expect(cards.map((c) => c.find('.card-stub').attributes('data-inert'))).to.deep.eq(cards.map(() => 'true'));
    expect(cards.map((c) => c.classes().filter((k) => k !== 'boot-loader__warm-card'))).to.deep.eq([
      ['boot-loader__warm-card--selected'], ['boot-loader__warm-card--disabled'], [], [], [], [],
    ]);
    expect(cards.map((c) => (c.element as HTMLElement).style.animationDelay), 'the deal-in stagger').to.deep.eq(['0ms', '38ms', '76ms', '114ms', '152ms', '190ms']);

    // The board kinds: cells, cubes, the three arc scales.
    const game = wrapper.find('.boot-loader__warm-game');
    expect(game.findAll('.space-stub').map((s) => [s.attributes('data-id'), s.attributes('data-view'), s.attributes('data-ares')])).to.deep.eq([
      ['61', 'show', 'false'], ['62', 'show', 'false'], ['63', 'show', 'false'], ['64', 'show', 'false'], ['65', 'show', 'false'],
    ]);
    expect(game.findAll('.cube-stub').map((c) => [c.attributes('data-color'), c.attributes('data-size')])).to.deep.eq([
      ['red', '21'], ['green', '21'], ['blue', '21'], ['yellow', '21'], ['black', '21'],
    ]);
    expect(game.findAll('.scale-stub').map((s) => s.attributes('data-value'))).to.deep.eq(['0', '-30', '0']);

    // The zoom-scale legacy face inside the top-layer dialog, and the dialog opened through the loader's own ref —
    // for one beat.
    expect(wrapper.find('.boot-loader__warm-dialog-zoom .card-stub').attributes('data-name')).to.eq(CardName.ECOLINE);
    expect(dialog).to.deep.eq(['showModal']);
    clock.advance(motionMs(500));
    expect(dialog).to.deep.eq(['showModal', 'close']);

    expect(bar(wrapper), 'the first phase is under way').to.eq('25%');
  });

  it('with no signal the 1.4 s fallback starts it — and the signal arriving after that starts no second chain', async () => {
    const wrapper = mountLoader();

    clock.advance(1399);
    await nextTick();
    expect(wrapper.find('.boot-loader__warm-cards').exists()).to.eq(false);
    expect(bar(wrapper)).to.eq('8%');

    clock.advance(1);
    await nextTick();
    expect(wrapper.find('.boot-loader__warm-cards').exists()).to.eq(true);
    expect(bar(wrapper)).to.eq('25%');

    // Two chains would step the phase twice at the same beat (75 %).
    signalGpuReady();
    clock.advance(PHASE);
    await nextTick();
    expect(bar(wrapper)).to.eq('50%');
  });

  it('walks its phases on the kernel\'s clock to «Almost ready…», holds one more beat at 100 % and lowers the flag App reads', async () => {
    page.__tmGpuReady = true;
    const wrapper = mountLoader();
    await nextTick();
    expect(wrapper.find('.boot-loader__warm-cards').exists(), 'a live GPU starts the warm-up at mount').to.eq(true);
    expect([bar(wrapper), stage(wrapper)]).to.deep.eq(['25%', 'Preparing the game']);

    clock.advance(PHASE - 1);
    await nextTick();
    expect(bar(wrapper), 'a phase lasts its whole beat').to.eq('25%');
    clock.advance(1);
    await nextTick();
    expect([bar(wrapper), stage(wrapper)]).to.deep.eq(['50%', 'Preparing the game']);

    clock.advance(PHASE);
    await nextTick();
    expect([bar(wrapper), stage(wrapper)]).to.deep.eq(['75%', 'Preparing the game']);

    clock.advance(PHASE);
    await nextTick();
    expect([bar(wrapper), stage(wrapper)], 'the last phase').to.deep.eq(['100%', 'Almost ready…']);
    expect(bootWarmupState.active, 'the hold at 100 %').to.eq(true);

    clock.advance(PHASE - 1);
    expect(bootWarmupState.active).to.eq(true);
    clock.advance(1);
    expect(bootWarmupState.active, 'App\'s `v-if` lets the loader go').to.eq(false);
  });

  it('a loader that leaves inside its last hold still lowers the flag (a RELEASE) — and never leaves its dialog in the top layer', async () => {
    page.__tmGpuReady = true;
    const wrapper = mountLoader();
    const dialog = recordDialog(wrapper);
    await nextTick();
    clock.advance(PHASE * 3);
    await nextTick();
    expect(stage(wrapper)).to.eq('Almost ready…');
    expect(bootWarmupState.active).to.eq(true);
    expect(dialog, 'opened, and closed after its beat').to.deep.eq(['showModal', 'close']);

    leave(wrapper);

    expect(bootWarmupState.active, 'never left raised').to.eq(false);
    expect(dialog, 'closed once more on the way out — whatever state it was in').to.deep.eq(['showModal', 'close', 'close']);
  });

  it('a loader that leaves before the GPU answered takes its listener back', () => {
    const wrapper = mountLoader();
    const taken: Array<unknown> = [];
    const realRemove = window.removeEventListener;
    window.removeEventListener = ((...args: Parameters<typeof realRemove>) => {
      if (args[0] === GPU_READY) {
        taken.push(args[1]);
      }
      realRemove.apply(window, args);
    }) as typeof window.removeEventListener;
    try {
      leave(wrapper);
    } finally {
      window.removeEventListener = realRemove;
    }
    expect(taken.length).to.eq(1);
    expect(taken[0]).to.be.a('function');
    // …and the signal after it has left starts nothing (the flag is App's to lower then).
    signalGpuReady();
    clock.advance(PHASE * 5);
    expect(bootWarmupState.active).to.eq(true);
  });

  it('a warm-up child that throws is swallowed HERE (`onErrorCaptured`) — no parent and no app handler hears it, the loader keeps running', async () => {
    const heard: Array<string> = [];
    const Thrower = defineComponent({
      name: 'BoardSpace',
      render(): never {
        throw new Error('a warm-up cell with no game behind it');
      },
    });
    const hostOf = (child: Component) => defineComponent({
      errorCaptured(err: unknown): boolean {
        heard.push(`host: ${(err as Error).message}`);
        return false;
      },
      render: () => h('div', [h(child)]),
    });
    const mountUnder = (child: Component): VueWrapper => {
      const wrapper = mount(hostOf(child), {
        ...globalConfig,
        global: {
          ...globalConfig.global,
          stubs: {...STUBS, BoardSpace: Thrower},
          config: {
            ...globalConfig.global.config,
            errorHandler: (err: unknown) => {
              heard.push(`app: ${(err as Error).message}`);
            },
          },
        },
      });
      mounted.push(wrapper);
      return wrapper;
    };

    // The control: with no loader between them, the host DOES hear the cell.
    mountUnder(Thrower);
    expect(heard).to.deep.eq(['host: a warm-up cell with no game behind it']);
    heard.length = 0;

    page.__tmGpuReady = true;
    const wrapper = mountUnder(AppBootLoader);
    await nextTick();

    expect(heard, 'five cells threw; the error stopped at the loader').to.deep.eq([]);
    expect(wrapper.find('.boot-loader__warm-game').exists()).to.eq(true);
    expect(wrapper.findAll('.space-stub').length, 'the cells that threw render nothing').to.eq(0);
    expect(wrapper.findAll('.boot-loader__warm-game > .cube-stub').length, 'their siblings are still warmed').to.eq(5);
    expect(wrapper.findAll('.boot-loader__warm-cards .card-stub').length).to.eq(6);

    clock.advance(PHASE);
    await nextTick();
    expect(bar(wrapper), 'the phases go on').to.eq('50%');
  });

  it('a parent\'s ref reaches nothing — the loader exposes no member', () => {
    const Host = defineComponent({
      render: () => h('div', [h(AppBootLoader, {ref: 'loader'})]),
    });
    const host = mount(Host, {...globalConfig, global: {...globalConfig.global, stubs: STUBS}});
    mounted.push(host);
    expect(host.find('.boot-loader').exists()).to.eq(true);
    expect(Object.keys((host.vm.$refs.loader ?? {}) as object), 'App drives it by its `v-if` alone').to.deep.eq([]);
  });
});
