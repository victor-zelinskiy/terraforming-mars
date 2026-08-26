import {expect} from 'chai';
import {BoardName} from '../../src/common/boards/BoardName';
import {BonusCardId, MarsBotTrackRole} from '../../src/common/automa/AutomaTypes';
import {CardName} from '../../src/common/cards/CardName';
import {Resource} from '../../src/common/Resource';
import {SpaceName} from '../../src/common/boards/SpaceName';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {Tag} from '../../src/common/cards/Tag';
import {TileType} from '../../src/common/TileType';
import {AwardScorer} from '../../src/server/awards/AwardScorer';
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
import {AutomaTargeting} from '../../src/server/automa/AutomaTargeting';
import {AutomaTilePlacer} from '../../src/server/automa/AutomaTilePlacer';
import {HELLAS_SOUTH_POLE_REBATE} from '../../src/server/automa/AutomaPlacementBonus';
import {resolveBonusCard, routeBonusCard} from '../../src/server/automa/AutomaBonusCards';
import {Birds} from '../../src/server/cards/base/Birds';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {Algae} from '../../src/server/cards/base/Algae';
import {BigAsteroid} from '../../src/server/cards/base/BigAsteroid';
import {Venuphile} from '../../src/server/awards/Venuphile';
import {cast} from '../../src/common/utils/utils';
import {runAllActions} from '../TestingUtils';
import {testAutomaGame, testAutomaMultiplayerGame} from './AutomaTestGame';

const HELLAS = {boardName: BoardName.HELLAS} as const;

