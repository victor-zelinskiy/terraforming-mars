import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {BonusCardId, MarsBotTrackRole} from '../../src/common/automa/AutomaTypes';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {Tag} from '../../src/common/cards/Tag';
import {TileType} from '../../src/common/TileType';
import {Board} from '../../src/server/boards/Board';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Space} from '../../src/server/boards/Space';
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
} from '../../src/server/automa/AutomaPlacementBonus';
import {VASTITAS_TRACK} from '../../src/server/automa/boards/VastitasBorealisMarsBot';
import {VENUS_TRACK_INDEX} from '../../src/server/automa/boards/VenusMarsBot';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {Server} from '../../src/server/models/ServerModel';
import {SelectParty} from '../../src/server/inputs/SelectParty';
import {testGame} from '../TestGame';
import {runAllActions, setTemperature} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {testAutomaGame} from './AutomaTestGame';

const VASTITAS = {boardName: BoardName.VASTITAS_BOREALIS_NOVA} as const;
const B13 = BonusCardId.B13_CORPORATE_COMPETITION_BOREALIS;

function vastitasGame(options?: object): ReturnType<typeof testAutomaGame> {
  return testAutomaGame({...VASTITAS, ...options});
}

/** Turmoil Redux on top — the Mars Parliament the Viking delegate goes to. The lobbying mandate is pinned to 0. */
function vastitasRedux(options?: object): ReturnType<typeof testAutomaGame> {
  // Turmoil Redux requires Colonies.
  const result = testAutomaGame({...VASTITAS, coloniesExtension: true, turmoilReduxExpansion: true, botParliamentMode: 'politics', ...options});
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
  expect(found, `Vastitas Borealis milestone ${name}`).is.not.undefined;
  return found!;
}

function award(game: IGame, name: string) {
  const found = game.awards.find((a) => a.name === name);
  expect(found, `Vastitas Borealis award ${name}`).is.not.undefined;
  return found!;
}

function met(game: IGame, name: string): boolean {
  return AutomaMAEvaluation.botMilestoneMet(milestone(game, name), game);
}

function botAward(game: IGame, name: string): number {
  return AutomaMAEvaluation.botAwardScore(award(game, name), game);
}

function resolve(game: IGame, id: BonusCardId) {
  const outcome = resolveBonusCard(game, id);
  routeBonusCard(game, id, outcome);
  return outcome;
}

/** An empty land space matching `predicate` — the fixture for a placement test. */
function land(game: IGame, predicate: (space: Space) => boolean): Space {
  const space = game.board.spaces.find((s) =>
    s.spaceType === SpaceType.LAND && s.tile === undefined && predicate(s));
  expect(space, 'the fixture needs this space').is.not.undefined;
  return space!;
}

function nearVolcano(game: IGame, space: Space): boolean {
  return space.volcanic === true || game.board.getAdjacentSpaces(space).some((s) => s.volcanic === true);
}

function nearOcean(game: IGame, space: Space): boolean {
  return game.board.getAdjacentSpaces(space).some((s) => s.spaceType === SpaceType.OCEAN || Board.isOceanSpace(s));
}

function northPole(game: IGame): Space {
  const found = game.board.spaces.find(isVastitasNorthPole);
  expect(found, 'the North Pole hex').is.not.undefined;
  return found!;
}

function vikings(game: IGame): Array<Space> {
  return game.board.spaces.filter(isVikingSite);
}

