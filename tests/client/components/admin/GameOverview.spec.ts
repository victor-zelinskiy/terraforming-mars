import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import GameOverview from '@/client/components/admin/GameOverview.vue';
import {fakeGameModel} from '../testHelpers';

describe('GameOverview', () => {
  it('mounts without errors', () => {
    const wrapper = shallowMount(GameOverview, {
      ...globalConfig,
      props: {
        status: 'loading',
        game: fakeGameModel(),
        id: 'game-123',
        serverId: 'server-123',
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('emits selection changes', async () => {
    const wrapper = shallowMount(GameOverview, {
      ...globalConfig,
      props: {
        status: 'loading',
        game: fakeGameModel(),
        id: 'game-123',
        serverId: 'server-123',
      },
    });

    await wrapper.find('.games-overview-select').setValue(true);

    expect(wrapper.emitted('selection-changed')?.[0]).deep.eq([{id: 'game-123', selected: true}]);
  });
});