function hellasGame(options?: object): [IGame, ReturnType<typeof testAutomaGame>[1], IPlayer] {
  return testAutomaGame({...HELLAS, ...options});
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

/** Put every track at `value` — the baseline the "every track" milestones read. */
function setAllTracks(game: IGame, value: number): void {
  for (const track of game.automa!.board.tracks) {
    track.position = value;
  }
}

function milestone(game: IGame, name: string) {
  const found = game.milestones.find((m) => m.name === name);
  expect(found, `Hellas milestone ${name}`).is.not.undefined;
  return found!;
}

function award(game: IGame, name: string) {
  const found = game.awards.find((a) => a.name === name);
  expect(found, `Hellas award ${name}`).is.not.undefined;
  return found!;
}

function resolve(game: IGame, id: BonusCardId) {
  const outcome = resolveBonusCard(game, id);
  routeBonusCard(game, id, outcome);
  return outcome;
}

describe('HELLAS + MarsBot — setup', () => {
  it('is playable: the compatibility guard lets Hellas through', () => {
    const [game] = hellasGame();
    expect(game.gameOptions.boardName).eq(BoardName.HELLAS);
    expect(game.automa).is.not.undefined;
  });

  it('uses the HELLAS board — Jovian is paired with Science, Power stands alone', () => {
    const [game] = hellasGame();
    const board = game.automa!.board;
    expect(board.getTrackIndexForTag(Tag.JOVIAN)).eq(trackIndex(game, 'science'));
    expect(board.getTrackIndexForTag(Tag.SCIENCE)).eq(trackIndex(game, 'science'));
    expect(board.getTrackIndexForTag(Tag.POWER)).eq(trackIndex(game, 'power'));
    expect(board.getTrackOfRole('science')!.definition.tags).deep.eq([Tag.JOVIAN, Tag.SCIENCE]);
  });

  it('builds the bonus deck with B09, never B08 (Setup Guide v1.3 step 18)', () => {
    const deck = AutomaSetup.bonusDeckContents({boardName: BoardName.HELLAS} as never);
    expect(deck).contains(BonusCardId.B09_CORPORATE_COMPETITION_HELLAS);
    expect(deck).does.not.contain(BonusCardId.B08_CORPORATE_COMPETITION);
  });

  it('leaves Tharsis on B08', () => {
    const deck = AutomaSetup.bonusDeckContents({boardName: BoardName.THARSIS} as never);
    expect(deck).contains(BonusCardId.B08_CORPORATE_COMPETITION);
    expect(deck).does.not.contain(BonusCardId.B09_CORPORATE_COMPETITION_HELLAS);
  });

  it('appends the Venus track as the 8th, leaving the 7 map tracks in place', () => {
    const [game] = hellasGame({venusNextExtension: true});
    expect(game.automa!.board.tracks).has.length(8);
    expect(game.automa!.board.getTrackIndexOfRole('venus')).eq(7);
  });
});

describe('HELLAS + MarsBot — tag → track resolution', () => {
  it('a Jovian tag advances the Jovian/Science track', () => {
    const [game] = hellasGame();
    AutomaResolver.resolveTag(game, Tag.JOVIAN);
    // Space 1 is 'advance', which carries the marker to 2.
    expect(position(game, 'science')).eq(2);
    expect(position(game, 'power'), 'Power is untouched').eq(0);
  });

  it('a Science tag advances the SAME track', () => {
    const [game] = hellasGame();
    AutomaResolver.resolveTag(game, Tag.SCIENCE);
    expect(position(game, 'science')).eq(2);
  });

  it('a Power tag advances the separate Power track', () => {
    const [game] = hellasGame();
    AutomaResolver.resolveTag(game, Tag.POWER);
    // Hellas power spaces 1 and 2 are BOTH 'advance' → 1 → 2 → 3 (tr3).
    expect(position(game, 'power')).eq(3);
    expect(position(game, 'science'), 'Science is untouched').eq(0);
  });

  it('city and earth tags share one track; bio tags share another', () => {
    const [game] = hellasGame();
    const board = game.automa!.board;
    expect(board.getTrackIndexForTag(Tag.CITY)).eq(trackIndex(game, 'earth'));
    expect(board.getTrackIndexForTag(Tag.EARTH)).eq(trackIndex(game, 'earth'));
    for (const tag of [Tag.MICROBE, Tag.ANIMAL, Tag.PLANT]) {
      expect(board.getTrackIndexForTag(tag), tag).eq(trackIndex(game, 'bio'));
    }
  });

  it('a Wild tag still takes the furthest-back track, topmost on ties', () => {
    const [game] = hellasGame({preludeExtension: true});
    setAllTracks(game, 5);
    setPosition(game, 'bio', 1);
    AutomaResolver.resolveTag(game, Tag.WILD);
    expect(position(game, 'bio')).eq(2);
  });
});

describe('HELLAS + MarsBot — production regression follows the printed badges', () => {
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
      const [game] = hellasGame();
      setAllTracks(game, 4);
      AutomaTargeting.regressForProduction(game, resource, 1);
      expect(position(game, role), `${role} regressed`).eq(3);
      for (const other of game.automa!.board.tracks) {
        if (other.definition.role !== role) {
          expect(other.position, `${other.definition.role} untouched`).eq(4);
        }
      }
    });
  }

  it('the Jovian/Science track carries no production badge, so nothing regresses it', () => {
    const [game] = hellasGame();
    setAllTracks(game, 4);
    for (const [resource] of cases) {
      AutomaTargeting.regressForProduction(game, resource, 1);
    }
    expect(position(game, 'science'), 'combined tag metadata never leaks into regression').eq(4);
  });

  it('a regressed space does not fire its action again on the way back up', () => {
    const [game, , bot] = hellasGame();
    setPosition(game, 'power', 3); // Hellas power 3 = tr3.
    const tr = bot.terraformRating;
    AutomaTargeting.regressForProduction(game, Resource.ENERGY, 1);
    expect(position(game, 'power')).eq(2);
    AutomaResolver.advanceTrack(game, trackIndex(game, 'power'));
    expect(position(game, 'power')).eq(3);
    expect(bot.terraformRating, 'the re-entered tr3 space stays spent').eq(tr);
  });
});

