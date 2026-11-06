import {expect} from 'chai';
import {testGame} from '../TestGame';
import {runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {BoardName} from '../../src/common/boards/BoardName';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {TileType} from '../../src/common/TileType';
import {SelectResource} from '../../src/server/inputs/SelectResource';
import {MiningGuild} from '../../src/server/cards/corporation/MiningGuild';

/**
 * AMAZONIS PLANITIA'S «A STANDARD RESOURCE OF YOUR CHOICE» CELL (phase 1): the CELL asks — the question names it
 * (`choiceContext.source` kind `space`, the console's source plate) — and the answer is published
 * (`cellResourcePayouts`) so the unit leaves the cell on every seat's screen; a card answering it (Mining Guild) is a
 * recorded reaction of the placement.
 */
describe('a standard-resource cell', () => {
  it('names itself on its question, and publishes the answer for the cell\'s token', () => {
    const [game, player] = testGame(1, {boardName: BoardName.AMAZONIS_PLANITIA});
    const cell = game.board.spaces.find((s) => s.bonus.includes(SpaceBonus.STANDARD_RESOURCE))!;
    expect(cell, 'the board prints it').is.not.undefined;
    game.addTile(player, cell, {tileType: TileType.GREENERY});
    runAllActions(game);
    const ask = cast(player.popWaitingFor(), SelectResource);
    expect(ask.choiceContext?.source).deep.include({kind: 'space', space: cell.id});
    expect(ask.choiceContext?.mode).eq('reward');
    const before = player.stock.titanium;
    ask.process({type: 'resource', resource: 'titanium'});
    runAllActions(game);
    expect(player.stock.titanium).eq(before + 1);
    const record = game.cellResourcePayouts.at(-1);
    expect(record).deep.include({spaceId: cell.id, color: player.color, resource: 'titanium', amount: 1});
  });

  it('Mining Guild\'s answer is a recorded reaction of the placement', () => {
    const [game, player] = testGame(1, {boardName: BoardName.AMAZONIS_PLANITIA});
    const guild = new MiningGuild();
    player.playCorporationCard(guild);
    const cell = game.board.spaces.find((s) => s.bonus.includes(SpaceBonus.STANDARD_RESOURCE) && s.bonus.length === 1)!;
    const production = player.production.steel;
    game.addTile(player, cell, {tileType: TileType.CITY});
    runAllActions(game);
    cast(player.popWaitingFor(), SelectResource).process({type: 'resource', resource: 'steel'});
    runAllActions(game);
    expect(player.production.steel).eq(production + 1);
  });
});
