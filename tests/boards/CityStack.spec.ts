import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {Board} from '../../src/server/boards/Board';
import {MarsBoard} from '../../src/server/boards/MarsBoard';
import {Space} from '../../src/server/boards/Space';
import {cityTiersOf, countCityTiers, tiersOf} from '../../src/server/boards/cityStack';
import {boardCellInfo, boardCellPreview} from '../../src/server/boards/BoardInformationEngine';
import {BoardFact} from '../../src/common/boards/BoardInformationFacts';
import {Mayor} from '../../src/server/milestones/Mayor';
import {Metropolist} from '../../src/server/awards/modular/Metropolist';
import {Constructor} from '../../src/server/awards/modular/Constructor';
import {Landlord} from '../../src/server/awards/Landlord';
import {Urbanist} from '../../src/server/awards/terraCimmeria/Urbanist';
import {CitiesRequirement} from '../../src/server/cards/requirements/CitiesRequirement';
import {Counter} from '../../src/server/behavior/Counter';
import {Hospitals} from '../../src/server/cards/promo/Hospitals';
import {Vermin} from '../../src/server/cards/promo/Vermin';
import {NewHolland} from '../../src/server/cards/promo/NewHolland';
import {StrongSociety} from '../../src/server/turmoil/globalEvents/StrongSociety';
import {Election} from '../../src/server/turmoil/globalEvents/Election';
import {Turmoil} from '../../src/server/turmoil/Turmoil';
import {Server} from '../../src/server/models/ServerModel';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {TileType} from '../../src/common/TileType';
import {CardName} from '../../src/common/cards/CardName';
import {Phase} from '../../src/common/Phase';
import {fakeCard, runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {testAutomaGame} from '../automa/AutomaTestGame';

/**
 * THE CITY STACK (Turmoil Redux — Skyscrapers): more than one city tile on one
 * cell. What these specs pin, consumer by consumer:
 *  · the field: `Space.stackHeight`, read ONLY through `tiersOf` /
 *    `cityTiersOf`; serialized from 2 up, an old save without it is height 1;
 *    `removeTile` and a fresh tile clear it;
 *  · A QUANTITY sums the stacks — Mayor, Metropolist, Constructor, Landlord
 *    (tiles), Urbanist (VP per tier), the `cities` countable, Hospitals, Star
 *    Vegas' formula, Vermin, New Holland, Strong Society, Election, the
 *    cities requirement, the player model — all through ONE function;
 *  · A PREDICATE reads the cell — «is this a city», the list of city cells,
 *    adjacency (a city may not sit next to a stack, a stack is ONE neighbour),
 *    the tier's own legality;
 *  · the engine's stack commit: `addCityTier` pays the cell nothing;
 *  · the board information layer: the hover names the height and one row per
 *    tier; the tier's preview promises the stack's own scoring and no bonus,
 *    stays pure, and counts Mayor's progress.
 */
function quietLand(game: IGame, predicate: (s: Space) => boolean = () => true): Space {
  const space = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.id !== game.board.noctisCitySpaceId &&
    s.bonus.length === 0 && !game.board.getAdjacentSpaces(s).some((a) => a.tile !== undefined || a.spaceType === SpaceType.OCEAN) && predicate(s));
  if (space === undefined) {
    throw new Error('no quiet land');
  }
  return space;
}

function seatCity(game: IGame, player: TestPlayer, space: Space = quietLand(game), card?: CardName): Space {
  space.tile = {tileType: TileType.CITY, ...(card === undefined ? {} : {card})};
  space.player = player;
  return space;
}

function greeneryBeside(game: IGame, city: Space, count: number): Array<Space> {
  const out: Array<Space> = [];
  for (const adj of game.board.getAdjacentSpaces(city)) {
    if (out.length === count) {
      break;
    }
    if (adj.tile === undefined && adj.spaceType === SpaceType.LAND) {
      adj.tile = {tileType: TileType.GREENERY};
      adj.player = city.player;
      out.push(adj);
    }
  }
  if (out.length !== count) {
    throw new Error(`only ${out.length} greeneries fit beside ${city.id}`);
  }
  return out;
}

function allFacts(preview: ReturnType<typeof boardCellPreview>): ReadonlyArray<BoardFact> {
  return [
    ...preview.costFacts, ...preview.immediateFacts, ...preview.recipientFacts,
    ...preview.warningFacts, ...preview.futureScoringFacts, ...preview.ruleFacts,
    ...(preview.progressFacts ?? []),
  ];
}

