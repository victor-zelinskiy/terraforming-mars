import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import PremiumChairGlyph from '@/client/components/premiumCard/PremiumChairGlyph.vue';

/*
 * THE CHAIR on its own: no props, no emit, nothing exposed — ONE inline path in a 16 × 16 box, coloured by its host.
 * That the path is the same drawing as `assets/misc/chair.svg` is `tests/parliament/ChairGlyphParity.spec.ts` (it
 * reads the component's source); this spec is what the component RENDERS.
 */
describe('PremiumChairGlyph', () => {
  it('the root is the svg — decorative, in the chair\'s own 16 × 16 box', () => {
    const wrapper = mount(PremiumChairGlyph);
    expect(wrapper.element.tagName.toLowerCase()).to.eq('svg');
    expect(wrapper.classes()).to.deep.eq(['pchair']);
    expect(wrapper.attributes('viewBox')).to.eq('0 0 16 16');
    expect(wrapper.attributes('aria-hidden')).to.eq('true');
  });

  it('draws ONE path — the chair, a closed outline with the back\'s opening cut out of it', () => {
    const wrapper = mount(PremiumChairGlyph);
    const paths = wrapper.findAll('path');
    expect(paths).to.have.length(1);
    const d = paths[0].attributes('d') ?? '';
    expect(d.startsWith('M5 1h6'), d).to.eq(true);
    expect(d.match(/Z/g), 'the outline and the opening — two closed sub-paths').to.have.length(2);
    // No colour of its own: the host's rule (`fill: currentColor`) paints it.
    expect(paths[0].attributes('fill')).to.eq(undefined);
  });

  it('a host\'s class falls through onto the glyph\'s root', () => {
    const wrapper = mount(PremiumChairGlyph, {attrs: {'class': 'con-quest__chair'}});
    expect(wrapper.classes()).to.include('pchair');
    expect(wrapper.classes()).to.include('con-quest__chair');
  });
});
