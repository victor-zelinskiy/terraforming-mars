import {expect} from 'chai';
import {testGame} from './TestGame';
import {addOcean, runAllActions} from './TestingUtils';
import {Predators} from '../src/server/cards/base/Predators';
import {GanymedeColony} from '../src/server/cards/base/GanymedeColony';
import {AICentral} from '../src/server/cards/base/AICentral';
import {CardName} from '../src/common/cards/CardName';
import {CardVictoryPointsKind} from '../src/common/game/VictoryPointsBreakdown';

describe('calculateVictoryPoints', () => {
  it('attributes terraform rating by reason', () => {
    const [game, player] = testGame(2);

    game.increaseOxygenLevel(player, 2); // +2 TR (oxygen)
    addOcean(player); // +1 TR (oceans)
    addOcean(player); // +1 TR (oceans)
    player.increaseTerraformRating(3); // +3 TR (cards / effects)
    runAllActions(game);

    expect(player.terraformRating).eq(27); // 20 base + 2 + 2 + 3

    const tr = player.getVictoryPoints().terraformRatingBreakdown;
    expect(tr.base).eq(20);
    expect(tr.oxygen).eq(2);
    expect(tr.oceans).eq(2);
    expect(tr.cards).eq(3);
    expect(tr.temperature).eq(0);
    expect(tr.venus).eq(0);

    // The six parts ALWAYS reconcile to the displayed terraform rating.
    const sum = tr.base + tr.temperature + tr.oxygen + tr.oceans + tr.venus + tr.cards;
    expect(sum).eq(player.terraformRating);
  });

  it('explicit base/handicap + cardEntries reconcile with the cards total', () => {
    const [game, player] = testGame(2);
    player.increaseTerraformRating(3); // direct card / effect TR
    runAllActions(game);
    const tr = player.getVictoryPoints().terraformRatingBreakdown;
    expect(tr.baseRating).eq(20);
    expect(tr.handicap).eq(0);
    expect(tr.base).eq(20); // back-compat = baseRating + handicap
    expect(tr.cards).eq(3);
    // Σ cardEntries === cards.
    expect(tr.cardEntries.reduce((a, e) => a + e.amount, 0)).eq(3);
  });

  it('puts the Venus 8% threshold TR bonus in Cards & effects, never the base', () => {
    const [game, player] = testGame(2, {venusNextExtension: true});
    // Raise Venus past 16% (the TR threshold). Max 3 increments per call → 3×3 = 18%.
    game.increaseVenusScaleLevel(player, 3);
    game.increaseVenusScaleLevel(player, 3);
    game.increaseVenusScaleLevel(player, 3);
    runAllActions(game);
    const tr = player.getVictoryPoints().terraformRatingBreakdown;
    // The base stays clean — the bonus did NOT leak into it.
    expect(tr.baseRating).eq(20);
    expect(tr.base).eq(20);
    expect(tr.venus).eq(9); // the 9 parameter steps
    expect(tr.cards).eq(1); // the +1 threshold bonus
    const bonus = tr.cardEntries.find((e) => e.sourceType === 'venusTrackBonus');
    expect(bonus?.amount).eq(1);
    // Everything still reconciles to the displayed rating.
    const sum = tr.base + tr.temperature + tr.oxygen + tr.oceans + tr.venus + tr.cards;
    expect(sum).eq(player.terraformRating);
  });

  it('does not attribute global-parameter TR to the cards bucket', () => {
    const [game, player] = testGame(2);
    game.increaseTemperature(player, 1);
    runAllActions(game);
    expect(player.terraformRatingFromCards).eq(0);
    expect(player.getVictoryPoints().terraformRatingBreakdown.temperature).is.greaterThan(0);
  });

  it('classifies card victory points by family', () => {
    const [, player] = testGame(2);

    const predators = new Predators(); // {resourcesHere: {}} → resource
    predators.resourceCount = 3;
    const ganymede = new GanymedeColony(); // {tag: JOVIAN} → conditional
    const ai = new AICentral(); // victoryPoints: 1 → fixed
    player.playedCards.push(predators, ganymede, ai);

    const details = player.getVictoryPoints().detailsCards;
    const kindOf = (name: CardName): CardVictoryPointsKind | undefined =>
      details.find((d) => d.cardName === name)?.kind;

    expect(kindOf(CardName.PREDATORS)).eq('resource');
    expect(kindOf(CardName.GANYMEDE_COLONY)).eq('conditional');
    expect(kindOf(CardName.AI_CENTRAL)).eq('fixed');
  });
});
