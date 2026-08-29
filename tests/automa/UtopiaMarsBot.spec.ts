import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {BonusCardId, MarsBotTrackRole} from '../../src/common/automa/AutomaTypes';
import {CardName} from '../../src/common/cards/CardName';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {Resource} from '../../src/common/Resource';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {Tag} from '../../src/common/cards/Tag';
import {TileType} from '../../src/common/TileType';
import {AwardScorer} from '../../src/server/awards/AwardScorer';
import {Board} from '../../src/server/boards/Board';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Space} from '../../src/server/boards/Space';
import {AutomaMAEvaluation} from '../../src/server/automa/AutomaMAEvaluation';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {AutomaSetup} from '../../src/server/automa/AutomaSetup';
import {AutomaState} from '../../src/server/automa/AutomaState';
import {AutomaTilePlacer} from '../../src/server/automa/AutomaTilePlacer';
import {Server} from '../../src/server/models/ServerModel';
import {AutomaTurnLog} from '../../src/server/automa/AutomaTurnLog';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {Algae} from '../../src/server/cards/base/Algae';
import {ArtificialLake} from '../../src/server/cards/base/ArtificialLake';
import {TowingAComet} from '../../src/server/cards/base/TowingAComet';
import {milestoneThreshold} from '../../src/server/milestones/IMilestone';
import {testAutomaGame, testAutomaMultiplayerGame} from './AutomaTestGame';

const UTOPIA = {boardName: BoardName.UTOPIA_PLANITIA} as const;

function utopiaGame(options?: object): [IGame, ReturnType<typeof testAutomaGame>[1], IPlayer] {
  return testAutomaGame({...UTOPIA, ...options});
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
  expect(found, `Utopia milestone ${name}`).is.not.undefined;
  return found!;
}

