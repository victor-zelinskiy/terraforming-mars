import {expect} from 'chai';
import {EmptyBoard} from '../testing/EmptyBoard';
import {TileType} from '../../src/common/TileType';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {Resource} from '../../src/common/Resource';
import {Philares} from '../../src/server/cards/promo/Philares';
import {SelectProductionToLose} from '../../src/server/inputs/SelectProductionToLose';
import {SelectResources} from '../../src/server/inputs/SelectResources';
import {AresHazards} from '../../src/server/ares/AresHazards';
import {Units} from '../../src/common/Units';
import {runAllActions} from '../TestingUtils';
import {testGame} from '../TestGame';
import {cast} from '../../src/common/utils/utils';
import {promptToneOf} from '../../src/client/console/promptTone';
import {PlayerInputModel} from '../../src/common/models/PlayerInputModel';

/*
 * THE OWNER'S CHAIN (the prompt-modal family, 2026-10-15): ONE placement by a «Philares» player beside an opponent's
 * tile AND an Ares hazard asks the same player TWICE — Philares' reward first, the hazard's production loss LAST
 * (`Priority.GAIN_RESOURCE_OR_PRODUCTION` runs before `LOSE_RESOURCE_OR_PRODUCTION`), so the loss is always the decision
 * that follows a reward. The console stands on this order: the second decision carries «РЕШЕНИЕ 2», the tone-shift beat
 * and the longest settle — and on the two prompts' structural markers reading as a GAIN and a LOSS.
 */
describe('Philares × an Ares hazard — one placement, a reward then a loss', () => {
  it('asks the reward FIRST and the production loss LAST, and their markers read gain → loss', () => {
    const [game, opponent, player] = testGame(2, {aresExtension: true});
    game.board = EmptyBoard.newInstance();
    player.playedCards.push(new Philares());

    const center = game.board.getAvailableSpacesOnLand(player)[5];
    const neighbours = game.board.getAdjacentSpaces(center).filter((s) => s.spaceType === SpaceType.LAND);
    game.addTile(opponent, neighbours[0], {tileType: TileType.GREENERY});
    runAllActions(game);
    AresHazards.putHazardAt(game, neighbours[1], TileType.DUST_STORM_MILD);
    player.production.add(Resource.PLANTS, 2);

    game.addTile(player, center, {tileType: TileType.GREENERY});
    runAllActions(game);

    const reward = cast(player.popWaitingFor(), SelectResources);
    expect(promptToneOf(reward.toModel() as PlayerInputModel).tone, 'the first decision is a GAIN').eq('gain');
    reward.process({type: 'resources', units: Units.of({steel: 1})});
    runAllActions(game);

    const loss = cast(player.popWaitingFor(), SelectProductionToLose);
    expect(promptToneOf(loss.toModel() as PlayerInputModel).tone, 'the LAST decision is a LOSS').eq('loss');
    expect(loss.unitsToLose).eq(1);
  });
});
