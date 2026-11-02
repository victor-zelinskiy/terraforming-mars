
import {expect} from 'chai';
import {VenusTradeHub} from '../../../src/server/cards/prelude2/VenusTradeHub';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Luna} from '../../../src/server/colonies/Luna';
import {cast} from '@/common/utils/utils';
import {Game} from '../../../src/server/Game';
import {CardName} from '../../../src/common/cards/CardName';
import {Resource} from '../../../src/common/Resource';
import {TradeWithEnergy} from '../../../src/server/player/Colonies';
import {buildColonyTradePreview} from '../../../src/server/colonies/colonyTradePreview';
import {runAllActions} from '../../TestingUtils';
import {UnmiLiner} from '../../../src/server/cards/turmoilRedux/UnmiLiner';
import {FleetDockDestination} from '../../../src/server/colonies/FleetDockDestination';

describe('VenusTradeHub', () => {
  let card: VenusTradeHub;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new VenusTradeHub();
    [game, player] = testGame(2, {coloniesExtension: true});
  });

  it('canPlay', () => {
    player.tagsForTest = {venus: 1};

    expect(card.canPlay(player)).is.false;

    player.tagsForTest = {venus: 2};

    expect(card.canPlay(player)).is.true;
  });

  it('play', () => {
    cast(card.play(player), undefined);
  });

  it('effect', () => {
    player.playedCards.push(card);
    const luna = new Luna();
    game.colonies.push(luna);

    luna.trackPosition = 0; // 1 MC.
    luna.trade(player);

    expect(player.megaCredits).eq(4);
  });
});

/**
 * P90 — the fork's premium half: the effect is the CARD's hook (`onTrade`), fired by the one trade module
 * (`colonies/tradePerformed.fireTradeHooks`) under the card's own `'trade'` effect scope — so the gain is the
 * card's on every door, the console's card-reaction framework gets its record, and the trade previews state it
 * as a REACTOR (an exact fact on the printed effect row), never as a grant of the income.
 */
describe('VenusTradeHub — the trade reactor', () => {
  let card: VenusTradeHub;
  let player: TestPlayer;
  let other: TestPlayer;
  let game: IGame;
  let luna: Luna;

  beforeEach(() => {
    card = new VenusTradeHub();
    [game, player, other] = testGame(2, {coloniesExtension: true});
    luna = new Luna();
    game.colonies = [luna];
    player.playedCards.push(card);
  });

  /** The events the card paid under its own effect scope. */
  function paidByCard() {
    return game.events.events.filter((e) => e.type === 'resource-changed' && e.source?.kind === 'card' && e.source.card === CardName.VENUS_TRADE_HUB);
  }

  it('a colony trade: +3 M€ under the card\'s own scope, trigger «trade», cause the colony — one reaction record', () => {
    luna.trackPosition = 0;
    luna.trade(player);
    runAllActions(game);
    expect(player.megaCredits).eq(4);
    const paid = paidByCard();
    expect(paid).has.lengthOf(1);
    expect(paid[0].impact.stock?.megacredits).eq(3);
    const marker = game.events.events.find((e) => e.type === 'effect-triggered' && e.source?.kind === 'card' && e.source.card === CardName.VENUS_TRADE_HUB);
    expect(marker?.trigger, 'the passive-effect marker names the trade').eq('trade');
    const records = game.cardReactions.filter((r) => r.card === CardName.VENUS_TRADE_HUB);
    expect(records).has.lengthOf(1);
    expect(records[0]).deep.include({owner: player.color, kind: 'card', channel: 'trade', cause: {trade: {kind: 'colony', name: luna.name}}});
    expect(records[0].impacts).deep.eq([{kind: 'stock', resource: Resource.MEGACREDITS, amount: 3, to: player.color}]);
  });

  it('the trade manifest names the card answer (the console trade scene holds and declares it)', () => {
    luna.trade(player);
    expect(player.colonyTradeManifest?.reactorGains).deep.eq([{card: CardName.VENUS_TRADE_HUB, resource: 'megacredits', amount: 3}]);
    luna.trade(other);
    expect(other.colonyTradeManifest?.reactorGains, 'a trader without the card').is.undefined;
  });

  it('a DOCK trade (UNMI Liner) fires the card under its own scope too — one record, the dock as the cause', () => {
    const liner = new UnmiLiner();
    player.playedCards.push(liner);
    new FleetDockDestination(liner).trade(player);
    runAllActions(game);
    const records = game.cardReactions.filter((r) => r.card === CardName.VENUS_TRADE_HUB);
    expect(records).has.lengthOf(1);
    expect(records[0]).deep.include({channel: 'trade', cause: {trade: {kind: 'card', card: CardName.UNMI_LINER}}});
    expect(records[0].impacts).deep.eq([{kind: 'stock', resource: Resource.MEGACREDITS, amount: 3, to: player.color}]);
  });

  it('a trade through a payment path (the colony workspace\'s door) fires the card ONCE', () => {
    player.energy = 3;
    new TradeWithEnergy(player).trade(luna);
    runAllActions(game);
    expect(paidByCard()).has.lengthOf(1);
    expect(game.cardReactions.filter((r) => r.card === CardName.VENUS_TRADE_HUB)).has.lengthOf(1);
  });

  it('a «selfish» trade (Coordinated Raid\'s door, no track advance) is a trade too — once', () => {
    luna.trade(player, {selfishTrade: true});
    runAllActions(game);
    expect(paidByCard()).has.lengthOf(1);
  });

  it('self-only: another seat\'s trade pays the owner nothing', () => {
    const before = player.megaCredits;
    luna.trade(other);
    runAllActions(game);
    expect(player.megaCredits).eq(before);
    expect(paidByCard()).deep.eq([]);
  });

  it('the forecast: an EXACT fact on the printed effect row, +3 M€ — and no flat grant beside it', () => {
    const preview = buildColonyTradePreview(player, luna);
    const facts = preview.forecast?.facts.filter((f) => f.source.name === CardName.VENUS_TRADE_HUB) ?? [];
    expect(facts).has.lengthOf(1);
    expect(facts[0]).deep.include({certainty: 'exact'});
    expect(facts[0].source).deep.include({channel: 'trade', printedEffect: 0});
    expect(facts[0].effects).deep.eq([{direction: 'gain', icon: Resource.MEGACREDITS, amount: 3, current: player.megaCredits, resulting: player.megaCredits + 3}]);
    // The composition row reads the same fact.
    expect(preview.flatBonuses).deep.eq([{card: CardName.VENUS_TRADE_HUB, resource: 'megacredits', amount: 3}]);
  });

  it('without the card, no fact and no composition row', () => {
    player.playedCards.remove(card);
    const preview = buildColonyTradePreview(player, luna);
    expect(preview.forecast?.facts.some((f) => f.source.name === CardName.VENUS_TRADE_HUB) ?? false).is.false;
    expect(preview.flatBonuses).is.undefined;
  });

  it('survives a save: the reloaded card still answers the trade once', () => {
    const restored = Game.deserialize(game.serialize());
    const p = restored.getPlayerById(player.id);
    const l = restored.colonies.find((c) => c.name === luna.name)!;
    l.trackPosition = 0;
    const before = p.megaCredits;
    l.trade(p);
    runAllActions(restored);
    expect(p.megaCredits).eq(before + 1 + 3);
  });
});
