import {expect} from 'chai';
import {testGame} from '../TestGame';
import {Vermin} from '@/server/cards/promo/Vermin';
import {CardName} from '@/common/cards/CardName';

/**
 * Guards the Vermin DAMAGE-stage signal: the moment the card reaches 10 animals
 * (every player then loses 1 VP per city at scoring), a 'vp-pressure' journal
 * ROOT event is emitted so the notification system can warn each player. VP is
 * scored at game end, so this is the honest "pressure activated" moment.
 */
describe('Vermin VP-pressure journal signal', () => {
  it('crossing 10 animals roots a vp-pressure journal event', () => {
    const [game, player] = testGame(2);
    const vermin = new Vermin();
    player.playedCards.push(vermin);
    expect(game.verminInEffect).to.eq(false);

    player.addResourceTo(vermin, {qty: 10, log: false});

    expect(game.verminInEffect).to.eq(true);
    const log = game.gameLog.find((m) => m.category === 'vp-pressure');
    expect(log, 'vp-pressure root log').to.not.be.undefined;
    expect(log!.correlationId, 'correlationId').to.be.a('number');
    expect(log!.role).to.eq('root-action');

    const ev = game.events.events.find((e) => e.type === 'action' && e.source?.kind === 'card' && e.source.card === CardName.VERMIN);
    expect(ev, 'vermin vp-pressure action event').to.not.be.undefined;
  });

  it('does not re-fire the signal when animals stay at/above 10', () => {
    const [game, player] = testGame(2);
    const vermin = new Vermin();
    player.playedCards.push(vermin);
    player.addResourceTo(vermin, {qty: 10, log: false});
    player.addResourceTo(vermin, {qty: 1, log: false}); // 11 — still in effect, no new flip
    const signals = game.gameLog.filter((m) => m.category === 'vp-pressure');
    expect(signals).to.have.length(1);
  });
});
