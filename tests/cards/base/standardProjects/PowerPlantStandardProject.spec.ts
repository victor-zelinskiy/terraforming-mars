import {expect} from 'chai';
import {PowerPlantStandardProject} from '../../../../src/server/cards/base/standardProjects/PowerPlantStandardProject';
import {TestPlayer} from '../../../TestPlayer';
import {StandardTechnology} from '../../../../src/server/cards/base/StandardTechnology';
import {fakeCard, runAllActions, testGame} from '../../../TestingUtils';
import {CardName} from '../../../../src/common/cards/CardName';
import {Payment} from '../../../../src/common/inputs/Payment';

describe('PowerPlantStandardProjects', () => {
  let card: PowerPlantStandardProject;
  let player: TestPlayer;

  beforeEach(() => {
    card = new PowerPlantStandardProject();
    [/* game */, player/* , player2 */] = testGame(2);
  });

  // P62 · GB — the saving is what was saved: discounts past the project's price are recorded as the FACT.
  it('records each discount\'s REAL saving — a stack past the price spends the floor in table order', () => {
    const [game, blue] = testGame(1);
    blue.megaCredits = 11;
    const big = fakeCard({name: 'p62-sp-big' as CardName, getStandardProjectDiscount: () => 9});
    const small = fakeCard({name: 'p62-sp-small' as CardName, getStandardProjectDiscount: () => 5});
    blue.playedCards.push(big, small);
    expect(card.getAdjustedCost(blue)).eq(0);
    card.payAndExecute(blue, Payment.EMPTY);
    runAllActions(game);
    const saved = (name: string) => game.events.events
      .filter((e) => e.type === 'discount-applied' && e.source?.kind === 'card' && e.source.card === name)
      .map((e) => e.impact.megacreditsSaved);
    expect(saved('p62-sp-big'), 'the first card takes 9 of 11').deep.eq([9]);
    expect(saved('p62-sp-small'), 'the second takes the 2 left, never its offer of 5').deep.eq([2]);
    expect(blue.megaCredits, 'nothing paid').eq(11);
  });

  it('Should act', () => {
    player.megaCredits = 11;
    player.playedCards.push(new StandardTechnology());
    card.payAndExecute(player, Payment.of({megacredits: card.cost}));
    expect(player.production.energy).eq(1);
    expect(player.megaCredits).eq(3);
  });
});
