import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {BonusCardId, COLONY_CELL_PRICE_MC, MarsBotTrackRole} from '../../src/common/automa/AutomaTypes';
import {CardName} from '../../src/common/cards/CardName';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {Tag} from '../../src/common/cards/Tag';
import {TileType} from '../../src/common/TileType';
import {Board} from '../../src/server/boards/Board';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Space} from '../../src/server/boards/Space';
import {AwardScorer} from '../../src/server/awards/AwardScorer';
import {ArtificialLake} from '../../src/server/cards/base/ArtificialLake';
import {Mine} from '../../src/server/cards/base/Mine';
import {AmazonisEngineer} from '../../src/server/awards/amazonisPlanitia/AmazonisEngineer';
import {AutomaMAEvaluation} from '../../src/server/automa/AutomaMAEvaluation';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {AutomaSetup} from '../../src/server/automa/AutomaSetup';
import {AutomaState} from '../../src/server/automa/AutomaState';
import {AutomaTilePlacer} from '../../src/server/automa/AutomaTilePlacer';
import {botCoveredIconMegacredits, botRewardIcons} from '../../src/server/automa/AutomaPlacementBonus';
import {marsBotMapProfile} from '../../src/server/automa/boards/MarsBotMapProfile';
import {AMAZONIS_TRACK} from '../../src/server/automa/boards/AmazonisMarsBot';
import {VENUS_CELL9_TARGET_TRACK, VENUS_TRACK_INDEX} from '../../src/server/automa/boards/VenusMarsBot';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {Server} from '../../src/server/models/ServerModel';
import {testAutomaGame} from './AutomaTestGame';

/**
 * AMAZONIS PLANITIA, THE FAN MAP (`BoardName.AMAZONIS`) + MarsBot — the second
 * map with a HOME-MADE board, Corporate Competition (BF2) and milestone / award
 * rules (docs/AUTOMA_DATA_AUDIT.md §2g / §18, the owner's decisions of
 * 2026-11-02). Four names of the row carry OFFICIAL rules from the Awards &
 * Milestones list (Forester, Terran, Promoter, A. Zoologist) and Colonizer is
 * that list's Pioneer at 4 colonies — its three cubes printed as `colony5`
 * cells; the rest are home rules by their official precedent.
 */
const AMAZONIS = {boardName: BoardName.AMAZONIS} as const;
const BF2 = BonusCardId.BF2_CORPORATE_COMPETITION_AMAZONIS;

function amazonisGame(options?: object, suffix = ''): ReturnType<typeof testAutomaGame> {
  return testAutomaGame({...AMAZONIS, ...options}, suffix);
}

function amazonisRedux(options?: object): ReturnType<typeof testAutomaGame> {
  const result = testAutomaGame({...AMAZONIS, coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'politics', ...options});
  result[0].automa!.lobbyMandate = {generation: result[0].generation, card: 0, sent: 0};
  return result;
}

function position(game: IGame, role: MarsBotTrackRole): number {
  return game.automa!.board.getTrackOfRole(role)!.position;
}

function setPosition(game: IGame, role: MarsBotTrackRole, value: number): void {
  game.automa!.board.getTrackOfRole(role)!.position = value;
}

function setAll(game: IGame, value: number): void {
  for (const track of game.automa!.board.tracks) {
    track.position = value;
  }
}

function milestone(game: IGame, name: string) {
  const found = game.milestones.find((m) => m.name === name);
  expect(found, `the map's milestone ${name}`).is.not.undefined;
  return found!;
}

function award(game: IGame, name: string) {
  const found = game.awards.find((a) => a.name === name);
  expect(found, `the map's award ${name}`).is.not.undefined;
  return found!;
}

function met(game: IGame, name: string): boolean {
  return AutomaMAEvaluation.botMilestoneMet(milestone(game, name), game);
}

function shown(game: IGame, name: string): number {
  return AutomaMAEvaluation.botMilestoneScore(milestone(game, name), game);
}

function score(game: IGame, name: string): number {
  return AutomaMAEvaluation.botAwardScore(award(game, name), game);
}

function resolve(game: IGame, id: BonusCardId) {
  const outcome = resolveBonusCard(game, id);
  routeBonusCard(game, id, outcome);
  return outcome;
}

function fund(game: IGame, human: IPlayer, name: string) {
  game.fundAward(human, award(game, name));
}

