import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ActionsOverlay from '@/client/components/actions/ActionsOverlay.vue';
import {actionsPickState, enterActionsPick, exitActionsPick} from '@/client/components/actions/actionsPickState';
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

  it('is the FULL master-detail surface (pick strip + filters + details) and starts on Activated/All', async () => {
    enterActionsPick({
      title: 'Perform an action from a played card again',
      selectable: [CardName.REGOLITH_EATERS, CardName.SEARCH_FOR_LIFE],
      onResolve: () => { /* resolved via the details CTA below */ },
    });
    // Pick defaults: Activated + All (so already-used actions are shown).
    expect(actionsPickState.activation).eq('activated');
    expect(actionsPickState.availability).eq('all');
    const component = factory();
    // The pick strip + the SHARED filters + the details panel all render.
    expect(component.find('.actions-board__pickstrip').exists()).is.true;
    expect(component.find('.actions-filters').exists()).is.true;
    expect(component.find('.actions-board__detail').exists()).is.true;
    // One group per candidate action SOURCE.
    expect(component.find('[data-test="action-group-' + CardName.REGOLITH_EATERS + '"]').exists()).is.true;
    expect(component.find('[data-test="action-group-' + CardName.SEARCH_FOR_LIFE + '"]').exists()).is.true;
  });

  it('focusing a row + the «Select» CTA resolves the pick (close emitted)', async () => {
    enterActionsPick({
      title: 'Perform an action from a played card again',
      selectable: [CardName.REGOLITH_EATERS, CardName.SEARCH_FOR_LIFE],
      onResolve: () => { /* resolved via deliverActionRepeatPick in PlayerHome */ },
    });
    const component = factory();
    // Click a candidate row — this only FOCUSES it (no resolve yet).
    const row1 = component.find('[data-test="action-row-' + CardName.REGOLITH_EATERS + '-1"]');
    expect(row1.exists()).is.true;
    await row1.trigger('click');
    expect(actionsPickState.active).is.true; // focus only — not resolved

    // The details panel's CTA («ВЫБРАТЬ») resolves the pick + emits close.
    const cta = component.find('.actions-board__detail [data-test="action-detail-cta"]');
    expect(cta.exists()).is.true;
    await cta.trigger('click');
    expect(actionsPickState.active).is.false;
    expect(component.emitted('close')).is.not.undefined;
  });

  it('a non-candidate activated action stays visible but NOT selectable (inert + reason)', async () => {
    enterActionsPick({
      title: '',
      selectable: [CardName.REGOLITH_EATERS], // only Regolith Eaters is a candidate
      onResolve: () => { /* noop */ },
    });
    const component = factory();
    const inert = component.find('[data-test="action-group-' + CardName.SEARCH_FOR_LIFE + '"]');
    expect(inert.exists()).is.true; // shown for context
    expect(inert.classes()).to.include('action-group--pick-disabled');
  });
});
