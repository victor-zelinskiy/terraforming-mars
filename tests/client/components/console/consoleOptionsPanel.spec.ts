import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleOptionsPanel from '@/client/components/console/menu/ConsoleOptionsPanel.vue';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {privateScoreState, setPrivateScore} from '@/client/components/overview/privateScoreState';
import {buttonLayoutState, setButtonLayout} from '@/client/gamepad/buttonLayout';
import {currentProfileOverride, setConsoleProfileOverride} from '@/client/console/consoleLayoutProfile';

const A: GamepadIntent = {kind: 'press', button: 'confirm'};
const B: GamepadIntent = {kind: 'press', button: 'back'};
const LB: GamepadIntent = {kind: 'press', button: 'bumperL'};
const RB: GamepadIntent = {kind: 'press', button: 'bumperR'};
const DOWN: GamepadIntent = {kind: 'nav', dir: 'down', repeat: false};
const LEFT: GamepadIntent = {kind: 'nav', dir: 'left', repeat: false};
const RIGHT: GamepadIntent = {kind: 'nav', dir: 'right', repeat: false};

type PanelVm = {
  categories: ReadonlyArray<{id: string, minor: boolean, rows: ReadonlyArray<{id: string, value: string}>}>,
  current: {id: string, rows: ReadonlyArray<{id: string}>},
  categoryIndex: number,
  cursor: number,
  detail: {title: string, value: string, desc: string, note: string},
  handleIntent(intent: GamepadIntent): boolean,
};

function mountWith(context: 'menu' | 'game', initialCategory?: string) {
  return mount(ConsoleOptionsPanel, {
    global: {...globalConfig.global, stubs: {GamepadGlyph: true}},
    props: {context, initialCategory},
  });
}

/** Move the row cursor onto `id` inside the currently shown category. */
function cursorTo(vm: PanelVm, id: string): void {
  const at = vm.current.rows.findIndex((r) => r.id === id);
  expect(at, `row ${id} is in the ${vm.current.id} category`).to.be.greaterThan(-1);
  for (let i = 0; i < at; i++) {
    vm.handleIntent(DOWN);
  }
}

