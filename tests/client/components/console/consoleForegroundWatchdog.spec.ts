import {expect} from 'chai';
import {AdmissionSignals} from '@/client/console/consolePromptAdmission';
import {
  ANIMATION_STALL_GRACE_MS,
  RECOVERY_COOLDOWN_TICKS,
  STALL_CONFIRM_TICKS,
  foregroundWatchdogState,
  guardedAdmissionSignals,
  noteAdmissionSignals,
  resetForegroundWatchdog,
  runForegroundWatchdog,
  setConsoleBoardHomeIdle,
} from '@/client/console/consoleForegroundWatchdog';
import {
  acquireForegroundLease,
  currentBlockReason,
  resetPresentationLeases,
} from '@/client/components/presentation/presentationFlow';
import {
  activeAnimationHoldLabels,
  animationHoldCount,
  beginAnimationHold,
  registerAnimationHoldSupplier,
  resetAnimationHoldsForTest,
  unregisterAnimationHoldSupplier,
} from '@/client/components/presentation/animationHold';
import {QUEUE_STARVATION_MS, clearTransient, notificationState} from '@/client/components/notifications/notificationState';
import {NOTIFICATION_PRIORITY} from '@/client/components/notifications/notificationTypes';

function signals(partial: Partial<AdmissionSignals> = {}): AdmissionSignals {
  return {
    revealOpen: false,
    revealPending: false,
    playedHero: false,
    tileHero: false,
    cardArrival: false,
    boardBonus: false,
    cardDiscard: false,
    presentation: false,
    announceGate: false,
    anyAnimation: false,
    ...partial,
  };
}

/** Run `n` watchdog passes with the same observations; returns recovery count. */
function tick(n: number, pass: {surfaceRendered: boolean, promptLive: boolean}): number {
  let recovered = 0;
  for (let i = 0; i < n; i++) {
    if (runForegroundWatchdog(pass)) {
      recovered++;
    }
  }
  return recovered;
}

const STALLED = {surfaceRendered: false, promptLive: true};

