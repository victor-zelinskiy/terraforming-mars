/*
 * ConsolePlayResultGains — the «РЕЗУЛЬТАТ» row's NON-RESOURCE chips: a new effect, a new action, the VP.
 * A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): what it renders for its two props — a chip
 * per gain with its glyph and its word, and the VP chip with its number, its kind and (a «per X» card) its formula.
 * It is a fragment (the host's row is the container), emits nothing and exposes nothing. Its three children are
 * stubbed by name: their own drawing is their subject. The unit runner renders the English keys.
 */
import {expect} from 'chai';
import {defineComponent, h, PropType} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {Tag} from '@/common/cards/Tag';
import {CountedObjectGlyph, tagIconUrl} from '@/client/components/premiumCard/premiumCardIcons';
import {ScoreFormula} from '@/client/console/scoreExplorerModel';
import ConsolePlayResultGains from '@/client/components/console/ConsolePlayResultGains.vue';

const IconStub = defineComponent({
  name: 'BarButtonIcon',
  props: {name: {type: String, required: true}},
  render() {
    return h('i', {'class': 'icon-stub'});
  },
});

const BadgeStub = defineComponent({
  name: 'ConsoleVpBadge',
  props: {label: {type: String, required: true}},
  render() {
    return h('i', {'class': 'badge-stub'});
  },
});

const GlyphStub = defineComponent({
  name: 'PremiumCountGlyph',
  props: {glyph: {type: Object as PropType<CountedObjectGlyph>, required: true}},
  render() {
    return h('i', {'class': 'glyph-stub'});
  },
});

type Gain = {kind: 'effect' | 'action', icon: string, label: string};
type Vp = {kind: 'fixed' | 'formula' | 'variable', value: string, formula?: ScoreFormula};

function gainsOf(props: {gains?: ReadonlyArray<Gain>, vp?: Vp}) {
  return mount(ConsolePlayResultGains, {
    global: {...globalConfig.global, stubs: {BarButtonIcon: IconStub, ConsoleVpBadge: BadgeStub, PremiumCountGlyph: GlyphStub}},
    props,
  });
}

describe('ConsolePlayResultGains — what the play adds beyond its resources', () => {
  it('a chip per gain, in order: its kind on the hook, its glyph handed to the icon, its word — and no VP chip without a VP', () => {
    const w = gainsOf({gains: [
      {kind: 'effect', icon: 'effects', label: 'Effect'},
      {kind: 'action', icon: 'actions', label: 'Action'},
    ]});
    const chips = w.findAll('span.con-resgain');
    expect(chips.map((c) => c.attributes('data-result-gain'))).to.deep.eq(['effect', 'action']);
    expect(chips.map((c) => c.find('.con-resgain__plus').text())).to.deep.eq(['+', '+']);
    expect(chips.map((c) => c.find('.con-resgain__label').text())).to.deep.eq(['Effect', 'Action']);
    expect(w.findAllComponents(IconStub).map((i) => i.props('name'))).to.deep.eq(['effects', 'actions']);
    expect(w.findAllComponents(IconStub).map((i) => i.classes().includes('con-resgain__icon')), 'the icon wears the chip\'s own class').to.deep.eq([true, true]);
    expect(w.find('[data-result-vp]').exists()).to.eq(false);
  });

  it('with nothing to say it renders nothing; a printed VP is one chip — the shield, the number, its kind, no formula', () => {
    expect(gainsOf({}).find('.con-resgain').exists(), 'the defaults: no gains, no VP').to.eq(false);

    const w = gainsOf({vp: {kind: 'fixed', value: '+2'}});
    const vp = w.find('span.con-resgain.con-resgain--vp');
    expect(vp.attributes('data-printed-vp')).to.eq('+2');
    expect(vp.attributes('data-vp-kind')).to.eq('fixed');
    expect(w.findComponent(BadgeStub).props('label')).to.eq('VP');
    expect(w.findComponent(BadgeStub).classes()).to.include('con-resgain__badge');
    expect(vp.find('b.con-resgain__num').text()).to.eq('+2');
    expect(vp.find('b.con-resgain__num').classes(), 'a number is not the word register').to.not.include('con-resgain__num--word');
    expect(vp.find('[data-vp-formula]').exists()).to.eq(false);
    expect(w.find('[data-result-gain]').exists()).to.eq(false);

    const word = gainsOf({vp: {kind: 'variable', value: 'by condition'}});
    expect(word.find('b.con-resgain__num').classes(), 'a VP the play cannot know yet is said in a word').to.include('con-resgain__num--word');
    expect(word.find('[data-result-vp]').attributes('data-vp-kind')).to.eq('variable');
  });

  it('a «per X» VP prints its formula beside the number: the counted tag\'s icon, the operands, what is still short', () => {
    const formula: ScoreFormula = {kind: 'per', vp: 2, counted: 5, each: 1, per: 2, unit: 'tags', tag: Tag.JOVIAN, remainder: 1};
    const w = gainsOf({vp: {kind: 'formula', value: '+2', formula}});
    const line = w.find('[data-result-vp] > span.con-resgain__formula');
    expect(line.attributes('data-vp-formula')).to.not.eq(undefined);
    expect(line.find('img.con-resgain__formula-tag').attributes('src')).to.eq(tagIconUrl(Tag.JOVIAN));
    expect(w.findComponent(GlyphStub).exists(), 'a tag is an icon, never a counted-object glyph').to.eq(false);
    expect(line.findAll('span').map((s) => s.text())).to.deep.eq(['5 / 2', '· 1 more to the next VP']);
    expect(line.find('.con-resgain__formula-short').exists()).to.eq(true);
  });

  it('a formula over a counted OBJECT draws that object through the count glyph — and says nothing of a shortfall it has not', () => {
    const formula: ScoreFormula = {kind: 'per', vp: 1, counted: 1, each: 1, per: 1, unit: 'cities', where: 'offmars'};
    const w = gainsOf({vp: {kind: 'formula', value: '+1', formula}});
    const glyphs = w.findAllComponents(GlyphStub);
    expect(glyphs.map((g) => g.props('glyph'))).to.deep.eq([{kind: 'tile', tile: 'spaceCity'}]);
    expect(glyphs[0].attributes('data-vp-glyph')).to.not.eq(undefined);
    expect(glyphs[0].classes()).to.include('con-composer__rescat-vpglyph');
    const line = w.find('[data-vp-formula]');
    expect(line.find('img').exists(), 'no tag, no tag icon').to.eq(false);
    expect(line.findAll('span').map((s) => s.text())).to.deep.eq(['1 × 1 VP']);
    expect(line.find('.con-resgain__formula-short').exists()).to.eq(false);
  });
});
