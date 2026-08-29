import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {BonusCardId, MarsBotTrackRole} from '../../src/common/automa/AutomaTypes';
import {CardName} from '../../src/common/cards/CardName';
import {Resource} from '../../src/common/Resource';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {Tag} from '../../src/common/cards/Tag';
import {TileType} from '../../src/common/TileType';
import {AwardScorer} from '../../src/server/awards/AwardScorer';
import {Board} from '../../src/server/boards/Board';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Space} from '../../src/server/boards/Space';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {AutomaController} from '../../src/server/automa/AutomaController';
import {AutomaMAEvaluation} from '../../src/server/automa/AutomaMAEvaluation';
import {AutomaMilestonesAwards} from '../../src/server/automa/AutomaMilestonesAwards';
import {AutomaResolver} from '../../src/server/automa/AutomaResolver';
import {AutomaSetup} from '../../src/server/automa/AutomaSetup';
import {AutomaState} from '../../src/server/automa/AutomaState';
import {Server} from '../../src/server/models/ServerModel';
import {AutomaTilePlacer} from '../../src/server/automa/AutomaTilePlacer';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {Algae} from '../../src/server/cards/base/Algae';
import {ArtificialLake} from '../../src/server/cards/base/ArtificialLake';
import {GanymedeColony} from '../../src/server/cards/base/GanymedeColony';
import {MagneticFieldGenerators} from '../../src/server/cards/base/MagneticFieldGenerators';
import {TowingAComet} from '../../src/server/cards/base/TowingAComet';
import {milestoneThreshold} from '../../src/server/milestones/IMilestone';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame, testAutomaMultiplayerGame} from './AutomaTestGame';

const ELYSIUM = {boardName: BoardName.ELYSIUM} as const;

