/*
 * THE COLONY TABLE'S PART — the client reading (Turmoil Redux, Unity Budget RX29).
 *
 * Pure: the moments a surface can be in, the numbers it may honestly print,
 * and the one thing this reading exists to be loud about — a track at its end
 * that did NOT move (named, never a silent nothing). The arithmetic belongs to
 * `colonyTrackAdvance.colonyTrackRoom`, which the server's own step reads:
 * this spec pins that the reading DELEGATES rather than deriving a second set
 * of numbers, and that the RECORD outranks the table.
 */
import {expect} from 'chai';
import {IClientResolution} from '../../src/common/parliament/IClientResolution';
import {ParliamentEnactOutcomeModel} from '../../src/common/models/ParliamentModel';
import {ColonyModel} from '../../src/common/models/ColonyModel';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {MAX_COLONY_TRACK_POSITION} from '../../src/common/constants';
import {COLONY_TRACK_STEP_KEY, colonyTrackRoom} from '../../src/common/parliament/colonyTrackAdvance';
import {REWARD_ADDRESS, rewardAddressOf} from '../../src/common/parliament/rewardAddress';
import {
  COLONY_TRACK_AT_MAX_KEY, COLONY_TRACK_SUMMARY_KEY, colonyTrackChipsOf, colonyTrackReadingOf, colonyTrackRecordOf, colonyTrackTileSentenceOf,
  colonyTrackTilesOf, isColonyTrackRecord,
} from '../../src/client/console/parliament/colonyTrackModel';

const BUDGET: IClientResolution = {
  id: 'RDX_UNITY_UNITY_BUDGET', code: 'RX29', module: 'turmoilRedux', party: 'Unity' as never, copies: 1, compatibility: [],
  renderData: {rows: [], is: 'root'} as never,
  text: {name: 'Unity Budget', effect: 'e', world: 'w', quest: 'q'},
  quest: {goal: {kind: 'tag', tag: 'earth' as never}, count: 2}, questRenderData: {rows: [], is: 'root'} as never,
  trackAdvance: {steps: 2},
  hasImmediate: true, hasWorldEffect: true, hasWinnerEffect: false, hasPassive: false, hasAction: false,
};

const QUIET: IClientResolution = {...BUDGET, trackAdvance: undefined, hasWorldEffect: false};

function colony(name: ColonyName, trackPosition: number, isActive = true): ColonyModel {
  return {name, trackPosition, isActive, colonies: [], visitor: undefined};
}

const TABLE: Array<ColonyModel> = [
  colony(ColonyName.LUNA, 3),
  colony(ColonyName.CALLISTO, MAX_COLONY_TRACK_POSITION - 1),
  colony(ColonyName.IO, MAX_COLONY_TRACK_POSITION),
  colony(ColonyName.MIRANDA, 1, false),
];

const t = {text: (k: string) => k, params: (k: string, p: Array<string>) => `${k}[${p.join('|')}]`};

function record(over: Partial<ParliamentEnactOutcomeModel>): ParliamentEnactOutcomeModel {
  return {step: COLONY_TRACK_STEP_KEY, part: 'world', kind: 'colonyTrack', amount: 2, ...over} as ParliamentEnactOutcomeModel;
}

