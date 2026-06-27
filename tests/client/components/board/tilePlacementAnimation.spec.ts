import {expect} from 'chai';
import {TileType} from '@/common/TileType';
import {
  HAZARD_PLACEMENT_ANIMATION_MS,
  PLACEMENT_ANIMATION_MS,
  kindFor,
} from '@/client/components/board/tilePlacementAnimation';

describe('tilePlacementAnimation.kindFor', () => {
  it('classifies the iconic tiles', () => {
    expect(kindFor(TileType.OCEAN)).to.eq('ocean');
    expect(kindFor(TileType.GREENERY)).to.eq('greenery');
    expect(kindFor(TileType.CITY)).to.eq('city');
    expect(kindFor(TileType.CAPITAL)).to.eq('city');
    expect(kindFor(TileType.COMMERCIAL_DISTRICT)).to.eq('special');
  });

  it('a hazard APPEARING is its own danger kind (erosion + dust storm, mild + severe)', () => {
    expect(kindFor(TileType.EROSION_MILD)).to.eq('hazard');
    expect(kindFor(TileType.EROSION_SEVERE)).to.eq('hazard');
    expect(kindFor(TileType.DUST_STORM_MILD)).to.eq('hazard');
    expect(kindFor(TileType.DUST_STORM_SEVERE)).to.eq('hazard');
  });

  it('the hazard appearance is heavier than a routine placement', () => {
    expect(HAZARD_PLACEMENT_ANIMATION_MS).to.be.greaterThan(PLACEMENT_ANIMATION_MS);
  });
});
