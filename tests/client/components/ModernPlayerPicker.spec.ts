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

  it('selects a target then commits via the confirm CTA', async () => {
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
    // Clicking a target SELECTS it (no commit yet) — the CTA appears.
    expect(component.find('[data-test="modern-player-confirm"]').exists()).to.eq(false);
    await component.find('[data-test="modern-player-red"]').trigger('click');
    expect(saved).to.eq(undefined);
    // Confirm commits the selected target.
    await component.find('[data-test="modern-player-confirm"]').trigger('click');
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

  it('renders server-flagged disabled targets as non-selectable cards with a reason', async () => {
    let saved: InputResponse | undefined;
    const component = factory(
      {type: 'player', title: 'Decrease production', buttonLabel: 'Decrease', players: ['red'],
        icon: 'energy', amount: 1, scope: 'production',
        disabledPlayers: [{color: 'blue', reason: 'Production already at minimum'}]},
      playerView,
      (out) => {
        saved = out;
      },
    );
    // Both a selectable and a disabled card render.
    expect(component.find('[data-test="modern-player-red"]').exists()).to.eq(true);
    const disabled = component.find('[data-test="modern-player-blue"]');
    expect(disabled.exists()).to.eq(true);
    expect((disabled.element as HTMLButtonElement).disabled).to.eq(true);
    // Clicking the disabled card neither selects nor commits.
    await disabled.trigger('click');
    expect(component.find('[data-test="modern-player-confirm"]').exists()).to.eq(false);
    expect(saved).to.eq(undefined);
  });
});
