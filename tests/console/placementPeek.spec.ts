import {expect} from 'chai';
import {peekTargetOf} from '../../src/client/console/tilePlacement/placementPeek';
import {SelectSpaceModel} from '../../src/common/models/PlayerInputModel';
import {SpaceModel} from '../../src/common/models/SpaceModel';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {TileType} from '../../src/common/TileType';
import {SpaceId} from '../../src/common/Types';

/**
 * THE SEE-THROUGH's target («ПРОСВЕТ», Turmoil Redux TR47) — pure: which cell
 * and which PIECE a lifting pick sees through, by the prompt's own markers and
 * the pieces reading. Every picker that lifts a piece, and every one that does
 * not.
 */
const cell = (id: string, tileType?: TileType, under?: TileType, stackHeight?: number): SpaceModel =>
  ({id, x: 1, y: 1, spaceType: SpaceType.OCEAN, bonus: [], tileType, under, stackHeight} as unknown as SpaceModel);

const prompt = (over: Partial<SelectSpaceModel>): SelectSpaceModel =>
  ({type: 'space', title: '', buttonLabel: '', spaces: ['10', '11'], ...over} as unknown as SelectSpaceModel);

const SPACES = [cell('10', TileType.OCEAN), cell('11', TileType.CITY, TileType.OCEAN), cell('12'), cell('13', TileType.CITY, undefined, 2)];
const id = (s: string) => s as SpaceId;

describe('placementPeek — the see-through\'s target', () => {
  it('an OCEAN REMOVAL sees through the focused legal ocean — the top piece on a plain cell, the WATER under a TR44 city', () => {
    const removal = prompt({placementEffect: 'remove', placementType: 'ocean-removal', tileType: TileType.OCEAN});
    expect(peekTargetOf(removal, undefined, id('10'), SPACES)).deep.eq({spaceId: '10', piece: 'top'});
    expect(peekTargetOf(removal, undefined, id('11'), SPACES), 'the water under the city').deep.eq({spaceId: '11', piece: 'under'});
  });

  it('nothing for a cell the prompt does not offer, an empty cell, no focus, no prompt', () => {
    const removal = prompt({placementEffect: 'remove', placementType: 'ocean-removal', tileType: TileType.OCEAN});
    expect(peekTargetOf(removal, undefined, id('12'), SPACES), 'not offered').is.undefined;
    expect(peekTargetOf(prompt({placementEffect: 'remove', spaces: ['12']}), undefined, id('12'), SPACES), 'offered but empty').is.undefined;
    expect(peekTargetOf(removal, undefined, undefined, SPACES)).is.undefined;
    expect(peekTargetOf(undefined, undefined, id('10'), SPACES)).is.undefined;
    expect(peekTargetOf(removal, undefined, id('10'), undefined), 'no board').is.undefined;
  });

  it('a MOVE sees through at its SOURCE level only: an ocean move the water (under a city too), a city move the top piece; the cell level nothing', () => {
    const ocean = prompt({placementEffect: 'move', placementType: 'ocean-move', tileType: TileType.OCEAN, tileMove: {sources: []}});
    expect(peekTargetOf(ocean, 'source', id('10'), SPACES)).deep.eq({spaceId: '10', piece: 'top'});
    expect(peekTargetOf(ocean, 'source', id('11'), SPACES)).deep.eq({spaceId: '11', piece: 'under'});
    expect(peekTargetOf(ocean, 'cell', id('10'), SPACES), 'the destination level is a landing').is.undefined;
    const city = prompt({placementEffect: 'move', placementType: 'city-move', tileType: TileType.CITY, tileMove: {sources: []}, spaces: ['11', '13']});
    expect(peekTargetOf(city, 'source', id('11'), SPACES), 'the city off its water — the top piece').deep.eq({spaceId: '11', piece: 'top'});
    expect(peekTargetOf(city, 'source', id('13'), SPACES), 'a stack — the top tier').deep.eq({spaceId: '13', piece: 'top'});
    expect(peekTargetOf(city, undefined, id('11'), SPACES), 'no level — no peek').is.undefined;
  });

  it('a REMOVE-AND-REPLACE (`hiddenTiles`) sees through the doomed tile; an ordinary placement over a tile (a cover) does not', () => {
    const kaguya = prompt({placementType: 'city', tileType: TileType.CITY, hiddenTiles: ['13'], spaces: ['13']});
    expect(peekTargetOf(kaguya, undefined, id('13'), SPACES)).deep.eq({spaceId: '13', piece: 'top'});
    const cover = prompt({placementType: 'city-over-ocean', tileType: TileType.CITY, spaces: ['10']});
    expect(peekTargetOf(cover, undefined, id('10'), SPACES), 'the water is being built ON, not lifted').is.undefined;
    const marker = prompt({placementEffect: 'marker', placementType: 'land', spaces: ['10']});
    expect(peekTargetOf(marker, undefined, id('10'), SPACES)).is.undefined;
  });
});
