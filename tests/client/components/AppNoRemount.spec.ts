/*
 * Phase-1 guards for the no-remount update model
 * (REMOUNT_ANIMATION_REWORK_DESIGN.md).
 *
 * The game subtree is no longer keyed on `playerkey`: an update applies the
 * fresh playerView reactively and `playerkey` acts as the transient-UI reset
 * epoch. These specs pin the three contracts:
 *   1. <player-home> is NOT recreated by an update (same DOM element),
 *      while `playerkey` still bumps where it used to (the reset signal).
 *   2. The `tm_remount` rollback flag restores the legacy keyed remount.
 *   3. PlayerHome's resetEpoch watcher reproduces the remount's implicit
 *      transient-UI reset (close overlays / pending modals) and the
 *      mounted()-parity re-arm (actions overlay survives via module state).
 */
import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import App from '@/client/components/App.vue';
import PlayerHome from '@/client/components/PlayerHome.vue';
import {fakeGameModel, fakePlayerViewModel} from './testHelpers';
import {FakeLocalStorage} from './FakeLocalStorage';
import raw_settings from '@/genfiles/settings.json';
import {paths} from '@/common/app/paths';
import {legacyRemountEnabled, __resetLegacyRemountForTesting} from '@/client/utils/legacyRemount';
import {actionsOverlayState, resetActionsOverlay} from '@/client/components/actions/actionsOverlayState';

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function mountPlayerHome(view = fakePlayerViewModel(), resetEpoch = 0) {
  return shallowMount(PlayerHome, {
    ...globalConfig,
    parentComponent: {
      methods: {
        getVisibilityState: () => true,
        setVisibilityState: () => {},
      },
    } as any,
    props: {
      playerView: view,
      resetEpoch,
      settings: raw_settings,
    },
  });
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
    resetActionsOverlay();
    actionsOverlayState.open = false;
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

  it('an update keeps the SAME player-home element while bumping the reset epoch', async () => {
    const oldView = fakePlayerViewModel({game: fakeGameModel({gameAge: 1})});
    const newView = fakePlayerViewModel({game: fakeGameModel({gameAge: 2})});
    const wrapper = shallowMount(App, globalConfig);
    await wrapper.setData({screen: 'player-home', playerView: oldView, playerkey: 7});
    (wrapper.vm as any).playerHomeHasOpenOverlay = () => false;
    (global as any).fetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(newView),
    });

    const before = wrapper.findComponent({name: 'player-home'});
    expect(before.exists()).to.be.true;
    const beforeEl = before.element;

    (wrapper.vm as any).update(paths.PLAYER);
    await flushPromises();
    await wrapper.vm.$nextTick();

    // The reset epoch advanced (the old remount trigger still signals)…
    expect((wrapper.vm as any).playerkey).to.eq(8);
    // …but the subtree was NOT recreated: same component instance / element.
    const after = wrapper.findComponent({name: 'player-home'});
    expect(after.element).to.eq(beforeEl);
  });

  it('the rollback flag restores the legacy keyed remount', async () => {
    localStorage.setItem('tm_remount', '1');
    __resetLegacyRemountForTesting();

    const oldView = fakePlayerViewModel({game: fakeGameModel({gameAge: 1})});
    const newView = fakePlayerViewModel({game: fakeGameModel({gameAge: 2})});
    const wrapper = shallowMount(App, globalConfig);
    await wrapper.setData({screen: 'player-home', playerView: oldView, playerkey: 7});
    (wrapper.vm as any).playerHomeHasOpenOverlay = () => false;
    (global as any).fetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(newView),
    });

    const beforeEl = wrapper.findComponent({name: 'player-home'}).element;

    (wrapper.vm as any).update(paths.PLAYER);
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect((wrapper.vm as any).playerkey).to.eq(8);
    const after = wrapper.findComponent({name: 'player-home'});
    expect(after.element).to.not.eq(beforeEl);
  });

  it('resetEpoch resets the transient UI exactly like the old remount', async () => {
    const wrapper = mountPlayerHome();
    await wrapper.setData({
      activeOverlay: 'victoryPoints',
      passConfirmOpen: true,
      convertHeatConfirmOpen: true,
      convertPlantsPickerActive: true,
      coloniesOverlayOpen: true,
      coloniesOverlayManualOpen: true,
    });

    await wrapper.setProps({resetEpoch: 1});
    await wrapper.vm.$nextTick();

    const vm = wrapper.vm as any;
    expect(vm.activeOverlay).to.eq(null);
    expect(vm.passConfirmOpen).to.be.false;
    expect(vm.convertHeatConfirmOpen).to.be.false;
    expect(vm.convertPlantsPickerActive).to.be.false;
    expect(vm.coloniesOverlayOpen).to.be.false;
    expect(vm.coloniesOverlayManualOpen).to.be.false;
    expect(vm.pendingPlayCard).to.eq(undefined);
    expect(vm.pendingCardAction).to.eq(undefined);
    expect(vm.pendingStdProjectPayment).to.eq(undefined);
    wrapper.unmount();
  });

  it('resetEpoch re-arms the actions overlay from module state (remount parity)', async () => {
    const wrapper = mountPlayerHome();
    await wrapper.setData({activeOverlay: 'actions'});
    expect(actionsOverlayState.open).to.be.true;

    await wrapper.setProps({resetEpoch: 1});
    await wrapper.vm.$nextTick();

    // The actions overlay deliberately SURVIVES the reset — the legacy
    // remount used to re-open it from actionsOverlayState in mounted().
    expect((wrapper.vm as any).activeOverlay).to.eq('actions');
    expect(actionsOverlayState.open).to.be.true;
    wrapper.unmount();
  });
});
