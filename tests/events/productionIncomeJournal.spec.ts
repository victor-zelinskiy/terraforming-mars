import {expect} from 'chai';
import {IGame} from '../../src/server/IGame';
import {Game} from '../../src/server/Game';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {forceGenerationEnd, runAllActions} from '../TestingUtils';
import {cast} from '../../src/common/utils/utils';
import {Resource} from '../../src/common/Resource';
import {CardName} from '../../src/common/cards/CardName';
import {GameEvent} from '../../src/common/events/GameEvent';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectAmount} from '../../src/server/inputs/SelectAmount';
import {Supercapacitors} from '../../src/server/cards/promo/Supercapacitors';
import {Pristar} from '../../src/server/cards/turmoil/Pristar';
import {productionIncomeByPlayerGeneration} from '../../src/common/events/aggregate';
import {buildEndgameFacts} from '../../src/common/events/endgameFacts';
import {buildJournalView, JournalGroupNode} from '../../src/client/components/journal/journalView';
import {diffRootNotifications} from '../../src/client/components/notifications/notificationModel';

/**
 * TR61 — «ДОХОД — СОБЫТИЕ»: the production phase is a JOURNAL ROOT of its own
 * (`production-phase-income`, category `production`, one per seat per
 * generation), and everything it pays is its chain — the conversion, the
 * rating's M€, the production values, a card's `onProductionPhase` — recorded
 * through the stock chokepoints, never a direct field write. The view carries
 * the seat's own RECORD (`productionIncome`), the aggregates and the endgame
 * facts read the phase's events, the notification feed stays silent (the
 * generation scene is the telling), and an old save without the events shows
 * no group — honestly.
 */
function byPlayer(game: IGame, player: TestPlayer): {root: GameEvent, chain: Array<GameEvent>} {
  const root = game.events.events.find((e) => e.type === 'production-phase-income' && e.player === player.color);
  expect(root, `${player.color}'s production root`).to.not.be.undefined;
  const chain = game.events.events.filter((e) => e.correlationId === root!.correlationId && e.id !== root!.id);
  return {root: root!, chain};
}

function stockOf(chain: ReadonlyArray<GameEvent>, part: 'rating' | 'conversion' | undefined, resource: Resource): number {
  return chain
    .filter((e) => e.type === 'resource-changed' && e.source?.kind === 'production' && e.source.part === part)
    .reduce((sum, e) => sum + (e.impact.stock?.[resource] ?? 0), 0);
}