/** An empty land space matching `predicate`. */
function land(game: IGame, predicate: (space: Space) => boolean): Space {
  const space = game.board.spaces.find((s) =>
    s.spaceType === SpaceType.LAND && s.tile === undefined && predicate(s));
  expect(space, 'the fixture needs this space').is.not.undefined;
  return space!;
}

function emptyNeighbours(game: IGame, space: Space): number {
  return game.board.getAdjacentSpaces(space).filter(Board.isEmptyArea).length;
}

function botColonies(game: IGame, bot: IPlayer): number {
  return game.colonies.filter((c) => c.colonies.includes(bot.id)).length;
}

/** Land the marker on space 7 — the first «colony for 5 M€» cell. */
function landOnColonyCell(game: IGame): void {
  setPosition(game, 'space', 6);
  AutomaResolver.advanceTrack(game, AMAZONIS_TRACK.SPACE);
}

describe('AMAZONIS PLANITIA (fan map) + MarsBot — setup', () => {
  it('is playable, on the fan map, with the map\'s own rows', () => {
    const [game] = amazonisGame();
    expect(game.gameOptions.boardName).eq(BoardName.AMAZONIS);
    expect(game.automa).is.not.undefined;
    expect(game.automa!.board.tracks.map((t) => t.definition.layout)).deep.eq(marsBotMapProfile(BoardName.AMAZONIS).tracks.map((t) => t.layout));
    expect(game.milestones.map((m) => m.name)).deep.eq(['Colonizer', 'Forester', 'Minimalist', 'Terran', 'Tropicalist']);
    expect(game.awards.map((a) => a.name)).deep.eq(['Curator', 'A. Engineer', 'Promoter', 'Tourist', 'A. Zoologist']);
    expect(game.board.spaces.filter((s) => s.spaceType === SpaceType.RESTRICTED).map((s) => s.id), 'the restricted centre').deep.eq(['33']);
  });

  it('builds the bonus deck with BF2, and no other map\'s card', () => {
    const deck = AutomaSetup.bonusDeckContents({boardName: BoardName.AMAZONIS} as never);
    expect(deck).contains(BF2);
    for (const other of [
      BonusCardId.B08_CORPORATE_COMPETITION, BonusCardId.B09_CORPORATE_COMPETITION_HELLAS, BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM,
      BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA, BonusCardId.B12_CORPORATE_COMPETITION_CIMMERIA, BonusCardId.B13_CORPORATE_COMPETITION_BOREALIS,
      BonusCardId.BF1_CORPORATE_COMPETITION_VASTITAS_FAN,
    ]) {
      expect(deck, other).does.not.contain(other);
    }
    expect(AutomaSetup.bonusDeckContents({boardName: BoardName.VASTITAS_BOREALIS} as never)).does.not.contain(BF2);
  });
});

describe('AMAZONIS PLANITIA (fan map) + MarsBot — tag → track resolution', () => {
  function resolveTag(game: IGame, tag: Tag): void {
    AutomaResolver.advanceTrack(game, game.automa!.board.getTrackIndexForTag(tag)!);
  }

  it('a Jovian tag advances the POWER track (the A&M cube row) — not Science, not Earth', () => {
    const [game] = amazonisGame();
    resolveTag(game, Tag.JOVIAN);
    expect(position(game, 'power')).is.at.least(1);
    expect(position(game, 'science')).eq(0);
    expect(position(game, 'earth')).eq(0);
  });

  it('a City tag advances the City/EARTH track; a Science tag the standalone science track', () => {
    const [game] = amazonisGame();
    resolveTag(game, Tag.CITY);
    resolveTag(game, Tag.SCIENCE);
    expect(position(game, 'earth')).is.at.least(1);
    expect(position(game, 'science')).is.at.least(1);
    expect(position(game, 'power')).eq(0);
  });

  it('with Venus Next, the SHARED Venus row\'s cell-9 microbe advances the bio row', () => {
    const [game] = amazonisGame({venusNextExtension: true});
    const venus = game.automa!.board.trackIndexOfRoleOrThrow('venus');
    expect(venus).eq(VENUS_TRACK_INDEX);
    game.automa!.board.tracks[venus].position = 8;
    setPosition(game, 'bio', 0); // lands on 1, which is empty
    AutomaResolver.advanceTrack(game, venus);
    expect(position(game, 'bio')).eq(1);
  });
});

