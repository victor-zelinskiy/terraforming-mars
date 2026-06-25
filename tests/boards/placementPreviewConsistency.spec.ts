import {expect} from 'chai';
import {testGame} from '../TestGame';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {boardCellPreview} from '../../src/server/boards/BoardInformationEngine';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {Space} from '../../src/server/boards/Space';

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
});
