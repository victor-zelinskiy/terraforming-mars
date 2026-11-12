/*
 * PremiumRequirementOperator — the ≥ / ≤ threshold glyph of a requirement cassette, drawn as an SVG in three stroke
 * layers (engrave · metal · highlight). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). ONE
 * prop (`comparator`: the view-model's own 'min' | 'max'), no emit, nothing exposed; the spec is what it draws for
 * each comparator.
 */
import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import PremiumRequirementOperator from '@/client/components/premiumCard/PremiumRequirementOperator.vue';

const LAYERS = ['.pcard-op__shadow', '.pcard-op__metal', '.pcard-op__hi'];

function operator(comparator: 'min' | 'max') {
  return mount(PremiumRequirementOperator, {...globalConfig, props: {comparator}});
}

/** The two strokes of one layer: [chevron, bar]. */
function strokes(w: ReturnType<typeof operator>, layer: string): Array<string | null> {
  return w.findAll(`${layer} > path`).map((p) => p.element.getAttribute('d'));
}

describe('PremiumRequirementOperator — the threshold glyph', () => {
  it('«min» is ≥: the chevron\'s apex on the RIGHT, the equal-bar beneath — the same two strokes in all three layers', () => {
    const w = operator('min');
    expect(w.element.tagName).to.eq('SPAN');
    expect(w.classes()).to.deep.eq(['pcard-op', 'pcard-op--min']);
    expect(w.attributes('aria-hidden')).to.eq('true');
    const svg = w.find('svg.pcard-op__svg');
    expect(svg.exists()).to.eq(true);
    expect(svg.element.getAttribute('viewBox')).to.eq('0 0 24 28');
    expect(svg.element.getAttribute('focusable')).to.eq('false');
    for (const layer of LAYERS) {
      expect(strokes(w, layer), layer).to.deep.eq(['M5 4 L19 13.5 L5 23', 'M5 26.6 L19.5 26.6']);
    }
  });

  it('«max» is ≤: the mirrored chevron — apex on the LEFT', () => {
    const w = operator('max');
    expect(w.classes()).to.deep.eq(['pcard-op', 'pcard-op--max']);
    for (const layer of LAYERS) {
      expect(strokes(w, layer), layer).to.deep.eq(['M19 4 L5 13.5 L19 23', 'M4.5 26.6 L19 26.6']);
    }
    expect(w.find('svg').element.getAttribute('viewBox'), 'one box for both glyphs').to.eq('0 0 24 28');
  });

  it('follows its prop — the glyph and its modifier class flip together', async () => {
    const w = operator('min');
    await w.setProps({comparator: 'max'});
    expect(w.classes()).to.include('pcard-op--max');
    expect(w.classes()).to.not.include('pcard-op--min');
    expect(strokes(w, '.pcard-op__metal')[0]).to.eq('M19 4 L5 13.5 L19 23');

    await w.setProps({comparator: 'min'});
    expect(w.classes()).to.include('pcard-op--min');
    expect(strokes(w, '.pcard-op__metal')[0]).to.eq('M5 4 L19 13.5 L5 23');
  });
});
