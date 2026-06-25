import {expect} from 'chai';
import {testGame} from '../TestGame';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {boardCellInfo, boardCellPreview} from '../../src/server/boards/BoardInformationEngine';
import {groupFactsByRecipient, BoardFact} from '../../src/common/boards/BoardInformationFacts';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {BoardName} from '../../src/common/boards/BoardName';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {Space} from '../../src/server/boards/Space';
import {TileType} from '../../src/common/TileType';
import {CardName} from '../../src/common/cards/CardName';

describe('BoardInformationEngine', () => {
  let game: IGame;
  let player: TestPlayer;
  let player2: TestPlayer;

  beforeEach(() => {
    [game, player, player2] = testGame(2);
  });

  function emptyLand(predicate: (s: Space) => boolean): Space {
    const space = game.board.spaces.find((s) =>
      s.spaceType === SpaceType.LAND && s.tile === undefined && predicate(s));
    if (space === undefined) {
      throw new Error('no matching empty land space');
    }
    return space;
  }

  function allFacts(preview: ReturnType<typeof boardCellPreview>): ReadonlyArray<BoardFact> {
    return [
      ...preview.costFacts, ...preview.immediateFacts, ...preview.recipientFacts,
      ...preview.warningFacts, ...preview.futureScoringFacts, ...preview.ruleFacts,
    ];
  }

  it('ocean adjacency: one adjacent ocean grants +2 M€ to the current player', () => {
    const land = emptyLand((s) => game.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined));
    const ocean = game.board.getAdjacentSpaces(land).find((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined)!;
    game.addOcean(player, ocean);

    const preview = boardCellPreview(player, land, 'greenery');
    const fact = preview.immediateFacts.find((f) => f.category === 'ocean-adjacency-bonus');
    expect(fact, 'ocean-adjacency fact').to.not.be.undefined;
    expect(fact!.recipient.kind).to.eq('current-player');
    expect(fact!.delta?.amount).to.eq(2);
    expect(fact!.delta?.direction).to.eq('gain');
  });

  it('ocean adjacency: two adjacent oceans grant +4 M€', () => {
    const land = emptyLand((s) => game.board.getAdjacentSpaces(s).filter((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined).length >= 2);
    const oceans = game.board.getAdjacentSpaces(land).filter((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined).slice(0, 2);
    oceans.forEach((o) => game.addOcean(player, o));

    const preview = boardCellPreview(player, land, 'greenery');
    const fact = preview.immediateFacts.find((f) => f.category === 'ocean-adjacency-bonus');
    expect(fact?.delta?.amount).to.eq(4);
  });

  it('printed bonus: surfaces the cell bonus as a current-player gain', () => {
    const land = emptyLand((s) => s.bonus.includes(SpaceBonus.PLANT));
    const preview = boardCellPreview(player, land, 'greenery');
    const fact = preview.immediateFacts.find((f) => f.category === 'printed-placement-bonus' && f.delta?.icon === 'plants');
    expect(fact, 'plant printed-bonus fact').to.not.be.undefined;
    expect(fact!.delta?.direction).to.eq('gain');
  });

  it('covering an existing tile suppresses printed bonuses with an explanatory rule', () => {
    const land = emptyLand((s) => s.bonus.includes(SpaceBonus.PLANT));
    game.addGreenery(player, land);

    const preview = boardCellPreview(player, land, 'greenery');
    expect(preview.legal, 'occupied cell is not legal').to.be.false;
    expect(preview.illegalReason).to.eq('occupied');
    expect(preview.ruleFacts.some((f) => f.id === 'cover-no-bonus')).to.be.true;
    expect(preview.immediateFacts.some((f) => f.category === 'printed-placement-bonus')).to.be.false;
  });

  it('greenery next to an OPPONENT city scores endgame VP for the OPPONENT', () => {
    const cityCandidates = game.board.getAvailableSpacesForCity(player2);
    const city = cityCandidates[0];
    game.addCity(player2, city);
    const target = game.board.getAdjacentSpaces(city).find((a) => a.spaceType === SpaceType.LAND && a.tile === undefined)!;

    const preview = boardCellPreview(player, target, 'greenery');
    const oppFact = preview.recipientFacts.find((f) =>
      f.category === 'city-greenery-scoring' && f.recipient.kind === 'tile-owner');
    expect(oppFact, 'opponent tile-owner scoring fact').to.not.be.undefined;
    expect((oppFact!.recipient as {color: string}).color).to.eq(player2.color);
    expect(oppFact!.timing).to.eq('endgame');
    expect(oppFact!.vp).to.deep.eq({from: 0, to: 1});
  });

  it('greenery next to YOUR OWN city scores for you (no opponent recipient)', () => {
    const city = game.board.getAvailableSpacesForCity(player)[0];
    game.addCity(player, city);
    const target = game.board.getAdjacentSpaces(city).find((a) => a.spaceType === SpaceType.LAND && a.tile === undefined)!;

    const preview = boardCellPreview(player, target, 'greenery');
    expect(preview.recipientFacts.length, 'no opponent recipients').to.eq(0);
    expect(preview.futureScoringFacts.some((f) => f.recipient.kind === 'current-player')).to.be.true;
  });

  it('city placement previews future greenery scoring for the current player', () => {
    const city = game.board.getAvailableSpacesForCity(player)[0];
    const preview = boardCellPreview(player, city, 'city');
    const fact = preview.futureScoringFacts.find((f) => f.id === 'place-city');
    expect(fact, 'city scoring fact').to.not.be.undefined;
    expect(fact!.recipient.kind).to.eq('current-player');
  });

  it('surfaces the Hellas special ocean placement cost (6 M€)', () => {
    const [hellasGame, hellasPlayer] = testGame(2, {boardName: BoardName.HELLAS});
    const space = hellasGame.board.getSpaceOrThrow(SpaceName.HELLAS_OCEAN_TILE);
    const preview = boardCellPreview(hellasPlayer, space, 'land');
    const cost = preview.costFacts.find((f) => f.delta?.icon === 'megacredits');
    expect(cost, 'placement cost fact').to.not.be.undefined;
    expect(cost!.delta?.amount).to.eq(6);
    expect(cost!.delta?.direction).to.eq('cost');
  });

  it('hover info reports the cell status and standing rules', () => {
    const noctis = game.board.getSpaceOrThrow(SpaceName.NOCTIS_CITY);
    const info = boardCellInfo(player, noctis);
    expect(info.status.reserved).to.eq('noctis');
    expect(info.status.header).to.eq('Reserved area');
    expect(info.facts.some((f) => f.category === 'reserved-area')).to.be.true;
  });

  it('every cell gets a header — empty land, land-with-bonus, ocean reserve', () => {
    const plain = emptyLand((s) => s.bonus.length === 0);
    expect(boardCellInfo(player, plain).status.header).to.eq('Empty land');
    expect(boardCellInfo(player, plain).description).to.eq('A tile can be placed here when an action allows it.');

    const withBonus = emptyLand((s) => s.bonus.includes(SpaceBonus.PLANT));
    expect(boardCellInfo(player, withBonus).status.header).to.eq('Land with a bonus');

    const oceanReserve = game.board.spaces.find((s) => s.spaceType === SpaceType.OCEAN && s.tile === undefined)!;
    const info = boardCellInfo(player, oceanReserve);
    expect(info.status.header).to.eq('Ocean area');
    expect(info.description).to.eq('Only an ocean tile can be placed here.');
  });

  it('hovering an ocean tile explains it is an adjacency source', () => {
    const oceanSpace = game.board.getAvailableSpacesForOcean(player)[0];
    game.addOcean(player, oceanSpace);
    const info = boardCellInfo(player, oceanSpace);
    expect(info.status.header).to.eq('Ocean');
    expect(info.description).to.eq('This cell is occupied by an ocean.');
    const rule = info.facts.find((f) => f.category === 'ocean-adjacency-bonus');
    expect(rule, 'ocean adjacency rule fact').to.not.be.undefined;
    expect(rule!.delta?.amount).to.eq(player.oceanBonus);
  });

  it('special tile hover shows the source card name', () => {
    const space = emptyLand(() => true);
    space.tile = {tileType: TileType.COMMERCIAL_DISTRICT, card: CardName.COMMERCIAL_DISTRICT};
    space.player = player;
    const info = boardCellInfo(player, space);
    expect(info.status.content).to.eq('special-tile');
    expect(info.status.header).to.eq('Special tile');
    expect(info.status.tileLabel).to.eq(CardName.COMMERCIAL_DISTRICT);
  });

  it('city placement with no adjacent greeneries shows a count line, NOT a +0 VP badge', () => {
    const city = game.board.getAvailableSpacesForCity(player)
      .find((s) => game.board.getAdjacentSpaces(s).filter((a) => a.tile?.tileType === TileType.GREENERY).length === 0)!;
    const preview = boardCellPreview(player, city, 'city');
    const fact = preview.futureScoringFacts.find((f) => f.id === 'place-city');
    expect(fact, 'place-city fact').to.not.be.undefined;
    expect(fact!.vp, 'no vp badge for 0 greeneries').to.be.undefined;
    expect(fact!.description).to.not.be.undefined;
  });

  it('is read-only: deriving facts mutates no game state', () => {
    const before = JSON.stringify(game.board.serialize());
    const mc = player.megaCredits;
    const deferred = game.deferredActions.length;

    for (const space of game.board.spaces.slice(0, 20)) {
      boardCellInfo(player, space);
      boardCellPreview(player, space, 'greenery');
      boardCellPreview(player, space, 'city');
      boardCellPreview(player, space, 'ocean');
    }

    expect(JSON.stringify(game.board.serialize())).to.eq(before);
    expect(player.megaCredits).to.eq(mc);
    expect(game.deferredActions.length).to.eq(deferred);
  });

  describe('groupFactsByRecipient', () => {
    const current: BoardFact = {id: 'a', category: 'printed-placement-bonus', timing: 'immediate', severity: 'positive', recipient: {kind: 'current-player'}, title: 'a'};
    const opp: BoardFact = {id: 'b', category: 'city-greenery-scoring', timing: 'endgame', severity: 'warning', recipient: {kind: 'tile-owner', color: 'red'}, title: 'b'};
    const neutral: BoardFact = {id: 'c', category: 'map-special-zone', timing: 'rule', severity: 'info', recipient: {kind: 'neutral'}, title: 'c'};

    it('orders current player first, then others, then neutral', () => {
      const groups = groupFactsByRecipient([neutral, opp, current]);
      expect(groups.map((g) => g.recipient.kind)).to.deep.eq(['current-player', 'tile-owner', 'neutral']);
    });

    it('collapses the viewer-owned recipient into current-player', () => {
      const groups = groupFactsByRecipient([opp], 'red');
      expect(groups).to.have.lengthOf(1);
      expect(groups[0].recipient.kind).to.eq('current-player');
    });
  });
});