describe('HELLAS + MarsBot — track action chains', () => {
  it('power 1 → advance → power 2 → advance → power 3 = +3 TR (one chain)', () => {
    const [game, , bot] = hellasGame();
    const tr = bot.terraformRating;
    AutomaResolver.advanceTrack(game, trackIndex(game, 'power'));
    expect(position(game, 'power')).eq(3);
    expect(bot.terraformRating).eq(tr + 3);
  });

  it('science 15 is an advance that lands on 16 (empty) — the chain stops there', () => {
    const [game] = hellasGame();
    setPosition(game, 'science', 14);
    AutomaResolver.advanceTrack(game, trackIndex(game, 'science'));
    expect(position(game, 'science')).eq(16);
  });

  it('building 7 claims a milestone; building 9 funds an award', () => {
    const [game, human, bot] = hellasGame();
    // Tactician: 35+ M€ — the bot meets it, the human does not.
    bot.megaCredits = 40;
    setPosition(game, 'building', 6);
    AutomaResolver.advanceTrack(game, trackIndex(game, 'building'));
    expect(game.claimedMilestones.map((c) => c.milestone.name)).contains('Tactician');

    // Space Baron reads the Space track — put the bot ahead of the human.
    setPosition(game, 'space', 9);
    human.playedCards.push(new Algae());
    setPosition(game, 'building', 8);
    AutomaResolver.advanceTrack(game, trackIndex(game, 'building'));
    expect(game.fundedAwards).has.length(1);
  });

  it('space 7 raises Venus with Venus Next, and is ignored without it', () => {
    const [withVenus] = hellasGame({venusNextExtension: true});
    setPosition(withVenus, 'space', 6);
    AutomaResolver.advanceTrack(withVenus, trackIndex(withVenus, 'space'));
    expect(withVenus.getVenusScaleLevel()).eq(2);

    const [without, , bot] = hellasGame();
    setPosition(without, 'space', 6);
    const mc = bot.megaCredits;
    AutomaResolver.advanceTrack(without, trackIndex(without, 'space'));
    expect(position(without, 'space'), 'the marker still moved').eq(7);
    expect(bot.megaCredits, 'an unused-expansion icon is ignored, never a Failed Action').eq(mc);
  });

  it('the floater cells pay with Venus OR Colonies, and are ignored with neither', () => {
    const [venus] = hellasGame({venusNextExtension: true});
    setPosition(venus, 'science', 4); // → 5 = floater2
    AutomaResolver.advanceTrack(venus, trackIndex(venus, 'science'));
    expect(venus.automa!.floaters).eq(2);

    const [colonies] = hellasGame({coloniesExtension: true});
    setPosition(colonies, 'science', 1); // → 2 = floater
    AutomaResolver.advanceTrack(colonies, trackIndex(colonies, 'science'));
    expect(colonies.automa!.floaters).eq(1);

    const [base, , bot] = hellasGame();
    setPosition(base, 'science', 1);
    const mc = bot.megaCredits;
    AutomaResolver.advanceTrack(base, trackIndex(base, 'science'));
    expect(base.automa!.floaters, 'ignored without either expansion').eq(0);
    expect(bot.megaCredits, 'and never a Failed Action').eq(mc);
  });

  it('Colonies unlocks the 2nd trade fleet on the POWER track\'s space 9, as printed on the board', () => {
    const [game] = hellasGame({coloniesExtension: true});
    setPosition(game, 'power', 8);
    AutomaResolver.advanceTrack(game, trackIndex(game, 'power'));
    expect(position(game, 'power')).eq(9);
    expect(game.automa!.secondFleetUnlocked).is.true;
  });
});

