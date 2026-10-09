import {expect} from 'chai';
import {ShipmentToEarth} from '../../../src/server/cards/promo/ShipmentToEarth';
import {testGame} from '../../TestGame';
import {cast} from '../../../src/common/utils/utils';
import {formatMessage, runAllActions, setRulingParty} from '../../TestingUtils';
import {ModularFloodgates} from '../../../src/server/cards/delta/ModularFloodgates';
import {MonsInsurance} from '../../../src/server/cards/promo/MonsInsurance';
import {EarthEmbassy} from '../../../src/server/cards/moon/EarthEmbassy';
import {Playwrights} from '../../../src/server/cards/community/Playwrights';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Tag} from '../../../src/common/cards/Tag';
import {unplayableReasons} from '../../../src/server/models/unplayableReasons';

describe('ShipmentToEarth', () => {
  const canPlayRuns = [
    {plants: 2, steel: 3, expected: false},
    {plants: 3, steel: 2, expected: false},
    {plants: 3, steel: 3, expected: true},
  ] as const;
  for (const run of canPlayRuns) {
    it('canPlay: ' + JSON.stringify(run), () => {
      const card = new ShipmentToEarth();
      const [/* game */, player] = testGame(2);

      player.megaCredits = card.cost;
      player.plants = run.plants;
      player.steel = run.steel;

      expect(player.canPlay(card)).eq(run.expected);
    });
  }

  it('play', () => {
    const card = new ShipmentToEarth();
    const [/* game */, player] = testGame(2);

    player.plants = 5;
    player.steel = 4;
    player.tagsForTest = {earth: 3};
    const tr = player.terraformRating;

    cast(card.play(player), undefined);

    expect(player.plants).eq(2);
    expect(player.steel).eq(1);
    expect(player.terraformRating).eq(tr + 3);
    expect(player.megaCredits).eq(6);
  });

  it('play: no Earth tags — the shipment and the TR still happen, no M€', () => {
    const card = new ShipmentToEarth();
    const [/* game */, player] = testGame(2);

    player.plants = 3;
    player.steel = 3;
    const tr = player.terraformRating;

    cast(card.play(player), undefined);

    expect(player.plants).eq(0);
    expect(player.steel).eq(0);
    expect(player.terraformRating).eq(tr + 3);
    expect(player.megaCredits).eq(0);
  });

  it('the shipment leaves through the stock (the journal sees it)', () => {
    const card = new ShipmentToEarth();
    const [game, player] = testGame(2);
    player.plants = 3;
    player.steel = 3;
    game.gameLog.length = 0;

    cast(card.play(player), undefined);

    const lines = game.gameLog.map(formatMessage);
    expect(lines.some((line) => line.includes('plants')), lines.join('\n')).is.true;
    expect(lines.some((line) => line.includes('steel')), lines.join('\n')).is.true;
  });

  it('unplayableReason names ONE blocker, in the printed order', () => {
    const card = new ShipmentToEarth();
    const [/* game */, player] = testGame(2);

    player.plants = 2;
    player.steel = 2;
    expect(card.unplayableReason(player)).deep.eq({type: 'resource', message: 'Not enough plants', resource: 'plants', current: 2});

    player.plants = 3;
    expect(card.unplayableReason(player)).deep.eq({type: 'resource', message: 'Not enough steel', resource: 'steel', current: 2});

    player.steel = 3;
    expect(card.unplayableReason(player)).is.undefined;
  });

  it('cardPlayPreview shows the whole trade: the shipment as costs, the TR and the M€ as gains', () => {
    const card = new ShipmentToEarth();
    const [/* game */, player] = testGame(2);
    player.plants = 5;
    player.steel = 4;
    player.tagsForTest = {earth: 3};
    const tr = player.terraformRating;

    const preview = card.cardPlayPreview(player);
    expect(preview.kind).eq('bespoke');
    expect(preview.branches).has.length(1);
    const effects = preview.branches[0].effects;

    const costs = effects.filter((e) => e.direction === 'cost');
    expect(costs.map((e) => [e.icon, e.amount, e.current, e.resulting])).deep.eq([
      ['plants', 3, 5, 2],
      ['steel', 3, 4, 1],
    ]);

    const gains = effects.filter((e) => e.direction === 'gain');
    const trChip = gains.find((e) => e.icon === 'tr');
    expect(trChip?.amount).eq(3);
    expect(trChip?.current).eq(tr);
    expect(trChip?.resulting).eq(tr + 3);
    const mcChip = gains.find((e) => e.icon === 'megacredits');
    expect(mcChip?.amount, 'two M€ per Earth tag, three tags').eq(6);
  });
});

/**
 * THE PREMIUM PASS (docs/claude/prompts/promo-x87-shipment-to-earth.md § 1) — the
 * reading rules the base fence only wrote, pinned one by one.
 */
