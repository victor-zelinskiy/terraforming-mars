import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {BonusCardId, MarsBotTrackRole} from '../../src/common/automa/AutomaTypes';
import {CardName} from '../../src/common/cards/CardName';
import {Resource} from '../../src/common/Resource';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {Tag} from '../../src/common/cards/Tag';
import {TileType} from '../../src/common/TileType';
import {AwardScorer} from '../../src/server/awards/AwardScorer';
import {Board, isSpecialTileSpace} from '../../src/server/boards/Board';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Space} from '../../src/server/boards/Space';
import {AutomaMAEvaluation} from '../../src/server/automa/AutomaMAEvaluation';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {AutomaSetup} from '../../src/server/automa/AutomaSetup';
import {AutomaState} from '../../src/server/automa/AutomaState';
import {AutomaTilePlacer} from '../../src/server/automa/AutomaTilePlacer';
import {botRewardIcons, isMslCuriosity} from '../../src/server/automa/AutomaPlacementBonus';
import {Server} from '../../src/server/models/ServerModel';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {ArtificialLake} from '../../src/server/cards/base/ArtificialLake';
import {Mine} from '../../src/server/cards/base/Mine';
import {milestoneThreshold} from '../../src/server/milestones/IMilestone';
import {testAutomaGame, testAutomaMultiplayerGame} from './AutomaTestGame';

const TERRA = {boardName: BoardName.TERRA_CIMMERIA_NOVA} as const;

function terraGame(options?: object): [IGame, ReturnType<typeof testAutomaGame>[1], IPlayer] {
  return testAutomaGame({...TERRA, ...options});
}

/** The index of a canonical track on the game's board — never a literal row number. */
function trackIndex(game: IGame, role: MarsBotTrackRole): number {
  return game.automa!.board.trackIndexOfRoleOrThrow(role);
}

function position(game: IGame, role: MarsBotTrackRole): number {
  return game.automa!.board.getTrackOfRole(role)!.position;
}

function setPosition(game: IGame, role: MarsBotTrackRole, value: number): void {
  game.automa!.board.getTrackOfRole(role)!.position = value;
}

function milestone(game: IGame, name: string) {
  const found = game.milestones.find((m) => m.name === name);
  expect(found, `Terra Cimmeria milestone ${name}`).is.not.undefined;
  return found!;
}

function award(game: IGame, name: string) {
  const found = game.awards.find((a) => a.name === name);
  expect(found, `Terra Cimmeria award ${name}`).is.not.undefined;
  return found!;
}

function met(game: IGame, name: string): boolean {
  return AutomaMAEvaluation.botMilestoneMet(milestone(game, name), game);
}

