import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import PremiumBannerCubeGlyph from '@/client/components/premiumCard/PremiumBannerCubeGlyph.vue';

/*
 * «YOUR CUBE ON A PARTY'S BANNER» on its own: no props, no emit, nothing exposed — the glyph is ONE fixed drawing
 * (the wild-party pill with the player's cube seated on it), sized and painted by its stylesheet. So the spec is its
 * markup: the two parts, in their order, decorative, and a root a host's class can land on.
 */
describe('PremiumBannerCubeGlyph', () => {
  it('the root is the glyph — decorative, the pill first and the cube seated after it', () => {
    const wrapper = mount(PremiumBannerCubeGlyph);
    expect(wrapper.element.tagName).to.eq('SPAN');
    expect(wrapper.classes()).to.deep.eq(['pbcube']);
    expect(wrapper.attributes('aria-hidden')).to.eq('true');
    const parts = Array.from((wrapper.element as Element).children).map((el) => el.className);
    expect(parts).to.deep.eq(['pbcube__pill', 'pbcube__cube']);
  });

  it('prints no text — the mark is a drawing, never a word', () => {
    const wrapper = mount(PremiumBannerCubeGlyph);
    expect(wrapper.text()).to.eq('');
  });

  it('a host\'s class and attributes fall through onto the glyph\'s root', () => {
    const wrapper = mount(PremiumBannerCubeGlyph, {attrs: {'class': 'pcard-mi__glyph', 'data-graphic-node': 'banner'}});
    expect(wrapper.classes()).to.include('pbcube');
    expect(wrapper.classes()).to.include('pcard-mi__glyph');
    expect(wrapper.attributes('data-graphic-node')).to.eq('banner');
  });
});
