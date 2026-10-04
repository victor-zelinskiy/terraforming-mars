import {expect} from 'chai';
import {testGame} from '../TestGame';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {Space} from '../../src/server/boards/Space';
import {adjacentCitySpaces, adjacentCityTiers} from '../../src/server/boards/cityStack';
import {boardCellInfo, boardCellPreview} from '../../src/server/boards/BoardInformationEngine';
import {calculateVictoryPoints} from '../../src/server/game/calculateVictoryPoints';
import {CommercialDistrict} from '../../src/server/cards/base/CommercialDistrict';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {TileType} from '../../src/common/TileType';
import {CardName} from '../../src/common/cards/CardName';
import {BoardFact} from '../../src/common/boards/BoardInformationFacts';
import {addCity, addGreenery} from '../TestingUtils';

/**
 * «HOW MANY CITIES STAND BESIDE A CELL» — ONE count (`boards/cityStack.ts`):
 * any owner, a STACK per tier, the cells listed once. Arboretum (TR21) pays by
 * it, Commercial District scores by it — and the dossier must say the number
 * the scoring then counts («досье == подсчёт»), on a stack too.
 */
function centre(game: IGame): {cell: Space, ring: ReadonlyArray<Space>} {
  const board = game.board;
  const free = (s: Space) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.player === undefined && s.id !== board.noctisCitySpaceId;
  const cell = board.spaces.find((s) => free(s) && board.getAdjacentSpaces(s).length === 6 && board.getAdjacentSpaces(s).every(free))!;
  return {cell, ring: board.getAdjacentSpaces(cell)};
}

function allFacts(player: TestPlayer, space: Space, kind: 'land' | 'greenery', tileType: TileType): Array<BoardFact> {
  const p = boardCellPreview(player, space, kind, {tileType});
  return [...p.costFacts, ...p.immediateFacts, ...p.recipientFacts, ...p.warningFacts, ...p.futureScoringFacts, ...p.ruleFacts];
}

describe('adjacentCityTiers', () => {
  let game: IGame;
  let p1: TestPlayer;
  let p2: TestPlayer;

  beforeEach(() => {
    [game, p1, p2] = testGame(2);
  });

  it('counts cities of any owner, a stack per tier, and lists each cell once', () => {
    const {cell, ring} = centre(game);
    addCity(p1, ring[0].id);
    addCity(p2, ring[2].id);
    ring[2].stackHeight = 3;
    ring[4].tile = {tileType: TileType.CAPITAL, card: CardName.CAPITAL};
    ring[4].player = p2;
    addGreenery(p1, ring[5].id);
    expect(adjacentCitySpaces(game.board, cell).map((s) => s.id)).deep.eq([ring[0].id, ring[2].id, ring[4].id]);
    expect(adjacentCityTiers(game.board, cell), '1 + 3 + 1 — the greenery is no city').eq(5);
  });

  it('nothing beside the cell: 0 and no cells', () => {
    const {cell} = centre(game);
    expect(adjacentCitySpaces(game.board, cell)).is.empty;
    expect(adjacentCityTiers(game.board, cell)).eq(0);
  });

  it('Commercial District: the placement dossier promises the VP its card then scores — a stack counted per tier', () => {
    const {cell, ring} = centre(game);
    addCity(p2, ring[0].id);
    ring[0].stackHeight = 2;
    addCity(p1, ring[3].id);
    const promise = allFacts(p1, cell, 'land', TileType.COMMERCIAL_DISTRICT).find((f) => f.id === 'place-commercial');
    expect(promise?.vp).deep.eq({from: 0, to: 3});
    expect(promise?.spaces, 'the lit cells stay the cells').to.have.members([ring[0].id, ring[3].id]);
    const card = new CommercialDistrict();
    p1.playedCards.push(card);
    game.simpleAddTile(p1, cell, {tileType: TileType.COMMERCIAL_DISTRICT, card: CardName.COMMERCIAL_DISTRICT});
    expect(card.getVictoryPoints(p1), 'the scoring').eq(3);
    const hover = boardCellInfo(p1, cell).facts.find((f) => f.id === 'score-commercial');
    expect(hover?.vp, 'the hover of the placed district').deep.eq({from: 0, to: 3});
  });

  it('a greenery beside a stack: its owner is promised as many VP as the stack has tiers — and scores them', () => {
    const {cell, ring} = centre(game);
    addCity(p2, ring[1].id);
    ring[1].stackHeight = 2;
    const promise = allFacts(p1, cell, 'greenery', TileType.GREENERY).find((f) => f.id === `place-greenery-city-${ring[1].id}`);
    expect(promise?.vp).deep.eq({from: 0, to: 2});
    const before = calculateVictoryPoints(p2).city;
    addGreenery(p1, cell.id);
    expect(calculateVictoryPoints(p2).city - before, 'what the dossier promised').eq(2);
  });

  it('a single city is still promised 1 VP (the stack rule changes nothing below two tiers)', () => {
    const {cell, ring} = centre(game);
    addCity(p2, ring[1].id);
    const promise = allFacts(p1, cell, 'greenery', TileType.GREENERY).find((f) => f.id === `place-greenery-city-${ring[1].id}`);
    expect(promise?.vp).deep.eq({from: 0, to: 1});
  });
});
