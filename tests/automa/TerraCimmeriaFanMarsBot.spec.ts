import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {BonusCardId, MarsBotTrackRole} from '../../src/common/automa/AutomaTypes';
import {CardName} from '../../src/common/cards/CardName';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {Tag} from '../../src/common/cards/Tag';
import {TileType} from '../../src/common/TileType';
import {Board} from '../../src/server/boards/Board';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Space} from '../../src/server/boards/Space';
import {AwardScorer} from '../../src/server/awards/AwardScorer';
import {Warmonger} from '../../src/server/awards/terraCimmeria/Warmonger';
import {Mine} from '../../src/server/cards/base/Mine';
import {EnergyTapping} from '../../src/server/cards/base/EnergyTapping';
import {AutomaMAEvaluation} from '../../src/server/automa/AutomaMAEvaluation';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {AutomaSetup} from '../../src/server/automa/AutomaSetup';
import {AutomaState} from '../../src/server/automa/AutomaState';
import {AutomaTilePlacer} from '../../src/server/automa/AutomaTilePlacer';
import {botCoveredIconMegacredits, botRewardIcons} from '../../src/server/automa/AutomaPlacementBonus';
import {marsBotMapProfile} from '../../src/server/automa/boards/MarsBotMapProfile';
import {TERRA_CIMMERIA_FAN_TRACK} from '../../src/server/automa/boards/TerraCimmeriaFanMarsBot';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {Server} from '../../src/server/models/ServerModel';
import {testAutomaGame} from './AutomaTestGame';

/**
 * THE OLD (fan) TERRA CIMMERIA (`BoardName.TERRA_CIMMERIA`) + MarsBot — the third map with a HOME-MADE board,
 * Corporate Competition (BF3) and milestone / award rules (docs/AUTOMA_DATA_AUDIT.md §2h / §19, the owner's decisions
 * of 2026-11-03). Biologist and Incorporator carry OFFICIAL rules from the Awards & Milestones list; the rest are home
 * rules by their official precedent, most of them «as usual» — the bot honestly has the quantity (its tiles, the
 * awards it funds, the delegates it places, its played pile).
 */
const TC = {boardName: BoardName.TERRA_CIMMERIA} as const;
const BF3 = BonusCardId.BF3_CORPORATE_COMPETITION_TERRA_CIMMERIA_FAN;

function tcGame(options?: object, suffix = ''): ReturnType<typeof testAutomaGame> {
  return testAutomaGame({...TC, ...options}, suffix);
}

function tcRedux(options?: object): ReturnType<typeof testAutomaGame> {
  const result = testAutomaGame({...TC, coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'politics', ...options});
  result[0].automa!.lobbyMandate = {generation: result[0].generation, card: 0, sent: 0};
  return result;
}

function position(game: IGame, role: MarsBotTrackRole): number {
  return game.automa!.board.getTrackOfRole(role)!.position;
}

function setPosition(game: IGame, role: MarsBotTrackRole, value: number): void {
  game.automa!.board.getTrackOfRole(role)!.position = value;
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

const inland = (game: IGame, s: Space) => !game.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.OCEAN);

/** An empty land space matching `predicate`. */
function land(game: IGame, predicate: (space: Space) => boolean): Space {
  const space = game.board.spaces.find((s) =>
    s.spaceType === SpaceType.LAND && s.tile === undefined && predicate(s));
  expect(space, 'the fixture needs this space').is.not.undefined;
  return space!;
}

