import {expect} from 'chai';
import {TileType} from '@/common/TileType';
import {
  hazardIntensifyElapsed,
  hazardSeverityLevel,
  resetHazardIntensify,
} from '@/client/components/board/hazardIntensifyState';

describe('hazardIntensifyState', () => {
  beforeEach(() => resetHazardIntensify());

  it('maps tile types to a severity level', () => {
    expect(hazardSeverityLevel(undefined)).to.eq(0);
    expect(hazardSeverityLevel(TileType.GREENERY)).to.eq(0);
    expect(hazardSeverityLevel(TileType.EROSION_MILD)).to.eq(1);
    expect(hazardSeverityLevel(TileType.EROSION_SEVERE)).to.eq(2);
    expect(hazardSeverityLevel(TileType.DUST_STORM_SEVERE)).to.eq(2);
  });

  it('first sighting never animates (appearance, not strengthening)', () => {
    expect(hazardIntensifyElapsed('a', TileType.EROSION_MILD)).to.eq(-1);
    expect(hazardIntensifyElapsed('b', TileType.DUST_STORM_SEVERE)).to.eq(-1); // appeared severe
  });

  it('a mild → severe upgrade animates (elapsed >= 0), and continues on re-render', () => {
    expect(hazardIntensifyElapsed('a', TileType.EROSION_MILD)).to.eq(-1);
    const started = hazardIntensifyElapsed('a', TileType.EROSION_SEVERE);
    expect(started, 'intensify started').to.be.gte(0);
    // A subsequent render within the window keeps animating (continuous via the
    // negative-delay the caller derives from this elapsed).
    expect(hazardIntensifyElapsed('a', TileType.EROSION_SEVERE)).to.be.gte(0);
  });

  it('a weakening / removal does not animate', () => {
    hazardIntensifyElapsed('a', TileType.DUST_STORM_SEVERE); // first sight severe → -1
    expect(hazardIntensifyElapsed('a', undefined)).to.eq(-1); // removed
    expect(hazardIntensifyElapsed('a', TileType.DUST_STORM_MILD)).to.eq(-1); // re-appears mild, no upgrade
  });
});
