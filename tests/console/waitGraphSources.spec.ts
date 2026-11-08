import {expect} from 'chai';
import {beginAnimationHold, expireAnimationHoldNow} from '@/client/components/presentation/animationHold';
import {holdWaitNodes} from '@/client/console/waitGraph/waitGraphSources';

/*
 * THE WAIT GRAPH's SOURCES BY CONSTRUCTION (Э4): a hold is a node the moment it stands — its label, its scope, since
 * when, its ceiling as the bound and `hold-expire` as the door — and that door ends it through the owner's own recovery.
 */
describe('waitGraphSources — the registries enter the graph by construction', () => {
  it('a hold is a node with its ceiling as the bound; the door ends it through its owner\'s expire, once', () => {
    let expired = 0;
    const hold = beginAnimationHold('wg-test-hold', {maxHoldMs: 7_000, scope: 'notification-only', expire: () => {
      expired++;
    }});
    try {
      const node = holdWaitNodes().find((n) => n.id === 'hold:wg-test-hold');
      expect(node).to.include({family: 'hold', boundMs: 7_000, recovery: 'hold-expire', detail: 'notification-only'});
      expect(expireAnimationHoldNow('wg-test-hold')).eq(true);
      expect(expired).eq(1);
      expect(holdWaitNodes().some((n) => n.id === 'hold:wg-test-hold'), 'gone with its wait').eq(false);
      expect(expireAnimationHoldNow('wg-test-hold'), 'nothing left to end').eq(false);
    } finally {
      hold.release();
    }
  });
});
