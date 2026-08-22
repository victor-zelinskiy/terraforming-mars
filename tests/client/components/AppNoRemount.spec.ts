/*
 * Guards for the no-remount update model
 * (docs/REMOUNT_ANIMATION_REWORK_DESIGN.md).
 *
 * The game subtree is no longer keyed on `playerkey`: an update applies the
 * fresh playerView reactively and `playerkey` acts as the transient-UI reset
 * epoch. Desktop-removal wave 2 deleted `PlayerHome`, so the game subtree is
 * <ConsoleShell> and the contracts left to pin are App-level:
 *   1. `playerHomeKey` is constant unless the `tm_remount` rollback flag
 *      restores the legacy keyed value (nothing keys the shell on it anymore).
 *   2. An update keeps the SAME shell DOM element while `playerkey` still
 *      bumps where it used to (the reset-epoch signal).
 *   3. Even under the rollback flag the shell is never recreated — the ladder
 *      only ever keyed the deleted <player-home>.
 */
import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import App from '@/client/components/App.vue';
import {fakeGameModel, fakePlayerViewModel} from './testHelpers';
import {FakeLocalStorage} from './FakeLocalStorage';
import {paths} from '@/common/app/paths';
import {legacyRemountEnabled, __resetLegacyRemountForTesting} from '@/client/utils/legacyRemount';

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
    __resetLegacyRemountForTesting();
    originalFetch = (global as any).fetch;
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
    __resetLegacyRemountForTesting();
    FakeLocalStorage.deregister(localStorage);
  });

  it('playerHomeKey is constant by default and follows playerkey under the rollback flag', async () => {
    const wrapper = shallowMount(App, globalConfig);
    await wrapper.setData({playerkey: 5});
    expect((wrapper.vm as any).playerHomeKey).to.eq('stable');

    localStorage.setItem('tm_remount', '1');
    __resetLegacyRemountForTesting();
    expect(legacyRemountEnabled()).to.be.true;
    // Computed caches don't matter here — re-read through a fresh mount.
    const legacyWrapper = shallowMount(App, globalConfig);
    await legacyWrapper.setData({playerkey: 5});
    expect((legacyWrapper.vm as any).playerHomeKey).to.eq(5);
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

  it('the legacy remount flag can no longer recreate the game subtree (no keyed shell)', async () => {
    localStorage.setItem('tm_remount', '1');
    __resetLegacyRemountForTesting();

    const oldView = fakePlayerViewModel({game: fakeGameModel({gameAge: 1})});
    const newView = fakePlayerViewModel({game: fakeGameModel({gameAge: 2})});
    const wrapper = shallowMount(App, globalConfig);
    await wrapper.setData({screen: 'player-home', playerView: oldView, playerkey: 7});
    (global as any).fetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(newView),
    });

    const beforeEl = wrapper.find('console-shell-stub').element;

    (wrapper.vm as any).update(paths.PLAYER);
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect((wrapper.vm as any).playerkey).to.eq(8);
    // ConsoleShell carries no :key — the desktop-era rollback ladder only
    // ever keyed the deleted <player-home>.
    expect(wrapper.find('console-shell-stub').element).to.eq(beforeEl);
  });
});
