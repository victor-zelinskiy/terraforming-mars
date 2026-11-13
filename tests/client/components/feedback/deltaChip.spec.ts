/*
 * DeltaChip — the «+N / −N» chip beside a metric that changed. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): two props in, nothing out — the spec is what it renders for them, and that an
 * in-place change re-keys ONLY the number (the accumulator is seen counting; the chip itself stays mounted).
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import DeltaChip from '@/client/components/feedback/DeltaChip.vue';

function chip(props: Record<string, unknown>, attrs: Record<string, unknown> = {}) {
  return mount(DeltaChip, {props, attrs, global: {config: globalConfig.global.config}});
}

describe('DeltaChip — the delta beside a metric', () => {
  it('reads its amount as a sign and a magnitude, in the variant\'s and the polarity\'s classes', () => {
    const gain = chip({amount: 5, variant: 'resource-stock'});
    expect(gain.classes()).to.deep.eq(['delta-chip', 'delta-chip--resource-stock', 'delta-chip--positive']);
    expect(gain.attributes('aria-hidden')).to.eq('true');
    expect(gain.find('.delta-chip__sign').text()).to.eq('+');
    expect(gain.find('.delta-chip__value').text()).to.eq('5');
    expect(gain.text()).to.eq('+5');

    const loss = chip({amount: -3, variant: 'score'});
    expect(loss.classes()).to.deep.eq(['delta-chip', 'delta-chip--score', 'delta-chip--negative']);
    expect(loss.find('.delta-chip__sign').text(), 'a real minus, not a hyphen').to.eq('−');
    expect(loss.find('.delta-chip__value').text(), 'the magnitude carries no sign of its own').to.eq('3');

    const none = chip({amount: 0, variant: 'tag'});
    expect(none.classes()).to.deep.eq(['delta-chip', 'delta-chip--tag', 'delta-chip--neutral']);
    expect(none.find('.delta-chip__sign').text()).to.eq('');
    expect(none.find('.delta-chip__value').text()).to.eq('0');
  });

  it('the arrival wears no tick; an in-place change replaces ONLY the number and ticks it', async () => {
    const w = chip({amount: 3, variant: 'misc'});
    const root = w.element;
    const sign = w.find('.delta-chip__sign').element;
    const first = w.find('.delta-chip__value').element;
    expect(w.find('.delta-chip__value').classes(), 'the chip\'s own enter carries the arrival').to.deep.eq(['delta-chip__value']);

    await w.setProps({amount: 7});
    const second = w.find('.delta-chip__value').element;
    expect(w.element, 'the chip stays mounted').to.eq(root);
    expect(w.find('.delta-chip__sign').element, 'the sign is never keyed').to.eq(sign);
    expect(second, 'a NEW node — its tick replays from zero').to.not.eq(first);
    expect(w.find('.delta-chip__value').classes()).to.deep.eq(['delta-chip__value', 'delta-chip__value--tick']);
    expect(w.text()).to.eq('+7');

    await w.setProps({amount: 9});
    expect(w.find('.delta-chip__value').element, 'every change is its own tick').to.not.eq(second);
    expect(w.text()).to.eq('+9');

    // The variant alone is not a change of the value: the number keeps its node.
    const third = w.find('.delta-chip__value').element;
    await w.setProps({variant: 'score'});
    // (the SET of classes: the order a runtime writes them in after an update is not a contract)
    expect(w.classes()).to.have.members(['delta-chip', 'delta-chip--score', 'delta-chip--positive']);
    expect(w.find('.delta-chip__value').element).to.eq(third);
  });

  it('the template STARTS WITH ITS ROOT — what a host puts on the chip lands on the chip itself', () => {
    const w = chip({amount: 2, variant: 'global-parameter'}, {'class': 'host-chip', 'data-from-host': 'yes'});
    expect((w.element as HTMLElement).tagName).to.eq('SPAN');
    expect(w.classes()).to.include.members(['delta-chip', 'delta-chip--global-parameter', 'delta-chip--positive', 'host-chip']);
    expect(w.attributes('data-from-host')).to.eq('yes');
  });
});