function award(game: IGame, name: string) {
  const found = game.awards.find((a) => a.name === name);
  expect(found, `Utopia award ${name}`).is.not.undefined;
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

describe('UTOPIA PLANITIA + MarsBot — setup', () => {
  it('is playable: the compatibility guard lets Utopia Planitia through', () => {
    const [game] = utopiaGame();
    expect(game.gameOptions.boardName).eq(BoardName.UTOPIA_PLANITIA);
    expect(game.automa).is.not.undefined;
  });

  it('uses the UTOPIA board — Jovian rides Power, Science stands alone', () => {
    const [game] = utopiaGame();
    const board = game.automa!.board;
    expect(board.getTrackIndexForTag(Tag.JOVIAN)).eq(trackIndex(game, 'power'));
    expect(board.getTrackIndexForTag(Tag.POWER)).eq(trackIndex(game, 'power'));
    expect(board.getTrackIndexForTag(Tag.SCIENCE)).eq(trackIndex(game, 'science'));
    expect(board.getTrackOfRole('science')!.definition.tags, 'Science alone').deep.eq([Tag.SCIENCE]);
    expect(board.getTrackOfRole('power')!.definition.tags).deep.eq([Tag.POWER, Tag.JOVIAN]);
    expect(board.getTrackOfRole('earth')!.definition.tags).deep.eq([Tag.EARTH, Tag.CITY]);
  });

  it('builds the bonus deck with B11, never B08/B09/B10 (Setup Guide v1.3 step 18)', () => {
    const deck = AutomaSetup.bonusDeckContents({boardName: BoardName.UTOPIA_PLANITIA} as never);
    expect(deck).contains(BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA);
    expect(deck).does.not.contain(BonusCardId.B08_CORPORATE_COMPETITION);
    expect(deck).does.not.contain(BonusCardId.B09_CORPORATE_COMPETITION_HELLAS);
    expect(deck).does.not.contain(BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM);
  });

  it('appends the Venus track as the 8th, leaving the 7 map tracks in place', () => {
    const [game] = utopiaGame({venusNextExtension: true});
    expect(game.automa!.board.tracks).has.length(8);
    expect(game.automa!.board.trackIndexOfRoleOrThrow('venus')).eq(7);
  });
});

describe('UTOPIA PLANITIA + MarsBot — tag → track resolution', () => {
  function resolveTag(game: IGame, tag: Tag): void {
    AutomaResolver.advanceTrack(game, game.automa!.board.getTrackIndexForTag(tag)!);
  }

  it('a Jovian tag advances the Jovian/Energy track — NOT science', () => {
    const [game] = utopiaGame();
    resolveTag(game, Tag.JOVIAN);
    expect(position(game, 'power')).is.at.least(1);
    expect(position(game, 'science')).eq(0);
  });

  it('an Energy tag advances the SAME track', () => {
    const [game] = utopiaGame();
    resolveTag(game, Tag.POWER);
    expect(position(game, 'power')).is.at.least(1);
  });

  it('a Science tag advances the separate Science track', () => {
    const [game] = utopiaGame();
    resolveTag(game, Tag.SCIENCE);
    // Space 1 is a printed «advance», so one tag legitimately carries the
    // marker to 2 — the chain is the board's, not a double resolution.
    expect(position(game, 'science')).eq(2);
    expect(position(game, 'power'), 'and Jovian/Energy never moved').eq(0);
  });

  it('Earth and City share one track; Plant/Animal/Microbe share another', () => {
    const [game] = utopiaGame();
    const board = game.automa!.board;
    expect(board.getTrackIndexForTag(Tag.EARTH)).eq(trackIndex(game, 'earth'));
    expect(board.getTrackIndexForTag(Tag.CITY)).eq(trackIndex(game, 'earth'));
    for (const tag of [Tag.PLANT, Tag.ANIMAL, Tag.MICROBE] as const) {
      expect(board.getTrackIndexForTag(tag), `${tag}`).eq(trackIndex(game, 'bio'));
    }
  });

  it('a Building tag advances Building; a Space tag advances Space; an Event tag Event', () => {
    const [game] = utopiaGame();
    const board = game.automa!.board;
    expect(board.getTrackIndexForTag(Tag.BUILDING)).eq(trackIndex(game, 'building'));
    expect(board.getTrackIndexForTag(Tag.SPACE)).eq(trackIndex(game, 'space'));
    expect(board.getTrackIndexForTag(Tag.EVENT)).eq(trackIndex(game, 'event'));
  });
});

describe('UTOPIA PLANITIA + MarsBot — production regression follows the printed badges', () => {
  const cases: ReadonlyArray<[Resource, MarsBotTrackRole]> = [
    [Resource.STEEL, 'building'],
    [Resource.TITANIUM, 'space'],
    [Resource.MEGACREDITS, 'event'],
    [Resource.ENERGY, 'power'], // Jovian + Energy
    [Resource.HEAT, 'earth'], // Earth + City
    [Resource.PLANTS, 'bio'],
  ];
  for (const [resource, role] of cases) {
    it(`decreasing ${resource} production regresses the ${role} track`, () => {
      const [game] = utopiaGame();
      expect(game.automa!.board.getTrackIndexForProduction(resource)).eq(trackIndex(game, role));
    });
  }

  it('the Science track carries no production badge, so nothing regresses it', () => {
    const [game] = utopiaGame();
    const science = trackIndex(game, 'science');
    for (const resource of cases.map(([r]) => r)) {
      expect(game.automa!.board.getTrackIndexForProduction(resource), `${resource}`).not.eq(science);
    }
    expect(game.automa!.board.getTrackOfRole('science')!.definition.productions).is.empty;
  });
});

describe('UTOPIA PLANITIA + MarsBot — the «Place a Colony» track cell', () => {
  /** Land the marker on space track 5 — the printed colony cell. */
  function landOnColonyCell(game: IGame): void {
    setPosition(game, 'space', 4);
    AutomaResolver.advanceTrack(game, trackIndex(game, 'space'));
  }

  it('builds a colony through the ORDINARY bot pipeline', () => {
    const [game, , bot] = utopiaGame({coloniesExtension: true});
    const before = game.colonies.filter((c) => c.colonies.includes(bot.id)).length;
    landOnColonyCell(game);
    expect(position(game, 'space'), 'the marker rests on the printed cell').eq(5);
    const after = game.colonies.filter((c) => c.colonies.includes(bot.id));
    expect(after, 'exactly one colony was built').has.length(before + 1);
    // «It ignores the printed reward of the tile, and instead gains 2 resources
    // into the storage area» — the pipeline's own consequence, not a re-write.
    const built = after[0];
    if (built.name !== ColonyName.EUROPA) {
      const stored = game.automa!.shippingStorage[built.name] ?? 0;
      const floaters = game.automa!.floaters;
      expect(stored + floaters, 'the 2 storage resources arrived').is.at.least(2);
    }
  });

  it('with every eligible tile taken it is a Failed Action, not a silent no-op', () => {
    const [game, , bot] = utopiaGame({coloniesExtension: true});
    // Fill every colony so nothing is eligible.
    for (const colony of game.colonies) {
      while (!colony.isFull()) {
        colony.colonies.push(bot.id);
      }
    }
    const before = bot.megaCredits;
    landOnColonyCell(game);
    expect(bot.megaCredits, 'the Failed Action paid its 5 M€').eq(before + 5);
  });

  it('WITHOUT Colonies the icon is ignored — no colony, and no Failed Action', () => {
    const [game, , bot] = utopiaGame();
    const before = bot.megaCredits;
    landOnColonyCell(game);
    expect(bot.megaCredits, 'an unused-expansion icon costs nothing (rulebook p.7)').eq(before);
    expect(position(game, 'space')).eq(5);
  });

  it('the review records the landing on the colony cell with its printed action', () => {
    const [game] = utopiaGame({coloniesExtension: true});
    AutomaTurnLog.begin(game); // the real bootstrap — snapshots included
    landOnColonyCell(game);
    const steps = game.automa!.turnRecording!.steps;
    const advance = steps.find((s) => s.kind === 'advance' && s.to === 5);
    expect(advance, 'the advance onto space 5 was recorded').is.not.undefined;
    expect((advance as {action?: string}).action, 'named by its printed icon').eq('colony');
  });
});

describe('UTOPIA PLANITIA + MarsBot — the Venus tag cell on the building track', () => {
  /** Land the marker on building 11 — the printed Venus tag icon. */
  function landOnVenusTagCell(game: IGame): void {
    setPosition(game, 'building', 10);
    AutomaResolver.advanceTrack(game, trackIndex(game, 'building'));
  }

  it('advances the VENUS track when Venus Next is in play', () => {
    const [game] = utopiaGame({venusNextExtension: true});
    landOnVenusTagCell(game);
    expect(position(game, 'building')).eq(11);
    expect(position(game, 'venus'), 'the circular tag icon advanced the Venus track').eq(1);
  });

  it('is ignored WITHOUT Venus Next — no crash, no Failed Action', () => {
    const [game, , bot] = utopiaGame();
    const before = bot.megaCredits;
    expect(() => landOnVenusTagCell(game), 'a tag pointing at an absent track never throws').does.not.throw();
    expect(position(game, 'building')).eq(11);
    expect(bot.megaCredits, 'an unused-expansion icon costs nothing (rulebook p.7)').eq(before);
  });
});

describe('UTOPIA PLANITIA + MarsBot — milestones (Adding Expansions p.9)', () => {
  // The fork's canonical names for this board's slots: the reference card's
  // Specialist / Trader / Metallurgist are Land Specialist / Tradesman / Smith.
  it('Specialist: 3 or more DESTROYED bonus cards', () => {
    const [game] = utopiaGame();
    game.automa!.destroyedBonusCards = [
      BonusCardId.B04_OVERACHIEVEMENT, BonusCardId.B05_EXPEDITED_CONSTRUCTION];
    expect(met(game, 'Land Specialist'), '2 destroyed is not enough').is.false;
    game.automa!.destroyedBonusCards.push(BonusCardId.B07_LOCAL_NEURAL_INSTANCE);
    expect(met(game, 'Land Specialist')).is.true;
  });

  it('Specialist reads the DESTROYED pile, never the discard', () => {
    const [game] = utopiaGame();
    game.automa!.bonusDiscard = [
      BonusCardId.B01_METEOR_SHOWER, BonusCardId.B02_INVASIVE_SPECIES, BonusCardId.B03_RESEARCH_AND_DEVELOPMENT];
    expect(met(game, 'Land Specialist'), 'a discarded card is not a destroyed one').is.false;
  });

  it('Trader: ALL of Jovian/Energy, Earth/City and Venus at 2', () => {
    const [game] = utopiaGame({venusNextExtension: true});
    setPosition(game, 'power', 2);
    setPosition(game, 'earth', 2);
    setPosition(game, 'venus', 1);
    expect(met(game, 'Tradesman'), 'one of the three short → not met').is.false;
    setPosition(game, 'venus', 2);
    expect(met(game, 'Tradesman')).is.true;
  });

  it('Trader names THOSE three tracks — a soaring science track never stands in', () => {
    const [game] = utopiaGame({venusNextExtension: true});
    setPosition(game, 'power', 2);
    setPosition(game, 'earth', 1);
    setPosition(game, 'venus', 12);
    setPosition(game, 'science', 18);
    setPosition(game, 'building', 18);
    expect(met(game, 'Tradesman')).is.false;
  });

  it('Trader without Venus Next is honestly unreachable — the track is not in play', () => {
    const [game] = utopiaGame();
    setPosition(game, 'power', 18);
    setPosition(game, 'earth', 18);
    expect(met(game, 'Tradesman')).is.false;
    expect(shown(game, 'Tradesman'), 'and it reads 0, not a false near-miss').eq(0);
  });

  it('Metallurgist: Building + Space COMBINED at 7 (the rulebook, not the stale board aid\'s 5)', () => {
    const [game] = utopiaGame();
    setPosition(game, 'building', 3);
    setPosition(game, 'space', 3);
    expect(met(game, 'Smith'), 'combined 6 is not enough').is.false;
    setPosition(game, 'space', 4);
    expect(met(game, 'Smith'), 'combined 7 clears it').is.true;
  });

  it('Metallurgist counts BOTH tracks — 7 on one alone also clears it', () => {
    const [game] = utopiaGame();
    setPosition(game, 'building', 7);
    expect(met(game, 'Smith')).is.true;
  });

  it('Researcher: the SCIENCE track at 4, not 3', () => {
    const [game] = utopiaGame();
    setPosition(game, 'science', 3);
    expect(met(game, 'Researcher')).is.false;
    setPosition(game, 'science', 4);
    expect(met(game, 'Researcher')).is.true;
  });

  it('Researcher reads Science, never the Jovian/Energy track', () => {
    const [game] = utopiaGame();
    setPosition(game, 'power', 18);
    expect(met(game, 'Researcher')).is.false;
  });

  it('Pioneer: UNCHANGED — the bot\'s REAL colonies, through the player evaluator', () => {
    const [game, , bot] = utopiaGame({coloniesExtension: true});
    expect(met(game, 'Pioneer')).is.false;
    for (let i = 0; i < 3; i++) {
      game.colonies[i].colonies.push(bot.id);
    }
    expect(bot.getColoniesCount()).eq(3);
    expect(met(game, 'Pioneer'), 'the unchanged family answers with the human metric').is.true;
  });

  it('the normalized progress and «met» never disagree', () => {
    const [game] = utopiaGame({venusNextExtension: true});
    for (const name of ['Land Specialist', 'Tradesman', 'Smith', 'Researcher', 'Pioneer']) {
      const m = milestone(game, name);
      const threshold = milestoneThreshold(m, game)!;
      for (let k = 0; k <= 10; k++) {
        game.automa!.destroyedBonusCards = new Array(k).fill(BonusCardId.B04_OVERACHIEVEMENT);
        for (const track of game.automa!.board.tracks) {
          track.position = Math.min(k, track.maxPosition);
        }
        expect(shown(game, name) >= threshold, `${name} @k=${k}`).eq(met(game, name));
      }
    }
  });

  it('Metallurgist reads on the PLAYER\'s scale — combined 4 of 7 shows 3 of 6', () => {
    // Smith's printed threshold is 6 (steel + titanium production); the bot's
    // is a combined 7. floor(4 · 6 / 7) = 3.
    const [game] = utopiaGame();
    setPosition(game, 'building', 4);
    expect(milestoneThreshold(milestone(game, 'Smith'), game)).eq(6);
    expect(shown(game, 'Smith')).eq(3);
    setPosition(game, 'building', 7);
    expect(shown(game, 'Smith'), 'and it crosses exactly when the bot may claim').eq(6);
  });
});

describe('UTOPIA PLANITIA + MarsBot — awards (Adding Expansions p.9)', () => {
  function score(game: IGame, name: string): number {
    return AutomaMAEvaluation.botAwardScore(award(game, name), game);
  }

  it('Suburban: unchanged — the bot\'s REAL tiles on the board edge', () => {
    const [game, , bot] = utopiaGame();
    const edge = game.board.getEdges().find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;
    game.simpleAddTile(bot, edge, {tileType: TileType.GREENERY});
    expect(score(game, 'Edgedancer')).eq(1);
    expect(new AwardScorer(game, award(game, 'Edgedancer')).get(bot),
      'the endgame scorer reads the same number').eq(1);
  });

  it('Investor: the EARTH/CITY track space', () => {
    const [game] = utopiaGame();
    setPosition(game, 'earth', 6);
    expect(score(game, 'Investor')).eq(6);
  });

  it('Botanist: the BIO track space MINUS 2, and the track itself never moves', () => {
    const [game] = utopiaGame();
    setPosition(game, 'bio', 5);
    expect(score(game, 'Botanist')).eq(3);
    expect(position(game, 'bio'), 'the handicap is evaluation-only').eq(5);
  });

  it('Incorporator: cards costing 10 M€ or less in the played pile — EVENTS INCLUDED', () => {
    const [game] = utopiaGame();
    // Algae (10, green) qualifies exactly; Towing a Comet (23) does not.
    game.automa!.playedPile.push(CardName.ALGAE, CardName.TOWING_A_COMET);
    expect(score(game, 'Incorporator'), '10 exactly qualifies').eq(1);
    // A RED event at 5 M€ — the human's own award filters events out entirely.
    game.automa!.playedPile.push(CardName.CONSCRIPTION);
    expect(score(game, 'Incorporator'), 'the bot counts events unlike the human').eq(2);
  });

  it('Metropolist: unchanged — the bot\'s REAL cities', () => {
    const [game, , bot] = utopiaGame();
    const space = land(game, () => true);
    game.simpleAddTile(bot, space, {tileType: TileType.CITY});
    expect(score(game, 'Metropolist')).eq(1);
  });

  it('Venuphile: the Venus track space, when Venus is in play', () => {
    const [game] = utopiaGame({venusNextExtension: true});
    setPosition(game, 'venus', 4);
    expect(score(game, 'Venuphile')).eq(4);
  });

  it('the funding decision compares against the best HUMAN (multiplayer)', () => {
    const [game, humans, bot] = testAutomaMultiplayerGame(3, UTOPIA, '-uto-mp');
    setPosition(game, 'earth', 3);
    const scorer = new AwardScorer(game, award(game, 'Investor'));
    expect(scorer.get(bot)).eq(3);
    for (const human of humans) {
      expect(scorer.get(human), 'no human has Earth tags yet').eq(0);
    }
  });
});

describe('UTOPIA PLANITIA + MarsBot — B11 Corporate Competition', () => {
  function fund(game: IGame, human: IPlayer, name: string) {
    game.fundAward(human, award(game, name));
  }

  it('under 5 M€ the card does nothing', () => {
    const [game, human, bot] = utopiaGame();
    fund(game, human, 'Investor');
    bot.megaCredits = 4;
    expect(resolve(game, BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA)).eq('discard');
    expect(bot.megaCredits).eq(4);
    expect(position(game, 'earth')).eq(0);
  });

  it('Investor advances the EARTH/CITY track and costs exactly 5 M€', () => {
    const [game, human, bot] = utopiaGame();
    fund(game, human, 'Investor');
    // From space 1 the helper lands on 2, which is empty — so the only M€ that
    // moves is the card's own 5. (From 0 it would land on the printed city,
    // whose covered icons pay the bot back and hide the payment.)
    setPosition(game, 'earth', 1);
    bot.megaCredits = 6;
    resolve(game, BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA);
    expect(position(game, 'earth')).eq(2);
    expect(bot.megaCredits).eq(1);
  });

  it('Botanist advances the BIO track', () => {
    const [game, human, bot] = utopiaGame();
    fund(game, human, 'Botanist');
    bot.megaCredits = 6;
    resolve(game, BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA);
    expect(position(game, 'bio')).is.at.least(1);
    expect(bot.megaCredits).eq(1);
  });

  it('Suburban places a greenery ON THE EDGE and raises oxygen', () => {
    const [game, human, bot] = utopiaGame();
    fund(game, human, 'Edgedancer');
    bot.megaCredits = 6;
    const oxygen = game.getOxygenLevel();
    resolve(game, BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA);
    const greeneries = game.board.spaces.filter((s) =>
      Board.isGreenerySpace(s) && Board.spaceOwnedBy(s, bot));
    expect(greeneries, 'exactly one greenery went down').has.length(1);
    expect(game.board.isEdge(greeneries[0]), 'and it is on the board EDGE').is.true;
    expect(game.getOxygenLevel(), 'oxygen rose 1 step').eq(oxygen + 1);
  });

  it('Suburban with no legal EDGE greenery is impossible — never an inland fallback', () => {
    const [game, human, bot] = utopiaGame();
    fund(game, human, 'Edgedancer');
    bot.megaCredits = 6;
    // Occupy every empty land space on the edge, leaving inland ones free.
    for (const space of game.board.getEdges()) {
      if (space.spaceType === SpaceType.LAND && space.tile === undefined) {
        game.simpleAddTile(human, space, {tileType: TileType.CITY});
      }
    }
    // Empty both bonus piles so the fallback draw finds nothing and cannot
    // move money of its own — this test is about the HELPER, not the fallback.
    game.automa!.bonusDeck = [];
    game.automa!.bonusDiscard = [];
    const before = game.board.spaces.filter((s) => Board.spaceOwnedBy(s, bot)).length;
    resolve(game, BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA);
    expect(game.board.spaces.filter((s) => Board.spaceOwnedBy(s, bot)).length,
      'the bot placed nothing at all').eq(before);
    expect(bot.megaCredits, 'and paid nothing — the helper was impossible').eq(6);
  });

  it('Incorporator reveals until a card costing 10 M€ OR LESS and resolves it', () => {
    const [game, human, bot] = utopiaGame();
    fund(game, human, 'Incorporator');
    bot.megaCredits = 6;
    // Drawn in reverse push order: Towing a Comet (23) → Artificial Lake (15) → Algae (10).
    game.projectDeck.drawPile.push(new Algae());
    game.projectDeck.drawPile.push(new ArtificialLake());
    game.projectDeck.drawPile.push(new TowingAComet());
    resolve(game, BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA);

    expect(game.automa!.playedPile, 'the ≤10 card was resolved').contains(CardName.ALGAE);
    const discards = game.projectDeck.discardPile.map((c) => c.name);
    expect(discards, 'every rejected card was discarded').contains(CardName.TOWING_A_COMET);
    expect(discards).contains(CardName.ARTIFICIAL_LAKE);
    expect(bot.megaCredits).eq(1);
  });

  it('Incorporator: a card costing EXACTLY 10 qualifies, and its tags resolve normally', () => {
    const [game, human, bot] = utopiaGame();
    fund(game, human, 'Incorporator');
    bot.megaCredits = 6;
    game.projectDeck.drawPile.push(new Algae()); // cost 10, plant tag
    resolve(game, BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA);
    expect(game.automa!.playedPile).contains(CardName.ALGAE);
    expect(position(game, 'bio'), 'its plant tag advanced the bio track').is.at.least(1);
  });

  it('Metropolist places a city through the common pipeline', () => {
    const [game, human, bot] = utopiaGame();
    fund(game, human, 'Metropolist');
    bot.megaCredits = 6;
    resolve(game, BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA);
    const cities = game.board.spaces.filter((s) => Board.isCitySpace(s) && Board.spaceOwnedBy(s, bot));
    expect(cities, 'exactly one city went down').has.length(1);
    // The tile rode the ORDINARY pipeline, so it also collected the hex's
    // printed rewards as 1 M€ apiece — the card's 5 is what left on top.
    expect(bot.megaCredits).eq(6 - 5 + cities[0].bonus.length);
  });

  it('Venuphile advances the Venus track (added to every version of the card)', () => {
    const [game, human, bot] = utopiaGame({venusNextExtension: true});
    fund(game, human, 'Venuphile');
    bot.megaCredits = 6;
    resolve(game, BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA);
    expect(position(game, 'venus')).is.at.least(1);
    expect(bot.megaCredits).eq(1);
  });

  it('no funded award → no payment, and the fallback bonus card resolves', () => {
    const [game, , bot] = utopiaGame();
    bot.megaCredits = 9;
    game.automa!.bonusDeck = [{kind: 'bonus', id: BonusCardId.B03_RESEARCH_AND_DEVELOPMENT}];
    resolve(game, BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA);
    expect(bot.megaCredits, 'nothing was helped, so nothing was paid').eq(9);
    expect(game.automa!.bonusDeck, 'the fallback card was drawn').is.empty;
  });

  it('the closest funded award being impossible falls through to the next one, paying 5 once', () => {
    const [game, human, bot] = utopiaGame();
    // Edgedancer is leftmost of the two, and impossible: no empty edge land.
    for (const space of game.board.getEdges()) {
      if (space.spaceType === SpaceType.LAND && space.tile === undefined) {
        game.simpleAddTile(human, space, {tileType: TileType.CITY});
      }
    }
    fund(game, human, 'Edgedancer');
    fund(game, human, 'Investor');
    setPosition(game, 'earth', 1); // land on the empty space 2 — see the Investor test
    bot.megaCredits = 6;
    resolve(game, BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA);
    expect(position(game, 'earth'), 'the SECOND award was helped').eq(2);
    expect(bot.megaCredits, 'and 5 M€ left exactly once').eq(1);
  });

  it('every helper impossible → fallback, still no payment', () => {
    const [game, human, bot] = utopiaGame();
    fund(game, human, 'Investor');
    bot.megaCredits = 9;
    game.automa!.board.getTrackOfRole('earth')!.position = 18; // maxed: cannot advance
    game.automa!.bonusDeck = [{kind: 'bonus', id: BonusCardId.B03_RESEARCH_AND_DEVELOPMENT}];
    resolve(game, BonusCardId.B11_CORPORATE_COMPETITION_UTOPIA);
    expect(bot.megaCredits).eq(9);
    expect(game.automa!.bonusDeck).is.empty;
  });
});

describe('UTOPIA PLANITIA + MarsBot — placement (Adding Expansions p.10)', () => {
  it('adjacency to oceans wins first (step 1)', () => {
    const [game, , bot] = utopiaGame();
    const edgeRich = land(game, (s) => game.board.isEdge(s) && s.bonus.length >= 1);
    const oceanAdjacent = land(game, (s) => !game.board.isEdge(s) &&
      game.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.OCEAN));
    const neighbour = game.board.getAdjacentSpaces(oceanAdjacent)
      .find((a) => a.spaceType === SpaceType.OCEAN)!;
    game.simpleAddTile(bot, neighbour, {tileType: TileType.OCEAN});
    expect(AutomaTilePlacer.breakTie(game, [edgeRich, oceanAdjacent])).eq(oceanAdjacent);
  });

  it('an EDGE space counts as having one extra reward icon (step 4\'s own bullet)', () => {
    const [game] = utopiaGame();
    const edgeBare = land(game, (s) => game.board.isEdge(s) && s.bonus.length === 0);
    const inlandBare = land(game, (s) => !game.board.isEdge(s) && s.bonus.length === 0);
    expect(AutomaTilePlacer.breakTie(game, [inlandBare, edgeBare]), '0+1 beats 0').eq(edgeBare);
    expect(AutomaTilePlacer.breakTie(game, [edgeBare, inlandBare]),
      'and the input order never decides').eq(edgeBare);
  });

  it('EDGE IS NOT A SEPARATE STEP: a richer inland hex still beats a bare edge one', () => {
    // The whole point of the arithmetic reading — a «prefer edges» step would
    // rank these the other way round.
    const [game] = utopiaGame();
    const edgeBare = land(game, (s) => game.board.isEdge(s) && s.bonus.length === 0);
    const inlandRich = land(game, (s) => !game.board.isEdge(s) && s.bonus.length === 2);
    expect(AutomaTilePlacer.breakTie(game, [edgeBare, inlandRich]), '0+1 loses to 2').eq(inlandRich);
  });

  it('the virtual icon really is worth exactly ONE: 1+1 beats 1, and ties with 2', () => {
    const [game] = utopiaGame();
    const edgeOne = land(game, (s) => game.board.isEdge(s) && s.bonus.length === 1);
    const inlandOne = land(game, (s) => !game.board.isEdge(s) && s.bonus.length === 1);
    expect(AutomaTilePlacer.breakTie(game, [inlandOne, edgeOne]), '1+1 beats 1').eq(edgeOne);
    // …and 1+1 vs a real 2 is a genuine tie, so the card flip settles it.
    const inlandTwo = land(game, (s) => !game.board.isEdge(s) && s.bonus.length === 2);
    const before = game.projectDeck.drawPile.length;
    const picked = AutomaTilePlacer.breakTie(game, [edgeOne, inlandTwo]);
    expect([edgeOne, inlandTwo]).contains(picked);
    expect(game.projectDeck.drawPile.length, 'a tie reached the card flip').eq(before - 1);
  });

  it('everything level → the project-card flip decides, and consumes a card', () => {
    const [game] = utopiaGame();
    const a = land(game, (s) => !game.board.isEdge(s) && s.bonus.length === 0);
    const b = game.board.spaces.find((s) => s !== a && s.spaceType === SpaceType.LAND &&
      s.tile === undefined && !game.board.isEdge(s) && s.bonus.length === 0)!;
    const before = game.projectDeck.drawPile.length;
    const picked = AutomaTilePlacer.breakTie(game, [a, b]);
    expect([a, b]).contains(picked);
    expect(game.projectDeck.drawPile.length, 'a card was flipped').eq(before - 1);
  });

  it('the edge icon is TIEBREAK-ONLY — it never pays the bot a M€', () => {
    const [game, , bot] = utopiaGame();
    const edgeBare = land(game, (s) => game.board.isEdge(s) && s.bonus.length === 0);
    const before = bot.megaCredits;
    game.grantPlacementBonuses(bot, edgeBare);
    expect(bot.megaCredits, 'a bare edge hex covers no printed icon').eq(before);
  });

  it('carries NO Hellas/Elysium region rule', () => {
    const [game] = utopiaGame();
    // Both maps' region steps would make a bare bottom-rows hex beat a 2-icon one.
    const southernBare = land(game, (s) => Board.isSouthernRegion(s) &&
      !game.board.isEdge(s) && s.bonus.length === 0);
    const northernRich = land(game, (s) => !Board.isSouthernRegion(s) &&
      !game.board.isEdge(s) && s.bonus.length === 2);
    expect(AutomaTilePlacer.breakTie(game, [southernBare, northernRich])).eq(northernRich);
  });
});