function shown(game: IGame, name: string): number {
  return AutomaMAEvaluation.botMilestoneScore(milestone(game, name), game);
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

/** The printed MSL Curiosity hex (present only with Colonies). */
function mslHex(game: IGame): Space | undefined {
  return game.board.spaces.find(isMslCuriosity);
}

describe('TERRA CIMMERIA + MarsBot — setup', () => {
  it('is playable, and it is the NOVA board the Automa material means', () => {
    const [game] = terraGame();
    expect(game.gameOptions.boardName).eq(BoardName.TERRA_CIMMERIA_NOVA);
    expect(game.automa).is.not.undefined;
  });

  it('the fork\'s OLDER Terra Cimmeria is rejected — different map, different M&A row', () => {
    expect(() => testAutomaGame({boardName: BoardName.TERRA_CIMMERIA}, '-tc-old'))
      .to.throw(/MarsBot \(Automa\) does not support/);
  });

  it('uses the TERRA board — City+Science, Jovian+Earth, Energy alone', () => {
    const [game] = terraGame();
    const board = game.automa!.board;
    expect(board.getTrackOfRole('science')!.definition.tags).deep.eq([Tag.CITY, Tag.SCIENCE]);
    expect(board.getTrackOfRole('earth')!.definition.tags).deep.eq([Tag.JOVIAN, Tag.EARTH]);
    expect(board.getTrackOfRole('power')!.definition.tags).deep.eq([Tag.POWER]);
  });

  it('builds the bonus deck with B12, and no other map\'s card', () => {
    const deck = AutomaSetup.bonusDeckContents({boardName: BoardName.TERRA_CIMMERIA_NOVA} as never);
    expect(deck).contains(BonusCardId.B12_CORPORATE_COMPETITION_CIMMERIA);
    for (const other of [
      BonusCardId.B08_CORPORATE_COMPETITION,
      BonusCardId.B09_CORPORATE_COMPETITION_HELLAS,
      BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM,
      BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA,
    ]) {
      expect(deck, other).does.not.contain(other);
    }
  });
});

describe('TERRA CIMMERIA + MarsBot — tag → track resolution', () => {
  function resolveTag(game: IGame, tag: Tag): void {
    AutomaResolver.advanceTrack(game, game.automa!.board.getTrackIndexForTag(tag)!);
  }

  it('a Jovian tag advances the Jovian/EARTH track — not Power, not Science', () => {
    const [game] = terraGame();
    resolveTag(game, Tag.JOVIAN);
    expect(position(game, 'earth')).is.at.least(1);
    expect(position(game, 'power')).eq(0);
    expect(position(game, 'science')).eq(0);
  });

  it('an Earth tag advances the SAME track', () => {
    const [game] = terraGame();
    resolveTag(game, Tag.EARTH);
    expect(position(game, 'earth')).is.at.least(1);
  });

  it('a City tag advances the CITY/SCIENCE track — not Earth', () => {
    const [game] = terraGame();
    resolveTag(game, Tag.CITY);
    expect(position(game, 'science')).is.at.least(1);
    expect(position(game, 'earth')).eq(0);
  });

  it('a Science tag advances the SAME track', () => {
    const [game] = terraGame();
    resolveTag(game, Tag.SCIENCE);
    expect(position(game, 'science')).is.at.least(1);
  });

  it('an Energy tag advances the STANDALONE energy track', () => {
    const [game] = terraGame();
    resolveTag(game, Tag.POWER);
    expect(position(game, 'power')).is.at.least(1);
    expect(position(game, 'earth'), 'Jovian/Earth never moved').eq(0);
  });

  it('Building / Space / Event reach their own tracks; the bio tags share one', () => {
    const [game] = terraGame();
    const board = game.automa!.board;
    expect(board.getTrackIndexForTag(Tag.BUILDING)).eq(trackIndex(game, 'building'));
    expect(board.getTrackIndexForTag(Tag.SPACE)).eq(trackIndex(game, 'space'));
    expect(board.getTrackIndexForTag(Tag.EVENT)).eq(trackIndex(game, 'event'));
    for (const tag of [Tag.PLANT, Tag.ANIMAL, Tag.MICROBE] as const) {
      expect(board.getTrackIndexForTag(tag), `${tag}`).eq(trackIndex(game, 'bio'));
    }
  });

  it('a Wild tag still takes the furthest-back track — the generic rule, this map\'s rows', () => {
    const [game] = terraGame();
    for (const track of game.automa!.board.tracks) {
      track.position = 3;
    }
    setPosition(game, 'science', 1);
    expect(game.automa!.board.getLeastAdvancedTrackIndex()).eq(trackIndex(game, 'science'));
  });

  it('the printed ENERGY tag icon on the building track advances the energy row', () => {
    const [game] = terraGame();
    setPosition(game, 'building', 3);
    AutomaResolver.advanceTrack(game, trackIndex(game, 'building'));
    expect(position(game, 'building')).eq(4);
    expect(position(game, 'power'), 'the circular tag icon advanced Energy').is.at.least(1);
  });

  it('the printed EVENT tag icon on the City/Science track advances the event row', () => {
    const [game] = terraGame();
    setPosition(game, 'science', 6);
    AutomaResolver.advanceTrack(game, trackIndex(game, 'science'));
    expect(position(game, 'science')).eq(7);
    expect(position(game, 'event'), 'the circular tag icon advanced Event').is.at.least(1);
  });
});

describe('TERRA CIMMERIA + MarsBot — production regression follows the printed badges', () => {
  const cases: ReadonlyArray<[Resource, MarsBotTrackRole]> = [
    [Resource.STEEL, 'building'],
    [Resource.TITANIUM, 'space'],
    [Resource.MEGACREDITS, 'event'],
    [Resource.ENERGY, 'power'], // standalone Energy
    [Resource.HEAT, 'earth'], // Jovian + Earth
    [Resource.PLANTS, 'bio'],
  ];
  for (const [resource, role] of cases) {
    it(`decreasing ${resource} production regresses the ${role} track`, () => {
      const [game] = terraGame();
      expect(game.automa!.board.getTrackIndexForProduction(resource)).eq(trackIndex(game, role));
    });
  }

  it('energy regression never reaches Jovian/Earth, and heat never reaches City/Science', () => {
    const [game] = terraGame();
    expect(game.automa!.board.getTrackIndexForProduction(Resource.ENERGY))
      .not.eq(trackIndex(game, 'earth'));
    expect(game.automa!.board.getTrackIndexForProduction(Resource.HEAT))
      .not.eq(trackIndex(game, 'science'));
  });

  it('a regressed space does not fire its action again on the way back up', () => {
    const [game] = terraGame();
    const track = game.automa!.board.getTrackOfRole('building')!;
    track.position = 7; // the milestone cell
    track.regress();
    expect(track.position).eq(6);
    expect(track.advance(), 'the re-advance is silent').deep.eq({type: 'none'});
  });
});

describe('TERRA CIMMERIA + MarsBot — placement (Adding Expansions p.10)', () => {
  it('adjacency to oceans wins first (step 1)', () => {
    const [game, , bot] = terraGame();
    const oceanAdjacent = land(game, (s) =>
      game.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.OCEAN));
    const neighbour = game.board.getAdjacentSpaces(oceanAdjacent)
      .find((a) => a.spaceType === SpaceType.OCEAN)!;
    game.simpleAddTile(bot, neighbour, {tileType: TileType.OCEAN});
    const rich = land(game, (s) => s !== oceanAdjacent && s.bonus.length >= 2 &&
      !game.board.getAdjacentSpaces(s).some(Board.isOceanSpace));
    expect(AutomaTilePlacer.breakTie(game, [rich, oceanAdjacent])).eq(oceanAdjacent);
  });

  it('SPECIAL-TILE adjacency beats reward icons (step 3 before step 4)', () => {
    const [game, human] = terraGame();
    const bare = land(game, (s) => s.bonus.length === 0);
    const neighbour = game.board.getAdjacentSpaces(bare)
      .find((a) => a.spaceType === SpaceType.LAND && a.tile === undefined)!;
    game.simpleAddTile(human, neighbour, {tileType: TileType.NUCLEAR_ZONE});
    expect(isSpecialTileSpace(neighbour), 'the fixture really is a special tile').is.true;
    const rich = land(game, (s) => s !== bare && s.bonus.length === 2 &&
      !game.board.getAdjacentSpaces(s).some(isSpecialTileSpace));
    expect(AutomaTilePlacer.breakTie(game, [rich, bare]), 'the special-tile neighbour wins').eq(bare);
  });

  it('…but ocean adjacency still beats special-tile adjacency (step 1 before step 3)', () => {
    const [game, human, bot] = terraGame();
    // The ocean fixture FIRST, so the special one can be chosen from spaces
    // that are provably not next to it (the two are otherwise free to collide:
    // `land()` walks the board in order and both want the same corner).
    const nextToOcean = land(game, (s) =>
      game.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.OCEAN));
    const oceanNeighbour = game.board.getAdjacentSpaces(nextToOcean)
      .find((a) => a.spaceType === SpaceType.OCEAN)!;
    game.simpleAddTile(bot, oceanNeighbour, {tileType: TileType.OCEAN});

    const nextToSpecial = land(game, (s) => s !== nextToOcean &&
      !game.board.getAdjacentSpaces(s).some(Board.isOceanSpace) &&
      game.board.getAdjacentSpaces(s).some((a) =>
        a.spaceType === SpaceType.LAND && a.tile === undefined && a !== nextToOcean));
    const specialNeighbour = game.board.getAdjacentSpaces(nextToSpecial)
      .find((a) => a.spaceType === SpaceType.LAND && a.tile === undefined && a !== nextToOcean)!;
    game.simpleAddTile(human, specialNeighbour, {tileType: TileType.NUCLEAR_ZONE});

    // State the fixture's own preconditions, so a board change fails HERE
    // rather than looking like a tiebreaker-order bug.
    expect(game.board.getAdjacentSpaces(nextToOcean).filter(Board.isOceanSpace),
      'the ocean candidate has exactly one ocean neighbour').has.length(1);
    expect(game.board.getAdjacentSpaces(nextToSpecial).some(Board.isOceanSpace),
      'the special candidate has none').is.false;
    expect(game.board.getAdjacentSpaces(nextToSpecial).some(isSpecialTileSpace),
      'but it does have a special neighbour').is.true;
    expect(AutomaTilePlacer.breakTie(game, [nextToSpecial, nextToOcean])).eq(nextToOcean);
  });

  it('«one or more» is a YES/NO test — two special neighbours are not better than one', () => {
    // The printed rule says «adjacent to one or more special tiles»; scoring the
    // COUNT would invent a preference the rulebook does not print. Both hexes
    // clear step 3 together and the tie falls through to the card flip.
    const [game, human] = terraGame();
    const one = land(game, (s) => s.bonus.length === 0 &&
      !game.board.getAdjacentSpaces(s).some(Board.isOceanSpace));
    const oneNeighbours = game.board.getAdjacentSpaces(one)
      .filter((a) => a.spaceType === SpaceType.LAND && a.tile === undefined);
    game.simpleAddTile(human, oneNeighbours[0], {tileType: TileType.NUCLEAR_ZONE});

    const two = land(game, (s) => s !== one && s.bonus.length === 0 &&
      !game.board.getAdjacentSpaces(s).some(Board.isOceanSpace) &&
      game.board.getAdjacentSpaces(s).filter((a) => a.spaceType === SpaceType.LAND && a.tile === undefined).length >= 2);
    const twoNeighbours = game.board.getAdjacentSpaces(two)
      .filter((a) => a.spaceType === SpaceType.LAND && a.tile === undefined);
    game.simpleAddTile(human, twoNeighbours[0], {tileType: TileType.NUCLEAR_ZONE});
    game.simpleAddTile(human, twoNeighbours[1], {tileType: TileType.NUCLEAR_ZONE});

    const before = game.projectDeck.drawPile.length;
    const picked = AutomaTilePlacer.breakTie(game, [one, two]);
    expect([one, two], 'either may win').contains(picked);
    expect(game.projectDeck.drawPile.length,
      'the two hexes tied on step 3 and reached the card flip').eq(before - 1);
  });

  it('the Neural Instance counts as a special tile for the tiebreaker', () => {
    const [game, , bot] = terraGame();
    const target = land(game, (s) => s.bonus.length === 0 &&
      !game.board.getAdjacentSpaces(s).some(Board.isOceanSpace));
    const neighbour = game.board.getAdjacentSpaces(target)
      .find((a) => a.spaceType === SpaceType.LAND && a.tile === undefined)!;
    game.simpleAddTile(bot, neighbour, {tileType: TileType.NEURAL_INSTANCE});
    const rich = land(game, (s) => s !== target && s.bonus.length === 2 &&
      !game.board.getAdjacentSpaces(s).some(isSpecialTileSpace) &&
      !game.board.getAdjacentSpaces(s).some(Board.isOceanSpace));
    expect(AutomaTilePlacer.breakTie(game, [rich, target])).eq(target);
  });

  it('everything level → the project-card flip decides, and consumes a card', () => {
    const [game] = terraGame();
    const plain = (s: Space) => s.bonus.length === 0 &&
      !game.board.getAdjacentSpaces(s).some(Board.isOceanSpace) &&
      !game.board.getAdjacentSpaces(s).some(isSpecialTileSpace);
    const a = land(game, plain);
    const b = game.board.spaces.find((s) => s !== a && s.spaceType === SpaceType.LAND &&
      s.tile === undefined && plain(s))!;
    const before = game.projectDeck.drawPile.length;
    expect([a, b]).contains(AutomaTilePlacer.breakTie(game, [a, b]));
    expect(game.projectDeck.drawPile.length).eq(before - 1);
  });

  it('carries no other map\'s region rule', () => {
    const [game] = terraGame();
    const plain = (s: Space) => !game.board.getAdjacentSpaces(s).some(Board.isOceanSpace) &&
      !game.board.getAdjacentSpaces(s).some(isSpecialTileSpace) && !isMslCuriosity(s);
    const southernBare = land(game, (s) => Board.isSouthernRegion(s) && s.bonus.length === 0 && plain(s));
    const northernRich = land(game, (s) => !Board.isSouthernRegion(s) && s.bonus.length === 2 && plain(s));
    expect(AutomaTilePlacer.breakTie(game, [southernBare, northernRich]),
      'Elysium\'s southern step is not here').eq(northernRich);
  });
});