describe('HELLAS + MarsBot — milestones (Adding Expansions p.9)', () => {
  it('Diversifier: every track at 3', () => {
    const [game] = hellasGame();
    setAllTracks(game, 3);
    expect(AutomaMAEvaluation.botMilestoneMet(milestone(game, 'Diversifier'), game)).is.true;
    setPosition(game, 'bio', 2);
    expect(AutomaMAEvaluation.botMilestoneMet(milestone(game, 'Diversifier'), game)).is.false;
  });

  it('Diversifier with Venus: 7 of the eight tracks (one substitutable)', () => {
    const [game] = hellasGame({venusNextExtension: true});
    setAllTracks(game, 3);
    setPosition(game, 'venus', 0); // 7 of 8 — the Venus track is the substituted one.
    expect(AutomaMAEvaluation.botMilestoneMet(milestone(game, 'Diversifier'), game)).is.true;
    setPosition(game, 'bio', 2); // Only 6 of 8.
    expect(AutomaMAEvaluation.botMilestoneMet(milestone(game, 'Diversifier'), game)).is.false;
  });

  it('Tactician: 35 M€, not 34', () => {
    const [game, , bot] = hellasGame();
    bot.megaCredits = 34;
    expect(AutomaMAEvaluation.botMilestoneMet(milestone(game, 'Tactician'), game)).is.false;
    bot.megaCredits = 35;
    expect(AutomaMAEvaluation.botMilestoneMet(milestone(game, 'Tactician'), game)).is.true;
    expect(AutomaMAEvaluation.botMilestoneScore(milestone(game, 'Tactician'), game)).eq(35);
  });

  it('Polar Explorer: unchanged — 3 bot tiles on the two bottom rows only', () => {
    const [game, , bot] = hellasGame();
    const bottom = game.board.spaces.filter((s) => s.y >= 7 && s.spaceType !== 'colony' && s.tile === undefined);
    const elsewhere = game.board.spaces.filter((s) => s.y === 4 && s.spaceType !== 'colony' && s.tile === undefined);
    game.simpleAddTile(bot, bottom[0], {tileType: TileType.GREENERY});
    game.simpleAddTile(bot, bottom[1], {tileType: TileType.GREENERY});
    game.simpleAddTile(bot, elsewhere[0], {tileType: TileType.GREENERY});
    expect(AutomaMAEvaluation.botMilestoneMet(milestone(game, 'Polar Explorer'), game),
      'a tile outside the polar region does not count').is.false;
    game.simpleAddTile(bot, bottom[2], {tileType: TileType.GREENERY});
    expect(AutomaMAEvaluation.botMilestoneMet(milestone(game, 'Polar Explorer'), game)).is.true;
  });

  it('Energizer: the POWER track at 6, not 5', () => {
    const [game] = hellasGame();
    setPosition(game, 'power', 5);
    expect(AutomaMAEvaluation.botMilestoneMet(milestone(game, 'Energizer'), game)).is.false;
    setPosition(game, 'power', 6);
    expect(AutomaMAEvaluation.botMilestoneMet(milestone(game, 'Energizer'), game)).is.true;
  });

  it('Rim Settler: the JOVIAN/SCIENCE track at 6, not 5 — and the power track never stands in', () => {
    const [game] = hellasGame();
    setPosition(game, 'science', 5);
    setPosition(game, 'power', 18);
    expect(AutomaMAEvaluation.botMilestoneMet(milestone(game, 'Rim Settler'), game)).is.false;
    setPosition(game, 'science', 6);
    expect(AutomaMAEvaluation.botMilestoneMet(milestone(game, 'Rim Settler'), game)).is.true;
  });

  it('the claim PATH works, not just the evaluator', () => {
    const [game, , bot] = hellasGame();
    bot.megaCredits = 40; // Tactician.
    expect(AutomaMilestonesAwards.tryClaimMilestone(game)).is.true;
    expect(game.claimedMilestones.map((c) => c.milestone.name)).contains('Tactician');
    expect(game.claimedMilestones[0].player.isMarsBot).is.true;
  });
});

describe('HELLAS + MarsBot — awards (Adding Expansions p.9)', () => {
  function botScore(game: IGame, name: string): number {
    return new AwardScorer(game, award(game, name)).get(game.players.find((p) => p.isMarsBot)!);
  }

  it('Cultivator: unchanged — its real greeneries', () => {
    const [game, , bot] = hellasGame();
    const free = game.board.spaces.filter((s) => s.spaceType !== 'colony' && s.tile === undefined);
    game.simpleAddTile(bot, free[0], {tileType: TileType.GREENERY});
    game.simpleAddTile(bot, free[2], {tileType: TileType.GREENERY});
    expect(botScore(game, 'Cultivator')).eq(2);
  });

  it('Magnate: green cards in the bot\'s PLAYED PILE (it has no tableau)', () => {
    const [game] = hellasGame();
    game.automa!.playedPile.push(CardName.ALGAE, CardName.BIG_ASTEROID, CardName.BUSHES);
    // Algae and Bushes are AUTOMATED; Big Asteroid is an EVENT.
    expect(botScore(game, 'Magnate')).eq(2);
  });

  it('Space Baron: the SPACE track space — as printed on B09 ("Advance the space track")', () => {
    const [game] = hellasGame();
    setPosition(game, 'space', 7);
    setPosition(game, 'science', 18);
    expect(botScore(game, 'Space Baron')).eq(7);
  });

  it('Excentric: every 5 M€ counts as 1 resource', () => {
    const [game, , bot] = hellasGame();
    for (const [mc, expected] of [[0, 0], [4, 0], [5, 1], [9, 1], [10, 2], [14, 2]] as const) {
      bot.megaCredits = mc;
      expect(botScore(game, 'Excentric'), `${mc} M€`).eq(expected);
    }
  });

  it('Contractor: the Building track space', () => {
    const [game] = hellasGame();
    setPosition(game, 'building', 11);
    expect(botScore(game, 'Contractor')).eq(11);
  });

  it('Venuphile: the Venus track space, when Venus is in play', () => {
    const [game] = hellasGame({venusNextExtension: true});
    setPosition(game, 'venus', 4);
    expect(AutomaMAEvaluation.botAwardScore(new Venuphile(), game)).eq(4);
  });

  it('the funding decision compares against the best HUMAN (multiplayer)', () => {
    const [game, humans, bot] = testAutomaMultiplayerGame(3, HELLAS);
    const free = game.board.spaces.filter((s) => s.spaceType === SpaceType.LAND && s.tile === undefined);
    game.simpleAddTile(bot, free[0], {tileType: TileType.GREENERY});
    // The SECOND human is the one ahead — the bot must compare against the best
    // of them, not against the first seat.
    game.simpleAddTile(humans[1], free[2], {tileType: TileType.GREENERY});
    game.simpleAddTile(humans[1], free[4], {tileType: TileType.GREENERY});

    const cultivator = award(game, 'Cultivator');
    const scorer = new AwardScorer(game, cultivator);
    expect(scorer.get(bot)).eq(1);
    expect(scorer.get(humans[0])).eq(0);
    expect(scorer.get(humans[1])).eq(2);
    expect(AutomaMilestonesAwards.selectAwardToFund(game), 'behind the BEST human ⇒ not funded')
      .does.not.eq(cultivator);
  });
});

