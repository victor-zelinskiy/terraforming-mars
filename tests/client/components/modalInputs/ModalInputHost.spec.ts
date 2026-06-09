import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ModalInputHost from '@/client/components/modalInputs/ModalInputHost.vue';
import CardSelectionContent from '@/client/components/CardSelectionContent.vue';

// Heavy descendants of the premium card grid — stub them so the test is about
// ModalInputHost's ROUTING decision, not card rendering / the fit engine.
const CardStub = {name: 'Card', props: ['card'], template: '<div class="card-stub">{{ card.name }}</div>'};

// Stand-in for the legacy fallback (`<player-input-factory>`). If a card input
// EVER reaches this, the premium routing regressed and the player would see the
// legacy SelectCard radio/checkbox list again.
const FactoryStub = {
  name: 'player-input-factory',
  props: ['playerView', 'playerinput', 'onsave', 'showsave', 'showtitle'],
  template: '<div class="legacy-factory-stub"></div>',
};

function factory(playerinput: any) {
  return mount(ModalInputHost, {
    ...globalConfig,
    global: {
      ...globalConfig.global,
      stubs: {Card: CardStub, CardZoomModal: true, PlayerInputFactory: FactoryStub},
    },
    props: {
      playerView: {
        game: {phase: 'action'},
        thisPlayer: {cardCost: 3, megacredits: 30},
        players: [],
      } as any,
      playerinput,
      onsave: () => {},
    },
  });
}

describe('ModalInputHost — premium routing', () => {
  it('routes a nested SelectCard (type "card") to the premium CardSelectionContent, NOT the legacy factory', () => {
    const component = factory({
      type: 'card',
      title: 'Select card to add 1 asteroid',
      buttonLabel: 'Add asteroid',
      min: 1,
      max: 1,
      cards: [{name: 'Astrodrill'}, {name: 'Comet Aiming'}],
    });
    expect(component.findComponent(CardSelectionContent).exists()).to.eq(true);
    // The legacy SelectCard list (purple "Добавить астероид" button) must NOT
    // render for a card prompt anymore.
    expect(component.find('.legacy-factory-stub').exists()).to.eq(false);
  });

  it('still falls back to the legacy factory for a type with no premium component', () => {
    const component = factory({
      type: 'colony',
      title: 'Select colony',
      coloniesModel: [],
    });
    expect(component.find('.legacy-factory-stub').exists()).to.eq(true);
    expect(component.findComponent(CardSelectionContent).exists()).to.eq(false);
  });
});