describe('TERRA CIMMERIA + MarsBot — MSL Curiosity', () => {
  it('the hex exists only WITH Colonies — without it the board prints nothing', () => {
    const [withColonies] = terraGame({coloniesExtension: true});
    expect(mslHex(withColonies), 'the printed colony hex').is.not.undefined;
    const [without] = terraGame();
    expect(mslHex(without), '«treat this hex as empty for both MarsBot and the player»')
      .is.undefined;
  });

  it('ACTIVE: it outranks an ordinary 2-icon hex but loses to a 3-icon one', () => {
    const [game, , bot] = terraGame({coloniesExtension: true});
    bot.megaCredits = 10;
    const msl = mslHex(game)!;
    expect(botRewardIcons(game, bot, msl), 'strictly between 2 and 3').is.above(2).and.below(3);
  });

  it('INACTIVE below 5 M€: the hex is «without rewards for the purposes of tiebreakers»', () => {
    const [game, , bot] = terraGame({coloniesExtension: true});
    bot.megaCredits = 4;
    expect(botRewardIcons(game, bot, mslHex(game)!)).eq(0);
  });

  it('INACTIVE with every colony already settled: the same', () => {
    const [game, , bot] = terraGame({coloniesExtension: true});
    bot.megaCredits = 20;
    for (const colony of game.colonies) {
      colony.colonies.push(bot.id);
    }
    expect(botRewardIcons(game, bot, mslHex(game)!)).eq(0);
  });

  it('placing on an ACTIVE hex builds a colony and charges 5 M€ — never the 2 icons', () => {
    const [game, , bot] = terraGame({coloniesExtension: true});
    bot.megaCredits = 12;
    const msl = mslHex(game)!;
    const before = game.colonies.filter((c) => c.colonies.includes(bot.id)).length;
    AutomaTilePlacer.breakTie(game, [msl]); // sanity: the hex is a legal candidate
    AutomaTilePlacer.placeGreenery(game, {restrict: (s) => s === msl});

    expect(msl.tile, 'the tile went down').is.not.undefined;
    expect(game.colonies.filter((c) => c.colonies.includes(bot.id)).length,
      'and a colony came with it').eq(before + 1);
    // 12 − 5 = 7, plus whatever the colony/greenery paid on its own; the ONE
    // thing that must not happen is the 2-icon M€ payout.
    expect(bot.megaCredits, 'the 5 M€ left').is.at.most(7);
  });

  it('placing on an INACTIVE hex gains and loses NOTHING', () => {
    const [game, , bot] = terraGame({coloniesExtension: true});
    bot.megaCredits = 4; // below the 5 M€ gate
    const msl = mslHex(game)!;
    const colonies = game.colonies.filter((c) => c.colonies.includes(bot.id)).length;
    AutomaTilePlacer.placeGreenery(game, {restrict: (s) => s === msl});
    expect(msl.tile, 'the tile still went down').is.not.undefined;
    expect(bot.megaCredits, 'no payment, and no icon M€ either').eq(4);
    expect(game.colonies.filter((c) => c.colonies.includes(bot.id)).length,
      'and no colony').eq(colonies);
  });

  it('an unusable hex stays a LEGAL placement even though the human path would drop it', () => {
    const [game, , bot] = terraGame({coloniesExtension: true});
    bot.megaCredits = 0;
    const msl = mslHex(game)!;
    expect(game.board.getAvailableSpacesForGreenery(bot).includes(msl),
      'the human legality path gates on the 5 M€…').is.false;
    // …the bot's does not: «if MarsBot places on here, it doesn't gain or lose
    // anything» presumes it CAN be placed on.
    AutomaTilePlacer.placeGreenery(game, {restrict: (s) => s === msl});
    expect(msl.tile).is.not.undefined;
  });

  it('the hex never outranks ocean adjacency or special-tile adjacency', () => {
    const [game, human, bot] = terraGame({coloniesExtension: true});
    bot.megaCredits = 20;
    const msl = mslHex(game)!;
    // Ocean beats it (step 1 before step 4).
    const nextToOcean = land(game, (s) => s !== msl &&
      game.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.OCEAN));
    const oceanNeighbour = game.board.getAdjacentSpaces(nextToOcean)
      .find((a) => a.spaceType === SpaceType.OCEAN)!;
    game.simpleAddTile(bot, oceanNeighbour, {tileType: TileType.OCEAN});
    expect(AutomaTilePlacer.breakTie(game, [msl, nextToOcean]), 'oceans first').eq(nextToOcean);

    // …and so does a special-tile neighbour (step 3 before step 4).
    const nextToSpecial = land(game, (s) => s !== msl && s !== nextToOcean &&
      !game.board.getAdjacentSpaces(s).some(Board.isOceanSpace));
    const specialNeighbour = game.board.getAdjacentSpaces(nextToSpecial)
      .find((a) => a.spaceType === SpaceType.LAND && a.tile === undefined)!;
    game.simpleAddTile(human, specialNeighbour, {tileType: TileType.NUCLEAR_ZONE});
    expect(AutomaTilePlacer.breakTie(game, [msl, nextToSpecial]), 'special tiles second')
      .eq(nextToSpecial);
  });

  it('the printed colony bonus is what identifies it — no coordinate table', () => {
    const [game] = terraGame({coloniesExtension: true});
    expect(mslHex(game)!.bonus).contains(SpaceBonus.COLONY);
    expect(game.board.spaces.filter(isMslCuriosity), 'exactly one such hex').has.length(1);
  });
});

