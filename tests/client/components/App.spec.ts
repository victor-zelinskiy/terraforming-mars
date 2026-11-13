import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import App from '@/client/components/App.vue';
import {fakeGameModel, fakePlayerViewModel} from './testHelpers';
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

    expect(root.playerView?.game.gameAge).eq(2);
    expect(root.playerkey).eq(8);
  });
});