describe('HELLAS + MarsBot — B09 Corporate Competition', () => {
  /** Fund `name` for the human so it becomes the closest funded award. */
  function fund(game: IGame, human: IPlayer, name: string) {
    game.fundAward(human, award(game, name));
  }

  it('under 5 M€ the card does nothing', () => {
    const [game, human, bot] = hellasGame();
    fund(game, human, 'Contractor');
    bot.megaCredits = 4;
    expect(resolve(game, BonusCardId.B09_CORPORATE_COMPETITION_HELLAS)).eq('discard');
    expect(bot.megaCredits).eq(4);
    expect(position(game, 'building')).eq(0);
  });

  it('Contractor advances the Building track and costs exactly 5 M€', () => {
    const [game, human, bot] = hellasGame();
    fund(game, human, 'Contractor');
    bot.megaCredits = 6;
    resolve(game, BonusCardId.B09_CORPORATE_COMPETITION_HELLAS);
    expect(position(game, 'building')).eq(1);
    expect(bot.megaCredits).eq(1);
  });

  it('Space Baron advances the SPACE track (and its landed action fires)', () => {
    const [game, human, bot] = hellasGame();
    fund(game, human, 'Space Baron');
    bot.megaCredits = 6;
    resolve(game, BonusCardId.B09_CORPORATE_COMPETITION_HELLAS);
    // Space 1 is 'advance' → the marker lands on 2.
    expect(position(game, 'space')).eq(2);
    expect(position(game, 'science'), 'never the Jovian/Science track').eq(0);
    expect(bot.megaCredits).eq(1);
  });

  it('Cultivator places a greenery and raises oxygen', () => {
    const [game, human, bot] = hellasGame();
    fund(game, human, 'Cultivator');
    bot.megaCredits = 20;
    const oxygen = game.getOxygenLevel();
    resolve(game, BonusCardId.B09_CORPORATE_COMPETITION_HELLAS);
    expect(game.board.getGreeneries(bot)).has.length(1);
    expect(game.getOxygenLevel()).eq(oxygen + 1);
    // The Hellas tiebreak sends that greenery to the South Pole, which runs its
    // own printed transaction: −6 M€ and an ocean (whose 3 covered heat icons
    // pay 3 M€ back). Then the card's own 5 M€.
    expect(bot.megaCredits).eq(20 - 6 + 3 - 5);
  });

  it('Magnate reveals until a GREEN card and resolves that card as a bot project card', () => {
    const [game, human, bot] = hellasGame();
    fund(game, human, 'Magnate');
    bot.megaCredits = 6;
    // Top of the deck: an EVENT (skipped, discarded), then a GREEN card.
    game.projectDeck.drawPile.push(new Algae()); // drawn 2nd — AUTOMATED
    game.projectDeck.drawPile.push(new BigAsteroid()); // drawn 1st — EVENT
    resolve(game, BonusCardId.B09_CORPORATE_COMPETITION_HELLAS);

    expect(game.automa!.playedPile, 'the green card was resolved').contains(CardName.ALGAE);
    expect(game.automa!.playedPile, 'the rejected card was discarded, not played')
      .does.not.contain(CardName.BIG_ASTEROID);
    expect(game.projectDeck.discardPile.map((c) => c.name)).contains(CardName.BIG_ASTEROID);
    // Algae prints ONE microbe tag → the bio track advances.
    expect(position(game, 'bio')).eq(1);
    expect(bot.megaCredits).eq(1);
  });

  it('Eccentric takes the human\'s highest-scoring animal/microbe cube', () => {
    const [game, human, bot] = hellasGame();
    const birds = new Birds(); // 1 VP per animal
    birds.resourceCount = 2;
    const tardigrades = new Tardigrades(); // 1 VP per 4 microbes
    tardigrades.resourceCount = 3;
    human.playedCards.push(birds, tardigrades);
    fund(game, human, 'Excentric');
    bot.megaCredits = 6;
    resolve(game, BonusCardId.B09_CORPORATE_COMPETITION_HELLAS);
    expect(bot.megaCredits, 'the action resolved, so the 5 M€ was paid').eq(1);

    runAllActions(game);
    const selectCard = cast(human.popWaitingFor(), SelectCard);
    expect(selectCard.cards.map((c) => c.name), 'only the highest-scoring card is offered')
      .deep.eq([CardName.BIRDS]);
    selectCard.process({type: 'card', cards: [CardName.BIRDS]});
    expect(birds.resourceCount).eq(1);
  });

  it('Eccentric with nothing to remove is impossible — no payment, the fallback card runs', () => {
    const [game, human, bot] = hellasGame();
    fund(game, human, 'Excentric'); // The human holds no animal/microbe cube.
    bot.megaCredits = 6;
    setAllTracks(game, 3); // Diversifier: the milestone the drawn B04 will claim.
    game.automa!.bonusDeck = [{kind: 'bonus', id: BonusCardId.B04_OVERACHIEVEMENT}];
    resolve(game, BonusCardId.B09_CORPORATE_COMPETITION_HELLAS);
    expect(bot.megaCredits, 'an impossible helper never charges the 5 M€').eq(6);
    expect(game.automa!.bonusDeck, 'the secondary card was drawn').is.empty;
  });

  it('Venuphile advances the Venus track (added to every version of the card)', () => {
    const [game, human, bot] = hellasGame({venusNextExtension: true});
    const venuphile = game.awards.find((a) => a.name === 'Venuphile');
    expect(venuphile, 'Venus adds Venuphile to the Hellas award row').is.not.undefined;
    game.fundAward(human, venuphile!);
    bot.megaCredits = 6;
    resolve(game, BonusCardId.B09_CORPORATE_COMPETITION_HELLAS);
    expect(position(game, 'venus')).eq(1);
    expect(game.automa!.floaters, 'Venus space 1 is a floater').eq(1);
    expect(bot.megaCredits).eq(1);
  });

  it('without Venus, Venuphile is not even a candidate award', () => {
    const [game] = hellasGame();
    expect(game.awards.map((a) => a.name)).does.not.contain('Venuphile');
  });

  it('no funded award → no payment, and the fallback bonus card resolves as ONE flow', () => {
    const [game, , bot] = hellasGame();
    expect(game.fundedAwards).is.empty;
    bot.megaCredits = 6;
    setAllTracks(game, 3); // Diversifier: the milestone the drawn B04 will claim.
    game.automa!.bonusDeck = [{kind: 'bonus', id: BonusCardId.B04_OVERACHIEVEMENT}];
    resolve(game, BonusCardId.B09_CORPORATE_COMPETITION_HELLAS);
    expect(bot.megaCredits).eq(6);
    expect(game.claimedMilestones, 'the chained B04 resolved').has.length(1);
    expect(game.automa!.bonusDeck).is.empty;
  });

  it('funded but every helper impossible → fallback, still no payment', () => {
    const [game, human, bot] = hellasGame();
    fund(game, human, 'Contractor');
    bot.megaCredits = 6;
    setAllTracks(game, 3); // Diversifier: the milestone the drawn B04 will claim.
    setPosition(game, 'building', 18); // Maxed ⇒ the Contractor helper cannot advance.
    game.automa!.bonusDeck = [{kind: 'bonus', id: BonusCardId.B04_OVERACHIEVEMENT}];
    resolve(game, BonusCardId.B09_CORPORATE_COMPETITION_HELLAS);
    expect(bot.megaCredits).eq(6);
    expect(game.automa!.bonusDeck).is.empty;
  });

  it('a successful help pays 5 M€ exactly once, even with several funded awards', () => {
    const [game, human, bot] = hellasGame();
    fund(game, human, 'Contractor');
    fund(game, human, 'Space Baron');
    bot.megaCredits = 20;
    resolve(game, BonusCardId.B09_CORPORATE_COMPETITION_HELLAS);
    expect(bot.megaCredits).eq(15);
  });
});

