import {shallowMount} from '@vue/test-utils';
import {globalConfig} from './getLocalVue';
import {expect} from 'chai';
import WaitingFor from '@/client/components/WaitingFor.vue';
import {RecursivePartial} from '@/common/utils/utils';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {Phase} from '@/common/Phase';
import {setConsolePlacementHeld} from '@/client/console/consolePromptAdmission';

/*
 * HEADLESS TRANSPORT guards (desktop-removal wave 2). The radio UI is gone —
 * WaitingFor renders exactly ONE thing: the SelectSpace board binder for a
 * top-level `space` prompt (its mounted() attaches the console board's cell
 * handlers). Everything else it does is script (poll / submit / view apply),
 * covered by the e2e probe's ingest cycles. These specs pin the render
 * contract: binder for `space`, nothing for anything else, and the console
 * placement-admission hold blanks the binder.
 */
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

  function mountFor(waitingfor: unknown) {
    return shallowMount(WaitingFor, {
      ...globalConfig,
      global: {
        ...globalConfig.global,
        stubs: {
          SelectSpace: {template: '<div class="stub-select-space"></div>'},
        },
      },
      props: {
        playerView: playerView as PlayerViewModel,
        waitingfor,
      },
    });
  }

  afterEach(() => {
    // Module state is BUNDLE-SHARED — leave the admission mirror clean.
    setConsolePlacementHeld(false);
  });

  it('mounts the SelectSpace board binder for a top-level space prompt', () => {
    const wrapper = mountFor({type: 'space', title: 'test', buttonLabel: 'save', spaces: []});
    expect(wrapper.find('.stub-select-space').exists()).to.be.true;
  });

  it('renders NOTHING for any non-space prompt (the console serves it natively)', () => {
    for (const waitingfor of [
      {type: 'option', title: 'test', buttonLabel: 'save'},
      {type: 'or', title: 'test', buttonLabel: 'save', options: []},
      {type: 'projectCard', title: 'test', buttonLabel: 'save', cards: []},
      undefined,
    ]) {
      const wrapper = mountFor(waitingfor);
      expect(wrapper.find('.stub-select-space').exists(), JSON.stringify(waitingfor)).to.be.false;
      expect(wrapper.text().trim(), JSON.stringify(waitingfor)).to.eq('');
    }
  });

  it('the console placement-admission hold blanks the binder (same window as the holds)', async () => {
    setConsolePlacementHeld(true);
    const wrapper = mountFor({type: 'space', title: 'test', buttonLabel: 'save', spaces: []});
    expect(wrapper.find('.stub-select-space').exists()).to.be.false;
    setConsolePlacementHeld(false);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.stub-select-space').exists()).to.be.true;
  });
});
