import {expect} from 'chai';
import {testGame} from '../TestGame';
import {runAllActions, fakeCard, addCity, addOcean} from '../TestingUtils';
import {cast} from '@/common/utils/utils';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {Tag} from '@/common/cards/Tag';
import {Payment} from '@/common/inputs/Payment';
import {SelectCard} from '@/server/inputs/SelectCard';
import {MediaGroup} from '@/server/cards/base/MediaGroup';
import {Decomposers} from '@/server/cards/base/Decomposers';
import {EarthCatapult} from '@/server/cards/base/EarthCatapult';
import {Pets} from '@/server/cards/base/Pets';
import {ArcticAlgae} from '@/server/cards/base/ArcticAlgae';
import {Virus} from '@/server/cards/base/Virus';
import {Viron} from '@/server/cards/venusNext/Viron';
import {Tardigrades} from '@/server/cards/base/Tardigrades';
import {ConvertPlants} from '@/server/cards/base/standardActions/ConvertPlants';
import {SelectSpace} from '@/server/inputs/SelectSpace';
import {AndOptions} from '@/server/inputs/AndOptions';
import {OrOptions} from '@/server/inputs/OrOptions';
import {SelectColony} from '@/server/inputs/SelectColony';
import {Luna} from '@/server/colonies/Luna';
import {BuildColony} from '@/server/deferredActions/BuildColony';
import {aggregateBySource, aggregateCorporationImpact} from '@/common/events/aggregate';
import {sourceKey} from '@/common/events/EventSource';
import {Resource} from '@/common/Resource';
import {CardResource} from '@/common/CardResource';
import {GameEvent} from '@/common/events/GameEvent';
import {buildJournalView, JournalGroupNode} from '@/client/components/journal/journalView';

