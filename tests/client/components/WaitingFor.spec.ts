import {shallowMount} from '@vue/test-utils';
import {globalConfig} from './getLocalVue';
import {expect} from 'chai';
import WaitingFor from '@/client/components/WaitingFor.vue';
import {RecursivePartial} from '@/common/utils/utils';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {Phase} from '@/common/Phase';

describe('WaitingFor', () => {
  const thisPlayer: Partial<PublicPlayerModel> = {
    color: 'red',
  } as any;

  const playerView: RecursivePartial<PlayerViewModel> = {
    id: 'p-player-id',
    thisPlayer: thisPlayer as PublicPlayerModel,
    players: [thisPlayer as PublicPlayerModel],
    game: {
      phase: Phase.ACTION,
      gameAge: 1,
      undoCount: 0,
    },
  };

  it('renders the inline input factory for a non-modal prompt', () => {
    const wrapper = shallowMount(WaitingFor, {
      ...globalConfig,
      global: {
        ...globalConfig.global,
        stubs: {
          'player-input-factory': {template: '<div class="stub-pif"></div>'},
        },
      },
      props: {
        playerView: playerView as PlayerViewModel,
        players: [thisPlayer as PublicPlayerModel],
        // 'space' is NOT routed to the mandatory modal (it drives the
        // PlacementBanner instead), so it still renders the inline factory.
        waitingfor: {
          type: 'space',
          title: 'test',
          buttonLabel: 'save',
          spaces: [],
        },
      },
    });
    expect(wrapper.find('.stub-pif').exists()).to.be.true;
    expect(wrapper.text()).to.not.include('Not your turn');
  });

  it('routes a mandatory sub-prompt (option) to the mandatory modal', () => {
    const wrapper = shallowMount(WaitingFor, {
      ...globalConfig,
      global: {
        ...globalConfig.global,
        stubs: {
          'player-input-factory': {template: '<div class="stub-pif"></div>'},
        },
      },
      props: {
        playerView: playerView as PlayerViewModel,
        players: [thisPlayer as PublicPlayerModel],
        waitingfor: {
          type: 'option',
          title: 'test',
          buttonLabel: 'save',
        },
      },
    });
    // The 'option' sub-prompt is hosted by MandatoryInputModal now, not the
    // inline factory.
    expect(wrapper.findComponent({name: 'MandatoryInputModal'}).exists()).to.be.true;
    expect(wrapper.find('.stub-pif').exists()).to.be.false;
    expect(wrapper.text()).to.not.include('Not your turn');
  });

  it('shows "not your turn" when waitingfor is undefined', () => {
    const wrapper = shallowMount(WaitingFor, {
      ...globalConfig,
      global: {
        ...globalConfig.global,
        stubs: {
          'player-input-factory': true,
        },
      },
      props: {
        playerView: playerView as PlayerViewModel,
        players: [thisPlayer as PublicPlayerModel],
        waitingfor: undefined,
      },
    });
    expect(wrapper.text()).to.include('Not your turn');
  });
});