describe('production income — the phase is an event (TR61)', () => {
  let game: IGame;
  let player: TestPlayer;
  let rival: TestPlayer;

  beforeEach(() => {
    [game, player, rival] = testGame(2);
    cast(player.popWaitingFor(), undefined);
    cast(rival.popWaitingFor(), undefined);
  });

  it('ONE root per seat with the production category; the conversion, the rating and every production value are its chain — in the rules\' order', () => {
    player.production.override({megacredits: 3, steel: 2, titanium: 1, plants: 4, energy: 2, heat: 1});
    player.setTerraformRating(23);
    player.megaCredits = 10;
    player.energy = 5;
    player.heat = 7;
    forceGenerationEnd(game);
    runAllActions(game);

    const {root, chain} = byPlayer(game, player);
    expect(root.category).eq('production');
    expect(root.source).deep.eq({kind: 'production'});
    expect(root.correlationId).eq(root.id);
    expect(root.visibility).eq('journal');
    // The conversion: the energy leaves, the heat arrives — ONE amount under its own part.
    expect(stockOf(chain, 'conversion', Resource.ENERGY)).eq(-5);
    expect(stockOf(chain, 'conversion', Resource.HEAT)).eq(5);
    // The rating's own M€ line.
    expect(stockOf(chain, 'rating', Resource.MEGACREDITS)).eq(23);
    // The production values, each its own delta.
    expect(stockOf(chain, undefined, Resource.MEGACREDITS)).eq(3);
    expect(stockOf(chain, undefined, Resource.STEEL)).eq(2);
    expect(stockOf(chain, undefined, Resource.TITANIUM)).eq(1);
    expect(stockOf(chain, undefined, Resource.PLANTS)).eq(4);
    expect(stockOf(chain, undefined, Resource.ENERGY)).eq(2);
    expect(stockOf(chain, undefined, Resource.HEAT)).eq(1);
    // The order of the chain is the rules' order: conversion → rating → production.
    const order = chain.filter((e) => e.type === 'resource-changed').map((e) => (e.source as {part?: string}).part ?? 'production');
    expect(order.indexOf('conversion')).lessThan(order.indexOf('rating'));
    expect(order.indexOf('rating')).lessThan(order.indexOf('production'));
    // The stocks are what the rules say — the record changed nothing of the arithmetic.
    expect(player.megaCredits).eq(10 + 23 + 3);
    expect(player.energy).eq(2);
    expect(player.heat).eq(7 + 5 + 1);
    // Every seat has its own root — the rival's is a different chain.
    const rivals = byPlayer(game, rival);
    expect(rivals.root.correlationId).not.eq(root.correlationId);
  });

  it('the journal: the header log is the group\'s root (category production), the conversion line a detail — one group per seat', () => {
    player.energy = 3;
    forceGenerationEnd(game);
    runAllActions(game);
    const {root} = byPlayer(game, player);
    const header = game.gameLog.find((m) => m.correlationId === root.correlationId && m.role === 'root-action');
    expect(header, 'the header log').to.not.be.undefined;
    expect(header!.category).eq('production');
    expect(header!.message).eq('${0} received the production income of generation ${1}');
    expect(header!.playerId, 'public — income is public information').is.undefined;
    const conversion = game.gameLog.find((m) => m.correlationId === root.correlationId && m.message === '${0} converted ${1} units of energy to heat');
    expect(conversion, 'the conversion line rides the same group').to.not.be.undefined;
    expect(conversion!.role).eq('detail');
    const view = buildJournalView(game.gameLog);
    const group = view.find((n): n is JournalGroupNode => n.kind === 'group' && n.correlationId === root.correlationId);
    expect(group, 'a GROUP in the journal view').to.not.be.undefined;
    expect(group!.category).eq('production');
  });

  it('the view\'s RECORD: the seat\'s own income per resource, the rating, the conversion, the root\'s id — cleared on the next input', () => {
    player.production.override({megacredits: -2, steel: 1, titanium: 0, plants: 2, energy: 1, heat: 3});
    player.setTerraformRating(20);
    player.energy = 4;
    forceGenerationEnd(game);
    runAllActions(game);
    const {root} = byPlayer(game, player);
    expect(player.productionIncome).deep.eq({
      generation: 1,
      correlationId: root.correlationId,
      income: {megacredits: -2, steel: 1, titanium: 0, plants: 2, energy: 1, heat: 3},
      rating: 20,
      conversion: 4,
    });
    // A negative M€ production is paid AFTER the rating — the stock never dips below what the rating paid.
    expect(stockOf(byPlayer(game, player).chain, undefined, Resource.MEGACREDITS)).eq(-2);
    cast(player.getWaitingFor(), SelectCard);
    player.process({type: 'card', cards: []});
    expect(player.productionIncome, 'consumed by the next input, like the conversion snapshot').is.undefined;
  });

  it('no energy: no conversion line, no conversion in the record', () => {
    player.energy = 0;
    forceGenerationEnd(game);
    runAllActions(game);
    const {chain} = byPlayer(game, player);
    expect(chain.some((e) => e.source?.kind === 'production' && e.source.part === 'conversion')).is.false;
    expect(player.productionIncome?.conversion).eq(0);
    expect(game.gameLog.some((m) => m.message === '${0} converted ${1} units of energy to heat')).is.false;
  });

  it('Supercapacitors DEFERS its half, and the chosen conversion + the income still join the phase\'s chain', () => {
    const card = new Supercapacitors();
    player.playedCards.push(card);
    player.production.override({energy: 2, heat: 3});
    player.energy = 5;
    player.heat = 0;
    forceGenerationEnd(game);
    runAllActions(game);
    cast(player.getWaitingFor(), SelectAmount);
    // Through the input boundary — `process` restores the phase's scope around the answer (a direct `cb` would not).
    player.process({type: 'amount', amount: 4});
    runAllActions(game);
    const {chain} = byPlayer(game, player);
    expect(stockOf(chain, 'conversion', Resource.ENERGY)).eq(-4);
    expect(stockOf(chain, 'conversion', Resource.HEAT)).eq(4);
    expect(stockOf(chain, undefined, Resource.ENERGY)).eq(2);
    expect(stockOf(chain, undefined, Resource.HEAT)).eq(3);
    expect(player.energy).eq(3);
    expect(player.heat).eq(7);
    expect(player.energyHeatConversion).to.deep.include({amount: 4, energyBefore: 5, heatBefore: 0});
    expect(player.productionIncome).to.deep.include({conversion: 4, income: {megacredits: 0, steel: 0, titanium: 0, plants: 0, energy: 2, heat: 3}});
  });

  it('a card\'s onProductionPhase (Pristar) pays INSIDE the phase under its own source — the chain names the card', () => {
    const pristar = new Pristar();
    player.playedCards.push(pristar);
    player.hasIncreasedTerraformRatingThisGeneration = false;
    forceGenerationEnd(game);
    runAllActions(game);
    const {root, chain} = byPlayer(game, player);
    const bonus = chain.find((e) => e.source?.kind === 'corporation' && e.source.card === CardName.PRISTAR);
    expect(bonus, 'Pristar\'s +6 M€ under the phase\'s root').to.not.be.undefined;
    expect(bonus!.correlationId).eq(root.correlationId);
    expect(bonus!.impact.stock?.megacredits).eq(6);
  });

  it('the aggregates read the income per seat and generation off the events; the endgame fact sums the match', () => {
    player.production.override({megacredits: 2, steel: 1, titanium: 0, plants: 0, energy: 3, heat: 0});
    player.setTerraformRating(21);
    player.energy = 2;
    forceGenerationEnd(game);
    runAllActions(game);
    const timeline = productionIncomeByPlayerGeneration(game.events.events);
    const mine = timeline.get(player.color)?.get(1);
    expect(mine).deep.eq({generation: 1, stock: {megacredits: 2, steel: 1, titanium: 0, plants: 0, energy: 3, heat: 0}, rating: 21, conversion: 2});
    const fact = buildEndgameFacts(game.events.events).find((f) => f.type === 'productionIncome' && f.player === player.color);
    expect(fact, 'the economy fact').to.not.be.undefined;
    expect(fact!.confidence).eq('exact');
    expect(fact!.metrics).deep.include({generations: 1, units: 2 + 1 + 3 + 21, megacredits: 2 + 21, rating: 21, conversion: 2, peakGeneration: 1});
    expect(fact!.relatedEventIds).deep.eq([byPlayer(game, player).root.id]);
    expect(fact!.tags).deep.eq(['economy', 'timeline']);
  });

  it('the notification feed is SILENT about the phase — for the seat and for its rivals (the generation scene is the telling)', () => {
    player.production.override({megacredits: 5});
    rival.production.override({steel: 2});
    forceGenerationEnd(game);
    runAllActions(game);
    for (const viewer of [player, rival]) {
      const {models} = diffRootNotifications({
        messages: game.gameLog, events: game.events.events, seen: new Set(), viewerColor: viewer.color, generation: 1, createdAt: 0,
      });
      expect(models.filter((m) => m.typeLabelKey === 'Production phase'), `${viewer.color} reads no income toast`).deep.eq([]);
    }
  });

  it('an old save (events without the phase) shows no group and no record — honestly', () => {
    forceGenerationEnd(game);
    runAllActions(game);
    const copy = JSON.parse(JSON.stringify(game.serialize()));
    // The events of the phase are NOT in the save: strip them as an old save never had them.
    copy.gameEvents = (copy.gameEvents ?? []).filter((e: GameEvent) => e.type !== 'production-phase-income' && e.source?.kind !== 'production');
    const reloaded: IGame = Game.deserialize(copy);
    const me = reloaded.getPlayerById(player.id);
    expect(me.productionIncome, 'transient — never in a save').is.undefined;
    expect(reloaded.events.events.some((e) => e.type === 'production-phase-income')).is.false;
  });
});
