import {expect} from 'chai';
import {AdmissionSignals} from '@/client/console/consolePromptAdmission';
import {
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
import {beginAnimationHold, resetAnimationHoldsForTest} from '@/client/components/presentation/animationHold';
import {clearTransient, notificationState} from '@/client/components/notifications/notificationState';
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
      noteAdmissionSignals(signals({revealOpen: true}));
      notificationState.queue.push({
        id: 'q1', kind: 'normal', variant: 'event', priority: NOTIFICATION_PRIORITY['normal'],
        typeLabelKey: 'Problem', prompt: 'x', pills: [], detailCount: 0, generation: 1,
        ttl: 1000, persistent: false, createdAt: 0,
      });
      expect(tick(STALL_CONFIRM_TICKS, {surfaceRendered: false, promptLive: false})).eq(1);
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

    it('expires a live ANIMATION hold too — it outranks every other reason', () => {
      const hold = beginAnimationHold('watchdog-spec-scene');
      expect(currentBlockReason()).eq('animation');

      noteAdmissionSignals(signals({anyAnimation: true}));
      expect(tick(STALL_CONFIRM_TICKS, STALLED)).eq(1);
      expect(currentBlockReason()).eq(undefined,
        'clearing only the leases would leave the queue just as stuck');

      hold.release(); // idempotent — the ceiling already dropped it
      expect(currentBlockReason()).eq(undefined);
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
