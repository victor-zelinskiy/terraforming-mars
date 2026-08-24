import {expect} from 'chai';
import {runAllActions, setRulingParty} from '../../../TestingUtils';
import {cast} from '../../../../src/common/utils/utils';
import {CityStandardProject} from '../../../../src/server/cards/base/standardProjects/CityStandardProject';
import {GreeneryStandardProject} from '../../../../src/server/cards/base/standardProjects/GreeneryStandardProject';
import {SelectSpace} from '../../../../src/server/inputs/SelectSpace';
import {TestPlayer} from '../../../TestPlayer';
import {IGame} from '../../../../src/server/IGame';
import {testGame} from '../../../TestGame';
import {Payment} from '../../../../src/common/inputs/Payment';
import {EmptyBoard} from '../../../testing/EmptyBoard';
import {AresHazards} from '../../../../src/server/ares/AresHazards';
import {TileType} from '../../../../src/common/TileType';
import {Space} from '../../../../src/server/boards/Space';
import {PartyName} from '../../../../src/common/turmoil/PartyName';
import {SpaceName} from '../../../../src/common/boards/SpaceName';
import {BoardName} from '../../../../src/common/boards/BoardName';

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

/**
 * A pay-on-commit project builds its target list BEFORE its own cost is charged,
 * so a target carrying an ADDITIONAL placement cost (Ares hazard removal, the
 * Hellas ocean, …) must be measured against what is left AFTER paying for the
 * project. It wasn't: the city project offered a hazard cell to a player who could
 * pay 25 M€ or 16 M€ but not both, placed the tile, cleared the hazard and granted
 * its TR — and only then threw «Player does not have 16 M€» out of the deferred
 * placement payment, leaving that cost unpaid and the turn dead.
 */
describe('StandardProject pay-on-commit: placement costs', () => {
  let game: IGame;
  let player: TestPlayer;
  let hazard: Space;

  function aresGame(severity: TileType.EROSION_SEVERE | TileType.EROSION_MILD, options = {}) {
    [game, player] = testGame(2, {aresExtension: true, ...options});
    game.board = EmptyBoard.newInstance();
    hazard = game.board.getAvailableSpacesOnLand(player)[0];
    AresHazards.putHazardAt(game, hazard, severity);
  }

  function offeredSpaces(payment: Payment, card: CityStandardProject | GreeneryStandardProject) {
    card.payAndExecute(player, payment);
    runAllActions(game);
    return cast(player.popWaitingFor(), SelectSpace);
  }

  it('City: a hazard cell it could not ALSO pay to clear is not offered', () => {
    aresGame(TileType.EROSION_SEVERE);
    // 25 (project) + 16 (severe hazard) = 41.
    player.megaCredits = 40;

    const selectSpace = offeredSpaces(Payment.of({megacredits: 25}), new CityStandardProject());

    expect(selectSpace.spaces).to.not.include(hazard);
    // …and it says WHY, with the honest gap, rather than falling through to a
    // vaguer reason: the console greys the cell and reads the deficit off this.
    const illegal = selectSpace.illegalSpaces?.find((s) => s.spaceId === hazard.id);
    expect(illegal?.reason).eq('cannot-afford');
    expect(illegal?.deficit).eq(1);
  });

  it('City: the same cell IS offered, and fully paid for, at the real price', () => {
    aresGame(TileType.EROSION_SEVERE);
    player.megaCredits = 41;
    const before = player.terraformRating;

    const selectSpace = offeredSpaces(Payment.of({megacredits: 25}), new CityStandardProject());
    expect(selectSpace.spaces).to.include(hazard);

    selectSpace.process({type: 'space', spaceId: hazard.id});
    runAllActions(game);

    expect(player.megaCredits).eq(0); // 25 project + 16 hazard removal
    expect(hazard.tile?.tileType).eq(TileType.CITY);
    expect(player.terraformRating).eq(before + 2); // severe hazard cleared
    expect(player.production.megacredits).eq(1);
  });

  it('committing an unaffordable cell anyway spends NOTHING and places NOTHING', () => {
    aresGame(TileType.EROSION_SEVERE);
    player.megaCredits = 40;

    const selectSpace = offeredSpaces(Payment.of({megacredits: 25}), new CityStandardProject());
    expect(() => selectSpace.process({type: 'space', spaceId: hazard.id})).to.throw();

    expect(player.megaCredits).eq(40);
    expect(hazard.tile?.tileType).eq(TileType.EROSION_SEVERE);
    expect(game.board.getCities(player)).is.empty;
    expect(player.production.megacredits).eq(0);
  });

  it('Greenery: same rule, mild hazard', () => {
    aresGame(TileType.EROSION_MILD);
    // 23 (project) + 8 (mild hazard) = 31.
    player.megaCredits = 30;
    expect(offeredSpaces(Payment.of({megacredits: 23}), new GreeneryStandardProject()).spaces).to.not.include(hazard);

    aresGame(TileType.EROSION_MILD);
    player.megaCredits = 31;
    const selectSpace = offeredSpaces(Payment.of({megacredits: 23}), new GreeneryStandardProject());
    expect(selectSpace.spaces).to.include(hazard);

    selectSpace.process({type: 'space', spaceId: hazard.id});
    runAllActions(game);
    expect(player.megaCredits).eq(0);
    expect(hazard.tile?.tileType).eq(TileType.GREENERY);
  });

  it('a Reds tax the project itself owes is reserved too', () => {
    aresGame(TileType.EROSION_MILD, {turmoilExtension: true});
    setRulingParty(game, PartyName.REDS, 'rp01');

    // 23 (project) + 8 (hazard) + 3 (Reds: the greenery's own oxygen step)
    // + 3 (Reds: the TR granted for clearing the hazard) = 37.
    player.megaCredits = 36;
    expect(offeredSpaces(Payment.of({megacredits: 23}), new GreeneryStandardProject()).spaces).to.not.include(hazard);
  });

  it('a special-space cost outside Ares is reserved the same way (Hellas ocean)', () => {
    [game, player] = testGame(2, {boardName: BoardName.HELLAS});
    player.megaCredits = 30; // 25 (project) + 6 (the space's ocean bonus cost) = 31.
    let selectSpace = offeredSpaces(Payment.of({megacredits: 25}), new CityStandardProject());
    expect(selectSpace.spaces.map((s) => s.id)).to.not.include(SpaceName.HELLAS_OCEAN_TILE);

    [game, player] = testGame(2, {boardName: BoardName.HELLAS});
    player.megaCredits = 31;
    selectSpace = offeredSpaces(Payment.of({megacredits: 25}), new CityStandardProject());
    expect(selectSpace.spaces.map((s) => s.id)).to.include(SpaceName.HELLAS_OCEAN_TILE);

    selectSpace.process({type: 'space', spaceId: SpaceName.HELLAS_OCEAN_TILE});
    runAllActions(game);
    // The bonus ocean's 6 M€ is asked for, and answerable — that payment used to
    // throw «Player does not have 6 M€» with the city already on the board.
    expect(player.megaCredits).eq(0);
  });
});
