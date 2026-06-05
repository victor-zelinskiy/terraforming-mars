import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import GamesOverview from '@/client/components/GamesOverview.vue';

describe('GamesOverview', () => {
  let originalFetch: any;
  let originalConfirm: any;
  let originalAlert: any;

  beforeEach(() => {
    originalFetch = (global as any).fetch;
    originalConfirm = (global as any).confirm;
    originalAlert = (global as any).alert;
    (global as any).fetch = () => Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    });
    (global as any).confirm = () => true;
    (global as any).alert = () => {};
  });

  afterEach(() => {
    (global as any).fetch = originalFetch;
    (global as any).confirm = originalConfirm;
    (global as any).alert = originalAlert;
  });

  it('mounts without errors', () => {
    const wrapper = shallowMount(GamesOverview, {
      ...globalConfig,
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('bulk deletes selected games', async () => {
    const calls: Array<string> = [];
    (global as any).fetch = (url: string, options?: {method?: string}) => {
      if (url.startsWith('api/games')) {
        return new Promise(() => {});
      }
      calls.push(`${options?.method ?? 'GET'} ${url}`);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve([]),
      });
    };

    const wrapper = shallowMount(GamesOverview, {
      ...globalConfig,
    });

    await wrapper.setData({
      entries: [
        {id: 'game-1', game: undefined, status: 'loading'},
        {id: 'game-2', game: undefined, status: 'loading'},
        {id: 'game-3', game: undefined, status: 'loading'},
      ],
      selectedGameIds: ['game-1', 'game-2'],
    });

    await (wrapper.vm as any).bulkDeleteSelected();

    expect(calls).to.include('POST api/game/delete?serverId=&id=game-1');
    expect(calls).to.include('POST api/game/delete?serverId=&id=game-2');
    expect((wrapper.vm as any).entries.map((entry: {id: string}) => entry.id)).deep.eq(['game-3']);
    expect((wrapper.vm as any).selectedGameIds).deep.eq([]);
  });
});
