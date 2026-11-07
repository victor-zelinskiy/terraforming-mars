import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {BonusCardId, MARSBOT_EXTENDED_TRACK_POSITION, MarsBotTrackRole} from '../../src/common/automa/AutomaTypes';
import {botPaceOffset} from '../../src/common/automa/botPace';
import {CardName} from '../../src/common/cards/CardName';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {Tag} from '../../src/common/cards/Tag';
import {TileType} from '../../src/common/TileType';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Mine} from '../../src/server/cards/base/Mine';
import {AutomaMAEvaluation} from '../../src/server/automa/AutomaMAEvaluation';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {AutomaScoring} from '../../src/server/automa/AutomaScoring';
import {AutomaSetup} from '../../src/server/automa/AutomaSetup';
import {AutomaState} from '../../src/server/automa/AutomaState';
import {AutomaTilePlacer} from '../../src/server/automa/AutomaTilePlacer';
import {botCoveredIconMegacredits, botRewardIcons} from '../../src/server/automa/AutomaPlacementBonus';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {AMAZONIS_PLANITIA_TAILS, AMAZONIS_PLANITIA_TRACK, AMAZONIS_PLANITIA_VENUS_END} from '../../src/server/automa/boards/AmazonisPlanitiaMarsBot';
import {marsBotMapProfile} from '../../src/server/automa/boards/MarsBotMapProfile';
import {generateBotMat} from '../../src/server/automa/ma/matGenerator';
import {isExtendedTrack, matTail, matViolations} from '../../src/server/automa/ma/matLaw';
import {Server} from '../../src/server/models/ServerModel';
import {setTemperature} from '../TestingUtils';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';
import {testAutomaRandomSetGame} from './ma/matTestGame';

/**
 * AMAZONIS PLANITIA (`BoardName.AMAZONIS_PLANITIA`, the official eleven-row map) + MarsBot — phase 2 of the map's
 * premium adaptation (docs/claude/amazonis-planitia-marsbot.md; docs/AUTOMA_DATA_AUDIT.md §2k / §24; the owner's
 * direction of 2026-11-07). The first EXTENDED bot board: 25-cell tracks (the Tharsis body + the map's late reserve),
 * a 16-cell Venus row, the bot's clock three generations later (the M€ → VP ladder, the instant win), the map's own
 * milestone / award rules (Merchant3 · Innovator · Physicist are HOME, the rest RB-C's), BF5 Corporate Competition,
 * the map's cells for the bot (a delegate per printed icon, the standard-resource cell an ordinary icon), and the
 * random-set generator on the extended base.
 */
const AMAZONIS = {boardName: BoardName.AMAZONIS_PLANITIA} as const;
const BF5 = BonusCardId.BF5_CORPORATE_COMPETITION_AMAZONIS_PLANITIA;
const T = AMAZONIS_PLANITIA_TRACK;

/** The map's special cells by id (`AmazonisPlanitiaBoard.ts`): B2 / H7 (Olympus Mons, two delegates) / H9 print delegates; E3 / E9 / K3 a standard resource. */
const CELL = {B2: '10', H7: '70', H9: '72', E3: '35', E9: '41', K3: '83'} as const;

function amazonisGame(options?: object, suffix = ''): ReturnType<typeof testAutomaGame> {
  return testAutomaGame({...AMAZONIS, ...options}, suffix);
}

