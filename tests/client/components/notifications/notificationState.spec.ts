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
  holdVisibleTransient,
  acknowledgeFlowHoldingCards,
  drainQueueToJournal,
  pendingSummary,
} from '@/client/components/notifications/notificationState';
import {resetPresentationLeases, acquireForegroundLease} from '@/client/components/presentation/presentationFlow';
import {revealResultState, dismissReveal} from '@/client/components/actions/revealResultState';
import {botTurnReviewState, resetBotTurnReview} from '@/client/components/marsbot/botTurnReviewState';
import {drawnCardsState} from '@/client/components/drawnCards/drawnCardsState';
import {setBotAckViewer, resetBotTurnAckForTesting} from '@/client/components/marsbot/botTurnAck';

function model(id: string, kind: NotificationKind = 'normal', extra: Partial<NotificationModel> = {}): NotificationModel {
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
    ...extra,
  };
}

describe('notificationState (lifecycle)', () => {
  beforeEach(() => {
    resetNotifications();
    // Presentation flow: no blocking foreground — delivery is open.
    resetPresentationLeases();
    resetBotTurnReview();
    dismissReveal();
    drawnCardsState.events = [];
    notificationState.seeded = true;
  });

  describe('transient queue (serial FIFO — the presentation-flow rework)', () => {
    it('shows ONE card at a time and queues the rest', () => {
      pushMany([model('a'), model('b'), model('c'), model('d')]);
      expect(notificationState.transient.map((n) => n.id)).to.deep.eq(['a']);
      expect(notificationState.queue.map((n) => n.id)).to.deep.eq(['b', 'c', 'd']);
      expect(MAX_VISIBLE_TRANSIENT).to.eq(1);
    });

    it('promotes from the queue FIFO when the visible card is dismissed', () => {
      pushMany([model('a'), model('b'), model('c')]);
      dismiss('a');
      expect(notificationState.transient.map((n) => n.id)).to.deep.eq(['b']);
      dismiss('b');
      expect(notificationState.transient.map((n) => n.id)).to.deep.eq(['c']);
      expect(notificationState.queue).to.have.length(0);
    });

    it('de-dupes by id across visible + queue', () => {
      pushMany([model('a'), model('b')]);
      pushTransient(model('b')); // already queued
      pushTransient(model('a')); // already visible
      expect(notificationState.transient).to.have.length(1);
      expect(notificationState.queue).to.have.length(1);
    });

    it('a higher-priority (negative) card EVICTS the visible normal one into the queue front', () => {
      pushMany([model('a'), model('b')]); // a visible, b queued
      pushTransient(model('hit', 'negative'));
      expect(notificationState.transient.map((n) => n.id)).to.deep.eq(['hit']);
      // The evicted card waits at the FRONT (it re-presents first).
      expect(notificationState.queue.map((n) => n.id)).to.deep.eq(['a', 'b']);
    });

    it('within the queue, promotion is priority-first, FIFO within a priority', () => {
      pushMany([model('a'), model('b'), model('loss', 'negative'), model('c')]);
      dismiss('a');
      // The hostile loss jumps the ordinary queue.
      expect(notificationState.transient.map((n) => n.id)).to.deep.eq(['loss']);
      dismiss('loss');
      expect(notificationState.transient.map((n) => n.id)).to.deep.eq(['b']);
    });

    it('respects the showNormal setting', () => {
      notificationState.settings.showNormal = false;
      pushTransient(model('a'));
      expect(notificationState.transient).to.have.length(0);
      notificationState.settings.showNormal = true;
    });
  });

  describe('presentation-flow delivery gate', () => {
    it('a blocking foreground (result modal) sends fresh cards to the queue — never on top', () => {
      revealResultState.active = true;
      pushTransient(model('a'));
      expect(notificationState.transient).to.have.length(0);
      expect(notificationState.queue.map((n) => n.id)).to.deep.eq(['a']);
    });

    it('a mandatory-choice lease queues delivery; dismiss cannot promote while blocked', () => {
      const release = acquireForegroundLease('mandatory-choice');
      pushTransient(model('a'));
      pushTransient(model('b'));
      expect(notificationState.transient).to.have.length(0);
      expect(notificationState.queue).to.have.length(2);
      release();
    });

    it('the open theater blocks delivery too (no toasts over the narration)', () => {
      botTurnReviewState.open = true;
      pushTransient(model('a'));
      expect(notificationState.transient).to.have.length(0);
      expect(notificationState.queue).to.have.length(1);
      botTurnReviewState.open = false;
    });

    it('holdVisibleTransient re-queues the visible card at the FRONT (a blocker opened)', () => {
      pushMany([model('a'), model('b')]);
      holdVisibleTransient();
      expect(notificationState.transient).to.have.length(0);
      expect(notificationState.queue.map((n) => n.id)).to.deep.eq(['a', 'b']);
    });
  });

  describe('flow-holding cards + the pending summary', () => {
    it('acknowledgeFlowHoldingCards dismisses only the visible holding card', () => {
      pushTransient(model('bot', 'important', {holdsFlow: true, variant: 'bot-turn'}));
      pushTransient(model('b'));
      acknowledgeFlowHoldingCards();
      // The holding card is gone; the queued ordinary card promotes.
      expect(notificationState.transient.map((n) => n.id)).to.deep.eq(['b']);
    });

    it('acknowledgeFlowHoldingCards soft-acks the bot turn (server stops extending the next turn)', () => {
      // Regression: playing on used to drop the card WITHOUT telling the server,
      // so `unacked` never cleared and every subsequent paced bot turn hit the
      // max extension. Acting must fire the same ack as a manual dismiss/TTL.
      const originalFetch = global.fetch;
      const urls: Array<string> = [];
      global.fetch = ((url: string) => {
        urls.push(url);
        return Promise.resolve({ok: true} as Response);
      }) as typeof fetch;
      try {
        setBotAckViewer('viewer-1');
        pushTransient(model('bot', 'important', {holdsFlow: true, variant: 'bot-turn', botTurnKey: 'red:2:7'}));
        acknowledgeFlowHoldingCards();
        expect(urls).to.have.length(1);
        expect(urls[0]).to.contain('key=red%3A2%3A7');
      } finally {
        global.fetch = originalFetch;
        resetBotTurnAckForTesting();
      }
    });

    it('pendingSummary reports the backlog + critical content', () => {
      expect(pendingSummary()).to.deep.eq({count: 0, critical: false});
      pushMany([model('a'), model('b'), model('c')]);
      expect(pendingSummary()).to.deep.eq({count: 2, critical: false});
      // A blocked flow-holding AI-turn card waits in the queue → critical.
      const release = acquireForegroundLease('mandatory-choice');
      pushTransient(model('bot', 'important', {holdsFlow: true}));
      expect(pendingSummary().count).to.eq(3);
      expect(pendingSummary().critical).to.eq(true);
      release();
    });

    it('drainQueueToJournal drops ordinary cards, KEEPS hostile + flow-holding ones', () => {
      revealResultState.active = true; // everything queues
      pushMany([
        model('a'), model('gen', 'important'),
        model('loss', 'negative'),
        model('bot', 'important', {holdsFlow: true}),
      ]);
      drainQueueToJournal();
      expect(notificationState.queue.map((n) => n.id)).to.deep.eq(['loss', 'bot']);
      dismissReveal();
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
