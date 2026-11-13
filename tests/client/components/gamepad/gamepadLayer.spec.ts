/*
 * GamepadLayer — the pad's app-level layer (focus ring, hint bar, the SYSTEM overlay). A `<script setup>` component
 * (V3 wave 4). Its template's root is a `<Teleport to="body">`: the component has NO element of its own.
 *
 * What the conversion WOKE, on purpose: the right stick inside the system overlay. The Options form looked its host
 * up through `this.$el` — which under a teleport root is the teleport's placeholder, so the lookup never found
 * `.con-sys-host` and the stick never paged the overlay, against `.claude/rules/console-ui.md` § «WHAT OVERFLOWS IS
 * REACHABLE» (the stick's one net is «used by the shell, the menu spine and the system overlay»). The host is asked
 * of the document now (there is ONE system overlay), and this spec pins both halves: open → the stick pages what
 * overflows inside the overlay; closed → the layer takes no scroll at all.
 */
import {expect} from 'chai';
import {shallowMount} from '@vue/test-utils';
import {nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import GamepadLayer from '@/client/components/gamepad/GamepadLayer.vue';
import {consoleSystemMenuIntent} from '@/client/console/consoleSystemMenuBridge';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';

const MENU_PRESS = {kind: 'press', button: 'menu'} as GamepadIntent;
const STICK_DOWN = {kind: 'scroll', dx: 0, dy: 1} as GamepadIntent;

describe('GamepadLayer — the system overlay under a teleport root', () => {
  const restore: Array<() => void> = [];

  afterEach(() => {
    while (restore.length > 0) {
      restore.pop()?.();
    }
  });

  function mountLayer(screen = 'player-home') {
    // Every child a stub — but the TELEPORT is the real one (a shallow mount stubs it empty): the overlay must land
    // in `body`, which is exactly where the layer looks for it.
    return shallowMount(GamepadLayer, {
      global: {...globalConfig.global, stubs: {teleport: false}},
      props: {screen},
      attachTo: document.body,
    });
  }

  /** An overflowing body inside the overlay's host — jsdom has no layout, so its geometry and the hit test are stubbed. */
  function overflowingBodyIn(host: Element): {scrolled: Array<number>} {
    const body = document.createElement('div');
    body.setAttribute('data-stick-scroll', '');
    host.appendChild(body);
    const box = {left: 400, top: 200, width: 900, height: 600};
    body.getBoundingClientRect = () => ({...box, x: box.left, y: box.top, right: box.left + box.width, bottom: box.top + box.height, toJSON: () => ({})}) as DOMRect;
    Object.defineProperty(body, 'scrollHeight', {configurable: true, get: () => 1800});
    Object.defineProperty(body, 'clientHeight', {configurable: true, get: () => 600});
    Object.defineProperty(body, 'offsetParent', {configurable: true, get: () => document.body});
    const doc = document as Document & {elementsFromPoint?: (x: number, y: number) => Array<Element>};
    const before = doc.elementsFromPoint;
    doc.elementsFromPoint = () => [body];
    restore.push(() => {
      doc.elementsFromPoint = before as never;
    });
    const scrolled: Array<number> = [];
    Object.defineProperty(body, 'scrollBy', {configurable: true, value: (options: {top: number}) => {
      scrolled.push(options.top);
    }});
    return {scrolled};
  }

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {configurable: true, value: 1920});
    Object.defineProperty(window, 'innerHeight', {configurable: true, value: 1080});
  });

  it('mounts with no element of its own and exposes nothing; the overlay is closed', async () => {
    const wrapper = mountLayer();
    await nextTick();
    expect(document.querySelector('.con-sys-host'), 'no overlay until Menu').to.equal(null);
    const exposed = (wrapper.vm.$ as unknown as {exposed: Record<string, unknown> | null}).exposed;
    expect(exposed === null || Object.keys(exposed).length === 0, 'no `defineExpose` — the app only mounts it').to.equal(true);
    wrapper.unmount();
  });

  it('Menu opens the overlay in the game, and the RIGHT STICK pages what overflows inside it', async () => {
    const wrapper = mountLayer();
    await nextTick();
    expect(consoleSystemMenuIntent(MENU_PRESS), 'the layer takes the Menu key').to.equal(true);
    await nextTick();
    const host = document.querySelector('.con-sys-host');
    expect(host, 'the overlay stands').to.not.equal(null);
    const {scrolled} = overflowingBodyIn(host as Element);

    expect(consoleSystemMenuIntent(STICK_DOWN), 'an open overlay owns every intent').to.equal(true);
    expect(scrolled.length, 'the stick reached the overlay\'s own body').to.equal(1);
    expect(scrolled[0], 'down is down').to.be.greaterThan(0);

    // Menu again closes it; the layer then takes no scroll at all — the game behind it is the shell's.
    expect(consoleSystemMenuIntent(MENU_PRESS)).to.equal(true);
    await nextTick();
    expect(consoleSystemMenuIntent(STICK_DOWN), 'closed: not the layer\'s intent').to.equal(false);
    expect(scrolled.length, 'nothing scrolled behind a closed overlay').to.equal(1);
    wrapper.unmount();
  });

  it('outside the game Menu opens nothing (there is nowhere to return to)', async () => {
    const wrapper = mountLayer('main-menu');
    await nextTick();
    consoleSystemMenuIntent(MENU_PRESS);
    await nextTick();
    expect(document.querySelector('.con-sys-host')).to.equal(null);
    wrapper.unmount();
  });

  it('the unmount hands the keyboard route back', async () => {
    const wrapper = mountLayer();
    await nextTick();
    wrapper.unmount();
    expect(consoleSystemMenuIntent(MENU_PRESS), 'no layer — nobody takes the key').to.equal(false);
  });
});
