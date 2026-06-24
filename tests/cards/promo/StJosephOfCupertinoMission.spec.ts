import {expect} from 'chai';
import {StJosephOfCupertinoMission} from '../../../src/server/cards/promo/StJosephOfCupertinoMission';
import {testGame} from '../../TestGame';
import {addCity, runAllActions} from '../../TestingUtils';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {cast} from '../../../src/common/utils/utils';

describe('StJosephOfCupertinoMission', () => {
  it('cathedral placement keeps the city tile visible — overlay, not removal', () => {
    const card = new StJosephOfCupertinoMission();
    const [game, player] = testGame(2);

    const citySpace = addCity(player);
    runAllActions(game);
    player.megaCredits = 5;
    player.steel = 0;

    expect(card.canAct(player)).is.true;

    card.action(player);
    // Auto-pays the 5 M€ (no steel to choose), then defers the city SelectSpace.
    runAllActions(game);

    const selectSpace = cast(player.popWaitingFor(), SelectSpace);
    expect(selectSpace.spaces.map((s) => s.id)).to.include(citySpace.id);
    // The cathedral is an OVERLAY marker — the city tile is NOT removed, so it
    // must stay visible during selection. No tile is hidden.
    expect(selectSpace.hiddenTiles).is.undefined;
    expect(selectSpace.toModel().hiddenTiles).is.undefined;
  });
});
