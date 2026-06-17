import {expect} from 'chai';
import {testGame} from '../TestGame';
import {runAllActions} from '../TestingUtils';
import {CardName} from '@/common/cards/CardName';
import {Resource} from '@/common/Resource';
import {AICentral} from '@/server/cards/base/AICentral';
import {actionOverlayStats, actionStatsBySource} from '@/common/events/aggregate';
import {sourceKey} from '@/common/events/EventSource';

/**
 * Foundation guard for ACTIVE blue-card action stats. Blue-card / corp / CEO actions
 * are already recorded under a `beginAction` scope (category `card-action` etc.), so
 * the foundation is aggregation: `actionStatsBySource` attributes each action's OWN
 * output to its card, told apart from the card's on-PLAY gains by the root category.
 */
describe('Active blue-card action stats', () => {
  it('aggregates a blue-card action: activation count + what it produced', () => {
    const [game, player] = testGame(2);
    const card = new AICentral(); // action: draw 2 cards
    player.playedCards.push(card);

    // Mirror the real action-menu flow (Player.takeAction wraps action() in beginAction).
    game.events.beginAction(player, {kind: 'card', card: card.name, owner: player.color}, {category: 'card-action'});
    card.action(player);
    game.events.endScope();
    runAllActions(game);

    const stats = actionOverlayStats(game.events.events, player.color);
    const ai = stats.find((s) => s.card === CardName.AI_CENTRAL);
    expect(ai, 'AI Central action stat').to.not.be.undefined;
    expect(ai!.triggerCount, 'one activation').to.eq(1);
    expect(ai!.cardsDrawn, 'drew 2 cards').to.eq(2);
    expect(ai!.lastTrigger?.generation).to.eq(game.generation);
  });

  it('two activations accumulate', () => {
    const [game, player] = testGame(2);
    const card = new AICentral();
    player.playedCards.push(card);
    for (let i = 0; i < 2; i++) {
      game.events.beginAction(player, {kind: 'card', card: card.name, owner: player.color}, {category: 'card-action'});
      card.action(player);
      game.events.endScope();
      runAllActions(game);
    }
    const stat = actionStatsBySource(game.events.events, player.color)
      .get(sourceKey({kind: 'card', card: CardName.AI_CENTRAL, owner: player.color}))!;
    expect(stat.triggerCount).to.eq(2);
    expect(stat.cardsDrawn).to.eq(4);
  });

  it('does NOT count a card-PLAY gain as an action (the play/action split)', () => {
    const [game, player] = testGame(2);
    // A gain recorded under a card-PLAY scope must not appear in action stats.
    game.events.beginAction(player, {kind: 'card', card: CardName.AI_CENTRAL, owner: player.color}, {category: 'card-play'});
    player.stock.add(Resource.PLANTS, 3);
    game.events.endScope();

    const stats = actionOverlayStats(game.events.events, player.color);
    expect(stats.find((s) => s.card === CardName.AI_CENTRAL), 'a play is not an action').to.be.undefined;
  });
});
