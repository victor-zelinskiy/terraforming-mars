import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {TileType} from '../../src/common/TileType';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {IGame} from '../../src/server/IGame';
import {IPlayer} from '../../src/server/IPlayer';
import {TestPlayer} from '../TestPlayer';
import {AutomaTestOptions, testAutomaGame} from './AutomaTestGame';

function placeTiles(game: IGame, player: IPlayer, tileType: TileType, count: number) {
  const spaces = game.board.spaces
    .filter((s) => s.spaceType === SpaceType.LAND && s.tile === undefined).slice(0, count);
  for (const space of spaces) {
    game.simpleAddTile(player, space, {tileType});
  }
}

/** A hard-mode game where the bot meets Terraformer + Mayor + Gardener and holds `mc`. */
function pressuredGame(options: AutomaTestOptions, mc: number, idSuffix = '') {
  const [game, human, bot] = testAutomaGame(options, idSuffix);
  bot.setTerraformRating(35);
  placeTiles(game, bot, TileType.CITY, 3);
  placeTiles(game, bot, TileType.GREENERY, 3);
  bot.megaCredits = mc;
  game.playerIsFinishedWithResearchPhase(human);
  return {game, human, bot};
}

function botTakesOneTurn(game: IGame, human: TestPlayer) {
  human.popWaitingFor();
  game.playerIsFinishedTakingActions(); // Hand the turn to the bot (human did not pass).
}

describe('Hard difficulty — first-turn milestone pressure (rulebook p.11)', () => {
  it('8 M€ + meets 3 with none claimed: claims a milestone and loses 8 M€, then plays its card', () => {
    const {game, human, bot} = pressuredGame({difficulty: 'hard'}, 8);
    game.automa!.actionDeck = [{kind: 'project', name: CardName.GENE_REPAIR}];
    botTakesOneTurn(game, human);

    expect(game.claimedMilestones).has.length(1);
    expect(game.claimedMilestones[0].player.id).eq(bot.id);
    expect(bot.megaCredits).eq(0); // Paid 8.
    expect(game.automa!.playedPile).contains(CardName.GENE_REPAIR); // The turn proceeded as normal.
  });

  it('with 7 M€ nothing happens', () => {
    const {game, human, bot} = pressuredGame({difficulty: 'hard'}, 7);
    game.automa!.actionDeck = [{kind: 'project', name: CardName.GENE_REPAIR}];
    botTakesOneTurn(game, human);
    expect(game.claimedMilestones).is.empty;
    expect(bot.megaCredits).eq(7);
  });

  it('meets only 2 with none claimed: not enough pressure', () => {
    const [game, human, bot] = testAutomaGame({difficulty: 'hard'});
    bot.setTerraformRating(35);
    placeTiles(game, bot, TileType.CITY, 3); // Terraformer + Mayor only.
    bot.megaCredits = 8;
    game.playerIsFinishedWithResearchPhase(human);
    game.automa!.actionDeck = [{kind: 'project', name: CardName.GENE_REPAIR}];
    botTakesOneTurn(game, human);
    expect(game.claimedMilestones).is.empty;
    expect(bot.megaCredits).eq(8);
  });

  it('one claimed + meets 2 qualifies', () => {
    const [game, human, bot] = testAutomaGame({difficulty: 'hard'});
    bot.setTerraformRating(35);
    placeTiles(game, bot, TileType.CITY, 3);
    bot.megaCredits = 8;
    const gardener = game.milestones.find((m) => m.name === 'Gardener')!;
    game.claimedMilestones.push({player: human, milestone: gardener});
    game.playerIsFinishedWithResearchPhase(human);
    game.automa!.actionDeck = [{kind: 'project', name: CardName.GENE_REPAIR}];
    botTakesOneTurn(game, human);
    expect(game.claimedMilestones).has.length(2);
    expect(bot.megaCredits).eq(0);
  });

  it('runs at most once per generation', () => {
    const {game, human, bot} = pressuredGame({difficulty: 'hard'}, 16);
    game.automa!.actionDeck = [
      {kind: 'project', name: CardName.GENE_REPAIR},
      {kind: 'project', name: CardName.GENE_REPAIR},
    ];
    botTakesOneTurn(game, human); // Turn 1: claims (16 → 8).
    expect(game.claimedMilestones).has.length(1);
    botTakesOneTurn(game, human); // Turn 2, same generation: no second claim.
    expect(game.claimedMilestones).has.length(1);
    expect(bot.megaCredits).eq(8);
  });

  it('Normal never claims this way', () => {
    const {game, human, bot} = pressuredGame({difficulty: 'normal'}, 8, '-n');
    game.automa!.actionDeck = [{kind: 'project', name: CardName.GENE_REPAIR}];
    botTakesOneTurn(game, human);
    expect(game.claimedMilestones).is.empty;
    expect(bot.megaCredits).eq(8);
  });

  it('Brutal includes the Hard rule', () => {
    const {game, human, bot} = pressuredGame({difficulty: 'brutal'}, 8, '-b');
    game.automa!.actionDeck = [{kind: 'project', name: CardName.GENE_REPAIR}];
    botTakesOneTurn(game, human);
    expect(game.claimedMilestones).has.length(1);
    expect(bot.megaCredits).eq(0);
  });
});