describe('HELLAS + MarsBot — placement (Adding Expansions p.10 / p.11)', () => {
  function land(game: IGame, predicate: (space: Space) => boolean): Space {
    const space = game.board.spaces.find((s) =>
      s.spaceType === SpaceType.LAND && s.tile === undefined && predicate(s));
    expect(space, 'the fixture needs this space').is.not.undefined;
    return space!;
  }

  it('the Polar Region beats reward icons (step 2 before step 4)', () => {
    const [game] = hellasGame();
    const polarBare = land(game, (s) => s.y === 8 && s.bonus.length === 0);
    const richNorthern = land(game, (s) => s.y <= 3 && s.bonus.length === 2);
    expect(AutomaTilePlacer.breakTie(game, [richNorthern, polarBare])).eq(polarBare);
  });

  it('…but ocean adjacency still beats the Polar Region (step 1 before step 2)', () => {
    const [game, , bot] = hellasGame();
    const polarBare = land(game, (s) => s.y === 8 && s.bonus.length === 0);
    const oceanAdjacent = land(game, (s) => s.y <= 3 &&
      game.board.getAdjacentSpaces(s).some((a) => a.spaceType === SpaceType.OCEAN));
    const neighbour = game.board.getAdjacentSpaces(oceanAdjacent)
      .find((a) => a.spaceType === SpaceType.OCEAN)!;
    game.simpleAddTile(bot, neighbour, {tileType: TileType.OCEAN});
    expect(AutomaTilePlacer.breakTie(game, [oceanAdjacent, polarBare])).eq(oceanAdjacent);
  });

  it('Tharsis keeps only the two printed tiebreakers — the Polar step is Hellas-only', () => {
    const [game] = testAutomaGame();
    const bare = land(game, (s) => s.y === 8 && s.bonus.length === 0);
    const rich = land(game, (s) => s.y <= 3 && s.bonus.length === 2);
    expect(AutomaTilePlacer.breakTie(game, [rich, bare]), 'reward icons decide on Tharsis').eq(rich);
  });

  it('the South Pole outranks other 2-icon hexes while it is usable', () => {
    const [game, , bot] = hellasGame();
    bot.megaCredits = 10;
    const southPole = game.board.getSpaceOrThrow(SpaceName.HELLAS_OCEAN_TILE);
    const twoIcons = land(game, (s) => s.y >= 7 && s.bonus.length === 2);
    expect(AutomaTilePlacer.breakTie(game, [twoIcons, southPole])).eq(southPole);
  });

  it('and counts as a hex WITHOUT rewards once MarsBot cannot pay its 6 M€', () => {
    const [game, , bot] = hellasGame();
    bot.megaCredits = 5;
    const southPole = game.board.getSpaceOrThrow(SpaceName.HELLAS_OCEAN_TILE);
    const twoIcons = land(game, (s) => s.y >= 7 && s.bonus.length === 2);
    expect(AutomaTilePlacer.breakTie(game, [twoIcons, southPole])).eq(twoIcons);
  });

  it('…and once the oceans run out', () => {
    const [game, , bot] = hellasGame();
    bot.megaCredits = 30;
    for (const space of game.board.getAvailableSpacesForOcean(bot).slice(0, 9)) {
      game.simpleAddTile(bot, space, {tileType: TileType.OCEAN});
    }
    expect(game.canAddOcean()).is.false;
    const southPole = game.board.getSpaceOrThrow(SpaceName.HELLAS_OCEAN_TILE);
    const twoIcons = land(game, (s) => s.y >= 7 && s.bonus.length === 2 &&
      game.board.getAdjacentSpaces(s).every((a) => a.tile === undefined));
    expect(AutomaTilePlacer.breakTie(game, [twoIcons, southPole])).eq(twoIcons);
  });

  it('a greenery lands on the usable South Pole: an ocean is placed, +2 TR, −6 M€, no icon M€', () => {
    const [game, , bot] = hellasGame();
    bot.megaCredits = 20;
    const tr = bot.terraformRating;
    AutomaTilePlacer.placeGreenery(game);

    const southPole = game.board.getSpaceOrThrow(SpaceName.HELLAS_OCEAN_TILE);
    expect(southPole.tile?.tileType, 'the pole wins the Hellas tiebreak outright').eq(TileType.GREENERY);
    expect(game.board.getOceanSpaces()).has.length(1);
    // +1 for the greenery's oxygen step, +1 for the ocean.
    expect(bot.terraformRating).eq(tr + 2);
    // 20 − 6 for the pole, + 3 M€ for the ocean's own three covered heat icons.
    // The pole itself pays NO icon M€ ("it doesn't gain 2 resources").
    expect(bot.megaCredits).eq(20 - 6 + 3);
  });

  it('an UNUSABLE South Pole gains and loses nothing when the bot lands on it', () => {
    const [game, , bot] = hellasGame();
    bot.megaCredits = 5;
    const southPole = game.board.getSpaceOrThrow(SpaceName.HELLAS_OCEAN_TILE);
    const tr = bot.terraformRating;
    game.addGreenery(bot, southPole);
    expect(game.board.getOceanSpaces(), 'no ocean').is.empty;
    expect(bot.megaCredits, 'no 6 M€ charged, and no icon M€ paid').eq(5);
    expect(bot.terraformRating, 'only the greenery\'s own oxygen step').eq(tr + 1);
  });

  it('stays a legal MarsBot placement even when it cannot pay (Adding Expansions p.11)', () => {
    const [game, , bot] = hellasGame();
    bot.megaCredits = 5;
    expect(game.board.getAvailableSpacesForGreenery(bot).map((s) => s.id),
      'the human legality path drops the hex it cannot pay for')
      .does.not.contain(SpaceName.HELLAS_OCEAN_TILE);
    expect(game.board.getAvailableSpacesForGreenery(bot, {cost: HELLAS_SOUTH_POLE_REBATE, tr: {}})
      .map((s) => s.id), 'the rebate MarsBot places with brings it back')
      .contains(SpaceName.HELLAS_OCEAN_TILE);
  });
});

