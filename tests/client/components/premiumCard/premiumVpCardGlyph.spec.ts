import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {Tag} from '@/common/cards/Tag';
import PremiumVpCardGlyph from '@/client/components/premiumCard/PremiumVpCardGlyph.vue';
import {tagIconUrl} from '@/client/components/premiumCard/premiumCardIcons';
import {$t} from '@/client/directives/i18n';

/*
 * «A CARD THAT PRINTS A TAG AND A VP ICON» on its own (its hosts are `PremiumCountGlyph.spec.ts` and the face's
 * mechanics): one optional prop in — the printed tag — and one drawing out. It emits nothing and exposes nothing.
 * No mount below hands it a translator: the glyph brings its own.
 */
describe('PremiumVpCardGlyph', () => {
  it('a card that prints a tag: the cover, the tag\'s medallion in its own art, and the VP plate engraved with the localized mark', () => {
    const wrapper = mount(PremiumVpCardGlyph, {props: {tag: Tag.BUILDING}});
    // The template starts with its root: the glyph IS the component's element.
    expect(wrapper.element.tagName).to.eq('SPAN');
    expect(wrapper.classes()).to.include('pvpcard');
    expect(wrapper.attributes('data-vp-card-tag')).to.eq(Tag.BUILDING);
    expect(wrapper.attributes('aria-hidden')).to.eq('true');
    expect(wrapper.find('.pvpcard__cover').exists()).to.eq(true);
    expect(wrapper.find('.pvpcard__tag').attributes('style')).to.contain(tagIconUrl(Tag.BUILDING));
    expect($t('VP')).to.not.eq('');
    expect(wrapper.find('.pvpcard__vp .pvpcard__vp-mark').text()).to.eq($t('VP'));
  });

  it('no tag (any card with a VP icon): the cover and the plate alone — no medallion, no tag named', () => {
    const wrapper = mount(PremiumVpCardGlyph);
    expect(wrapper.classes()).to.include('pvpcard');
    expect(wrapper.attributes('data-vp-card-tag')).to.eq(undefined);
    expect(wrapper.find('.pvpcard__tag').exists()).to.eq(false);
    expect(wrapper.find('.pvpcard__cover').exists()).to.eq(true);
    expect(wrapper.find('.pvpcard__vp-mark').exists()).to.eq(true);
  });

  it('follows its prop: another tag re-dresses the medallion, the tag withdrawn removes it', async () => {
    const wrapper = mount(PremiumVpCardGlyph, {props: {tag: Tag.BUILDING}});
    await wrapper.setProps({tag: Tag.SPACE});
    expect(wrapper.attributes('data-vp-card-tag')).to.eq(Tag.SPACE);
    expect(wrapper.find('.pvpcard__tag').attributes('style')).to.contain(tagIconUrl(Tag.SPACE));
    expect(wrapper.find('.pvpcard__tag').attributes('style')).to.not.contain(tagIconUrl(Tag.BUILDING));

    await wrapper.setProps({tag: undefined});
    expect(wrapper.find('.pvpcard__tag').exists()).to.eq(false);
    expect(wrapper.attributes('data-vp-card-tag')).to.eq(undefined);
  });

  it('a host\'s class lands on the glyph itself (the face\'s mechanics size it as one of their icons)', () => {
    const wrapper = mount(PremiumVpCardGlyph, {props: {tag: Tag.BUILDING}, attrs: {class: 'pcard-ic pcard-ic--vp-card'}});
    expect(wrapper.classes()).to.include.members(['pvpcard', 'pcard-ic', 'pcard-ic--vp-card']);
  });
});
