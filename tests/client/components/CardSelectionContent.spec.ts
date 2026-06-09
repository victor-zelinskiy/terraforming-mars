import {mount} from '@vue/test-utils';
import {globalConfig} from './getLocalVue';
import {expect} from 'chai';
import CardSelectionContent from '@/client/components/CardSelectionContent.vue';
import {SelectCardResponse} from '@/common/inputs/InputResponse';

// Stub the heavy <Card> / <CardZoomModal> so the test is about the picker's
// filter + disabled logic, not card rendering.
const CardStub = {name: 'Card', props: ['card'], template: '<div class="card-stub">{{ card.name }}</div>'};

function factory(playerinput: any, onsave: (out: SelectCardResponse) => void = () => {}) {
  return mount(CardSelectionContent, {
    ...globalConfig,
    global: {
      ...globalConfig.global,
      stubs: {Card: CardStub, CardZoomModal: true},
    },
    props: {
      playerView: {game: {phase: 'action'}, thisPlayer: {cardCost: 3, megacredits: 30}} as any,
      playerinput,
      onsave,
    },
  });
}

describe('CardSelectionContent — availability filter', () => {
  it('shows no filter when there are no disabled candidates', () => {
    const component = factory({
      type: 'card', title: 'Select a card', min: 1, max: 1,
      cards: [{name: 'Ants'}, {name: 'Predators'}],
    });
    expect(component.find('.card-selection__filter').exists()).to.eq(false);
    expect(component.find('[data-test="card-selection-Ants"]').exists()).to.eq(true);
  });

  it('shows the filter (default Available) when disabled candidates exist, and reveals them with a reason', async () => {
    const component = factory({
      type: 'card', title: 'Select card to remove a microbe from', min: 1, max: 1,
      cards: [{name: 'Ants'}],
      disabledCards: [{name: 'Predators', isDisabled: true, disabledReason: 'No resources on this card'}],
    });
    // Filter renders; default 'available' hides the disabled card.
    expect(component.find('.card-selection__filter').exists()).to.eq(true);
    expect(component.find('[data-test="card-selection-Ants"]').exists()).to.eq(true);
    expect(component.find('[data-test="card-selection-Predators"]').exists()).to.eq(false);

    // Switch to 'all' → the disabled card appears with a reason chip and no
    // action button.
    await component.find('[data-test="card-selection-filter-all"]').trigger('click');
    const disabledSlot = component.find('[data-test="card-selection-Predators"]');
    expect(disabledSlot.exists()).to.eq(true);
    const reason = component.find('[data-test="card-selection-reason-Predators"]');
    expect(reason.exists()).to.eq(true);
    expect(reason.text()).to.include('No resources on this card');
    expect(disabledSlot.find('[data-test="card-selection-action"]').exists()).to.eq(false);

    // 'unavailable' shows ONLY the disabled card.
    await component.find('[data-test="card-selection-filter-unavailable"]').trigger('click');
    expect(component.find('[data-test="card-selection-Ants"]').exists()).to.eq(false);
    expect(component.find('[data-test="card-selection-Predators"]').exists()).to.eq(true);
  });

  it('applies the hard single-row class (flex nowrap) for 1–4 cards', () => {
    for (const count of [1, 2, 3, 4]) {
      const component = factory({
        type: 'card', title: 'Select a card', min: 0, max: count,
        cards: Array.from({length: count}, (_, i) => ({name: 'Ants' + i})),
      });
      expect(
        component.find('.card-selection__cards').classes(),
        `${count} cards must be a single-row layout`,
      ).to.include('card-selection__cards--single-row');
    }
  });

  it('does NOT force a single row for 5+ cards', () => {
    const component = factory({
      type: 'card', title: 'Select a card', min: 0, max: 5,
      cards: Array.from({length: 5}, (_, i) => ({name: 'Ants' + i})),
    });
    expect(component.find('.card-selection__cards').classes())
      .to.not.include('card-selection__cards--single-row');
  });

  it('commits only a selectable card', async () => {
    let saved: SelectCardResponse | undefined;
    const component = factory({
      type: 'card', title: 'Select card to remove a microbe from', min: 1, max: 1,
      cards: [{name: 'Ants'}],
      disabledCards: [{name: 'Predators', isDisabled: true, disabledReason: 'No resources on this card'}],
    }, (out) => {
      saved = out;
    });
    await component.find('[data-test="card-selection-Ants"] [data-test="card-selection-action"]').trigger('click');
    expect(saved).to.deep.eq({type: 'card', cards: ['Ants']});
  });
});

describe('CardSelectionContent — single-select action label', () => {
  // A nested action-card pick (add asteroid / discard / remove resource) surfaces
  // the server's verb on the per-card button — the SAME verb the legacy SelectCard
  // submit button showed — instead of a generic "Select".
  for (const buttonLabel of ['Add asteroid', 'Add microbes', 'Discard', 'Remove resource(s)']) {
    it(`surfaces the server verb "${buttonLabel}" on the per-card button`, () => {
      const component = factory({
        type: 'card', title: 'Pick a card', buttonLabel, min: 1, max: 1,
        cards: [{name: 'Ants'}],
      });
      expect(component.find('[data-test="card-selection-action"]').text()).to.eq(buttonLabel);
    });
  }

  // A meaningless / generic buttonLabel ('Save' is the SelectCard default,
  // 'Select' is already generic) falls back to "Select" so a plain card pick
  // (Robotic Workforce copy) reads consistently.
  for (const buttonLabel of ['Save', 'Select', 'Ok', '']) {
    it(`falls back to "Select" for the generic buttonLabel "${buttonLabel}"`, () => {
      const component = factory({
        type: 'card', title: 'Pick a card', buttonLabel, min: 1, max: 1,
        cards: [{name: 'Ants'}],
      });
      expect(component.find('[data-test="card-selection-action"]').text()).to.eq('Select');
    });
  }

  // A draft pick (buttonLabel 'Keep' during DRAFTING) keeps the generic
  // "Select" rather than surfacing the verb — draft is a distinct polished flow
  // where label consistency wins over the per-action verb.
  it('keeps "Select" for a draft-phase pick even with a meaningful buttonLabel', () => {
    const component = mount(CardSelectionContent, {
      ...globalConfig,
      global: {...globalConfig.global, stubs: {Card: CardStub, CardZoomModal: true}},
      props: {
        playerView: {game: {phase: 'drafting'}, thisPlayer: {cardCost: 3, megacredits: 30}} as any,
        playerinput: {type: 'card', title: 'Choose a card', buttonLabel: 'Keep', min: 1, max: 1, cards: [{name: 'Ants'}]},
        onsave: () => {},
      },
    });
    expect(component.find('[data-test="card-selection-action"]').text()).to.eq('Select');
  });
});
