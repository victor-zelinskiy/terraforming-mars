import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {DeferPlateModel} from '@/client/console/tableQuestionRow';
import {translateCardName, translateText} from '@/client/directives/i18n';
import ConsoleDeferPlate from '@/client/components/console/foundation/ConsoleDeferPlate.vue';

// The glyph and the chip are their own specs' subjects; this one reads what the plate HANDS them.
// (Render functions, not template strings: the runtime compiler is not in this build.)
const GlyphStub = defineComponent({name: 'GamepadGlyph', props: ['control'], render: () => h('i', {class: 'glyph-stub'})});
const ChipStub = defineComponent({name: 'ActionEffectChip', props: ['effect'], render: () => h('i', {class: 'chip-stub'})});

const LABEL = 'Decide after the draw';

function plate(defer: DeferPlateModel) {
  return mount(ConsoleDeferPlate, {
    ...globalConfig,
    props: {defer},
    global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub, ActionEffectChip: ChipStub}},
  });
}

describe('ConsoleDeferPlate — «decide after the draw», in the question line', () => {
  it('says WHY waiting is worth it: who draws first, and how many — the «+N» chip', () => {
    const w = plate({label: LABEL, drawers: [{card: CardName.OLYMPUS_CONFERENCE, cards: 1}, {card: CardName.MARS_UNIVERSITY, cards: 1}], drawn: 2});
    const drawers = `${translateCardName(CardName.OLYMPUS_CONFERENCE)} · ${translateCardName(CardName.MARS_UNIVERSITY)}`;
    expect(w.classes()).to.contain('con-defer');
    expect(w.attributes('data-defer-plate')).to.not.eq(undefined);
    expect(w.attributes('role')).to.eq('note');
    expect(w.find('.con-defer__label').text()).to.eq(translateText(LABEL));
    expect(w.find('.con-defer__why .con-defer__drawers').text()).to.eq(drawers);
    expect(w.attributes('aria-label')).to.eq(`${translateText(LABEL)} · ${drawers}`);
    const glyph = w.findComponent(GlyphStub);
    expect(glyph.props('control'), 'the deferral is the right stick\'s press').to.eq('stickR');
    expect(glyph.classes()).to.contain('con-defer__glyph');
    expect(w.find('.con-defer__chip').exists()).to.eq(true);
    expect(w.findComponent(ChipStub).props('effect')).to.deep.eq({direction: 'gain', icon: 'cards', amount: 2});
  });

  it('invents no number: a drawer that does not state its count leaves the names and no chip', () => {
    const w = plate({label: LABEL, drawers: [{card: CardName.OLYMPUS_CONFERENCE}]});
    expect(w.find('.con-defer__why .con-defer__drawers').text()).to.eq(translateCardName(CardName.OLYMPUS_CONFERENCE));
    expect(w.find('.con-defer__chip').exists()).to.eq(false);
    expect(w.findComponent(ChipStub).exists()).to.eq(false);
  });

  it('with nobody drawing first the plate is its label alone', () => {
    const w = plate({label: LABEL, drawers: []});
    expect(w.find('.con-defer__why').exists()).to.eq(false);
    expect(w.attributes('aria-label')).to.eq(translateText(LABEL));
  });

  it('follows its model', async () => {
    const w = plate({label: LABEL, drawers: []});
    await w.setProps({defer: {label: LABEL, drawers: [{card: CardName.MARS_UNIVERSITY, cards: 3}], drawn: 3}});
    expect(w.find('.con-defer__drawers').text()).to.eq(translateCardName(CardName.MARS_UNIVERSITY));
    expect(w.findComponent(ChipStub).props('effect')).to.deep.eq({direction: 'gain', icon: 'cards', amount: 3});
    expect(w.attributes('aria-label')).to.eq(`${translateText(LABEL)} · ${translateCardName(CardName.MARS_UNIVERSITY)}`);
  });
});
