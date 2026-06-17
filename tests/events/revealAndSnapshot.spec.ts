import {expect} from 'chai';
import {testGame} from '../TestGame';
import {fakeCard, runAllActions} from '../TestingUtils';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {Resource} from '@/common/Resource';
import {SearchForLife} from '@/server/cards/base/SearchForLife';
import {buildEndgameFacts} from '@/common/events/endgameFacts';

/**
 * Iteration 4 bridges — REAL recording of public reveals (no private leak) + the
 * before/after snapshot on resource/production losses.
 */
describe('reveal facts + before/after snapshots (Iteration 4)', () => {
  it('a PUBLIC deck reveal (SearchForLife) records a card-revealed event → a reveal fact', () => {
    const [game, player] = testGame(2);
    const card = new SearchForLife();
    player.playedCards.push(card);
    player.megaCredits = 1;
    game.projectDeck.drawPile.push(fakeCard({tags: [Tag.MICROBE]})); // a hit

    game.events.beginAction(player, {kind: 'card', card: card.name, owner: player.color}, {category: 'card-action'});
    card.action(player);
    runAllActions(game); // pays + reveals
    game.events.endScope();

    const reveal = game.events.events.find((e) => e.type === 'card-revealed');
    expect(reveal, 'a card-revealed event was recorded').to.not.be.undefined;
    expect(reveal!.impact.reveal).to.deep.eq({origin: 'deck', result: 'discarded', count: 1, found: true});
    expect(reveal!.source).to.deep.eq({kind: 'card', card: CardName.SEARCH_FOR_LIFE, owner: player.color});
    expect(reveal!.tags).to.contain('reveal');

    const reveals = buildEndgameFacts(game.events.events).filter((f) => f.type === 'reveal');
    expect(reveals).to.have.length(1);
    expect(reveals[0].metrics.revealed).to.eq(1);
    expect(reveals[0].metrics.searchHits).to.eq(1);
  });

  it('a PRIVATE draw does NOT create a public reveal event', () => {
    const [game, player] = testGame(2);
    game.events.beginAction(player, {kind: 'card', card: CardName.AI_CENTRAL, owner: player.color}, {category: 'card-action'});
    player.drawCard(2); // a private draw — the player sees them, opponents do not
    runAllActions(game);
    game.events.endScope();
    expect(game.events.events.some((e) => e.type === 'card-revealed'), 'no public reveal from a private draw').to.be.false;
  });

  it('a resource loss carries a before/after snapshot', () => {
    const [game, player] = testGame(2);
    player.stock.add(Resource.PLANTS, 5);
    game.events.beginAction(player, {kind: 'card', card: CardName.PREDATORS, owner: player.color}, {category: 'card-action'});
    // Lose 2 plants attributed to a source (so the delta is recorded).
    player.stock.add(Resource.PLANTS, -2, {from: {card: CardName.PREDATORS}});
    game.events.endScope();

    const loss = game.events.events.find((e) => e.type === 'resource-changed' &&
      e.impact.stock?.[Resource.PLANTS] === -2);
    expect(loss, 'the plant loss was recorded').to.not.be.undefined;
    expect(loss!.impact.snapshot).to.deep.eq({resource: Resource.PLANTS, scope: 'stock', before: 5, after: 3});
  });
});