describe('UTOPIA PLANITIA + MarsBot — a real game runs', () => {
  it('resolves 30 bot turns with Venus + Colonies + Prelude without a rules dead end', () => {
    const [game] = utopiaGame({
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

describe('UTOPIA PLANITIA + MarsBot — what the client and the endgame receive', () => {
  it('the server model carries the UTOPIA cells — the Turn Review mini-scale reads THEM', () => {
    const [game] = utopiaGame();
    const model = Server.getGameModel(game).automa!;
    expect(model.tracks).has.length(7);
    const space = model.tracks[game.automa!.board.trackIndexOfRoleOrThrow('space')];
    expect(space.layout[5], 'the Place-a-Colony cell reaches the client').eq('colony');
    const building = model.tracks[game.automa!.board.trackIndexOfRoleOrThrow('building')];
    expect(building.layout[11], 'and so does the Venus tag icon').eq('tag_7');
    expect(building.layout[5], 'a Tharsis-only difference is NOT what the client sees').eq('tr2');
  });

  it('round-trips through the map profile: only the map NAME is stored', () => {
    const [game] = utopiaGame({coloniesExtension: true});
    setPosition(game, 'space', 5);
    setPosition(game, 'earth', 3);
    const serialized = game.automa!.serialize();
    expect(JSON.stringify(serialized), 'the static board is never serialized')
      .does.not.contain('colony');
    const restored = AutomaState.deserialize(serialized, game.gameOptions);
    expect(restored.board.getTrackOfRole('space')!.position).eq(5);
    expect(restored.board.getTrackOfRole('earth')!.position).eq(3);
    expect(restored.board.getTrackOfRole('space')!.definition.layout[5],
      'and the layout comes back from the profile').eq('colony');
    expect(restored.board.getTrackIndexForTag(Tag.JOVIAN),
      'with Utopia\'s own tag pairing').eq(restored.board.trackIndexOfRoleOrThrow('power'));
  });
});
