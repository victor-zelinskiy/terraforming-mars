import {expect} from 'chai';
import {testGame} from './TestGame';
import {addCity, addGreenery, addOcean, runAllActions} from './TestingUtils';
import {Predators} from '../src/server/cards/base/Predators';
import {GanymedeColony} from '../src/server/cards/base/GanymedeColony';
import {AICentral} from '../src/server/cards/base/AICentral';
import {Ants} from '../src/server/cards/base/Ants';
import {SearchForLife} from '../src/server/cards/base/SearchForLife';
import {Tag} from '../src/common/cards/Tag';
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
    expect((tr.cardEntries ?? []).reduce((a, e) => a + e.amount, 0)).eq(3);
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
    const bonus = (tr.cardEntries ?? []).find((e) => e.sourceType === 'venusTrackBonus');
    expect(bonus?.amount).eq(1);
    // Everything still reconciles to the displayed rating.
    const sum = tr.base + tr.temperature + tr.oxygen + tr.oceans + tr.venus + tr.cards;
    expect(sum).eq(player.terraformRating);
  });

  it('puts the TR Boost handicap in the explicit Handicap part, not "Other"', () => {
    const [game, player] = testGame(2);
    player.handicap = 3;
    player.setTerraformRating(player.terraformRating + 3); // setup applies the boost
    player.increaseTerraformRating(2); // a normal card/effect TR
    runAllActions(game);
    const tr = player.getVictoryPoints().terraformRatingBreakdown;
    expect(tr.baseRating).eq(20);
    expect(tr.handicap).eq(3); // the TR Boost → Handicap ("Фора")
    expect(tr.base).eq(23); // baseRating + handicap (back-compat)
    expect(tr.cards).eq(2);
    // No "Other / untracked sources" leak.
    expect((tr.cardEntries ?? []).some((e) => e.sourceType === 'legacyUnknown')).eq(false);
    // Reconciles to the displayed rating (20 + 3 + 2 = 25).
    const sum = (tr.baseRating ?? 0) + (tr.handicap ?? 0) + tr.temperature + tr.oxygen + tr.oceans + tr.venus + tr.cards;
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

  // ── the score-explorer read model: formula + live operands ──────────────
  it('captures the per-unit formula with the live operand (resources)', () => {
    const [, player] = testGame(2);
    const ants = new Ants(); // {resourcesHere: {}, per: 2}
    ants.resourceCount = 7;
    player.playedCards.push(ants);

    const detail = player.getVictoryPoints().detailsCards.find((d) => d.cardName === CardName.ANTS);
    expect(detail?.victoryPoint).eq(3); // floor(7 / 2)
    expect(detail?.mechanics).deep.eq({
      shape: 'per', each: 1, per: 2, counted: 7, unit: 'resources', resourceType: 'Microbe',
    });
  });

  it('captures tag formulas with the SERVER count (jovian)', () => {
    const [, player] = testGame(2);
    const ganymede = new GanymedeColony(); // 1 VP per jovian tag (its own included)
    player.playedCards.push(ganymede);

    const detail = player.getVictoryPoints().detailsCards.find((d) => d.cardName === CardName.GANYMEDE_COLONY);
    const m = detail?.mechanics;
    expect(m?.shape).eq('per');
    expect(m?.unit).eq('tags');
    expect(m?.tag).eq(Tag.JOVIAN);
    expect(m?.counted).eq(1);
    expect(detail?.victoryPoint).eq(1);
  });

  it('marks fixed and special shapes honestly', () => {
    const [, player] = testGame(2);
    const ai = new AICentral(); // victoryPoints: 1
    const search = new SearchForLife(); // 'special' + science resources
    search.resourceCount = 1;
    player.playedCards.push(ai, search);

    const details = player.getVictoryPoints().detailsCards;
    expect(details.find((d) => d.cardName === CardName.AI_CENTRAL)?.mechanics).deep.eq({shape: 'fixed'});
    const special = details.find((d) => d.cardName === CardName.SEARCH_FOR_LIFE)?.mechanics;
    expect(special?.shape).eq('special');
    expect(special?.counted).eq(1); // the honest stored amount — no formula claim
  });

  it('per-shape mechanics reconcile with the scored number on every row', () => {
    const [, player] = testGame(2);
    const ants = new Ants();
    ants.resourceCount = 5;
    const predators = new Predators();
    predators.resourceCount = 2;
    player.playedCards.push(ants, predators, new GanymedeColony(), new AICentral());

    for (const d of player.getVictoryPoints().detailsCards) {
      const m = d.mechanics;
      if (m?.shape === 'per') {
        expect(Math.floor((m.counted ?? 0) * (m.each ?? 1) / (m.per ?? 1))).eq(d.victoryPoint);
      }
    }
  });

  it('lists every owned city with its own greenery contribution', () => {
    const [game, player, player2] = testGame(2);
    const citySpace = game.board.getAvailableSpacesOnLand(player)[0];
    addCity(player, citySpace.id);
    const adjacent = game.board.getAdjacentSpaces(citySpace).filter((s) => s.spaceType === 'land' && s.tile === undefined);
    addGreenery(player, adjacent[0].id);
    // An OPPONENT's greenery counts for the city too (the printed rule).
    addGreenery(player2, adjacent[1].id);
    // A second city with no greenery neighbours is an honest 0 row.
    const lone = game.board.getAvailableSpacesOnLand(player)
      .find((s) => game.board.getAdjacentSpaces(s).every((a) => a.tile === undefined));
    expect(lone).not.eq(undefined);
    addCity(player, lone!.id);

    const breakdown = player.getVictoryPoints();
    const cities = breakdown.detailsCities ?? [];
    expect(cities).to.have.length(2);
    expect(cities.reduce((a, c) => a + c.points, 0)).eq(breakdown.city);
    expect(cities.find((c) => c.spaceId === citySpace.id)?.points).eq(2);
    expect(cities.find((c) => c.spaceId === lone!.id)?.points).eq(0);
  });
});
