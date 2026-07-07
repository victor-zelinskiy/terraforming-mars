import {expect} from 'chai';
import {TileType} from '../../src/common/TileType';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {Server} from '../../src/server/models/ServerModel';
import {AutomaMAEvaluation} from '../../src/server/automa/AutomaMAEvaluation';
import {AutomaMilestonesAwards} from '../../src/server/automa/AutomaMilestonesAwards';
import {Hoverlord} from '../../src/server/milestones/Hoverlord';
import {THARSIS_TRACK} from '../../src/server/automa/boards/TharsisMarsBot';
import {testAutomaGame} from './AutomaTestGame';

function milestone(game: IGame, name: string) {
  // The fork ships threshold variants under suffixed names (Terraformer29) —
  // match by prefix so the tests hold for either.
  const m = game.milestones.find((m) => m.name === name || m.name.startsWith(name));
  expect(m, `milestone ${name} in game`).is.not.undefined;
  return m!;
}

function placeTiles(game: IGame, player: IPlayer, tileType: TileType, count: number) {
  const spaces = game.board.spaces
    .filter((s) => s.spaceType === SpaceType.LAND && s.tile === undefined).slice(0, count);
  for (const space of spaces) {
    game.simpleAddTile(player, space, {tileType});
  }
}

function failedActions(game: IGame): number {
  return game.gameLog.filter((m) => m.message.includes('Failed Action')).length;
}

describe('AutomaMAEvaluation — Tharsis milestones', () => {
  it('Terraformer: 35 TR', () => {
    const [game, /* human */, bot] = testAutomaGame();
    expect(AutomaMAEvaluation.botMilestoneMet(milestone(game, 'Terraformer'), game)).is.false;
    bot.setTerraformRating(35);
    expect(AutomaMAEvaluation.botMilestoneMet(milestone(game, 'Terraformer'), game)).is.true;
  });

  it('Mayor: 3 city tiles', () => {
    const [game, /* human */, bot] = testAutomaGame();
    placeTiles(game, bot, TileType.CITY, 2);
    expect(AutomaMAEvaluation.botMilestoneMet(milestone(game, 'Mayor'), game)).is.false;
    placeTiles(game, bot, TileType.CITY, 1);
    expect(AutomaMAEvaluation.botMilestoneMet(milestone(game, 'Mayor'), game)).is.true;
  });

  it('Gardener: 3 greenery tiles', () => {
    const [game, /* human */, bot] = testAutomaGame();
    placeTiles(game, bot, TileType.GREENERY, 3);
    expect(AutomaMAEvaluation.botMilestoneMet(milestone(game, 'Gardener'), game)).is.true;
  });

  it('Builder: Building track space 8', () => {
    const [game] = testAutomaGame();
    game.automa!.board.tracks[THARSIS_TRACK.BUILDING].position = 7;
    expect(AutomaMAEvaluation.botMilestoneMet(milestone(game, 'Builder'), game)).is.false;
    game.automa!.board.tracks[THARSIS_TRACK.BUILDING].position = 8;
    expect(AutomaMAEvaluation.botMilestoneMet(milestone(game, 'Builder'), game)).is.true;
  });

  it('Planner: space 4 on every track — the Venus track is excluded', () => {
    const [game] = testAutomaGame({venusNextExtension: true});
    const automa = game.automa!;
    for (const track of automa.board.tracks) {
      track.position = 4;
    }
    // Venus back at 0 must NOT break Planner.
    automa.board.tracks[7].position = 0;
    expect(AutomaMAEvaluation.botMilestoneMet(milestone(game, 'Planner'), game)).is.true;
    automa.board.tracks[THARSIS_TRACK.SCIENCE].position = 3;
    expect(AutomaMAEvaluation.botMilestoneMet(milestone(game, 'Planner'), game)).is.false;
  });

  it('Hoverlord: 7 floaters', () => {
    const [game] = testAutomaGame({venusNextExtension: true});
    if (!game.milestones.some((m) => m.name === 'Hoverlord')) {
      game.milestones.push(new Hoverlord());
    }
    game.automa!.floaters = 6;
    expect(AutomaMAEvaluation.botMilestoneMet(milestone(game, 'Hoverlord'), game)).is.false;
    game.automa!.floaters = 7;
    expect(AutomaMAEvaluation.botMilestoneMet(milestone(game, 'Hoverlord'), game)).is.true;
  });
});

