import {expect} from 'chai';
import {CardResource} from '../../src/common/CardResource';
import {CardName} from '../../src/common/cards/CardName';
import {Resource} from '../../src/common/Resource';
import {AddResourcesToCard} from '../../src/server/deferredActions/AddResourcesToCard';
import {DecreaseAnyProduction} from '../../src/server/deferredActions/DecreaseAnyProduction';
import {GainAnyResourceButScienceDeferred} from '../../src/server/deferredActions/GainAnyResourceButScienceDeferred';
import {IncreaseColonyTrack} from '../../src/server/deferredActions/IncreaseColonyTrack';
import {RemoveAnyPlants} from '../../src/server/deferredActions/RemoveAnyPlants';
import {RemoveResourcesFromCard} from '../../src/server/deferredActions/RemoveResourcesFromCard';
import {SelectCardDeferred} from '../../src/server/deferredActions/SelectCardDeferred';
import {SelectPaymentDeferred} from '../../src/server/deferredActions/SelectPaymentDeferred';
import {SelectResourceTypeDeferred} from '../../src/server/deferredActions/SelectResourceTypeDeferred';
import {StealResources} from '../../src/server/deferredActions/StealResources';
import {cardSource, colonySource} from '../../src/server/inputs/choiceContext';
import {Ants} from '../../src/server/cards/base/Ants';
import {Predators} from '../../src/server/cards/base/Predators';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {Birds} from '../../src/server/cards/base/Birds';
import {Server} from '../../src/server/models/ServerModel';
import {testGame} from '../TestGame';

/*
 * THE SHARED DEFERRED HELPERS MUST CARRY THEIR CAUSE.
 *
 * Each of these is reused by dozens of cards, so it can only learn WHO caused
 * the prompt from its caller — and for years none of them asked. The player met
 * a card picker / a target list / a bare «Выберите вариант» with nothing naming
 * the effect that fired (docs/PROMPT_SOURCE_AUDIT.md).
 *
 * The contract these specs pin down is deliberately narrow and structural: the
 * prompt a helper builds carries `choiceContext.source`, and it survives
 * `Server.getWaitingFor` — which is the only thing the client ever reads.
 */
