/*
 * PremiumCostBadge — the premium face's COST CLUSTER: the megacredit tile with the PRINTED cost, and — only under a
 * live discount / surcharge — the compact delta chip docked to it. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md). ONE prop (the cost view-model), no emit, nothing exposed; the spec is what it renders
 * for that cost.
 */
import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import PremiumCostBadge from '@/client/components/premiumCard/PremiumCostBadge.vue';
import {PremiumCostVM} from '@/client/components/premiumCard/premiumCardViewModel';

function badge(cost: PremiumCostVM) {
  return mount(PremiumCostBadge, {...globalConfig, props: {cost}});
}

describe('PremiumCostBadge — the printed cost and its live delta', () => {
  it('prints the PRINTED cost alone when nothing bends it — no chip, the template starting with its root', () => {
    const w = badge({printed: 23, effective: 23, delta: 0});
    expect(w.classes()).to.include('pcard__cost');
    expect(w.classes()).to.not.include('pcard__cost--three');
    expect(w.attributes('aria-hidden')).to.eq('true');
    expect(w.find('.pcard__cost-badge > .pcard__cost-value').text()).to.eq('23');
    expect(w.find('.pcard__cost-delta').exists()).to.eq(false);
  });

  it('a DISCOUNT is the «−N» chip beside the printed cost — the printed number never changes', () => {
    const w = badge({printed: 23, effective: 19, delta: -4});
    expect(w.find('.pcard__cost-value').text(), 'the card\'s physical identity').to.eq('23');
    const chip = w.find('.pcard__cost-delta');
    expect(chip.exists()).to.eq(true);
    // The typographic minus (U+2212), never a hyphen.
    expect(chip.text()).to.eq('−4');
    expect(chip.classes()).to.not.include('pcard__cost-delta--surcharge');
  });

  it('a SURCHARGE is the «+N» chip in its own form', () => {
    const w = badge({printed: 8, effective: 11, delta: 3});
    const chip = w.find('.pcard__cost-delta');
    expect(chip.text()).to.eq('+3');
    expect(chip.classes()).to.include('pcard__cost-delta--surcharge');
  });

  it('a three-digit cost wears its own modifier, and the cluster follows its prop', async () => {
    const w = badge({printed: 100, effective: 100, delta: 0});
    expect(w.classes()).to.include('pcard__cost--three');
    expect(w.find('.pcard__cost-value').text()).to.eq('100');

    await w.setProps({cost: {printed: 41, effective: 39, delta: -2}});
    expect(w.classes()).to.not.include('pcard__cost--three');
    expect(w.find('.pcard__cost-value').text()).to.eq('41');
    expect(w.find('.pcard__cost-delta').text()).to.eq('−2');

    await w.setProps({cost: {printed: 41, effective: 41, delta: 0}});
    expect(w.find('.pcard__cost-delta').exists()).to.eq(false);
  });
});
