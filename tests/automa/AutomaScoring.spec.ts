import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {TileType} from '../../src/common/TileType';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {AutomaScoring} from '../../src/server/automa/AutomaScoring';
import {fakeCard} from '../TestingUtils';
import {testAutomaGame} from './AutomaTestGame';

describe('AutomaScoring', () => {
  it('the base M€ → VP ladder: ≤12→8 … 19→1', () => {
    expect(AutomaScoring.mcPerVp(1, false)).eq(8);
    expect(AutomaScoring.mcPerVp(12, false)).eq(8);
    expect(AutomaScoring.mcPerVp(13, false)).eq(7);
    expect(AutomaScoring.mcPerVp(14, false)).eq(6);
    expect(AutomaScoring.mcPerVp(15, false)).eq(5);
    expect(AutomaScoring.mcPerVp(16, false)).eq(4);
    expect(AutomaScoring.mcPerVp(17, false)).eq(3);
    expect(AutomaScoring.mcPerVp(18, false)).eq(2);
    expect(AutomaScoring.mcPerVp(19, false)).eq(1);
  });

  it('the Prelude ladder shifts two generations earlier: ≤10→8 … 17→1', () => {
    expect(AutomaScoring.mcPerVp(10, true)).eq(8);
    expect(AutomaScoring.mcPerVp(11, true)).eq(7);
    expect(AutomaScoring.mcPerVp(13, true)).eq(5);
    expect(AutomaScoring.mcPerVp(17, true)).eq(1);
  });

  it('non-negative VP icon classification', () => {
    expect(AutomaScoring.hasNonNegativeVpIcon(fakeCard({victoryPoints: 2}))).is.true;
    expect(AutomaScoring.hasNonNegativeVpIcon(fakeCard({victoryPoints: 0}))).is.true;
    expect(AutomaScoring.hasNonNegativeVpIcon(fakeCard({victoryPoints: -1}))).is.false;
    expect(AutomaScoring.hasNonNegativeVpIcon(fakeCard({}))).is.false;
    expect(AutomaScoring.hasNonNegativeVpIcon(fakeCard({victoryPoints: {resourcesHere: {}, each: 1, per: 2}}))).is.true;
    expect(AutomaScoring.hasNonNegativeVpIcon(fakeCard({victoryPoints: {cities: {}, all: true, each: -1}}))).is.false;
  });

  it('remaining M€ converts by the final generation, rounded down (rulebook example: 24 M€, gen 14 → 4 VP)', () => {
    const [game, /* human */, bot] = testAutomaGame();
    bot.megaCredits = 24;
    game.generation = 14;
    const parts = AutomaScoring.automaVictoryPoints(game);
    expect(parts.mcToVp).eq(4);
    expect(parts.mcPerVp).eq(6);
  });

  it('Normal games earn no card VP; Hard counts non-negative VP icons in the played pile', () => {
    const [game] = testAutomaGame();
    // Gene Repair prints VP 2; an Asteroid event prints none.
    game.automa!.playedPile.push(CardName.GENE_REPAIR, CardName.ASTEROID);
    expect(AutomaScoring.automaVictoryPoints(game).cardVp).eq(0);

    const [hardGame] = testAutomaGame({difficulty: 'hard'}, '-hard');
    hardGame.automa!.playedPile.push(CardName.GENE_REPAIR, CardName.ASTEROID);
    expect(AutomaScoring.automaVictoryPoints(hardGame).cardVp).eq(1);
  });

  it('Neural Instance: +1 VP per adjacent space that is empty or MarsBot\'s', () => {
    const [game, human, bot] = testAutomaGame();
    const spot = game.board.spaces.find((s) =>
      s.spaceType === SpaceType.LAND &&
      game.board.getAdjacentSpaces(s).length === 6 &&
      game.board.getAdjacentSpaces(s).every((adj) => adj.spaceType === SpaceType.LAND))!;
    game.simpleAddTile(bot, spot, {tileType: TileType.NEURAL_INSTANCE});
    game.automa!.neuralInstanceSpaceId = spot.id;

    const neighbors = game.board.getAdjacentSpaces(spot);
    game.simpleAddTile(human, neighbors[0], {tileType: TileType.CITY}); // Human: doesn't count.
    game.simpleAddTile(bot, neighbors[1], {tileType: TileType.GREENERY}); // Bot: counts.
    // 4 remaining empty neighbors count too.
    expect(AutomaScoring.automaVictoryPoints(game).neuralInstance).eq(5);
  });

  it('the bot\'s full breakdown carries the automa parts and they feed the total', () => {
    const [/* game */, /* human */, bot] = testAutomaGame();
    bot.megaCredits = 16; // Gen 1 → rate 8 → 2 VP.
    const breakdown = bot.getVictoryPoints();
    expect(breakdown.automa).is.not.undefined;
    expect(breakdown.automa!.mcToVp).eq(2);
    expect(breakdown.automa!.mcPerVp).eq(8);
    expect(breakdown.total).eq(breakdown.terraformRating + 2);
  });

  it('a human breakdown never carries automa parts', () => {
    const [/* game */, human] = testAutomaGame();
    expect(human.getVictoryPoints().automa).is.undefined;
  });
});