describe('VASTITAS BOREALIS + MarsBot — setup', () => {
  it('is playable, and it is the NOVA board the Automa material means', () => {
    const [game] = vastitasGame();
    expect(game.gameOptions.boardName).eq(BoardName.VASTITAS_BOREALIS_NOVA);
    expect(game.automa).is.not.undefined;
  });

  it('the fork\'s OLDER Vastitas Borealis is a DIFFERENT map — its own home-made profile, never this one', () => {
    const [old] = testAutomaGame({boardName: BoardName.VASTITAS_BOREALIS}, '-vb-old');
    expect(old.automa, 'supported since 2026-11-02 by VastitasBorealisFanMarsBot').is.not.undefined;
    expect(old.automa!.board.getTrackIndexForTag(Tag.MICROBE), 'its microbe rides bio, not science').eq(old.automa!.board.trackIndexOfRoleOrThrow('bio'));
    expect(AutomaSetup.bonusDeckContents({boardName: BoardName.VASTITAS_BOREALIS} as never), 'and it never plays with B13').does.not.contain(B13);
  });

  it('builds the bonus deck with B13, and no other map\'s card', () => {
    const deck = AutomaSetup.bonusDeckContents({boardName: BoardName.VASTITAS_BOREALIS_NOVA} as never);
    expect(deck).contains(B13);
    for (const other of [
      BonusCardId.B08_CORPORATE_COMPETITION,
      BonusCardId.B09_CORPORATE_COMPETITION_HELLAS,
      BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM,
      BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA,
      BonusCardId.B12_CORPORATE_COMPETITION_CIMMERIA,
    ]) {
      expect(deck, other).does.not.contain(other);
    }
  });

  it('prints two Viking hexes and one North Pole', () => {
    const [game] = vastitasGame();
    expect(vikings(game)).has.length(2);
    expect(game.board.spaces.filter(isVastitasNorthPole)).has.length(1);
  });
});

describe('VASTITAS BOREALIS + MarsBot — tag → track resolution', () => {
  function resolveTag(game: IGame, tag: Tag): void {
    AutomaResolver.advanceTrack(game, game.automa!.board.getTrackIndexForTag(tag)!);
  }

  it('a Microbe tag advances the Microbe/SCIENCE track — not bio', () => {
    const [game] = vastitasGame();
    resolveTag(game, Tag.MICROBE);
    expect(position(game, 'science')).is.at.least(1);
    expect(position(game, 'bio')).eq(0);
  });

  it('a City tag advances the City/ENERGY track — not Earth', () => {
    const [game] = vastitasGame();
    resolveTag(game, Tag.CITY);
    expect(position(game, 'power')).is.at.least(1);
    expect(position(game, 'earth')).eq(0);
  });

  it('a Jovian tag advances the Jovian/EARTH track — not Energy', () => {
    const [game] = vastitasGame();
    resolveTag(game, Tag.JOVIAN);
    expect(position(game, 'earth')).is.at.least(1);
    expect(position(game, 'power')).eq(0);
  });

  it('the printed ANIMAL icon on science 16 advances the Animal/Plant row', () => {
    const [game] = vastitasGame();
    setPosition(game, 'science', 15);
    setPosition(game, 'bio', 0);
    AutomaResolver.advanceTrack(game, VASTITAS_TRACK.SCIENCE);
    expect(position(game, 'science')).eq(16);
    expect(position(game, 'bio'), 'bio 0 → 1 (an empty cell)').eq(1);
  });

  it('with Venus Next, the Venus row\'s cell-9 MICROBE advances the Microbe/Science row', () => {
    const [game] = vastitasGame({venusNextExtension: true});
    const venus = game.automa!.board.trackIndexOfRoleOrThrow('venus');
    expect(venus).eq(VENUS_TRACK_INDEX);
    game.automa!.board.tracks[venus].position = 8;
    setPosition(game, 'science', 2); // lands on 3, which is empty
    setPosition(game, 'bio', 0);
    AutomaResolver.advanceTrack(game, venus);
    expect(game.automa!.board.tracks[venus].position).eq(9);
    expect(position(game, 'science'), 'the microbe\'s own row moved').eq(3);
    expect(position(game, 'bio'), 'and bio did not').eq(0);
  });

  it('the building row\'s VENUS icon is inert without Venus Next', () => {
    const [game] = vastitasGame();
    setPosition(game, 'building', 10);
    expect(() => AutomaResolver.advanceTrack(game, VASTITAS_TRACK.BUILDING)).does.not.throw();
    expect(position(game, 'building')).eq(11);
  });
});