describe('Structured event stream (POC)', () => {
  it('records a passive effect trigger linked to the triggering card (Media Group)', () => {
    const [game, player] = testGame(1);
    player.playedCards.push(new MediaGroup());
    const before = player.megaCredits;

    // The REAL dispatch path (not calling the hook directly) — that's where the
    // effect scope wrapping lives.
    player.onCardPlayed(new Virus());
    runAllActions(game);

    expect(player.megaCredits - before).to.eq(3);

    const events = game.events.events;
    const trigger = events.find((e) => e.type === 'effect-triggered' &&
      e.source?.kind === 'card' && e.source.card === CardName.MEDIA_GROUP);
    expect(trigger, 'effect-triggered marker').to.not.be.undefined;

    const gain = events.find((e) => e.type === 'resource-changed' &&
      e.source?.kind === 'card' && e.source.card === CardName.MEDIA_GROUP &&
      e.impact.stock?.megacredits === 3);
    expect(gain, 'resource gain attributed to Media Group').to.not.be.undefined;
    // The gain (deferred) is correlated to the same trigger chain — this proves
    // correlation survives the deferred-queue boundary.
    expect(gain!.correlationId).to.eq(trigger!.correlationId);

    const stats = aggregateBySource(events).get(sourceKey({kind: 'card', card: CardName.MEDIA_GROUP}));
    expect(stats?.triggerCount).to.eq(1);
    expect(stats?.stock.megacredits).to.eq(3);
  });

  it('records a card-resource addition attributed to the effect source (Decomposers)', () => {
    const [game, player] = testGame(1);
    const decomposers = new Decomposers();
    player.playedCards.push(decomposers);

    player.onCardPlayed(fakeCard({tags: [Tag.MICROBE]}));
    runAllActions(game);

    expect(decomposers.resourceCount).to.eq(1);

    const events = game.events.events;
    const added = events.find((e) => e.type === 'card-resource-changed' &&
      e.source?.kind === 'card' && e.source.card === CardName.DECOMPOSERS);
    expect(added, 'card-resource event').to.not.be.undefined;
    expect(added!.impact.cardResources?.[0]).to.deep.include({cardResource: CardResource.MICROBE, target: CardName.DECOMPOSERS, amount: 1});

    const stats = aggregateBySource(events).get(sourceKey({kind: 'card', card: CardName.DECOMPOSERS}));
    expect(stats?.cardResources[CardResource.MICROBE]).to.eq(1);
    expect(stats?.triggerCount).to.eq(1);
  });

  it('records a discount as a saving attributed to its source (Earth Catapult)', () => {
    const [game, player] = testGame(1);
    player.playedCards.push(new EarthCatapult());
    player.megaCredits = 20;

    const card = fakeCard({cost: 10});
    player.playCard(card, Payment.of({megacredits: 8}));
    runAllActions(game);

    const events = game.events.events;
    const discount = events.find((e) => e.type === 'discount-applied' &&
      e.source?.kind === 'card' && e.source.card === CardName.EARTH_CATAPULT);
    expect(discount, 'discount-applied event').to.not.be.undefined;
    expect(discount!.impact.megacreditsSaved).to.eq(2);

    const payment = events.find((e) => e.type === 'payment' && e.target?.card === card.name);
    expect(payment!.impact.megacreditsPaid).to.eq(8);

    const stats = aggregateBySource(events).get(sourceKey({kind: 'card', card: CardName.EARTH_CATAPULT}));
    expect(stats?.megacreditsSaved).to.eq(2);
  });

  it('attributes a copied action chain to the copying corporation (VIRON)', () => {
    const [game, player] = testGame(1);
    const viron = new Viron();
    const tardigrades = new Tardigrades();
    player.playedCards.push(viron, tardigrades);
    // Tardigrades must have been used this generation for Viron to copy it.
    player.actionsThisGeneration.add(CardName.TARDIGRADES);

    const select = cast(viron.action(player), SelectCard);
    select.cb([tardigrades]);
    runAllActions(game);

    expect(tardigrades.resourceCount).to.eq(1);

    const events = game.events.events;
    const copied = events.find((e) => e.type === 'copied-action' &&
      e.source?.kind === 'corporation' && e.source.card === CardName.VIRON);
    expect(copied, 'copied-action event').to.not.be.undefined;
    expect(copied!.target?.card).to.eq(CardName.TARDIGRADES);

    // Corporation impact rolls up the copied card's gain to Viron.
    const impact = aggregateCorporationImpact(events, CardName.VIRON);
    expect(impact.cardResources[CardResource.MICROBE]).to.eq(1);
    expect(impact.triggerCount).to.be.greaterThan(0);
  });

  it('emits a corporation action-used root via the action menu (VIRON)', () => {
    const [game, player] = testGame(1);
    const viron = new Viron();
    const tardigrades = new Tardigrades();
    player.playedCards.push(viron, tardigrades);
    player.actionsThisGeneration.add(CardName.TARDIGRADES);

    const menu = cast(player.playActionCard(), SelectCard);
    menu.cb([viron]);

    const actionEvent = game.events.events.find((e) => e.type === 'action' &&
      e.source?.kind === 'corporation' && e.source.card === CardName.VIRON);
    expect(actionEvent, 'corporation action root').to.not.be.undefined;
  });

  it('serializes the event stream and restores it (undo-safe snapshot)', () => {
    const [game, player] = testGame(1);
    player.playedCards.push(new MediaGroup());
    player.onCardPlayed(new Virus());
    runAllActions(game);

    const serialized = game.serialize();
    expect(serialized.gameEvents).to.be.an('array');
    expect(serialized.gameEvents!.length).to.be.greaterThan(0);
    expect(serialized.eventSeq).to.eq(game.events.sequence);

    // Simulate the DB JSON round-trip (the persisted stream is a copy).
    const events: ReadonlyArray<GameEvent> = JSON.parse(JSON.stringify(serialized.gameEvents));
    game.events.restore(events, serialized.eventSeq);
    expect(game.events.events.length).to.eq(events.length);
    expect(aggregateBySource(game.events.events).get(sourceKey({kind: 'card', card: CardName.MEDIA_GROUP}))?.stock.megacredits).to.eq(3);
  });

  it('records production changes (Resource enum) attributed to context', () => {
    const [game, player] = testGame(1);
    // A standalone production gain with no source/context is loose bookkeeping
    // and intentionally NOT recorded.
    player.production.add(Resource.MEGACREDITS, 2, {log: true});
    const loose = game.events.events.filter((e) => e.type === 'production-changed');
    expect(loose.length).to.eq(0);
  });
});

