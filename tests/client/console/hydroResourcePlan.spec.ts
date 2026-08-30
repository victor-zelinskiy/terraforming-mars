import {expect} from 'chai';
import {hydroPlanMixVerdict} from '@/client/console/hydroFlow/hydroResourcePlan';
import {CardName} from '@/common/cards/CardName';
import {Units} from '@/common/Units';

/**
 * THE CLIENT HALF OF THE ORDERED RESOURCE PLAN — the pure prefix walk the
 * payment step and the Decision Rail agree through. Mirrors the server's
 * `deltaAdvancePlan` semantics over server-served numbers; the authoritative
 * verdict stays the server's atomic pre-commit gate.
 */
describe('hydroPlanMixVerdict (the ordered mix sweep)', () => {
  const start = (over: Partial<Units>) => Units.of(over);

  it('no commitments → nothing to solve, nothing reserved', () => {
    const v = hydroPlanMixVerdict({
      start: start({energy: 3}), spend: 2, minSteel: 0, maxSteel: 0,
      gains: [], commitments: [],
    });
    expect(v.feasibleSteelMin).to.eq(undefined);
    expect(v.conflicts).to.deep.eq([]);
    expect(v.reserved).to.deep.eq({energy: 0, steel: 0});
  });

  it('THE BUG CASE: one energy promised to the movement AND the action → an explicit conflict, never a silent fizzle', () => {
    // 1 energy; move 1 step; the pre-selected action needs 1 energy at its
    // own point. No composition exists — the rail must say so.
    const v = hydroPlanMixVerdict({
      start: start({energy: 1}), spend: 1, minSteel: 0, maxSteel: 0,
      gains: [],
      commitments: [{position: 7, card: CardName.DEVELOPMENT_CENTER, cost: {energy: 1}}],
    });
    expect(v.feasibleSteelMin).to.eq(undefined);
    expect(v.conflicts).to.deep.eq([
      {position: 7, card: CardName.DEVELOPMENT_CENTER, resource: 'energy'},
    ]);
  });

  it('DELTA WORKS feeds the movement with steel so the action keeps its energy — and names the reserve', () => {
    // 1 energy + 2 steel; move 2; the action needs the 1 energy. Energy-first
    // starves the action; the FULL steel share keeps it fed — that raise over
    // the plain deficit is exactly what the panel calls reserved.
    const v = hydroPlanMixVerdict({
      start: start({energy: 1, steel: 2}), spend: 2, minSteel: 0, maxSteel: 2,
      gains: [],
      commitments: [{position: 7, card: CardName.DEVELOPMENT_CENTER, cost: {energy: 1}}],
    });
    expect(v.feasibleSteelMin).to.eq(2);
    expect(v.feasibleSteelMax).to.eq(2);
    expect(v.conflicts).to.deep.eq([]);
    // plain deficit = spend 2 − energy 1 = 1 steel; the plan raised it to 2 —
    // one energy stands protected for the action.
    expect(v.reserved.energy).to.eq(1);
  });

  it('the feasible steel set is CONTIGUOUS — its two ends are the dial\'s honest clamps', () => {
    // 3 energy + 2 steel; move 2; action needs 2 energy: s=0 starves it,
    // s=1 and s=2 both work.
    const v = hydroPlanMixVerdict({
      start: start({energy: 3, steel: 2}), spend: 2, minSteel: 0, maxSteel: 2,
      gains: [],
      commitments: [{position: 7, card: CardName.DEVELOPMENT_CENTER, cost: {energy: 2}}],
    });
    expect(v.feasibleSteelMin).to.eq(1);
    expect(v.feasibleSteelMax).to.eq(2);
  });

  it('an EARLIER guaranteed gain funds a LATER commitment (path order, prefix-honest)', () => {
    const v = hydroPlanMixVerdict({
      start: start({energy: 1}), spend: 1, minSteel: 0, maxSteel: 0,
      gains: [{position: 1, gain: {steel: 2}}],
      commitments: [{position: 7, card: CardName.ELECTRO_CATAPULT, cost: {steel: 2}}],
    });
    expect(v.feasibleSteelMin).to.eq(0);
    expect(v.conflicts).to.deep.eq([]);
    expect(v.reserved.steel, 'the commitment\'s own steel is named reserved').to.eq(2);
  });

  it('a LATER gain never funds an EARLIER commitment — the walk is ordered, not a net balance', () => {
    const v = hydroPlanMixVerdict({
      start: start({energy: 1}), spend: 1, minSteel: 0, maxSteel: 0,
      gains: [{position: 6, gain: {steel: 2}}],
      commitments: [{position: 3, card: CardName.ELECTRO_CATAPULT, cost: {steel: 2}}],
    });
    expect(v.feasibleSteelMin).to.eq(undefined);
    expect(v.conflicts).to.deep.eq([
      {position: 3, card: CardName.ELECTRO_CATAPULT, resource: 'steel'},
    ]);
  });

  it('two commitments cannot overbook one pool — the SECOND one is the named conflict', () => {
    const v = hydroPlanMixVerdict({
      start: start({energy: 2}), spend: 1, minSteel: 0, maxSteel: 0,
      gains: [],
      commitments: [
        {position: 6, card: CardName.DEVELOPMENT_CENTER, cost: {energy: 1}},
        {position: 7, card: CardName.WATER_IMPORT_FROM_EUROPA, cost: {energy: 1}},
      ],
    });
    expect(v.feasibleSteelMin).to.eq(undefined);
    expect(v.conflicts).to.deep.eq([
      {position: 7, card: CardName.WATER_IMPORT_FROM_EUROPA, resource: 'energy'},
    ]);
  });

  it('a cost-free commitment never conflicts and reserves nothing', () => {
    const v = hydroPlanMixVerdict({
      start: start({energy: 1}), spend: 1, minSteel: 0, maxSteel: 0,
      gains: [],
      commitments: [{position: 7, card: CardName.BIRDS, cost: {}}],
    });
    expect(v.feasibleSteelMin).to.eq(0);
    expect(v.conflicts).to.deep.eq([]);
    expect(v.reserved).to.deep.eq({energy: 0, steel: 0});
  });

  it('an M€ action cost is independent of the energy movement (different pools, no false conflict)', () => {
    const v = hydroPlanMixVerdict({
      start: start({energy: 2, megacredits: 3}), spend: 2, minSteel: 0, maxSteel: 0,
      gains: [],
      commitments: [{position: 7, card: CardName.WATER_IMPORT_FROM_EUROPA, cost: {megacredits: 3}}],
    });
    expect(v.feasibleSteelMin).to.eq(0);
    expect(v.conflicts).to.deep.eq([]);
  });

  it('a mix that cannot even pay the MOVEMENT is out of the set (no phantom feasibility)', () => {
    const v = hydroPlanMixVerdict({
      start: start({energy: 0, steel: 1}), spend: 2, minSteel: 0, maxSteel: 1,
      gains: [],
      commitments: [{position: 7, card: CardName.BIRDS, cost: {}}],
    });
    expect(v.feasibleSteelMin).to.eq(undefined);
  });
});