describe('VASTITAS BOREALIS + MarsBot — placement tiebreakers (Adding Expansions p.10)', () => {
  it('REWARD ICONS come first — a 2-icon hex beats a bare one beside an ocean (no step 1 here)', () => {
    const [game, , bot] = vastitasGame();
    const coast = land(game, (s) => s.bonus.length === 0 && !nearVolcano(game, s) && !game.board.isEdge(s) &&
      game.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined));
    const ocean = game.board.getAdjacentSpaces(coast).find((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined)!;
    game.simpleAddTile(bot, ocean, {tileType: TileType.OCEAN});
    const rich = land(game, (s) => s.bonus.length === 2 && !nearVolcano(game, s) && !game.board.isEdge(s) &&
      !game.board.getAdjacentSpaces(s).some(Board.isOceanSpace));
    expect(AutomaTilePlacer.breakTie(game, [coast, rich])).eq(rich);
  });

  it('a hex ON or NEXT TO a volcano counts ONE extra icon — so it beats an equal hex elsewhere, even an edge one', () => {
    const [game] = vastitasGame();
    const volcanic = land(game, (s) => s.bonus.length === 0 && nearVolcano(game, s));
    const edge = land(game, (s) => s.bonus.length === 0 && !nearVolcano(game, s) && game.board.isEdge(s));
    expect(AutomaTilePlacer.breakTie(game, [edge, volcanic])).eq(volcanic);
  });

  it('…ONE extra icon, never one per volcano — and the payout stays the printed icons', () => {
    const [game, , bot] = vastitasGame();
    const volcanic = land(game, (s) => s.volcanic === true && s.bonus.length > 0);
    expect(botCoveredIconMegacredits(game, volcanic)).eq(volcanic.bonus.length);
    expect(botRewardIcons(game, bot, volcanic)).eq(volcanic.bonus.length);
  });

  it('icons level → an EDGE hex wins (step 6)', () => {
    const [game] = vastitasGame();
    const inland = land(game, (s) => s.bonus.length === 0 && !nearVolcano(game, s) && !game.board.isEdge(s));
    const edge = land(game, (s) => s.bonus.length === 0 && !nearVolcano(game, s) && game.board.isEdge(s));
    expect(AutomaTilePlacer.breakTie(game, [inland, edge])).eq(edge);
  });

  it('icons and edge level → the one beside more OCEANS wins', () => {
    const [game, , bot] = vastitasGame();
    const coast = land(game, (s) => s.bonus.length === 0 && !nearVolcano(game, s) && !game.board.isEdge(s) &&
      game.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined));
    const ocean = game.board.getAdjacentSpaces(coast).find((a) => a.spaceType === SpaceType.OCEAN && a.tile === undefined)!;
    game.simpleAddTile(bot, ocean, {tileType: TileType.OCEAN});
    const dry = land(game, (s) => s !== coast && s.bonus.length === 0 && !nearVolcano(game, s) && !game.board.isEdge(s) &&
      !game.board.getAdjacentSpaces(s).some(Board.isOceanSpace));
    expect(AutomaTilePlacer.breakTie(game, [dry, coast])).eq(coast);
  });
});

describe('VASTITAS BOREALIS + MarsBot — the North Pole (temperature for 4 M€)', () => {
  it('USABLE: it outranks an ordinary 2-icon hex but loses to a 3-icon one', () => {
    const [game, , bot] = vastitasGame();
    bot.megaCredits = 10;
    expect(botRewardIcons(game, bot, northPole(game))).is.above(2).and.below(3);
  });

  it('UNUSABLE below 4 M€, or with the temperature maxed: a hex without rewards', () => {
    const [game, , bot] = vastitasGame();
    bot.megaCredits = 3;
    expect(botRewardIcons(game, bot, northPole(game))).eq(0);
    bot.megaCredits = 10;
    setTemperature(game, 8);
    expect(botRewardIcons(game, bot, northPole(game))).eq(0);
  });

  it('placing on a USABLE pole raises the temperature 1 step and charges 4 M€ — never icon M€', () => {
    const [game, , bot] = vastitasGame();
    bot.megaCredits = 10;
    const temperature = game.getTemperature();
    const pole = northPole(game);
    AutomaTilePlacer.placeGreenery(game, {restrict: (s) => s === pole});
    expect(pole.tile, 'the tile went down').is.not.undefined;
    expect(game.getTemperature(), 'one temperature step').eq(temperature + 2);
    expect(bot.megaCredits, '10 − 4').eq(6);
  });

  it('placing on an UNUSABLE pole gains and loses NOTHING', () => {
    const [game, , bot] = vastitasGame();
    bot.megaCredits = 3;
    const temperature = game.getTemperature();
    const pole = northPole(game);
    AutomaTilePlacer.placeGreenery(game, {restrict: (s) => s === pole});
    expect(pole.tile).is.not.undefined;
    expect(game.getTemperature()).eq(temperature);
    expect(bot.megaCredits).eq(3);
  });

  it('an unaffordable pole stays a LEGAL placement even though the human path would drop it', () => {
    const [game, , bot] = vastitasGame();
    bot.megaCredits = 0;
    const pole = northPole(game);
    expect(game.board.getAvailableSpacesForGreenery(bot).includes(pole),
      'the human legality path gates on the 4 M€…').is.false;
    AutomaTilePlacer.placeGreenery(game, {restrict: (s) => s === pole});
    expect(pole.tile).is.not.undefined;
  });
});

