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
import {ArtificialLake} from '../../src/server/cards/base/ArtificialLake';
import {Mine} from '../../src/server/cards/base/Mine';
import {milestoneThreshold} from '../../src/server/milestones/IMilestone';
import {AutomaMAEvaluation} from '../../src/server/automa/AutomaMAEvaluation';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {AutomaSetup} from '../../src/server/automa/AutomaSetup';
import {AutomaState} from '../../src/server/automa/AutomaState';
import {AutomaTilePlacer} from '../../src/server/automa/AutomaTilePlacer';
import {
  botCoveredIconMegacredits,
  botRewardIcons,
  isVastitasNorthPole,
  isVikingSite,
  needsNorthPoleRebate,
} from '../../src/server/automa/AutomaPlacementBonus';
import {marsBotMapProfile} from '../../src/server/automa/boards/MarsBotMapProfile';
import {VASTITAS_FAN_TRACK} from '../../src/server/automa/boards/VastitasBorealisFanMarsBot';
import {VENUS_CELL9_TARGET_TRACK, VENUS_TRACK_INDEX} from '../../src/server/automa/boards/VenusMarsBot';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {Server} from '../../src/server/models/ServerModel';
import {setTemperature} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

/**
 * VASTITAS BOREALIS, THE FAN MAP (`BoardName.VASTITAS_BOREALIS`) + MarsBot —
 * the first map with a HOME-MADE board, Corporate Competition (BF1) and
 * milestone / award rules (docs/AUTOMA_DATA_AUDIT.md §2f / §17, the owner's
 * decisions of 2026-11-02). Every rule below names its source: an official
 * rule the map shares by name (Smith, Tradesman, Forecaster, Edgedancer,
 * Visionary), an «unchanged» family (Irrigator, Capitalist), or a home rule by
 * its official precedent (V. Electrician, Naturalist, Voyager, the tiebreakers,
 * the three helpers).
 */
const FAN = {boardName: BoardName.VASTITAS_BOREALIS} as const;
const BF1 = BonusCardId.BF1_CORPORATE_COMPETITION_VASTITAS_FAN;

function fanGame(options?: object, suffix = ''): ReturnType<typeof testAutomaGame> {
  return testAutomaGame({...FAN, ...options}, suffix);
}

/** Turmoil Redux on top (it requires Colonies); the lobbying mandate is pinned to 0. */
function fanRedux(options?: object): ReturnType<typeof testAutomaGame> {
  const result = testAutomaGame({...FAN, coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'politics', ...options});
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
  expect(found, `the fan map's milestone ${name}`).is.not.undefined;
  return found!;
}

