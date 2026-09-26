/*
 * A TILE TAKEN OFF THE BOARD — the client reading (Turmoil Redux, Water Export RX33).
 *
 * Pure: the moments a surface can be in, the numbers it may honestly print,
 * and the two things this reading exists to be loud about — a removal that
 * will NOT happen (the card's clause, or an empty board — named, never silent)
 * and WHO chooses the cell. The arithmetic belongs to
 * `tileRemoval.tileRemovalRoom`, which the server's own step decides by: this
 * spec pins that the reading DELEGATES rather than deriving a second set of
 * numbers, and that the RECORD outranks the board.
 */
import {expect} from 'chai';
import {IClientResolution} from '../../src/common/parliament/IClientResolution';
import {ParliamentEnactOutcomeModel} from '../../src/common/models/ParliamentModel';
import {SpaceModel} from '../../src/common/models/SpaceModel';
import {TileType} from '../../src/common/TileType';
import {MAX_OCEAN_TILES} from '../../src/common/constants';
import {
  NO_REMOVABLE_OCEAN_REASON, OCEANS_AT_MAX_REASON, TILE_REMOVAL_STEP_KEY, tileRemovalRoom,
} from '../../src/common/parliament/tileRemoval';
import {REWARD_ADDRESS, rewardAddressOf} from '../../src/common/parliament/rewardAddress';
import {
  NO_REMOVABLE_OCEAN_KEY, OCEANS_AT_MAX_KEY, isTileRemovalRecord, tileRemovalBlocked, tileRemovalChipOf, tileRemovalReadingOf,
  tileRemovalRecordOf, tileRemovalSentenceOf, tileRemovalTableOf,
} from '../../src/client/console/parliament/tileRemovalModel';
import {familyOf} from '../../src/client/console/parliament/resolutionFamily';
import {sittingBeats} from '../../src/client/console/parliament/sittingBeats';
import {resultsPlanetMoves} from '../../src/client/console/parliament/parliamentResultsModel';
import {ParliamentPhaseSummaryModel} from '../../src/common/models/ParliamentModel';

const WATER: IClientResolution = {
  id: 'RDX_REDS_WATER_EXPORT', code: 'RX33', module: 'turmoilRedux', party: 'Reds' as never, copies: 1, compatibility: [],
  renderData: {rows: [], is: 'root'} as never,
  text: {name: 'Water Export', effect: 'e', world: 'w', passive: 'p', quest: 'q'},
  quest: {goal: {kind: 'tag', tag: 'jovian' as never}, count: 2}, questRenderData: {rows: [], is: 'root'} as never,
  tileRemoval: {tile: 'ocean', executor: 'first-player'},
  hasImmediate: true, hasWorldEffect: true, hasWinnerEffect: false, hasPassive: true, hasAction: false,
};

const QUIET: IClientResolution = {...WATER, tileRemoval: undefined, hasWorldEffect: false};

const t = {text: (k: string) => k, params: (k: string, p: Array<string>) => `${k}[${p.join('|')}]`};

function record(over: Partial<ParliamentEnactOutcomeModel>): ParliamentEnactOutcomeModel {
  return {step: TILE_REMOVAL_STEP_KEY, part: 'world', kind: 'tileRemoved', ...over} as ParliamentEnactOutcomeModel;
}

function cell(id: string, tileType?: TileType): SpaceModel {
  return {id, x: 0, y: 0, spaceType: 'ocean', bonus: [], tileType} as unknown as SpaceModel;
}