describe('CityStack', () => {
  let game: IGame;
  let p1: TestPlayer;
  let p2: TestPlayer;

  beforeEach(() => {
    [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    game.phase = Phase.ACTION;
  });

  describe('the field and its one reader', () => {
    it('an empty cell is 0 tiers, any tile is 1, a stacked city is its height; only a city counts as city tiers', () => {
      const empty = quietLand(game);
      expect(tiersOf(empty)).eq(0);
      expect(cityTiersOf(empty)).eq(0);
      const greenery = quietLand(game, (s) => s.id !== empty.id);
      greenery.tile = {tileType: TileType.GREENERY};
      expect(tiersOf(greenery)).eq(1);
      expect(cityTiersOf(greenery)).eq(0);
      const city = seatCity(game, p1);
      expect(tiersOf(city)).eq(1);
      expect(cityTiersOf(city)).eq(1);
      city.stackHeight = 3;
      expect(tiersOf(city)).eq(3);
      expect(cityTiersOf(city)).eq(3);
      expect(Board.tiersOf(city)).eq(3);
      expect(Board.cityTiersOf(city)).eq(3);
      expect(countCityTiers([empty, greenery, city])).eq(3);
      expect(MarsBoard.countCityTiers([city, city])).eq(6);
    });

    it('serializes from 2 up only, deserializes back, and an OLD save without the field reads as height 1', () => {
      const city = seatCity(game, p1);
      const plain = seatCity(game, p2);
      game.addCityTier(p1, city);
      const serialized = game.serialize();
      const savedCity = serialized.board.spaces.find((s) => s.id === city.id)!;
      const savedPlain = serialized.board.spaces.find((s) => s.id === plain.id)!;
      expect(savedCity.stackHeight).eq(2);
      expect('stackHeight' in savedPlain, 'a single tile writes no field').is.false;
      const live = Game.deserialize(structuredClone(serialized));
      expect(live.board.getSpaceOrThrow(city.id).stackHeight).eq(2);
      expect(tiersOf(live.board.getSpaceOrThrow(plain.id))).eq(1);
      // An old save: strip the field — the stack is gone, the city stands at height 1.
      const old = structuredClone(serialized);
      delete old.board.spaces.find((s) => s.id === city.id)!.stackHeight;
      const loaded = Game.deserialize(old);
      const loadedCity = loaded.board.getSpaceOrThrow(city.id);
      expect(loadedCity.stackHeight).is.undefined;
      expect(tiersOf(loadedCity)).eq(1);
      expect(loaded.board.countCities(loaded.getPlayerById(p1.id))).eq(1);
    });

    it('a removed tile and a fresh tile on the cell clear the stack', () => {
      const city = seatCity(game, p1);
      game.addCityTier(p1, city);
      expect(city.stackHeight).eq(2);
      game.removeTile(city.id);
      expect(city.tile).is.undefined;
      expect(city.stackHeight).is.undefined;
      const again = seatCity(game, p1, city);
      game.addCityTier(p1, again);
      expect(again.stackHeight).eq(2);
      game.simpleAddTile(p1, again, {tileType: TileType.GREENERY});
      expect(again.stackHeight, 'a fresh tile is one tile').is.undefined;
    });
  });

  describe('the commit', () => {
    it('addCityTier raises the stack and pays the cell nothing — no printed bonus, no ocean adjacency, no Arcadian marker money', () => {
      const shoreCity = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.bonus.includes(SpaceBonus.STEEL) &&
        game.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined))!;
      const ocean = game.board.getAdjacentSpaces(shoreCity).find((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined)!;
      ocean.tile = {tileType: TileType.OCEAN};
      seatCity(game, p1, shoreCity);
      const steel = p1.steel;
      const mc = p1.megaCredits;
      game.addCityTier(p1, shoreCity);
      expect(shoreCity.stackHeight).eq(2);
      expect(p1.steel).eq(steel);
      expect(p1.megaCredits).eq(mc);
      expect(p1.lastOceanBonus).is.undefined;
    });

    it('refuses anything but the player\'s own city on Mars', () => {
      const mine = seatCity(game, p1);
      const theirs = seatCity(game, p2);
      const empty = quietLand(game);
      const ganymede = game.board.getSpaceOrThrow(SpaceName.GANYMEDE_COLONY);
      ganymede.tile = {tileType: TileType.CITY, card: CardName.GANYMEDE_COLONY};
      ganymede.player = p1;
      expect(() => game.addCityTier(p1, theirs)).to.throw(/own city on Mars/);
      expect(() => game.addCityTier(p1, empty)).to.throw(/own city on Mars/);
      expect(() => game.addCityTier(p1, ganymede)).to.throw(/own city on Mars/);
      expect(() => game.addTile(p1, mine, {tileType: TileType.GREENERY}, {stacking: true})).to.throw(/own city on Mars/);
      expect(() => game.addCityTier(p1, mine)).not.to.throw();
    });
  });

  describe('a QUANTITY sums the stacks (one function: countCities)', () => {
    let city: Space;
    beforeEach(() => {
      city = seatCity(game, p1);
      game.addCityTier(p1, city);
      seatCity(game, p2);
    });

    it('countCities: the stack is 2 cities for its owner, 3 on the board, 3 on Mars, 0 off Mars', () => {
      expect(game.board.countCities(p1)).eq(2);
      expect(game.board.countCities(p2)).eq(1);
      expect(game.board.countCities()).eq(3);
      expect(game.board.countCities(undefined, 'onmars')).eq(3);
      expect(game.board.countCities(undefined, 'offmars')).eq(0);
      expect(game.board.getCities(p1), 'the CELLS stay one').has.length(1);
    });

    it('Mayor: a stack of 2 is 2 city tiles towards the 3', () => {
      expect(new Mayor().getScore(p1)).eq(2);
      expect(new Mayor().getScore(p2)).eq(1);
    });

    it('Metropolist: the most cities counts every tier', () => {
      expect(new Metropolist().getScore(p1)).eq(2);
      expect(new Metropolist().getScore(p2)).eq(1);
    });

    it('Constructor: colonies + cities, the stack counted', () => {
      expect(new Constructor().getScore(p1)).eq(2);
    });

    it('Landlord: the most TILES — a stack of 2 is 2 tiles', () => {
      expect(new Landlord().getScore(p1)).eq(2);
      expect(new Landlord().getScore(p2)).eq(1);
    });

    it('Urbanist: VP from city adjacencies once per tier (2 tiers × 2 greeneries = 4)', () => {
      greeneryBeside(game, city, 2);
      expect(new Urbanist().getScore(p1)).eq(4);
    });

    it('the cities requirement (a card\'s «N cities») counts the stack', () => {
      expect(new CitiesRequirement({count: 2}).getScore(p1)).eq(2);
      expect(new CitiesRequirement({count: 3, all: true}).getScore(p1)).eq(3);
    });

    it('the `cities` countable («per city you own») counts the stack; on Mars and everywhere alike', () => {
      const counter = new Counter(p1, fakeCard());
      expect(counter.count({cities: {}})).eq(3);
      expect(counter.count({cities: {}, all: false})).eq(2);
      expect(counter.count({cities: {where: 'onmars'}, all: false})).eq(2);
      expect(counter.count({cities: {where: 'offmars'}, all: false})).eq(0);
    });

    it('Hospitals: 1 M€ per city IN PLAY pays 3 for two cells', () => {
      const hospitals = new Hospitals();
      p1.playedCards.push(hospitals);
      hospitals.resourceCount = 1;
      const mc = p1.megaCredits;
      const pick = cast(hospitals.action(p1), SelectCard);
      pick.cb([hospitals]);
      expect(p1.megaCredits).eq(mc + 3);
    });

    it('Vermin: −1 VP per city — the stack is penalized per tier, on the card and on the other seats', () => {
      const vermin = new Vermin();
      p2.playedCards.push(vermin);
      game.verminInEffect = true;
      expect(vermin.getVictoryPoints(p2)).eq(-1);
      expect(vermin.getVictoryPoints(p1)).eq(-2);
      expect(p1.getVictoryPoints().victoryPoints, 'the other seat\'s penalty through the breakdown').eq(-2);
    });

    it('New Holland needs 4 cities on Mars: three cells with one stack reach it', () => {
      const card = new NewHolland();
      expect(card.bespokeCanPlay(p1)).is.false;
      seatCity(game, p2);
      expect(game.board.countCities(undefined, 'onmars')).eq(4);
      expect(card.bespokeCanPlay(p1)).is.true;
    });

    it('the player model\'s citiesCount is the same number', () => {
      expect(Server.getPlayerModel(p1).thisPlayer.citiesCount).eq(2);
      expect(Server.getPlayerModel(p2).thisPlayer.citiesCount).eq(1);
    });

    it('the Turmoil global events: Strong Society pays per city (capped), Election scores per city', () => {
      const [turmoilGame, one] = testGame(2, {turmoilExtension: true});
      const turmoil = Turmoil.getTurmoil(turmoilGame);
      const mine = seatCity(turmoilGame, one);
      turmoilGame.addCityTier(one, mine);
      const mc = one.megaCredits;
      new StrongSociety().resolve(turmoilGame, turmoil);
      expect(one.megaCredits, '2 cities + 0 influence, × 2 M€').eq(mc + 4);
      expect(new Election().getScore(one, turmoil, turmoilGame)).eq(2);
    });

    it('MarsBot\'s scoring stands on the same paths: the human\'s stack is 2 for the award, the bot\'s city stays 1', () => {
      const [automaGame, human, bot] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      const mine = automaGame.board.getAvailableSpacesForCity(human)[0];
      mine.tile = {tileType: TileType.CITY};
      mine.player = human;
      automaGame.addCityTier(human, mine);
      const bots = automaGame.board.getAvailableSpacesForCity(bot)[0];
      bots.tile = {tileType: TileType.CITY};
      bots.player = bot;
      expect(new Metropolist().getScore(human)).eq(2);
      expect(new Metropolist().getScore(bot)).eq(1);
      expect(automaGame.board.countCities(bot)).eq(1);
    });
  });

  describe('a PREDICATE reads the cell alone', () => {
    it('a stack is ONE city cell: the list of cities, adjacency, «next to a city», and a stack next to a stack', () => {
      const city = seatCity(game, p1);
      game.addCityTier(p1, city);
      expect(Board.isCitySpace(city)).is.true;
      expect(game.board.getCities(p1)).deep.eq([city]);
      expect(game.board.getCitiesOnMars(p1)).deep.eq([city]);
      // A city may not sit next to a city — the stack is a city, not two.
      for (const adj of game.board.getAdjacentSpaces(city)) {
        expect(game.board.getAvailableSpacesForCity(p1).map((s) => s.id)).not.includes(adj.id);
      }
      const neighbour = game.board.getAdjacentSpaces(city).find((a) => a.spaceType === SpaceType.LAND && a.tile === undefined)!;
      expect(game.board.getAdjacentSpaces(neighbour).filter(Board.isCitySpace), 'one neighbouring city, not two').has.length(1);
      // The tier's own legality is a predicate too: only the player's own city on Mars.
      expect(MarsBoard.canStackCity(city, p1)).is.true;
      expect(MarsBoard.canStackCity(city, p2)).is.false;
      expect(MarsBoard.canStackCity(neighbour, p1)).is.false;
      expect(game.board.getAvailableSpacesForType(p1, 'city-tier')).deep.eq([city]);
      expect(game.board.illegalReasonFor(p1, 'city-tier', neighbour)).eq('not-your-city');
    });
  });

  describe('the endgame', () => {
    it('each tier scores the adjacent greeneries separately; one breakdown row per tier, the base tier keeping the cell\'s card', () => {
      const city = seatCity(game, p1, quietLand(game), CardName.NOCTIS_CITY);
      greeneryBeside(game, city, 3);
      game.addCityTier(p1, city);
      game.addCityTier(p1, city);
      const vp = p1.getVictoryPoints();
      expect(vp.city).eq(9);
      expect(vp.detailsCities).deep.eq([
        {spaceId: city.id, points: 3, cardName: CardName.NOCTIS_CITY, tier: 1, tiers: 3},
        {spaceId: city.id, points: 3, cardName: undefined, tier: 2, tiers: 3},
        {spaceId: city.id, points: 3, cardName: undefined, tier: 3, tiers: 3},
      ]);
      // An ordinary city keeps its plain row — no tier members.
      const plain = seatCity(game, p2);
      expect(p2.getVictoryPoints().detailsCities).deep.eq([{spaceId: plain.id, points: 0, cardName: undefined}]);
    });
  });

  describe('the board information layer', () => {
    it('the hover names the stack («City stack», height 2) and lists ONE scoring row per tier, each with the greeneries', () => {
      const city = seatCity(game, p1);
      const greeneries = greeneryBeside(game, city, 2);
      game.addCityTier(p1, city);
      const info = boardCellInfo(p1, city);
      expect(info.status.content).eq('city');
      expect(info.status.stackHeight).eq(2);
      expect(info.status.header).eq('City stack');
      const rows = info.facts.filter((f) => f.category === 'city-greenery-scoring');
      expect(rows.map((f) => f.id)).deep.eq(['score-city-tier-1', 'score-city-tier-2']);
      for (const row of rows) {
        expect(row.vp).deep.eq({from: 0, to: 2});
        expect(row.params).deep.eq([rows.indexOf(row) + 1 + '', '2']);
        expect(row.spaces).deep.eq(greeneries.map((s) => s.id));
        expect(row.recipient).deep.eq({kind: 'current-player'});
      }
      // A single city keeps its one plain row and no height.
      const plain = seatCity(game, p2);
      const plainInfo = boardCellInfo(p1, plain);
      expect(plainInfo.status.stackHeight).is.undefined;
      expect(plainInfo.status.header).eq('City');
      expect(plainInfo.facts.filter((f) => f.category === 'city-greenery-scoring').map((f) => f.id)).deep.eq(['score-city']);
    });

    it('the tier\'s preview: legal on the own city, the stack\'s scoring promised (1 → 2 tiers, 2 → 4 VP), no bonus and no cost, Mayor\'s progress counted — and pure', () => {
      const city = seatCity(game, p1, game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.bonus.includes(SpaceBonus.STEEL) &&
        game.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined))!);
      const ocean = game.board.getAdjacentSpaces(city).find((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined)!;
      ocean.tile = {tileType: TileType.OCEAN};
      const greeneries = greeneryBeside(game, city, 2);
      const before = JSON.stringify(game.serialize());
      const preview = boardCellPreview(p1, city, 'city-tier');
      expect(JSON.stringify(game.serialize()), 'read-only').eq(before);
      expect(preview.legal).is.true;
      expect(preview.placesTile).is.true;
      const facts = allFacts(preview);
      const scoring = facts.find((f) => f.id === 'place-city-tier')!;
      expect(scoring.vp).deep.eq({from: 2, to: 4});
      expect(scoring.params).deep.eq(['1', '2']);
      expect(scoring.spaces).deep.eq(greeneries.map((s) => s.id));
      expect(facts.some((f) => f.category === 'printed-placement-bonus'), 'no printed bonus promised').is.false;
      expect(facts.some((f) => f.category === 'ocean-adjacency-bonus'), 'no ocean adjacency promised').is.false;
      expect(facts.some((f) => f.id === 'place-city'), 'not a fresh city\'s row').is.false;
      expect(facts.find((f) => f.id === 'tier-no-bonus')?.title).eq('No placement bonus');
      expect(preview.costFacts).has.length(0);
      const mayor = (preview.progressFacts ?? []).find((f) => f.id === 'milestone-Mayor')!;
      expect(mayor, 'Mayor counts the tier').is.not.undefined;
      expect(mayor.progress).deep.include({from: 1, to: 2});
      // Another player's city: illegal, and the reason names it.
      const theirs = seatCity(game, p2);
      const refused = boardCellPreview(p1, theirs, 'city-tier');
      expect(refused.legal).is.false;
      expect(refused.illegalReason).eq('not-your-city');
    });

    it('the tier\'s preview beside no greenery is honest at zero and still promises the next ones', () => {
      const city = seatCity(game, p1);
      const preview = boardCellPreview(p1, city, 'city-tier');
      const scoring = allFacts(preview).find((f) => f.id === 'place-city-tier')!;
      expect(scoring.vp).is.undefined;
      expect(scoring.params).deep.eq(['1', '2']);
      expect(scoring.severity).eq('info');
    });

    it('an ordinary placement is unchanged: a fresh city\'s preview still lists its printed bonus and its own city row', () => {
      const land = game.board.spaces.find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && s.bonus.includes(SpaceBonus.STEEL) &&
        game.board.getAvailableSpacesForCity(p1).includes(s))!;
      const preview = boardCellPreview(p1, land, 'city');
      const facts = allFacts(preview);
      expect(facts.some((f) => f.category === 'printed-placement-bonus')).is.true;
      expect(facts.some((f) => f.id === 'place-city')).is.true;
      expect(facts.some((f) => f.id === 'place-city-tier')).is.false;
    });
  });

  describe('the queue', () => {
    it('runAllActions after a tier leaves nothing pending — the tier defers no bonus of its own', () => {
      const city = seatCity(game, p1);
      game.addCityTier(p1, city);
      runAllActions(game);
      expect(p1.getWaitingFor()).is.undefined;
    });
  });
});