describe('Phase 2: attribution wraps + journal grouping', () => {
  it('attributes an onTilePlaced effect to the effect card (Pets)', () => {
    const [game, player] = testGame(1);
    const pets = new Pets();
    player.playedCards.push(pets);

    addCity(player);
    runAllActions(game);

    expect(pets.resourceCount).to.eq(1);
    const stats = aggregateBySource(game.events.events).get(sourceKey({kind: 'card', card: CardName.PETS}));
    expect(stats?.cardResources[CardResource.ANIMAL]).to.eq(1);
    expect(stats?.triggerCount).to.eq(1);
  });

  it('attributes an ocean-placement effect to the effect card (Arctic Algae)', () => {
    const [game, player] = testGame(1);
    player.playedCards.push(new ArcticAlgae());
    const before = player.plants;

    addOcean(player);
    runAllActions(game);

    expect(player.plants - before).to.eq(2);
    const stats = aggregateBySource(game.events.events).get(sourceKey({kind: 'card', card: CardName.ARCTIC_ALGAE}));
    expect(stats?.stock.plants).to.eq(2);
    expect(stats?.triggerCount).to.eq(1);
  });

  it('groups an effect under its triggering action in the journal (Media Group)', () => {
    const [game, player] = testGame(1);
    player.playedCards.push(new MediaGroup());

    player.playCard(fakeCard({type: CardType.EVENT, name: 'Test Event' as CardName}));
    runAllActions(game);

    const groups = buildJournalView(game.gameLog).filter((n): n is JournalGroupNode => n.kind === 'group');
    const group = groups.find((g) => g.children.some((c) => c.role === 'effect-result'));
    expect(group, 'a grouped action with an effect child').to.not.be.undefined;
    expect(group!.header.role).to.eq('root-action');
    expect(group!.category).to.eq('card-play');
    // Grouping is purely by correlationId — no message-text parsing.
    for (const child of group!.children) {
      expect(child.correlationId).to.eq(group!.header.correlationId);
    }
  });

  it('correlates a discount GameEvent to the play-action log (Earth Catapult)', () => {
    const [game, player] = testGame(1);
    player.playedCards.push(new EarthCatapult());
    player.megaCredits = 20;

    const card = fakeCard({cost: 10});
    player.playCard(card, Payment.of({megacredits: 8}));
    runAllActions(game);

    const discount = game.events.events.find((e) => e.type === 'discount-applied');
    expect(discount, 'discount event').to.not.be.undefined;
    // The discount is in the structured stream (not a journal row), but shares the
    // play action's correlationId, so the journal can reveal it on expand.
    const playLog = game.gameLog.find((m) => m.role === 'root-action' && m.correlationId === discount!.correlationId);
    expect(playLog, 'play-action log with the discount correlationId').to.not.be.undefined;
  });

  it('groups a blue-card action with its result (universal action path)', () => {
    const [game, player] = testGame(1);
    const tardigrades = new Tardigrades();
    player.playedCards.push(tardigrades);

    const select = cast(player.playActionCard(), SelectCard);
    select.cb([tardigrades]);
    runAllActions(game);

    expect(tardigrades.resourceCount).to.eq(1);

    // The "used … action" log heads a card-action group...
    const groups = buildJournalView(game.gameLog).filter((n): n is JournalGroupNode => n.kind === 'group');
    const group = groups.find((g) => g.category === 'card-action');
    expect(group, 'card-action group').to.not.be.undefined;
    expect(group!.header.role).to.eq('root-action');
    expect(group!.children.length).to.be.greaterThan(0);

    // ...and the action's result (the microbe) correlates to it (event-driven child).
    const microbe = game.events.events.find((e) => e.type === 'card-resource-changed' && e.correlationId === group!.header.correlationId);
    expect(microbe, 'microbe gain correlated to the action root').to.not.be.undefined;
  });

  it('groups a top-level conversion with its consequences (Convert Plants)', () => {
    const [game, player] = testGame(1);
    player.plants = 8;
    const select = cast(new ConvertPlants().action(player), SelectSpace);
    select.cb(game.board.getAvailableSpacesForGreenery(player)[0]);
    runAllActions(game);

    const groups = buildJournalView(game.gameLog).filter((n): n is JournalGroupNode => n.kind === 'group');
    const group = groups.find((g) => g.category === 'standard-project' && g.header.message.includes('standard action'));
    expect(group, 'conversion group').to.not.be.undefined;
    // The greenery placement is correlated to the conversion root (one group).
    const tilePlaced = game.events.events.find((e) => e.type === 'tile-placed' && e.correlationId === group!.header.correlationId);
    expect(tilePlaced, 'greenery placement under the conversion root').to.not.be.undefined;
  });

  it('groups a top-level colony trade with its consequences', () => {
    const [game, player, player2] = testGame(2, {coloniesExtension: true});
    const luna = new Luna();
    game.colonies.push(luna);
    luna.addColony(player2);
    player.megaCredits = 20;

    const action = cast(player.colonies.coloniesTradeAction(), AndOptions);
    cast(action.options[0], OrOptions).options.slice(-1)[0].cb();
    cast(action.options[1], SelectColony).cb(luna);
    runAllActions(game);

    const groups = buildJournalView(game.gameLog).filter((n): n is JournalGroupNode => n.kind === 'group');
    const group = groups.find((g) => g.category === 'colony');
    expect(group, 'top-level colony trade group').to.not.be.undefined;
    expect(group!.children.length).to.be.greaterThan(0);
  });

  it('attributes a card-built colony bonus to the COLONY, nested under the card', () => {
    const [game, player] = testGame(2, {coloniesExtension: true});
    const luna = new Luna();
    game.colonies.push(luna);

    // A card-play scope that defers a colony build (the BuildColony path every
    // colony-building card uses). The build BONUS must read source=colony (so it
    // is distinguishable from the card's OWN effects, not at the same level with
    // the same source) yet stay GROUPED under the card — card vs action preserved.
    game.events.beginAction(player, {kind: 'card', card: CardName.RESEARCH_OUTPOST}, {category: 'card-play'});
    game.log('${0} played ${1}', (b) => b.player(player).card(CardName.RESEARCH_OUTPOST));
    game.defer(new BuildColony(player));
    game.events.endScope();

    runAllActions(game);
    player.process({type: 'colony', colonyName: luna.name});
    runAllActions(game);

    const cardRoot = game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'card');
    expect(cardRoot, 'card-play root').to.not.be.undefined;
    // The build bonus (Luna +2 M€ prod) is attributed to the COLONY, not the card.
    const colonyBonus = game.events.events.find((e) => e.source?.kind === 'colony' && e.type === 'production-changed');
    expect(colonyBonus, 'build bonus sourced as colony').to.not.be.undefined;
    // ...and it stays in the CARD's correlation chain (NO separate colony root).
    expect(colonyBonus?.correlationId).to.eq(cardRoot?.correlationId);
    expect(game.events.events.filter((e) => e.type === 'action' && e.source?.kind === 'colony')).to.have.length(0);
  });

  it('groups a copied action under VIRON in the journal', () => {
    const [game, player] = testGame(1);
    const viron = new Viron();
    const tardigrades = new Tardigrades();
    player.playedCards.push(viron, tardigrades);
    player.actionsThisGeneration.add(CardName.TARDIGRADES);

    const select = cast(viron.action(player), SelectCard);
    select.cb([tardigrades]);
    runAllActions(game);

    const groups = buildJournalView(game.gameLog).filter((n): n is JournalGroupNode => n.kind === 'group');
    const group = groups.find((g) => g.header.role === 'root-action' && g.children.length > 0);
    expect(group, 'VIRON copied-action group with a result child').to.not.be.undefined;
  });
});
