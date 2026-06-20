import {expect} from 'chai';
import {testGame} from '../TestGame';
import {runAllActions} from '../TestingUtils';
import {cast} from '@/common/utils/utils';
import {Resource} from '@/common/Resource';
import {Hackers} from '@/server/cards/base/Hackers';
import {Sabotage} from '@/server/cards/base/Sabotage';
import {SelectPlayer} from '@/server/inputs/SelectPlayer';
import {OrOptions} from '@/server/inputs/OrOptions';
import {diffNegativeNotifications} from '@/client/components/notifications/notificationModel';

/**
 * Guard for the premium RED "you were attacked" notification: a cross-player
 * resource/production loss must be recorded as a structured victim GameEvent
 * (player = victim, attacker attributed) so {@link diffNegativeNotifications}
 * surfaces a hostile card to the victim.
 *
 * The attack mutation runs AFTER a SelectPlayer/OrOptions input boundary, so this
 * specifically exercises that the captured event scope survives the boundary (via
 * Player.process restoring `waitingForContext`) — the path that the raw `.cb`
 * test shortcut bypasses. Responses go through `Player.process` exactly like the
 * live server.
 */
describe('attack → victim red notification', () => {
  it('Hackers production reduction (steal) reaches the victim as a negative notification', () => {
    const [game, attacker, victim] = testGame(2);
    victim.production.add(Resource.MEGACREDITS, 5);

    attacker.playCard(new Hackers());
    runAllActions(game);

    // The attacker chooses whose M€ production to reduce — answer via the REAL
    // response path so the captured scope is restored around the attack.
    cast(attacker.getWaitingFor(), SelectPlayer);
    attacker.process({type: 'player', player: victim.color});
    runAllActions(game);

    const victimEvent = game.events.events.find((e) =>
      e.type === 'production-changed' && e.player === victim.color && e.impact.production?.megacredits === -2);
    expect(victimEvent, 'victim production-changed event recorded').to.not.be.undefined;
    expect(victimEvent!.target?.player, 'attacker attributed').to.eq(attacker.color);

    const {models} = diffNegativeNotifications({
      events: game.events.events, seen: new Set(), viewerColor: victim.color, generation: game.generation, createdAt: 1,
    });
    expect(models, 'a red notification is generated for the victim').to.have.length(1);
    expect(models[0]).to.include({kind: 'negative', actor: attacker.color});
  });

  it('Sabotage M€ removal (a destroy, attributed via the action scope) reaches the victim', () => {
    const [game, attacker, victim] = testGame(2);
    victim.megaCredits = 8;

    // Play through `playCard` so the analytics action scope is established (the
    // non-stealing destroy attributes the attacker via the scope's source card,
    // which must survive the OrOptions input boundary).
    attacker.playCard(new Sabotage());
    runAllActions(game);

    // Victim holds only M€, so the single attack option is index 0 (index 1 is the
    // "Do not remove" skip).
    const prompt = cast(attacker.getWaitingFor(), OrOptions);
    expect(prompt.options.length).to.eq(2);
    attacker.process({type: 'or', index: 0, response: {type: 'option'}});
    runAllActions(game);

    const victimEvent = game.events.events.find((e) =>
      e.type === 'resource-changed' && e.player === victim.color && (e.impact.stock?.megacredits ?? 0) < 0);
    expect(victimEvent, 'victim resource-changed event recorded').to.not.be.undefined;

    const {models} = diffNegativeNotifications({
      events: game.events.events, seen: new Set(), viewerColor: victim.color, generation: game.generation, createdAt: 1,
    });
    expect(models.length, 'victim sees a negative notification').to.be.greaterThan(0);
    expect(models[0]).to.include({kind: 'negative', actor: attacker.color});
  });
});
