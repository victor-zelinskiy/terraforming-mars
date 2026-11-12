import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {expect} from 'chai';
import {Message} from '@/common/logs/Message';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {$t, translateMessage, translateText} from '@/client/directives/i18n';
import ConsoleDeclinePlate from '@/client/components/console/foundation/ConsoleDeclinePlate.vue';

// The glyph and the chip are their own specs' subjects; this one reads what the plate HANDS them.
// (Render functions, not template strings: the runtime compiler is not in this build.)
const GlyphStub = defineComponent({name: 'GamepadGlyph', props: ['control'], render: () => h('i', {class: 'glyph-stub'})});
const ChipStub = defineComponent({name: 'ActionEffectChip', props: ['effect'], render: () => h('i', {class: 'chip-stub'})});

function plate(props: {label: string | Message, forgone?: ReadonlyArray<ActionEffect>}) {
  return mount(ConsoleDeclinePlate, {
    ...globalConfig,
    props,
    global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub, ActionEffectChip: ChipStub}},
  });
}

describe('ConsoleDeclinePlate — the refusal of an optional choice, in the question line', () => {
  it('a plain label: the refusal\'s words beside its button — a note, never a control, nothing forgone', () => {
    const w = plate({label: 'Do not discard'});
    expect(w.classes()).to.contain('con-decline');
    expect(w.attributes('data-decline-plate')).to.not.eq(undefined);
    expect(w.attributes('role')).to.eq('note');
    expect(w.attributes('aria-label')).to.eq(translateText('Do not discard'));
    expect(w.find('.con-decline__label').text()).to.eq(translateText('Do not discard'));
    const glyph = w.findComponent(GlyphStub);
    expect(glyph.props('control'), 'the decline is the right trigger').to.eq('triggerR');
    expect(glyph.classes()).to.contain('con-decline__glyph');
    expect(w.find('[data-decline-forgone]').exists(), 'nothing forgone — no «without» tail').to.eq(false);
    expect(w.findComponent(ChipStub).exists()).to.eq(false);
  });

  it('a label that is a MESSAGE is rendered through its data', () => {
    const message = (): Message => ({message: 'Do not discard', data: []});
    const w = plate({label: message()});
    expect(w.find('.con-decline__label').text()).to.eq(translateMessage(message()));
    expect(w.attributes('aria-label')).to.eq(translateMessage(message()));
  });

  it('names what is forgone: «without» and one chip per effect, each handed its effect', () => {
    const forgone: ReadonlyArray<ActionEffect> = [
      {direction: 'gain', icon: 'cards', amount: 1},
      {direction: 'gain', icon: 'megacredits', amount: 3},
    ];
    const w = plate({label: 'Do not discard', forgone});
    const tail = w.find('[data-decline-forgone]');
    expect(tail.exists()).to.eq(true);
    expect(tail.find('.con-decline__without').text()).to.eq($t('without'));
    const chips = tail.findAll('.con-decline__chip');
    expect(chips).to.have.length(2);
    expect(w.findAllComponents(ChipStub).map((c) => c.props('effect'))).to.deep.eq(forgone);
    // The aria sentence is the refusal's words alone — the chips speak for themselves.
    expect(w.attributes('aria-label')).to.eq(translateText('Do not discard'));
  });

  it('follows its label', async () => {
    const w = plate({label: 'Do not discard'});
    await w.setProps({label: 'Skip'});
    expect(w.find('.con-decline__label').text()).to.eq(translateText('Skip'));
    expect(w.attributes('aria-label')).to.eq(translateText('Skip'));
  });
});