describe('VASTITAS BOREALIS + MarsBot — Viking 1 / 2 (the delegate hexes)', () => {
  it('without the Mars Parliament the hex is «considered empty»: 0 icons, and landing pays nothing', () => {
    const [game, , bot] = vastitasGame();
    const viking = vikings(game)[0];
    expect(botRewardIcons(game, bot, viking)).eq(0);
    bot.megaCredits = 0;
    AutomaTilePlacer.placeGreenery(game, {restrict: (s) => s === viking});
    expect(viking.tile).is.not.undefined;
    expect(bot.megaCredits, 'never the 1 M€ of an ordinary icon').eq(0);
  });

  it('WITH the Parliament it counts as ONE icon, and landing PLACES a delegate — free, beside the mandate', () => {
    const [game, , bot] = vastitasRedux();
    const parliament = game.parliament!;
    const viking = vikings(game)[0];
    expect(botRewardIcons(game, bot, viking)).eq(1);
    const reserve = parliament.reserve(bot);
    const votes = parliament.votesOf(bot);
    const megaCredits = bot.megaCredits;
    AutomaTilePlacer.placeGreenery(game, {restrict: (s) => s === viking});
    expect(viking.tile).is.not.undefined;
    expect(parliament.votesOf(bot), 'one more delegate on a resolution').eq(votes + 1);
    expect(parliament.reserve(bot), 'taken from the reserve').eq(reserve - 1);
    expect(bot.megaCredits, 'and no icon M€').eq(megaCredits);
    expect(game.automa!.lobbyMandate!.sent, 'the generation\'s mandate is untouched (+1 on top)').eq(0);
  });

  it('an EMPTY reserve makes the hex «without rewards»: 0 icons, nothing placed', () => {
    const [game, , bot] = vastitasRedux();
    const parliament = game.parliament!;
    const viking = vikings(game)[0];
    // Every reserve delegate onto the voting area — the reserve is now empty.
    while (parliament.reserve(bot) > 0) {
      parliament.placeVote(bot, parliament.slots[0], 'reserve');
    }
    expect(botRewardIcons(game, bot, viking)).eq(0);
    const votes = parliament.votesOf(bot);
    AutomaTilePlacer.placeGreenery(game, {restrict: (s) => s === viking});
    expect(parliament.votesOf(bot)).eq(votes);
  });

  it('a HUMAN on a Viking hex is asked where to add the delegate (the Parliament\'s own grant)', () => {
    const [game, human] = testGame(2, {...VASTITAS, coloniesExtension: true, turmoilReduxExpansion: true});
    const viking = vikings(game)[0];
    game.grantSpaceBonus(human, SpaceBonus.DELEGATE, 1, {spaceId: viking.id});
    runAllActions(game);
    const prompt = cast(human.popWaitingFor(), SelectParty);
    expect(prompt.choiceContext?.source, 'the cell names the giver').deep.include({kind: 'space', space: viking.id});
  });
});

