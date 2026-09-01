import {expect} from 'chai';
import {nextTick} from 'vue';
import {Color} from '@/common/Color';
import {NotificationModel, NotificationKind, NOTIFICATION_PRIORITY, MAX_VISIBLE_TRANSIENT} from '@/client/components/notifications/notificationTypes';
import {
  notificationState,
  pushTransient,
  pushMany,
  setTurn,
  setNotificationViewer,
  dismiss,
  toggleExpanded,
  clearTransient,
  resetNotifications,
  stashPreparing,
  takePreparedModels,
  preparingIds,
  dropPreparing,
  PREPARING_MAX_MS,
  acknowledgeFlowHoldingCards,
  drainQueueToJournal,
  pendingSummary,
  notificationsSettled,
  noteNotificationLeaveStart,
  noteNotificationLeaveEnd,
} from '@/client/components/notifications/notificationState';
import {setNotificationFeedMode} from '@/client/components/notifications/notificationFeedMode';
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
    sign: 'neutral',
    importance: 'ambient',
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

    it('a higher-priority (negative) arrival NEVER evicts the visible card — it jumps the QUEUE instead', () => {
      // The old eviction was a backward lifecycle edge (presented → queued):
      // the card being read vanished and returned with a fresh entrance and a
      // fresh lifetime. Presented is monotonic; priority acts inside the queue.
      pushMany([model('a'), model('b')]); // a visible, b queued
      pushTransient(model('hit', 'negative'));
      expect(notificationState.transient.map((n) => n.id)).to.deep.eq(['a']);
      dismiss('a');
      // …and at the hand-over the hostile card outranks the earlier ordinary one.
      expect(notificationState.transient.map((n) => n.id)).to.deep.eq(['hit']);
      expect(notificationState.queue.map((n) => n.id)).to.deep.eq(['b']);
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

    // THE FEED KEEPS FLOWING WHILE THE PLAYER WORKS. A `mandatory-choice` lease
    // means a decision surface / workspace is up (the start flow, the draft, a
    // payment) — not that the screen is telling a story of its own. Silencing
    // the feed for it piled the game's events up as «СОБЫТИЯ В ОЧЕРЕДИ +N» for
    // most of a turn; the bot's moves are exactly what a player must keep
    // hearing while they work.
    it('a mandatory-choice lease does NOT silence the feed (the player is working, not watching)', () => {
      const release = acquireForegroundLease('mandatory-choice');
      pushTransient(model('a'));
      pushTransient(model('b'));
      expect(notificationState.transient.map((n) => n.id)).to.deep.eq(['a']);
      expect(notificationState.queue.map((n) => n.id)).to.deep.eq(['b']);
      release();
    });

    it('a ceremony BEHIND a mandatory lease still silences it (every raised reason counts)', () => {
      const release = acquireForegroundLease('mandatory-choice');
      const ceremony = acquireForegroundLease('ceremony');
      pushTransient(model('a'));
      expect(notificationState.transient).to.have.length(0);
      expect(notificationState.queue.map((n) => n.id)).to.deep.eq(['a']);
      ceremony();
      release();
    });

    it('the open theater blocks delivery too (no toasts over the narration)', () => {
      botTurnReviewState.open = true;
      pushTransient(model('a'));
      expect(notificationState.transient).to.have.length(0);
      expect(notificationState.queue).to.have.length(1);
      botTurnReviewState.open = false;
    });

    // ── THE DELIVERY GATE IS NOT A VISIBILITY GATE (2026-09 atomic rework) ──
    // A presented card is DELIVERED: it leaves only by its own timer or the
    // player's explicit close. Blockers gate exactly one transition —
    // queued → presented. The old holdVisibleTransient (re-queue visible cards
    // when a blocker opens) restarted TTLs, replayed entrances and — because
    // the bot card's own delivery triggers the bot's tile animation — made the
    // card evict ITSELF: the «two versions of one event» defect.
    it('a blocker OPENING leaves the already-presented card visible (presented is monotonic)', async () => {
      pushMany([model('a'), model('b')]);
      expect(notificationState.transient.map((n) => n.id)).to.deep.eq(['a']);
      // A silencing foreground (an animation / reveal / ceremony) opens.
      revealResultState.active = true;
      await nextTick();
      // The active card STAYS; the queued one keeps waiting.
      expect(notificationState.transient.map((n) => n.id)).to.deep.eq(['a']);
      expect(notificationState.queue.map((n) => n.id)).to.deep.eq(['b']);
      // A fresh event delivered during the blocker queues (delivery gate).
      pushTransient(model('c'));
      expect(notificationState.transient.map((n) => n.id)).to.deep.eq(['a']);
      expect(notificationState.queue.map((n) => n.id)).to.deep.eq(['b', 'c']);
      // The player closes the active card mid-blocker: it goes, and the NEXT
      // one does NOT present until the blocker clears.
      dismiss('a');
      expect(notificationState.transient).to.have.length(0);
      expect(notificationState.queue.map((n) => n.id)).to.deep.eq(['b', 'c']);
      dismissReveal();
      await nextTick();
      expect(notificationState.transient.map((n) => n.id)).to.deep.eq(['b']);
    });

    it('the visible card keeps its identity object across a blocker (no remount, no TTL restart)', async () => {
      pushTransient(model('a'));
      const live = notificationState.transient[0];
      revealResultState.active = true;
      await nextTick();
      dismissReveal();
      await nextTick();
      // Same LiveNotification object — the card was never re-created, so its
      // entrance cannot replay and its CSS lifetime cannot re-arm.
      expect(notificationState.transient[0]).to.eq(live);
    });
  });

  describe('the PREPARING stage (atomic presentation)', () => {
    it('an open-correlation model waits in preparing, never in the queue', () => {
      stashPreparing(model('g7', 'normal', {correlationId: 7}), 1000);
      expect(notificationState.queue).to.have.length(0);
      expect(notificationState.transient).to.have.length(0);
      expect([...preparingIds()]).to.deep.eq([7]);
    });

    it('release happens exactly when the chain closes, with the LATEST rebuild', () => {
      stashPreparing(model('g7', 'normal', {correlationId: 7}), 1000);
      // A later diff rebuilt the model richer (the chain grew server-side).
      stashPreparing(model('g7', 'negative', {correlationId: 7, sign: 'negative'}), 2000);
      expect(takePreparedModels(new Set([7]), 3000)).to.have.length(0);
      const released = takePreparedModels(new Set(), 4000);
      expect(released).to.have.length(1);
      expect(released[0].sign).to.eq('negative');
      expect([...preparingIds()]).to.deep.eq([]);
    });

    it('a leaked open chain releases at the ceiling with a warn, never silently swallows', () => {
      stashPreparing(model('g9', 'normal', {correlationId: 9}), 1000);
      expect(takePreparedModels(new Set([9]), 1000 + PREPARING_MAX_MS - 1)).to.have.length(0);
      const released = takePreparedModels(new Set([9]), 1000 + PREPARING_MAX_MS);
      expect(released).to.have.length(1);
    });

    it('dropPreparing forgets an undone event', () => {
      stashPreparing(model('g5', 'normal', {correlationId: 5}), 1000);
      dropPreparing(5);
      expect(takePreparedModels(new Set(), 9999)).to.have.length(0);
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
      // Silenced by a REVEAL (something that owns the screen): a mandatory
      // lease no longer queues anything, and the card would simply present.
      revealResultState.active = true;
      pushTransient(model('bot', 'important', {holdsFlow: true}));
      expect(pendingSummary().count).to.eq(3);
      expect(pendingSummary().critical).to.eq(true);
      dismissReveal();
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

  describe('quick-toast feed mode («Только связанные со мной»)', () => {
    const RED = 'red' as Color;
    const BLUE = 'blue' as Color;

    beforeEach(() => {
      setNotificationViewer(BLUE);
      setNotificationFeedMode('personal');
    });

    afterEach(() => {
      // Module state is bundle-shared — restore the default mode for the rest
      // of the suite (the outer beforeEach's resetNotifications clears viewer).
      setNotificationFeedMode('all');
    });

    it('an ambient event never enters the feed — no toast, no queue, no auto-close wait', () => {
      pushTransient(model('amb', 'normal', {actor: RED, affects: [RED]}));
      expect(notificationState.transient).to.have.length(0);
      expect(notificationState.queue).to.have.length(0);
      // A hidden toast owns NO lifetime: the feed reads settled immediately,
      // so a following mandatory prompt never waits a phantom five seconds.
      expect(notificationsSettled()).to.eq(true);
    });

    it('an event that involves the viewer presents normally', () => {
      pushTransient(model('mine', 'normal', {actor: RED, affects: [RED, BLUE]}));
      expect(notificationState.transient.map((n) => n.id)).to.deep.eq(['mine']);
    });

    it('hostile losses and warnings are exempt from the mode', () => {
      pushTransient(model('loss', 'negative', {variant: 'steal', actor: RED}));
      pushTransient(model('warn', 'warning', {variant: 'warning'}));
      expect([...notificationState.transient, ...notificationState.queue].map((n) => n.id))
        .to.have.members(['loss', 'warn']);
    });

    it('filters by the LOCAL viewer identity — re-pointing the viewer flips the decision', () => {
      const forYellow = model('y', 'normal', {actor: RED, affects: ['yellow' as Color]});
      pushTransient(forYellow);
      expect(notificationState.transient, 'blue is a bystander').to.have.length(0);
      setNotificationViewer('yellow' as Color);
      pushTransient({...forYellow, id: 'y2'});
      expect(notificationState.transient.map((n) => n.id), 'yellow is the target').to.deep.eq(['y2']);
    });

    it('the singleton turn card ignores the feed mode (mandatory signals never filter)', () => {
      setTurn(model('turn:action-required', 'action-required'));
      expect(notificationState.turn?.id).to.eq('turn:action-required');
    });

    it('switching to personal re-checks the QUEUE; the visible card finishes its own lifecycle', async () => {
      setNotificationFeedMode('all');
      pushMany([
        model('amb-visible', 'normal', {actor: RED, affects: [RED]}),
        model('amb-queued', 'normal', {actor: RED, affects: [RED]}),
        model('mine-queued', 'normal', {actor: RED, affects: [BLUE]}),
      ]);
      expect(notificationState.transient.map((n) => n.id)).to.deep.eq(['amb-visible']);
      setNotificationFeedMode('personal');
      await nextTick(); // the mode watcher reconciles the queue
      // The on-screen card is NOT yanked; the queued ambient card is dropped.
      expect(notificationState.transient.map((n) => n.id)).to.deep.eq(['amb-visible']);
      expect(notificationState.queue.map((n) => n.id)).to.deep.eq(['mine-queued']);
      dismiss('amb-visible');
      expect(notificationState.transient.map((n) => n.id)).to.deep.eq(['mine-queued']);
    });

    it('switching back to «Все события» replays nothing', async () => {
      pushTransient(model('amb', 'normal', {actor: RED, affects: [RED]})); // filtered, never stored
      setNotificationFeedMode('all');
      await nextTick();
      expect(notificationState.transient).to.have.length(0);
      expect(notificationState.queue).to.have.length(0);
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

  describe('the SETTLED signal (the mandatory-action presentation boundary)', () => {
    it('settled = nothing visible, nothing queued, no card still leaving', () => {
      expect(notificationsSettled()).to.eq(true);
      pushTransient(model('a'));
      expect(notificationsSettled(), 'a visible card is not settled').to.eq(false);
      pushTransient(model('b'));
      dismiss('a');
      expect(notificationsSettled(), 'a queued card promoted into the slot').to.eq(false);
      dismiss('b');
      expect(notificationsSettled(), 'feed empty again').to.eq(true);
    });

    it('a leave animation keeps the feed unsettled until its own end event', () => {
      // Identity is all the pairing needs — keep the spec DOM-free so it runs
      // under the fast server runner too.
      const el = {} as unknown as Element;
      noteNotificationLeaveStart(el);
      expect(notificationsSettled(), 'exit animation still playing').to.eq(false);
      // The start hook is per-element idempotent (a re-fired hook cannot
      // double-count one card).
      noteNotificationLeaveStart(el);
      expect(notificationState.leaving).to.eq(1);
      noteNotificationLeaveEnd(el);
      expect(notificationsSettled()).to.eq(true);
      // An unmatched end (already counted down / never counted) is absorbed.
      noteNotificationLeaveEnd(el);
      expect(notificationState.leaving).to.eq(0);
    });

    it('the singleton turn card does NOT block settling (it mirrors waitingFor itself)', () => {
      setTurn(model('turn:action-required', 'action-required'));
      expect(notificationsSettled(), 'waiting on the turn card would deadlock the presentation').to.eq(true);
    });

    it('resets zero the leaving count (a torn-down layer never fires after-leave)', () => {
      const el = {} as unknown as Element;
      noteNotificationLeaveStart(el);
      resetNotifications();
      expect(notificationState.leaving).to.eq(0);
      // A late end hook for a pre-reset element stays absorbed at zero.
      noteNotificationLeaveEnd(el);
      expect(notificationState.leaving).to.eq(0);
      noteNotificationLeaveStart({} as unknown as Element);
      clearTransient();
      expect(notificationState.leaving).to.eq(0);
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
