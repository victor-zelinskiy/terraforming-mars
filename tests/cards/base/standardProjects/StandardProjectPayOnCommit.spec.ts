import {expect} from 'chai';
import {runAllActions} from '../../../TestingUtils';
import {cast} from '../../../../src/common/utils/utils';
import {CityStandardProject} from '../../../../src/server/cards/base/standardProjects/CityStandardProject';
import {GreeneryStandardProject} from '../../../../src/server/cards/base/standardProjects/GreeneryStandardProject';
import {SelectSpace} from '../../../../src/server/inputs/SelectSpace';
import {TestPlayer} from '../../../TestPlayer';
import {IGame} from '../../../../src/server/IGame';
import {testGame} from '../../../TestGame';
import {Payment} from '../../../../src/common/inputs/Payment';

// Verifies the pay-on-commit refactor: the placement-bearing standard projects
// charge the player ONLY when a space is chosen, and the placement is cancellable
// before then (no resources spent, no tile, no action consumed).
describe('StandardProject pay-on-commit', () => {
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    [game, player] = testGame(1);
  });

  it('City: not charged until a space is committed', () => {
    player.megaCredits = 30;
    const card = new CityStandardProject();

    card.payAndExecute(player, Payment.of({megacredits: 25}));
    // Pay on commit: nothing spent yet, no tile placed.
    expect(player.megaCredits).eq(30);

    runAllActions(game);
    const selectSpace = cast(player.popWaitingFor(), SelectSpace);
    expect(selectSpace.placementContext?.cancellable).is.true;
    expect(game.board.getCities(player)).is.empty;

    selectSpace.process({type: 'space', spaceId: selectSpace.spaces[0].id});
    runAllActions(game);

    expect(player.megaCredits).eq(5);
    expect(game.board.getCities(player)).has.length(1);
    expect(player.production.megacredits).eq(1);
  });

  it('City: cancelling spends nothing, places nothing, and flags the action cancelled', () => {
    player.megaCredits = 30;
    const card = new CityStandardProject();

    card.payAndExecute(player, Payment.of({megacredits: 25}));
    runAllActions(game);
    const selectSpace = cast(player.popWaitingFor(), SelectSpace);

    selectSpace.process({type: 'cancel'});

    expect(player.megaCredits).eq(30);
    expect(game.board.getCities(player)).is.empty;
    expect(player.production.megacredits).eq(0);
    expect(player.pendingPlacementCancelled).is.true;
  });

  it('Greenery: not charged until commit; cancellable', () => {
    player.megaCredits = 30;
    player.setTerraformRating(20);
    const card = new GreeneryStandardProject();

    card.payAndExecute(player, Payment.of({megacredits: 23}));
    expect(player.megaCredits).eq(30);

    runAllActions(game);
    const selectSpace = cast(player.popWaitingFor(), SelectSpace);
    expect(selectSpace.placementContext?.cancellable).is.true;

    selectSpace.process({type: 'space', spaceId: selectSpace.spaces[0].id});
    runAllActions(game);

    expect(player.megaCredits).eq(7);
    expect(game.board.getGreeneries(player)).has.length(1);
    expect(player.terraformRating).eq(21); // oxygen raise → +1 TR
  });

  it('a committed (card) placement rejects a cancel response', () => {
    player.megaCredits = 30;
    const card = new CityStandardProject();
    card.payAndExecute(player, Payment.of({megacredits: 25}));
    runAllActions(game);
    const selectSpace = cast(player.popWaitingFor(), SelectSpace);

    // Forge a non-cancellable marker to prove the guard rejects cancel.
    selectSpace.placementContext = {cancellable: false};
    expect(() => selectSpace.process({type: 'cancel'})).to.throw();
  });
});
