import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import PlayerHome from '@/client/components/PlayerHome.vue';
import {fakePlayerViewModel} from './testHelpers';
import {FakeLocalStorage} from './FakeLocalStorage';
import raw_settings from '@/genfiles/settings.json';
import {
  markStartFlowActivated,
  markStartFlowCompleted,
  resetStartGameFlow,
} from '@/client/components/startGameFlow/startGameFlowState';

describe('PlayerHome', () => {
  let localStorage: FakeLocalStorage;

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    FakeLocalStorage.register(localStorage);
    resetStartGameFlow();
  });

  afterEach(() => {
    resetStartGameFlow();
    document.body.classList.remove('start-game-flow-action-locked');
    document.body.classList.remove('placement-pending');
    document.querySelectorAll('[data-placement-orig-title]').forEach((el) => {
      el.removeAttribute('data-placement-orig-title');
      el.removeAttribute('title');
    });
    document.querySelectorAll('.action-lock-floating-tooltip').forEach((el) => el.remove());
    FakeLocalStorage.deregister(localStorage);
  });

  it('mounts without errors', () => {
    const wrapper = shallowMount(PlayerHome, {
      ...globalConfig,
      parentComponent: {
        methods: {
          getVisibilityState: () => true,
          setVisibilityState: () => {},
        },
      } as any,
      props: {
        playerView: fakePlayerViewModel(),
        settings: raw_settings,
      },
    });
    expect(wrapper.exists()).to.be.true;
  });

  it('locks action buttons until the start-game begin CTA is confirmed', async () => {
    const view = fakePlayerViewModel();
    markStartFlowActivated(view.id);

    const actionButton = document.createElement('button');
    actionButton.className = 'left-panel-card-action-btn';
    document.body.appendChild(actionButton);

    const wrapper = shallowMount(PlayerHome, {
      ...globalConfig,
      parentComponent: {
        methods: {
          getVisibilityState: () => true,
          setVisibilityState: () => {},
        },
      } as any,
      props: {
        playerView: view,
        settings: raw_settings,
      },
    });

    expect(document.body.classList.contains('start-game-flow-action-locked')).to.be.true;
    expect(actionButton.getAttribute('title')).to.eq('Finish your current action first');
    expect(actionButton.hasAttribute('data-hint')).to.be.false;

    actionButton.dispatchEvent(new window.MouseEvent('mouseover', {bubbles: true}));
    await wrapper.vm.$nextTick();
    expect((wrapper.vm as any).actionLockTooltipText).to.eq('Finish your current action first');

    markStartFlowCompleted(view.id);
    await wrapper.vm.$nextTick();

    expect(document.body.classList.contains('start-game-flow-action-locked')).to.be.false;
    expect((wrapper.vm as any).actionLockTooltipText).to.eq('');
    expect(actionButton.hasAttribute('title')).to.be.false;
    expect(actionButton.hasAttribute('data-hint')).to.be.false;

    wrapper.unmount();
    actionButton.remove();
  });
});