describe('consoleForegroundWatchdog', () => {
  beforeEach(() => {
    resetForegroundWatchdog();
    resetPresentationLeases();
    resetAnimationHoldsForTest();
    clearTransient();
    setConsoleBoardHomeIdle(true);
  });

  // Module state is bundle-shared in mochapack — a left-over expired signal or
  // lease would block notification delivery in every later spec.
  after(() => {
    resetForegroundWatchdog();
    resetPresentationLeases();
    resetAnimationHoldsForTest();
    clearTransient();
  });

  describe('the stall rule', () => {
    it('recovers a claim that nothing on screen backs, after the debounce', () => {
      noteAdmissionSignals(signals({playedHero: true}));
      expect(tick(STALL_CONFIRM_TICKS - 1, STALLED)).eq(0, 'must not act before the debounce');
      expect(tick(1, STALLED)).eq(1);
      expect(foregroundWatchdogState.expiredSignals.has('playedHero')).eq(true);
    });

    it('never acts while a serving surface IS rendered (a modal being read)', () => {
      noteAdmissionSignals(signals({revealOpen: true}));
      expect(tick(STALL_CONFIRM_TICKS * 3, {surfaceRendered: true, promptLive: true})).eq(0);
      expect(foregroundWatchdogState.expiredSignals.size).eq(0);
    });

    it('never acts when nobody is waiting on the claim', () => {
      noteAdmissionSignals(signals({revealOpen: true}));
      expect(tick(STALL_CONFIRM_TICKS * 3, {surfaceRendered: false, promptLive: false})).eq(0);
    });

    it('a queued event nobody can deliver counts as waiting, with no prompt at all', () => {
      // The lease is both the claim AND what SILENCES the feed, so the backlog
      // genuinely cannot drain — a queue that CAN drain is not a stall. It has
      // to be a silencing kind: a `mandatory-choice` lease means the player is
      // working in a surface, and the feed keeps flowing right past it.
      acquireForegroundLease('ceremony');
      noteAdmissionSignals(signals());
      notificationState.queue.push({
        id: 'q1', kind: 'normal', variant: 'event', priority: NOTIFICATION_PRIORITY['normal'],
        typeLabelKey: 'Problem', prompt: 'x', pills: [], detailCount: 0, generation: 1,
        ttl: 1000, persistent: false, createdAt: 0,
      });
      expect(tick(STALL_CONFIRM_TICKS, {surfaceRendered: false, promptLive: false})).eq(1);
      // The recovery notice legitimately takes the single visible slot first
      // ("explain, then show") — what matters is that delivery is no longer
      // blocked, so the backlog follows instead of waiting forever.
      expect(currentBlockReason()).eq(undefined);
    });

    it('never acts off the board home — a player-opened screen is not "nothing rendered"', () => {
      setConsoleBoardHomeIdle(false);
      noteAdmissionSignals(signals({playedHero: true}));
      expect(tick(STALL_CONFIRM_TICKS * 3, STALLED)).eq(0);
    });

    it('a broken streak has to rebuild from zero', () => {
      noteAdmissionSignals(signals({playedHero: true}));
      tick(STALL_CONFIRM_TICKS - 1, STALLED);
      expect(tick(1, {surfaceRendered: true, promptLive: true})).eq(0);
      expect(foregroundWatchdogState.streak).eq(0);
      expect(tick(STALL_CONFIRM_TICKS - 1, STALLED)).eq(0);
    });

    it('does not re-fire every tick while the underlying flag stays stuck', () => {
      noteAdmissionSignals(signals({playedHero: true}));
      expect(tick(STALL_CONFIRM_TICKS, STALLED)).eq(1);
      expect(tick(STALL_CONFIRM_TICKS, STALLED)).eq(0, 'the cooldown must absorb the next passes');
    });

    it('QUARANTINES a claim that keeps coming back — the production shape', () => {
      // The reported failure: the watchdog "recovered" `anyAnimation` every 13s
      // for four minutes while the queue climbed past +17. Expiring lifts on the
      // falling edge, and the leak re-raised the flag right after — a detector,
      // not a cure. The second identical stall must suppress it for good.
      const stuck = () => {
        noteAdmissionSignals(signals({playedHero: true}));
        return tick(RECOVERY_COOLDOWN_TICKS + STALL_CONFIRM_TICKS, STALLED);
      };
      noteAdmissionSignals(signals({playedHero: true}));
      expect(tick(STALL_CONFIRM_TICKS, STALLED)).eq(1);

      // The flag drops (the mask would lift) and is raised again — the loop.
      noteAdmissionSignals(signals({playedHero: false}));
      expect(stuck()).eq(1, 'the second stall is what escalates');

      // From here the claim must never be able to stall again, flap or not.
      for (let i = 0; i < 5; i++) {
        noteAdmissionSignals(signals({playedHero: false}));
        expect(stuck()).eq(0, 'a quarantined claim can never stall again');
      }
      expect(foregroundWatchdogState.recoveries).eq(2);
      expect(guardedAdmissionSignals(signals({playedHero: true})).playedHero).eq(false);
    });

    it('never recovers a SECOND time for a flag that stays stuck raw forever', () => {
      // The flag never goes false, so the mask never lifts. Once neutralized the
      // screen works — re-"recovering" it every cooldown would just spam the
      // player with a notice for a problem that is already handled.
      noteAdmissionSignals(signals({playedHero: true}));
      expect(tick(STALL_CONFIRM_TICKS, STALLED)).eq(1);
      for (let i = 0; i < 10; i++) {
        noteAdmissionSignals(signals({playedHero: true}));
        tick(RECOVERY_COOLDOWN_TICKS + STALL_CONFIRM_TICKS, STALLED);
      }
      expect(foregroundWatchdogState.recoveries).eq(1);
    });
  });

  describe('the queue starvation deadline (the unconditional guarantee)', () => {
    let realNow: () => number;
    let clock = 0;

    beforeEach(() => {
      realNow = Date.now;
      clock = 1_000_000;
      Date.now = () => clock;
    });

    afterEach(() => {
      Date.now = realNow;
    });

    function queueOne(id: string): void {
      notificationState.queue.push({
        id, kind: 'normal', variant: 'event', priority: NOTIFICATION_PRIORITY['normal'],
        typeLabelKey: 'Problem', prompt: 'x', pills: [], detailCount: 0, generation: 1,
        ttl: 1000, persistent: false, createdAt: 0,
      });
    }

    it('delivers a backlog held behind a LEAKED animation hold, whatever the watchdog does', () => {
      // The exact production symptom: a stuck 'notification-only' hold, so the
      // block reason is 'animation' and the queue never drains. This path does
      // not care WHICH claim lied — it is the floor under the whole design.
      beginAnimationHold('watchdog-spec-leak', {scope: 'notification-only'});
      queueOne('q1');
      setConsoleBoardHomeIdle(false); // scope-independent on purpose

      runForegroundWatchdog({surfaceRendered: true, promptLive: false});
      expect(notificationState.transient.length).eq(0, 'the deadline has not passed yet');

      clock += QUEUE_STARVATION_MS + 1;
      runForegroundWatchdog({surfaceRendered: true, promptLive: false});
      expect(notificationState.transient.map((n) => n.id)).deep.eq(['q1']);
    });

    it('does NOT force a backlog past a modal the player is reading', () => {
      // A result modal / theater / ceremony means a human is looking at
      // something and may take minutes — floating toasts over it would break the
      // serialization the queue exists for. (A `mandatory-choice` lease is NOT
      // in that set: a decision surface is the player WORKING, and the feed is
      // deliberately delivered right beside it.)
      acquireForegroundLease('ceremony');
      queueOne('q1');

      runForegroundWatchdog({surfaceRendered: true, promptLive: true});
      clock += QUEUE_STARVATION_MS * 5;
      runForegroundWatchdog({surfaceRendered: true, promptLive: true});
      expect(notificationState.transient.length).eq(0);
      expect(notificationState.queue.length).eq(1, 'still queued, never lost');
    });
  });

  describe('the staleness mask', () => {
    it('masks an expired signal and leaves the rest of the record untouched', () => {
      const raw = signals({playedHero: true, announceGate: true});
      noteAdmissionSignals(raw);
      tick(STALL_CONFIRM_TICKS, STALLED);
      const guarded = guardedAdmissionSignals(raw);
      expect(guarded.playedHero).eq(false);
      expect(guarded.announceGate).eq(true, 'the announce gate is the player\'s own pending press');
    });

    it('is a no-op copy while nothing is expired', () => {
      const raw = signals({revealOpen: true});
      expect(guardedAdmissionSignals(raw)).eq(raw);
    });

    it('lifts by itself once the claim goes honestly false again', () => {
      noteAdmissionSignals(signals({playedHero: true}));
      tick(STALL_CONFIRM_TICKS, STALLED);
      expect(foregroundWatchdogState.expiredSignals.has('playedHero')).eq(true);

      noteAdmissionSignals(signals({playedHero: false}));
      expect(foregroundWatchdogState.expiredSignals.has('playedHero')).eq(false);
      expect(guardedAdmissionSignals(signals({playedHero: true})).playedHero).eq(true);
    });
  });

  describe('the orchestrator holds', () => {
    it('expires a ghost lease so the notification queue can drain again', () => {
      const release = acquireForegroundLease('mandatory-choice');
      expect(currentBlockReason()).eq('mandatory-choice');

      noteAdmissionSignals(signals());
      expect(tick(STALL_CONFIRM_TICKS, STALLED)).eq(1);
      expect(currentBlockReason()).eq(undefined, 'the queue must be free to promote');

      // The holder keeps a valid, balanced token — releasing later is safe.
      release();
      expect(currentBlockReason()).eq(undefined);
    });

    it('a lease raised AFTER a recovery is honest and blocks normally', () => {
      const ghost = acquireForegroundLease('mandatory-choice');
      noteAdmissionSignals(signals());
      tick(STALL_CONFIRM_TICKS, STALLED);
      expect(currentBlockReason()).eq(undefined);

      const fresh = acquireForegroundLease('mandatory-choice');
      expect(currentBlockReason()).eq('mandatory-choice');
      fresh();
      ghost();
      expect(currentBlockReason()).eq(undefined);
    });

    it('evaporates a PHANTOM count from a NON-REACTIVE supplier (the shipped dead game)', () => {
      // Reproduces the production bug exactly: `hand-delivery`'s predicate read
      // a plain module `let`, so the counts computed never re-derived. It stuck
      // at 1 with no hold behind it — `foregroundBlockReason()` said 'animation'
      // forever, the ceiling never armed, and every expiry found nothing to
      // expire because reading the predicate directly correctly says false
      // («leaked hold: none named»).
      let phantom = false;
      try {
        registerAnimationHoldSupplier('watchdog-spec-phantom', () => phantom);
        phantom = true;
        expect(animationHoldCount()).eq(1, 'the computed caches 1 here');

        phantom = false; // …and NOTHING reactive changed, so the cache survives
        expect(animationHoldCount()).eq(1, 'the stale count — the hazard itself');
        expect(activeAnimationHoldLabels().length).eq(0, 'while the predicate is honest');

        // One watchdog pass forces the registry to re-derive: the phantom goes.
        runForegroundWatchdog({surfaceRendered: true, promptLive: false});
        expect(animationHoldCount()).eq(0);
        expect(currentBlockReason()).eq(undefined);
      } finally {
        unregisterAnimationHoldSupplier('watchdog-spec-phantom');
      }
    });

    it('leaves a YOUNG animation hold alone — a slow cinematic is not a leak', () => {
      // `planet-focus` legitimately holds through its owed scale beat with an
      // idle-looking board. Accusing it printed «Экран завис» over a working
      // scene, which is worse than the wait it was complaining about.
      beginAnimationHold('watchdog-spec-scene');
      noteAdmissionSignals(signals({anyAnimation: true, presentation: true}));
      expect(tick(STALL_CONFIRM_TICKS * 3, STALLED)).eq(0);
    });

    it('expires an animation hold once it is past EVERY flow\'s own safety', () => {
      const realNow = Date.now;
      try {
        let clock = 5_000_000;
        Date.now = () => clock;
        const hold = beginAnimationHold('watchdog-spec-scene');
        expect(currentBlockReason()).eq('animation');

        clock += ANIMATION_STALL_GRACE_MS + 1;
        noteAdmissionSignals(signals({anyAnimation: true}));
        expect(tick(STALL_CONFIRM_TICKS, STALLED)).eq(1);
        expect(currentBlockReason()).eq(undefined,
          'clearing only the leases would leave the queue just as stuck');

        hold.release(); // idempotent — the expiry already dropped it
        expect(currentBlockReason()).eq(undefined);
      } finally {
        Date.now = realNow;
      }
    });

    it('names what it expired instead of a bare "something was stuck"', () => {
      acquireForegroundLease('mandatory-choice');
      noteAdmissionSignals(signals({playedHero: true}));
      tick(STALL_CONFIRM_TICKS, STALLED);
      expect(foregroundWatchdogState.lastDiagnosis).contains('lease:mandatory-choice');
      expect(foregroundWatchdogState.lastDiagnosis).contains('admission:playedHero');
      expect(foregroundWatchdogState.recoveries).eq(1);
    });
  });
});