function elysiumGame(options?: object): [IGame, ReturnType<typeof testAutomaGame>[1], IPlayer] {
  return testAutomaGame({...ELYSIUM, ...options});
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

/** Put every MARTIAN track at `value`; the Venus track (when present) keeps its own. */
function setMartianTracks(game: IGame, value: number): void {
  for (const track of game.automa!.board.tracks) {
    if (track.definition.role !== 'venus') {
      track.position = value;
    }
  }
}

function milestone(game: IGame, name: string) {
  const found = game.milestones.find((m) => m.name === name);
  expect(found, `Elysium milestone ${name}`).is.not.undefined;
  return found!;
}

function award(game: IGame, name: string) {
  const found = game.awards.find((a) => a.name === name);
  expect(found, `Elysium award ${name}`).is.not.undefined;
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

describe('ELYSIUM + MarsBot — setup', () => {
  it('is playable: the compatibility guard lets Elysium through', () => {
    const [game] = elysiumGame();
    expect(game.gameOptions.boardName).eq(BoardName.ELYSIUM);
    expect(game.automa).is.not.undefined;
  });

  it('uses the ELYSIUM board — Jovian is paired with Science, Power stands alone', () => {
    const [game] = elysiumGame();
    const board = game.automa!.board;
    expect(board.getTrackIndexForTag(Tag.JOVIAN)).eq(trackIndex(game, 'science'));
    expect(board.getTrackIndexForTag(Tag.SCIENCE)).eq(trackIndex(game, 'science'));
    expect(board.getTrackIndexForTag(Tag.POWER)).eq(trackIndex(game, 'power'));
    expect(board.getTrackOfRole('science')!.definition.tags).deep.eq([Tag.JOVIAN, Tag.SCIENCE]);
    expect(board.getTrackOfRole('power')!.definition.tags, 'Power carries the power tag alone')
      .deep.eq([Tag.POWER]);
  });

  it('builds the bonus deck with B10, never B08/B09 (Setup Guide v1.3 step 18)', () => {
    const deck = AutomaSetup.bonusDeckContents({boardName: BoardName.ELYSIUM} as never);
    expect(deck).contains(BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM);
    expect(deck).does.not.contain(BonusCardId.B08_CORPORATE_COMPETITION);
    expect(deck).does.not.contain(BonusCardId.B09_CORPORATE_COMPETITION_HELLAS);
  });

  it('leaves the other maps on their own card', () => {
    expect(AutomaSetup.bonusDeckContents({boardName: BoardName.HELLAS} as never))
      .does.not.contain(BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM);
    expect(AutomaSetup.bonusDeckContents({boardName: BoardName.THARSIS} as never))
      .does.not.contain(BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM);
  });

  it('appends the Venus track as the 8th, leaving the 7 map tracks in place', () => {
    const [game] = elysiumGame({venusNextExtension: true});
    expect(game.automa!.board.tracks).has.length(8);
    expect(game.automa!.board.getTrackIndexOfRole('venus')).eq(7);
  });
});

describe('ELYSIUM + MarsBot — tag → track resolution', () => {
  it('a Jovian tag advances the Jovian/Science track', () => {
    const [game] = elysiumGame();
    AutomaResolver.resolveTag(game, Tag.JOVIAN);
    // Space 1 is 'advance', which carries the marker to 2 (a floater cell).
    expect(position(game, 'science')).eq(2);
    expect(position(game, 'power'), 'Power is untouched').eq(0);
  });

  it('a Science tag advances the SAME track', () => {
    const [game] = elysiumGame();
    AutomaResolver.resolveTag(game, Tag.SCIENCE);
    expect(position(game, 'science')).eq(2);
    expect(position(game, 'power')).eq(0);
  });

  it('a Power tag advances the separate Power track', () => {
    const [game] = elysiumGame();
    AutomaResolver.resolveTag(game, Tag.POWER);
    // Space 1 is 'advance' → 2, which is EMPTY on Elysium (Hellas chains again).
    expect(position(game, 'power')).eq(2);
    expect(position(game, 'science'), 'never the Jovian/Science track').eq(0);
  });

  it('building, space and event tags reach their own tracks', () => {
    const [game] = elysiumGame();
    const board = game.automa!.board;
    expect(board.getTrackIndexForTag(Tag.BUILDING)).eq(trackIndex(game, 'building'));
    expect(board.getTrackIndexForTag(Tag.SPACE)).eq(trackIndex(game, 'space'));
    expect(board.getTrackIndexForTag(Tag.EVENT)).eq(trackIndex(game, 'event'));
  });

  it('city and earth tags share one track; bio tags share another', () => {
    const [game] = elysiumGame();
    const board = game.automa!.board;
    const earth = trackIndex(game, 'earth');
    expect(board.getTrackIndexForTag(Tag.CITY)).eq(earth);
    expect(board.getTrackIndexForTag(Tag.EARTH)).eq(earth);
    const bio = trackIndex(game, 'bio');
    for (const tag of [Tag.MICROBE, Tag.ANIMAL, Tag.PLANT]) {
      expect(board.getTrackIndexForTag(tag), tag).eq(bio);
    }
  });

  it('a Wild tag still takes the furthest-back track, topmost on ties', () => {
    const [game] = elysiumGame();
    setMartianTracks(game, 4);
    setPosition(game, 'bio', 1);
    AutomaResolver.resolveTag(game, Tag.WILD);
    expect(position(game, 'bio'), 'the least-advanced track took it').eq(2);
    expect(position(game, 'science')).eq(4);
  });

  it('the cross-track POWER icon on the building track advances POWER, not building again', () => {
    const [game] = elysiumGame();
    // Building 3 → 4 lands on the printed power-tag icon.
    setPosition(game, 'building', 3);
    AutomaResolver.advanceTrack(game, trackIndex(game, 'building'));
    expect(position(game, 'building')).eq(4);
    // Power 0 → 1 ('advance') → 2 (empty).
    expect(position(game, 'power')).eq(2);
  });
});

describe('ELYSIUM + MarsBot — production regression follows the printed badges', () => {
  const cases: ReadonlyArray<[Resource, MarsBotTrackRole]> = [
    [Resource.STEEL, 'building'],
    [Resource.TITANIUM, 'space'],
    [Resource.MEGACREDITS, 'event'],
    [Resource.ENERGY, 'power'],
    [Resource.HEAT, 'earth'],
    [Resource.PLANTS, 'bio'],
  ];
  for (const [resource, role] of cases) {
    it(`decreasing ${resource} production regresses the ${role} track`, () => {
      const [game] = elysiumGame();
      expect(game.automa!.board.getTrackIndexForProduction(resource)).eq(trackIndex(game, role));
    });
  }

  it('ENERGY still regresses POWER — the Jovian/Science pairing moved a TAG, not a badge', () => {
    const [game] = elysiumGame();
    expect(game.automa!.board.getTrackIndexForProduction(Resource.ENERGY))
      .eq(trackIndex(game, 'power'));
    expect(game.automa!.board.getTrackIndexForProduction(Resource.ENERGY),
      'and certainly not the science track').does.not.eq(trackIndex(game, 'science'));
  });

  it('the Jovian/Science track carries no production badge, so nothing regresses it', () => {
    const [game] = elysiumGame();
    const science = trackIndex(game, 'science');
    for (const resource of [Resource.STEEL, Resource.TITANIUM, Resource.MEGACREDITS,
      Resource.ENERGY, Resource.HEAT, Resource.PLANTS] as const) {
      expect(game.automa!.board.getTrackIndexForProduction(resource), resource).does.not.eq(science);
    }
  });
});

describe('ELYSIUM + MarsBot — track action chains', () => {
  it('science 6 → 7 fires the power tag, whose own landing chain resolves', () => {
    const [game] = elysiumGame();
    setPosition(game, 'science', 6);
    AutomaResolver.advanceTrack(game, trackIndex(game, 'science'));
    expect(position(game, 'science')).eq(7);
    expect(position(game, 'power')).eq(2);
  });

  it('power 5 → 6 is an advance onto the milestone cell', () => {
    const [game] = elysiumGame();
    setMartianTracks(game, 2); // Generalist is met, so the milestone cell can claim.
    setPosition(game, 'power', 5);
    AutomaResolver.advanceTrack(game, trackIndex(game, 'power'));
    expect(position(game, 'power'), 'space 6 advance → 7 (the milestone)').eq(7);
    expect(game.claimedMilestones).has.length(1);
  });

  it('building 7 claims a milestone; building 9 funds an award', () => {
    const [game] = elysiumGame();
    setMartianTracks(game, 2);
    setPosition(game, 'building', 6);
    AutomaResolver.advanceTrack(game, trackIndex(game, 'building'));
    expect(position(game, 'building')).eq(7);
    expect(game.claimedMilestones).has.length(1);

    setPosition(game, 'building', 8);
    AutomaResolver.advanceTrack(game, trackIndex(game, 'building'));
    expect(position(game, 'building')).eq(9);
    expect(game.fundedAwards).has.length(1);
  });

  it('space 7 raises Venus with Venus Next, and is ignored without it', () => {
    const [withVenus] = elysiumGame({venusNextExtension: true});
    setPosition(withVenus, 'space', 6);
    AutomaResolver.advanceTrack(withVenus, trackIndex(withVenus, 'space'));
    expect(withVenus.getVenusScaleLevel()).eq(2);

    const [without] = elysiumGame();
    setPosition(without, 'space', 6);
    AutomaResolver.advanceTrack(without, trackIndex(without, 'space'));
    expect(without.getVenusScaleLevel(), 'an unused-expansion icon is ignored').eq(0);
  });

  it('the floater cells pay with Venus OR Colonies, and are ignored with neither', () => {
    for (const options of [{venusNextExtension: true}, {coloniesExtension: true}]) {
      const [game] = elysiumGame(options);
      setPosition(game, 'science', 4);
      AutomaResolver.advanceTrack(game, trackIndex(game, 'science'));
      expect(game.automa!.floaters, JSON.stringify(options)).eq(2); // science 5 = floater2
    }
    const [plain] = elysiumGame();
    setPosition(plain, 'science', 4);
    AutomaResolver.advanceTrack(plain, trackIndex(plain, 'science'));
    expect(plain.automa!.floaters).eq(0);
  });

  it('Colonies unlocks the 2nd trade fleet on the POWER track\'s space 9, as printed on the board', () => {
    const [game] = elysiumGame({coloniesExtension: true});
    setPosition(game, 'power', 8);
    AutomaResolver.advanceTrack(game, trackIndex(game, 'power'));
    expect(position(game, 'power')).eq(9);
    expect(game.automa!.secondFleetUnlocked).is.true;
  });
});

describe('ELYSIUM + MarsBot — milestones (Adding Expansions p.9)', () => {
  it('the board ships the Elysium milestone row', () => {
    const [game] = elysiumGame();
    expect(game.milestones.map((m) => m.name))
      .deep.eq(['Generalist', 'Specialist', 'Ecologist', 'Tycoon10', 'Legend']);
  });

  it('Generalist: every track at 2', () => {
    const [game] = elysiumGame();
    setMartianTracks(game, 2);
    expect(met(game, 'Generalist')).is.true;
    setPosition(game, 'bio', 1);
    expect(met(game, 'Generalist'), 'one track short is short').is.false;
  });

  it('Generalist with Venus EXCLUDES the Venus track entirely (not Diversifier\'s substitution)', () => {
    const [game] = elysiumGame({venusNextExtension: true});
    setMartianTracks(game, 2);
    expect(position(game, 'venus'), 'the Venus track has not moved').eq(0);
    expect(met(game, 'Generalist'), 'seven base tracks at 2 with Venus at 0 is MET').is.true;

    // …and the Venus track never substitutes for a Martian one that is behind.
    setPosition(game, 'venus', 12);
    setPosition(game, 'bio', 1);
    expect(met(game, 'Generalist'), 'a maxed Venus track cannot cover a base track at 1').is.false;
  });

  it('Specialist: any one track at 10', () => {
    const [game] = elysiumGame();
    setMartianTracks(game, 9);
    expect(met(game, 'Specialist')).is.false;
    setPosition(game, 'event', 10);
    expect(met(game, 'Specialist')).is.true;
  });

  it('Specialist counts the Venus track too — the board prints «excl. Venus» on Generalist alone', () => {
    const [game] = elysiumGame({venusNextExtension: true});
    setMartianTracks(game, 0);
    setPosition(game, 'venus', 10);
    expect(met(game, 'Specialist')).is.true;
    expect(met(game, 'Generalist'), 'while Generalist still ignores it').is.false;
  });

  it('Ecologist: the BIO track at 4, not 3', () => {
    const [game] = elysiumGame();
    setPosition(game, 'bio', 3);
    expect(met(game, 'Ecologist')).is.false;
    setPosition(game, 'bio', 4);
    expect(met(game, 'Ecologist')).is.true;
    setPosition(game, 'bio', 0);
    setMartianTracks(game, 18);
    setPosition(game, 'bio', 0);
    expect(met(game, 'Ecologist'), 'no other track stands in for Bio').is.false;
  });

  it('Tycoon: green/blue cards in the bot\'s PLAYED PILE (it has no tableau)', () => {
    const [game] = elysiumGame();
    const threshold = milestoneThreshold(milestone(game, 'Tycoon10'), game)!;
    expect(threshold, 'the fork ships Tycoon10 on Elysium').eq(10);
    for (let i = 0; i < threshold - 1; i++) {
      game.automa!.playedPile.push(CardName.ALGAE); // AUTOMATED (green)
    }
    expect(met(game, 'Tycoon10'), 'one short').is.false;
    game.automa!.playedPile.push(CardName.SPACE_ELEVATOR); // ACTIVE (blue) counts too
    expect(met(game, 'Tycoon10')).is.true;
  });

  it('Tycoon never counts the bot\'s red cards', () => {
    const [game] = elysiumGame();
    for (let i = 0; i < 15; i++) {
      game.automa!.playedPile.push(CardName.TOWING_A_COMET); // EVENT
    }
    expect(met(game, 'Tycoon10')).is.false;
    expect(shown(game, 'Tycoon10')).eq(0);
  });

  it('Legend: 5 red cards in the played pile, not 4', () => {
    const [game] = elysiumGame();
    for (let i = 0; i < 4; i++) {
      game.automa!.playedPile.push(CardName.TOWING_A_COMET);
    }
    expect(met(game, 'Legend')).is.false;
    game.automa!.playedPile.push(CardName.BIG_ASTEROID);
    expect(met(game, 'Legend')).is.true;
    // Green cards are not events.
    const [other] = elysiumGame();
    for (let i = 0; i < 9; i++) {
      other.automa!.playedPile.push(CardName.ALGAE);
    }
    expect(met(other, 'Legend')).is.false;
  });

  it('the displayed progress is the PLAYER\'s scale for every Elysium milestone', () => {
    const [game] = elysiumGame();
    // Generalist: bot target 2 ↔ printed 6 productions.
    setMartianTracks(game, 1);
    expect(shown(game, 'Generalist'), '1 of 2 → 3 of 6').eq(3);
    setMartianTracks(game, 2);
    expect(shown(game, 'Generalist')).eq(6);
    // Specialist: bot target 10 ↔ printed 10 production — half is half.
    setMartianTracks(game, 5);
    expect(shown(game, 'Specialist')).eq(5);
    // Ecologist: bot target 4 ↔ printed 4 bio tags.
    setMartianTracks(game, 0);
    setPosition(game, 'bio', 2);
    expect(shown(game, 'Ecologist'), '2 of 4 → 50%').eq(2);
    // The played-pile pair reads as the plain count.
    game.automa!.playedPile.push(CardName.ALGAE, CardName.ALGAE, CardName.TOWING_A_COMET);
    expect(shown(game, 'Tycoon10')).eq(2);
    expect(shown(game, 'Legend')).eq(1);
  });

  it('the claim PATH works, not just the evaluator', () => {
    const [game] = elysiumGame();
    setMartianTracks(game, 2);
    expect(AutomaMilestonesAwards.tryClaimMilestone(game)).is.true;
    expect(game.claimedMilestones[0].milestone.name).eq('Generalist');
    expect(game.claimedMilestones[0].player.isMarsBot).is.true;
  });
});

describe('ELYSIUM + MarsBot — awards (Adding Expansions p.9)', () => {
  function score(game: IGame, name: string): number {
    return AutomaMAEvaluation.botAwardScore(award(game, name), game);
  }

  it('the board ships the Elysium award row', () => {
    const [game] = elysiumGame();
    expect(game.awards.map((a) => a.name))
      .deep.eq(['Celebrity', 'Industrialist', 'Desert Settler', 'Estate Dealer', 'Benefactor']);
  });

  it('Celebrity: 20+ M€ cards in the played pile — INCLUDING events, unlike the human', () => {
    const [game, human] = elysiumGame();
    game.automa!.playedPile.push(
      CardName.METHANE_FROM_TITAN, // 28, green
      CardName.TOWING_A_COMET, // 23, RED — counted for the bot
      CardName.GANYMEDE_COLONY, // exactly 20 — counted
      CardName.ALGAE, // 10 — not counted
    );
    expect(score(game, 'Celebrity')).eq(3);

    // The same three cards in a HUMAN tableau score 1, not 2: the printed
    // award drops the event, which is exactly the asymmetry B10 prints.
    human.playedCards.push(new GanymedeColony(), new TowingAComet(), new Algae());
    expect(award(game, 'Celebrity').getScore(human)).eq(1);
  });

  it('Industrialist: the POWER track space + 5', () => {
    const [game] = elysiumGame();
    setPosition(game, 'power', 4);
    expect(score(game, 'Industrialist')).eq(9);
    setPosition(game, 'science', 18);
    expect(score(game, 'Industrialist'), 'the Jovian/Science track never stands in').eq(9);
  });

  it('a HUMAN\'s Industrialist strength is steel + steel production + POWER PRODUCTION', () => {
    // The reference card's own note: current power RESOURCES do not count,
    // «since they cannot be carried over».
    const [game, human] = elysiumGame();
    human.stock.add(Resource.STEEL, 3);
    human.stock.add(Resource.ENERGY, 7);
    human.production.add(Resource.STEEL, 2);
    human.production.add(Resource.ENERGY, 4);
    expect(new AwardScorer(game, award(game, 'Industrialist')).get(human)).eq(3 + 2 + 4);
  });

  it('…and that stays true after the final production, where the printed rule would switch', () => {
    const [game, human] = elysiumGame();
    human.stock.add(Resource.STEEL, 1);
    human.stock.add(Resource.ENERGY, 9);
    human.production.add(Resource.STEEL, 2);
    human.production.add(Resource.ENERGY, 3);
    const during = new AwardScorer(game, award(game, 'Industrialist')).get(human);
    game.phase = 'end' as typeof game.phase;
    expect(game.isDoneWithFinalProduction()).is.true;
    expect(new AwardScorer(game, award(game, 'Industrialist')).get(human),
      'the automa formula does not switch to steel + energy at the end').eq(during);
    expect(during).eq(1 + 2 + 3);
  });

  it('Desert Settler: unchanged — the bot\'s REAL tiles on the four bottom rows', () => {
    const [game, , bot] = elysiumGame();
    game.simpleAddTile(bot, land(game, (s) => s.y === 7), {tileType: TileType.GREENERY});
    game.simpleAddTile(bot, land(game, (s) => s.y === 5), {tileType: TileType.CITY});
    game.simpleAddTile(bot, land(game, (s) => s.y === 1), {tileType: TileType.GREENERY});
    expect(score(game, 'Desert Settler'), 'only the southern two count').eq(2);
    expect(score(game, 'Desert Settler'), 'and it is the award\'s own evaluator')
      .eq(award(game, 'Desert Settler').getScore(bot));
  });

  it('Estate Dealer: unchanged — the bot\'s real tiles adjacent to an ocean', () => {
    const [game, , bot] = elysiumGame();
    const oceanSpace = game.board.spaces.find((s) => s.spaceType === SpaceType.OCEAN)!;
    game.simpleAddTile(bot, oceanSpace, {tileType: TileType.OCEAN});
    const beside = game.board.getAdjacentSpaces(oceanSpace)
      .find((s) => s.spaceType === SpaceType.LAND && s.tile === undefined)!;
    game.simpleAddTile(bot, beside, {tileType: TileType.GREENERY});
    game.simpleAddTile(bot, land(game, (s) =>
      !game.board.getAdjacentSpaces(s).some(Board.isOceanSpace)), {tileType: TileType.GREENERY});
    expect(score(game, 'Estate Dealer')).eq(award(game, 'Estate Dealer').getScore(bot));
    expect(score(game, 'Estate Dealer'), 'the ocean itself is adjacent to nothing of its own').is.at.least(1);
  });

  it('Benefactor: TR minus 15, and the bot\'s ACTUAL TR is untouched', () => {
    const [game, , bot] = elysiumGame();
    bot.setTerraformRating(31);
    expect(score(game, 'Benefactor')).eq(16);
    expect(bot.terraformRating, 'evaluation only — no fake −15 anywhere').eq(31);
    expect(new AwardScorer(game, award(game, 'Benefactor')).get(bot)).eq(16);
    expect(bot.terraformRating).eq(31);
  });

  it('Venuphile: the Venus track space, when Venus is in play', () => {
    const [game] = elysiumGame({venusNextExtension: true});
    setPosition(game, 'venus', 6);
    expect(score(game, 'Venuphile')).eq(6);
  });

  it('the funding decision compares against the best HUMAN (multiplayer)', () => {
    const [game, humans, bot] = testAutomaMultiplayerGame(3, ELYSIUM, '-ely-mp');
    bot.setTerraformRating(40); // Benefactor: bot strength 40 − 15 = 25.
    humans[0].setTerraformRating(20);
    humans[1].setTerraformRating(30); // the best human
    humans[2].setTerraformRating(21);
    const scorer = new AwardScorer(game, award(game, 'Benefactor'));
    expect(scorer.get(bot)).eq(25);
    expect(Math.max(...humans.map((h) => scorer.get(h))), 'best human').eq(30);
    expect(scorer.get(bot)).is.below(30);
  });
});

describe('ELYSIUM + MarsBot — B10 Corporate Competition', () => {
  /** Fund `name` for the human so it becomes a candidate. */
  function fund(game: IGame, human: IPlayer, name: string) {
    game.fundAward(human, award(game, name));
  }

  /** Give the bot an ocean so the Estate Dealer helper has somewhere to go. */
  function addOcean(game: IGame, owner: IPlayer): Space {
    const oceanSpace = game.board.spaces.find((s) =>
      s.spaceType === SpaceType.OCEAN && s.tile === undefined)!;
    game.simpleAddTile(owner, oceanSpace, {tileType: TileType.OCEAN});
    return oceanSpace;
  }

  it('under 5 M€ the card does nothing', () => {
    const [game, human, bot] = elysiumGame();
    fund(game, human, 'Benefactor');
    bot.megaCredits = 4;
    const tr = bot.terraformRating;
    expect(resolve(game, BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM)).eq('discard');
    expect(bot.megaCredits).eq(4);
    expect(bot.terraformRating).eq(tr);
  });

  it('Celebrity reveals until a 20+ M€ card and resolves that card as a bot project card', () => {
    const [game, human, bot] = elysiumGame();
    fund(game, human, 'Celebrity');
    bot.megaCredits = 6;
    // Drawn in reverse push order: Algae (10) → Artificial Lake (15) → Towing a Comet (23).
    game.projectDeck.drawPile.push(new TowingAComet());
    game.projectDeck.drawPile.push(new ArtificialLake());
    game.projectDeck.drawPile.push(new Algae());
    resolve(game, BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM);

    expect(game.automa!.playedPile, 'the 20+ card was resolved').contains(CardName.TOWING_A_COMET);
    expect(game.automa!.playedPile).does.not.contain(CardName.ALGAE);
    expect(game.automa!.playedPile).does.not.contain(CardName.ARTIFICIAL_LAKE);
    const discards = game.projectDeck.discardPile.map((c) => c.name);
    expect(discards, 'every rejected card was discarded').contains(CardName.ALGAE);
    expect(discards).contains(CardName.ARTIFICIAL_LAKE);
    expect(bot.megaCredits).eq(1);
  });

  it('Celebrity: a card costing EXACTLY 20 qualifies', () => {
    const [game, human, bot] = elysiumGame();
    fund(game, human, 'Celebrity');
    bot.megaCredits = 6;
    // Cost 20 on the nose, and a lone building tag — so the only M€ movement
    // left is the card's own 5.
    game.projectDeck.drawPile.push(new MagneticFieldGenerators());
    resolve(game, BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM);
    expect(game.automa!.playedPile).contains(CardName.MAGNETIC_FIELD_GENERATORS);
    expect(position(game, 'building'), 'its building tag advanced the building track').eq(1);
    expect(bot.megaCredits).eq(1);
  });

  it('Industrialist advances the POWER track, and its landed action chains', () => {
    const [game, human, bot] = elysiumGame();
    fund(game, human, 'Industrialist');
    bot.megaCredits = 6;
    resolve(game, BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM);
    // Power 0 → 1 ('advance') → 2 (empty).
    expect(position(game, 'power')).eq(2);
    expect(position(game, 'science'), 'never the Jovian/Science track').eq(0);
    expect(bot.megaCredits).eq(1);
  });

  it('a maxed POWER track makes the Industrialist helper impossible — no payment', () => {
    const [game, human, bot] = elysiumGame();
    fund(game, human, 'Industrialist');
    bot.megaCredits = 6;
    setPosition(game, 'power', 18);
    game.automa!.bonusDeck = [{kind: 'bonus', id: BonusCardId.B03_RESEARCH_AND_DEVELOPMENT}];
    resolve(game, BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM);
    expect(bot.megaCredits, 'an impossible helper never charges the 5 M€').eq(6);
    expect(game.automa!.bonusDeck, 'the fallback card was drawn instead').is.empty;
  });

  it('Desert Settler places the greenery INSIDE the southern region and raises oxygen', () => {
    const [game, human, bot] = elysiumGame();
    fund(game, human, 'Desert Settler');
    bot.megaCredits = 20;
    const oxygen = game.getOxygenLevel();
    const tr = bot.terraformRating;
    resolve(game, BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM);

    const greeneries = game.board.getGreeneries(bot);
    expect(greeneries).has.length(1);
    expect(Board.isSouthernRegion(greeneries[0]), `y=${greeneries[0].y} is in the bottom four rows`).is.true;
    expect(game.getOxygenLevel()).eq(oxygen + 1);
    expect(bot.terraformRating, 'the oxygen raise paid its TR').eq(tr + 1);
    expect(bot.megaCredits, 'the card charged its 5 M€ once').eq(20 - 5 + greeneries[0].bonus.length);
  });

  it('…and the Elysium tiebreakers decide WHICH southern hex', () => {
    const [game, human, bot] = elysiumGame();
    fund(game, human, 'Desert Settler');
    bot.megaCredits = 20;
    resolve(game, BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM);
    const placed = game.board.getGreeneries(bot)[0];
    // Whatever it picked, no OTHER legal southern hex may beat it on the
    // printed order (oceans → icons), which is what breakTie guarantees.
    const southern = game.board.spaces.filter((s) =>
      s.spaceType === SpaceType.LAND && s.tile === undefined && Board.isSouthernRegion(s));
    const best = Math.max(...southern.map((s) => s.bonus.length), placed.bonus.length);
    expect(placed.bonus.length, 'it covered as many reward icons as any rival').eq(best);
  });

  it('no legal SOUTHERN greenery → the helper is impossible, never a greenery elsewhere', () => {
    const [game, human, bot] = elysiumGame();
    fund(game, human, 'Desert Settler');
    bot.megaCredits = 20;
    // A bot tile in the far north pins every legal greenery to its neighbours,
    // so the Southern Region constraint has nothing left to offer.
    game.simpleAddTile(bot, land(game, (s) => s.y === 0), {tileType: TileType.CITY});
    expect(game.board.getAvailableSpacesForGreenery(bot).every((s) => !Board.isSouthernRegion(s))).is.true;
    game.automa!.bonusDeck = [{kind: 'bonus', id: BonusCardId.B03_RESEARCH_AND_DEVELOPMENT}];
    resolve(game, BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM);

    expect(game.board.getGreeneries(bot), 'nothing was planted outside the region').is.empty;
    expect(bot.megaCredits, 'and nothing was paid').eq(20);
    expect(game.automa!.bonusDeck, 'the fallback card ran instead').is.empty;
  });

  it('Estate Dealer places the greenery ADJACENT TO AN OCEAN and raises oxygen', () => {
    const [game, human, bot] = elysiumGame();
    const oceanSpace = addOcean(game, human);
    fund(game, human, 'Estate Dealer');
    bot.megaCredits = 20;
    const oxygen = game.getOxygenLevel();
    resolve(game, BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM);

    const greeneries = game.board.getGreeneries(bot);
    expect(greeneries).has.length(1);
    expect(game.board.getAdjacentSpaces(greeneries[0]).some(Board.isOceanSpace),
      'the constraint held').is.true;
    expect(game.board.getAdjacentSpaces(greeneries[0])).contains(oceanSpace);
    expect(game.getOxygenLevel()).eq(oxygen + 1);
  });

  it('no ocean-adjacent legal greenery → impossible, never a plain greenery', () => {
    const [game, human, bot] = elysiumGame();
    fund(game, human, 'Estate Dealer');
    bot.megaCredits = 20;
    expect(game.board.getOceanSpaces(), 'no oceans have been placed at all').is.empty;
    game.automa!.bonusDeck = [{kind: 'bonus', id: BonusCardId.B03_RESEARCH_AND_DEVELOPMENT}];
    resolve(game, BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM);

    expect(game.board.getGreeneries(bot)).is.empty;
    expect(bot.megaCredits).eq(20);
    expect(game.automa!.bonusDeck).is.empty;
  });

  it('Benefactor raises the bot\'s TR by exactly 2 — no parameter, no tile', () => {
    const [game, human, bot] = elysiumGame();
    fund(game, human, 'Benefactor');
    bot.megaCredits = 6;
    const tr = bot.terraformRating;
    const oxygen = game.getOxygenLevel();
    const temperature = game.getTemperature();
    resolve(game, BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM);
    expect(bot.terraformRating).eq(tr + 2);
    expect(game.getOxygenLevel()).eq(oxygen);
    expect(game.getTemperature()).eq(temperature);
    expect(game.board.spaces.filter((s) => s.player === bot && s.tile !== undefined)).is.empty;
    expect(bot.megaCredits, 'paid exactly once').eq(1);
  });

  it('Venuphile advances the Venus track (added to every version of the card)', () => {
    const [game, human, bot] = elysiumGame({venusNextExtension: true});
    game.fundAward(human, award(game, 'Venuphile'));
    bot.megaCredits = 6;
    resolve(game, BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM);
    expect(position(game, 'venus')).eq(1);
    expect(bot.megaCredits).eq(1);
  });

  it('no funded award → no payment, and the fallback bonus card resolves as ONE flow', () => {
    const [game, , bot] = elysiumGame();
    expect(game.fundedAwards).is.empty;
    bot.megaCredits = 6;
    setMartianTracks(game, 2); // Generalist: the milestone the drawn B04 will claim.
    game.automa!.bonusDeck = [{kind: 'bonus', id: BonusCardId.B04_OVERACHIEVEMENT}];
    resolve(game, BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM);
    expect(bot.megaCredits).eq(6);
    expect(game.claimedMilestones, 'the chained B04 resolved').has.length(1);
    expect(game.automa!.bonusDeck).is.empty;
  });

  it('the closest funded helper being impossible falls through to the NEXT funded award', () => {
    const [game, human, bot] = elysiumGame();
    // Industrialist sits left of Benefactor in the row, and both are level, so
    // Industrialist is tried first — but its track is maxed.
    fund(game, human, 'Industrialist');
    fund(game, human, 'Benefactor');
    setPosition(game, 'power', 18);
    bot.megaCredits = 6;
    const tr = bot.terraformRating;
    resolve(game, BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM);
    expect(bot.terraformRating, 'Benefactor resolved instead').eq(tr + 2);
    expect(bot.megaCredits, 'paid once, for the helper that worked').eq(1);
  });

  it('every funded helper impossible → fallback card, still no payment', () => {
    const [game, human, bot] = elysiumGame();
    fund(game, human, 'Industrialist');
    fund(game, human, 'Estate Dealer'); // no oceans ⇒ impossible
    setPosition(game, 'power', 18);
    bot.megaCredits = 6;
    setMartianTracks(game, 2);
    setPosition(game, 'power', 18);
    game.automa!.bonusDeck = [{kind: 'bonus', id: BonusCardId.B03_RESEARCH_AND_DEVELOPMENT}];
    resolve(game, BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM);
    expect(bot.megaCredits).eq(6);
    expect(game.automa!.bonusDeck).is.empty;
  });

  it('a successful help pays 5 M€ exactly once, even with several funded awards', () => {
    const [game, human, bot] = elysiumGame();
    fund(game, human, 'Industrialist');
    fund(game, human, 'Benefactor');
    bot.megaCredits = 20;
    resolve(game, BonusCardId.B10_CORPORATE_COMPETITION_ELYSIUM);
    expect(bot.megaCredits).eq(15);
  });
});

describe('ELYSIUM + MarsBot — placement (Adding Expansions p.10)', () => {
  it('adjacency to oceans wins first (step 1)', () => {
    const [game, , bot] = elysiumGame();
    const southernRich = land(game, (s) => Board.isSouthernRegion(s) && s.bonus.length >= 2);
    const oceanAdjacent = land(game, (s) => !Board.isSouthernRegion(s) &&
      game.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.OCEAN));
    const neighbour = game.board.getAdjacentSpaces(oceanAdjacent)
      .find((a) => a.spaceType === SpaceType.OCEAN)!;
    game.simpleAddTile(bot, neighbour, {tileType: TileType.OCEAN});
    expect(AutomaTilePlacer.breakTie(game, [southernRich, oceanAdjacent])).eq(oceanAdjacent);
  });

  it('REWARD ICONS beat the Southern Region — the printed order, and the opposite of Hellas', () => {
    const [game] = elysiumGame();
    const southernBare = land(game, (s) => Board.isSouthernRegion(s) && s.bonus.length === 0);
    const northernRich = land(game, (s) => !Board.isSouthernRegion(s) && s.bonus.length === 2);
    expect(AutomaTilePlacer.breakTie(game, [southernBare, northernRich])).eq(northernRich);
    expect(AutomaTilePlacer.breakTie(game, [northernRich, southernBare]),
      'and the input order never decides').eq(northernRich);
  });

  it('with the icons level, the Southern Region decides (step 5)', () => {
    const [game] = elysiumGame();
    const southern = land(game, (s) => Board.isSouthernRegion(s) && s.bonus.length === 0);
    const northern = land(game, (s) => !Board.isSouthernRegion(s) && s.bonus.length === 0);
    expect(AutomaTilePlacer.breakTie(game, [northern, southern])).eq(southern);
  });

  it('everything level → the project-card flip decides, and consumes a card', () => {
    const [game] = elysiumGame();
    const a = land(game, (s) => !Board.isSouthernRegion(s) && s.bonus.length === 0);
    const b = game.board.spaces.find((s) => s !== a && s.spaceType === SpaceType.LAND &&
      s.tile === undefined && !Board.isSouthernRegion(s) && s.bonus.length === 0)!;
    const before = game.projectDeck.drawPile.length;
    const picked = AutomaTilePlacer.breakTie(game, [a, b]);
    expect([a, b]).contains(picked);
    expect(game.projectDeck.drawPile.length, 'a card was flipped').eq(before - 1);
  });

  it('carries NO Hellas rules: no polar step and no South Pole transaction', () => {
    const [game, , bot] = elysiumGame();
    // Hellas' step 2 would make a bottom-two-rows hex beat a 2-icon hex.
    const polarBare = land(game, (s) => s.y >= 7 && s.bonus.length === 0);
    const richNorthern = land(game, (s) => s.y <= 3 && s.bonus.length === 2);
    expect(AutomaTilePlacer.breakTie(game, [polarBare, richNorthern]),
      'on Elysium the icons win').eq(richNorthern);
    // And no hex charges the bot for its bonus.
    const before = bot.megaCredits;
    AutomaTilePlacer.placeGreenery(game);
    expect(bot.megaCredits, 'the bot only ever GAINS 1 M€ per covered icon').is.at.least(before);
  });
});

describe('ELYSIUM + MarsBot — what the client and the endgame receive', () => {
  it('the server model carries the ELYSIUM cells — the Turn Review mini-scale reads THEM', () => {
    // The client never owns a board: «Разбор хода» and the mini-scale render
    // `MarsBotModel.tracks[].layout`, so the map reaches the UI as data.
    const [game] = elysiumGame({venusNextExtension: true});
    const model = Server.getGameModel(game).automa!;
    expect(model.tracks, '7 map tracks + Venus').has.length(8);
    const building = model.tracks[trackIndex(game, 'building')];
    expect(building.layout).deep.eq(
      game.automa!.board.getTrackOfRole('building')!.definition.layout);
    expect(building.layout[4], 'the printed cross-track power tag, not a Tharsis/Hellas cell')
      .eq(`tag_${trackIndex(game, 'power')}`);
    expect(building.layout[5], 'and Hellas\u2019 tr2 is not there').is.undefined;
    const science = model.tracks[trackIndex(game, 'science')];
    expect(science.tags).deep.eq([Tag.JOVIAN, Tag.SCIENCE]);
  });

  it('the endgame hands the bot its Elysium award VP through the shared scoring path', () => {
    const [game, human, bot] = elysiumGame();
    // Benefactor: bot TR 45 − 15 = 30 beats the human's 24.
    bot.setTerraformRating(45);
    human.setTerraformRating(24);
    game.fundAward(human, award(game, 'Benefactor'));
    const breakdown = bot.getVictoryPoints();
    expect(breakdown.awards, 'first place for Benefactor').eq(5);
    expect(bot.terraformRating, 'and the −15 never touched its real TR').eq(45);
    expect(human.getVictoryPoints().awards).eq(0);
  });

  it('…and the handicap can hand the award to the HUMAN, which is the point of it', () => {
    const [game, human, bot] = elysiumGame();
    bot.setTerraformRating(38); // 38 − 15 = 23
    human.setTerraformRating(24);
    game.fundAward(human, award(game, 'Benefactor'));
    expect(human.getVictoryPoints().awards).eq(5);
    expect(bot.getVictoryPoints().awards).eq(0);
  });
});

describe('ELYSIUM + MarsBot — a real game runs', () => {
  it('resolves 30 bot turns with Venus + Colonies + Prelude without a rules dead end', () => {
    const [game, human, bot] = elysiumGame({
      venusNextExtension: true,
      coloniesExtension: true,
      preludeExtension: true,
    });
    for (let turn = 0; turn < 30; turn++) {
      AutomaController.takeTurn(game);
      runAllActions(game);
      const waiting = human.popWaitingFor();
      if (waiting instanceof SelectCard && waiting.cards.length > 0) {
        waiting.process({type: 'card', cards: [waiting.cards[0].name]});
        runAllActions(game);
      }
    }
    for (const track of game.automa!.board.tracks) {
      expect(track.position, track.definition.role).is.at.least(0);
      expect(track.position, track.definition.role).is.at.most(track.maxPosition);
    }
    expect(bot.megaCredits).is.at.least(0);
    expect(bot.terraformRating).is.at.least(20);
  });
});

describe('ELYSIUM + MarsBot — serialization', () => {
  it('round-trips through the map profile: only the map NAME is stored', () => {
    const [game] = elysiumGame({venusNextExtension: true});
    setPosition(game, 'science', 5);
    setPosition(game, 'power', 2);
    game.automa!.board.getTrackOfRole('bio')!.regress();

    const serialized = game.automa!.serialize();
    expect(JSON.stringify(serialized), 'the board definition is never serialized')
      .does.not.contain('layout');

    const restored = AutomaState.deserialize(serialized, game.gameOptions);
    expect(restored.board.getTrackOfRole('science')!.definition.tags).deep.eq([Tag.JOVIAN, Tag.SCIENCE]);
    expect(restored.board.getTrackOfRole('science')!.position).eq(5);
    expect(restored.board.getTrackOfRole('power')!.position).eq(2);
    expect(restored.board.tracks).has.length(8);
    expect(restored.board.getTrackOfRole('building')!.definition.layout[4],
      'the restored board is the ELYSIUM one, not a Tharsis fallback')
      .eq(`tag_${restored.board.trackIndexOfRoleOrThrow('power')}`);
  });
});
