import {flushPromises, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import LoadGameForm from '@/client/components/LoadGameForm.vue';
import AppButton from '@/client/components/common/AppButton.vue';
import {APP_ROOT} from '@/client/components/appRoot';

type FetchHolder = {fetch: unknown};

describe('LoadGameForm', () => {
  let originalFetch: unknown;
  let originalReplaceState: History['replaceState'];
  let replaced: Array<string>;

  beforeEach(() => {
    originalFetch = (globalThis as unknown as FetchHolder).fetch;
    // jsdom's page has an opaque URL: a relative `replaceState` throws there — record the call instead
    originalReplaceState = window.history.replaceState;
    replaced = [];
    window.history.replaceState = (_data: unknown, _unused: string, url?: string | URL | null) => {
      replaced.push(String(url));
    };
  });

  afterEach(() => {
    (globalThis as unknown as FetchHolder).fetch = originalFetch;
    window.history.replaceState = originalReplaceState;
  });

  /** The slice of the app root's port the form writes: the loaded game and the screen it lands on. */
  function fakeRoot() {
    return {game: undefined as unknown, screen: 'load'};
  }

  function mountForm(root?: ReturnType<typeof fakeRoot>) {
    return shallowMount(LoadGameForm, {
      ...globalConfig,
      global: {
        ...globalConfig.global,
        provide: root === undefined ? {} : {[APP_ROOT as symbol]: root},
      },
    });
  }

  it('mounts without errors', () => {
    const wrapper = mountForm(fakeRoot());
    expect(wrapper.exists()).to.be.true;
    expect(wrapper.findComponent(AppButton).props('title')).to.eq('Load Game');
  });

  it('a loaded game with several players is handed to the app root, which lands on its screen', async () => {
    const response = {id: 'g-loaded', players: [{id: 'p-one'}, {id: 'p-two'}]};
    const calls: Array<{url: string, body: string}> = [];
    (globalThis as unknown as FetchHolder).fetch = (url: string, init: {body: string}) => {
      calls.push({url, body: init.body});
      return Promise.resolve({ok: true, json: () => Promise.resolve(response)});
    };
    const root = fakeRoot();
    const wrapper = mountForm(root);

    await wrapper.find('input.load-game-id').setValue('g-loaded');
    wrapper.findComponent(AppButton).vm.$emit('click');
    await flushPromises();

    expect(calls).to.have.length(1);
    expect(JSON.parse(calls[0].body)).to.deep.eq({gameId: 'g-loaded', rollbackCount: 0});
    expect(replaced).to.deep.eq(['game?id=g-loaded']);
    expect(root.game).to.deep.eq(response);
    expect(root.screen).to.eq('game-home');
  });

  it('stands with no root above it: the load still asks the server and nothing throws', async () => {
    const response = {id: 'g-loaded', players: [{id: 'p-one'}, {id: 'p-two'}]};
    (globalThis as unknown as FetchHolder).fetch = () => Promise.resolve({ok: true, json: () => Promise.resolve(response)});
    const wrapper = mountForm();

    await wrapper.find('input.load-game-id').setValue('g-loaded');
    wrapper.findComponent(AppButton).vm.$emit('click');
    await flushPromises();

    expect(replaced).to.deep.eq(['game?id=g-loaded']);
  });
});
