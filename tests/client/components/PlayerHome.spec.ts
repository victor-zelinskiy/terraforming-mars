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
  startFlowHasFocusedSubAction,
} from '@/client/components/startGameFlow/startGameFlowState';
import {CardName} from '@/common/cards/CardName';

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

  it('locks regular actions after startup work is done until the begin CTA is confirmed', async () => {
    const view = fakePlayerViewModel({
      waitingFor: {type: 'or', title: 'Take your first action', options: []} as any,
    });
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

    wrapper.unmount();
    actionButton.remove();
  });

  it('does not lock a focused play-card prompt spawned by startup effects', async () => {
    const view = fakePlayerViewModel({
      cardsInHand: [{name: CardName.ACQUIRED_COMPANY}] as any,
      waitingFor: {
        type: 'projectCard',
        title: 'Select a card to play',
        cards: [{name: CardName.ACQUIRED_COMPANY}],
      } as any,
    });
    markStartFlowActivated(view.id);

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
    await wrapper.vm.$nextTick();

    expect(startFlowHasFocusedSubAction(view), 'focused sub-action predicate').to.be.true;
    expect((wrapper.vm as any).startGameFlowActionLocked, 'computed lock').to.be.false;
    expect((wrapper.vm as any).placementPending, 'placement pending').to.be.false;
    expect((wrapper.vm as any).actionUiLocked, 'action ui lock').to.be.false;
    expect(document.body.classList.contains('start-game-flow-action-locked'), 'body class').to.be.false;
    expect((wrapper.vm as any).playProjectCardActionAvailable, 'play action availability').to.be.true;

    (wrapper.vm as any).onPlayHandCard(CardName.ACQUIRED_COMPANY);

    expect((wrapper.vm as any).pendingPlayCard?.cardName).to.eq(CardName.ACQUIRED_COMPANY);

    wrapper.unmount();
  });
});