describe('colonyTrackModel', () => {
  it('a resolution with no colony-table part reads NOTHING — a caller prints no empty block', () => {
    expect(colonyTrackReadingOf(QUIET, TABLE)).is.undefined;
    expect(colonyTrackReadingOf(undefined, TABLE)).is.undefined;
  });

  it('no table: the DECLARATION alone (reference) — the steps, no tiles', () => {
    const reading = colonyTrackReadingOf(BUDGET, undefined)!;
    expect(reading).deep.eq({advance: {steps: 2}, context: 'reference', tiles: []});
  });

  it('up for the vote: every ACTIVE tile against the live table, with the SAME arithmetic the server moves by; an inactive tile is not a track', () => {
    const reading = colonyTrackReadingOf(BUDGET, TABLE)!;
    expect(reading.context).eq('conditional');
    expect(reading.tiles.map((tile) => tile.colony)).deep.eq([ColonyName.LUNA, ColonyName.CALLISTO, ColonyName.IO]);
    const [luna, callisto, io] = reading.tiles;
    expect(luna).deep.eq({colony: ColonyName.LUNA, before: 3, after: 5, steps: 2, atMax: false});
    const callistoRoom = colonyTrackRoom({steps: 2}, MAX_COLONY_TRACK_POSITION - 1);
    expect(callisto).deep.eq({colony: ColonyName.CALLISTO, before: callistoRoom.current, after: callistoRoom.resulting, steps: 1, atMax: false});
    expect(io, 'the END OF THE TRACK is named, never a silent nothing').deep.eq({colony: ColonyName.IO, before: MAX_COLONY_TRACK_POSITION, after: MAX_COLONY_TRACK_POSITION, steps: 0, atMax: true});
  });

  it('…and the enacted phase reads the SAME room, still to come (pending)', () => {
    expect(colonyTrackReadingOf(BUDGET, TABLE, {enacted: true})!.context).eq('pending');
  });

  it('the RECORD outranks the table: history, never a number recomputed from today', () => {
    const outcomes = [record({tracks: [
      {colony: ColonyName.LUNA, before: 2, after: 4},
      {colony: ColonyName.IO, before: MAX_COLONY_TRACK_POSITION, after: MAX_COLONY_TRACK_POSITION},
    ]})];
    // …even against a table that has moved on since.
    const reading = colonyTrackReadingOf(BUDGET, [colony(ColonyName.LUNA, 5), colony(ColonyName.IO, 2)], {enacted: true, outcomes})!;
    expect(reading.context).eq('applied');
    expect(reading.skipped).is.undefined;
    expect(reading.tiles).deep.eq([
      {colony: ColonyName.LUNA, before: 2, after: 4, steps: 2, atMax: false},
      {colony: ColonyName.IO, before: MAX_COLONY_TRACK_POSITION, after: MAX_COLONY_TRACK_POSITION, steps: 0, atMax: true},
    ]);
    expect(colonyTrackChipsOf(reading)).deep.eq(reading.tiles);
  });

  it('a recorded SKIP (no tile in play) carries the server\'s own reason; a nameless empty record is named by the address', () => {
    const skipped = colonyTrackReadingOf(BUDGET, TABLE, {enacted: true, outcomes: [record({kind: 'skipped', tracks: [], reason: 'No colony tile is in play'})]})!;
    expect(skipped).deep.include({context: 'applied', skipped: 'No colony tile is in play'});
    expect(skipped.tiles).deep.eq([]);
    const nameless = colonyTrackReadingOf(BUDGET, TABLE, {enacted: true, outcomes: [record({tracks: []})]})!;
    expect(nameless.skipped).eq(REWARD_ADDRESS.colonyTrack.skipTitle);
  });

  it('the COLONY TRACK record is the world record under the shared step key — no seat, the kind or its named skip; a seat\'s record never', () => {
    const mine = {player: 'blue', step: 'megacredits', part: 'effect', kind: 'stock', amount: 4} as unknown as ParliamentEnactOutcomeModel;
    const planet = {step: 'oxygen', part: 'world', kind: 'globalParameter', amount: -1} as unknown as ParliamentEnactOutcomeModel;
    const tracks = record({tracks: [{colony: ColonyName.LUNA, before: 2, after: 4}]});
    const skipped = record({kind: 'skipped', tracks: [], reason: 'No colony tile is in play'});
    expect([mine, planet, tracks, skipped].map(isColonyTrackRecord)).deep.eq([false, false, true, true]);
    expect(colonyTrackRecordOf([mine, planet, tracks])).eq(tracks);
    expect(colonyTrackRecordOf([mine])).is.undefined;
    expect(colonyTrackTilesOf(tracks)).deep.eq([{colony: ColonyName.LUNA, before: 2, after: 4, steps: 2, atMax: false}]);
    // …and its ADDRESS is the colonies screen, for every viewer; the whole table moved, so nothing is a skip.
    const delivery = rewardAddressOf(tracks, 'red' as never);
    expect(delivery.address).eq(REWARD_ADDRESS.colonyTrack);
    expect(delivery.address.stage).eq('colonies');
    expect(delivery.mine, 'the table moved for everybody — every viewer reads it').is.true;
    expect(delivery.skipped).is.undefined;
    expect(delivery.payload.tracks).deep.eq([{colony: 'Luna', before: 2, after: 4}]);
  });

  it('the sentences: «Luna: 3 → 5», the end of the track in words, and the ONE summary key', () => {
    const [luna, , io] = colonyTrackReadingOf(BUDGET, TABLE)!.tiles;
    expect(colonyTrackTileSentenceOf(luna, t)).deep.eq({caption: 'Luna', detail: '${0} → ${1}[3|5]'});
    expect(colonyTrackTileSentenceOf(io, t)).deep.eq({caption: 'Io', detail: COLONY_TRACK_AT_MAX_KEY});
    expect(COLONY_TRACK_SUMMARY_KEY).eq('Every colony track +${0}');
  });
});