describe('TERRA CIMMERIA + MarsBot — milestones (Adding Expansions p.9)', () => {
  // The fork's canonical names: Coast Guard → Coastguard, Forester →
  // C. Forester, Financier → Fundraiser.
  it('Planetologist: Jovian/Earth + Venus COMBINED at 5', () => {
    const [game] = terraGame({venusNextExtension: true});
    setPosition(game, 'earth', 2);
    setPosition(game, 'venus', 2);
    expect(met(game, 'Planetologist'), 'combined 4 is not enough').is.false;
    setPosition(game, 'venus', 3);
    expect(met(game, 'Planetologist'), 'combined 5 clears it').is.true;
  });

  it('Planetologist without Venus Next: the absent track contributes 0', () => {
    const [game] = terraGame();
    setPosition(game, 'earth', 4);
    expect(met(game, 'Planetologist')).is.false;
    setPosition(game, 'earth', 5);
    expect(met(game, 'Planetologist'), 'the Jovian/Earth row alone can still carry it').is.true;
  });

  it('Architect: the CITY/SCIENCE track at 6, not 5', () => {
    const [game] = terraGame();
    setPosition(game, 'science', 5);
    expect(met(game, 'Architect')).is.false;
    setPosition(game, 'science', 6);
    expect(met(game, 'Architect')).is.true;
  });

  it('Forester: the BIO track at 10, not 9', () => {
    const [game] = terraGame();
    setPosition(game, 'bio', 9);
    expect(met(game, 'C. Forester')).is.false;
    setPosition(game, 'bio', 10);
    expect(met(game, 'C. Forester')).is.true;
  });

  it('Financier: the EVENT track at 10, not 9', () => {
    const [game] = terraGame();
    setPosition(game, 'event', 9);
    expect(met(game, 'Fundraiser')).is.false;
    setPosition(game, 'event', 10);
    expect(met(game, 'Fundraiser')).is.true;
  });

  it('Coast Guard: UNCHANGED — the bot\'s REAL tiles next to oceans, via the player evaluator', () => {
    const [game, , bot] = terraGame();
    expect(met(game, 'Coastguard')).is.false;
    const threshold = milestoneThreshold(milestone(game, 'Coastguard'), game)!;
    // «Adjacent to an ocean» means an ocean TILE, not a reserved ocean space —
    // at setup there are none, so the fixture has to fill them first.
    for (const space of game.board.spaces) {
      if (space.spaceType === SpaceType.OCEAN && space.tile === undefined) {
        game.simpleAddTile(bot, space, {tileType: TileType.OCEAN});
      }
    }
    let placed = 0;
    for (const space of game.board.spaces) {
      if (placed >= threshold) {
        break;
      }
      if (space.spaceType === SpaceType.LAND && space.tile === undefined &&
          game.board.getAdjacentSpaces(space).some(Board.isOceanSpace)) {
        game.simpleAddTile(bot, space, {tileType: TileType.GREENERY});
        placed++;
      }
    }
    expect(placed, 'the fixture placed what the milestone asks for').eq(threshold);
    expect(met(game, 'Coastguard'), 'the unchanged family answers with the human metric').is.true;
    expect(shown(game, 'Coastguard'), 'and its displayed score is the raw player one')
      .eq(milestone(game, 'Coastguard').getScore(bot));
  });

  it('the normalized progress and «met» never disagree', () => {
    const [game] = terraGame({venusNextExtension: true});
    for (const name of ['Planetologist', 'Architect', 'Coastguard', 'C. Forester', 'Fundraiser']) {
      const threshold = milestoneThreshold(milestone(game, name), game)!;
      for (let k = 0; k <= 12; k++) {
        for (const track of game.automa!.board.tracks) {
          track.position = Math.min(k, track.maxPosition);
        }
        expect(shown(game, name) >= threshold, `${name} @k=${k}`).eq(met(game, name));
      }
    }
  });

  it('Architect reads on the PLAYER\'s scale — track 3 of 6 shows 1 of 3 city tags', () => {
    const [game] = terraGame();
    setPosition(game, 'science', 3);
    expect(milestoneThreshold(milestone(game, 'Architect'), game)).eq(3);
    expect(shown(game, 'Architect'), 'floor(3 · 3 / 6) = 1').eq(1);
    setPosition(game, 'science', 6);
    expect(shown(game, 'Architect'), 'and it crosses exactly when the bot may claim').eq(3);
  });
});

