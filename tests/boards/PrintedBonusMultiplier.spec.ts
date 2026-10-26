import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Space} from '../../src/server/boards/Space';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {TileType} from '../../src/common/TileType';
import {Phase} from '../../src/common/Phase';
import {boardCellPreview} from '../../src/server/boards/BoardInformationEngine';
import {addOcean, runAllActions} from '../TestingUtils';

/**
 * THE PRINTED BONUS COUNTS N TIMES (`AddTileOptions.printedBonusMultiplier` — TR79 Ferrus Academy's first city): ONE
 * thread from the commit (`grantSpaceBonuses`) to the tile language's record and the preview's numbers. Only the
 * PRINTED bonus — the ocean adjacency stays × 1, a tier pays nothing.
 */
describe('printed bonus multiplier', () => {
  let game: IGame;
  let player: TestPlayer;

  beforeEach(() => {
    [game, player] = testGame(2);
    game.phase = Phase.ACTION;
  });

  function cityCell(predicate: (space: Space) => boolean): Space {
    const cell = game.board.getAvailableSpacesForCity(player).find(predicate);
    if (cell === undefined) {
      throw new Error('no such city cell on the test board');
    }
    return cell;
  }
  const count = (space: Space, bonus: SpaceBonus) => space.bonus.filter((b) => b === bonus).length;

  it('a steel cell pays its steel twice, and the record says so', () => {
    const cell = cityCell((s) => count(s, SpaceBonus.STEEL) > 0 && s.bonus.every((b) => b === SpaceBonus.STEEL));
    const printed = count(cell, SpaceBonus.STEEL);
    game.addTile(player, cell, {tileType: TileType.CITY}, {printedBonusMultiplier: 2});
    runAllActions(game);
    expect(player.steel).eq(printed * 2);
    const record = game.tilePlacements[game.tilePlacements.length - 1];
    expect(record.spaceId).eq(cell.id);
    expect(record.paid).deep.eq([{resource: 'steel', amount: printed * 2}]);
  });

  it('a card cell draws twice the cards in ONE draw (one action, one intake)', () => {
    const cell = cityCell((s) => count(s, SpaceBonus.DRAW_CARD) > 0);
    const printed = count(cell, SpaceBonus.DRAW_CARD);
    let draws = 0;
    const original = player.drawCard.bind(player);
    player.drawCard = ((...args: Parameters<typeof player.drawCard>) => {
      draws++;
      return original(...args);
    }) as typeof player.drawCard;
    game.addTile(player, cell, {tileType: TileType.CITY}, {printedBonusMultiplier: 2});
    runAllActions(game);
    expect(player.cardsInHand.length).eq(printed * 2);
    expect(draws).eq(1);
    expect(game.tilePlacements[game.tilePlacements.length - 1].cards).eq(printed * 2);
  });

  it('a bonus-less cell pays nothing, doubled or not', () => {
    const cell = cityCell((s) => s.bonus.length === 0);
    game.addTile(player, cell, {tileType: TileType.CITY}, {printedBonusMultiplier: 2});
    runAllActions(game);
    expect(game.tilePlacements[game.tilePlacements.length - 1].paid).deep.eq([]);
    expect(player.steel + player.titanium + player.plants + player.heat).eq(0);
  });

  it('the ocean adjacency M€ is NOT doubled', () => {
    const ocean = game.board.getAvailableSpacesForOcean(player)[0];
    addOcean(player, ocean.id);
    const beside = game.board.getAdjacentSpaces(ocean).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.bonus.length === 0);
    if (beside === undefined) {
      throw new Error('no bonus-less land beside the ocean');
    }
    const oceans = game.board.getAdjacentSpaces(beside).filter((s) => s.tile?.tileType === TileType.OCEAN).length;
    const before = player.megaCredits;
    game.addTile(player, beside, {tileType: TileType.GREENERY}, {printedBonusMultiplier: 2});
    runAllActions(game);
    expect(player.megaCredits - before).eq(oceans * player.oceanBonus);
  });

  it('without a multiplier nothing changes', () => {
    const cell = cityCell((s) => count(s, SpaceBonus.STEEL) > 0 && s.bonus.every((b) => b === SpaceBonus.STEEL));
    game.addTile(player, cell, {tileType: TileType.CITY});
    runAllActions(game);
    expect(player.steel).eq(count(cell, SpaceBonus.STEEL));
  });

  it('the preview states the commit\'s numbers — and says why', () => {
    const cell = cityCell((s) => count(s, SpaceBonus.STEEL) > 0);
    const printed = count(cell, SpaceBonus.STEEL);
    const preview = boardCellPreview(player, cell, 'city', {printedBonusMultiplier: 2});
    const steel = preview.immediateFacts.find((f) => f.id === `printed-${SpaceBonus.STEEL}`);
    expect(steel?.delta?.amount).eq(printed * 2);
    expect(steel?.params).deep.eq(['2']);
    const plain = boardCellPreview(player, cell, 'city');
    expect(plain.immediateFacts.find((f) => f.id === `printed-${SpaceBonus.STEEL}`)?.delta?.amount).eq(printed);
  });

  it('the preview is read-only', () => {
    const cell = cityCell((s) => s.bonus.length > 0);
    const before = JSON.stringify(game.serialize());
    boardCellPreview(player, cell, 'city', {printedBonusMultiplier: 2});
    expect(JSON.stringify(game.serialize())).eq(before);
  });
});
