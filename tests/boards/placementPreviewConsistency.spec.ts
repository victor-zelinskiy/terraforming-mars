import {expect} from 'chai';
import {testGame} from '../TestGame';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {boardCellPreview} from '../../src/server/boards/BoardInformationEngine';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {Space} from '../../src/server/boards/Space';
import {SelectOption} from '../../src/server/inputs/SelectOption';

/**
 * M8 — the placement PREVIEW must never contradict what the COMMIT (and hence the
 * journal) actually does. The preview's immediate ocean-adjacency fact and the
 * real M€ granted on placement BOTH read `MarsBoard.oceanAdjacencyBonus`, so they
 * cannot drift. This guards that single-source-of-truth end to end.
 */
describe('placement preview ↔ commit consistency', () => {
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    [game, player] = testGame(1);
  });

  it('ocean-adjacency preview matches the M€ actually granted on placement', () => {
    // A land cell adjacent to exactly one ocean reserve, with no printed M€ bonus
    // (so the only M€ on placement is the ocean-adjacency bonus).
    const land = game.board.spaces.find((s: Space) =>
      s.spaceType === SpaceType.LAND &&
      s.tile === undefined &&
      !s.bonus.includes(SpaceBonus.MEGACREDITS) &&
      game.board.getAdjacentSpaces(s).filter((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined).length === 1);
    if (land === undefined) {
      throw new Error('no suitable land cell');
    }
    const ocean = game.board.getAdjacentSpaces(land).find((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined)!;
    game.addOcean(player, ocean);

    const preview = boardCellPreview(player, land, 'greenery');
    const oceanFact = preview.immediateFacts.find((f) => f.category === 'ocean-adjacency-bonus');
    expect(oceanFact, 'preview ocean-adjacency fact').to.not.be.undefined;
    const previewAmount = oceanFact!.delta!.amount;

    const mcBefore = player.megaCredits;
    game.addGreenery(player, land);
    runAllActions(game);

    // The greenery's only M€ gain is the ocean-adjacency bonus (land has no printed
    // M€ bonus) — it must equal what the preview promised.
    expect(player.megaCredits - mcBefore).to.eq(previewAmount);
  });

  /**
   * The premium placement scene pays out ONE coin per triggered ocean, so it
   * needs to know WHICH neighbours paid — and must never re-derive board
   * adjacency (or the M€ rule) client-side. `grantPlacementBonuses` therefore
   * publishes the breakdown it already computed. These guard that the
   * breakdown is the same set the rule used, and that it stays transient.
   */
  describe('ocean-adjacency breakdown published to the client', () => {
    /** A free land cell with `n` FILLED adjacent oceans and no printed M€. */
    function landWithOceans(n: number): Space {
      const land = game.board.spaces.find((s: Space) =>
        s.spaceType === SpaceType.LAND &&
        s.tile === undefined &&
        !s.bonus.includes(SpaceBonus.MEGACREDITS) &&
        game.board.getAdjacentSpaces(s).filter((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined).length >= n);
      if (land === undefined) {
        throw new Error(`no land cell with ${n} free ocean neighbours`);
      }
      game.board.getAdjacentSpaces(land)
        .filter((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined)
        .slice(0, n)
        .forEach((o) => game.addOcean(player, o));
      return land;
    }

    it('names the EXACT paying oceans, and the total matches the money granted', () => {
      const land = landWithOceans(2);
      const expected = game.board.oceanAdjacencyBonus(player, land);
      expect(expected.spaceIds).to.have.length(2);

      const mcBefore = player.megaCredits;
      game.addGreenery(player, land);
      runAllActions(game);

      const snapshot = player.lastOceanBonus;
      expect(snapshot, 'ocean-adjacency snapshot').to.not.be.undefined;
      expect(snapshot!.spaceId).to.eq(land.id);
      // The SAME neighbours the rule counted — not a second computation.
      expect([...snapshot!.oceanSpaceIds].sort()).to.deep.eq([...expected.spaceIds].sort());
      expect(snapshot!.perOcean).to.eq(player.oceanBonus);
      expect(snapshot!.megacredits).to.eq(snapshot!.oceanSpaceIds.length * snapshot!.perOcean);
      // …and it never disagrees with the money that actually moved.
      expect(player.megaCredits - mcBefore).to.eq(snapshot!.megacredits);
    });

    it('carries a raised per-ocean rate (Lakefront Resorts)', () => {
      player.oceanBonus = 3;
      const land = landWithOceans(1);
      game.addGreenery(player, land);
      runAllActions(game);
      expect(player.lastOceanBonus?.perOcean).to.eq(3);
      expect(player.lastOceanBonus?.megacredits).to.eq(3);
    });

    it('a placement with no adjacent ocean publishes nothing', () => {
      const land = game.board.spaces.find((s: Space) =>
        s.spaceType === SpaceType.LAND &&
        s.tile === undefined &&
        game.board.getAdjacentSpaces(s).filter((a) => a.spaceType === SpaceType.OCEAN).length === 0);
      if (land === undefined) {
        throw new Error('no inland cell');
      }
      game.addGreenery(player, land);
      runAllActions(game);
      expect(player.lastOceanBonus).to.be.undefined;
    });

    it('is TRANSIENT — the next input clears it, so nothing can replay', () => {
      const land = landWithOceans(1);
      game.addGreenery(player, land);
      runAllActions(game);
      expect(player.lastOceanBonus).to.not.be.undefined;

      player.setWaitingFor(new SelectOption('next'), () => undefined);
      player.process({type: 'option'});
      expect(player.lastOceanBonus).to.be.undefined;
    });
  });
});
