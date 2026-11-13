/*
 * ConsoleLawStanding — «WHILE ENACTED»: what a law gives the reading's seat for as long as it stands, in the vote
 * panel's number grammar. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): nothing here
 * computes — the reading arrives from `lawStandingModel.ts`; this draws it. It emits and exposes nothing.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {Tag} from '@/common/cards/Tag';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {suffixWinKey} from '@/client/console/parliament/voteInfoModel';
import {
  DISCOUNT_IN_HAND, LawStanding, ONCE_A_GENERATION, STANDING_KICKER, STOCK_GAIN, TAGS_WHEN_ACTING, USES_A_GENERATION,
} from '@/client/console/parliament/lawStandingModel';
import ConsoleLawStanding from '@/client/components/console/parliament/ConsoleLawStanding.vue';

// The tag is the premium count glyph — its own specs' subject; this one reads what the row HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const GlyphStub = defineComponent({name: 'PremiumCountGlyph', props: ['glyph'], render: () => h('i', {class: 'glyph-stub'})});

function part(props: Record<string, unknown>, attrs: Record<string, unknown> = {}) {
  return mount(ConsoleLawStanding as any, {
    ...globalConfig,
    props,
    attrs,
    global: {...globalConfig.global, stubs: {PremiumCountGlyph: GlyphStub}},
  });
}

const sprite = (icon: string) => iconClassFor(icon).split(' ').filter((c) => c !== '');

const ACTION = '[data-parl-standing="action"]';
const PASSIVE = '[data-parl-standing="passive"]';

describe('ConsoleLawStanding — what a law gives while it stands', () => {
  it('an ACTION that is the plate\'s voice: the price at the seat\'s influence, what it buys, how many times — and the win\'s change', () => {
    const standing: LawStanding = {
      action: {bill: {printed: 6, price: 4, priceIfWin: 2}, gains: [{icon: 'plants', amount: 3, direction: 'gain'}], uses: {now: 2, declared: true}},
    };
    const w = part({standing}, {'class': 'from-host', 'data-from-host': 'yes'});
    // The template STARTS WITH ITS ROOT: what the host lets fall through lands on the part itself.
    expect((w.element as HTMLElement).tagName).to.eq('DIV');
    expect(w.classes()).to.include.members(['con-lawst', 'con-lawst--hero', 'from-host']);
    expect(w.classes()).to.not.include('con-lawst--both');
    expect(w.attributes('data-from-host')).to.eq('yes');
    expect(w.attributes('data-parl-vote-standing')).to.not.eq(undefined);
    expect(w.find('[data-parl-standing-kicker]').exists(), 'a law that pays nothing at the enactment names no part').to.eq(false);
    expect(w.find(PASSIVE).exists()).to.eq(false);

    const row = w.find(ACTION);
    expect(row.find('.con-lawst__label').exists(), 'one row needs no label').to.eq(false);
    expect(row.find('[data-standing-printed]').text()).to.eq('6');
    expect(row.find('[data-standing-price]').text()).to.eq('4');
    expect(row.find('.con-lawst__gain').text()).to.eq('+3');
    expect(row.find('.con-lawst__gain i.con-lawst__unit').classes()).to.include.members(sprite('plants'));
    const uses = row.find('[data-standing-uses]');
    expect(uses.attributes('data-standing-uses-now')).to.eq('2');
    expect(uses.text()).to.eq(translateTextWithParams(USES_A_GENERATION, ['2']));
    expect(uses.classes()).to.not.include('con-lawst__uses--lead');
    // The win's change is ONE suffix line: the price it takes off, in the reader's own words.
    const suffix = row.find('[data-standing-suffix]');
    expect(suffix.find('.con-lawst__suffix-num').text()).to.eq('−2');
    expect(suffix.find('i.con-lawst__suffix-unit').classes()).to.include.members(sprite('megacredits'));
    expect(suffix.find('.con-lawst__suffix-words').text()).to.eq($t(suffixWinKey('you')));
  });

  it('an action with no bill is its RULE, once a generation — the count leads the line; a declared count reads the win\'s «×N»', async () => {
    const w = part({standing: {action: {gains: [], uses: {now: 1, declared: false}, rule: 'Do the thing'}}});
    const row = w.find(ACTION);
    expect(row.find('[data-standing-price]').exists()).to.eq(false);
    expect(row.find('[data-standing-printed]').exists()).to.eq(false);
    const uses = row.find('[data-standing-uses]');
    expect(uses.text()).to.eq(translateText(ONCE_A_GENERATION));
    expect(uses.classes()).to.include('con-lawst__uses--lead');
    expect(row.find('.con-lawst__rule').text()).to.eq($t('Do the thing'));
    expect(row.find('[data-standing-suffix]').exists()).to.eq(false);

    await w.setProps({standing: {action: {gains: [], uses: {now: 2, ifWin: 3, declared: true}, rule: 'Do the thing'}}});
    expect(w.find('[data-standing-uses]').text()).to.eq(translateTextWithParams(USES_A_GENERATION, ['2']));
    const suffix = w.find(ACTION + ' [data-standing-suffix]');
    expect(suffix.find('.con-lawst__suffix-num').text()).to.eq('×3');
    expect(suffix.find('.con-lawst__suffix-unit').exists(), 'a count has no unit').to.eq(false);
  });

  it('under an enactment payout the part NAMES itself; a law that both stands and acts labels each row, the passive first', () => {
    const standing: LawStanding = {
      kicker: STANDING_KICKER,
      passive: {kind: 'cardDiscount', amount: 2, tags: [Tag.SPACE, Tag.EARTH], inHand: 3},
      action: {gains: [], uses: {now: 1, declared: false}, rule: 'Do the thing'},
    };
    const w = part({standing});
    expect(w.classes()).to.include('con-lawst--both');
    expect(w.classes()).to.not.include('con-lawst--hero');
    expect(w.find('[data-parl-standing-kicker]').text()).to.eq($t(STANDING_KICKER));
    expect(w.findAll('[data-parl-standing]').map((r) => r.attributes('data-parl-standing'))).to.deep.eq(['passive', 'action']);

    const passive = w.find(PASSIVE);
    expect(passive.attributes('data-standing-kind')).to.eq('cardDiscount');
    expect(passive.find('.con-lawst__label').text()).to.eq($t('Effect'));
    expect(passive.find('[data-standing-discount]').text()).to.eq('−2');
    expect(passive.find('i.con-lawst__unit').classes()).to.include.members(sprite('megacredits'));
    expect(w.findAllComponents(GlyphStub).map((g) => g.props('glyph'))).to.deep.eq([{kind: 'tag', tag: Tag.SPACE}, {kind: 'tag', tag: Tag.EARTH}]);
    expect(passive.find('[data-standing-in-hand]').text()).to.eq(translateTextWithParams(DISCOUNT_IN_HAND, ['3']));
    expect(w.find(ACTION + ' .con-lawst__label').text()).to.eq($t('Action'));
  });

  it('every passive term reads its own number — and the win\'s words follow WHOSE reading it is', async () => {
    const w = part({standing: {passive: {kind: 'tagsPerInfluence', tag: Tag.SCIENCE, now: 2, ifWin: 3}}, person: 'they'});
    const tags = w.find(PASSIVE);
    expect(tags.attributes('data-standing-kind')).to.eq('tagsPerInfluence');
    expect(tags.find('[data-standing-tags]').text()).to.eq('+2');
    expect(w.findComponent(GlyphStub).props('glyph')).to.deep.eq({kind: 'tag', tag: Tag.SCIENCE});
    expect(tags.find('.con-lawst__words').text()).to.eq($t(TAGS_WHEN_ACTING));
    expect(tags.find('[data-standing-suffix] .con-lawst__suffix-num').text(), 'the win adds the difference').to.eq('+1');
    expect(tags.find('[data-standing-suffix] .con-lawst__suffix-words').text()).to.eq($t(suffixWinKey('they')));
    expect($t(suffixWinKey('they')), 'another seat\'s reading is worded apart from the viewer\'s').to.not.eq($t(suffixWinKey('you')));

    await w.setProps({standing: {passive: {kind: 'resourceValue', rows: [{resource: 'steel', now: 2, after: 3}], stockGain: 4}}});
    const value = w.find(PASSIVE + ' [data-standing-value="steel"]');
    expect(value.find('i.con-lawst__unit').classes()).to.include.members(sprite('steel'));
    expect(value.find('.con-lawst__from').text()).to.eq('2');
    expect(value.find('.con-lawst__num').text()).to.eq('3');
    expect(w.find('[data-standing-stock]').text()).to.eq(translateTextWithParams(STOCK_GAIN, ['4']));

    await w.setProps({standing: {passive: {kind: 'rule', text: 'A standing rule'}}});
    expect(w.find(PASSIVE).attributes('data-standing-kind')).to.eq('rule');
    expect(w.find('[data-standing-rule]').text()).to.eq($t('A standing rule'));
  });
});