describe('AMAZONIS PLANITIA (fan map) + MarsBot — the «colony for 5 M€» cells (the A&M Pioneer cubes, §2g)', () => {
  it('with Colonies: reaching the cell builds a colony through the ordinary pipeline, THEN charges 5 M€', () => {
    const [game, , bot] = amazonisGame({coloniesExtension: true});
    bot.megaCredits = 10;
    const before = botColonies(game, bot);
    landOnColonyCell(game);
    expect(position(game, 'space')).eq(7);
    expect(botColonies(game, bot), 'exactly one colony was built').eq(before + 1);
    expect(bot.megaCredits, '10 − 5').eq(10 - COLONY_CELL_PRICE_MC);
  });

  it('a bot below the price loses what it has — the printed sentence sets no condition', () => {
    const [game, , bot] = amazonisGame({coloniesExtension: true});
    bot.megaCredits = 3;
    const before = botColonies(game, bot);
    landOnColonyCell(game);
    expect(botColonies(game, bot)).eq(before + 1);
    expect(bot.megaCredits).eq(0);
  });

  it('with every eligible tile taken it is a Failed Action — and the price is NOT charged', () => {
    const [game, , bot] = amazonisGame({coloniesExtension: true});
    for (const colony of game.colonies) {
      while (!colony.isFull()) {
        colony.colonies.push(bot.id);
      }
    }
    bot.megaCredits = 10;
    const failed = game.automa!.failedActions;
    landOnColonyCell(game);
    expect(game.automa!.failedActions).eq(failed + 1);
    expect(bot.megaCredits, 'the Failed Action paid its 5 M€, the cell charged nothing').eq(15);
  });

  it('WITHOUT Colonies the icon is ignored — no colony, no charge, no Failed Action', () => {
    const [game, , bot] = amazonisGame();
    bot.megaCredits = 10;
    const failed = game.automa!.failedActions;
    expect(() => landOnColonyCell(game)).does.not.throw();
    expect(position(game, 'space')).eq(7);
    expect(bot.megaCredits).eq(10);
    expect(game.automa!.failedActions).eq(failed);
  });

  it('all three cells exist: space 7, space 10 and power 8', () => {
    const [game] = amazonisGame({coloniesExtension: true});
    const layout = (role: MarsBotTrackRole) => game.automa!.board.getTrackOfRole(role)!.definition.layout;
    expect(layout('space')[7]).eq('colony5');
    expect(layout('space')[10]).eq('colony5');
    expect(layout('power')[8]).eq('colony5');
  });
});

describe('AMAZONIS PLANITIA (fan map) + MarsBot — placement tiebreakers (§18.4)', () => {
  const inland = (game: IGame, s: Space) => !game.board.getAdjacentSpaces(s).some(Board.isOceanSpace);

  it('OCEANS come first: a bare hex beside an ocean tile beats a 2-icon hex away from water', () => {
    const [game, , bot] = amazonisGame();
    const coast = land(game, (s) => s.bonus.length === 0 && Board.isEquatorialRegion(s) &&
      game.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined));
    const ocean = game.board.getAdjacentSpaces(coast).find((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined)!;
    game.simpleAddTile(bot, ocean, {tileType: TileType.OCEAN});
    const rich = land(game, (s) => s.bonus.length === 2 && Board.isEquatorialRegion(s) && inland(game, s));
    expect(AutomaTilePlacer.breakTie(game, [rich, coast])).eq(coast);
  });

  it('then the EQUATORIAL REGION (Tropicalist): a bare equatorial hex beats a 2-icon hex outside the rows', () => {
    const [game] = amazonisGame();
    const equatorial = land(game, (s) => s.bonus.length === 0 && Board.isEquatorialRegion(s) && inland(game, s));
    const north = land(game, (s) => s.bonus.length === 2 && !Board.isEquatorialRegion(s) && inland(game, s));
    expect(AutomaTilePlacer.breakTie(game, [north, equatorial])).eq(equatorial);
  });

  it('then the REWARD ICONS within the region', () => {
    const [game] = amazonisGame();
    const bare = land(game, (s) => s.bonus.length === 0 && Board.isEquatorialRegion(s) && inland(game, s));
    const rich = land(game, (s) => s.bonus.length === 2 && Board.isEquatorialRegion(s) && inland(game, s));
    expect(AutomaTilePlacer.breakTie(game, [bare, rich])).eq(rich);
  });

  it('then the MOST EMPTY NEIGHBOURS (Tourist): a hex with a tile beside it yields to an equal hex in the open', () => {
    const [game, human] = amazonisGame();
    // Two equal candidates: bare, equatorial, inland, the same count of empty neighbours.
    const candidates = game.board.spaces.filter((s) => s.spaceType === SpaceType.LAND && s.tile === undefined &&
      s.bonus.length === 0 && Board.isEquatorialRegion(s) && inland(game, s));
    let a: Space | undefined;
    let b: Space | undefined;
    outer: for (const x of candidates) {
      for (const y of candidates) {
        if (x !== y && emptyNeighbours(game, x) === emptyNeighbours(game, y) &&
            !game.board.getAdjacentSpaces(x).includes(y)) {
          a = x;
          b = y;
          break outer;
        }
      }
    }
    expect(a, 'the fixture needs two equal candidates').is.not.undefined;
    // A human greenery beside A (and not beside B) takes one empty neighbour from A.
    const beside = game.board.getAdjacentSpaces(a!).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined &&
      !game.board.getAdjacentSpaces(b!).includes(s) && s !== b);
    expect(beside, 'a cell beside A only').is.not.undefined;
    game.simpleAddTile(human, beside!, {tileType: TileType.GREENERY});
    expect(emptyNeighbours(game, a!)).is.below(emptyNeighbours(game, b!));
    expect(AutomaTilePlacer.breakTie(game, [a!, b!])).eq(b);
  });

  it('a microbe / animal icon is an ordinary icon: counted, and paid 1 M€', () => {
    const [game, , bot] = amazonisGame();
    const microbe = land(game, (s) => s.bonus.length === 2 && s.volcanic === true); // Albor Tholus: microbe × 2
    expect(botRewardIcons(game, bot, microbe)).eq(2);
    expect(botCoveredIconMegacredits(game, microbe)).eq(2);
  });

  it('the restricted centre is never a candidate', () => {
    const [game, , bot] = amazonisGame();
    const centre = game.board.getSpaceOrThrow('33');
    expect(game.board.getAvailableSpacesForGreenery(bot)).to.not.include(centre);
    expect(game.board.getAvailableSpacesForCity(bot)).to.not.include(centre);
  });
});

