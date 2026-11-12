/*
 * PremiumResourceCardGlyph — «a card that already HOLDS a resource»: the white card with its three cubes, or — with
 * `wild` — the same holder carrying ONE «?» square (a KIND of resource). A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md). ONE prop (`wild`), no emit, nothing exposed; the spec is what it draws for the prop,
 * and that the classes its hosts hang on it (the face's icon, the counted glyph's holder) reach the drawing.
 */
import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import PremiumResourceCardGlyph from '@/client/components/premiumCard/PremiumResourceCardGlyph.vue';

function holder(props: Record<string, unknown> = {}, attrs: Record<string, unknown> = {}) {
  return mount(PremiumResourceCardGlyph, {...globalConfig, props, attrs});
}

describe('PremiumResourceCardGlyph — the resource holder', () => {
  it('by default the holder carries its THREE cubes under the band — no «?», no wild marker', () => {
    const w = holder();
    expect(w.element.tagName).to.eq('SPAN');
    expect(w.classes()).to.deep.eq(['presourcecard']);
    expect(w.attributes('aria-hidden')).to.eq('true');
    expect(w.attributes('data-resource-card-wild')).to.eq(undefined);
    const cover = w.find('.presourcecard > .presourcecard__cover');
    expect(cover.exists()).to.eq(true);
    expect(cover.findAll('.presourcecard__band')).to.have.length(1);
    expect(cover.findAll('.presourcecard__cube').map((c) => c.classes().filter((k) => k.startsWith('presourcecard__cube--')))).to.deep.eq([
      ['presourcecard__cube--a'], ['presourcecard__cube--b'], ['presourcecard__cube--c'],
    ]);
    expect(cover.find('.presourcecard__wild').exists()).to.eq(false);
  });

  it('`wild` — the SAME holder with ONE «?» square instead of the cubes, and it says so on its root', () => {
    const w = holder({wild: true});
    expect(w.classes()).to.include.members(['presourcecard', 'presourcecard--wild']);
    expect(w.attributes('data-resource-card-wild')).to.eq('true');
    expect(w.findAll('.presourcecard__band'), 'the same cover').to.have.length(1);
    expect(w.findAll('.presourcecard__wild')).to.have.length(1);
    expect(w.find('.presourcecard__cube').exists(), 'three cubes and one «?» are two rules').to.eq(false);
  });

  it('follows its prop, and a host\'s class lands on the drawing itself', async () => {
    // PremiumCountGlyph's own call: `class="pcglyph__holder"` + `:wild`.
    const w = holder({wild: false}, {'class': 'pcglyph__holder'});
    expect(w.classes()).to.include.members(['presourcecard', 'pcglyph__holder']);
    expect(w.findAll('.presourcecard__cube')).to.have.length(3);

    await w.setProps({wild: true});
    expect(w.classes()).to.include.members(['presourcecard', 'presourcecard--wild', 'pcglyph__holder']);
    expect(w.attributes('data-resource-card-wild')).to.eq('true');
    expect(w.findAll('.presourcecard__cube')).to.have.length(0);
    expect(w.findAll('.presourcecard__wild')).to.have.length(1);

    await w.setProps({wild: false});
    expect(w.attributes('data-resource-card-wild')).to.eq(undefined);
    expect(w.findAll('.presourcecard__cube')).to.have.length(3);
  });
});
