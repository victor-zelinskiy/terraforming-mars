/*
 * PremiumVpBadge — the premium face's VP plate: ONE prop in (the VP view-model), the printed RELATION out. A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md); it emits nothing and exposes nothing, so the
 * spec is what it renders for that prop. No mount below hands it a translator: the badge brings its own.
 */
import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import PremiumVpBadge from '@/client/components/premiumCard/PremiumVpBadge.vue';
import {PremiumVpVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {tagIconUrl} from '@/client/components/premiumCard/premiumCardIcons';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {ICardRenderItem} from '@/common/cards/render/Types';
import {Tag} from '@/common/cards/Tag';
import {translateText} from '@/client/directives/i18n';

type DynamicVp = Extract<PremiumVpVM, {kind: 'dynamic'}>;

function tagItem(tag: Tag, secondaryTag?: Tag): ICardRenderItem {
  return {is: 'item', type: CardRenderItemType.TAG, amount: 1, tag, secondaryTag};
}

function dynamic(overrides: Partial<DynamicVp>): PremiumVpVM {
  return {
    kind: 'dynamic', relation: 'per', points: 1, per: 1, target: 1,
    asterisk: false, anyPlayer: false, targetOneOrMore: false, asFraction: false,
    ...overrides,
  };
}

function badge(vp: PremiumVpVM) {
  return mount(PremiumVpBadge, {props: {vp}});
}

describe('PremiumVpBadge — the printed VP relation', () => {
  it('a fixed amount is the bare numeral on the compact plate — the template starting with its root, labelled for a reader', () => {
    const w = badge({kind: 'fixed', value: 2});
    expect(w.element.tagName).to.eq('DIV');
    expect(w.classes()).to.include.members(['pcard__vp', 'pcard__vp--compact']);
    expect(w.attributes('aria-label')).to.eq(translateText('Victory points'));
    expect(w.find('.pcard__vp-value').text()).to.eq('2');
    expect(w.find('.pcard__vp-value').classes()).to.not.include('pcard__vp-value--negative');
    expect(w.find('.pcard__vp-dyn').exists()).to.eq(false);

    const negative = badge({kind: 'fixed', value: -1});
    expect(negative.find('.pcard__vp-value').classes()).to.include('pcard__vp-value--negative');
  });

  it('«N / [icon]» — a per-one relation earns its operator only with an icon on the other side of it', () => {
    const w = badge(dynamic({item: tagItem(Tag.JOVIAN)}));
    expect(w.classes()).to.include('pcard__vp--wide');
    expect(w.find('.pcard__vp-value').text()).to.eq('1');
    expect(w.find('.pcard__vp-slash').exists()).to.eq(true);
    // per one: no K beside the operator.
    expect(w.findAll('.pcard__vp-value')).to.have.length(1);
    expect(w.find('.pcard__vp-dyn > .pcard-ic').attributes('style')).to.contain(tagIconUrl(Tag.JOVIAN));
    expect(w.find('.pcard-mi--bubbled').exists()).to.eq(false);
    expect(w.find('.pcard__vp-asterisk').exists()).to.eq(false);

    // No icon — no dangling «/».
    const bare = badge(dynamic({}));
    expect(bare.find('.pcard__vp-slash').exists()).to.eq(false);
    expect(bare.find('.pcard-ic').exists()).to.eq(false);
  });

  it('«N / K [icon]» — a per-K relation prints its K, and the subject icon wears its corner', () => {
    const w = badge(dynamic({per: 3, target: 3, item: tagItem(Tag.CITY, Tag.SPACE), asterisk: true}));
    expect(w.classes()).to.include('pcard__vp--formula');
    expect(w.findAll('.pcard__vp-value').map((v) => v.text())).to.deep.eq(['1', '3']);
    expect(w.find('.pcard__vp-slash').exists()).to.eq(true);
    const bubbled = w.find('.pcard-mi--bubbled');
    expect(bubbled.find('.pcard-ic').attributes('style')).to.contain(tagIconUrl(Tag.CITY));
    expect(bubbled.find('.pcard-mi__bubble').attributes('style')).to.contain(tagIconUrl(Tag.SPACE));
    expect(bubbled.find('.pcard-mi__bubble').classes()).to.not.include('pcard-mi__bubble--tile');
    expect(w.find('.pcard__vp-asterisk').exists()).to.eq(true);
  });

  it('a conditional is «[icon] : N», a variable count is «?», vermin its own engraving — and the plate follows its prop', async () => {
    const w = badge(dynamic({relation: 'conditional', points: 3, item: tagItem(Tag.SCIENCE)}));
    expect(w.classes()).to.include('pcard__vp--formula');
    expect(w.find('.pcard__vp-colon').exists()).to.eq(true);
    expect(w.find('.pcard__vp-slash').exists()).to.eq(false);
    expect(w.find('.pcard__vp-value').text()).to.eq('3');
    expect(w.find('.pcard__vp-dyn > .pcard-ic').attributes('style')).to.contain(tagIconUrl(Tag.SCIENCE));

    await w.setProps({vp: dynamic({relation: 'variable', points: 0})});
    expect(w.classes()).to.include('pcard__vp--compact');
    expect(w.find('.pcard__vp-value').text()).to.eq('?');
    expect(w.find('.pcard__vp-colon').exists()).to.eq(false);

    // The typographic minus (U+2212), never a hyphen.
    await w.setProps({vp: dynamic({relation: 'plain', points: -2})});
    expect(w.find('.pcard__vp-value').text()).to.eq('−2');
    expect(w.find('.pcard__vp-value').classes()).to.include('pcard__vp-value--negative');

    await w.setProps({vp: {kind: 'vermin'}});
    expect(w.classes()).to.include('pcard__vp--formula');
    expect(w.find('.pcard__vp-value').text()).to.eq('−1');
    expect(w.find('.pcard__vp-dyn > .pcard-ic').attributes('style')).to.contain('assets/tiles/city.png');
    expect(w.find('.pcard__vp-asterisk').exists()).to.eq(true);
  });
});
