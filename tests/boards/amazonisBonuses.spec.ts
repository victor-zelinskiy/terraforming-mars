import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {CardName} from '../../src/common/cards/CardName';
import {CardResource} from '../../src/common/CardResource';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {TileType} from '../../src/common/TileType';
import {boardCellInfo} from '../../src/server/boards/BoardInformationEngine';
import {newProjectCard} from '../../src/server/createCard';
import {IGame} from '../../src/server/IGame';
import {Space} from '../../src/server/boards/Space';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';

/**
 * AMAZONIS PLANITIA, THE FAN MAP — the printed MICROBE / ANIMAL cell bonuses for a HUMAN, read off the same game as
 * the commit: with no card that can hold the resource the engine SKIPS the bonus by name, and the cell's dossier
 * says so BEFORE the press; with a holder the dossier promises the resource and the commit lands it. And the
 * restricted centre: never a legal cell, its dossier naming the rule.
 */
const AMAZONIS = {boardName: BoardName.AMAZONIS} as const;

function cellWith(game: IGame, bonus: SpaceBonus): Space {
  const space = game.board.spaces.find((s) => s.bonus.includes(bonus) && s.tile === undefined && s.spaceType === SpaceType.LAND);
  expect(space, `a land cell printing ${bonus}`).is.not.undefined;
  return space!;
}

function factIds(player: TestPlayer, space: Space): Array<string> {
  return boardCellInfo(player, space).facts.map((f) => f.id);
}

describe('Amazonis Planitia — a microbe / animal cell bonus for a human', () => {
  it('with NO holder the dossier names the loss, and the commit records a named skip instead of a silent one', () => {
    const [game, player] = testGame(1, AMAZONIS) as [IGame, TestPlayer];
    const cell = cellWith(game, SpaceBonus.MICROBE);
    expect(player.getResourceCards(CardResource.MICROBE), 'the fixture: no microbe holder').is.empty;
    const facts = boardCellInfo(player, cell).facts;
    const skipped = facts.find((f) => f.id === 'printed-card-resource-skipped');
    expect(skipped, 'the dossier says the bonus will be skipped').is.not.undefined;
    expect(skipped!.description).eq('No card of yours can hold it — this bonus will be skipped.');
    const logs = game.gameLog.length;
    game.addGreenery(player, cell);
    runAllActions(game);
    expect(player.popWaitingFor(), 'nothing is asked').is.undefined;
    expect(cell.tile?.tileType).eq(TileType.GREENERY);
    expect(game.gameLog.slice(logs).some((l) => /skipped|no eligible/i.test(l.message)), 'the skip is told').is.true;
  });

  it('with a holder the dossier promises the microbe and the commit lands it on the card', () => {
    const [game, player] = testGame(1, AMAZONIS) as [IGame, TestPlayer];
    const tardigrades = newProjectCard(CardName.TARDIGRADES)!;
    player.playedCards.push(tardigrades);
    const cell = cellWith(game, SpaceBonus.MICROBE);
    const ids = factIds(player, cell);
    expect(ids).to.not.include('printed-card-resource-skipped');
    game.addGreenery(player, cell);
    runAllActions(game);
    expect(tardigrades.resourceCount, 'one microbe per printed icon').eq(cell.bonus.filter((b) => b === SpaceBonus.MICROBE).length);
  });

  it('an ANIMAL cell reads the same way', () => {
    const [game, player] = testGame(1, AMAZONIS) as [IGame, TestPlayer];
    const cell = cellWith(game, SpaceBonus.ANIMAL);
    expect(factIds(player, cell)).to.include('printed-card-resource-skipped');
    player.playedCards.push(newProjectCard(CardName.PETS)!);
    expect(factIds(player, cell)).to.not.include('printed-card-resource-skipped');
  });
});

describe('Amazonis Planitia — the restricted centre for a human', () => {
  it('is never a legal cell, and its dossier names the rule', () => {
    const [game, player] = testGame(1, AMAZONIS) as [IGame, TestPlayer];
    const centre = game.board.getSpaceOrThrow('33');
    expect(centre.spaceType).eq(SpaceType.RESTRICTED);
    expect(game.board.getAvailableSpacesForGreenery(player)).to.not.include(centre);
    expect(game.board.getAvailableSpacesForCity(player)).to.not.include(centre);
    expect(factIds(player, centre)).to.include('restricted');
  });
});