describe('ShipmentToEarth — the reading rules', () => {
  it('rule 1: the shipment is an EFFECT, not a payment — steel stored on Modular Floodgates (DP11) does not count', () => {
    const card = new ShipmentToEarth();
    const [/* game */, player] = testGame(2);
    const floodgates = new ModularFloodgates();
    floodgates.resourceCount = 5;
    player.playedCards.push(floodgates);
    player.megaCredits = card.cost;
    player.plants = 3;
    player.steel = 2;

    expect(player.getSpendable('floodgateSteel'), 'the floodgates hold 5 steel').eq(5);
    expect(player.canPlay(card), 'two steel on the board + five on the card: the shipment leaves the board only').is.false;
    expect(card.unplayableReason(player)).deep.eq({type: 'resource', message: 'Not enough steel', resource: 'steel', current: 2});

    player.steel = 3;
    expect(player.canPlay(card)).is.true;
    cast(card.play(player), undefined);
    expect(player.steel, 'the board\'s steel left').eq(0);
    expect(floodgates.resourceCount, 'the floodgates\' steel stayed').eq(5);
  });

  it('rule 2: a loss of one\'s own is not an attack — an opponent\'s Mons Insurance does not pay, no protection is asked', () => {
    const card = new ShipmentToEarth();
    const [game, player, insurer] = testGame(2);
    insurer.playedCards.push(new MonsInsurance());
    game.monsInsuranceOwner = insurer;
    insurer.megaCredits = 10;
    player.megaCredits = 10;
    player.plants = 3;
    player.steel = 3;

    cast(card.play(player), undefined);
    runAllActions(game);

    expect(player.plants).eq(0);
    expect(player.steel).eq(0);
    expect(player.megaCredits, 'no insurance paid to the shipper (no Earth tags: the M€ stay as they were)').eq(10);
    expect(insurer.megaCredits, 'the insurer paid nothing').eq(10);
  });

  it('rule 2 (solo): the player\'s OWN Mons Insurance does not pay for the player\'s own shipment either', () => {
    const card = new ShipmentToEarth();
    const [game, player] = testGame(1);
    player.playedCards.push(new MonsInsurance());
    game.monsInsuranceOwner = player;
    player.megaCredits = 10;
    player.plants = 3;
    player.steel = 3;

    cast(card.play(player), undefined);
    runAllActions(game);
    expect(player.megaCredits).eq(10);
  });

  it('rule 3: the Reds rule — the TR\'s tax is part of the price (17 + 9), on the shared affordability path', () => {
    const card = new ShipmentToEarth();
    const [game, player] = testGame(2, {turmoilExtension: true});
    setRulingParty(game, PartyName.REDS);
    player.plants = 3;
    player.steel = 3;

    player.megaCredits = 25;
    expect(player.canPlay(card), '25 M€: one short of the 17 + 3 × 3').is.false;
    expect(card.unplayableReason(player), 'the card\'s own hook names no blocker — plants and steel are there').is.undefined;
    const reasons = unplayableReasons(player, card);
    const mc = reasons.find((r) => r.message === 'Need ${0} more M€');
    expect(mc, reasons.map((r) => r.message).join(' | ')).is.not.undefined;
    expect(mc?.params).deep.eq(['1']);

    player.megaCredits = 26;
    expect(player.canPlay(card)).is.true;
    cast(card.play(player), undefined);
    runAllActions(game);
    expect(player.megaCredits, 'the tax: 9 M€ for three TR steps (the card\'s own price is the play\'s, not `play()`\'s)').eq(26 - 9);
    expect(player.terraformRating).eq(23);
  });

  it('rule 4: Earth tags count «by default» — a wild tag counts, Earth Embassy\'s Moon tags count', () => {
    const card = new ShipmentToEarth();
    const [/* game */, player] = testGame(2);
    player.plants = 3;
    player.steel = 3;

    player.tagsForTest = {earth: 1, wild: 1};
    expect(card.cardPlayPreview(player).branches[0].effects.find((e) => e.icon === 'megacredits')?.amount, 'one Earth tag + one wild tag').eq(4);
    cast(card.play(player), undefined);
    expect(player.megaCredits).eq(4);

    player.plants = 3;
    player.steel = 3;
    player.megaCredits = 0;
    player.playedCards.push(new EarthEmbassy());
    player.tagsForTest = {earth: 1, moon: 2};
    expect(card.cardPlayPreview(player).branches[0].effects.find((e) => e.icon === 'megacredits')?.amount, 'Earth Embassy: every Moon tag is an Earth tag too').eq(6);
    cast(card.play(player), undefined);
    expect(player.megaCredits).eq(6);
  });

  it('rule 5: the Space tag takes the classic Unity discount (up04); a Redux table has no law that prices a tag', () => {
    const card = new ShipmentToEarth();
    const [game, player] = testGame(2, {turmoilExtension: true});
    expect(player.getCardCost(card)).eq(17);
    setRulingParty(game, PartyName.UNITY, 'up04');
    expect(player.getCardCost(card), 'cards with Space tags cost 2 M€ less').eq(15);

    const [/* redux */, reduxPlayer] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
    expect(reduxPlayer.getCardCost(card), 'the Parliament\'s price function knows no tag discount').eq(17);
  });

  it('rule 6: Playwrights replays the event only through `canPlay` — 3 plants and 3 steel again', () => {
    const card = new ShipmentToEarth();
    const [/* game */, player] = testGame(2);
    const playwrights = new Playwrights();
    player.playedCards.push(playwrights, card);
    player.megaCredits = card.cost;

    player.plants = 2;
    player.steel = 3;
    expect(playwrights.canAct(player), 'two plants: the shipment cannot leave again').is.false;
    player.plants = 3;
    expect(playwrights.canAct(player)).is.true;
    player.steel = 2;
    expect(playwrights.canAct(player), 'two steel: neither').is.false;
  });

  it('rule 8: the journal and the event stream read the printed order — plants, steel, TR, M€', () => {
    const card = new ShipmentToEarth();
    const [game, player] = testGame(2);
    player.plants = 5;
    player.steel = 4;
    player.megaCredits = 30;
    player.tagsForTest = {earth: 2};
    player.cardsInHand.push(card);
    game.gameLog.length = 0;
    game.events.events.length = 0;

    player.playCard(card);
    runAllActions(game);

    const lines = game.gameLog.map(formatMessage);
    const lost = lines.filter((line) => line.includes(' lost '));
    expect(lost, lines.join('\n')).deep.eq([
      'blue lost 3 plants because of Shipment to Earth',
      'blue lost 3 steel because of Shipment to Earth',
    ]);
    const firstGain = lines.findIndex((line) => line.includes(' gained '));
    expect(firstGain, 'the M€ for the Earth tags are logged').greaterThan(-1);
    expect(lines.indexOf(lost[1]), 'the shipment is logged before the card pays anything').lessThan(firstGain);

    // The SHIPMENT runs first, in its printed order (`bespokePlayBefore`, plants
    // before steel). The two gains stay DECLARATIVE and ride the executor's own
    // order (a stock gain before a TR step — the same for every behavior card):
    // the journal's entry pills them together, and keeping the M€ declarative
    // keeps the Earth-tag count, its basis and the Reds tax on the shared paths.
    const deltas = game.events.events
      .filter((e) => e.player === player.color && (e.type === 'resource-changed' || e.type === 'tr-changed'))
      .map((e) => e.type === 'tr-changed' ? `tr:${e.impact.tr}` : Object.entries(e.impact.stock ?? {}).map(([k, v]) => `${k}:${v}`).join(','))
      .filter((s) => s !== '');
    expect(deltas, 'the shipment before anything the card pays').deep.eq(['plants:-3', 'steel:-3', 'megacredits:4', 'tr:3']);
    expect(player.megaCredits, 'the card\'s price is the play prompt\'s (not `playCard`\'s) — only the Earth tags move the M€ here').eq(30 + 4);
  });

  it('the play preview reads the shipment FIRST (`extrasFirst`), the gains after', () => {
    const card = new ShipmentToEarth();
    const [/* game */, player] = testGame(2);
    player.plants = 5;
    player.steel = 4;
    player.tagsForTest = {earth: 1};
    const chips = card.cardPlayPreview(player).branches[0].effects.map((e) => `${e.direction === 'cost' ? '-' : '+'}${e.amount} ${e.icon}`);
    // The loss leads (the owner's decision, `extrasFirst`); the two gains keep
    // the declarative builder's own order (a stock chip before the TR chip, as
    // on every behavior card) — exactly the order the executor pays them in.
    expect(chips).deep.eq(['-3 plants', '-3 steel', '+2 megacredits', '+3 tr']);
  });

  it('ZERO IS AN ANSWER: with no Earth tag the M€ chip stays — «0» with its basis — never dropped', () => {
    const card = new ShipmentToEarth();
    const [/* game */, player] = testGame(2);
    player.plants = 3;
    player.steel = 3;
    player.tagsForTest = {};
    const chip = card.cardPlayPreview(player).branches[0].effects.find((e) => e.icon === 'megacredits');
    expect(chip, 'the chip is emitted').is.not.undefined;
    expect(chip?.amount).eq(0);
    expect(chip?.direction).eq('gain');
    expect(chip?.current).eq(0);
    expect(chip?.resulting).eq(0);
    expect(chip?.basis?.[0].count, 'the basis names the zero: Earth tags 0').eq(0);
    expect(chip?.basis?.[0].tag).eq(Tag.EARTH);
  });

  it('nothing is ever skipped: no `effect-skipped` record, with or without Earth tags', () => {
    for (const earth of [0, 2]) {
      const card = new ShipmentToEarth();
      const [game, player] = testGame(2);
      player.plants = 3;
      player.steel = 3;
      player.megaCredits = 30;
      player.tagsForTest = {earth};
      player.cardsInHand.push(card);
      player.playCard(card);
      runAllActions(game);
      expect(game.events.events.filter((e) => e.type === 'effect-skipped'), `earth=${earth}`).deep.eq([]);
    }
  });
});