function award(game: IGame, name: string) {
  const found = game.awards.find((a) => a.name === name);
  expect(found, `the fan map's award ${name}`).is.not.undefined;
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

/** An empty land space matching `predicate` — the fixture for a placement test. */
function land(game: IGame, predicate: (space: Space) => boolean): Space {
  const space = game.board.spaces.find((s) =>
    s.spaceType === SpaceType.LAND && s.tile === undefined && predicate(s));
  expect(space, 'the fixture needs this space').is.not.undefined;
  return space!;
}

/** Next to an ocean RESERVE or an ocean tile — the set the oceans step and Irrigator can ever count. */
function nearWater(game: IGame, space: Space): boolean {
  return game.board.getAdjacentSpaces(space).some((a) => a.spaceType === SpaceType.OCEAN || Board.isOceanSpace(a));
}

function northPole(game: IGame): Space {
  const found = game.board.spaces.find(isVastitasNorthPole);
  expect(found, 'the North Pole hex').is.not.undefined;
  return found!;
}

function botGreeneries(game: IGame, bot: IPlayer): Array<Space> {
  return game.board.spaces.filter((s) => s.player === bot && Board.isGreenerySpace(s));
}

describe('VASTITAS BOREALIS (fan map) + MarsBot — setup', () => {
  it('is playable, on the FAN map — not the Nova one', () => {
    const [game] = fanGame();
    expect(game.gameOptions.boardName).eq(BoardName.VASTITAS_BOREALIS);
    expect(game.automa).is.not.undefined;
    expect(game.automa!.board.tracks.map((t) => t.definition.layout)).deep.eq(marsBotMapProfile(BoardName.VASTITAS_BOREALIS).tracks.map((t) => t.layout));
  });

  it('builds the bonus deck with BF1, and no other map\'s card', () => {
    const deck = AutomaSetup.bonusDeckContents({boardName: BoardName.VASTITAS_BOREALIS} as never);
    expect(deck).contains(BF1);
    for (const other of [
      BonusCardId.B08_CORPORATE_COMPETITION,
      BonusCardId.B09_CORPORATE_COMPETITION_HELLAS,
      BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM,
      BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA,
      BonusCardId.B12_CORPORATE_COMPETITION_CIMMERIA,
      BonusCardId.B13_CORPORATE_COMPETITION_BOREALIS,
    ]) {
      expect(deck, other).does.not.contain(other);
    }
    // …and BF1 reaches no other board's deck.
    expect(AutomaSetup.bonusDeckContents({boardName: BoardName.VASTITAS_BOREALIS_NOVA} as never)).does.not.contain(BF1);
    expect(AutomaSetup.bonusDeckContents({boardName: BoardName.THARSIS} as never)).does.not.contain(BF1);
  });

  it('prints one North Pole and NO Viking site', () => {
    const [game] = fanGame();
    expect(game.board.spaces.filter(isVastitasNorthPole)).has.length(1);
    expect(game.board.spaces.filter(isVikingSite)).is.empty;
  });

  it('the map\'s own milestone / award rows are in play, at the human thresholds the map prints', () => {
    const [game] = fanGame();
    expect(game.milestones.map((m) => m.name)).deep.eq(['V. Electrician', 'Smith', 'Tradesman', 'Irrigator', 'Capitalist']);
    expect(game.awards.map((a) => a.name)).deep.eq(['Forecaster', 'Edgedancer', 'Visionary', 'Naturalist', 'Voyager']);
    expect(['V. Electrician', 'Smith', 'Tradesman', 'Irrigator', 'Capitalist'].map((n) => milestoneThreshold(milestone(game, n), game)))
      .deep.eq([4, 6, 3, 4, 64]);
  });
});

describe('VASTITAS BOREALIS (fan map) + MarsBot — tag → track resolution', () => {
  function resolveTag(game: IGame, tag: Tag): void {
    AutomaResolver.advanceTrack(game, game.automa!.board.getTrackIndexForTag(tag)!);
  }

  it('a Jovian tag advances the Jovian/SCIENCE track — not Power, not Earth', () => {
    const [game] = fanGame();
    resolveTag(game, Tag.JOVIAN);
    expect(position(game, 'science')).is.at.least(1);
    expect(position(game, 'power')).eq(0);
    expect(position(game, 'earth')).eq(0);
  });

  it('a Power tag advances the standalone POWER track', () => {
    const [game] = fanGame();
    resolveTag(game, Tag.POWER);
    expect(position(game, 'power')).is.at.least(1);
    expect(position(game, 'science')).eq(0);
  });

  it('a City tag advances the City/EARTH track', () => {
    const [game] = fanGame();
    resolveTag(game, Tag.CITY);
    expect(position(game, 'earth')).is.at.least(1);
    expect(position(game, 'power')).eq(0);
  });

  it('a Microbe tag advances the bio row', () => {
    const [game] = fanGame();
    resolveTag(game, Tag.MICROBE);
    expect(position(game, 'bio')).is.at.least(1);
    expect(position(game, 'science')).eq(0);
  });

  it('the building row\'s ENERGY icon (space 4) pushes the power track', () => {
    const [game] = fanGame();
    setPosition(game, 'building', 3);
    setPosition(game, 'power', 1); // lands on 2, which is empty
    AutomaResolver.advanceTrack(game, VASTITAS_FAN_TRACK.BUILDING);
    expect(position(game, 'building')).eq(4);
    expect(position(game, 'power'), 'the cross-track icon advanced power').eq(2);
  });

  it('with Venus Next, the SHARED Venus row\'s cell-9 microbe advances the bio row', () => {
    const [game] = fanGame({venusNextExtension: true});
    const venus = game.automa!.board.trackIndexOfRoleOrThrow('venus');
    expect(venus).eq(VENUS_TRACK_INDEX);
    expect(game.automa!.board.tracks[venus].definition.layout[9]).eq(`tag_${VENUS_CELL9_TARGET_TRACK}`);
    game.automa!.board.tracks[venus].position = 8;
    setPosition(game, 'bio', 0); // lands on 1, which is empty
    AutomaResolver.advanceTrack(game, venus);
    expect(game.automa!.board.tracks[venus].position).eq(9);
    expect(position(game, 'bio')).eq(1);
    expect(position(game, 'science'), 'science did not move — the microbe lives on bio here').eq(0);
  });

  it('with Colonies the second trade fleet unlocks on POWER space 9 (a city cell here)', () => {
    const [game] = fanGame({coloniesExtension: true});
    setPosition(game, 'power', 8);
    AutomaResolver.advanceTrack(game, VASTITAS_FAN_TRACK.POWER);
    expect(position(game, 'power')).eq(9);
    expect(game.automa!.secondFleetUnlocked).is.true;
  });
});

describe('VASTITAS BOREALIS (fan map) + MarsBot — placement tiebreakers (Utopia\'s profile, for Irrigator + Edgedancer)', () => {
  it('OCEANS come first: a bare hex beside an ocean tile beats a 2-icon hex away from water', () => {
    const [game, , bot] = fanGame();
    const coast = land(game, (s) => s.bonus.length === 0 && !game.board.isEdge(s) &&
      game.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined));
    const ocean = game.board.getAdjacentSpaces(coast).find((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined)!;
    game.simpleAddTile(bot, ocean, {tileType: TileType.OCEAN});
    const rich = land(game, (s) => s.bonus.length === 2 && !game.board.isEdge(s) &&
      !game.board.getAdjacentSpaces(s).some(Board.isOceanSpace));
    expect(AutomaTilePlacer.breakTie(game, [rich, coast])).eq(coast);
  });

  it('then the REWARD ICONS, with an EDGE hex counting one extra (Utopia\'s bullet, for Edgedancer)', () => {
    const [game] = fanGame();
    const inland = land(game, (s) => s.bonus.length === 0 && !game.board.isEdge(s));
    const edge = land(game, (s) => s.bonus.length === 0 && game.board.isEdge(s));
    expect(AutomaTilePlacer.breakTie(game, [inland, edge]), 'bare vs bare: the edge wins').eq(edge);
    const rich = land(game, (s) => s.bonus.length === 2 && !game.board.isEdge(s));
    expect(AutomaTilePlacer.breakTie(game, [edge, rich]), '0+1 on the edge still loses to 2 inland').eq(rich);
  });

  it('…and the edge icon is for the tiebreak only — the payout stays the printed icons', () => {
    const [game, , bot] = fanGame();
    const edge = land(game, (s) => s.bonus.length === 1 && game.board.isEdge(s));
    expect(botRewardIcons(game, bot, edge), 'the printed icon').eq(1);
    expect(marsBotMapProfile(BoardName.VASTITAS_BOREALIS).tiebreakRewardBonus!(game, edge)).eq(1);
    expect(botCoveredIconMegacredits(game, edge)).eq(1);
  });

  it('a volcano earns NOTHING here — that bullet is Vastitas Borealis Nova\'s (its Geologist); this row has none', () => {
    const [game] = fanGame();
    const volcanic = game.board.spaces.find((s) => s.volcanic === true && !game.board.isEdge(s));
    expect(volcanic, 'an inland volcano').is.not.undefined;
    expect(marsBotMapProfile(BoardName.VASTITAS_BOREALIS).tiebreakRewardBonus!(game, volcanic!)).eq(0);
  });
});

describe('VASTITAS BOREALIS (fan map) + MarsBot — the North Pole (the same printed hex as Nova\'s)', () => {
  it('USABLE: it outranks an ordinary 2-icon hex but loses to a 3-icon one', () => {
    const [game, , bot] = fanGame();
    bot.megaCredits = 10;
    expect(botRewardIcons(game, bot, northPole(game))).is.above(2).and.below(3);
  });

  it('UNUSABLE below 4 M€, or with the temperature maxed: a hex without rewards', () => {
    const [game, , bot] = fanGame();
    bot.megaCredits = 3;
    expect(botRewardIcons(game, bot, northPole(game))).eq(0);
    bot.megaCredits = 10;
    setTemperature(game, 8);
    expect(botRewardIcons(game, bot, northPole(game))).eq(0);
  });

  it('placing on a USABLE pole raises the temperature 1 step and charges 4 M€ — never icon M€', () => {
    const [game, , bot] = fanGame();
    bot.megaCredits = 10;
    const temperature = game.getTemperature();
    const pole = northPole(game);
    AutomaTilePlacer.placeGreenery(game, {restrict: (s) => s === pole});
    expect(pole.tile).is.not.undefined;
    expect(game.getTemperature()).eq(temperature + 2);
    expect(bot.megaCredits).eq(6);
  });

  it('placing on an UNUSABLE pole gains and loses NOTHING', () => {
    const [game, , bot] = fanGame();
    bot.megaCredits = 3;
    const temperature = game.getTemperature();
    const pole = northPole(game);
    AutomaTilePlacer.placeGreenery(game, {restrict: (s) => s === pole});
    expect(pole.tile).is.not.undefined;
    expect(game.getTemperature()).eq(temperature);
    expect(bot.megaCredits).eq(3);
  });

  it('an unaffordable pole stays a LEGAL placement on THIS board too — the rebate reads the board, not a board name', () => {
    const [game, , bot] = fanGame();
    bot.megaCredits = 0;
    expect(needsNorthPoleRebate(game, bot)).is.true;
    const pole = northPole(game);
    expect(game.board.getAvailableSpacesForGreenery(bot).includes(pole), 'the human path drops it').is.false;
    AutomaTilePlacer.placeGreenery(game, {restrict: (s) => s === pole});
    expect(pole.tile, 'the bot may still land there, for nothing').is.not.undefined;
    // …and a board without a pole never asks for the rebate.
    const [tharsis, , tharsisBot] = testAutomaGame({boardName: BoardName.THARSIS}, '-no-pole');
    tharsisBot.megaCredits = 0;
    expect(needsNorthPoleRebate(tharsis, tharsisBot)).is.false;
  });
});

describe('VASTITAS BOREALIS (fan map) + MarsBot — milestones (§17.2)', () => {
  it('V. Electrician (HOME RULE): the standalone Power track at 4 — and it reads 1:1 on the player\'s 4-tag scale', () => {
    const [game] = fanGame();
    setPosition(game, 'power', 3);
    expect(met(game, 'V. Electrician')).is.false;
    expect(shown(game, 'V. Electrician')).eq(3);
    setPosition(game, 'power', 4);
    expect(met(game, 'V. Electrician')).is.true;
    expect(shown(game, 'V. Electrician')).eq(4);
  });

  it('Smith (Utopia\'s official Metallurgist rule): Building + Space combined at 7', () => {
    const [game] = fanGame();
    setPosition(game, 'building', 3);
    setPosition(game, 'space', 3);
    expect(met(game, 'Smith')).is.false;
    setPosition(game, 'building', 4);
    expect(met(game, 'Smith')).is.true;
  });

  it('Tradesman (Utopia\'s official Trader rule, by ROLE): power, earth and Venus all at 2 — unreachable without Venus Next', () => {
    const [game] = fanGame();
    setPosition(game, 'power', 2);
    setPosition(game, 'earth', 2);
    expect(met(game, 'Tradesman'), 'no Venus track in play').is.false;
    const [venus] = fanGame({venusNextExtension: true}, '-tradesman-venus');
    setPosition(venus, 'power', 2);
    setPosition(venus, 'earth', 2);
    setPosition(venus, 'venus', 1);
    expect(met(venus, 'Tradesman')).is.false;
    setPosition(venus, 'venus', 2);
    expect(met(venus, 'Tradesman')).is.true;
  });

  it('Irrigator: UNCHANGED — the bot\'s real tiles beside real ocean tiles, at the map\'s threshold (4)', () => {
    const [game, , bot] = fanGame();
    // Three oceans down, then the bot's greeneries on land beside them.
    for (const reserve of game.board.spaces.filter((s) => s.spaceType === SpaceType.OCEAN && s.tile === undefined).slice(0, 3)) {
      game.simpleAddTile(bot, reserve, {tileType: TileType.OCEAN});
    }
    const shore = game.board.spaces.filter((s) => s.spaceType === SpaceType.LAND && s.tile === undefined &&
      game.board.getAdjacentSpaces(s).some(Board.isOceanSpace));
    expect(shore.length).is.at.least(4);
    for (const space of shore.slice(0, 3)) {
      game.simpleAddTile(bot, space, {tileType: TileType.GREENERY});
    }
    expect(met(game, 'Irrigator')).is.false;
    expect(shown(game, 'Irrigator'), 'the player metric, unscaled').eq(3);
    game.simpleAddTile(bot, shore[3], {tileType: TileType.GREENERY});
    expect(met(game, 'Irrigator')).is.true;
  });

  it('Capitalist: UNCHANGED — the bot really holds the 64 M€', () => {
    const [game, , bot] = fanGame();
    bot.megaCredits = 63;
    expect(met(game, 'Capitalist')).is.false;
    expect(shown(game, 'Capitalist')).eq(63);
    bot.megaCredits = 64;
    expect(met(game, 'Capitalist')).is.true;
  });
});

describe('VASTITAS BOREALIS (fan map) + MarsBot — awards (§17.3)', () => {
  it('Forecaster (Terra Cimmeria\'s official rule): every 7 M€ counts as one card — floor', () => {
    const [game, , bot] = fanGame();
    const at = (mc: number) => {
      bot.megaCredits = mc;
      return score(game, 'Forecaster');
    };
    expect(at(6)).eq(0);
    expect(at(7)).eq(1);
    expect(at(13)).eq(1);
    expect(at(14)).eq(2);
  });

  it('Edgedancer (Utopia\'s official Suburban): UNCHANGED — the bot\'s real tiles on the edge', () => {
    const [game, , bot] = fanGame();
    const edge = land(game, (s) => game.board.isEdge(s));
    game.simpleAddTile(bot, edge, {tileType: TileType.GREENERY});
    expect(score(game, 'Edgedancer')).eq(1);
    expect(new AwardScorer(game, award(game, 'Edgedancer')).get(bot), 'the endgame scorer reads the same number').eq(1);
  });

  it('Visionary (OFFICIAL, Adding Expansions p.15): the lowest track space doubled', () => {
    const [game] = fanGame();
    setAll(game, 7);
    setPosition(game, 'event', 3);
    expect(score(game, 'Visionary')).eq(6);
  });

  it('Visionary with Venus Next: the SECOND lowest doubled — one track may be left behind', () => {
    const [game] = fanGame({venusNextExtension: true});
    setAll(game, 7);
    setPosition(game, 'venus', 0);
    expect(score(game, 'Visionary'), 'Venus at 0 is the one skipped').eq(14);
    setPosition(game, 'bio', 4);
    expect(score(game, 'Visionary'), 'bio is now the second lowest').eq(8);
  });

  it('Naturalist (HOME RULE, Manufacturer\'s shape): the plant track PLUS the heat-badged track', () => {
    const [game] = fanGame();
    setPosition(game, 'bio', 4);
    setPosition(game, 'earth', 3);
    expect(score(game, 'Naturalist')).eq(7);
    expect(game.automa!.board.getTrackIndexForProduction(game.automa!.board.getTrackOfRole('earth')!.definition.productions[0]),
      'the earth row is the one the HEAT badge regresses').eq(VASTITAS_FAN_TRACK.EARTH);
  });

  it('Voyager (HOME RULE, Rim Settler\'s 2:1): HALF the Jovian/Science track, floored', () => {
    const [game] = fanGame();
    setPosition(game, 'science', 7);
    expect(score(game, 'Voyager')).eq(3);
    setPosition(game, 'science', 8);
    expect(score(game, 'Voyager')).eq(4);
    setPosition(game, 'power', 18);
    expect(score(game, 'Voyager'), 'the power track is not the Jovian track here').eq(4);
  });

  it('Venuphile: the Venus track (every map)', () => {
    const [game] = fanGame({venusNextExtension: true});
    setPosition(game, 'venus', 5);
    expect(score(game, 'Venuphile')).eq(5);
  });
});

describe('VASTITAS BOREALIS (fan map) + MarsBot — BF1 Corporate Competition (§17.6)', () => {
  it('Forecaster reveals until a card WITH REQUIREMENTS, resolves it, GAINS 5 M€ and pays nothing', () => {
    const [game, human, bot] = fanGame();
    fund(game, human, 'Forecaster');
    bot.megaCredits = 6;
    game.projectDeck.drawPile.push(new ArtificialLake()); // a temperature requirement — found second
    game.projectDeck.drawPile.push(new Mine()); // no requirement — rejected first
    resolve(game, BF1);
    expect(game.automa!.playedPile).contains(CardName.ARTIFICIAL_LAKE);
    expect(game.projectDeck.discardPile.map((c) => c.name)).contains(CardName.MINE);
    expect(bot.megaCredits, '6 + 5, with no −5 anywhere').eq(11);
  });

  it('Edgedancer places a greenery ON THE EDGE and raises oxygen', () => {
    const [game, human, bot] = fanGame();
    fund(game, human, 'Edgedancer');
    bot.megaCredits = 6;
    const oxygen = game.getOxygenLevel();
    resolve(game, BF1);
    const greeneries = botGreeneries(game, bot);
    expect(greeneries).has.length(1);
    expect(game.board.isEdge(greeneries[0])).is.true;
    expect(game.getOxygenLevel()).eq(oxygen + 1);
    expect(bot.megaCredits, '6 − 5, plus 1 M€ per printed icon the greenery covered').eq(1 + greeneries[0].bonus.length);
  });

  it('Edgedancer with no legal EDGE space is impossible — nothing placed, nothing paid', () => {
    const [game, human, bot] = fanGame();
    fund(game, human, 'Edgedancer');
    bot.megaCredits = 6;
    for (const space of game.board.getEdges()) {
      if (space.spaceType === SpaceType.LAND && space.tile === undefined) {
        game.simpleAddTile(human, space, {tileType: TileType.CITY});
      }
    }
    game.automa!.bonusDeck = [];
    game.automa!.bonusDiscard = [];
    resolve(game, BF1);
    expect(botGreeneries(game, bot)).is.empty;
    expect(bot.megaCredits).eq(6);
  });

  it('Visionary advances the LEAST-advanced track, and costs the 5 M€', () => {
    const [game, human, bot] = fanGame();
    fund(game, human, 'Visionary');
    setAll(game, 5);
    setPosition(game, 'event', 1); // lands on 2, which is empty
    bot.megaCredits = 6;
    resolve(game, BF1);
    expect(position(game, 'event')).eq(2);
    expect(game.automa!.board.tracks.filter((t) => t.position === 5), 'the other six did not move').has.length(6);
    expect(bot.megaCredits).eq(1);
  });

  it('Visionary: the TOPMOST of the tied least-advanced tracks moves', () => {
    const [game, human, bot] = fanGame();
    fund(game, human, 'Visionary');
    setAll(game, 5);
    setPosition(game, 'building', 0); // lands on 1, which is empty
    setPosition(game, 'bio', 0);
    bot.megaCredits = 6;
    resolve(game, BF1);
    expect(position(game, 'building')).eq(1);
    expect(position(game, 'bio')).eq(0);
  });

  it('Naturalist advances the LAGGING one of earth / bio; a tie goes to earth (the topmost)', () => {
    const [game, human, bot] = fanGame();
    fund(game, human, 'Naturalist');
    setPosition(game, 'earth', 5);
    setPosition(game, 'bio', 1); // lands on 2, which is empty
    bot.megaCredits = 6;
    resolve(game, BF1);
    expect(position(game, 'bio')).eq(2);
    expect(position(game, 'earth')).eq(5);
    expect(bot.megaCredits).eq(1);

    const [tied, tiedHuman, tiedBot] = fanGame({}, '-naturalist-tie');
    fund(tied, tiedHuman, 'Naturalist');
    setPosition(tied, 'earth', 2); // lands on 3, which is empty
    setPosition(tied, 'bio', 2);
    tiedBot.megaCredits = 6;
    resolve(tied, BF1);
    expect(position(tied, 'earth')).eq(3);
    expect(position(tied, 'bio')).eq(2);
  });

  it('Voyager advances the JOVIAN track — the Jovian/Science row here', () => {
    const [game, human, bot] = fanGame();
    fund(game, human, 'Voyager');
    setPosition(game, 'science', 6); // lands on 7, which is empty
    bot.megaCredits = 6;
    resolve(game, BF1);
    expect(position(game, 'science')).eq(7);
    expect(position(game, 'power'), 'never the power track').eq(0);
    expect(bot.megaCredits).eq(1);
  });

  it('Voyager with the Jovian track MAXED is impossible — the card draws another bonus card instead, paying nothing', () => {
    const [game, human, bot] = fanGame();
    fund(game, human, 'Voyager');
    setPosition(game, 'science', 18);
    bot.megaCredits = 6;
    game.automa!.bonusDeck = [];
    game.automa!.bonusDiscard = [];
    resolve(game, BF1);
    expect(position(game, 'science')).eq(18);
    expect(bot.megaCredits).eq(6);
  });

  it('Venuphile advances the Venus track (added to every version of the card)', () => {
    const [game, human, bot] = fanGame({venusNextExtension: true});
    fund(game, human, 'Venuphile');
    bot.megaCredits = 6;
    resolve(game, BF1);
    expect(position(game, 'venus')).is.at.least(1);
    expect(bot.megaCredits).eq(1);
  });
});

describe('VASTITAS BOREALIS (fan map) + MarsBot — a real game runs', () => {
  it('resolves 30 track advances with Venus + Colonies + Redux without a dead end', () => {
    const [game] = fanRedux({
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

  it('the bot\'s pole landing works inside the real placement pipeline too — the greenery strategy, the pole restricted', () => {
    const [game, , bot] = fanGame();
    bot.megaCredits = 10;
    const pole = northPole(game);
    const temperature = game.getTemperature();
    expect(AutomaTilePlacer.placeGreenery(game, {restrict: (s) => s === pole})).is.true;
    expect(game.getTemperature()).eq(temperature + 2);
  });
});

describe('VASTITAS BOREALIS (fan map) + MarsBot — what the client receives, and what a save keeps', () => {
  it('the server model carries the FAN cells and tag pairings', () => {
    const [game] = fanGame({venusNextExtension: true});
    const model = Server.getGameModel(game).automa!;
    expect(model.tracks).has.length(8);
    expect(model.tracks[VASTITAS_FAN_TRACK.SCIENCE].tags).deep.eq([Tag.JOVIAN, Tag.SCIENCE]);
    expect(model.tracks[VASTITAS_FAN_TRACK.POWER].tags).deep.eq([Tag.POWER]);
    expect(model.tracks[VASTITAS_FAN_TRACK.EARTH].tags).deep.eq([Tag.CITY, Tag.EARTH]);
    expect(model.tracks[VASTITAS_FAN_TRACK.BIO].tags).deep.eq([Tag.MICROBE, Tag.ANIMAL, Tag.PLANT]);
    expect(model.tracks[VASTITAS_FAN_TRACK.BUILDING].layout[4], 'the energy icon reaches the client').eq(`tag_${VASTITAS_FAN_TRACK.POWER}`);
    expect(model.tracks[VASTITAS_FAN_TRACK.EARTH].layout[4]).eq('temperature');
    expect(model.tracks[VENUS_TRACK_INDEX].layout[9]).eq(`tag_${VENUS_CELL9_TARGET_TRACK}`);
  });

  it('round-trips through the map profile: only the map NAME is stored', () => {
    const [game] = fanGame({venusNextExtension: true});
    setPosition(game, 'science', 7);
    const restored = AutomaState.deserialize(game.automa!.serialize(), game.gameOptions);
    expect(restored.board.getTrackOfRole('science')!.position).eq(7);
    expect(restored.board.getTrackIndexForTag(Tag.JOVIAN)).eq(restored.board.trackIndexOfRoleOrThrow('science'));
    expect(restored.board.getTrackIndexForTag(Tag.POWER)).eq(restored.board.trackIndexOfRoleOrThrow('power'));
    expect(restored.board.tracks[VASTITAS_FAN_TRACK.BUILDING].definition.layout[4]).eq(`tag_${VASTITAS_FAN_TRACK.POWER}`);
  });
});
