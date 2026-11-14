import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleOptionsPanel from '@/client/components/console/menu/ConsoleOptionsPanel.vue';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {privateScoreState, setPrivateScore} from '@/client/components/overview/privateScoreState';
import {buttonLayoutState, setButtonLayout} from '@/client/gamepad/buttonLayout';
import {currentProfileOverride} from '@/client/console/consoleLayoutProfile';
import {restLayoutProfile} from './layoutAtRest';
import {notificationFeedModeState, setNotificationFeedMode} from '@/client/components/notifications/notificationFeedMode';
import {notificationContentModeState, setNotificationContentMode} from '@/client/components/notifications/notificationContentMode';
import {devNoticeState, setDevNoticeMode} from '@/client/diagnostics/diagnosticsPrefs';

const A: GamepadIntent = {kind: 'press', button: 'confirm'};
const B: GamepadIntent = {kind: 'press', button: 'back'};
const LB: GamepadIntent = {kind: 'press', button: 'bumperL'};
const RB: GamepadIntent = {kind: 'press', button: 'bumperR'};
const DOWN: GamepadIntent = {kind: 'nav', dir: 'down', repeat: false};
const LEFT: GamepadIntent = {kind: 'nav', dir: 'left', repeat: false};
const RIGHT: GamepadIntent = {kind: 'nav', dir: 'right', repeat: false};

