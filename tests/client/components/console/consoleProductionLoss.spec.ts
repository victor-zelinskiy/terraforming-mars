import {expect} from 'chai';
import {Units} from '@/common/Units';
import {
  buildProductionLossRows,
  expendableProduction,
  firstSelectableIndex,
  PRODUCTION_UNITS,
} from '@/client/console/consoleProductionLoss';

function units(partial: Partial<Units>): Units {
  return {megacredits: 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0, ...partial};
}

describe('consoleProductionLoss', () => {
  it('expendableProduction gives megacredits a -5 floor, others a 0 floor', () => {
    // M€ production can be reduced down to -5 → expendable = current + 5.
    expect(expendableProduction('megacredits', 3)).to.eq(8);
    expect(expendableProduction('megacredits', 0)).to.eq(5);
    expect(expendableProduction('megacredits', -5)).to.eq(0);
    // Every other resource floors at 0 → expendable = current.
    expect(expendableProduction('steel', 3)).to.eq(3);
    expect(expendableProduction('plants', 0)).to.eq(0);
  });

  it('builds the six rows in cluster order', () => {
    const rows = buildProductionLossRows(units({}), 1);
    expect(rows.map((r) => r.unit)).to.deep.eq([...PRODUCTION_UNITS]);
  });

  it('marks a row at the production floor as disabled', () => {
    const rows = buildProductionLossRows(units({megacredits: -5, steel: 0, plants: 2}), 1);
    const byUnit = (u: keyof Units) => rows.find((r) => r.unit === u)!;
    expect(byUnit('megacredits').disabled).to.be.true; // -5 + 5 = 0 expendable
    expect(byUnit('steel').disabled).to.be.true; // 0 expendable
    expect(byUnit('plants').disabled).to.be.false;
    expect(byUnit('plants').max).to.eq(2);
  });

  it('reports max/current honestly for negative megacredit production', () => {
    const mc = buildProductionLossRows(units({megacredits: -3}), 1).find((r) => r.unit === 'megacredits')!;
    expect(mc.current).to.eq(-3);
    expect(mc.max).to.eq(2); // -3 + 5
    expect(mc.disabled).to.be.false;
  });

  it('flags a row that cannot absorb the full 2-step loss (limitedTo)', () => {
    const rows = buildProductionLossRows(units({energy: 1, plants: 3}), 2);
    const energy = rows.find((r) => r.unit === 'energy')!;
    const plants = rows.find((r) => r.unit === 'plants')!;
    expect(energy.limitedTo).to.eq(1); // 0 < max(1) < cost(2)
    expect(plants.limitedTo).to.be.undefined; // max(3) >= cost(2)
  });

  it('never flags limitedTo for a cost-1 loss', () => {
    const rows = buildProductionLossRows(units({energy: 1}), 1);
    expect(rows.find((r) => r.unit === 'energy')!.limitedTo).to.be.undefined;
  });

  it('firstSelectableIndex skips disabled rows', () => {
    // megacredits (-5 → disabled), steel (0 → disabled), titanium (2 → selectable).
    const rows = buildProductionLossRows(units({megacredits: -5, titanium: 2}), 1);
    expect(firstSelectableIndex(rows)).to.eq(2);
  });

  it('firstSelectableIndex returns 0 when every row is disabled', () => {
    const rows = buildProductionLossRows(units({megacredits: -5}), 1);
    expect(firstSelectableIndex(rows)).to.eq(0);
  });
});
