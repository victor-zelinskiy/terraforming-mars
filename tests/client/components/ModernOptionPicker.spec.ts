import {mount} from '@vue/test-utils';
import {globalConfig} from './getLocalVue';
import {expect} from 'chai';
import ModernOptionPicker from '@/client/components/modalInputs/ModernOptionPicker.vue';
import {MANDATORY_MODAL_PICKER_SETTER} from '@/client/components/MandatoryInputModal.vue';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {InputResponse} from '@/common/inputs/InputResponse';

// Lightweight stub for the globally-registered `<modal-input-host>` so we can
// assert what nested input is hosted and drive its onsave.
const ModalInputHostStub = {
  name: 'modal-input-host',
  props: ['playerView', 'playerinput', 'onsave'],
  template: '<div class="modal-input-host-stub"></div>',
};

function factory(playerinput: any, onsave: (out: InputResponse) => void, pickerSetter?: any) {
  return mount(ModernOptionPicker, {
    ...globalConfig,
    global: {
      ...globalConfig.global,
      components: {'modal-input-host': ModalInputHostStub},
      stubs: {SelectSpace: true},
      provide: pickerSetter ? {[MANDATORY_MODAL_PICKER_SETTER]: pickerSetter} : {},
    },
    props: {playerView: {}, playerinput, onsave},
  });
}

describe('ModernOptionPicker', () => {
  it('commits a SelectOption with the ORIGINAL index, ignoring learner-only options', async () => {
    PreferencesManager.INSTANCE.set('learner_mode', false);
    let saved: InputResponse | undefined;
    const component = factory(
      {
        type: 'or',
        title: 'Choose',
        options: [
          {type: 'card', title: 'hidden', showOnlyInLearnerMode: true},
          {type: 'option', title: 'select a', buttonLabel: ''},
          {type: 'option', title: 'select b', buttonLabel: ''},
        ],
      },
      (out) => {
        saved = out;
      },
    );
    // The learner-only card is filtered, so two option cards are displayed.
    const buttons = component.findAll('.modal-input__option-card');
    expect(buttons.length).to.eq(2);
    // Click SELECTS (no commit yet — select → confirm flow).
    await buttons[1].trigger('click');
    expect(saved).to.eq(undefined);
    // Confirm commits the selected option (displayed index 1 → original 2).
    await component.find('[data-test="modern-option-confirm"]').trigger('click');
    expect(saved).to.deep.eq({type: 'or', index: 2, response: {type: 'option'}});
  });

  it('expands a complex option and wraps its nested response in the OR', async () => {
    PreferencesManager.INSTANCE.set('learner_mode', false);
    let saved: InputResponse | undefined;
    const component = factory(
      {
        type: 'or',
        title: 'Choose',
        options: [
          {type: 'option', title: 'do nothing', buttonLabel: ''},
          {type: 'player', title: 'pick a player', players: ['red', 'blue'], buttonLabel: ''},
        ],
      },
      (out) => {
        saved = out;
      },
    );
    // Click the nested 'player' option (displayed index 1, original index 1).
    await component.findAll('[data-test^="modern-option-"]')[1].trigger('click');
    const host = component.findComponent(ModalInputHostStub);
    expect(host.exists()).to.be.true;
    expect(host.props('playerinput').type).to.eq('player');
    // Drive the nested input's save → must be wrapped in the OR with index 1.
    host.props('onsave')({type: 'player', player: 'red'});
    expect(saved).to.deep.eq({type: 'or', index: 1, response: {type: 'player', player: 'red'}});
  });

  it('arms board picker-mode for a SelectSpace option', async () => {
    PreferencesManager.INSTANCE.set('learner_mode', false);
    const calls: Array<[boolean, unknown]> = [];
    const pickerSetter = (mode: boolean, title?: unknown) => {
      calls.push([mode, title]);
    };
    const component = factory(
      {
        type: 'or',
        title: 'Choose',
        options: [
          {type: 'option', title: 'skip', buttonLabel: ''},
          {type: 'space', title: 'Add an ocean', buttonLabel: '', spaces: ['01']},
        ],
      },
      () => {},
      pickerSetter,
    );
    await component.findAll('[data-test^="modern-option-"]')[1].trigger('click');
    expect(calls).to.deep.include([true, 'Add an ocean']);
  });
});
