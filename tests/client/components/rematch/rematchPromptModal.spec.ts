import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import RematchPromptModal from '@/client/components/rematch/RematchPromptModal.vue';
import {RematchModel} from '@/common/models/RematchModel';
import {$t} from '@/client/directives/i18n';

/*
 * THE «ACCEPT REMATCH?» PROMPT on its own (its host is `RematchLayer`): the offer's model and a `submitting` flag in,
 * three verbs out — `accept`, `decline`, `minimize`. It exposes nothing. No mount below hands it a translator or a
 * directive: the modal brings its own.
 */
describe('RematchPromptModal', () => {
  function offer(overrides: Partial<RematchModel> = {}): RematchModel {
    return {
      status: 'offered',
      offeredBy: 'blue',
      votes: [
        {color: 'blue', name: 'Nastya', status: 'accepted'},
        {color: 'red', name: 'Victor', status: 'pending'},
        {color: 'green', name: 'Kolya', status: 'declined'},
      ],
      viewerIsPlayer: true,
      viewerColor: 'red',
      viewerMustVote: true,
      viewerIsOfferer: false,
      ...overrides,
    };
  }

  // The teleport is stubbed so the modal is read where it is rendered (its target is the document's body).
  function mountModal(props: {model: RematchModel, submitting?: boolean}) {
    return mount(RematchPromptModal, {props, global: {stubs: {teleport: true}}});
  }

  it('names the offerer — a chip in their colour, their name taken from the vote tally — inside a labelled dialog bound for the body', () => {
    const wrapper = mountModal({model: offer()});
    expect(wrapper.find('teleport-stub').attributes('to')).to.eq('body');
    const dialog = wrapper.find('.rematch-modal');
    expect(dialog.attributes('role')).to.eq('dialog');
    expect(dialog.attributes('aria-label')).to.eq($t('Rematch offered'));
    expect(wrapper.find('.rematch-modal__min').attributes('title')).to.eq($t('Minimize'));

    const chip = wrapper.find('.rematch-modal__chip');
    expect(chip.classes()).to.include('player_translucent_bg_color_blue');
    expect(chip.find('.rematch-modal__dot').classes()).to.include('player_bg_color_blue');
    expect(chip.find('.rematch-modal__chip-name').text()).to.eq('Nastya');

    // The copy is translated by the modal's own `v-i18n`.
    const title = wrapper.find('.rematch-modal__title');
    expect(title.attributes('tm-has-i18n')).to.eq('true');
    expect(title.text()).to.not.eq('');
  });

  it('lists every vote in the tally\'s order — the voter\'s colour and name, the status as a class and as a glyph', () => {
    const wrapper = mountModal({model: offer()});
    const rows = wrapper.findAll('.rematch-modal__vote');
    expect(rows.map((r) => r.find('.rematch-modal__vote-name').text())).to.deep.eq(['Nastya', 'Victor', 'Kolya']);
    expect(rows.map((r) => r.classes().filter((c) => c.startsWith('rematch-modal__vote--'))))
      .to.deep.eq([['rematch-modal__vote--accepted'], ['rematch-modal__vote--pending'], ['rematch-modal__vote--declined']]);
    expect(rows.map((r) => r.find('.rematch-modal__vote-status').text())).to.deep.eq(['✓', '⋯', '✕']);
    expect(rows.map((r) => r.find('.rematch-modal__dot').classes().filter((c) => c.startsWith('player_bg_color_'))))
      .to.deep.eq([['player_bg_color_blue'], ['player_bg_color_red'], ['player_bg_color_green']]);
  });

  it('its three verbs are emits — accept, decline, minimize — one per press, with no payload', async () => {
    const wrapper = mountModal({model: offer()});
    expect(wrapper.find('.cab-rematch--accept').attributes('disabled')).to.eq(undefined);
    expect(wrapper.find('.cab-rematch--decline').attributes('disabled')).to.eq(undefined);

    await wrapper.find('.cab-rematch--accept').trigger('click');
    expect(wrapper.emitted('accept')).to.deep.eq([[]]);
    expect(wrapper.emitted('decline')).to.eq(undefined);

    await wrapper.find('.cab-rematch--decline').trigger('click');
    expect(wrapper.emitted('decline')).to.deep.eq([[]]);

    await wrapper.find('.rematch-modal__min').trigger('click');
    expect(wrapper.emitted('minimize')).to.deep.eq([[]]);
    expect(wrapper.emitted('accept'), 'still one accept').to.deep.eq([[]]);
  });

  it('while the answer is being submitted both answers are disabled; an offer with no offerer falls back to the neutral chip', async () => {
    const wrapper = mountModal({model: offer(), submitting: true});
    expect(wrapper.find('.cab-rematch--accept').attributes('disabled')).to.not.eq(undefined);
    expect(wrapper.find('.cab-rematch--decline').attributes('disabled')).to.not.eq(undefined);

    await wrapper.setProps({model: offer({offeredBy: undefined}), submitting: false});
    expect(wrapper.find('.cab-rematch--accept').attributes('disabled')).to.eq(undefined);
    const chip = wrapper.find('.rematch-modal__chip');
    expect(chip.classes()).to.include('player_translucent_bg_color_neutral');
    expect(chip.find('.rematch-modal__chip-name').text()).to.eq('');
  });
});
