import {flushPromises, shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {nextTick} from 'vue';
import {globalConfig} from './getLocalVue';
import GamesOverview from '@/client/components/GamesOverview.vue';
import GameOverview from '@/client/components/admin/GameOverview.vue';
import {APP_NAME} from '@/common/constants';

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

    // The component is `<script setup>` (step A of docs/claude/vapor/RECIPES.md): its state is refs, and the spec
    // writes them (RECIPES § 3) where it used to `setData`.
    (wrapper.vm as any).entries = [
      {id: 'game-1', game: undefined, status: 'loading'},
      {id: 'game-2', game: undefined, status: 'loading'},
      {id: 'game-3', game: undefined, status: 'loading'},
    ];
    (wrapper.vm as any).selectedGameIds = ['game-1', 'game-2'];
    await nextTick();

    await (wrapper.vm as any).bulkDeleteSelected();

    expect(calls).to.include('POST api/game/delete?serverId=&id=game-1');
    expect(calls).to.include('POST api/game/delete?serverId=&id=game-2');
    expect((wrapper.vm as any).entries.map((entry: {id: string}) => entry.id)).deep.eq(['game-3']);
    expect((wrapper.vm as any).selectedGameIds).deep.eq([]);
  });

  it('renders the title under the app\'s name, and — once the server listed games — the bulk bar and one row per game, following what the rows select', async () => {
    const empty = shallowMount(GamesOverview, {
      ...globalConfig,
    });
    await flushPromises();
    expect(empty.find('h1').text()).to.eq(`${APP_NAME} — Games Overview`);
    expect(empty.find('.games-overview-bulk-actions').exists(), 'no games — no bulk bar').to.eq(false);
    expect(empty.findAllComponents(GameOverview)).to.have.length(0);

    (global as any).fetch = (url: string) => Promise.resolve(url.startsWith('api/games') ?
      {ok: true, json: () => Promise.resolve([{gameId: 'game-1', participants: []}, {gameId: 'game-2', participants: []}])} :
      {ok: false, json: () => Promise.resolve({})});
    const wrapper = shallowMount(GamesOverview, {
      ...globalConfig,
    });
    await flushPromises();
    const rows = () => wrapper.findAllComponents(GameOverview);
    expect(rows().map((row) => [row.props('id'), row.props('status'), row.props('selectedForBulk')])).to.deep.eq([['game-1', 'error', false], ['game-2', 'error', false]]);
    const selectAll = wrapper.find<HTMLInputElement>('.games-overview-select-all input');
    const bulkDelete = wrapper.find('.games-overview-delete-btn--bulk');
    expect(bulkDelete.text()).to.eq('DELETE SELECTED');
    expect(bulkDelete.attributes('disabled'), 'nothing is selected').to.not.eq(undefined);

    rows()[1].vm.$emit('selection-changed', {id: 'game-2', selected: true});
    await nextTick();
    expect(bulkDelete.text()).to.eq('DELETE SELECTED (1)');
    expect(rows().map((row) => row.props('selectedForBulk'))).to.deep.eq([false, true]);
    expect(selectAll.element.checked, 'one of two').to.eq(false);

    await selectAll.setValue(true);
    expect(bulkDelete.text()).to.eq('DELETE SELECTED (2)');
    expect(rows().map((row) => row.props('selectedForBulk'))).to.deep.eq([true, true]);

    await wrapper.find('.games-overview-clear-btn').trigger('click');
    expect(bulkDelete.text()).to.eq('DELETE SELECTED');
    expect(rows().map((row) => row.props('selectedForBulk'))).to.deep.eq([false, false]);
  });
});
