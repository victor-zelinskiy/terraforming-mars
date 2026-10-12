import {expect} from 'chai';
import {COLONIES_IN_PLAY_UNIT, TILES_ON_MARS_UNIT, countedResourceBasis} from '../../src/server/behavior/countedBasis';
import {Tag} from '../../src/common/cards/Tag';

/**
 * THE REASON OF A COUNTED CARD-RESOURCE GAIN: the executor's `addResources`
 * writes «for N <unit>» onto its event only where the count IS the amount —
 * one counted entity, the bare rate, a unit this table knows.
 */
describe('countedResourceBasis', () => {
  it('«1 per colony in play, of any player»: the count and the colonies\' unit', () => {
    expect(countedResourceBasis({colonies: {colonies: {}}, all: true}, 5)).deep.eq({count: 5, unitKey: COLONIES_IN_PLAY_UNIT});
    expect(COLONIES_IN_PLAY_UNIT).eq('{colony|colonies} in play');
  });

  it('«1 per tile on Mars, of any player» (TR45): the census total and the tiles unit; one\'s OWN tiles have no unit yet', () => {
    expect(countedResourceBasis({tiles: {where: 'onmars'}, all: true}, 14)).deep.eq({count: 14, unitKey: TILES_ON_MARS_UNIT});
    expect(countedResourceBasis({tiles: {where: 'onmars'}}, 3), 'tiles count every owner by default').deep.eq({count: 3, unitKey: TILES_ON_MARS_UNIT});
    expect(countedResourceBasis({tiles: {where: 'onmars'}, all: false}, 3)).is.undefined;
    expect(TILES_ON_MARS_UNIT).eq('{tile|tiles} on Mars');
  });

  it('a fixed amount and a zero have no reason to state', () => {
    expect(countedResourceBasis(2, 2)).is.undefined;
    expect(countedResourceBasis({colonies: {colonies: {}}, all: true}, 0)).is.undefined;
  });

  it('a RATE makes «for N» a different number from the «+M» beside it — unstated', () => {
    expect(countedResourceBasis({colonies: {colonies: {}}, all: true, each: 2}, 4)).is.undefined;
    expect(countedResourceBasis({colonies: {colonies: {}}, all: true, per: 2}, 1)).is.undefined;
  });

  it('two counted entities, or one without a unit here, stay unstated (the event reads as before)', () => {
    expect(countedResourceBasis({colonies: {colonies: {}}, cities: {}, all: true}, 3)).is.undefined;
    expect(countedResourceBasis({tag: Tag.EARTH}, 3)).is.undefined;
    // The player's OWN colonies are another sentence — no unit for it yet.
    expect(countedResourceBasis({colonies: {colonies: {}}}, 2)).is.undefined;
  });
});