type PanelVm = {
  categories: ReadonlyArray<{id: string, minor: boolean, rows: ReadonlyArray<{id: string, value: string}>}>,
  current: {id: string, rows: ReadonlyArray<{id: string}>, readout: ReadonlyArray<unknown>},
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

  // Module state is bundle-shared across specs — restore the defaults. The layout profile goes back to its REST
  // state, never to «auto» (`layoutAtRest.ts` says why: «auto» in jsdom is `handheld`, for every spec after this one).
  afterEach(() => {
    setPrivateScore(false);
    setButtonLayout('standard');
    restLayoutProfile();
    setNotificationFeedMode('all');
    setNotificationContentMode('brief');
  });

  it('opens on the first category and shows only that category’s rows', () => {
    const vm = mountWith('game').vm as unknown as PanelVm;
    expect(vm.current.id).to.eq('interface');
    // The flat eleven-row list is gone: a category shows a handful of rows.
    expect(vm.current.rows.map((r) => r.id)).to.deep.eq(['display', 'textScale', 'albumLayout', 'dockCards', 'cardNumbers', 'eventCounter']);
  });

  it('the quick-notification feed mode is a dialable NOTIFICATIONS row (both directions, wrapping)', () => {
    const vm = mountWith('game').vm as unknown as PanelVm;
    vm.handleIntent(RB); // → notifications (TR59: the two notification settings have a category of their own)
    expect(vm.current.id).to.eq('notifications');
    cursorTo(vm, 'notifications');
    expect(notificationFeedModeState.mode).to.eq('all');
    expect(vm.detail.title).to.eq('Quick notifications');
    expect(vm.detail.value).to.eq('All events');
    vm.handleIntent(RIGHT);
    expect(notificationFeedModeState.mode).to.eq('personal');
    expect(vm.detail.value).to.eq('Only involving me');
    vm.handleIntent(LEFT);
    expect(notificationFeedModeState.mode).to.eq('all');
    // Available from the MAIN MENU too (the category exists in both hosts), so the preference can be set before a
    // game starts.
    const menu = mountWith('menu').vm as unknown as PanelVm;
    menu.handleIntent(RB);
    expect(menu.current.rows.some((r) => r.id === 'notifications')).to.eq(true);
  });

  it('the notification CONTENT mode is the category second row — Brief ⇄ Only mine (TR59)', () => {
    const vm = mountWith('game').vm as unknown as PanelVm;
    vm.handleIntent(RB);
    expect(vm.current.rows.map((r) => r.id)).to.deep.eq(['notifications', 'notificationContent']);
    cursorTo(vm, 'notificationContent');
    expect(notificationContentModeState.mode).to.eq('brief');
    expect(vm.detail.title).to.eq('Notification content');
    expect(vm.detail.value).to.eq('Brief');
    vm.handleIntent(RIGHT);
    expect(notificationContentModeState.mode).to.eq('mine');
    expect(vm.detail.value).to.eq('Only mine');
    vm.handleIntent(RIGHT);
    expect(notificationContentModeState.mode, 'the ring wraps').to.eq('brief');
  });

  it('LB / RB step the category and reset the row cursor', () => {
    const vm = mountWith('game').vm as unknown as PanelVm;
    vm.handleIntent(RB);
    expect(vm.current.id).to.eq('notifications');
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
    vm.handleIntent(LB);
    expect(vm.current.id).to.eq('interface');
  });

  it('D-pad right/left step the cursored setting in BOTH directions', () => {
    const vm = mountWith('game').vm as unknown as PanelVm;
    vm.handleIntent(RB); // → notifications
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
    vm.handleIntent(RB); // → notifications
    vm.handleIntent(RB); // → controls
    cursorTo(vm, 'wheelControl');
    expect(vm.detail.title).to.eq('Wheel control');
    expect(vm.detail.desc).to.eq('How the action wheel activates');
    expect(vm.detail.value).to.not.eq('');
  });

  it('ДИАГНОСТИКА is dialable: the developer notices step like every other setting', () => {
    const before = devNoticeState.mode;
    try {
      setDevNoticeMode('off');
      const vm = mountWith('game', 'diagnostics').vm as unknown as PanelVm;
      expect(vm.current.id).to.eq('diagnostics');
      expect(vm.current.readout.length).to.eq(0);
      cursorTo(vm, 'devNotices');
      expect(vm.detail.title).to.eq('Developer notices');
      vm.handleIntent(A);
      expect(devNoticeState.mode).to.eq('errors');
      vm.handleIntent(LEFT);
      expect(devNoticeState.mode).to.eq('off');
      expect(vm.current.id).to.eq('diagnostics');
    } finally {
      setDevNoticeMode(before);
    }
  });

  it('initialCategory deep-links onto a category of this context', () => {
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

  it('a PARENT\'s ref sees `handleIntent` and nothing else — the road both hosts route the pad by', async () => {
    // The panel is a `<script setup>` component: its ref carries only what it exposes. Mounted the way the main
    // menu and the system overlay mount it — under an Options host with a string ref.
    const Host = defineComponent({
      render: () => h('div', [h(ConsoleOptionsPanel, {ref: 'options', context: 'game'})]),
    });
    const host = mount(Host, {global: {...globalConfig.global, stubs: {GamepadGlyph: true}}});
    // Exactly the hosts' read: `(this.$refs.options ?? undefined) as {handleIntent?: (intent: GamepadIntent) => boolean} | undefined`.
    const panel = (host.vm.$refs.options ?? undefined) as {handleIntent(intent: GamepadIntent): boolean} | undefined;
    if (panel === undefined) {
      throw new Error('the host holds no ref to the panel');
    }
    expect(Object.keys(panel), 'exactly what the panel exposes').to.deep.eq(['handleIntent']);
    const leaked = ['categories', 'current', 'categoryIndex', 'cursor', 'detail', 'revision', 'step', 'stepAt', 'selectCategory']
      .filter((key) => (panel as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);

    const cursorAt = () => host.findAll('.con-set__row').map((row) => row.classes().includes('con-set__row--cursor')).indexOf(true);
    expect(cursorAt()).to.eq(0);
    expect(panel.handleIntent(DOWN)).to.eq(true);
    await nextTick();
    expect(cursorAt(), 'the pad through the ref moves the cursor on screen').to.eq(1);
    expect(panel.handleIntent(RB)).to.eq(true);
    await nextTick();
    expect(host.findAll('.con-set__tab').map((tab) => tab.classes().includes('con-set__tab--current')).indexOf(true), '…and the category').to.eq(1);
  });
});