describe('tileRemovalModel', () => {
  it('a resolution with no removal part reads NOTHING — a caller prints no empty block', () => {
    expect(tileRemovalReadingOf(QUIET, {oceans: 3})).is.undefined;
    expect(tileRemovalReadingOf(undefined, {oceans: 3})).is.undefined;
  });

  it('the stand opens the WORLD-MOVE family for a removal from the declaration alone', () => {
    expect(familyOf({tileRemoval: WATER.tileRemoval})).eq('world-move');
    expect(familyOf({})).eq('influence');
  });

  it('no table: the DECLARATION alone (reference) — one tile leaves, the first player chooses', () => {
    const reading = tileRemovalReadingOf(WATER, undefined)!;
    expect(reading).deep.include({context: 'reference'});
    expect(reading.room, 'nothing to measure against').is.undefined;
    expect(tileRemovalSentenceOf(reading, t)).deep.eq({caption: 'Oceans', detail: 'one tile leaves — the first player chooses which'});
    expect(tileRemovalChipOf(reading), 'no chip without a table').is.undefined;
  });

  it('up for the vote: the room against the live board, with the SAME arithmetic the server decides by', () => {
    const reading = tileRemovalReadingOf(WATER, {oceans: 3, removableOceans: 3})!;
    expect(reading.context).eq('conditional');
    expect(reading.room).deep.eq(tileRemovalRoom(WATER.tileRemoval!, {oceans: 3, removableOceans: 3}));
    expect(tileRemovalBlocked(reading)).is.false;
    expect(tileRemovalSentenceOf(reading, t)).deep.eq({caption: 'Oceans', detail: '${0} → ${1}[3|2]'});
    expect(tileRemovalChipOf(reading)).deep.eq({parameter: 'oceans', before: 3, after: 2, steps: -1, unrewarded: false});
    expect(tileRemovalReadingOf(WATER, {oceans: 3}, {enacted: true})!.context, 'the enacted phase reads the same room, still to come').eq('pending');
  });

  it('the two edges are NAMED before the vote: the card\'s clause (at the maximum) and the empty board', () => {
    const max = tileRemovalReadingOf(WATER, {oceans: MAX_OCEAN_TILES})!;
    expect(tileRemovalBlocked(max)).is.true;
    expect(tileRemovalSentenceOf(max, t).detail).eq(OCEANS_AT_MAX_KEY);
    expect(tileRemovalChipOf(max)).deep.include({before: MAX_OCEAN_TILES, after: MAX_OCEAN_TILES, steps: 0, skipped: OCEANS_AT_MAX_KEY});
    const none = tileRemovalReadingOf(WATER, {oceans: 0})!;
    expect(tileRemovalBlocked(none)).is.true;
    expect(tileRemovalSentenceOf(none, t).detail).eq(NO_REMOVABLE_OCEAN_KEY);
    const upgraded = tileRemovalReadingOf(WATER, {oceans: 2, removableOceans: 0})!;
    expect(tileRemovalBlocked(upgraded), 'every ocean upgraded — nothing the step can offer').is.true;
    expect(tileRemovalSentenceOf(upgraded, t).detail).eq(NO_REMOVABLE_OCEAN_KEY);
  });

  it('the board as the room reads it: every ocean tile counts, only the PLAIN ones are removable', () => {
    expect(tileRemovalTableOf(undefined)).is.undefined;
    expect(tileRemovalTableOf([])).deep.eq({oceans: 0, removableOceans: 0});
    const spaces = [cell('a', TileType.OCEAN), cell('b', TileType.OCEAN_CITY), cell('c'), cell('d', TileType.GREENERY), cell('e', TileType.WETLANDS)];
    expect(tileRemovalTableOf(spaces)).deep.eq({oceans: 3, removableOceans: 1});
  });

  it('the RECORD outranks the board: applied reads the server\'s own cell, count and chooser', () => {
    const outcomes = [record({space: '17', tile: TileType.OCEAN, actor: 'red' as never, amount: -1, parameter: {id: 'oceans', before: 3, after: 2}})];
    const reading = tileRemovalReadingOf(WATER, {oceans: 9}, {enacted: true, outcomes})!;
    expect(reading.context).eq('applied');
    expect(reading.room, 'never re-measured from today\'s board').is.undefined;
    expect(reading.applied).deep.eq({space: '17', before: 3, after: 2, actor: 'red'});
    expect(reading.skipped).is.undefined;
    expect(tileRemovalSentenceOf(reading, t, (c) => `name(${c})`)).deep.eq({caption: 'Oceans', detail: '${0} → ${1}[3|2] · chosen by ${0}[name(red)]'});
    expect(tileRemovalSentenceOf(reading, t), 'no name resolver: the numbers alone').deep.eq({caption: 'Oceans', detail: '${0} → ${1}[3|2]'});
    expect(tileRemovalChipOf(reading)).deep.eq({parameter: 'oceans', before: 3, after: 2, steps: -1, unrewarded: false});
  });

  it('a recorded SKIP reads the server\'s own reason; a record with no cell is a skip named by the address', () => {
    const skipped = [record({kind: 'skipped', reason: OCEANS_AT_MAX_REASON, amount: 0, parameter: {id: 'oceans', before: 9, after: 9}})];
    const reading = tileRemovalReadingOf(WATER, {oceans: 9}, {outcomes: skipped})!;
    expect(reading.skipped).eq(OCEANS_AT_MAX_REASON);
    expect(tileRemovalBlocked(reading)).is.true;
    expect(tileRemovalSentenceOf(reading, t).detail).eq(OCEANS_AT_MAX_REASON);
    expect(tileRemovalChipOf(reading)).deep.include({before: 9, after: 9, steps: 0, skipped: OCEANS_AT_MAX_REASON});
    const unnamed = tileRemovalReadingOf(WATER, undefined, {outcomes: [record({amount: 0, parameter: {id: 'oceans', before: 1, after: 1}})]})!;
    expect(unnamed.skipped).eq(REWARD_ADDRESS.tileRemoved.skipTitle);
    const empty = tileRemovalReadingOf(WATER, undefined, {outcomes: [record({kind: 'skipped', reason: NO_REMOVABLE_OCEAN_REASON})]})!;
    expect(empty.skipped).eq(NO_REMOVABLE_OCEAN_REASON);
  });

  it('a removal record is a WORLD record — no seat, the shared step\'s key; a seat\'s record never is', () => {
    expect(isTileRemovalRecord(record({space: '17'}))).is.true;
    expect(isTileRemovalRecord(record({kind: 'skipped', reason: OCEANS_AT_MAX_REASON}))).is.true;
    expect(isTileRemovalRecord(record({player: 'blue' as never}))).is.false;
    expect(isTileRemovalRecord(record({part: 'winner'}))).is.false;
    expect(isTileRemovalRecord({step: 'megacredits', part: 'effect', kind: 'stock', player: 'blue'} as never)).is.false;
    expect(isTileRemovalRecord({step: 'temperature', part: 'world', kind: 'globalParameter'} as never), 'a parameter move is the planet\'s own reading').is.false;
    expect(tileRemovalRecordOf([record({space: '17'})])?.space).eq('17');
    expect(tileRemovalRecordOf(undefined)).is.undefined;
  });

  it('the address delivers it to EVERY viewer as a board record, and the sitting plays it as a WORLD beat', () => {
    const removed = record({space: '17', amount: -1, parameter: {id: 'oceans', before: 3, after: 2}});
    const delivery = rewardAddressOf(removed, 'blue' as never);
    expect(delivery.mine).is.true;
    expect(delivery.address.reading).eq('world-removal');
    expect(delivery.skipped).is.undefined;
    const summary = {
      generation: 3, final: false, support: [], refreshed: [], lobbyRefilled: [], outcomes: [removed],
      winner: {instance: 'RDX_REDS_WATER_EXPORT#0', resolution: 'RDX_REDS_WATER_EXPORT', party: 'Reds', votes: 1},
      enacted: {instance: 'RDX_REDS_WATER_EXPORT#0', resolution: 'RDX_REDS_WATER_EXPORT', party: 'Reds'},
    } as unknown as ParliamentPhaseSummaryModel;
    const beats = sittingBeats(summary, 'blue' as never, 'live');
    expect(beats.filter((b) => b.kind === 'world').map((b) => b.outcome?.step)).deep.eq([TILE_REMOVAL_STEP_KEY]);
    // …and the RESULTS' planet line prints the ocean count it moved, with no seat and no rating.
    expect(resultsPlanetMoves(summary)).deep.eq([{id: `world:${TILE_REMOVAL_STEP_KEY}:0`, parameter: 'oceans', before: 3, after: 2, steps: -1, unrewarded: false}]);
  });
});
