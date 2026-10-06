import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {ActionEffect, ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import {capsuleTimelineReading} from '@/client/console/consoleActionCommit';

/**
 * A TIMELINE ON ONE POOL (TR28 Earth Army Contract — «+1 fighter here, then −2
 * here»): before the press the player reads ONE chip for the card's capsule —
 * where it starts, where it ends — and its two movements IN ORDER. The two
 * chips it replaces read the printed row backwards («БУДЕТ СПИСАНО 2 → 0 · ВЫ
 * ПОЛУЧИТЕ 1 → 2»: the spend before the gain it depends on), and a bare net
 * «1 → 0» would hide that two things happen.
 */
function branchAt(c: number): ActionPreviewBranch {
  return {
    index: -1, title: '', available: true, renderKeys: [], steps: [],
    effects: [
      {direction: 'gain', icon: 'fighter', amount: 1, current: c, resulting: c + 1, note: 'on this card'},
      {direction: 'cost', icon: 'fighter', amount: 2, current: c + 1, resulting: c - 1, note: 'on this card'},
      {direction: 'gain', icon: 'tr', amount: 1, current: 20, resulting: 21},
    ],
  } as ActionPreviewBranch;
}

describe('a capsule TIMELINE — one chip, two movements', () => {
  it('the reading: start → end on the server\'s own numbers, the movements in the printed order', () => {
    const reading = capsuleTimelineReading(branchAt(1))!;
    expect(reading.effect).deep.eq({direction: 'cost', icon: 'fighter', amount: 1, current: 1, resulting: 0, note: 'on this card'});
    expect(reading.moves).deep.eq([1, -2]);
    expect(reading.parts.map((e) => e.direction), 'the two chips it replaces').deep.eq(['gain', 'cost']);
  });

  it('no reading without a spend after the gain (the +1 alone at 0 fighters; Nitrite\'s plain spend)', () => {
    const plainGain = {...branchAt(0), effects: [branchAt(0).effects[0]]} as ActionPreviewBranch;
    expect(capsuleTimelineReading(plainGain)).is.undefined;
    const plainSpend = {...branchAt(3), effects: [{direction: 'cost', icon: 'microbe', amount: 3, current: 3, resulting: 0, note: 'on this card'}]} as ActionPreviewBranch;
    expect(capsuleTimelineReading(plainSpend)).is.undefined;
  });

  it('the chip prints «1 → 0 · +1 −2» in the neutral timeline voice — never a shortfall, never «no effect»', () => {
    const reading = capsuleTimelineReading(branchAt(1))!;
    const w = mount(ActionEffectChip, {...globalConfig, props: {effect: reading.effect as ActionEffect, moves: reading.moves}});
    expect(w.find('.action-effect-chip').classes()).to.include('action-effect-chip--timeline');
    expect(w.find('.action-effect-chip__value').text().replace(/\s/g, '')).to.eq('1→0');
    expect(w.findAll('.action-effect-chip__move').map((m) => m.text())).to.deep.eq(['+1', '−2']);
    expect(w.find('.action-effect-chip__move--in').exists() && w.find('.action-effect-chip__move--out').exists(), 'each movement in its own direction').to.eq(true);
    expect(w.find('.action-effect-chip--insufficient').exists()).to.eq(false);
    w.unmount();
    // A net-zero timeline still moves — it is never «no effect».
    const even = mount(ActionEffectChip, {...globalConfig, props: {effect: {direction: 'gain', icon: 'fighter', amount: 0, current: 2, resulting: 2}, moves: [2, -2]}});
    expect(even.find('.action-effect-chip__note--noeffect').exists()).to.eq(false);
    even.unmount();
  });
});
