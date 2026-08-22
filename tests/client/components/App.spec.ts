import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import App from '@/client/components/App.vue';
import {fakeGameModel, fakePlayerViewModel} from './testHelpers';
import {paths} from '@/common/app/paths';

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('App', () => {
  let originalFetch: unknown;

  beforeEach(() => {
    originalFetch = (global as any).fetch;
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
  });

  it('mounts without errors', () => {
    const wrapper = shallowMount(App, globalConfig);
    expect(wrapper.exists()).to.be.true;
  });

  // Desktop-removal wave 1: the desktop overlay-preserve path
  // (playerHomeHasOpenOverlay) is gone — a poll refresh always applies the
  // fresh view reactively and bumps the reset epoch.
  it('a poll refresh applies the view reactively and bumps the reset epoch', async () => {
    const oldView = fakePlayerViewModel({game: fakeGameModel({gameAge: 1})});
    const newView = fakePlayerViewModel({game: fakeGameModel({gameAge: 2})});
    const wrapper = shallowMount(App, globalConfig);
    await wrapper.setData({
      screen: 'player-home',
      playerView: oldView,
      playerkey: 7,
    });
    (global as any).fetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(newView),
    });

    (wrapper.vm as any).update(paths.PLAYER);
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect((wrapper.vm as any).playerView.game.gameAge).eq(2);
    expect((wrapper.vm as any).playerkey).eq(8);
  });
});
