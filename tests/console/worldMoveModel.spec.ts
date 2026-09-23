/*
 * THE WORLD'S PART — the client reading (Turmoil Redux, Gas Export RX12).
 *
 * Pure: the moments a surface can be in, the numbers it may honestly print,
 * and the two things this reading exists to be loud about — a move that will
 * NOT happen (named, never silent) and the fact that nobody is credited.
 * The arithmetic itself belongs to `parameterMove.parameterRoom`, which the
 * winner's tile reads too: this spec pins that the reading DELEGATES rather
 * than deriving a second set of numbers.
 */
import {expect} from 'chai';
import {IClientResolution} from '../../src/common/parliament/IClientResolution';
import {ParliamentEnactOutcomeModel} from '../../src/common/models/ParliamentModel';
import {
  worldMoveBlocked, worldMoveReadingOf, worldMoveSentenceOf, worldOutcomesOf, worldParameterLabelKey, worldParameterUnit,
} from '../../src/client/console/parliament/worldMoveModel';
import {parameterRoom} from '../../src/common/parliament/parameterMove';
import {rewardAddressOf, REWARD_ADDRESS} from '../../src/common/parliament/rewardAddress';

const GAS: IClientResolution = {
  id: 'RDX_REDS_GAS_EXPORT', code: 'RX12', module: 'turmoilRedux', party: 'Reds' as never, copies: 1, compatibility: ['venus'],
  renderData: {rows: [], is: 'root'} as never,
  text: {name: 'Gas Export', effect: 'e', world: 'w', quest: 'q'},
  quest: {goal: {kind: 'tr'}, count: 1}, questRenderData: {rows: [], is: 'root'} as never,
  worldMoves: [
    {parameter: 'oxygen', steps: -1, terraformRating: false},
    {parameter: 'venus', steps: 2, terraformRating: false},
  ],
  hasImmediate: true, hasWorldEffect: true, hasWinnerEffect: false, hasPassive: false, hasAction: false,
};

const QUIET: IClientResolution = {...GAS, worldMoves: undefined, hasWorldEffect: false};

const TABLE = {oxygenLevel: 5, temperature: -20, oceans: 3, venusScaleLevel: 10};

const t = {text: (k: string) => k, params: (k: string, p: Array<string>) => `${k}[${p.join('|')}]`};

function record(over: Partial<ParliamentEnactOutcomeModel>): ParliamentEnactOutcomeModel {
  return {step: 'oxygen', part: 'world', kind: 'globalParameter', ...over} as ParliamentEnactOutcomeModel;
}

