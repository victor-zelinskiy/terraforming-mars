import {shallowMount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from './getLocalVue';
import PlayerHome from '@/client/components/PlayerHome.vue';
import {fakeGameModel, fakePlayerViewModel, fakePublicPlayerModel} from './testHelpers';
import {FakeLocalStorage} from './FakeLocalStorage';
import raw_settings from '@/genfiles/settings.json';
import {
  markStartFlowActivated,
  markStartFlowCompleted,
  resetStartGameFlow,
  startFlowHasFocusedSubAction,
} from '@/client/components/startGameFlow/startGameFlowState';
import {CardName} from '@/common/cards/CardName';
import {SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {ClaimedMilestoneModel} from '@/common/models/ClaimedMilestoneModel';

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

  it('builds standard-project payment previews from current tableau resources', () => {
    const standardProjectInput: SelectProjectCardToPlayModel = {
      type: 'projectCard',
      title: 'Standard projects',
      buttonLabel: 'Play card',
      cards: [{
        name: CardName.AQUIFER_STANDARD_PROJECT,
        calculatedCost: 18,
        standardProjectCanPayWith: {kuiperAsteroids: true},
      }],
      paymentOptions: {},
      microbes: 0,
      floaters: 0,
      lunaArchivesScience: 0,
      seeds: 0,
      graphene: 0,
      kuiperAsteroids: 0,
      auroraiData: 0,
      spireScience: 0,
    };
    const thisPlayer = fakePublicPlayerModel({
      megacredits: 16,
      tableau: [{name: CardName.KUIPER_COOPERATIVE, resources: 2}],
    });
    const view = fakePlayerViewModel({
      thisPlayer,
      players: [thisPlayer],
      waitingFor: standardProjectInput,
    });

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

    (wrapper.vm as any).onUseStandardProject(CardName.AQUIFER_STANDARD_PROJECT);

    const pending = (wrapper.vm as any).pendingStdProjectPayment;
    expect(pending).not.undefined;
    expect(pending.input.paymentOptions.kuiperAsteroids).eq(true);
    expect(pending.input.kuiperAsteroids).eq(2);

    wrapper.unmount();
  });

  it('updates an already-open milestones overlay when another player claims a milestone', async () => {
    const unclaimed: ClaimedMilestoneModel = {
      name: 'Terraformer',
      playerName: undefined,
      color: undefined,
      scores: [{color: 'blue' as any, score: 20}],
      threshold: 35,
    };
    const claimed: ClaimedMilestoneModel = {
      ...unclaimed,
      playerName: 'red',
      color: 'red' as any,
    };
    const view = fakePlayerViewModel({
      game: fakeGameModel({milestones: [unclaimed]}),
    });
    const updatedView = fakePlayerViewModel({
      game: fakeGameModel({milestones: [claimed]}),
    });

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
    await wrapper.setData({activeOverlay: 'milestones'});

    let overlay = wrapper.findComponent({name: 'MilestonesOverlay'});
    expect(overlay.exists()).to.be.true;
    expect((overlay.props('milestones') as Array<ClaimedMilestoneModel>)[0].playerName).eq(undefined);

    await wrapper.setProps({playerView: updatedView});
    await wrapper.vm.$nextTick();

    overlay = wrapper.findComponent({name: 'MilestonesOverlay'});
    expect(overlay.exists()).to.be.true;
    expect((overlay.props('milestones') as Array<ClaimedMilestoneModel>)[0].playerName).eq('red');
    expect((wrapper.vm as any).activeOverlay).eq('milestones');

    wrapper.unmount();
  });
});
