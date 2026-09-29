import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import BenefitGlyph from '@/client/components/colonies/BenefitGlyph.vue';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {CardResource} from '@/common/CardResource';

/*
 * THE GLYPH OF A CARD-RESOURCE BENEFIT — one kind draws the one sprite it
 * always drew; SEVERAL kinds (the Turmoil Redux Vesta: «mechs, asteroids or
 * fighters») draw ONE unit: the icons joined by «or», the grammar the
 * parliament's yield unit speaks — never one sprite standing for three, and
 * never three separate glyphs.
 */
/** The component's template opens with a comment, so the wrapper root is a FRAGMENT — the glyph is found, never `w.classes()`. */
function glyph(props: Record<string, unknown>) {
  return mount(BenefitGlyph, {
    ...globalConfig,
    props: {
      benefit: {type: ColonyBenefit.ADD_RESOURCES_TO_CARD, quantity: [0, 1, 1, 1, 2, 2, 3]},
      idx: 4,
      ...props,
    },
  });
}

describe('BenefitGlyph — a card resource of one kind or of several', () => {
  it('one kind: the one sprite, the quantity badge, no «or»', () => {
    const w = glyph({cardResources: [CardResource.FLOATER]});
    expect(w.find('.benefit-glyph').classes()).to.not.include('benefit-glyph--multi');
    expect(w.findAll('.benefit-glyph__icon').length).to.eq(1);
    expect(w.find('.benefit-glyph__icon').classes()).to.include('floater');
    expect(w.find('[data-bg-multi]').exists()).to.eq(false);
    expect(w.find('.benefit-glyph__num').text()).to.eq('×2');
  });

  it('the one-kind prop the frozen desktop hosts pass still draws (the list of one is derived)', () => {
    const w = glyph({cardResource: CardResource.MICROBE});
    expect(w.findAll('.benefit-glyph__icon').length).to.eq(1);
    expect(w.find('.benefit-glyph__icon').classes()).to.include('microbe');
  });

  it('several kinds: ONE unit — the icons in the tile\'s order, «or» between them, one badge', () => {
    const w = glyph({cardResources: [CardResource.MECH, CardResource.ASTEROID, CardResource.FIGHTER]});
    expect(w.find('.benefit-glyph').classes()).to.include('benefit-glyph--multi');
    const unit = w.find('[data-bg-multi]');
    expect(unit.exists()).to.eq(true);
    const icons = unit.findAll('.benefit-glyph__icon');
    expect(icons.map((i) => i.classes().find((c) => ['mech', 'asteroid', 'fighter'].includes(c)))).to.deep.eq(['mech', 'asteroid', 'fighter']);
    expect(unit.findAll('.benefit-glyph__or').length, 'an operator between each pair, none before the first').to.eq(2);
    expect(unit.findAll('.benefit-glyph__dash').length, 'the reading register speaks the word, never the hyphen').to.eq(0);
    expect(w.findAll('.benefit-glyph__num').length).to.eq(1);
  });

  it('the COMPACT register (a track cell, a tile cell) joins the icons by a HYPHEN — the word «или» gives its width to the icons', () => {
    const w = glyph({cardResources: [CardResource.MECH, CardResource.ASTEROID, CardResource.FIGHTER], compact: true});
    const root = w.find('.benefit-glyph');
    expect(root.classes()).to.include('benefit-glyph--multi');
    expect(root.classes()).to.include('benefit-glyph--compact');
    const unit = w.find('[data-bg-multi]');
    expect(unit.findAll('.benefit-glyph__icon').length).to.eq(3);
    expect(unit.findAll('.benefit-glyph__dash').length, 'one hyphen between each pair, none before the first').to.eq(2);
    expect(unit.findAll('.benefit-glyph__or').length, 'no word in the compact register').to.eq(0);
    expect(unit.text(), 'the hyphen is drawn, never a glyph of the font').to.eq('');
    // The order is still the tile's: icon, hyphen, icon, hyphen, icon.
    expect(unit.element.children.length).to.eq(5);
    expect(Array.from(unit.element.children).map((c) => c.classList.contains('benefit-glyph__dash') ? '-' : 'i').join('')).to.eq('i-i-i');
  });

  it('a ONE-kind glyph ignores the compact register', () => {
    const w = glyph({cardResources: [CardResource.FLOATER], compact: true});
    expect(w.find('.benefit-glyph').classes()).to.not.include('benefit-glyph--multi');
    expect(w.findAll('.benefit-glyph__icon').length).to.eq(1);
    expect(w.find('.benefit-glyph__dash').exists()).to.eq(false);
  });

  it('the list wins over the one-kind prop when a host passes both', () => {
    const w = glyph({cardResource: CardResource.FLOATER, cardResources: [CardResource.MECH, CardResource.ASTEROID]});
    expect(w.findAll('.benefit-glyph__icon').length).to.eq(2);
    expect(w.find('.floater').exists()).to.eq(false);
  });

  it('the several-kinds unit belongs to the card-resource benefit only', () => {
    const w = glyph({
      benefit: {type: ColonyBenefit.GAIN_RESOURCES, quantity: [2, 2, 2], resource: 'steel'},
      idx: 0,
      cardResources: [CardResource.MECH, CardResource.ASTEROID, CardResource.FIGHTER],
    });
    expect(w.find('.benefit-glyph').classes()).to.not.include('benefit-glyph--multi');
    expect(w.find('[data-bg-multi]').exists()).to.eq(false);
    expect(w.find('.benefit-glyph__icon').classes()).to.include('steel');
  });
});