describe('worldMoveModel', () => {
  it('a resolution with no world part reads NOTHING — a caller prints no empty block', () => {
    expect(worldMoveReadingOf(QUIET, TABLE)).deep.eq([]);
    expect(worldMoveReadingOf(undefined, TABLE)).deep.eq([]);
  });

  it('no table: the DECLARATION alone (reference) — the parameter, the steps, and that nobody is credited', () => {
    const [oxygen, venus] = worldMoveReadingOf(GAS, undefined);
    expect(oxygen).deep.include({parameter: 'oxygen', context: 'reference', unrewarded: true, tr: 0});
    expect(oxygen.room, 'nothing to measure against').is.undefined;
    expect(worldMoveSentenceOf(oxygen, t)).deep.eq({caption: 'Oxygen', detail: 'lowered ${0} step(s)[1]'});
    expect(worldMoveSentenceOf(venus, t)).deep.eq({caption: 'Venus', detail: 'raised ${0} step(s)[2]'});
  });

  it('up for the vote: BOTH rows against the live table, with the SAME arithmetic the server pays by', () => {
    const [oxygen, venus] = worldMoveReadingOf(GAS, TABLE);
    expect(oxygen.context).eq('conditional');
    expect(oxygen.room).deep.eq(parameterRoom(GAS.worldMoves![0], TABLE));
    expect(venus.room).deep.eq(parameterRoom(GAS.worldMoves![1], TABLE));
    expect(worldMoveSentenceOf(oxygen, t)).deep.eq({caption: 'Oxygen', detail: '${0}${2} → ${1}${2}[5|4|%], nobody gets the TR'});
    expect(worldMoveSentenceOf(venus, t)).deep.eq({caption: 'Venus', detail: '${0}${2} → ${1}${2}[10|14|%], nobody gets the TR'});
    expect(worldMoveBlocked(oxygen)).is.false;
  });

  it('…and the enacted phase reads the SAME room, still to come (pending)', () => {
    expect(worldMoveReadingOf(GAS, TABLE, {enacted: true})[0].context).eq('pending');
  });

  it('BOTH ceilings are NAMED, never a silent nothing', () => {
    // Venus at its maximum: no step at all.
    const [, venusMax] = worldMoveReadingOf(GAS, {...TABLE, venusScaleLevel: 30});
    expect(venusMax.room).deep.include({applied: 0, atLimit: true});
    expect(worldMoveBlocked(venusMax)).is.true;
    expect(worldMoveSentenceOf(venusMax, t)).deep.eq({caption: 'Venus', detail: 'at its maximum — no step'});
    // Venus at 28 %: the raise is CUT to one step, and the reading says where it lands.
    const [, venusCut] = worldMoveReadingOf(GAS, {...TABLE, venusScaleLevel: 28});
    expect(venusCut.room).deep.include({applied: 1, resulting: 30});
    expect(worldMoveSentenceOf(venusCut, t).detail).eq('${0}${2} → ${1}${2}[28|30|%], nobody gets the TR');
    // Oxygen at its FLOOR: it cannot go lower.
    const [oxygenFloor] = worldMoveReadingOf(GAS, {...TABLE, oxygenLevel: 0});
    expect(worldMoveBlocked(oxygenFloor)).is.true;
    expect(worldMoveSentenceOf(oxygenFloor, t).detail).eq('at its limit — no step');
  });

  it('the RECORD outranks the table: history, never a number recomputed from today', () => {
    const outcomes = [
      record({step: 'oxygen', amount: -1, parameter: {id: 'oxygen', before: 5, after: 4}, unrewarded: true}),
      record({step: 'venus', amount: 2, parameter: {id: 'venus', before: 10, after: 14}, unrewarded: true}),
    ];
    // …even against a table that has moved on since.
    const [oxygen, venus] = worldMoveReadingOf(GAS, {...TABLE, oxygenLevel: 12, venusScaleLevel: 24}, {enacted: true, outcomes});
    expect(oxygen).deep.include({context: 'applied', unrewarded: true});
    expect(oxygen.applied).deep.eq({before: 5, after: 4, steps: -1});
    expect(oxygen.room, 'a record is not re-measured').is.undefined;
    expect(venus.applied).deep.eq({before: 10, after: 14, steps: 2});
    expect(worldMoveSentenceOf(oxygen, t).detail).eq('${0}${2} → ${1}${2}[5|4|%], nobody gets the TR');
  });

  it('a recorded SKIP carries the server\'s own reason', () => {
    const outcomes = [record({step: 'oxygen', kind: 'skipped', amount: 0, reason: 'Oxygen is at its maximum — it is not reduced', unrewarded: true,
      parameter: {id: 'oxygen', before: 14, after: 14}})];
    const [oxygen] = worldMoveReadingOf(GAS, TABLE, {enacted: true, outcomes});
    expect(oxygen.skipped).eq('Oxygen is at its maximum — it is not reduced');
    expect(worldMoveBlocked(oxygen)).is.true;
    expect(worldMoveSentenceOf(oxygen, t)).deep.eq({caption: 'Oxygen', detail: 'Oxygen is at its maximum — it is not reduced'});
  });

  it('the WORLD records are the ones that name no seat, and their ADDRESS is the board for every viewer', () => {
    const mine = {player: 'blue', step: 'megacredits', part: 'effect', kind: 'stock', amount: 4} as unknown as ParliamentEnactOutcomeModel;
    const world = record({amount: -1, parameter: {id: 'oxygen', before: 5, after: 4}, unrewarded: true});
    expect(worldOutcomesOf([mine, world])).deep.eq([world]);
    const delivery = rewardAddressOf(world, 'red' as never);
    expect(delivery.address).eq(REWARD_ADDRESS.globalParameter);
    expect(delivery.address.stage).eq('board');
    expect(delivery.mine, 'the planet moved for everybody — every viewer reads it').is.true;
    expect(delivery.skipped, 'a lowering PAID: a negative amount is not a skip').is.undefined;
    // …and a move of zero steps IS a skip, named by the record or by the address.
    expect(rewardAddressOf(record({amount: 0, parameter: {id: 'oxygen', before: 14, after: 14}}), 'red' as never).skipped)
      .eq(REWARD_ADDRESS.globalParameter.skipTitle);
  });

  it('WHO IS CREDITED can be said ONCE by the caller — `credit: false` leaves the row to the numbers', () => {
    const [oxygen] = worldMoveReadingOf(GAS, TABLE);
    expect(worldMoveSentenceOf(oxygen, t, {credit: false}).detail).eq('${0}${2} → ${1}${2}[5|4|%]');
    expect(worldMoveSentenceOf(oxygen, t).detail, 'and by default it is on the row').to.contain('nobody gets the TR');
  });

  it('the vocabulary: one label and one unit per parameter', () => {
    expect(worldParameterLabelKey('oxygen')).eq('Oxygen');
    expect(worldParameterLabelKey('venus')).eq('Venus');
    expect(worldParameterLabelKey('temperature')).eq('Temperature');
    expect(worldParameterLabelKey('oceans')).eq('Oceans');
    expect(worldParameterUnit('oxygen')).eq('%');
    expect(worldParameterUnit('venus')).eq('%');
    expect(worldParameterUnit('temperature')).eq('°C');
    expect(worldParameterUnit('oceans')).eq('');
  });
});
