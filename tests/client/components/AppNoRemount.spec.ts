/*
 * Guard for the no-remount update model
 * (docs/REMOUNT_ANIMATION_REWORK_DESIGN.md).
 *
 * The game subtree is not keyed on `playerkey`: an update applies the
 * fresh playerView reactively and `playerkey` acts as the transient-UI reset
 * epoch. Desktop-removal deleted `PlayerHome` (wave 2) and then the
 * `tm_remount` rollback ladder itself, so the game subtree is <ConsoleShell>
 * and the contract left to pin is App-level: an update keeps the SAME shell
 * DOM element while `playerkey` still bumps where it used to (the
 * reset-epoch signal).
 */
import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import App from '@/client/components/App.vue';
import {fakeGameModel, fakePlayerViewModel} from './testHelpers';
import {FakeLocalStorage} from './FakeLocalStorage';
import {paths} from '@/common/app/paths';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {nextTick} from 'vue';

/**
 * THE ROOT'S PORT — what a holder of the root reaches (`defineExpose(root)` in `App.vue`: the very object the tree is
 * given by injection). The root is `<script setup>`: its state is written, and its verbs called, through the port.
 */
type RootPort = {
  screen: string,
  playerView: PlayerViewModel | undefined,
  playerkey: number,
  update(path: typeof paths.PLAYER): void,
};
function portOf(wrapper: {vm: unknown}): RootPort {
  return (wrapper.vm as {$: {exposed: RootPort}}).$.exposed;
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * The game shell's stub. The root imports its lazy screens as bindings (`appAsync.ts`), and an imported lazy binding
 * answers to the stub key `AsyncComponentWrapper` (RECIPES § 3) — so the shell is told apart from the other lazy
 * screens by what the root hands IT: the live waiting list.
 */
const SHELL_STUB = 'async-component-wrapper-stub[waiting-on-players]';

describe('AppNoRemount', () => {
  let localStorage: FakeLocalStorage;
  let originalFetch: unknown;

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    FakeLocalStorage.register(localStorage);
    originalFetch = (global as any).fetch;
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
    FakeLocalStorage.deregister(localStorage);
  });

  // Desktop-removal wave 1: the game subtree is <ConsoleShell> — the desktop
  // <player-home> branch was cut from App. The no-remount contract carries
  // over unchanged: an update applies the view reactively, the shell element
  // is never recreated, and `playerkey` keeps signalling the reset epoch.
  it('an update keeps the SAME console-shell element while bumping the reset epoch', async () => {
    const oldView = fakePlayerViewModel({game: fakeGameModel({gameAge: 1})});
    const newView = fakePlayerViewModel({game: fakeGameModel({gameAge: 2})});
    const wrapper = shallowMount(App, globalConfig);
    const root = portOf(wrapper);
    root.screen = 'player-home';
    root.playerView = oldView;
    root.playerkey = 7;
    await nextTick();
    (global as any).fetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(newView),
    });

    const before = wrapper.find(SHELL_STUB);
    expect(before.exists()).to.be.true;
    const beforeEl = before.element;

    root.update(paths.PLAYER);
    await flushPromises();
    await nextTick();

    // The reset epoch advanced (the old remount trigger still signals)…
    expect(root.playerkey).to.eq(8);
    // …but the subtree was NOT recreated: same element.
    expect(wrapper.find(SHELL_STUB).element).to.eq(beforeEl);
  });

  /*
   * THE PROMPT-PRESERVING EPOCH RULE (presentation-reconciliation, mechanism
   * A): a mid-prompt refresh whose fetched view carries the SAME
   * `waitingFor.promptId` is the same server prompt still standing — the
   * apply must NOT bump the reset epoch (partial input survives), while a
   * CHANGED promptId keeps the ordinary bump (the server replaced the
   * prompt; stale partial input must reset).
   */
  it('an update with an UNCHANGED promptId preserves the reset epoch', async () => {
    const oldView = fakePlayerViewModel({game: fakeGameModel({gameAge: 1})});
    (oldView as any).waitingFor = {type: 'or', promptId: 41, options: []};
    const newView = fakePlayerViewModel({game: fakeGameModel({gameAge: 2})});
    (newView as any).waitingFor = {type: 'or', promptId: 41, options: []};
    const wrapper = shallowMount(App, globalConfig);
    const root = portOf(wrapper);
    root.screen = 'player-home';
    root.playerView = oldView;
    root.playerkey = 7;
    await nextTick();
    (global as any).fetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(newView),
    });

    root.update(paths.PLAYER);
    await flushPromises();
    await nextTick();

    expect(root.playerkey, 'the epoch must survive an unchanged prompt').to.eq(7);
    expect(root.playerView?.game.gameAge, 'the view still applied').to.eq(2);
  });

  it('an update with a CHANGED promptId keeps the ordinary epoch bump', async () => {
    const oldView = fakePlayerViewModel({game: fakeGameModel({gameAge: 1})});
    (oldView as any).waitingFor = {type: 'or', promptId: 41, options: []};
    const newView = fakePlayerViewModel({game: fakeGameModel({gameAge: 2})});
    (newView as any).waitingFor = {type: 'or', promptId: 42, options: []};
    const wrapper = shallowMount(App, globalConfig);
    const root = portOf(wrapper);
    root.screen = 'player-home';
    root.playerView = oldView;
    root.playerkey = 7;
    await nextTick();
    (global as any).fetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(newView),
    });

    root.update(paths.PLAYER);
    await flushPromises();
    await nextTick();

    expect(root.playerkey).to.eq(8);
  });
});