describe('TERRA CIMMERIA + MarsBot — awards (Adding Expansions p.9)', () => {
  function score(game: IGame, name: string): number {
    return AutomaMAEvaluation.botAwardScore(award(game, name), game);
  }

  it('Electrician: the STANDALONE energy track space', () => {
    const [game] = terraGame();
    setPosition(game, 'power', 6);
    setPosition(game, 'earth', 12);
    setPosition(game, 'science', 12);
    expect(score(game, 'Electrician')).eq(6);
  });

  it('Mogul: the most-advanced track\'s space DOUBLED, and no track moves for it', () => {
    const [game] = terraGame();
    setPosition(game, 'bio', 7);
    setPosition(game, 'event', 3);
    expect(score(game, 'Mogul')).eq(14);
    expect(position(game, 'bio'), 'a read, never a mutation').eq(7);
  });

  it('Zoologist: the BIO track space + 5', () => {
    const [game] = terraGame();
    setPosition(game, 'bio', 4);
    expect(score(game, 'A. Zoologist')).eq(9);
  });

  it('Forecaster: every 7 M€ counts as one card — floor, never rounded up', () => {
    const [game, , bot] = terraGame();
    const at = (mc: number) => {
      bot.megaCredits = mc;
      return score(game, 'Forecaster');
    };
    expect(at(0)).eq(0);
    expect(at(6), '6 M€ is still zero cards').eq(0);
    expect(at(7)).eq(1);
    expect(at(13)).eq(1);
    expect(at(14)).eq(2);
    expect(at(20)).eq(2);
  });

  it('Founder: UNCHANGED for the bot — and the Neural Instance DOES count for it', () => {
    const [game, , bot] = terraGame();
    const target = land(game, () => true);
    const neighbour = game.board.getAdjacentSpaces(target)
      .find((a) => a.spaceType === SpaceType.LAND && a.tile === undefined)!;
    game.simpleAddTile(bot, target, {tileType: TileType.GREENERY});
    game.simpleAddTile(bot, neighbour, {tileType: TileType.NEURAL_INSTANCE});
    expect(score(game, 'Founder'), 'both of its tiles sit next to a special one').is.at.least(1);
  });

  it('Founder: the Neural Instance does NOT count for the HUMAN', () => {
    // «Unchanged, but the Neural Instance tile counts as a special tile for
    // MarsBot but not for you!»
    const [game, human, bot] = terraGame();
    const target = land(game, () => true);
    const neighbour = game.board.getAdjacentSpaces(target)
      .find((a) => a.spaceType === SpaceType.LAND && a.tile === undefined)!;
    game.simpleAddTile(human, target, {tileType: TileType.GREENERY});
    game.simpleAddTile(bot, neighbour, {tileType: TileType.NEURAL_INSTANCE});

    const scorer = new AwardScorer(game, award(game, 'Founder'));
    expect(scorer.get(human), 'the LNI is invisible to the human count').eq(0);

    // …while an ORDINARY special tile next to the same hex does count.
    const other = land(game, (s) => s !== target && s !== neighbour);
    const otherNeighbour = game.board.getAdjacentSpaces(other)
      .find((a) => a.spaceType === SpaceType.LAND && a.tile === undefined)!;
    game.simpleAddTile(human, other, {tileType: TileType.GREENERY});
    game.simpleAddTile(human, otherNeighbour, {tileType: TileType.NUCLEAR_ZONE});
    expect(new AwardScorer(game, award(game, 'Founder')).get(human)).is.at.least(1);
  });

  it('Venuphile: the Venus track space, when Venus is in play', () => {
    const [game] = terraGame({venusNextExtension: true});
    setPosition(game, 'venus', 5);
    expect(score(game, 'Venuphile')).eq(5);
  });

  it('the funding decision compares against the best HUMAN (multiplayer)', () => {
    const [game, humans, bot] = testAutomaMultiplayerGame(3, TERRA, '-tc-mp');
    setPosition(game, 'power', 4);
    const scorer = new AwardScorer(game, award(game, 'Electrician'));
    expect(scorer.get(bot)).eq(4);
    for (const human of humans) {
      expect(scorer.get(human), 'no human has power tags yet').eq(0);
    }
  });
});