describe('VASTITAS BOREALIS + MarsBot — milestones (Adding Expansions p.11)', () => {
  it('Agronomist: the Animal/Plant track at 4', () => {
    const [game] = vastitasGame();
    setPosition(game, 'bio', 3);
    expect(met(game, 'Agronomist')).is.false;
    setPosition(game, 'bio', 4);
    expect(met(game, 'Agronomist')).is.true;
  });

  it('Spacefarer: the Space track at 5', () => {
    const [game] = vastitasGame();
    setPosition(game, 'space', 4);
    expect(met(game, 'V. Spacefarer')).is.false;
    setPosition(game, 'space', 5);
    expect(met(game, 'V. Spacefarer')).is.true;
  });

  it('Engineer: Jovian/Earth + City/Energy COMBINED at 10', () => {
    const [game] = vastitasGame();
    setPosition(game, 'earth', 6);
    setPosition(game, 'power', 3);
    expect(met(game, 'Engineer')).is.false;
    setPosition(game, 'power', 4);
    expect(met(game, 'Engineer')).is.true;
  });

  it('Farmer: EITHER Microbe/Science OR Animal/Plant at 6 — never their sum', () => {
    const [game] = vastitasGame();
    setPosition(game, 'science', 5);
    setPosition(game, 'bio', 5);
    expect(met(game, 'Farmer'), '5 + 5 is not 6 on either').is.false;
    setPosition(game, 'science', 6);
    expect(met(game, 'Farmer')).is.true;
    setPosition(game, 'science', 0);
    setPosition(game, 'bio', 6);
    expect(met(game, 'Farmer')).is.true;
  });

  it('Geologist: UNCHANGED — the bot\'s real tiles on or next to the volcanic areas', () => {
    const [game, , bot] = vastitasGame();
    const spots = game.board.spaces.filter((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && nearVolcano(game, s));
    const threshold = 3;
    for (const space of spots.slice(0, threshold - 1)) {
      game.simpleAddTile(bot, space, {tileType: TileType.GREENERY});
    }
    expect(met(game, 'Geologist')).is.false;
    game.simpleAddTile(bot, spots[threshold - 1], {tileType: TileType.GREENERY});
    expect(met(game, 'Geologist')).is.true;
  });
});

describe('VASTITAS BOREALIS + MarsBot — awards (Adding Expansions p.11)', () => {
  it('Traveller: the Jovian/Earth track space + 5', () => {
    const [game] = vastitasGame();
    setPosition(game, 'earth', 4);
    expect(botAward(game, 'Traveller')).eq(9);
  });

  it('Promoter: the Event track space', () => {
    const [game] = vastitasGame();
    setPosition(game, 'event', 7);
    expect(botAward(game, 'Promoter')).eq(7);
  });

  it('Blacksmith: Building OR Space, whichever is further — never their sum', () => {
    const [game] = vastitasGame();
    setPosition(game, 'building', 3);
    setPosition(game, 'space', 8);
    expect(botAward(game, 'Blacksmith')).eq(8);
  });

  it('Landscaper and Highlander: UNCHANGED — the bot\'s real tiles', () => {
    const [game, , bot] = vastitasGame();
    const dry = land(game, (s) => !nearOcean(game, s));
    game.simpleAddTile(bot, dry, {tileType: TileType.GREENERY});
    expect(botAward(game, 'Highlander')).eq(award(game, 'Highlander').getScore(bot));
    expect(botAward(game, 'Highlander')).is.at.least(1);
    expect(botAward(game, 'Landscaper')).eq(award(game, 'Landscaper').getScore(bot));
  });
});

describe('VASTITAS BOREALIS + MarsBot — B13 Corporate Competition', () => {
  function fund(game: IGame, human: IPlayer, name: string) {
    game.fundAward(human, award(game, name));
  }

  it('Traveller advances the JOVIAN (Jovian/Earth) track and costs exactly 5 M€', () => {
    const [game, human, bot] = vastitasGame();
    fund(game, human, 'Traveller');
    setPosition(game, 'earth', 2); // lands on 3, which is empty
    bot.megaCredits = 6;
    resolve(game, B13);
    expect(position(game, 'earth')).eq(3);
    expect(bot.megaCredits).eq(1);
  });

  it('Promoter advances the EVENT track', () => {
    const [game, human, bot] = vastitasGame();
    fund(game, human, 'Promoter');
    setPosition(game, 'event', 1); // lands on 2, which is empty
    bot.megaCredits = 6;
    resolve(game, B13);
    expect(position(game, 'event')).eq(2);
    expect(bot.megaCredits).eq(1);
  });

  it('Blacksmith advances the FURTHER of Building / Space; a tie goes to Building', () => {
    const [game, human, bot] = vastitasGame();
    fund(game, human, 'Blacksmith');
    setPosition(game, 'building', 2);
    setPosition(game, 'space', 3); // space lands on 4, which is empty
    bot.megaCredits = 6;
    resolve(game, B13);
    expect(position(game, 'space')).eq(4);
    expect(position(game, 'building')).eq(2);

    const [tied, tiedHuman, tiedBot] = vastitasGame();
    fund(tied, tiedHuman, 'Blacksmith');
    setPosition(tied, 'building', 3); // building lands on 4, which is empty
    setPosition(tied, 'space', 3);
    tiedBot.megaCredits = 6;
    resolve(tied, B13);
    expect(position(tied, 'building'), 'the topmost of the tied pair').eq(4);
    expect(position(tied, 'space')).eq(3);
  });

  it('Blacksmith with the further track MAXED advances the other one', () => {
    const [game, human, bot] = vastitasGame();
    fund(game, human, 'Blacksmith');
    setPosition(game, 'building', 18);
    setPosition(game, 'space', 3);
    bot.megaCredits = 6;
    resolve(game, B13);
    expect(position(game, 'space')).eq(4);
    expect(bot.megaCredits).eq(1);
  });

  it('Landscaper places a greenery', () => {
    const [game, human, bot] = vastitasGame();
    fund(game, human, 'Landscaper');
    bot.megaCredits = 6;
    const before = game.board.spaces.filter((s) => s.player === bot && Board.isGreenerySpace(s)).length;
    resolve(game, B13);
    expect(game.board.spaces.filter((s) => s.player === bot && Board.isGreenerySpace(s)).length).eq(before + 1);
  });

  it('Highlander places its greenery away from EVERY ocean — placed or merely reserved', () => {
    const [game, human, bot] = vastitasGame();
    fund(game, human, 'Highlander');
    bot.megaCredits = 10;
    resolve(game, B13);
    const greenery = game.board.spaces.find((s) => s.player === bot && Board.isGreenerySpace(s));
    expect(greenery, 'a greenery went down').is.not.undefined;
    expect(nearOcean(game, greenery!), 'not next to an ocean space of any kind').is.false;
  });

  it('Highlander with no such legal space is IMPOSSIBLE — nothing placed, nothing paid', () => {
    const [game, human, bot] = vastitasGame();
    fund(game, human, 'Highlander');
    // Every land space away from the oceans is taken — by the human.
    for (const space of game.board.spaces.filter((s) => s.spaceType === SpaceType.LAND && s.tile === undefined && !nearOcean(game, s))) {
      game.simpleAddTile(human, space, {tileType: TileType.GREENERY});
    }
    game.automa!.bonusDeck = [];
    game.automa!.bonusDiscard = [];
    bot.megaCredits = 9;
    resolve(game, B13);
    expect(game.board.spaces.some((s) => s.player === bot && Board.isGreenerySpace(s)), 'no greenery anywhere else').is.false;
    expect(bot.megaCredits, 'and the 5 M€ never left').eq(9);
  });
});

describe('VASTITAS BOREALIS + MarsBot — a real game runs', () => {
  it('resolves 30 track advances with Venus + Colonies + Redux without a dead end', () => {
    const [game] = vastitasRedux({
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

describe('VASTITAS BOREALIS + MarsBot — what the client receives, and what a save keeps', () => {
  it('the server model carries the VASTITAS cells and tag pairings', () => {
    const [game] = vastitasGame({venusNextExtension: true});
    const model = Server.getGameModel(game).automa!;
    expect(model.tracks).has.length(8);
    expect(model.tracks[VASTITAS_TRACK.SCIENCE].tags).deep.eq([Tag.MICROBE, Tag.SCIENCE]);
    expect(model.tracks[VASTITAS_TRACK.POWER].tags).deep.eq([Tag.CITY, Tag.POWER]);
    expect(model.tracks[VASTITAS_TRACK.EARTH].tags).deep.eq([Tag.JOVIAN, Tag.EARTH]);
    expect(model.tracks[VASTITAS_TRACK.BIO].tags).deep.eq([Tag.ANIMAL, Tag.PLANT]);
    expect(model.tracks[VENUS_TRACK_INDEX].layout[9], 'the Venus row\'s microbe reaches the client').eq(`tag_${VASTITAS_TRACK.SCIENCE}`);
  });

  it('round-trips through the map profile: only the map NAME is stored', () => {
    const [game] = vastitasGame({venusNextExtension: true});
    setPosition(game, 'science', 7);
    const restored = AutomaState.deserialize(game.automa!.serialize(), game.gameOptions);
    expect(restored.board.getTrackOfRole('science')!.position).eq(7);
    expect(restored.board.getTrackIndexForTag(Tag.MICROBE)).eq(restored.board.trackIndexOfRoleOrThrow('science'));
    expect(restored.board.tracks[VENUS_TRACK_INDEX].definition.layout[9]).eq(`tag_${VASTITAS_TRACK.SCIENCE}`);
  });
});