describe('AMAZONIS PLANITIA (fan map) + MarsBot — milestones (§18.2)', () => {
  it('Colonizer: UNCHANGED — the bot\'s REAL colonies, 4 of them', () => {
    const [game, , bot] = amazonisGame({coloniesExtension: true});
    expect(met(game, 'Colonizer')).is.false;
    for (let i = 0; i < 3; i++) {
      game.colonies[i % game.colonies.length].colonies.push(bot.id);
    }
    expect(met(game, 'Colonizer')).is.false;
    expect(shown(game, 'Colonizer'), 'the player metric').eq(3);
    game.colonies[3 % game.colonies.length].colonies.push(bot.id);
    expect(bot.getColoniesCount()).eq(4);
    expect(met(game, 'Colonizer')).is.true;
  });

  it('Forester (OFFICIAL, A&M p.13): the bio track at 6', () => {
    const [game] = amazonisGame();
    setPosition(game, 'bio', 5);
    expect(met(game, 'Forester')).is.false;
    setPosition(game, 'bio', 6);
    expect(met(game, 'Forester')).is.true;
  });

  it('Terran (the A&M calibration, scaled to 6 tags): the City/Earth track at 6', () => {
    const [game] = amazonisGame();
    setPosition(game, 'earth', 5);
    expect(met(game, 'Terran')).is.false;
    setPosition(game, 'earth', 6);
    expect(met(game, 'Terran')).is.true;
    expect(shown(game, 'Terran')).eq(6);
  });

  it('Minimalist (HOME RULE): met while at most 2 cards are left in the bot\'s action deck — never «hand 0»', () => {
    const [game, , bot] = amazonisGame();
    const automa = game.automa!;
    expect(automa.actionDeck.length, 'the fixture: the deck holds more than 2').is.above(2);
    expect(milestone(game, 'Minimalist').canClaim(bot), 'the human reading would be met at once (an empty hand)').is.true;
    expect(met(game, 'Minimalist'), 'the bot reading is not').is.false;
    expect(shown(game, 'Minimalist')).eq(0);
    automa.actionDeck = automa.actionDeck.slice(0, 2);
    expect(met(game, 'Minimalist')).is.true;
    expect(shown(game, 'Minimalist')).eq(1);
    automa.actionDeck = [];
    expect(met(game, 'Minimalist')).is.true;
  });

  it('Tropicalist: UNCHANGED — the bot\'s real tiles in the three equatorial rows', () => {
    const [game, , bot] = amazonisGame();
    const spots = game.board.spaces.filter((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && Board.isEquatorialRegion(s));
    game.simpleAddTile(bot, spots[0], {tileType: TileType.GREENERY});
    game.simpleAddTile(bot, spots[1], {tileType: TileType.GREENERY});
    expect(met(game, 'Tropicalist')).is.false;
    const north = land(game, (s) => !Board.isEquatorialRegion(s));
    game.simpleAddTile(bot, north, {tileType: TileType.GREENERY});
    expect(met(game, 'Tropicalist'), 'a tile outside the rows does not count').is.false;
    game.simpleAddTile(bot, spots[2], {tileType: TileType.GREENERY});
    expect(met(game, 'Tropicalist')).is.true;
  });
});

describe('AMAZONIS PLANITIA (fan map) + MarsBot — awards (§18.3)', () => {
  it('Curator (HOME RULE, Mogul\'s shape without the doubling): the most-advanced track space', () => {
    const [game] = amazonisGame();
    setAll(game, 3);
    setPosition(game, 'building', 9);
    expect(score(game, 'Curator')).eq(9);
  });

  it('A. Engineer: the production cards of the played pile — the award\'s own predicate', () => {
    const [game, , bot] = amazonisGame();
    expect(AmazonisEngineer.altersProduction(new Mine()), 'the fixture: Mine alters production').is.true;
    expect(AmazonisEngineer.altersProduction(new ArtificialLake()), 'and Artificial Lake does not').is.false;
    expect(score(game, 'A. Engineer')).eq(0);
    game.automa!.playedPile.push(CardName.MINE, CardName.ARTIFICIAL_LAKE, CardName.MINE);
    expect(score(game, 'A. Engineer')).eq(2);
    expect(award(game, 'A. Engineer').getScore(bot), 'the player evaluator would read the empty tableau').eq(0);
  });

  it('Promoter (OFFICIAL): the event track; A. Zoologist (OFFICIAL): bio + 5', () => {
    const [game] = amazonisGame();
    setPosition(game, 'event', 7);
    setPosition(game, 'bio', 4);
    expect(score(game, 'Promoter')).eq(7);
    expect(score(game, 'A. Zoologist')).eq(9);
  });

  it('Tourist: UNCHANGED — the bot\'s real tiles and their real empty neighbours', () => {
    const [game, , bot] = amazonisGame();
    const spot = land(game, (s) => Board.isEquatorialRegion(s));
    game.simpleAddTile(bot, spot, {tileType: TileType.GREENERY});
    expect(score(game, 'Tourist')).eq(award(game, 'Tourist').getScore(bot));
    expect(score(game, 'Tourist')).eq(emptyNeighbours(game, spot));
    expect(new AwardScorer(game, award(game, 'Tourist')).get(bot), 'the endgame scorer reads the same number').eq(score(game, 'Tourist'));
  });
});

describe('AMAZONIS PLANITIA (fan map) + MarsBot — BF2 Corporate Competition (§18.6)', () => {
  it('Curator advances the MOST-advanced track (the topmost if tied) and costs the 5 M€', () => {
    const [game, human, bot] = amazonisGame();
    fund(game, human, 'Curator');
    setAll(game, 2);
    setPosition(game, 'building', 10); // lands on 11, which is empty
    bot.megaCredits = 6;
    resolve(game, BF2);
    expect(position(game, 'building')).eq(11);
    expect(bot.megaCredits).eq(1);
  });

  it('A. Engineer reveals until a card that ALTERS PRODUCTION, resolves it and discards the rest', () => {
    const [game, human, bot] = amazonisGame();
    fund(game, human, 'A. Engineer');
    bot.megaCredits = 6;
    game.projectDeck.drawPile.push(new Mine()); // found second
    game.projectDeck.drawPile.push(new ArtificialLake()); // rejected first
    resolve(game, BF2);
    expect(game.automa!.playedPile).contains(CardName.MINE);
    expect(game.projectDeck.discardPile.map((c) => c.name)).contains(CardName.ARTIFICIAL_LAKE);
    expect(bot.megaCredits, 'the 5 M€ paid (Mine\'s building tag covered no icon)').eq(1);
  });

  it('Tourist places a CITY with every adjacent space empty', () => {
    const [game, human, bot] = amazonisGame();
    fund(game, human, 'Tourist');
    bot.megaCredits = 6;
    resolve(game, BF2);
    const cities = game.board.spaces.filter((s) => s.player === bot && Board.isCitySpace(s));
    expect(cities).has.length(1);
    expect(game.board.getAdjacentSpaces(cities[0]).every((adj) => adj.tile === undefined), 'nothing stands beside it').is.true;
    expect(bot.megaCredits, '6 − 5, plus 1 M€ per printed icon the city covered').eq(1 + cities[0].bonus.length);
  });

  it('Tourist with no such legal space is impossible — nothing placed, nothing paid', () => {
    const [game, human, bot] = amazonisGame();
    fund(game, human, 'Tourist');
    bot.megaCredits = 6;
    for (const space of game.board.spaces.filter((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)) {
      game.simpleAddTile(human, space, {tileType: TileType.GREENERY});
    }
    game.automa!.bonusDeck = [];
    game.automa!.bonusDiscard = [];
    resolve(game, BF2);
    expect(game.board.spaces.some((s) => s.player === bot && Board.isCitySpace(s))).is.false;
    expect(bot.megaCredits).eq(6);
  });

  it('Promoter advances the event track; A. Zoologist the bio track', () => {
    const [game, human, bot] = amazonisGame();
    fund(game, human, 'Promoter');
    setPosition(game, 'event', 1); // lands on 2, which is empty
    bot.megaCredits = 6;
    resolve(game, BF2);
    expect(position(game, 'event')).eq(2);
    expect(bot.megaCredits).eq(1);

    const [zoo, zooHuman, zooBot] = amazonisGame({}, '-zoologist');
    fund(zoo, zooHuman, 'A. Zoologist');
    setPosition(zoo, 'bio', 1); // lands on 2, which is empty
    zooBot.megaCredits = 6;
    resolve(zoo, BF2);
    expect(position(zoo, 'bio')).eq(2);
  });

  it('Venuphile advances the Venus track (added to every version of the card)', () => {
    const [game, human, bot] = amazonisGame({venusNextExtension: true});
    fund(game, human, 'Venuphile');
    bot.megaCredits = 6;
    resolve(game, BF2);
    expect(position(game, 'venus')).is.at.least(1);
    expect(bot.megaCredits).eq(1);
  });
});

describe('AMAZONIS PLANITIA (fan map) + MarsBot — a real game runs', () => {
  it('resolves 30 track advances with Venus + Colonies + Redux without a dead end', () => {
    const [game] = amazonisRedux({
      venusNextExtension: true,
      coloniesExtension: true,
      preludeExtension: true,
      corporation: 'random',
    });
    for (let i = 0; i < 30; i++) {
      expect(() => AutomaResolver.advanceTrack(game, i % 8)).does.not.throw();
    }
    expect(game.automa!.board.tracks.every((t) => t.position <= t.maxPosition)).is.true;
  });
});

describe('AMAZONIS PLANITIA (fan map) + MarsBot — what the client receives, and what a save keeps', () => {
  it('the server model carries the cells and tag pairings — the colony cells included', () => {
    const [game] = amazonisGame({venusNextExtension: true});
    const model = Server.getGameModel(game).automa!;
    expect(model.tracks).has.length(8);
    expect(model.tracks[AMAZONIS_TRACK.POWER].tags).deep.eq([Tag.POWER, Tag.JOVIAN]);
    expect(model.tracks[AMAZONIS_TRACK.EARTH].tags).deep.eq([Tag.CITY, Tag.EARTH]);
    expect(model.tracks[AMAZONIS_TRACK.SCIENCE].tags).deep.eq([Tag.SCIENCE]);
    expect(model.tracks[AMAZONIS_TRACK.SPACE].layout[7]).eq('colony5');
    expect(model.tracks[AMAZONIS_TRACK.POWER].layout[8]).eq('colony5');
    expect(model.tracks[VENUS_TRACK_INDEX].layout[9]).eq(`tag_${VENUS_CELL9_TARGET_TRACK}`);
  });

  it('round-trips through the map profile: only the map NAME is stored', () => {
    const [game] = amazonisGame({venusNextExtension: true});
    setPosition(game, 'power', 7);
    const restored = AutomaState.deserialize(game.automa!.serialize(), game.gameOptions);
    expect(restored.board.getTrackOfRole('power')!.position).eq(7);
    expect(restored.board.getTrackIndexForTag(Tag.JOVIAN)).eq(restored.board.trackIndexOfRoleOrThrow('power'));
    expect(restored.board.tracks[AMAZONIS_TRACK.SPACE].definition.layout[10]).eq('colony5');
  });
});
