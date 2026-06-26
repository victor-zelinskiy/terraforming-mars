import {expect} from 'chai';
import {testGame} from '../TestGame';
import {addOcean} from '../TestingUtils';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {TileType} from '../../src/common/TileType';
import {AresHandler} from '../../src/server/ares/AresHandler';
import {computeTerraformRatingBreakdown} from '../../src/server/game/calculateVictoryPoints';

// Hazard-clearing TR (Ares) is attributed to its OWN VP segment («Очистка
// опасных зон»), split out of the generic "Cards & effects" bucket. This guards
// (a) cleanup-by-building, (b) the planetary dust-storm-removal event, and
// (c) NO leak into non-Ares games.
describe('Ares — hazard-cleanup TR attribution', () => {
  let game: IGame;
  let player: TestPlayer;

  it('cleanup-by-building attributes TR to the hazard segment (mild +1 / severe +2), not to cards', () => {
    [game, player] = testGame(2, {aresExtension: true});
    const trBefore = player.terraformRating;

    AresHandler.grantBonusForRemovingHazard(player, TileType.EROSION_SEVERE); // 2 steps

    expect(player.terraformRating).to.eq(trBefore + 2);
    const b = computeTerraformRatingBreakdown(player);
    expect(b.hazards).to.eq(2);
    expect(b.cards).to.eq(0);
    // The breakdown still sums to the displayed rating.
    expect((b.baseRating ?? 0) + (b.handicap ?? 0) + b.temperature + b.oxygen + b.oceans + b.venus + b.cards + (b.hazards ?? 0))
      .to.eq(player.terraformRating);
    // No hazard entry leaks into the per-card detail list.
    expect((b.cardEntries ?? []).some((e) => e.sourceType === 'ares-hazard')).to.be.false;
  });

  it('the planetary dust-storm-removal event (6th ocean) credits the hazard segment', () => {
    [game, player] = testGame(2, {aresExtension: true});
    // Initial dust storms exist (aresHazards default true). Cross the 6-ocean
    // threshold → unprotected dust storms removed, the triggering player +1 TR.
    for (let n = 0; n < 6; n++) {
      addOcean(player);
    }
    const b = computeTerraformRatingBreakdown(player);
    expect(b.hazards).to.eq(1);
  });

  it('does NOT leak: a non-Ares game has no hazard TR, and normal TR stays in cards', () => {
    [game, player] = testGame(2); // no Ares
    player.increaseTerraformRating(3); // a generic card/effect TR gain
    const b = computeTerraformRatingBreakdown(player);
    expect(b.hazards).to.eq(0);
    expect(b.cards).to.eq(3);
  });
});