describe('TERRA CIMMERIA + MarsBot — B12 Corporate Competition', () => {
  function fund(game: IGame, human: IPlayer, name: string) {
    game.fundAward(human, award(game, name));
  }

  const B12 = BonusCardId.B12_CORPORATE_COMPETITION_CIMMERIA;

  it('under 5 M€ the card does nothing', () => {
    const [game, human, bot] = terraGame();
    fund(game, human, 'Electrician');
    bot.megaCredits = 4;
    expect(resolve(game, B12)).eq('discard');
    expect(bot.megaCredits).eq(4);
    expect(position(game, 'power')).eq(0);
  });

  it('Electrician advances the ENERGY track and costs exactly 5 M€', () => {
    const [game, human, bot] = terraGame();
    fund(game, human, 'Electrician');
    setPosition(game, 'power', 1); // land on space 2, which is empty
    bot.megaCredits = 6;
    resolve(game, B12);
    expect(position(game, 'power')).eq(2);
    expect(bot.megaCredits).eq(1);
  });

  it('Electrician on a maxed track is impossible — the card falls through', () => {
    const [game, human, bot] = terraGame();
    fund(game, human, 'Electrician');
    setPosition(game, 'power', 18);
    bot.megaCredits = 9;
    game.automa!.bonusDeck = [];
    game.automa!.bonusDiscard = [];
    resolve(game, B12);
    expect(bot.megaCredits, 'nothing was helped, so nothing was paid').eq(9);
  });

  it('Zoologist advances the BIO track through the ordinary tag-style pipeline', () => {
    const [game, human, bot] = terraGame();
    fund(game, human, 'A. Zoologist');
    setPosition(game, 'bio', 1); // land on 2, which is empty
    bot.megaCredits = 6;
    resolve(game, B12);
    expect(position(game, 'bio')).eq(2);
    expect(bot.megaCredits).eq(1);
  });

  it('Mogul advances the most-advanced track, and its landed action chains', () => {
    const [game, human, bot] = terraGame();
    fund(game, human, 'Mogul');
    setPosition(game, 'event', 8);
    setPosition(game, 'bio', 3);
    bot.megaCredits = 6;
    resolve(game, B12);
    expect(position(game, 'event'), 'the event row was furthest along').eq(9);
    expect(bot.megaCredits, 'the tr3 it landed on pays TR, not M€').eq(1);
  });

  it('Mogul ties go to the TOPMOST track — the map profile\'s printed row order', () => {
    const [game, human, bot] = terraGame();
    fund(game, human, 'Mogul');
    // Building (row 0) and Bio (row 6) are equally advanced.
    setPosition(game, 'building', 2);
    setPosition(game, 'bio', 2);
    bot.megaCredits = 6;
    resolve(game, B12);
    expect(position(game, 'building'), 'the topmost of the tied tracks moved').eq(3);
    expect(position(game, 'bio'), 'and the lower one did not').eq(2);
  });

  it('Founder places a city ADJACENT TO A SPECIAL TILE', () => {
    const [game, human, bot] = terraGame();
    const special = land(game, () => true);
    game.simpleAddTile(human, special, {tileType: TileType.NUCLEAR_ZONE});
    fund(game, human, 'Founder');
    bot.megaCredits = 6;
    resolve(game, B12);
    const cities = game.board.spaces.filter((s) => Board.isCitySpace(s) && Board.spaceOwnedBy(s, bot));
    expect(cities, 'exactly one city went down').has.length(1);
    expect(game.board.getAdjacentSpaces(cities[0]).some(isSpecialTileSpace),
      'and it is next to a special tile').is.true;
  });

  it('Founder counts the NEURAL INSTANCE as a special tile', () => {
    const [game, human, bot] = terraGame();
    const lni = land(game, () => true);
    game.simpleAddTile(bot, lni, {tileType: TileType.NEURAL_INSTANCE});
    fund(game, human, 'Founder');
    bot.megaCredits = 6;
    resolve(game, B12);
    const cities = game.board.spaces.filter((s) => Board.isCitySpace(s) && Board.spaceOwnedBy(s, bot));
    expect(cities).has.length(1);
    expect(game.board.getAdjacentSpaces(cities[0]).some((s) => s.tile?.tileType === TileType.NEURAL_INSTANCE))
      .is.true;
  });

  it('Founder with NO special tile on the board is impossible — never a plain city', () => {
    const [game, human, bot] = terraGame();
    fund(game, human, 'Founder');
    bot.megaCredits = 6;
    game.automa!.bonusDeck = [];
    game.automa!.bonusDiscard = [];
    resolve(game, B12);
    expect(game.board.spaces.filter((s) => Board.isCitySpace(s) && Board.spaceOwnedBy(s, bot)),
      'no city was placed anywhere').is.empty;
    expect(bot.megaCredits, 'and nothing was paid').eq(6);
  });

  it('Forecaster reveals until a card WITH REQUIREMENTS and resolves it', () => {
    const [game, human, bot] = terraGame();
    fund(game, human, 'Forecaster');
    bot.megaCredits = 6;
    // Drawn in reverse push order: Artificial Lake (a temperature requirement)
    // is found after Mine (no requirement at all) is rejected.
    game.projectDeck.drawPile.push(new ArtificialLake());
    game.projectDeck.drawPile.push(new Mine());
    expect(new Mine().requirements, 'the fixture: Mine has no requirement').is.empty;
    expect(new ArtificialLake().requirements, 'and Artificial Lake has one').is.not.empty;
    resolve(game, B12);

    expect(game.automa!.playedPile, 'the requirement card was resolved').contains(CardName.ARTIFICIAL_LAKE);
    expect(game.projectDeck.discardPile.map((c) => c.name), 'the rejected one was discarded')
      .contains(CardName.MINE);
  });

  it('⚠️ Forecaster GAINS 5 M€ and the card NEVER charges its own 5', () => {
    // «Resolve it, and MarsBot gains 5 MC» + the Adding Expansions note that
    // this option does not cost MarsBot 5 MC. The net is +5, and — the part
    // that matters for the journal, the stats and any replay — the payment
    // event does not happen at all, rather than being cancelled out.
    const [game, human, bot] = terraGame();
    fund(game, human, 'Forecaster');
    bot.megaCredits = 6;
    game.projectDeck.drawPile.push(new ArtificialLake()); // cost 15, building tag
    const logsBefore = game.gameLog.length;
    resolve(game, B12);

    expect(bot.megaCredits, '6 + 5, with no −5 anywhere').eq(11);
    const lines = game.gameLog.slice(logsBefore).map((l) => l.message);
    expect(lines.some((m) => m.includes('lost') && m.includes('M€')),
      'no Corporate Competition payment was ever logged').is.false;
  });

  it('Forecaster with no requirement card left in the deck is impossible', () => {
    const [game, human, bot] = terraGame();
    fund(game, human, 'Forecaster');
    bot.megaCredits = 6;
    game.projectDeck.drawPile.length = 0;
    game.projectDeck.discardPile.length = 0;
    game.automa!.bonusDeck = [];
    game.automa!.bonusDiscard = [];
    resolve(game, B12);
    expect(bot.megaCredits, 'no reward, and no payment').eq(6);
  });

  it('Venuphile advances the Venus track (added to every version of the card)', () => {
    const [game, human, bot] = terraGame({venusNextExtension: true});
    fund(game, human, 'Venuphile');
    bot.megaCredits = 6;
    resolve(game, B12);
    expect(position(game, 'venus')).is.at.least(1);
    expect(bot.megaCredits).eq(1);
  });

  it('no funded award → no payment, and the fallback bonus card resolves', () => {
    const [game, , bot] = terraGame();
    bot.megaCredits = 9;
    game.automa!.bonusDeck = [{kind: 'bonus', id: BonusCardId.B03_RESEARCH_AND_DEVELOPMENT}];
    resolve(game, B12);
    expect(bot.megaCredits).eq(9);
    expect(game.automa!.bonusDeck, 'the fallback card was drawn').is.empty;
  });

  it('the closest funded award being impossible falls through to the next one', () => {
    const [game, human, bot] = terraGame();
    // Electrician is leftmost and impossible (maxed); Zoologist is next.
    setPosition(game, 'power', 18);
    setPosition(game, 'bio', 1);
    fund(game, human, 'Electrician');
    fund(game, human, 'A. Zoologist');
    bot.megaCredits = 6;
    resolve(game, B12);
    expect(position(game, 'bio'), 'the SECOND award was helped').eq(2);
    expect(bot.megaCredits, 'and 5 M€ left exactly once').eq(1);
  });
});

