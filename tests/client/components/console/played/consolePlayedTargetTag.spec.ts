/*
 * ConsolePlayedTargetTag — the OUTCOME TAG of one candidate (PL-219): ONE renderer for the target step's cards and the
 * answered composer row. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): no emits, nothing
 * exposed — its contract is the line it draws for the tag it is handed.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {Tag} from '@/common/cards/Tag';
import {$t} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {PlayedTargetTag} from '@/client/console/played/consolePlayedTargetModel';
import ConsolePlayedTargetTag from '@/client/components/console/played/ConsolePlayedTargetTag.vue';

// The tender's tag glyph is the shared tag medallion — its own subject; this spec reads what the line HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const TagStub = defineComponent({
  name: 'TagGlyph',
  props: {tag: String, size: String, type: String},
  render: () => h('i', {class: 'tag-stub'}),
});

function line(tag: PlayedTargetTag, stacked?: boolean) {
  return mount(ConsolePlayedTargetTag as any, {
    ...globalConfig,
    props: stacked === undefined ? {tag} : {tag, stacked},
    global: {...globalConfig.global, stubs: {TagGlyph: TagStub}},
  });
}

/** The classes the shared resolver gives an icon key — what a glyph of the line must wear. */
const spriteOf = (key: string): Array<string> => iconClassFor(key).split(' ').filter((c) => c !== '');

describe('ConsolePlayedTargetTag — the outcome tag of one candidate', () => {
  it('a plain tag IS the count: its glyph and its digits, no lead, one line', () => {
    const w = line({icon: 'microbe', text: '2 → 3', tone: 'gain'});
    expect(w.classes()).to.include('con-ptsel__tag-line');
    expect(w.classes()).to.not.include('con-ptsel__tag-line--stacked');
    expect(w.find('[data-ptsel-tag-lead]').exists()).to.eq(false);
    const out = w.find('.con-ptsel__tag-out');
    expect(out.find('.con-ptsel__tag-icon').classes()).to.include.members(spriteOf('microbe'));
    expect(out.find('.con-ptsel__tag-icon').classes()).to.not.include('con-ptsel__tag-icon--production');
    expect(out.find('.con-ptsel__tag-num').text()).to.eq('2 → 3');
    expect(out.find('.con-ptsel__tag-word').exists()).to.eq(false);
    expect(out.find('.con-ptsel__tag-check').exists()).to.eq(false);
    expect(w.find('.tag-stub').exists()).to.eq(false);
  });

  it('the count LEADS its consequence — a dot between them on one line, none when the host stacks them', async () => {
    const tag: PlayedTargetTag = {lead: {icon: 'floater', text: '0 → 3'}, icon: 'megacredits', text: '+5', payTag: Tag.SPACE, reached: true, word: 'VP', tone: 'opens'};
    const w = line(tag);
    const lead = w.find('[data-ptsel-tag-lead]');
    expect(lead.find('.con-ptsel__tag-icon').classes()).to.include.members(spriteOf('floater'));
    expect(lead.find('.con-ptsel__tag-num').text()).to.eq('0 → 3');
    expect(lead.find('.con-ptsel__tag-sep').text()).to.eq('·');

    const out = w.find('.con-ptsel__tag-out');
    expect(out.find('.con-ptsel__tag-word').text(), 'a word is an i18n key').to.eq($t('VP'));
    expect(out.find('.con-ptsel__tag-num').text()).to.eq('+5');
    expect(out.find('.con-ptsel__tag-check').text()).to.eq('✓');
    const pay = w.findComponent(TagStub);
    expect(pay.props('tag'), 'the tag the tender pays for closes the line').to.eq(Tag.SPACE);
    expect(pay.props('size')).to.eq('big');
    expect(pay.props('type')).to.eq('secondary');
    expect(pay.classes()).to.include('con-ptsel__tag-pay');

    await w.setProps({stacked: true});
    expect(w.classes()).to.include('con-ptsel__tag-line--stacked');
    expect(w.find('[data-ptsel-tag-lead] .con-ptsel__tag-sep').exists(), 'two lines need no dot').to.eq(false);
  });

  it('a CHOICE of goods is every good in the printed order, joined by the slant — a SET by the plus, each on its own plate', async () => {
    const w = line({icons: ['steel', 'titanium'], plates: ['production', undefined], text: '', tone: 'static'});
    const goods = w.findAll('[data-ptsel-choice-icon]');
    expect(goods.map((g) => g.attributes('data-ptsel-choice-icon'))).to.deep.eq(['steel', 'titanium']);
    expect(goods.map((g) => g.classes().includes('con-ptsel__tag-icon--production'))).to.deep.eq([true, false]);
    expect(goods[1].classes()).to.include.members(spriteOf('titanium'));
    expect(w.findAll('.con-ptsel__tag-out > .con-ptsel__tag-sep').map((s) => s.text())).to.deep.eq(['/']);
    expect(w.find('.con-ptsel__tag-num').exists(), 'an empty text prints no digits').to.eq(false);

    await w.setProps({tag: {icons: ['steel', 'titanium'], join: 'and', plate: 'production', text: '+1', tone: 'gain'}});
    expect(w.findAll('.con-ptsel__tag-out > .con-ptsel__tag-sep').map((s) => s.text())).to.deep.eq(['+']);
    expect(w.findAll('[data-ptsel-choice-icon]').map((g) => g.classes().includes('con-ptsel__tag-icon--production')), 'one plate for the lot')
      .to.deep.eq([true, true]);
  });

  it('what ELSE the candidate gives is a tail after a dot — and a zero the server names is marked as none', () => {
    const w = line({icon: 'data', text: '1 → 2', tone: 'gain', extra: [{icon: 'cards', text: '+1'}, {icon: 'cards', text: '', none: true}]});
    const extras = w.findAll('.con-ptsel__tag-extra');
    expect(extras.map((x) => x.attributes('data-ptsel-extra'))).to.deep.eq(['cards', 'none']);
    expect(extras.map((x) => x.classes().includes('con-ptsel__tag-extra--none'))).to.deep.eq([false, true]);
    expect(extras[0].find('.con-ptsel__tag-sep').text()).to.eq('·');
    expect(extras[0].find('.con-ptsel__tag-num').text()).to.eq('+1');
    expect(extras[1].find('.con-ptsel__tag-num').exists()).to.eq(false);
  });
});
