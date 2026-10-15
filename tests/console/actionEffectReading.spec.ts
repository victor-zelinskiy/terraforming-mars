import {expect} from 'chai';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {gainAtParameterLimit, gainHasNoEffect, victoryPointsSteady} from '@/client/components/actions/actionEffectReading';

/*
 * «N → N» READS TWO WAYS (the owner's decision of 2026-10-15): a parameter at its limit is a wasted step («no
 * effect», and the composer's «already at maximum»), a VP reading short of its next point is a neutral fact — the
 * resource still lands. Never one paint for both.
 */
const gain = (icon: string, current?: number, resulting?: number, amount = 1): ActionEffect =>
  ({direction: 'gain', icon, amount, ...(current !== undefined ? {current, resulting} : {})});

describe('actionEffectReading', () => {
  it('a VP reading short of the next point: steady, never «no effect», never «at maximum»', () => {
    const vp = gain('vp', 2, 2, 0);
    expect(victoryPointsSteady(vp)).to.eq(true);
    expect(gainHasNoEffect(vp)).to.eq(false);
    expect(gainAtParameterLimit(vp)).to.eq(false);
    expect(victoryPointsSteady(gain('vp', 2, 3)), 'a point that moves is not steady').to.eq(false);
  });

  it('a parameter at its limit: «no effect» and «at maximum»', () => {
    for (const icon of ['temperature', 'oxygen', 'venus', 'oceans']) {
      const maxed = gain(icon, 14, 14);
      expect(gainHasNoEffect(maxed), icon).to.eq(true);
      expect(gainAtParameterLimit(maxed), icon).to.eq(true);
    }
    expect(gainAtParameterLimit(gain('oxygen', 12, 13)), 'a step that moves').to.eq(false);
  });

  it('a zero count is «no effect» but not «at maximum» (there is no maximum to be at)', () => {
    const zero = gain('megacredits', 5, 5, 0);
    expect(gainHasNoEffect(zero)).to.eq(true);
    expect(gainAtParameterLimit(zero)).to.eq(false);
    expect(gainHasNoEffect(gain('microbe', undefined, undefined, 0)), 'a pool-less zero').to.eq(true);
    expect(gainHasNoEffect(gain('microbe', undefined, undefined, 1))).to.eq(false);
  });

  it('a cost is never read as a gain that does nothing', () => {
    const cost: ActionEffect = {direction: 'cost', icon: 'oxygen', amount: 1, current: 14, resulting: 14};
    expect(gainHasNoEffect(cost)).to.eq(false);
    expect(gainAtParameterLimit(cost)).to.eq(false);
  });
});