describe('shared deferred actions carry WHO caused the prompt', () => {
  it('AddResourcesToCard marks the picker with the causing card', () => {
    const [game, player] = testGame(2);
    player.playedCards.push(new Tardigrades(), new Ants());

    const input = new AddResourcesToCard(player, CardResource.MICROBE, {
      count: 1, autoSelect: false, cause: cardSource(new Ants()),
    }).execute();

    const model = Server.getWaitingFor(player, input!);
    expect(model?.choiceContext?.source.card).to.eq(CardName.ANTS);
    expect(model?.choiceContext?.mode).to.eq('reward');
    void game;
  });

  it('…and a COLONY cause names the colony instead of a card', () => {
    const [/* game */, player] = testGame(2);
    player.playedCards.push(new Tardigrades(), new Ants());

    const input = new AddResourcesToCard(player, CardResource.MICROBE, {
      count: 1, autoSelect: false, cause: colonySource('Ganymede'),
    }).execute();

    const context = Server.getWaitingFor(player, input!)?.choiceContext;
    expect(context?.source.kind).to.eq('colony');
    expect(context?.source.card).is.undefined;
    expect(context?.source.name).to.eq('Ganymede');
  });

  it('RemoveResourcesFromCard marks the attack picker', () => {
    const [/* game */, player, opponent] = testGame(2);
    const birdsA = new Birds();
    const birdsB = new Birds();
    player.playedCards.push(birdsA);
    opponent.playedCards.push(birdsB);
    player.addResourceTo(birdsA, 2);
    opponent.addResourceTo(birdsB, 2);

    const input = new RemoveResourcesFromCard(player, CardResource.ANIMAL, 1, {
      autoselect: false, cause: cardSource(new Predators()),
    }).execute();

    const context = Server.getWaitingFor(player, input!)?.choiceContext;
    expect(context?.source.card).to.eq(CardName.PREDATORS);
    // Taking from someone else IS an attack — the kicker must say so.
    expect(context?.mode).to.eq('attack');
  });

  it('an UNMARKED helper still builds its prompt (backward-compatible)', () => {
    const [/* game */, player] = testGame(2);
    player.playedCards.push(new Tardigrades(), new Ants());
    const input = new AddResourcesToCard(player, CardResource.MICROBE, {count: 1, autoSelect: false}).execute();
    expect(Server.getWaitingFor(player, input!)?.choiceContext).is.undefined;
  });

  it('StealResources marks the target picker', () => {
    const [/* game */, player, opponent] = testGame(2);
    opponent.stock.add(Resource.MEGACREDITS, 10);

    const input = new StealResources(player, Resource.MEGACREDITS, 3, undefined, false, cardSource(new Ants())).execute();
    expect(Server.getWaitingFor(player, input!)?.choiceContext?.source.card).to.eq(CardName.ANTS);
  });

  it('RemoveAnyPlants marks the target picker', () => {
    const [/* game */, player, opponent] = testGame(2);
    opponent.stock.add(Resource.PLANTS, 5);

    const input = new RemoveAnyPlants(player, 2, undefined, undefined, cardSource(new Ants())).execute();
    expect(Server.getWaitingFor(player, input!)?.choiceContext?.source.card).to.eq(CardName.ANTS);
  });

  it('DecreaseAnyProduction marks the target picker', () => {
    const [/* game */, player, opponent] = testGame(2);
    opponent.production.add(Resource.ENERGY, 2);

    const input = new DecreaseAnyProduction(player, Resource.ENERGY, {count: 1, cause: cardSource(new Ants())}).execute();
    expect(Server.getWaitingFor(player, input!)?.choiceContext?.source.card).to.eq(CardName.ANTS);
  });

  // The worst offender by title alone: a bare «Выберите вариант» with three
  // unexplained branches. Even the FALLBACK must name what fired.
  it('GainAnyResourceButScienceDeferred names its cause', () => {
    const [/* game */, player] = testGame(2);
    const input = new GainAnyResourceButScienceDeferred(player, cardSource(new Ants())).execute();
    expect(Server.getWaitingFor(player, input!)?.choiceContext?.source.card).to.eq(CardName.ANTS);
  });

  it('IncreaseColonyTrack names its colony — and its decline is a structural skip', () => {
    const [game, player] = testGame(2, {coloniesExtension: true});
    const colony = game.colonies[0];

    const input = new IncreaseColonyTrack(player, colony, 2).execute();
    const model = Server.getWaitingFor(player, input!);
    expect(model?.choiceContext?.source.kind).to.eq('colony');
    expect(model?.choiceContext?.source.name).to.eq(colony.name);
    // [2 steps, 1 step, don't] — the decline is found by its marker, never its
    // index or title (the trade batch replays a captured INDEX, so the order
    // itself is pinned here too).
    const options = (model as {options?: Array<{metadata?: {kind?: string}}>}).options ?? [];
    expect(options).has.lengthOf(3);
    expect(options[2].metadata?.kind).to.eq('skip');
  });

  it('SelectResourceTypeDeferred marks the production choice', () => {
    const [/* game */, player] = testGame(2);
    const input = new SelectResourceTypeDeferred(
      player, [Resource.STEEL, Resource.TITANIUM], 'Select a resource to gain 1 unit of production',
      cardSource(new Ants())).execute();
    const context = Server.getWaitingFor(player, input!)?.choiceContext;
    expect(context?.source.card).to.eq(CardName.ANTS);
    expect(context?.mode).to.eq('effect-choice');
  });

  it('SelectCardDeferred marks the card pick', () => {
    const [/* game */, player] = testGame(2);
    const input = new SelectCardDeferred(player, [new Birds(), new Predators()], {
      title: 'Select card to add 1 animal', cause: cardSource(new Ants()),
    }).execute();
    expect(Server.getWaitingFor(player, input!)?.choiceContext?.source.card).to.eq(CardName.ANTS);
  });

  it('SelectPaymentDeferred marks the payment it raises', () => {
    const [/* game */, player] = testGame(2);
    player.stock.add(Resource.MEGACREDITS, 10);
    player.stock.add(Resource.STEEL, 3);

    const input = new SelectPaymentDeferred(player, 5, {canUseSteel: true, cause: cardSource(new Ants())}).execute();
    expect(Server.getWaitingFor(player, input!)?.choiceContext?.source.card).to.eq(CardName.ANTS);
  });
});