describe('TERRA CIMMERIA + MarsBot — a real game runs', () => {
  it('resolves 30 track advances with Venus + Colonies + Prelude without a dead end', () => {
    const [game] = terraGame({
      venusNextExtension: true,
      coloniesExtension: true,
      preludeExtension: true,
      corporation: 'random',
    });
    for (let i = 0; i < 30; i++) {
      expect(() => AutomaResolver.advanceTrack(game, i % 7)).does.not.throw();
    }
    expect(game.automa!.board.tracks.every((t) => t.position <= t.maxPosition)).is.true;
  });
});

describe('TERRA CIMMERIA + MarsBot — what the client and the endgame receive', () => {
  it('the server model carries the TERRA cells and tag pairings', () => {
    const [game] = terraGame();
    const model = Server.getGameModel(game).automa!;
    expect(model.tracks).has.length(7);
    const science = model.tracks[trackIndex(game, 'science')];
    expect(science.tags, 'the Turn Review labels this row City + Science').deep.eq([Tag.CITY, Tag.SCIENCE]);
    expect(science.layout[7], 'and its printed Event tag icon reaches the client').eq('tag_2');
    const earth = model.tracks[trackIndex(game, 'earth')];
    expect(earth.tags).deep.eq([Tag.JOVIAN, Tag.EARTH]);
    expect(earth.layout[2], 'the mini-scale shows THIS map\'s cells').eq('floater');
    const power = model.tracks[trackIndex(game, 'power')];
    expect(power.tags, 'Energy stands alone').deep.eq([Tag.POWER]);
    expect(power.layout[7], 'and its space 7 is an AWARD here, not a milestone').eq('award');
  });

  it('round-trips through the map profile: only the map NAME is stored', () => {
    const [game] = terraGame({coloniesExtension: true});
    setPosition(game, 'science', 7);
    setPosition(game, 'earth', 2);
    const serialized = game.automa!.serialize();
    const restored = AutomaState.deserialize(serialized, game.gameOptions);
    expect(restored.board.getTrackOfRole('science')!.position).eq(7);
    expect(restored.board.getTrackOfRole('earth')!.position).eq(2);
    expect(restored.board.getTrackOfRole('science')!.definition.layout[7],
      'the layout comes back from the profile').eq('tag_2');
    expect(restored.board.getTrackIndexForTag(Tag.CITY),
      'with Terra Cimmeria\'s own tag pairing').eq(restored.board.trackIndexOfRoleOrThrow('science'));
  });
});
