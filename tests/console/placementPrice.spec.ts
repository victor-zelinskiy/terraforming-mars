import {expect} from 'chai';
import {
  placementPriceVerdict, SPROUT_PROFILE, SPROUT_START_SCALE, SPROUT_PEAK_SCALE, SPROUT_BONUS_LIFT_T, TILE_SPROUT_MS,
  TILE_FLIGHT_MS, tileScaleAt, tileTiltAt,
} from '../../src/client/console/tilePlacement/tilePlacementModel';

/**
 * THE PRICE OF A PLACEMENT, OFF THE RAIL (PL-306 — the PL-099 law at the placement door; the owner's field report of
 * 2026-10-14: «растения летят с рельса в тайл»). A greenery bought with plants (the conversion, the final greenery)
 * opens its scene with the price: the «−8» token leaves the plants row for the cell and the tile GROWS out of it.
 * The token flies only when the row moved by exactly the price plus what the placement is known to pay back.
 */
describe('placement price (PL-306)', () => {
  const price = {resource: 'plants', amount: 8};

  it('a plain cell: the row moved by exactly the price — flown', () => {
    expect(placementPriceVerdict(price, {plants: 16}, {plants: 8}, 0)).to.deep.eq({price});
  });

  it('a cell that pays plants back (its printed bonus, the groves of a law) — the known gain is part of the promise', () => {
    expect(placementPriceVerdict(price, {plants: 16}, {plants: 10}, 2)).to.deep.eq({price});
  });

  it('Ecoline\'s seven — the price is the live exchange, never the printed eight', () => {
    expect(placementPriceVerdict({resource: 'plants', amount: 7}, {plants: 14}, {plants: 7}, 0))
      .to.deep.eq({price: {resource: 'plants', amount: 7}});
  });

  it('a row that moved otherwise is NOT flown, and the verdict names the numbers', () => {
    const verdict = placementPriceVerdict(price, {plants: 16}, {plants: 9}, 0);
    expect(verdict).to.have.property('mismatch').that.contains('16 → 9');
  });

  it('no reading in a view — named, never a guess', () => {
    expect(placementPriceVerdict(price, {}, {plants: 8}, 0)).to.have.property('mismatch');
  });

  it('no price declared (every other placement) — nothing to say', () => {
    expect(placementPriceVerdict(undefined, {plants: 16}, {plants: 8}, 0)).to.be.undefined;
    expect(placementPriceVerdict({resource: 'plants', amount: 0}, {plants: 16}, {plants: 16}, 0)).to.be.undefined;
  });

  it('THE SPROUT: born small AT its cell, no carried tilt, grows a hair past the board and settles at exactly 1', () => {
    expect(SPROUT_PROFILE.startScale).to.eq(SPROUT_START_SCALE);
    expect(SPROUT_START_SCALE).to.be.lessThan(1);
    expect(SPROUT_PEAK_SCALE).to.be.greaterThan(1).and.lessThan(1.1);
    for (let t = 0; t <= 1; t += 0.1) {
      expect(tileTiltAt(t, SPROUT_PROFILE), 'nothing was carried — no tilt').to.eq(0);
    }
    expect(tileScaleAt(1, SPROUT_PROFILE), 'contact at the board scale').to.eq(1);
    // Shorter than the carried flight: the token's own flight already told the distance.
    expect(TILE_SPROUT_MS).to.be.lessThan(TILE_FLIGHT_MS);
    expect(SPROUT_BONUS_LIFT_T).to.be.greaterThan(0).and.lessThan(0.5);
  });
});
