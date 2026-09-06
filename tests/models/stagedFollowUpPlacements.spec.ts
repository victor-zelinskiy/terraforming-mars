import {expect} from 'chai';
import {testGame} from '../TestGame';
import {runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {IceAsteroid} from '../../src/server/cards/base/IceAsteroid';
import {SubterraneanReservoir} from '../../src/server/cards/base/SubterraneanReservoir';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {TileType} from '../../src/common/TileType';
import {StagedPlacementModel} from '../../src/common/models/ActionPreviewModel';

/**
 * `followUpPlacements` — the multi-ocean PLAN marker (docs/TILE_PLAY_STAGED_COMMIT.md).
 *
 * A two-ocean card's FIRST placement prompt announces the second, so the
 * dossier can show «затем ещё одно размещение: Океан» while the first cell is
 * being chosen. Three parity claims, one law («the client never guesses»):
 * the STAGED preview and the LIVE first prompt carry the same marker, and the
 * SECOND prompt carries none (absence is the «this is the last one» message).
 */
describe('followUpPlacements — the multi-ocean plan marker', () => {
  function stagedOf(preview: ReturnType<typeof cardPlayPreview>): StagedPlacementModel | undefined {
    for (const branch of preview.branches) {
      for (const step of branch.steps) {
        if (step.kind === 'boardPlacement' && step.staged !== undefined) {
          return step.staged;
        }
      }
    }
    return undefined;
  }

  it('staged preview + the live FIRST prompt announce the second ocean; the second announces nothing', () => {
    const [game, player] = testGame(2);
    const card = new IceAsteroid();
    player.cardsInHand.push(card);
    player.megaCredits = 50;

    const staged = stagedOf(cardPlayPreview(player, card));
    expect(staged, 'Ice Asteroid must stage its first ocean').is.not.undefined;
    expect(staged?.followUpPlacements).deep.eq([{tileType: TileType.OCEAN}]);

    player.playCard(card);
    runAllActions(game);
    const first = cast(player.popWaitingFor(), SelectSpace);
    expect(first.followUpPlacements, 'the live first-ocean prompt carries the marker')
      .deep.eq([{tileType: TileType.OCEAN}]);
    expect(first.toModel().followUpPlacements, 'the marker rides toModel (nesting-safe)')
      .deep.eq([{tileType: TileType.OCEAN}]);

    first.cb(first.spaces[0]);
    runAllActions(game);
    const second = cast(player.popWaitingFor(), SelectSpace);
    expect(second.followUpPlacements, 'the LAST placement announces nothing — absence is the message')
      .eq(undefined);
    expect(second.toModel().followUpPlacements).eq(undefined);
  });

  it('a single-ocean card carries no marker anywhere', () => {
    const [game, player] = testGame(2);
    const card = new SubterraneanReservoir();
    player.cardsInHand.push(card);
    player.megaCredits = 50;

    const staged = stagedOf(cardPlayPreview(player, card));
    expect(staged).is.not.undefined;
    expect(staged?.followUpPlacements).eq(undefined);

    player.playCard(card);
    runAllActions(game);
    const prompt = cast(player.popWaitingFor(), SelectSpace);
    expect(prompt.followUpPlacements).eq(undefined);
  });
});
