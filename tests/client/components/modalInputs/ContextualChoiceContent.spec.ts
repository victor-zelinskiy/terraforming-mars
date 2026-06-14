import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ContextualChoiceContent from '@/client/components/modalInputs/ContextualChoiceContent.vue';

// Stub the hosted ModernOptionPicker so the test is about the CONTEXTUAL frame
// (source card / kind chip / trigger) + the props it forwards, not the option
// list (covered by ModernOptionPicker.spec).
const ModernOptionPickerStub = {
  name: 'ModernOptionPicker',
  props: ['playerView', 'playerinput', 'onsave', 'hideHeader', 'controlled', 'confirmRisky'],
  template: '<div class="mop-stub"></div>',
};

function factory(playerinput: any, onsave: (out: any) => void = () => {}) {
  return mount(ContextualChoiceContent, {
    ...globalConfig,
    global: {
      ...globalConfig.global,
      stubs: {Card: true, CardZoomModal: true, Teleport: true, ModernOptionPicker: ModernOptionPickerStub},
    },
    props: {
      playerView: {players: [], thisPlayer: {}} as any,
      playerinput,
      onsave,
    },
  });
}

const PHARMACY_INPUT = {
  type: 'or',
  title: 'Select one option',
  choiceContext: {
    source: {kind: 'corporation', card: 'Pharmacy Union'},
    trigger: 'You played a science tag and there are no diseases left here.',
    mode: 'optional-effect',
  },
  options: [
    {type: 'option', title: 'Turn this card face down and gain 3 TR', buttonLabel: 'Gain TR',
      metadata: {kind: 'resourceGain', effects: [{direction: 'gain', icon: 'tr', amount: 3}], tradeoff: 'Card is turned face down — its effect stops working'}},
    {type: 'option', title: 'Do nothing', buttonLabel: 'Do nothing', metadata: {kind: 'skip'}},
  ],
};

describe('ContextualChoiceContent', () => {
  it('frames the choice with the source card, kind chip and trigger', () => {
    const component = factory(PHARMACY_INPUT);
    // Source card preview is shown (a corporation source has a card).
    expect(component.find('[data-test="contextual-choice-source"]').exists()).to.eq(true);
    // The kind chip reads "Corporation" (derived from source.kind).
    const kind = component.find('.contextual-choice__kind');
    expect(kind.classes()).to.include('contextual-choice__kind--corporation');
    expect(kind.text()).to.eq('Corporation');
    // The title shows the source card name (not the bare "Select one option").
    expect(component.find('.contextual-choice__title').text()).to.eq('Pharmacy Union');
    // The trigger / "why this appeared" block renders the trigger text.
    expect(component.find('.contextual-choice__trigger-text').text())
      .to.eq('You played a science tag and there are no diseases left here.');
  });

  it('forwards the options to a HEADER-SUPPRESSED, one-click ModernOptionPicker', () => {
    const onsave = () => {};
    const component = factory(PHARMACY_INPUT, onsave);
    const mop = component.findComponent(ModernOptionPickerStub);
    expect(mop.exists()).to.eq(true);
    expect(mop.props('hideHeader')).to.eq(true);
    expect(mop.props('playerinput')).to.deep.eq(PHARMACY_INPUT);
    expect(mop.props('onsave')).to.eq(onsave);
    // The contextual modal is one-click: safe options commit on click (`controlled`),
    // while a risky option arms an inline confirm (`confirmRisky`) — no footer button.
    expect(mop.props('controlled')).to.eq(true);
    expect(mop.props('confirmRisky')).to.eq(true);
  });

  it('suppresses the default OrOptions title as a redundant instruction', () => {
    // "Select one option" is the bare default — the trigger line already explains,
    // so it must NOT also appear as an instruction line.
    const component = factory(PHARMACY_INPUT);
    expect(component.find('.contextual-choice__instruction').exists()).to.eq(false);
  });

  it('shows a meaningful OrOptions title as the instruction line', () => {
    const component = factory({
      ...PHARMACY_INPUT,
      title: 'Choose the order of tag resolution',
    });
    expect(component.find('.contextual-choice__instruction').text()).to.eq('Choose the order of tag resolution');
  });

  it('a system source (no card) hides the source-card preview', () => {
    const component = factory({
      type: 'or',
      title: 'Select one option',
      choiceContext: {source: {kind: 'system'}, trigger: 'A global event resolved.', mode: 'effect-choice'},
      options: [{type: 'option', title: 'A', buttonLabel: ''}, {type: 'option', title: 'B', buttonLabel: ''}],
    });
    expect(component.find('[data-test="contextual-choice-source"]').exists()).to.eq(false);
    expect(component.find('.contextual-choice__kind').text()).to.eq('Game effect');
  });
});
