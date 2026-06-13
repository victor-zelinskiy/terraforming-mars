import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ActionsOverlay from '@/client/components/actions/ActionsOverlay.vue';
import {actionsPickState, enterActionsPick, exitActionsPick} from '@/client/components/actions/actionsPickState';
import {actionRepeatPickResult} from '@/client/components/actions/actionRepeatPick';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';

function player(tableau: ReadonlyArray<CardName>): PublicPlayerModel {
  return {
    color: 'red',
    name: 'Tester',
    tableau: tableau.map((name) => ({name} as CardModel)),
    actionsThisGeneration: [...tableau],
  } as unknown as PublicPlayerModel;
}

function factory() {
  return mount(ActionsOverlay, {
    ...globalConfig,
    props: {
      displayedPlayer: player([CardName.REGOLITH_EATERS, CardName.SEARCH_FOR_LIFE]),
      viewerColor: 'red',
      viewerId: 'p-red',
      availableActionNames: [],
      previewCacheKey: 'red',
      awaitingInput: false,
      pickMode: true,
    },
  });
}

describe('ActionsOverlay pick-mode', () => {
  afterEach(() => exitActionsPick());

  it('renders the pick strip + a selectable group per candidate, and resolves a branch click', async () => {
    enterActionsPick({
      title: 'Perform an action from a played card again',
      selectable: [CardName.REGOLITH_EATERS, CardName.SEARCH_FOR_LIFE],
      onResolve: () => { /* resolved via deliverActionRepeatPick in PlayerHome; here just exits */ },
    });
    const component = factory();
    // The pick strip shows (the "choose an action to repeat" surface).
    expect(component.find('.actions-board__pickstrip').exists()).is.true;
    // One group per candidate action SOURCE.
    expect(component.find('[data-test="action-group-' + CardName.REGOLITH_EATERS + '"]').exists()).is.true;
    expect(component.find('[data-test="action-group-' + CardName.SEARCH_FOR_LIFE + '"]').exists()).is.true;

    // Regolith Eaters is a SPLIT action — its branch rows are individually clickable.
    const before = actionRepeatPickResult.epoch;
    const row1 = component.find('[data-test="action-row-' + CardName.REGOLITH_EATERS + '-1"]');
    expect(row1.exists()).is.true;
    await row1.trigger('click');
    // Resolving exits the pick state + emits `close` to the host (PlayerHome).
    expect(actionsPickState.active).is.false;
    expect(component.emitted('close')).is.not.undefined;
  });

  it('a non-candidate group is NOT selectable (inert)', async () => {
    enterActionsPick({
      title: '',
      selectable: [CardName.REGOLITH_EATERS], // only Regolith Eaters is a candidate
      onResolve: () => { /* noop */ },
    });
    const component = factory();
    const inert = component.find('[data-test="action-group-' + CardName.SEARCH_FOR_LIFE + '"]');
    expect(inert.classes()).to.include('action-group--pick-disabled');
  });
});