describe('the OLD (fan) TERRA CIMMERIA + MarsBot — setup', () => {
  it('is playable, on the old map, with its own rows', () => {
    const [game] = tcGame();
    expect(game.gameOptions.boardName).eq(BoardName.TERRA_CIMMERIA);
    expect(game.automa).is.not.undefined;
    expect(game.automa!.board.tracks.map((t) => t.definition.layout)).deep.eq(marsBotMapProfile(BoardName.TERRA_CIMMERIA).tracks.map((t) => t.layout));
    expect(game.milestones.map((m) => m.name)).deep.eq(['T. Collector', 'Firestarter', 'Terra Pioneer', 'T. Spacefarer', 'Gambler']);
    expect(game.awards.map((a) => a.name)).deep.eq(['Biologist', 'Incorporator', 'T. Politician', 'Urbanist', 'Warmonger']);
  });

  it('builds the bonus deck with BF3, and no other map\'s card — the official map keeps B12', () => {
    const deck = AutomaSetup.bonusDeckContents({boardName: BoardName.TERRA_CIMMERIA} as never);
    expect(deck).contains(BF3);
    for (const other of [
      BonusCardId.B08_CORPORATE_COMPETITION, BonusCardId.B09_CORPORATE_COMPETITION_HELLAS, BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM,
      BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA, BonusCardId.B12_CORPORATE_COMPETITION_CIMMERIA, BonusCardId.B13_CORPORATE_COMPETITION_BOREALIS,
      BonusCardId.BF1_CORPORATE_COMPETITION_VASTITAS_FAN, BonusCardId.BF2_CORPORATE_COMPETITION_AMAZONIS,
    ]) {
      expect(deck, other).does.not.contain(other);
    }
    const nova = AutomaSetup.bonusDeckContents({boardName: BoardName.TERRA_CIMMERIA_NOVA} as never);
    expect(nova).contains(BonusCardId.B12_CORPORATE_COMPETITION_CIMMERIA);
    expect(nova).does.not.contain(BF3);
  });
});

describe('the OLD (fan) TERRA CIMMERIA + MarsBot — tag → track resolution', () => {
  it('a Jovian tag advances the POWER track, a City tag the City/EARTH track (Tharsis\' pairing, never Nova\'s)', () => {
    const [game] = tcGame();
    const board = game.automa!.board;
    expect(board.getTrackIndexForTag(Tag.JOVIAN)).eq(TERRA_CIMMERIA_FAN_TRACK.POWER);
    expect(board.getTrackIndexForTag(Tag.CITY)).eq(TERRA_CIMMERIA_FAN_TRACK.EARTH);
    expect(board.getTrackIndexForTag(Tag.SCIENCE)).eq(TERRA_CIMMERIA_FAN_TRACK.SCIENCE);
    expect(board.getTrackIndexForTag(Tag.POWER)).eq(TERRA_CIMMERIA_FAN_TRACK.POWER);
  });

  it('the building row\'s ENERGY icon (space 4) advances the power track', () => {
    const [game] = tcGame();
    setPosition(game, 'building', 3);
    setPosition(game, 'power', 2); // lands on 3 (TR) — power 1 itself prints «advance», which would chain a second step
    AutomaResolver.advanceTrack(game, TERRA_CIMMERIA_FAN_TRACK.BUILDING);
    expect(position(game, 'building')).eq(4);
    expect(position(game, 'power')).eq(3);
  });
});

describe('the OLD (fan) TERRA CIMMERIA + MarsBot — the map\'s cells for the bot', () => {
  it('an ENERGY icon on a cell is an ordinary icon: counted, and paid 1 M€', () => {
    const [game, , bot] = tcGame();
    const energy = land(game, (s) => s.bonus.includes(SpaceBonus.ENERGY));
    expect(botRewardIcons(game, bot, energy)).eq(energy.bonus.length);
    expect(botCoveredIconMegacredits(game, energy)).eq(energy.bonus.length);
  });
});

