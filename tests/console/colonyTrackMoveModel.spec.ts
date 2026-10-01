import {expect} from 'chai';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {ColonyBenefit} from '../../src/common/colonies/ColonyBenefit';
import {Resource} from '../../src/common/Resource';
import {trackTop} from '../../src/common/colonies/ColonyMetadata';
import {Luna} from '../../src/server/colonies/Luna';
import {VenusRedux} from '../../src/server/colonies/VenusRedux';
import {PlutoRedux} from '../../src/server/colonies/PlutoRedux';
import {colonyTrackMoveReading, trackMoveOf} from '../../src/client/console/colonyTrade/colonyTrackMoveModel';

/**
 * A CHOSEN TRACK'S MOVE, READ (TR07 Colony Sponsors): the surfaces print the
 * server's projection — the tile's own readout, the steps, the trade income at
 * both ends — and compute none of it. Pure; one spec per reading the stage and
 * the grid's rail draw.
 */
describe('colonyTrackMoveModel', () => {
  it('Luna 2 → 6: «3/7 → 7/7», four steps, the income the track prints at each end', () => {
    const luna = new Luna().metadata;
    const reading = colonyTrackMoveReading(luna, {colony: ColonyName.LUNA, before: 2, after: trackTop(luna)});
    expect(reading.before.display).eq('3/7');
    expect(reading.after.display).eq('7/7');
    expect(reading.steps).eq(4);
    expect(reading.before.quantity).eq(luna.trade.quantity[2]);
    expect(reading.after.quantity).eq(luna.trade.quantity[6]);
    expect(reading.before.benefit.type).eq(ColonyBenefit.GAIN_RESOURCES);
    expect(reading.after.benefit.resource).eq(Resource.MEGACREDITS);
    expect(reading.before.levy).is.false;
    expect(reading.fixed).is.undefined;
  });

  it('the Redux Venus: the FIXED part stands at both ends, and a levy cell says so', () => {
    const venus = new VenusRedux().metadata;
    const reading = colonyTrackMoveReading(venus, {colony: ColonyName.VENUS_REDUX, before: 0, after: trackTop(venus)});
    expect(reading.fixed, 'the Venus step is paid on every trade').is.not.undefined;
    expect(reading.before.levy, 'the first cell is a levy').is.true;
    expect(reading.after.levy).is.false;
  });

  it('the Redux Pluto: the kind of the income moves along the track (data low, cards at the top)', () => {
    const pluto = new PlutoRedux().metadata;
    const reading = colonyTrackMoveReading(pluto, {colony: ColonyName.PLUTO_REDUX, before: 1, after: trackTop(pluto)});
    expect(reading.before.benefit.type).eq(ColonyBenefit.ADD_RESOURCES_TO_CARD);
    expect(reading.after.benefit.type).eq(ColonyBenefit.DRAW_CARDS);
    expect(reading.after.quantity).eq(3);
  });

  it('trackMoveOf: a candidate\'s projection, nothing for a tile the pick does not move', () => {
    const moves = [{colony: ColonyName.LUNA, before: 2, after: 6}];
    expect(trackMoveOf(moves, ColonyName.LUNA)).deep.eq({colony: ColonyName.LUNA, before: 2, after: 6});
    expect(trackMoveOf(moves, ColonyName.CERES)).is.undefined;
    expect(trackMoveOf(undefined, ColonyName.LUNA)).is.undefined;
  });
});
