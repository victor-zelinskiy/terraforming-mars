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

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

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
    await wrapper.setData({screen: 'player-home', playerView: oldView, playerkey: 7});
    (global as any).fetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(newView),
    });

    const before = wrapper.find('console-shell-stub');
    expect(before.exists()).to.be.true;
    const beforeEl = before.element;

    (wrapper.vm as any).update(paths.PLAYER);
    await flushPromises();
    await wrapper.vm.$nextTick();

    // The reset epoch advanced (the old remount trigger still signals)…
    expect((wrapper.vm as any).playerkey).to.eq(8);
    // …but the subtree was NOT recreated: same element.
    expect(wrapper.find('console-shell-stub').element).to.eq(beforeEl);
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
    await wrapper.setData({screen: 'player-home', playerView: oldView, playerkey: 7});
    (global as any).fetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(newView),
    });

    (wrapper.vm as any).update(paths.PLAYER);
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect((wrapper.vm as any).playerkey, 'the epoch must survive an unchanged prompt').to.eq(7);
    expect(((wrapper.vm as any).playerView.game as any).gameAge, 'the view still applied').to.eq(2);
  });

  it('an update with a CHANGED promptId keeps the ordinary epoch bump', async () => {
    const oldView = fakePlayerViewModel({game: fakeGameModel({gameAge: 1})});
    (oldView as any).waitingFor = {type: 'or', promptId: 41, options: []};
    const newView = fakePlayerViewModel({game: fakeGameModel({gameAge: 2})});
    (newView as any).waitingFor = {type: 'or', promptId: 42, options: []};
    const wrapper = shallowMount(App, globalConfig);
    await wrapper.setData({screen: 'player-home', playerView: oldView, playerkey: 7});
    (global as any).fetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(newView),
    });

    (wrapper.vm as any).update(paths.PLAYER);
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect((wrapper.vm as any).playerkey).to.eq(8);
  });
});