describe('the OLD (fan) TERRA CIMMERIA + MarsBot — placement tiebreakers (§19.4)', () => {
  it('OCEANS come first: a bare hex beside an ocean tile beats a hex next to the bot\'s city', () => {
    const [game, , bot] = tcGame();
    const coast = land(game, (s) => game.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined));
    const ocean = game.board.getAdjacentSpaces(coast).find((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined)!;
    game.simpleAddTile(bot, ocean, {tileType: TileType.OCEAN});
    const city = land(game, (s) => inland(game, s) && !game.board.getAdjacentSpaces(s).includes(coast) && s !== coast);
    game.simpleAddTile(bot, city, {tileType: TileType.CITY});
    const byCity = game.board.getAdjacentSpaces(city).find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && inland(game, s))!;
    expect(byCity, 'a cell beside the bot\'s city').is.not.undefined;
    expect(AutomaTilePlacer.breakTie(game, [byCity, coast])).eq(coast);
  });

  it('then BESIDE ITS OWN CITY (Urbanist): a bare hex at the bot\'s city beats a 2-icon hex elsewhere', () => {
    const [game, , bot] = tcGame();
    const city = land(game, (s) => inland(game, s));
    game.simpleAddTile(bot, city, {tileType: TileType.CITY});
    const near = game.board.getAdjacentSpaces(city).filter((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && inland(game, s));
    const byCity = near.sort((a, b) => a.bonus.length - b.bonus.length)[0];
    const rich = land(game, (s) => s.bonus.length >= 2 && inland(game, s) && !game.board.getAdjacentSpaces(s).includes(city));
    expect(byCity.bonus.length).is.below(rich.bonus.length);
    expect(AutomaTilePlacer.breakTie(game, [rich, byCity])).eq(byCity);
  });

  it('a HUMAN\'s city pulls nothing — the step counts the bot\'s own cities only', () => {
    const [game, human] = tcGame();
    const city = land(game, (s) => inland(game, s));
    game.simpleAddTile(human, city, {tileType: TileType.CITY});
    const byCity = game.board.getAdjacentSpaces(city).filter((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && inland(game, s))
      .sort((a, b) => a.bonus.length - b.bonus.length)[0];
    const rich = land(game, (s) => s.bonus.length >= 2 && inland(game, s) && !game.board.getAdjacentSpaces(s).includes(city));
    expect(AutomaTilePlacer.breakTie(game, [byCity, rich])).eq(rich);
  });
});

describe('the OLD (fan) TERRA CIMMERIA + MarsBot — milestones (§19.2)', () => {
  it('T. Collector (HOME RULE, «as usual» in the played pile): complete sets of green, blue and red cards — 3', () => {
    const [game] = tcGame();
    const pile = game.automa!.playedPile;
    pile.push(CardName.MINE, CardName.MINE, CardName.MINE, CardName.BIG_ASTEROID, CardName.BIG_ASTEROID, CardName.BIG_ASTEROID);
    pile.push(CardName.AQUIFER_PUMPING, CardName.AQUIFER_PUMPING);
    expect(met(game, 'T. Collector'), 'two blue cards — two sets').is.false;
    expect(AutomaMAEvaluation.botMilestoneScore(milestone(game, 'T. Collector'), game)).eq(2);
    pile.push(CardName.AQUIFER_PUMPING);
    expect(met(game, 'T. Collector')).is.true;
  });

  it('Firestarter (HOME RULE, the owner\'s answer): the heat-badged (earth) track at 8', () => {
    const [game] = tcGame();
    setPosition(game, 'earth', 7);
    expect(met(game, 'Firestarter')).is.false;
    setPosition(game, 'earth', 8);
    expect(met(game, 'Firestarter')).is.true;
  });

  it('Terra Pioneer: UNCHANGED — the bot\'s real tiles on Mars, 5 of them', () => {
    const [game, , bot] = tcGame();
    const spots = game.board.spaces.filter((s) => s.spaceType === SpaceType.LAND && s.tile === undefined);
    for (let i = 0; i < 4; i++) {
      game.simpleAddTile(bot, spots[i * 3], {tileType: TileType.GREENERY});
    }
    expect(met(game, 'Terra Pioneer')).is.false;
    game.simpleAddTile(bot, spots[20], {tileType: TileType.GREENERY});
    expect(met(game, 'Terra Pioneer')).is.true;
  });

  it('T. Spacefarer (HOME RULE, the N ↔ N law): the space track at 6', () => {
    const [game] = tcGame();
    setPosition(game, 'space', 5);
    expect(met(game, 'T. Spacefarer')).is.false;
    setPosition(game, 'space', 6);
    expect(met(game, 'T. Spacefarer')).is.true;
  });

  it('Gambler: UNCHANGED — the awards the bot really funded, 2 of them', () => {
    const [game, , bot] = tcGame();
    game.fundAward(bot, award(game, 'Biologist'));
    expect(met(game, 'Gambler')).is.false;
    game.fundAward(bot, award(game, 'Urbanist'));
    expect(met(game, 'Gambler')).is.true;
  });
});

describe('the OLD (fan) TERRA CIMMERIA + MarsBot — awards (§19.3)', () => {
  it('Biologist (OFFICIAL, A&M p.14): bio + 5', () => {
    const [game] = tcGame();
    setPosition(game, 'bio', 4);
    expect(score(game, 'Biologist')).eq(9);
  });

  it('Incorporator (OFFICIAL): the ≤ 10 M€ cards of the played pile, events included', () => {
    const [game] = tcGame();
    game.automa!.playedPile.push(CardName.MINE, CardName.AQUIFER_PUMPING);
    expect(score(game, 'Incorporator')).eq(1); // Mine (4 M€); Aquifer Pumping costs 18
  });

  it('T. Politician: UNCHANGED — the delegates the bot really placed in the Redux Parliament', () => {
    const [game, , bot] = tcRedux();
    expect(score(game, 'T. Politician')).eq(0);
    bot.totalDelegatesPlaced = 3;
    expect(score(game, 'T. Politician')).eq(3);
    expect(new AwardScorer(game, award(game, 'T. Politician')).get(bot), 'the endgame scorer reads the same number').eq(3);
  });

  it('Urbanist: UNCHANGED — the VP of greeneries beside the bot\'s real cities', () => {
    const [game, , bot] = tcGame();
    const city = land(game, (s) => inland(game, s));
    game.simpleAddTile(bot, city, {tileType: TileType.CITY});
    const near = game.board.getAdjacentSpaces(city).filter((s) => s.spaceType === SpaceType.LAND && s.tile === undefined);
    game.simpleAddTile(bot, near[0], {tileType: TileType.GREENERY});
    game.simpleAddTile(bot, near[1], {tileType: TileType.GREENERY});
    expect(score(game, 'Urbanist')).eq(2);
    expect(score(game, 'Urbanist')).eq(award(game, 'Urbanist').getScore(bot));
  });

  it('Warmonger (HOME RULE): the attack cards of the played pile — the award\'s own predicate', () => {
    const [game, , bot] = tcGame();
    expect(Warmonger.include(new EnergyTapping()), 'the fixture: Energy Tapping attacks').is.true;
    expect(Warmonger.include(new Mine()), 'and Mine does not').is.false;
    game.automa!.playedPile.push(CardName.ENERGY_TAPPING, CardName.MINE);
    expect(score(game, 'Warmonger')).eq(1);
    expect(award(game, 'Warmonger').getScore(bot), 'the player evaluator would read the empty tableau').eq(0);
  });
});

describe('the OLD (fan) TERRA CIMMERIA + MarsBot — BF3 Corporate Competition (§19.6)', () => {
  it('Biologist advances the bio track and costs the 5 M€', () => {
    const [game, human, bot] = tcGame();
    fund(game, human, 'Biologist');
    setPosition(game, 'bio', 1); // lands on 2, which is empty
    bot.megaCredits = 6;
    resolve(game, BF3);
    expect(position(game, 'bio')).eq(2);
    expect(bot.megaCredits).eq(1);
  });

  it('Warmonger reveals until an ATTACK card, resolves it and discards the rest', () => {
    const [game, human, bot] = tcGame();
    fund(game, human, 'Warmonger');
    bot.megaCredits = 6;
    game.projectDeck.drawPile.push(new EnergyTapping()); // found second
    game.projectDeck.drawPile.push(new Mine()); // rejected first
    resolve(game, BF3);
    expect(game.automa!.playedPile).contains(CardName.ENERGY_TAPPING);
    expect(game.projectDeck.discardPile.map((c) => c.name)).contains(CardName.MINE);
  });

  it('Urbanist places a GREENERY beside one of the bot\'s cities', () => {
    const [game, human, bot] = tcGame();
    const city = land(game, (s) => inland(game, s));
    game.simpleAddTile(bot, city, {tileType: TileType.CITY});
    fund(game, human, 'Urbanist');
    bot.megaCredits = 6;
    resolve(game, BF3);
    const greeneries = game.board.spaces.filter((s) => s.player === bot && Board.isGreenerySpace(s));
    expect(greeneries).has.length(1);
    expect(game.board.getAdjacentSpaces(greeneries[0])).to.include(city);
  });

  it('Urbanist with no city of the bot is impossible — nothing placed, nothing paid', () => {
    const [game, human, bot] = tcGame();
    fund(game, human, 'Urbanist');
    bot.megaCredits = 6;
    game.automa!.bonusDeck = [];
    game.automa!.bonusDiscard = [];
    resolve(game, BF3);
    expect(game.board.spaces.some((s) => s.player === bot && Board.isGreenerySpace(s))).is.false;
    expect(bot.megaCredits).eq(6);
  });

  it('T. Politician sends ONE delegate through the bot\'s own political door (Redux)', () => {
    const [game, human, bot] = tcRedux();
    fund(game, human, 'T. Politician');
    bot.megaCredits = 6;
    const before = bot.totalDelegatesPlaced;
    resolve(game, BF3);
    expect(bot.totalDelegatesPlaced).eq(before + 1);
    expect(bot.megaCredits).eq(1);
  });

  it('T. Politician WITHOUT a Parliament is impossible — nothing paid', () => {
    const [game, human, bot] = tcGame();
    fund(game, human, 'T. Politician');
    bot.megaCredits = 6;
    game.automa!.bonusDeck = [];
    game.automa!.bonusDiscard = [];
    resolve(game, BF3);
    expect(bot.totalDelegatesPlaced).eq(0);
    expect(bot.megaCredits).eq(6);
  });

  it('Venuphile advances the Venus track (added to every version of the card)', () => {
    const [game, human, bot] = tcGame({venusNextExtension: true});
    fund(game, human, 'Venuphile');
    bot.megaCredits = 6;
    resolve(game, BF3);
    expect(position(game, 'venus')).is.at.least(1);
    expect(bot.megaCredits).eq(1);
  });
});

describe('the OLD (fan) TERRA CIMMERIA + MarsBot — a real game runs', () => {
  it('resolves 30 track advances with Venus + Colonies + Redux without a dead end', () => {
    const [game] = tcRedux({
      venusNextExtension: true,
      preludeExtension: true,
      corporation: 'random',
    });
    for (let i = 0; i < 30; i++) {
      expect(() => AutomaResolver.advanceTrack(game, i % 8)).does.not.throw();
    }
    expect(game.automa!.board.tracks.every((t) => t.position <= t.maxPosition)).is.true;
  });
});

describe('the OLD (fan) TERRA CIMMERIA + MarsBot — what the client receives, and what a save keeps', () => {
  it('the server model carries the cells and tag pairings — the family\'s energy icons included', () => {
    const [game] = tcGame();
    const model = Server.getGameModel(game).automa!;
    expect(model.tracks).has.length(7);
    expect(model.tracks[TERRA_CIMMERIA_FAN_TRACK.POWER].tags).deep.eq([Tag.POWER, Tag.JOVIAN]);
    expect(model.tracks[TERRA_CIMMERIA_FAN_TRACK.EARTH].tags).deep.eq([Tag.CITY, Tag.EARTH]);
    expect(model.tracks[TERRA_CIMMERIA_FAN_TRACK.BUILDING].layout[4]).eq(`tag_${TERRA_CIMMERIA_FAN_TRACK.POWER}`);
  });

  it('round-trips through the map profile: only the map NAME is stored', () => {
    const [game] = tcGame({venusNextExtension: true});
    setPosition(game, 'power', 7);
    const restored = AutomaState.deserialize(game.automa!.serialize(), game.gameOptions);
    expect(restored.board.getTrackOfRole('power')!.position).eq(7);
    expect(restored.board.getTrackIndexForTag(Tag.JOVIAN)).eq(restored.board.trackIndexOfRoleOrThrow('power'));
  });
});
