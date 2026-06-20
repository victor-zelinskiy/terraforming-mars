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
import {hydroNetworkState, resetHydroPlan} from '@/client/components/hydronetwork/hydroNetworkState';
import {resolvePlayedCardsPick, cancelPlayedCardsPick, playedCardsPickState} from '@/client/components/playedCards/playedCardsPickState';
import {resolveActionsPick, cancelActionsPick, actionsPickState} from '@/client/components/actions/actionsPickState';

describe('PlayerHome', () => {
  let localStorage: FakeLocalStorage;

  beforeEach(() => {
    localStorage = new FakeLocalStorage();
    FakeLocalStorage.register(localStorage);
    resetStartGameFlow();
  });

  afterEach(() => {
    resetStartGameFlow();
    resetHydroPlan();
    cancelPlayedCardsPick();
    cancelActionsPick();
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

  // Helper: mount PlayerHome with a given view.
  function mountHome(view = fakePlayerViewModel()) {
    return shallowMount(PlayerHome, {
      ...globalConfig,
      parentComponent: {
        methods: {getVisibilityState: () => true, setVisibilityState: () => {}},
      } as any,
      props: {playerView: view, settings: raw_settings},
    });
  }

  it('Гидросеть pos-9 animal pick: focus returns to the overlay + the plan/card survive', async () => {
    resetHydroPlan();
    const wrapper = mountHome();
    const vm = wrapper.vm as any;
    // Open the Гидросеть overlay and stage a plan (target stage 9).
    await wrapper.setData({activeOverlay: 'hydronetwork'});
    hydroNetworkState.selectedPosition = 9;
    // Delegate to the РАЗЫГРАНО overlay pick.
    vm.onHydroPickPlayedCard({title: 'Choose a card for the animals', selectable: [CardName.BIRDS]});
    await vm.$nextTick();
    expect(vm.activeOverlay, 'switched to played').eq('played');
    // The plan + the await flag MUST survive leaving the hydro overlay (the bug
    // was resetHydroPlan wiping them).
    expect(hydroNetworkState.awaitingPick, 'await flag kept').eq('animal-target');
    expect(hydroNetworkState.selectedPosition, 'plan kept').eq(9);

    // The РАЗЫГРАНО overlay resolves the pick, then emits close (→ activeOverlay null).
    resolvePlayedCardsPick(CardName.BIRDS);
    vm.activeOverlay = null;
    await vm.$nextTick();
    await vm.$nextTick();

    expect(hydroNetworkState.selectedCard, 'chosen card recorded').eq(CardName.BIRDS);
    expect(hydroNetworkState.selectedPosition, 'plan still 9').eq(9);
    expect(vm.activeOverlay, 'focus returned to hydro').eq('hydronetwork');
    expect(playedCardsPickState.active, 'pick state cleared').is.false;
    wrapper.unmount();
  });

  it('Гидросеть pos-7 action pick: focus returns to the overlay after resolving', async () => {
    resetHydroPlan();
    const wrapper = mountHome();
    const vm = wrapper.vm as any;
    await wrapper.setData({activeOverlay: 'hydronetwork'});
    hydroNetworkState.selectedPosition = 7;
    vm.onHydroPickAction({title: 'Choose an action to repeat', selectable: [CardName.REGOLITH_EATERS]});
    await vm.$nextTick();
    expect(vm.activeOverlay).eq('actions');
    expect(hydroNetworkState.awaitingPick).eq('reuse-action');

    resolveActionsPick(CardName.REGOLITH_EATERS, 0);
    vm.activeOverlay = null;
    await vm.$nextTick();
    await vm.$nextTick();

    expect(hydroNetworkState.selectedCard).eq(CardName.REGOLITH_EATERS);
    expect(vm.activeOverlay).eq('hydronetwork');
    expect(actionsPickState.active).is.false;
    wrapper.unmount();
  });

  it('Гидросеть pick ABANDONED (overlay closed, no pick): focus still returns to hydro, no card', async () => {
    resetHydroPlan();
    const wrapper = mountHome();
    const vm = wrapper.vm as any;
    await wrapper.setData({activeOverlay: 'hydronetwork'});
    hydroNetworkState.selectedPosition = 9;
    vm.onHydroPickPlayedCard({title: 'Choose a card for the animals', selectable: [CardName.BIRDS]});
    await vm.$nextTick();
    // Abandon: close the РАЗЫГРАНО overlay WITHOUT resolving.
    vm.activeOverlay = null;
    await vm.$nextTick();
    await vm.$nextTick();

    expect(vm.activeOverlay, 'focus returned to hydro on abandon').eq('hydronetwork');
    expect(hydroNetworkState.selectedCard, 'no card chosen').is.undefined;
    expect(playedCardsPickState.active, 'pick cancelled').is.false;
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
