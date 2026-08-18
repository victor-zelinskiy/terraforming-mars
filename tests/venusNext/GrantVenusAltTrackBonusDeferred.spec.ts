import {expect} from 'chai';
import {TestPlayer} from '../TestPlayer';
import {GrantVenusAltTrackBonusDeferred} from '../../src/server/venusNext/GrantVenusAltTrackBonusDeferred';
import {AndOptions} from '../../src/server/inputs/AndOptions';
import {formatMessage, runAllActions} from '../TestingUtils';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {Birds} from '../../src/server/cards/base/Birds';
import {testGame} from '../TestGame';
import {cast} from '@/common/utils/utils';

describe('GrantVenusAltTrackBonusDeferred', () => {
  let player: TestPlayer;

  beforeEach(() => {
    [/* game */, player] = testGame(1);
  });

  it('grant single bonus', () => {
    const input = cast(new GrantVenusAltTrackBonusDeferred(player, 1, false).execute(), AndOptions);
    expect(input.venusBonusPrompt).to.deep.eq({kind: 'standard', baseCount: 1});
    input.options[0].cb(0);
    input.options[1].cb(0);
    input.options[2].cb(0);
    input.options[3].cb(0);
    input.options[4].cb(0);
    input.options[5].cb(1);
    input.cb(undefined);
    expect(player.megaCredits).eq(0);
    expect(player.steel).eq(0);
    expect(player.titanium).eq(0);
    expect(player.plants).eq(0);
    expect(player.energy).eq(0);
    expect(player.heat).eq(1);
  });

  it('reject too many bonuses', () => {
    const input = cast(new GrantVenusAltTrackBonusDeferred(player, 2, false).execute(), AndOptions);
    expect(formatMessage(input.title)).to.contain('Gain 2 resource(s) for your');
    input.options[0].cb(0);
    input.options[0].cb(0);
    input.options[0].cb(0);
    input.options[0].cb(0);
    input.options[0].cb(0);
    input.options[5].cb(3);

    expect(() => input.cb(undefined)).to.throw('Select 2 resource(s)');

    player.heat = 0;
    input.options[5].cb(2);
    input.cb(undefined);
    expect(player.heat).eq(2);
  });

  it('final bonus with NO resource card still grants the wild as a standard resource', () => {
    // The critical bug: a 30% bonus with a wild but no card to host it must NOT
    // silently drop the wild. The deferred yields a marked 'final' AndOptions for
    // base + 1 standard resources (the on-card tab is disabled client-side).
    const input = cast(new GrantVenusAltTrackBonusDeferred(player, 1, true).execute(), AndOptions);
    expect(input.venusBonusPrompt).to.deep.eq({kind: 'final', baseCount: 1, wildCardTargets: []});
    // base 1 + wild 1 (forced standard) = 2 standard resources.
    input.process({type: 'and', responses: [
      {type: 'amount', amount: 1}, // megacredits
      {type: 'amount', amount: 0},
      {type: 'amount', amount: 0},
      {type: 'amount', amount: 1}, // plants
      {type: 'amount', amount: 0},
      {type: 'amount', amount: 0},
    ]}, player);
    expect(player.megaCredits).eq(1);
    expect(player.plants).eq(1);
  });

  it('grants wild resource', () => {
    // With no resource card, the deferred yields the marked 'final' AndOptions
    // (base + 1 standard, wild forced to standard).
    cast(new GrantVenusAltTrackBonusDeferred(player, 0, true).execute(), AndOptions);

    const card = new Tardigrades();
    const otherCard = new Birds();
    player.playedCards.push(otherCard, card);

    const input = cast(new GrantVenusAltTrackBonusDeferred(player, 0, true).execute(), OrOptions);
    expect(input.venusBonusPrompt?.kind).eq('final');
    expect(input.venusBonusPrompt?.baseCount).eq(0);
    expect(input.venusBonusPrompt?.wildCardTargets).to.have.members([otherCard.name, card.name]);

    // Option 0 = "add the wild to a card" — an AndOptions wrapping the SelectCard
    // and the (here empty) base GainResources, so the premium modal can collect
    // both the card target AND the base resources in one OrOptions response.
    const onCard = cast(input.options[0], AndOptions);
    const selectCard = cast(onCard.options[0], SelectCard);
    expect(selectCard.cards).has.length(2);
    expect(card.resourceCount).eq(0);
    selectCard.cb([card]);
    expect(card.resourceCount).eq(1);
    expect(onCard.options[1]).instanceof(AndOptions);

    // Option 1 = the base standard resources with the wild folded in as standard.
    expect(input.options[1]).instanceof(AndOptions);
  });

  it('marks the wild with the per-candidate VP reading, and only where points respond', () => {
    // Tardigrades: 1 VP per 4 microbes. At 3 the wild is the fourth — a REAL
    // 0 → 1. Birds: 1 VP per animal — every animal moves it. A card whose
    // points ignore resources never appears in the box at all.
    const tardigrades = new Tardigrades();
    const birds = new Birds();
    player.playedCards.push(tardigrades, birds);
    tardigrades.resourceCount = 3;
    birds.resourceCount = 2;

    const input = cast(new GrantVenusAltTrackBonusDeferred(player, 1, true).execute(), OrOptions);
    expect(input.venusBonusPrompt?.wildCardVp).to.deep.eq({
      [tardigrades.name]: {from: 0, to: 1},
      [birds.name]: {from: 2, to: 3},
    });
    // The prompt itself is untouched by the preview: the eligible set and the
    // branch shapes are exactly what they were.
    expect(input.venusBonusPrompt?.wildCardTargets).to.have.members([tardigrades.name, birds.name]);
    const onCard = cast(input.options[0], AndOptions);
    expect(cast(onCard.options[0], SelectCard).cards).to.have.length(2);
  });

  it('final bonus with base resources: branch shapes + grants', () => {
    const card = new Tardigrades();
    player.playedCards.push(card);

    // base=2, wild → option 0 (on-card) yields card+1 AND 2 base standard;
    // option 1 (standard) yields base+1 = 3 standard.
    const input = cast(new GrantVenusAltTrackBonusDeferred(player, 2, true).execute(), OrOptions);
    // …and the AUTHORITATIVE per-candidate VP reading the console's shared
    // played-target selector renders. Tardigrades scores 1 VP per FOUR
    // microbes, so at 0 the wild moves nothing: the entry is present and
    // STATIC (`from === to`), which is what lets the client tell «this card's
    // points do not respond to a resource» (absent) from «they do, just not
    // this time» — without ever re-deriving a scoring rule.
    expect(input.venusBonusPrompt).to.deep.eq({
      kind: 'final',
      baseCount: 2,
      wildCardTargets: [card.name],
      wildCardVp: {[card.name]: {from: 0, to: 0}},
    });

    // Branch 0: AndOptions(SelectCard, GainResources(2)).
    const onCard = cast(input.options[0], AndOptions);
    cast(onCard.options[0], SelectCard).cb([card]);
    expect(card.resourceCount).eq(1);
    const onCardBase = cast(onCard.options[1], AndOptions);
    onCardBase.options[0].cb(2); // 2 megacredits
    onCardBase.options[1].cb(0);
    onCardBase.options[2].cb(0);
    onCardBase.options[3].cb(0);
    onCardBase.options[4].cb(0);
    onCardBase.options[5].cb(0);
    onCardBase.cb(undefined);
    expect(player.megaCredits).eq(2);

    // Branch 1: GainResources(3) — base (2) + wild folded in as standard (1).
    const standardWild = cast(input.options[1], AndOptions);
    expect(standardWild.options).has.length(6);
  });

  // The client (VenusBonusContent.vue) submits ONE InputResponse via onsave;
  // these assert the EXACT shapes it builds are accepted end-to-end.
  function amounts(units: Partial<Record<string, number>>) {
    return {
      type: 'and' as const,
      responses: ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat']
        .map((k) => ({type: 'amount' as const, amount: units[k] ?? 0})),
    };
  }

  it('standard bonus response shape grants resources', () => {
    const input = cast(new GrantVenusAltTrackBonusDeferred(player, 2, false).execute(), AndOptions);
    input.process(amounts({steel: 1, heat: 1}), player);
    expect(player.steel).eq(1);
    expect(player.heat).eq(1);
  });

  it('final wild→standard response shape grants base+1 standard', () => {
    const card = new Tardigrades();
    player.playedCards.push(card);
    const input = cast(new GrantVenusAltTrackBonusDeferred(player, 1, true).execute(), OrOptions);
    // base 1 + wild 1 folded as standard → 2 standard (1 M€, 1 plant).
    input.process({type: 'or', index: 1, response: amounts({megacredits: 1, plants: 1})}, player);
    expect(player.megaCredits).eq(1);
    expect(player.plants).eq(1);
    expect(card.resourceCount).eq(0);
  });

  it('final wild→card response shape grants card resource + base', () => {
    const card = new Tardigrades();
    player.playedCards.push(card);
    const input = cast(new GrantVenusAltTrackBonusDeferred(player, 1, true).execute(), OrOptions);
    input.process({
      type: 'or',
      index: 0,
      response: {type: 'and', responses: [{type: 'card', cards: [card.name]}, amounts({titanium: 1})]},
    }, player);
    runAllActions(player.game);
    expect(card.resourceCount).eq(1);
    expect(player.titanium).eq(1);
  });
});
