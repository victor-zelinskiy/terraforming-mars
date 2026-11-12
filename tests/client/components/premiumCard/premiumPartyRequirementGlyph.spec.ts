/*
 * PremiumPartyRequirementGlyph — «a card with a requirement of ANY party»: the requirements plate in miniature with
 * the wild-party pill seated in it. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). It takes no
 * prop, emits nothing and exposes nothing — ONE drawing; what varies is only what its HOST hangs on it (the face's
 * icon classes, the «waived» state, a size), so the spec is the drawing and that the host's attributes reach the plate.
 */
import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import PremiumPartyRequirementGlyph from '@/client/components/premiumCard/PremiumPartyRequirementGlyph.vue';

describe('PremiumPartyRequirementGlyph — the party-requirement plate', () => {
  it('draws ONE plate: the field with the party pill seated in it — decorative, no text', () => {
    const w = mount(PremiumPartyRequirementGlyph, {...globalConfig});
    const plates = w.findAll('.pprq');
    expect(plates).to.have.length(1);
    expect(plates[0].element.tagName).to.eq('SPAN');
    expect(plates[0].attributes('aria-hidden')).to.eq('true');
    expect(plates[0].find('.pprq > .pprq__field > .pprq__pill').exists()).to.eq(true);
    expect(plates[0].findAll('.pprq__pill')).to.have.length(1);
    expect(w.text()).to.eq('');
  });

  it('what the HOST hangs on it lands on the plate itself — the face\'s icon classes, the «waived» state, its marker', () => {
    // PremiumMechNode's own call: the icon classes, the waived state as a class and as an attribute.
    const w = mount(PremiumPartyRequirementGlyph, {
      ...globalConfig,
      attrs: {'class': 'pcard-ic pcard-ic--party-req pprq--waived', 'data-party-req-waived': 'true'},
    });
    const plate = w.find('.pprq');
    expect(plate.classes()).to.include.members(['pprq', 'pcard-ic', 'pcard-ic--party-req', 'pprq--waived']);
    expect(plate.attributes('data-party-req-waived')).to.eq('true');
    expect(plate.attributes('aria-hidden'), 'its own attribute stays').to.eq('true');
    expect(w.findAll('.pprq--waived'), 'on the plate, and nowhere else').to.have.length(1);
  });

  it('a host that hangs nothing gets the bare plate', () => {
    const w = mount(PremiumPartyRequirementGlyph, {...globalConfig});
    expect(w.find('.pprq').classes()).to.deep.eq(['pprq']);
    expect(w.find('.pprq').attributes('data-party-req-waived')).to.eq(undefined);
  });
});