describe('HELLAS + MarsBot — a real game runs', () => {
  it('resolves 30 bot turns with Venus + Colonies + Prelude without a rules dead end', () => {
    const [game, human, bot] = hellasGame({
      venusNextExtension: true,
      coloniesExtension: true,
      preludeExtension: true,
    });
    for (let turn = 0; turn < 30; turn++) {
      AutomaController.takeTurn(game);
      runAllActions(game);
      // The bot's attacks hand the human a pick; answer it so the queue drains.
      const waiting = human.popWaitingFor();
      if (waiting instanceof SelectCard && waiting.cards.length > 0) {
        waiting.process({type: 'card', cards: [waiting.cards[0].name]});
        runAllActions(game);
      }
    }
    // Nothing to assert beyond "it played": every track is a real position, the
    // bot holds real M€ and TR, and no track ran off its own layout.
    for (const track of game.automa!.board.tracks) {
      expect(track.position, track.definition.role).is.at.least(0);
      expect(track.position, track.definition.role).is.at.most(track.maxPosition);
    }
    expect(bot.megaCredits).is.at.least(0);
    expect(bot.terraformRating).is.at.least(20);
  });
});

describe('HELLAS + MarsBot — serialization', () => {
  it('round-trips through the map profile: only the map NAME is stored', () => {
    const [game] = hellasGame({venusNextExtension: true});
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
    expect(restored.board.getTrackIndexForTag(Tag.JOVIAN))
      .eq(restored.board.trackIndexOfRoleOrThrow('science'));
  });
});
