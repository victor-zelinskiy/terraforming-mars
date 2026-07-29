import {expect} from 'chai';
import {PublicPlayerModel} from '../../../../src/common/models/PlayerModel';
import {targetImpactRows, targetImpactText} from '../../../../src/client/components/modalInputs/targetImpactRows';

function player(fields: Partial<PublicPlayerModel>): PublicPlayerModel {
  return {color: 'red', ...fields} as PublicPlayerModel;
}

describe('targetImpactRows', () => {
  it('SERVER impacts win — a MarsBot track regression is rendered verbatim, never re-derived', () => {
    const rows = targetImpactRows('neutral', {
      impacts: [{color: 'neutral', changes: [{icon: 'building', from: 3, to: 2, scope: 'track', steps: 1}]}],
      // deliberately contradictory client-side inputs: they must be ignored
      icon: 'energy', amount: 1, scope: 'production', player: player({energyProduction: 9}),
    });
    expect(rows).deep.eq([{icon: 'building', from: 3, to: 2, scope: 'track', steps: 1}]);
    expect(targetImpactText(rows)).eq('3 → 2');
  });

  /**
   * The regression this helper exists for: the public model's production fields
   * are SINGULAR (`megacreditProduction`, `plantProduction`), so the old
   * `icon + 'Production'` shortcut resolved to `undefined` and the picker row
   * showed NO before→after at all for the two most-attacked productions.
   */
  it('derives M€ / plants PRODUCTION (the singular model fields the naive concat missed)', () => {
    expect(targetImpactRows('red', {icon: 'megacredits', amount: 2, scope: 'production', player: player({megacreditProduction: 4})}))
      .deep.eq([{icon: 'megacredits', from: 4, to: 2, scope: 'production', steps: 2}]);
    expect(targetImpactRows('red', {icon: 'plants', amount: 1, scope: 'production', player: player({plantProduction: 3})}))
      .deep.eq([{icon: 'plants', from: 3, to: 2, scope: 'production', steps: 1}]);
  });

  it('M€ production floors at −5, every other pool at 0', () => {
    expect(targetImpactRows('red', {icon: 'megacredits', amount: 4, scope: 'production', player: player({megacreditProduction: -3})})[0].to).eq(-5);
    expect(targetImpactRows('red', {icon: 'energy', amount: 4, scope: 'production', player: player({energyProduction: 1})})[0].to).eq(0);
    expect(targetImpactRows('red', {icon: 'plants', amount: 9, scope: 'stock', player: player({plants: 3})})[0].to).eq(0);
  });

  it('stock scope reads the flat field; an unknown icon or a missing figure yields NO row (never a fake 0 → 0)', () => {
    expect(targetImpactRows('red', {icon: 'steel', amount: 2, scope: 'stock', player: player({steel: 5})}))
      .deep.eq([{icon: 'steel', from: 5, to: 3, scope: 'stock'}]);
    expect(targetImpactRows('red', {icon: 'floater', amount: 1, scope: 'stock', player: player({})})).to.have.length(0);
    expect(targetImpactRows('red', {icon: 'steel', amount: undefined, scope: 'stock', player: player({steel: 5})})).to.have.length(0);
    expect(targetImpactText([])).eq('');
  });
});
