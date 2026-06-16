import {expect} from 'chai';
import {testGame} from '../TestGame';
import {runAllActions} from '../TestingUtils';
import {cast} from '@/common/utils/utils';
import {Resource} from '@/common/Resource';
import {OrOptions} from '@/server/inputs/OrOptions';
import {SelectAmount} from '@/server/inputs/SelectAmount';
import {SulphurEatingBacteria} from '@/server/cards/venusNext/SulphurEatingBacteria';
import {TitanShuttles} from '@/server/cards/colonies/TitanShuttles';

/**
 * Regression guard for the "resource gain not shown in the journal" bug class.
 *
 * A card action that CONVERTS a card resource into a standard resource / M€ must add
 * the gained amount through `player.stock.add(...)` — NOT a direct field write
 * (`player.megaCredits += n` / `player.titanium += n`), which bypasses the structured
 * event recorder. The journal + notifications are built from those `GameEvent`s, so a
 * direct write made the SPEND show ("СФ-бактерии → −22") but NOT the gain (the player
 * silently received the M€ / titanium). These tests assert the GAIN is recorded.
 *
 * NOTE: `EventRecorder.recordResourceDelta` skips a sourceless delta when no action /
 * effect scope is active (loose bookkeeping). The live game runs the action INSIDE a
 * scope (the action menu wraps `action()` in `beginAction`), so we mirror that here —
 * else `stock.add` would (correctly) skip recording and the test couldn't observe it.
 */
describe('Resource gain recorded for the journal (no direct field mutation)', () => {
  it('SulphurEatingBacteria: spending microbes records the +M€ gain as a GameEvent', () => {
    const [game, player] = testGame(1);
    const card = new SulphurEatingBacteria();
    player.playedCards.push(card);
    card.resourceCount = 3;
    const before = player.megaCredits;

    game.events.beginAction(player, {kind: 'card', card: card.name}, {category: 'card-action'});
    const orOptions = cast(card.action(player), OrOptions);
    // options[0] = add a microbe; options[1] = spend microbes for 3× M€.
    cast(orOptions.options[1], SelectAmount).cb(3);
    game.events.endScope();
    runAllActions(game);

    expect(player.megaCredits - before).to.eq(9); // 3 microbes × 3
    const gain = game.events.events.find((e) => e.type === 'resource-changed' &&
      e.player === player.color && e.impact.stock?.[Resource.MEGACREDITS] === 9);
    expect(gain, '+M€ gain recorded (was a direct `player.megaCredits +=`, invisible to the journal)').to.not.be.undefined;
  });

  it('TitanShuttles: spending floaters records the +titanium gain as a GameEvent', () => {
    const [game, player] = testGame(1);
    const card = new TitanShuttles();
    player.playedCards.push(card);
    card.resourceCount = 2;
    const before = player.titanium;

    game.events.beginAction(player, {kind: 'card', card: card.name}, {category: 'card-action'});
    const orOptions = cast(card.action(player), OrOptions);
    // options[0] = add floaters to a Jovian card; options[1] = spend floaters for titanium.
    cast(orOptions.options[1], SelectAmount).cb(2);
    game.events.endScope();
    runAllActions(game);

    expect(player.titanium - before).to.eq(2);
    const gain = game.events.events.find((e) => e.type === 'resource-changed' &&
      e.player === player.color && e.impact.stock?.[Resource.TITANIUM] === 2);
    expect(gain, '+titanium gain recorded (was a direct `player.titanium +=`)').to.not.be.undefined;
  });
});
