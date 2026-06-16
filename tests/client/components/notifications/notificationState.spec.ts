import {expect} from 'chai';
import {NotificationModel, NotificationKind, NOTIFICATION_PRIORITY, MAX_VISIBLE_TRANSIENT} from '@/client/components/notifications/notificationTypes';
import {
  notificationState,
  pushTransient,
  pushMany,
  setTurn,
  dismiss,
  toggleExpanded,
  clearTransient,
  resetNotifications,
} from '@/client/components/notifications/notificationState';

function model(id: string, kind: NotificationKind = 'normal'): NotificationModel {
  return {
    id,
    kind,
    variant: 'event',
    priority: NOTIFICATION_PRIORITY[kind],
    typeLabelKey: 'Event',
    pills: [],
    detailCount: 0,
    generation: 1,
    ttl: kind === 'your-turn' || kind === 'action-required' ? 0 : 8000,
    persistent: kind === 'your-turn' || kind === 'action-required',
    createdAt: 1,
  };
}

describe('notificationState (lifecycle)', () => {
  beforeEach(() => {
    resetNotifications();
    notificationState.seeded = true;
  });

  describe('transient queue', () => {
    it('shows up to the cap and queues the overflow', () => {
      pushMany([model('a'), model('b'), model('c'), model('d')]);
      expect(notificationState.transient.map((n) => n.id)).to.deep.eq(['a', 'b', 'c']);
      expect(notificationState.queue.map((n) => n.id)).to.deep.eq(['d']);
      expect(MAX_VISIBLE_TRANSIENT).to.eq(3);
    });

    it('promotes from the queue when a visible card is dismissed', () => {
      pushMany([model('a'), model('b'), model('c'), model('d')]);
      dismiss('b');
      expect(notificationState.transient.map((n) => n.id)).to.deep.eq(['a', 'c', 'd']);
      expect(notificationState.queue).to.have.length(0);
    });

    it('de-dupes by id across visible + queue', () => {
      pushMany([model('a'), model('b'), model('c'), model('d')]);
      pushTransient(model('d')); // already queued
      pushTransient(model('a')); // already visible
      expect(notificationState.queue).to.have.length(1);
    });

    it('a higher-priority (negative) card EVICTS a normal one into the queue when full', () => {
      pushMany([model('a'), model('b'), model('c')]); // 3 normal, full
      pushTransient(model('hit', 'negative')); // higher priority
      expect(notificationState.transient.some((n) => n.id === 'hit')).to.eq(true);
      expect(notificationState.transient).to.have.length(3);
      // one normal got bumped to the FRONT of the queue
      expect(notificationState.queue).to.have.length(1);
      expect(['a', 'b', 'c']).to.include(notificationState.queue[0].id);
    });

    it('respects the showNormal setting', () => {
      notificationState.settings.showNormal = false;
      pushTransient(model('a'));
      expect(notificationState.transient).to.have.length(0);
      notificationState.settings.showNormal = true;
    });
  });

  describe('toggle / expand', () => {
    it('toggles a transient card expanded flag', () => {
      pushTransient(model('a'));
      toggleExpanded('a');
      expect(notificationState.transient[0].expanded).to.eq(true);
      toggleExpanded('a');
      expect(notificationState.transient[0].expanded).to.eq(false);
    });
  });

  describe('turn card', () => {
    it('sets and replaces the singleton turn card', () => {
      setTurn(model('turn:your-turn', 'your-turn'));
      expect(notificationState.turn?.id).to.eq('turn:your-turn');
      setTurn(model('turn:action-required', 'action-required'));
      expect(notificationState.turn?.id).to.eq('turn:action-required');
      setTurn(undefined);
      expect(notificationState.turn).to.eq(undefined);
    });

    it('keeps an acknowledged turn hidden until the prompt id changes', () => {
      setTurn(model('turn:your-turn', 'your-turn'));
      dismiss('turn:your-turn'); // acknowledge
      expect(notificationState.turn).to.eq(undefined);
      // Same prompt re-asserted → stays hidden.
      setTurn(model('turn:your-turn', 'your-turn'));
      expect(notificationState.turn).to.eq(undefined);
      // A DIFFERENT prompt → shows again.
      setTurn(model('turn:action-required', 'action-required'));
      expect(notificationState.turn?.id).to.eq('turn:action-required');
    });

    it('preserves the expanded flag when the same turn updates in place', () => {
      setTurn(model('turn:action-required', 'action-required'));
      toggleExpanded('turn:action-required');
      expect(notificationState.turn?.expanded).to.eq(true);
      setTurn(model('turn:action-required', 'action-required'));
      expect(notificationState.turn?.expanded).to.eq(true);
    });
  });

  describe('reset', () => {
    it('clears everything', () => {
      pushMany([model('a'), model('b')]);
      setTurn(model('turn:your-turn', 'your-turn'));
      clearTransient();
      expect(notificationState.transient).to.have.length(0);
      expect(notificationState.queue).to.have.length(0);
      expect(notificationState.turn?.id).to.eq('turn:your-turn'); // clearTransient keeps the turn
      resetNotifications();
      expect(notificationState.turn).to.eq(undefined);
      expect(notificationState.seenRootIds.size).to.eq(0);
    });
  });
});
