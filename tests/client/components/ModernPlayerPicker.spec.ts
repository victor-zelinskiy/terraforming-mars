import {mount} from '@vue/test-utils';
import {globalConfig} from './getLocalVue';
import {expect} from 'chai';
import ModernPlayerPicker from '@/client/components/modalInputs/ModernPlayerPicker.vue';
import {InputResponse} from '@/common/inputs/InputResponse';

function factory(playerinput: any, playerView: any, onsave: (out: InputResponse) => void) {
  return mount(ModernPlayerPicker, {
    ...globalConfig,
    props: {playerView, playerinput, onsave},
  });
}

describe('ModernPlayerPicker', () => {
  const playerView = {
    players: [
      {color: 'red', name: 'Alice'},
      {color: 'blue', name: 'Bob'},
    ],
  };

  it('commits the picked player', async () => {
    let saved: InputResponse | undefined;
    const component = factory(
      {type: 'player', title: 'Select a player to attack', buttonLabel: '', players: ['red', 'blue']},
      playerView,
      (out) => {
        saved = out;
      },
    );
    const buttons = component.findAll('[data-test^="modern-player-"]');
    expect(buttons.length).to.eq(2);
    expect(component.find('[data-test="modern-player-blue"]').text()).to.include('Bob');
    await component.find('[data-test="modern-player-red"]').trigger('click');
    expect(saved).to.deep.eq({type: 'player', player: 'red'});
  });

  it('labels an unknown colour (solo neutral) plainly', () => {
    const component = factory(
      {type: 'player', title: 'Select a player', buttonLabel: '', players: ['neutral']},
      playerView,
      () => {},
    );
    expect(component.find('[data-test="modern-player-neutral"]').text()).to.not.eq('');
  });
});