describe('AutomaMilestonesAwards — Claim Milestone action', () => {
  it('claims free of charge and journals the claim', () => {
    const [game, /* human */, bot] = testAutomaGame();
    bot.setTerraformRating(35);
    AutomaMilestonesAwards.claimMilestoneAction(game);
    expect(game.claimedMilestones).has.length(1);
    expect(game.claimedMilestones[0].player.id).eq(bot.id);
    expect(game.claimedMilestones[0].milestone.name.startsWith('Terraformer')).is.true;
    expect(bot.megaCredits).eq(0); // Free.
    expect(game.gameLog.some((m) => m.message.includes('claimed'))).is.true;
  });

  it('three milestones already claimed → Failed Action', () => {
    const [game, human, bot] = testAutomaGame();
    bot.setTerraformRating(35);
    for (const name of ['Mayor', 'Gardener', 'Builder']) {
      game.claimedMilestones.push({player: human, milestone: milestone(game, name)});
    }
    AutomaMilestonesAwards.claimMilestoneAction(game);
    expect(failedActions(game)).eq(1);
    expect(bot.megaCredits).eq(5);
    expect(game.claimedMilestones).has.length(3);
  });

  it('meets no criteria → Failed Action', () => {
    const [game, /* human */, bot] = testAutomaGame();
    AutomaMilestonesAwards.claimMilestoneAction(game);
    expect(failedActions(game)).eq(1);
    expect(bot.megaCredits).eq(5);
  });

  it('tiebreaker 1: prefers the milestone the human also meets', () => {
    const [game, human, bot] = testAutomaGame();
    placeTiles(game, bot, TileType.CITY, 3); // Bot meets Mayor…
    placeTiles(game, bot, TileType.GREENERY, 3); // …and Gardener.
    placeTiles(game, human, TileType.GREENERY, 3); // The human meets Gardener only.
    AutomaMilestonesAwards.claimMilestoneAction(game);
    expect(game.claimedMilestones[0].milestone.name).eq('Gardener');
  });

  it('tiebreaker 2: prefers the milestone the human is closest to meeting', () => {
    const [game, human, bot] = testAutomaGame();
    placeTiles(game, bot, TileType.CITY, 3);
    placeTiles(game, bot, TileType.GREENERY, 3);
    placeTiles(game, human, TileType.CITY, 2); // Human: Mayor 2/3, Gardener 0/3.
    AutomaMilestonesAwards.claimMilestoneAction(game);
    expect(game.claimedMilestones[0].milestone.name).eq('Mayor');
  });

  it('tiebreaker 3: leftmost', () => {
    const [game, /* human */, bot] = testAutomaGame();
    placeTiles(game, bot, TileType.CITY, 3);
    placeTiles(game, bot, TileType.GREENERY, 3);
    // The human is equally (not at all) close to both → leftmost = Mayor.
    AutomaMilestonesAwards.claimMilestoneAction(game);
    expect(game.claimedMilestones[0].milestone.name).eq('Mayor');
  });

  it('Hoverlord goes LAST in the leftmost order', () => {
    const [game] = testAutomaGame({venusNextExtension: true});
    if (!game.milestones.some((m) => m.name === 'Hoverlord')) {
      game.milestones.unshift(new Hoverlord()); // Even physically first…
    }
    const automa = game.automa!;
    automa.floaters = 7; // Meets Hoverlord.
    for (const track of automa.board.tracks) {
      track.position = 4; // …and Planner.
    }
    AutomaMilestonesAwards.claimMilestoneAction(game);
    // …the leftmost rule considers Hoverlord last: Planner wins.
    expect(game.claimedMilestones[0].milestone.name).eq('Planner');
  });
});

describe('ServerModel milestone scores for MarsBot', () => {
  it('shows the automa evaluation, not the card-based one', () => {
    const [game, /* human */, bot] = testAutomaGame();
    game.automa!.board.tracks[THARSIS_TRACK.BUILDING].position = 8;
    const models = Server.getMilestones(game);
    const builder = models.find((m) => m.name === 'Builder')!;
    const botScore = builder.scores.find((s) => s.color === bot.color)!;
    expect(botScore.score).eq(8);
    expect(botScore.claimable).is.true;
  });
});