function amazonisRedux(options?: object, suffix = ''): ReturnType<typeof testAutomaGame> {
  // Turmoil Redux requires Colonies.
  const result = amazonisGame({coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'politics', ...options}, suffix);
  const game = result[0];
  game.automa!.lobbyMandate = {generation: game.generation, card: 0, sent: 0};
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

function botTiles(game: IGame, bot: IPlayer, type: TileType): number {
  return game.board.spaces.filter((s) => s.player === bot && s.tile?.tileType === type).length;
}

function botColonies(game: IGame, bot: IPlayer): number {
  return game.colonies.filter((c) => c.colonies.includes(bot.id)).length;
}

function playGenerationToEnd(game: IGame, human: TestPlayer) {
  game.playerIsFinishedWithResearchPhase(human);
  game.automa!.actionDeck = [];
  human.popWaitingFor();
  game.playerHasPassed(human);
  game.playerIsFinishedTakingActions();
}

describe('AMAZONIS PLANITIA + MarsBot — setup', () => {
  it('is playable on the official map with the extended board: seven 25-cell rows, the map\'s own set', () => {
    const [game] = amazonisGame();
    expect(game.gameOptions.boardName).eq(BoardName.AMAZONIS_PLANITIA);
    expect(game.automa).is.not.undefined;
    const tracks = game.automa!.board.tracks;
    expect(tracks.map((t) => t.definition.layout)).deep.eq(marsBotMapProfile(BoardName.AMAZONIS_PLANITIA).tracks.map((t) => t.layout));
    expect(tracks).has.length(7);
    for (const track of tracks) {
      expect(track.maxPosition, track.definition.role).eq(MARSBOT_EXTENDED_TRACK_POSITION);
      expect(track.position, track.definition.role).eq(0);
    }
    expect(game.milestones.map((m) => m.name), 'without the Redux Parliament the fixed replacement stands for Activist')
      .deep.eq(['Terran5', 'Landshaper', 'Merchant3', 'Sponsor', 'Terraformer29']);
    expect(game.awards.map((a) => a.name)).deep.eq(['Collector', 'Innovator', 'Constructor', 'Manufacturer', 'Physicist']);
  });

  it('with the Redux Parliament the printed Lobbyist plays as Activist; with Venus the Venus row is the map\'s 16-cell one', () => {
    const [game] = amazonisRedux({venusNextExtension: true});
    expect(game.milestones.map((m) => m.name), 'Hoverlord — the Venus Next milestone, as on every map').deep.eq(['Terran5', 'Landshaper', 'Merchant3', 'Sponsor', 'Activist', 'Hoverlord']);
    expect(game.awards.map((a) => a.name)).deep.eq(['Collector', 'Innovator', 'Constructor', 'Manufacturer', 'Physicist', 'Venuphile']);
    const venus = game.automa!.board.getTrackOfRole('venus')!;
    expect(venus.definition.layout).has.length(AMAZONIS_PLANITIA_VENUS_END + 1);
    expect(venus.maxPosition).eq(AMAZONIS_PLANITIA_VENUS_END);
    expect(game.automa!.board.tracks).has.length(8);
  });

  it('builds the bonus deck with BF5, and no other map\'s card — and no other map gets BF5', () => {
    const deck = AutomaSetup.bonusDeckContents({boardName: BoardName.AMAZONIS_PLANITIA} as never);
    expect(deck).contains(BF5);
    for (const other of [
      BonusCardId.B08_CORPORATE_COMPETITION, BonusCardId.B09_CORPORATE_COMPETITION_HELLAS, BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM,
      BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA, BonusCardId.B12_CORPORATE_COMPETITION_CIMMERIA, BonusCardId.B13_CORPORATE_COMPETITION_BOREALIS,
      BonusCardId.BF1_CORPORATE_COMPETITION_VASTITAS_FAN, BonusCardId.BF2_CORPORATE_COMPETITION_AMAZONIS,
      BonusCardId.BF3_CORPORATE_COMPETITION_TERRA_CIMMERIA_FAN, BonusCardId.BF4_CORPORATE_COMPETITION_ARABIA_TERRA,
    ]) {
      expect(deck, other).does.not.contain(other);
    }
    expect(AutomaSetup.bonusDeckContents({boardName: BoardName.THARSIS} as never)).does.not.contain(BF5);
    expect(AutomaSetup.bonusDeckContents({boardName: BoardName.AMAZONIS} as never), 'the FAN Amazonis keeps BF2').does.not.contain(BF5);
  });

  it('tags ride the Tharsis topology: Jovian on Power, City on Earth, Microbe on bio, Science alone', () => {
    const [game] = amazonisGame();
    const board = game.automa!.board;
    expect(board.getTrackIndexForTag(Tag.JOVIAN)).eq(T.POWER);
    expect(board.getTrackIndexForTag(Tag.CITY)).eq(T.EARTH);
    expect(board.getTrackIndexForTag(Tag.MICROBE)).eq(T.BIO);
    expect(board.getTrackIndexForTag(Tag.SCIENCE)).eq(T.SCIENCE);
    expect(board.getTrackIndexForTag(Tag.SPACE)).eq(T.SPACE);
  });
});

describe('AMAZONIS PLANITIA + MarsBot — the late reserve (cells 19–24)', () => {
  it('a track that crosses its old end is PUSHED into the reserve: building 18 → the «advance» at 19 → the city at 20', () => {
    const [game, , bot] = amazonisGame();
    setPosition(game, 'building', 18);
    const cities = botTiles(game, bot, TileType.CITY);
    AutomaResolver.advanceTrack(game, T.BUILDING);
    expect(position(game, 'building')).eq(20);
    expect(botTiles(game, bot, TileType.CITY)).eq(cities + 1);
  });

  it('on EASY the «advance» is ignored (rulebook p.11) — the track stops on 19', () => {
    const [game, , bot] = amazonisGame({difficulty: 'easy'});
    setPosition(game, 'building', 18);
    AutomaResolver.advanceTrack(game, T.BUILDING);
    expect(position(game, 'building')).eq(19);
    expect(botTiles(game, bot, TileType.CITY)).eq(0);
  });

  it('the double temperature step (space 20) raises the temperature twice', () => {
    const [game] = amazonisGame();
    setTemperature(game, -30);
    setPosition(game, 'space', 19);
    AutomaResolver.advanceTrack(game, T.SPACE);
    expect(position(game, 'space')).eq(20);
    expect(game.getTemperature()).eq(-26);
  });

  it('a reserve temperature step past the STANDARD maximum still raises — the map\'s scale runs to +14 °C', () => {
    const [game] = amazonisGame();
    setTemperature(game, 8);
    setPosition(game, 'earth', 19);
    const failed = game.automa!.failedActions;
    AutomaResolver.advanceTrack(game, T.EARTH);
    expect(position(game, 'earth')).eq(20);
    expect(game.getTemperature()).eq(10);
    expect(game.automa!.failedActions).eq(failed);
  });

  it('the end cell pays its TR (science 24: +8); a tag on the finished track is then a Failed Action', () => {
    const [game, , bot] = amazonisGame();
    setPosition(game, 'science', 23);
    const tr = bot.terraformRating;
    AutomaResolver.advanceTrack(game, T.SCIENCE);
    expect(position(game, 'science')).eq(24);
    expect(bot.terraformRating).eq(tr + 8);
    const failed = game.automa!.failedActions;
    const megaCredits = bot.megaCredits;
    AutomaResolver.advanceTrack(game, T.SCIENCE);
    expect(position(game, 'science')).eq(24);
    expect(game.automa!.failedActions).eq(failed + 1);
    expect(bot.megaCredits).eq(megaCredits + 5);
  });

  it('the resolver reads the WHOLE row: every reserve cell of every row resolves without a dead end', () => {
    const [game] = amazonisGame({venusNextExtension: true, coloniesExtension: true});
    for (let track = 0; track < 7; track++) {
      for (let cell = 19; cell <= 24; cell++) {
        setPosition(game, game.automa!.board.tracks[track].definition.role, cell - 1);
        expect(() => AutomaResolver.advanceTrack(game, track), `${game.automa!.board.tracks[track].definition.role} ${cell}`).does.not.throw();
        expect(position(game, game.automa!.board.tracks[track].definition.role)).is.at.least(cell);
      }
    }
  });
});

describe('AMAZONIS PLANITIA + MarsBot — the Venus row for a Venus that runs to 33 %', () => {
  it('the re-cut end: a Venus step at 12, an «advance» at 13, a double step at 14, +5 TR at 15', () => {
    const [game, , bot] = amazonisGame({venusNextExtension: true});
    const venusIndex = game.automa!.board.trackIndexOfRoleOrThrow('venus');
    setPosition(game, 'venus', 11);
    const venusBefore = game.getVenusScaleLevel();
    AutomaResolver.advanceTrack(game, venusIndex);
    expect(position(game, 'venus')).eq(12);
    expect(game.getVenusScaleLevel()).eq(venusBefore + 2);
    // 13 is an «advance»: onto 14's double step.
    setPosition(game, 'venus', 12);
    const beforeDouble = game.getVenusScaleLevel();
    AutomaResolver.advanceTrack(game, venusIndex);
    expect(position(game, 'venus')).eq(14);
    expect(game.getVenusScaleLevel()).eq(beforeDouble + 4);
    const tr = bot.terraformRating;
    AutomaResolver.advanceTrack(game, venusIndex);
    expect(position(game, 'venus')).eq(15);
    expect(bot.terraformRating).eq(tr + 5);
    expect(game.automa!.board.tracks[venusIndex].canAdvance(), 'the end').is.false;
  });

  it('the printed row\'s first twelve cells are untouched — the cell-9 microbe icon still points at the bio row', () => {
    const [game] = amazonisGame({venusNextExtension: true});
    const venus = game.automa!.board.getTrackOfRole('venus')!;
    expect(venus.definition.layout[9]).eq(`tag_${T.BIO}`);
    setPosition(game, 'venus', 8);
    AutomaResolver.advanceTrack(game, game.automa!.board.trackIndexOfRoleOrThrow('venus'));
    expect(position(game, 'venus')).eq(9);
    expect(position(game, 'bio'), 'the bio row moved').eq(1);
  });
});

describe('AMAZONIS PLANITIA + MarsBot — Constructor\'s colony cubes (space 4 · space 10 · power 8)', () => {
  it('with Colonies: the cell builds a colony and costs 5 M€ — the colony first, then the price', () => {
    const [game, , bot] = amazonisGame({coloniesExtension: true});
    setPosition(game, 'space', 3);
    bot.megaCredits = 9;
    const before = botColonies(game, bot);
    AutomaResolver.advanceTrack(game, T.SPACE);
    expect(position(game, 'space')).eq(4);
    expect(botColonies(game, bot)).eq(before + 1);
    expect(bot.megaCredits).eq(4);
    setPosition(game, 'power', 7);
    AutomaResolver.advanceTrack(game, T.POWER);
    expect(position(game, 'power')).eq(8);
    expect(botColonies(game, bot)).eq(before + 2);
  });

  it('WITHOUT Colonies the icon is ignored — no payment, no Failed Action', () => {
    const [game, , bot] = amazonisGame();
    setPosition(game, 'space', 9);
    bot.megaCredits = 9;
    const failed = game.automa!.failedActions;
    AutomaResolver.advanceTrack(game, T.SPACE);
    expect(position(game, 'space')).eq(10);
    expect(bot.megaCredits).eq(9);
    expect(game.automa!.failedActions).eq(failed);
  });
});

describe('AMAZONIS PLANITIA + MarsBot — the map\'s cells for the bot (§24.5)', () => {
  it('a «standard resource of your choice» cell is an ORDINARY icon: counted once, paid 1 M€, nobody asked', () => {
    const [game, human, bot] = amazonisGame();
    for (const id of [CELL.E3, CELL.E9, CELL.K3]) {
      const cell = game.board.getSpaceOrThrow(id);
      expect(cell.bonus, id).deep.eq([SpaceBonus.STANDARD_RESOURCE]);
      expect(botRewardIcons(game, bot, cell), id).eq(1);
      expect(botCoveredIconMegacredits(game, cell), id).eq(1);
    }
    const cell = game.board.getSpaceOrThrow(CELL.E3);
    bot.megaCredits = 0;
    const waiting = human.getWaitingFor();
    const stock = [bot.steel, bot.titanium, bot.plants, bot.energy, bot.heat];
    AutomaTilePlacer.placeCity(game, {restrict: (s) => s === cell, onEmpty: 'impossible'});
    expect(cell.tile?.tileType).eq(TileType.CITY);
    expect(bot.megaCredits).eq(1);
    expect([bot.steel, bot.titanium, bot.plants, bot.energy, bot.heat], 'no resource was chosen for it').deep.eq(stock);
    expect(human.getWaitingFor(), 'the human was not asked').eq(waiting);
    expect(game.deferredActions.length, 'nothing left to ask').eq(0);
  });

  it('WITHOUT the Redux Parliament a delegate cell is «considered empty»: 0 icons, 0 M€ — Olympus Mons included', () => {
    const [game, , bot] = amazonisGame();
    for (const [id, printed] of [[CELL.B2, 1], [CELL.H7, 2], [CELL.H9, 1]] as const) {
      const cell = game.board.getSpaceOrThrow(id);
      expect(cell.bonus.filter((b) => b === SpaceBonus.DELEGATE), id).has.length(printed);
      expect(botRewardIcons(game, bot, cell), id).eq(0);
      expect(botCoveredIconMegacredits(game, cell), id).eq(0);
    }
  });

  it('with the Redux Parliament: Olympus Mons counts TWO icons and lands TWO delegates from the reserve, free, on top of the mandate', () => {
    const [game, , bot] = amazonisRedux();
    const parliament = game.parliament!;
    const olympus = game.board.getSpaceOrThrow(CELL.H7);
    expect(botRewardIcons(game, bot, olympus)).eq(2);
    expect(botRewardIcons(game, bot, game.board.getSpaceOrThrow(CELL.B2))).eq(1);
    const reserve = parliament.reserve(bot);
    const votes = parliament.votesOf(bot);
    const megaCredits = bot.megaCredits;
    AutomaTilePlacer.placeGreenery(game, {restrict: (s) => s === olympus, onEmpty: 'impossible'});
    expect(olympus.tile?.tileType).eq(TileType.GREENERY);
    expect(parliament.votesOf(bot)).eq(votes + 2);
    expect(parliament.reserve(bot)).eq(reserve - 2);
    expect(bot.megaCredits, 'and no icon M€').eq(megaCredits);
    expect(game.automa!.lobbyMandate!.sent, 'the generation\'s mandate is untouched').eq(0);
  });

  it('…the second delegate is asked again once the first has left the reserve: one delegate left ⇒ one lands', () => {
    const [game, , bot] = amazonisRedux();
    const parliament = game.parliament!;
    const olympus = game.board.getSpaceOrThrow(CELL.H7);
    while (parliament.reserve(bot) > 1) {
      parliament.placeVote(bot, parliament.slots[0], 'reserve');
    }
    expect(botRewardIcons(game, bot, olympus), 'ranked by its printed icons while a delegate can land').eq(2);
    const votes = parliament.votesOf(bot);
    AutomaTilePlacer.placeGreenery(game, {restrict: (s) => s === olympus, onEmpty: 'impossible'});
    expect(parliament.votesOf(bot)).eq(votes + 1);
    expect(parliament.reserve(bot)).eq(0);
  });

  it('the five volcanoes are plain land for the bot — no Noctis reservation anywhere on the map', () => {
    const [game, , bot] = amazonisGame();
    const volcanoes = game.board.spaces.filter((s) => s.volcanic === true);
    expect(volcanoes.map((s) => s.id).sort()).has.length(5);
    expect(game.board.getAvailableSpacesForCity(bot)).to.include.members(volcanoes);
    expect(game.board.spaces.some((s) => (s.id as string) === 'noctis'), 'no reserved city cell').is.false;
  });
});

describe('AMAZONIS PLANITIA + MarsBot — milestones (§24.2)', () => {
  it('Terran (RB-C p.14, the 5-tag twin): the Earth / City track at 5', () => {
    const [game] = amazonisGame();
    setPosition(game, 'earth', 4);
    expect(met(game, 'Terran5')).is.false;
    setPosition(game, 'earth', 5);
    expect(met(game, 'Terran5')).is.true;
  });

  it('Landshaper (RB-C p.13): a city, a greenery AND the building track at 5 — all three', () => {
    const [game, , bot] = amazonisGame();
    setPosition(game, 'building', 5);
    expect(met(game, 'Landshaper'), 'no tiles yet').is.false;
    AutomaTilePlacer.placeCity(game);
    expect(met(game, 'Landshaper'), 'no greenery yet').is.false;
    AutomaTilePlacer.placeGreenery(game);
    expect(botTiles(game, bot, TileType.GREENERY)).eq(1);
    expect(met(game, 'Landshaper')).is.true;
    setPosition(game, 'building', 4);
    expect(met(game, 'Landshaper'), 'the track below 5').is.false;
  });

  it('Merchant (HOME RULE — RB-C p.13\'s Merchant read at 3): every Martian track at 3, the Venus row not counted', () => {
    const [game] = amazonisGame({venusNextExtension: true});
    for (const role of ['building', 'space', 'event', 'science', 'power', 'earth', 'bio'] as const) {
      setPosition(game, role, 3);
    }
    setPosition(game, 'venus', 0);
    expect(met(game, 'Merchant3')).is.true;
    setPosition(game, 'bio', 2);
    expect(met(game, 'Merchant3'), 'one track short').is.false;
    expect(AutomaMAEvaluation.botMilestoneScore(milestone(game, 'Merchant3'), game), 'shown as a flag: the least track against 3').is.lessThan(3);
  });

  it('Sponsor (RB-C p.14): three cards of 20 M€ or more in the played pile', () => {
    const [game] = amazonisGame();
    const pile = game.automa!.playedPile;
    pile.push(CardName.GANYMEDE_COLONY, CardName.SPACE_ELEVATOR, CardName.MINE);
    expect(met(game, 'Sponsor')).is.false;
    pile.push(CardName.IO_MINING_INDUSTRIES);
    expect(met(game, 'Sponsor')).is.true;
  });

  it('Terraformer (the Parliament-less replacement): the bot\'s real rating at 29', () => {
    const [game, , bot] = amazonisGame();
    bot.increaseTerraformRating(28 - bot.terraformRating);
    expect(met(game, 'Terraformer29')).is.false;
    bot.increaseTerraformRating(1);
    expect(met(game, 'Terraformer29')).is.true;
  });
});

describe('AMAZONIS PLANITIA + MarsBot — awards (§24.3)', () => {
  it('Collector (RB-C p.14): the tracks at 3 or more', () => {
    const [game] = amazonisGame();
    setPosition(game, 'building', 3);
    setPosition(game, 'space', 3);
    setPosition(game, 'event', 5);
    setPosition(game, 'bio', 2);
    expect(score(game, 'Collector')).eq(3);
  });

  it('Innovator (HOME RULE): two thirds of the played pile, events included — the bot\'s pile outruns a human\'s table', () => {
    const [game, , bot] = amazonisGame();
    const pile = game.automa!.playedPile;
    pile.push(CardName.MINE, CardName.ASTEROID, CardName.BUSHES, CardName.COMET, CardName.AQUIFER_PUMPING, CardName.GANYMEDE_COLONY);
    expect(score(game, 'Innovator'), '6 cards (two events) × 2 ÷ 3').eq(4);
    pile.push(CardName.LOBBYING_CAMPAIGN);
    expect(score(game, 'Innovator'), '7 → floor(4.67)').eq(4);
    pile.push(CardName.MINE, CardName.MINE);
    expect(score(game, 'Innovator'), '9 → 6').eq(6);
    expect(award(game, 'Innovator').getScore(bot), 'the player evaluator would read the empty tableau').eq(0);
  });

  it('Physicist (HOME RULE — Planetologist\'s shape): the Science-tag and Space-tag tracks summed', () => {
    const [game] = amazonisGame();
    setPosition(game, 'science', 3);
    setPosition(game, 'space', 5);
    setPosition(game, 'power', 9); // the Jovian row — not counted
    expect(score(game, 'Physicist')).eq(8);
  });

  it('Manufacturer (RB-C p.15): the building and power tracks summed', () => {
    const [game] = amazonisGame();
    setPosition(game, 'building', 4);
    setPosition(game, 'power', 6);
    expect(score(game, 'Manufacturer')).eq(10);
  });

  it('Constructor (RB-C p.14, «as usual»): the bot\'s real cities and colonies', () => {
    const [game, , bot] = amazonisGame({coloniesExtension: true});
    expect(score(game, 'Constructor')).eq(0);
    AutomaTilePlacer.placeCity(game);
    expect(score(game, 'Constructor')).eq(1);
    game.colonies[0].colonies.push(bot.id);
    expect(score(game, 'Constructor')).eq(2);
  });
});

describe('AMAZONIS PLANITIA + MarsBot — BF5 Corporate Competition (§24.6)', () => {
  it('Physicist: advances the LOWER of the science and space tracks (science if tied) and costs the 5 M€', () => {
    const [game, human, bot] = amazonisGame();
    fund(game, human, 'Physicist');
    setPosition(game, 'science', 4); // lands on 5, which is empty
    setPosition(game, 'space', 6);
    bot.megaCredits = 6;
    resolve(game, BF5);
    expect(position(game, 'science')).eq(5);
    expect(position(game, 'space')).eq(6);
    expect(bot.megaCredits).eq(1);
  });

  it('Manufacturer: the lower of building and power', () => {
    const [game, human, bot] = amazonisGame();
    fund(game, human, 'Manufacturer');
    setPosition(game, 'building', 3); // lands on 4, which is empty
    setPosition(game, 'power', 5);
    bot.megaCredits = 6;
    resolve(game, BF5);
    expect(position(game, 'building')).eq(4);
    expect(position(game, 'power')).eq(5);
    expect(bot.megaCredits).eq(1);
  });

  it('Collector: the least-advanced track', () => {
    const [game, human, bot] = amazonisGame();
    fund(game, human, 'Collector');
    for (const role of ['building', 'space', 'science', 'power', 'earth', 'bio'] as const) {
      setPosition(game, role, 2);
    }
    setPosition(game, 'event', 1); // lands on 2, which is empty
    bot.megaCredits = 6;
    resolve(game, BF5);
    expect(position(game, 'event')).eq(2);
    expect(bot.megaCredits).eq(1);
  });

  it('Innovator: reveals the top project card and resolves it — one more card in the pile', () => {
    const [game, human, bot] = amazonisGame();
    fund(game, human, 'Innovator');
    bot.megaCredits = 6;
    game.projectDeck.drawPile.push(new Mine());
    resolve(game, BF5);
    expect(game.automa!.playedPile).contains(CardName.MINE);
    expect(position(game, 'building'), 'the card\'s building tag moved its track').eq(1);
    expect(bot.megaCredits).eq(1);
  });

  it('Constructor: places a city', () => {
    const [game, human, bot] = amazonisGame();
    fund(game, human, 'Constructor');
    bot.megaCredits = 6;
    resolve(game, BF5);
    expect(botTiles(game, bot, TileType.CITY)).eq(1);
    expect(bot.megaCredits, '6 − 5 + the covered icons (at most 3)').within(1, 4);
  });

  it('Venuphile advances the Venus track (added to every version of the card)', () => {
    const [game, human, bot] = amazonisGame({venusNextExtension: true});
    fund(game, human, 'Venuphile');
    bot.megaCredits = 6;
    resolve(game, BF5);
    expect(position(game, 'venus')).is.at.least(1);
    expect(bot.megaCredits).eq(1);
  });

  it('below 5 M€ the card does nothing', () => {
    const [game, human, bot] = amazonisGame();
    fund(game, human, 'Physicist');
    bot.megaCredits = 4;
    const tracks = game.automa!.board.tracks.map((t) => t.position);
    resolve(game, BF5);
    expect(game.automa!.board.tracks.map((t) => t.position)).deep.eq(tracks);
    expect(bot.megaCredits).eq(4);
  });
});

describe('AMAZONIS PLANITIA + MarsBot — the bot\'s clock runs three generations later (§24.4)', () => {
  it('the pace offset is the map\'s: 3 on Amazonis Planitia, 0 everywhere else', () => {
    expect(botPaceOffset(BoardName.AMAZONIS_PLANITIA)).eq(3);
    expect(botPaceOffset(BoardName.THARSIS)).eq(0);
    expect(botPaceOffset(BoardName.HOLLANDIA)).eq(0);
    expect(botPaceOffset(BoardName.AMAZONIS), 'the FAN Amazonis is a standard-length map').eq(0);
  });

  it('the M€ → VP ladder: 8 M€ a point through the 15th generation (12th on a standard map), then one less a generation', () => {
    expect(AutomaScoring.mcPerVp(15, false, 1, 3)).eq(8);
    expect(AutomaScoring.mcPerVp(16, false, 1, 3)).eq(7);
    expect(AutomaScoring.mcPerVp(22, false, 1, 3)).eq(1);
    expect(AutomaScoring.mcPerVp(15, false)).eq(5);
    expect(AutomaScoring.mcPerVp(13, true, 1, 3), 'Prelude two generations earlier, as everywhere').eq(8);
    expect(AutomaScoring.mcPerVp(14, true, 1, 3)).eq(7);
    expect(AutomaScoring.mcPerVp(11, true, 2, 3), 'a second human: the ladder two generations EARLIER, as everywhere').eq(8);
    expect(AutomaScoring.mcPerVp(12, true, 2, 3)).eq(7);
  });

  it('…read in the game: 80 M€ in the 15th generation are 10 VP on this map, 16 on Tharsis', () => {
    const [game, , bot] = amazonisGame();
    bot.megaCredits = 80;
    game.generation = 15;
    expect(AutomaScoring.automaVictoryPoints(game).mcPerVp).eq(8);
    expect(AutomaScoring.automaVictoryPoints(game).mcToVp).eq(10);
    const [tharsis, , tharsisBot] = testAutomaGame({boardName: BoardName.THARSIS}, '-tharsis-clock');
    tharsisBot.megaCredits = 80;
    tharsis.generation = 15;
    expect(AutomaScoring.automaVictoryPoints(tharsis).mcToVp).eq(16);
  });

  it('the instant win is the 23rd generation (21st with Prelude) — 20 / 18 on a standard map', () => {
    expect(AutomaScoring.isInstantLossGeneration(23, false, 3)).is.true;
    expect(AutomaScoring.isInstantLossGeneration(22, false, 3)).is.false;
    expect(AutomaScoring.isInstantLossGeneration(21, true, 3)).is.true;
    expect(AutomaScoring.isInstantLossGeneration(20, true, 3)).is.false;
    expect(AutomaScoring.isInstantLossGeneration(20, false)).is.true;
  });

  it('entering the 23rd generation ends the game with a MarsBot win; the 22nd plays on', () => {
    const [game, human] = amazonisGame({}, '-win');
    game.generation = 22;
    playGenerationToEnd(game, human);
    expect(game.phase).eq('end');
    expect(game.automa!.instantWin).is.true;
    const [plays, playsHuman] = amazonisGame({}, '-plays-on');
    plays.generation = 21;
    playGenerationToEnd(plays, playsHuman);
    expect(plays.generation).eq(22);
    expect(plays.phase).eq('research');
    expect(plays.automa!.instantWin).is.false;
  });

  it('with Prelude the instant-win round is the 21st', () => {
    const [game, human] = amazonisGame({preludeExtension: true}, '-prelude-win');
    game.generation = 20;
    human.preludeCardsInHand = [];
    playGenerationToEnd(game, human);
    expect(game.phase).eq('end');
    expect(game.automa!.instantWin).is.true;
  });
});

describe('AMAZONIS PLANITIA + MarsBot — a real game runs', () => {
  it('resolves 30 track advances with Venus + Colonies + Redux + Prelude without a dead end', () => {
    const result = amazonisRedux({venusNextExtension: true, preludeExtension: true, corporation: 'random'}, '-runs');
    const game = result[0];
    expect(game.automa!.board.tracks).has.length(8);
    for (let i = 0; i < 30; i++) {
      expect(() => AutomaResolver.advanceTrack(game, i % 8)).does.not.throw();
    }
    expect(game.automa!.board.tracks.every((t) => t.position <= t.maxPosition)).is.true;
  });

  it('a full drive to the reserve: 160 advances of one row end on 24 with the row\'s TR paid, never beyond', () => {
    const [game, , bot] = amazonisGame({}, '-drive');
    for (let i = 0; i < 160; i++) {
      AutomaResolver.advanceTrack(game, T.BIO);
    }
    expect(position(game, 'bio')).eq(MARSBOT_EXTENDED_TRACK_POSITION);
    expect(bot.terraformRating).is.at.least(20 + 3 + 6 + 3 + 7);
  });
});

describe('AMAZONIS PLANITIA + MarsBot — what the client receives, and what a save keeps', () => {
  it('the server model carries 25-cell rows with their maxPosition, the colony cubes and the reserve', () => {
    const [game] = amazonisGame({venusNextExtension: true});
    const model = Server.getGameModel(game).automa!;
    expect(model.tracks).has.length(8);
    for (let i = 0; i < 7; i++) {
      expect(model.tracks[i].maxPosition, `row ${i}`).eq(MARSBOT_EXTENDED_TRACK_POSITION);
      expect(model.tracks[i].layout, `row ${i}`).has.length(MARSBOT_EXTENDED_TRACK_POSITION + 1);
      expect(model.tracks[i].layout[19], `row ${i} opens its reserve`).eq('advance');
    }
    expect(model.tracks[T.SPACE].layout[4]).eq('colony5');
    expect(model.tracks[T.POWER].tags).deep.eq([Tag.POWER, Tag.JOVIAN]);
    expect(model.tracks[7].maxPosition).eq(AMAZONIS_PLANITIA_VENUS_END);
    expect(model.tracks[7].layout).has.length(AMAZONIS_PLANITIA_VENUS_END + 1);
  });

  it('round-trips through the map profile: only the map NAME is stored, a position in the reserve survives', () => {
    const [game] = amazonisGame({venusNextExtension: true});
    setPosition(game, 'power', 21);
    setPosition(game, 'venus', 13);
    const restored = AutomaState.deserialize(game.automa!.serialize(), game.gameOptions);
    expect(restored.board.getTrackOfRole('power')!.position).eq(21);
    expect(restored.board.getTrackOfRole('power')!.maxPosition).eq(MARSBOT_EXTENDED_TRACK_POSITION);
    expect(restored.board.getTrackOfRole('venus')!.position).eq(13);
    expect(restored.board.getTrackOfRole('venus')!.maxPosition).eq(AMAZONIS_PLANITIA_VENUS_END);
    expect(restored.board.getTrackIndexForTag(Tag.JOVIAN)).eq(T.POWER);
  });
});

describe('AMAZONIS PLANITIA + MarsBot — «Случайные цели и награды» on the extended base', () => {
  const SET = {
    milestones: ['Builder', 'Dataminer', 'Rim Settler', 'Polar Explorer', 'Energizer'],
    awards: ['Scientist', 'Highlander', 'Banker', 'Thermalist', 'Miner'],
  } as const;

  it('the generated mat keeps the FORMAT: seven 25-cell rows, every row\'s reserve the map\'s own, lawful whole', () => {
    const [game] = testAutomaRandomSetGame(SET, {...AMAZONIS, venusNextExtension: true, coloniesExtension: true}, '-amz-random');
    const mat = game.automa!.mat!;
    expect(mat.base).eq(BoardName.AMAZONIS_PLANITIA);
    expect(mat.report.baseIsFallback, 'its own base, never a loan').is.not.true;
    expect(mat.tracks).has.length(7);
    mat.tracks.forEach((track, i) => {
      expect(isExtendedTrack(track), track.role).is.true;
      expect(track.layout, track.role).has.length(MARSBOT_EXTENDED_TRACK_POSITION + 1);
      expect(track.maxPosition, track.role).eq(MARSBOT_EXTENDED_TRACK_POSITION);
      expect(matTail(track), `${track.role}: the reserve is the map's`).deep.eq(AMAZONIS_PLANITIA_TAILS[i]);
    });
    expect(matViolations(mat.tracks)).deep.eq([]);
    expect(game.automa!.board.tracks.every((t) => t.maxPosition === (t.definition.role === 'venus' ? AMAZONIS_PLANITIA_VENUS_END : MARSBOT_EXTENDED_TRACK_POSITION))).is.true;
  });

  it('the Venus row is the map\'s 16-cell one, its microbe icon following the mat\'s Microbe track', () => {
    const [game] = testAutomaRandomSetGame(SET, {...AMAZONIS, venusNextExtension: true, coloniesExtension: true}, '-amz-random-venus');
    const venus = game.automa!.board.getTrackOfRole('venus')!;
    expect(venus.definition.layout).has.length(AMAZONIS_PLANITIA_VENUS_END + 1);
    expect(venus.definition.layout.slice(12)).deep.eq(['venus', 'advance', 'venus2', 'tr5']);
    const microbe = game.automa!.board.tracks.findIndex((t) => t.definition.tags.includes(Tag.MICROBE));
    expect(microbe).is.at.least(0);
    expect(venus.definition.layout[9]).eq(`tag_${microbe}`);
  });

  it('a set that moves the topology (a Jovian milestone) still hands every row its reserve', () => {
    const mat = generateBotMat({
      boardName: BoardName.AMAZONIS_PLANITIA, venus: true, colonies: true,
      milestones: ['Rim Settler', 'Energizer', 'Dataminer', 'Builder7', 'Mayor'], awards: ['Traveller', 'Manufacturer', 'Collector', 'Excentric', 'Suburbian'],
    });
    expect(mat.tracks).has.length(7);
    mat.tracks.forEach((track, i) => {
      expect(matTail(track), track.role).deep.eq(AMAZONIS_PLANITIA_TAILS[i]);
      expect(track.layout.slice(19).every((c) => c !== undefined), `${track.role}: no empty reserve cell`).is.true;
    });
    expect(matViolations(mat.tracks)).deep.eq([]);
    const jovian = mat.tracks.findIndex((t) => t.tags.includes(Tag.JOVIAN));
    expect(jovian, 'the Jovian tag has a row').is.at.least(0);
  });

  it('the game plays B14 for the drawn set, not BF5', () => {
    const [game] = testAutomaRandomSetGame(SET, {...AMAZONIS, coloniesExtension: true}, '-amz-random-b14');
    const ids = [...game.automa!.bonusDeck, ...game.automa!.actionDeck].flatMap((c) => (c.kind === 'bonus' ? [c.id] : []));
    expect(ids).contains(BonusCardId.B14_CORPORATE_COMPETITION_MA);
    expect(ids).does.not.contain(BF5);
    for (let i = 0; i < 30; i++) {
      expect(() => AutomaResolver.advanceTrack(game, i % 7)).does.not.throw();
    }
  });
});
