import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ModalInputHost from '@/client/components/modalInputs/ModalInputHost.vue';
import CardSelectionContent from '@/client/components/CardSelectionContent.vue';
import ContextualChoiceContent from '@/client/components/modalInputs/ContextualChoiceContent.vue';
import ModernOptionPicker from '@/client/components/modalInputs/ModernOptionPicker.vue';
import SpendHeatContent from '@/client/components/modalInputs/SpendHeatContent.vue';

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
      // The real ModernOptionPicker (rendered for the 'or' routing cases) hosts the
      // globally-registered <modal-input-host> — stub it so its render resolves.
      components: {'modal-input-host': {template: '<div class="mih-stub"></div>'}},
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

  it('routes an OrOptions WITH choiceContext to the premium ContextualChoiceContent', () => {
    const component = factory({
      type: 'or',
      title: 'Select one option',
      choiceContext: {source: {kind: 'corporation', card: 'Pharmacy Union'}, trigger: 'A science tag was played.', mode: 'optional-effect'},
      options: [{type: 'option', title: 'A', buttonLabel: ''}, {type: 'option', title: 'B', buttonLabel: ''}],
    });
    expect(component.findComponent(ContextualChoiceContent).exists()).to.eq(true);
    expect(component.find('.legacy-factory-stub').exists()).to.eq(false);
  });

  it('routes a "spend N heat" AndOptions (spendHeatPrompt) to the premium SpendHeatContent, NOT the legacy AndOptions widget', () => {
    const component = factory({
      type: 'and',
      title: 'Select how to spend 8 heat',
      buttonLabel: 'Confirm',
      spendHeatPrompt: {amount: 8},
      options: [
        {type: 'amount', title: 'Heat', buttonLabel: 'Spend heat', min: 0, max: 6, maxByDefault: false},
        {type: 'amount', title: 'Floaters', buttonLabel: 'Spend floaters', min: 0, max: 10, maxByDefault: false},
      ],
    });
    expect(component.findComponent(SpendHeatContent).exists()).to.eq(true);
    expect(component.find('.legacy-factory-stub').exists()).to.eq(false);
  });

  it('routes a plain OrOptions (no choiceContext) to the bare ModernOptionPicker', () => {
    const component = factory({
      type: 'or',
      title: 'Select one option',
      options: [{type: 'option', title: 'A', buttonLabel: ''}, {type: 'option', title: 'B', buttonLabel: ''}],
    });
    expect(component.findComponent(ModernOptionPicker).exists()).to.eq(true);
    expect(component.findComponent(ContextualChoiceContent).exists()).to.eq(false);
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