describe('ConsoleOptionsPanel (the settings console)', () => {
  /**
   * The read-only category falls back to scrolling its readout, and
   * ConsoleScrollArea measures inside a rAF the client setup does not forward
   * from JSDOM. Polyfill it for this file only — and restore it, since module
   * (and global) state is bundle-shared across specs.
   */
  const globals = globalThis as unknown as {requestAnimationFrame?: unknown, cancelAnimationFrame?: unknown};
  const hadRaf = 'requestAnimationFrame' in globals;
  before(() => {
    if (!hadRaf) {
      globals.requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(0), 0);
      globals.cancelAnimationFrame = (handle: number) => clearTimeout(handle);
    }
  });
  after(() => {
    if (!hadRaf) {
      delete globals.requestAnimationFrame;
      delete globals.cancelAnimationFrame;
    }
  });

  // Module state is bundle-shared across specs — restore the defaults.
  afterEach(() => {
    setPrivateScore(false);
    setButtonLayout('standard');
    setConsoleProfileOverride('auto');
  });

  it('opens on the first category and shows only that category’s rows', () => {
    const vm = mountWith('game').vm as unknown as PanelVm;
    expect(vm.current.id).to.eq('interface');
    // The flat eleven-row list is gone: a category shows a handful of rows.
    expect(vm.current.rows.map((r) => r.id)).to.deep.eq(['display', 'textScale']);
  });

  it('LB / RB step the category and reset the row cursor', () => {
    const vm = mountWith('game').vm as unknown as PanelVm;
    vm.handleIntent(RB);
    expect(vm.current.id).to.eq('controls');
    vm.handleIntent(DOWN);
    expect(vm.cursor).to.eq(1);
    vm.handleIntent(RB);
    expect(vm.current.id).to.eq('graphics');
    expect(vm.cursor).to.eq(0);
    vm.handleIntent(LB);
    expect(vm.current.id).to.eq('controls');
    // The ladder CLAMPS at the ends, like every other console list — only a
    // VALUE wraps. Walking past the first category stays on it.
    vm.handleIntent(LB);
    vm.handleIntent(LB);
    expect(vm.current.id).to.eq('interface');
  });

  it('D-pad right/left step the cursored setting in BOTH directions', () => {
    const vm = mountWith('game').vm as unknown as PanelVm;
    vm.handleIntent(RB); // → controls
    cursorTo(vm, 'buttons');
    expect(buttonLayoutState.layout).to.eq('standard');
    vm.handleIntent(RIGHT);
    expect(buttonLayoutState.layout).to.eq('swap-ab');
    vm.handleIntent(LEFT);
    expect(buttonLayoutState.layout).to.eq('standard');
  });

  it('A steps forward, so a five-option ring is still reachable one press at a time', () => {
    const vm = mountWith('menu').vm as unknown as PanelVm;
    cursorTo(vm, 'display');
    expect(currentProfileOverride()).to.eq('auto');
    vm.handleIntent(A);
    expect(currentProfileOverride()).to.eq('handheld');
    // …and LEFT walks straight back to where it started.
    vm.handleIntent(LEFT);
    expect(currentProfileOverride()).to.eq('auto');
  });

  it('the stepped value re-renders (the motion prefs are module-cached, not reactive)', () => {
    const w = mountWith('game');
    const vm = w.vm as unknown as PanelVm;
    vm.handleIntent(RB);
    vm.handleIntent(RB); // → graphics
    cursorTo(vm, 'motionSpeed');
    const before = vm.current.rows[vm.cursor];
    const beforeValue = (before as {value?: string}).value;
    vm.handleIntent(A);
    expect((vm.current.rows[vm.cursor] as {value?: string}).value).to.not.eq(beforeValue);
    // Restore the module-cached pref for the specs that follow.
    vm.handleIntent(LEFT);
  });

  it('the per-game private-score mask lives in its own in-game category', () => {
    const vm = mountWith('game').vm as unknown as PanelVm;
    expect(vm.categories.map((c) => c.id)).to.include('game');
    while (vm.current.id !== 'game') {
      vm.handleIntent(RB);
    }
    expect(privateScoreState.enabled).to.eq(false);
    vm.handleIntent(A);
    expect(privateScoreState.enabled).to.eq(true);
    expect(vm.current.rows.length).to.eq(1);
  });

  it('the detail strip describes the CURSORED row — never the row itself', () => {
    const vm = mountWith('game').vm as unknown as PanelVm;
    vm.handleIntent(RB); // → controls
    cursorTo(vm, 'wheelControl');
    expect(vm.detail.title).to.eq('Wheel control');
    expect(vm.detail.desc).to.eq('How the action wheel activates');
    expect(vm.detail.value).to.not.eq('');
  });

  it('a read-only category describes itself and has nothing to step', () => {
    const vm = mountWith('game', 'diagnostics').vm as unknown as PanelVm;
    expect(vm.current.id).to.eq('diagnostics');
    expect(vm.current.rows.length).to.eq(0);
    expect(vm.detail.title).to.eq('Diagnostics');
    // A press on an empty category must not throw or wander.
    vm.handleIntent(A);
    vm.handleIntent(RIGHT);
    vm.handleIntent(DOWN);
    expect(vm.current.id).to.eq('diagnostics');
  });

  it('initialCategory deep-links (the system menu’s «Диагностика» plate)', () => {
    const menu = mountWith('menu', 'diagnostics').vm as unknown as PanelVm;
    expect(menu.current.id).to.eq('diagnostics');
    // An id that does not exist in this context falls back to the first one.
    const fallback = mountWith('menu', 'game').vm as unknown as PanelVm;
    expect(fallback.current.id).to.eq('interface');
  });

  it('the minor categories are the technical ones (rail renders them small)', () => {
    const vm = mountWith('game').vm as unknown as PanelVm;
    expect(vm.categories.filter((c) => c.minor).map((c) => c.id)).to.deep.eq(['diagnostics']);
  });

  it('B emits close (returns to the main menu / the system list)', () => {
    const w = mountWith('game');
    (w.vm as unknown as PanelVm).handleIntent(B);
    expect(w.emitted('close')).to.have.length(1);
  });
});
