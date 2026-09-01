import {expect} from 'chai';
import {testGame} from '../TestGame';
import {runAllActions} from '../TestingUtils';
import {SimpleDeferredAction} from '../../src/server/deferredActions/DeferredAction';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {Server} from '../../src/server/models/ServerModel';

/**
 * `Game.openEventCorrelations()` — the server half of the client's ATOMIC
 * notification gate: the correlation roots of causal chains that may STILL
 * GROW (a pending deferred action carrying its captured scope; a player's
 * pending prompt captured inside an action). The client holds a notification
 * of such a chain in its PREPARED state until the chain closes, so a card is
 * never presented as a half-story and enriched on screen.
 */
describe('openEventCorrelations (the atomic-notification gate)', () => {
  it('a deferred action inside an action scope keeps its chain OPEN until it runs', () => {
    const [game, player] = testGame(2);
    game.events.beginAction(player, {kind: 'card', card: 'Birds' as never, owner: player.color});
    player.stock.add('megacredits' as never, 1);
    const rootId = game.events.captureContext()?.rootId;
    game.defer(new SimpleDeferredAction(player, () => undefined));
    game.events.endScope();
    expect(rootId, 'the chain has a root').is.not.undefined;
    expect(game.openEventCorrelations()).contains(rootId);
    runAllActions(game);
    expect(game.openEventCorrelations()).not.contains(rootId);
  });

  it('a pending PROMPT captured inside an action keeps its chain open; answering closes it', () => {
    const [game, player] = testGame(2);
    game.events.beginAction(player, {kind: 'card', card: 'Birds' as never, owner: player.color});
    player.stock.add('megacredits' as never, 1);
    const rootId = game.events.captureContext()?.rootId;
    player.setWaitingFor(new SelectOption('Continue'), () => {});
    game.events.endScope();
    expect(rootId).is.not.undefined;
    expect(game.openEventCorrelations()).contains(rootId);
    player.process({type: 'option'});
    expect(game.openEventCorrelations()).not.contains(rootId);
  });

  it('is served on the game model (viewer-independent, additive)', () => {
    const [game, player] = testGame(2);
    const model = Server.getPlayerModel(player);
    expect(model.game.openEventCorrelations).deep.eq([]);
    game.events.beginAction(player, {kind: 'card', card: 'Birds' as never, owner: player.color});
    player.stock.add('megacredits' as never, 1);
    const rootId = game.events.captureContext()?.rootId;
    game.defer(new SimpleDeferredAction(player, () => undefined));
    game.events.endScope();
    const held = Server.getPlayerModel(player);
    expect(held.game.openEventCorrelations).deep.eq([rootId]);
  });
});
