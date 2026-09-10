import {expect} from 'chai';
import {watch} from 'vue';
import {
  abortHydroMarker, armHydroMarker, armHydroMarkerTraversal, detectHydroMarker, enableHydroStepTrace,
  endHydroMarker, hydroActiveStepSourceCard, hydroMarkerNetsArmed, hydroMarkerState, hydroPlanDeclaresSource,
  hydroStepActivated, hydroStepOwnerFor,
  hydroStepQueuedFor, hydroStepTrace, hydroTraversalPaused, hydroTraversalPending,
  hydroVisualTrackPosition, isHydroMarkerActive, noteHydroLandPresence, registerHydroMarkerHandle,
  resetHydroMarker, resumeHydroMarkerTraversal, runHydroMarker, seedHydroMarkerRewardHold,
  setHydroMarkerPhase,
} from '@/client/console/hydroMarker/consoleHydroMarker';
import {CardName} from '@/common/cards/CardName';
import {clearPanelRewardHold, panelRewardHold} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';

describe('consoleHydroMarker', () => {
  beforeEach(() => resetHydroMarker());
  afterEach(() => resetHydroMarker());

  it('arm sets the advance live synchronously (input gate closes at once)', () => {
    expect(isHydroMarkerActive()).to.eq(false);
    armHydroMarker(2, 5, 'blue');
    expect(isHydroMarkerActive()).to.eq(true);
    expect(hydroMarkerState.phase).to.eq('charge');
    expect(hydroMarkerState.fromPosition).to.eq(2);
    expect(hydroMarkerState.toPosition).to.eq(5);
    expect(hydroMarkerState.color).to.eq('blue');
  });

  it('detect claims the arm EXACTLY once', () => {
    armHydroMarker(0, 3, 'red');
    const first = detectHydroMarker();
    expect(first).to.not.eq(undefined);
    expect(first?.toPosition).to.eq(3);
    expect(detectHydroMarker()).to.eq(undefined);
  });

  it('detect returns undefined when NOT armed (desktop / non-hydro submit)', () => {
    expect(detectHydroMarker()).to.eq(undefined);
  });

  it('the CLAIM WINDOW is bounded: detect arms the net, the handoff (and an abort) clears it', () => {
    // The single-glide hole: the arm safety dies at the claim, and from there
    // «lock → apply → endHydroMarker» had no whole-transaction bound — a
    // transport chain that never reached the handoff left `active` true
    // forever, masked (not recovered) by the 35 s hold ceiling.
    armHydroMarker(2, 5, 'blue');
    expect(hydroMarkerNetsArmed().claim, 'not yet claimed').to.eq(false);
    detectHydroMarker();
    expect(hydroMarkerNetsArmed().claim, 'the claimed transaction is bounded').to.eq(true);
    endHydroMarker();
    expect(hydroMarkerNetsArmed().claim, 'the handoff hands over to the finalize/plan nets').to.eq(false);

    armHydroMarker(2, 5, 'blue');
    detectHydroMarker();
    abortHydroMarker();
    expect(hydroMarkerNetsArmed().claim, 'an abort clears it too').to.eq(false);
  });

  it('hydroPlanDeclaresSource answers for the plan’s own steps — queued AND activated — and dies with it', () => {
    expect(hydroPlanDeclaresSource(CardName.AI_CENTRAL), 'no plan owns nothing').to.eq(false);
    armHydroMarkerTraversal(2, [
      {position: 5, transfers: [], stop: 'deck-draw'},
      {position: 7, transfers: [], stop: 'repeat', sourceCard: CardName.AI_CENTRAL},
    ], 'blue');
    expect(hydroPlanDeclaresSource(CardName.AI_CENTRAL), 'a declared repeat step — queued').to.eq(true);
    expect(hydroPlanDeclaresSource({type: 'card', cardName: CardName.AI_CENTRAL}),
      'the server’s own reveal source shape').to.eq(true);
    expect(hydroPlanDeclaresSource(CardName.BIRDS), 'an undeclared card is never the plan’s').to.eq(false);
    expect(hydroPlanDeclaresSource(undefined), 'an unattributed batch is not the PLAN’s (the claim answers for those)').to.eq(false);
    resetHydroMarker();
    expect(hydroPlanDeclaresSource(CardName.AI_CENTRAL), 'the plan died — nothing owned').to.eq(false);
  });

  it('run locks, then end crossfades (release) before clearing + settle glow', async () => {
    armHydroMarker(1, 4, 'green');
    let lockCalled = false;
    let releaseCalled = false;
    registerHydroMarkerHandle({
      lock: (onLand) => {
        lockCalled = true;
        onLand();
      },
      release: (onGone) => {
        releaseCalled = true;
        onGone();
      },
      skip: () => {},
    });
    detectHydroMarker();
    await runHydroMarker();
    expect(lockCalled).to.eq(true);
    expect(isHydroMarkerActive()).to.eq(true); // still active until the crossfade
    endHydroMarker();
    expect(releaseCalled).to.eq(true);
    expect(isHydroMarkerActive()).to.eq(false);
    expect(hydroMarkerState.settledPosition).to.eq(4);
  });

  it('run resolves even with NO director (degenerate / reduced snap)', async () => {
    armHydroMarker(0, 2, 'yellow');
    hydroMarkerState.reducedMotion = true;
    detectHydroMarker();
    await runHydroMarker();
    expect(true).to.eq(true);
  });

  it('abort recalls the marker AND resolves a pending gate (never hangs)', async () => {
    armHydroMarker(3, 6, 'purple');
    let skipped = false;
    registerHydroMarkerHandle({lock: () => {}, release: () => {}, skip: () => {
      skipped = true;
    }});
    detectHydroMarker();
    const gate = runHydroMarker();
    abortHydroMarker();
    await gate;
    expect(skipped).to.eq(true);
    expect(isHydroMarkerActive()).to.eq(false);
  });

  it('setHydroMarkerPhase only applies while active', () => {
    setHydroMarkerPhase('glide');
    expect(hydroMarkerState.phase).to.eq('idle');
    armHydroMarker(0, 1, 'blue');
    setHydroMarkerPhase('arrive');
    expect(hydroMarkerState.phase).to.eq('arrive');
  });

  describe('the TRAVERSAL plan (Delta Surge — ordered legs, stops, resume)', () => {
    /** Auto-serve every leg's director: lock and release instantly, and
     *  re-register on each nonce bump (the layer's own contract). Reduced
     *  motion keeps the excluded-cell dwell out of the clock. */
    function autoDirector(): () => void {
      const serve = () => registerHydroMarkerHandle({
        lock: (onLand) => onLand(),
        release: (onGone) => onGone(),
        skip: () => {},
      });
      serve();
      const stop = watch(() => hydroMarkerState.nonce, () => serve());
      return stop;
    }

    /** Poll a condition on macro-ticks (the runner is async across legs). */
    function until(cond: () => boolean, limitMs = 4000): Promise<void> {
      return new Promise((resolve, reject) => {
        const t0 = Date.now();
        const tick = () => {
          if (cond()) {
            resolve();
          } else if (Date.now() - t0 > limitMs) {
            reject(new Error('condition never held'));
          } else {
            setTimeout(tick, 10);
          }
        };
        tick();
      });
    }

    it('arms the whole plan; the FIRST leg rides the standard transport gate', () => {
      armHydroMarkerTraversal(0, [
        {position: 1, transfers: []},
        {position: 2, transfers: []},
      ], 'blue');
      expect(isHydroMarkerActive()).to.eq(true);
      expect(hydroTraversalPending()).to.eq(true);
      expect(hydroMarkerState.fromPosition).to.eq(0);
      expect(hydroMarkerState.toPosition).to.eq(1);
      expect(hydroVisualTrackPosition()).to.eq(0);
      expect(detectHydroMarker()?.toPosition).to.eq(1);
      expect(detectHydroMarker(), 'claimed once').to.eq(undefined);
    });

    it('runs every leg IN ORDER and finishes: the visual cursor walks, never teleports', async () => {
      const stop = autoDirector();
      try {
        hydroMarkerState.reducedMotion = true;
        armHydroMarkerTraversal(0, [
          {position: 1, transfers: []},
          {position: 2, transfers: []},
          {position: 3, transfers: []},
        ], 'blue');
        hydroMarkerState.reducedMotion = true;
        const seen: Array<number> = [];
        const unwatch = watch(() => hydroMarkerState.visualPosition, (v) => {
          if (v >= 0) {
            seen.push(v);
          }
        });
        detectHydroMarker();
        await runHydroMarker();
        endHydroMarker();
        await until(() => !hydroTraversalPending());
        unwatch();
        expect(seen).to.deep.eq([1, 2, 3]);
        expect(isHydroMarkerActive()).to.eq(false);
        expect(hydroMarkerState.settledPosition).to.eq(3);
      } finally {
        stop();
      }
    });

    it('PARKS at an interactive stop (the input gate opens) and RESUMES on the shell signal only', async () => {
      const stop = autoDirector();
      try {
        armHydroMarkerTraversal(4, [
          {position: 5, transfers: [], stop: 'deck-draw'},
          {position: 6, transfers: []},
        ], 'blue');
        hydroMarkerState.reducedMotion = true;
        detectHydroMarker();
        await runHydroMarker();
        endHydroMarker();
        await until(() => hydroTraversalPaused());
        // Parked ON the stop: the player can interact, the plan still stands.
        expect(isHydroMarkerActive()).to.eq(false);
        expect(hydroTraversalPending()).to.eq(true);
        expect(hydroVisualTrackPosition()).to.eq(5);
        // Nothing moves on its own.
        await new Promise((r) => setTimeout(r, 60));
        expect(hydroTraversalPaused()).to.eq(true);
        resumeHydroMarkerTraversal();
        expect(isHydroMarkerActive()).to.eq(true);
        await until(() => !hydroTraversalPending());
        expect(hydroMarkerState.settledPosition).to.eq(6);
      } finally {
        stop();
      }
    });

    /*
     * -- THE STAGE-BOUND EXECUTION CONTRACT (20260831011413_1.jpg) ---------
     *
     * The exact scenario: DP07 crosses 5 - 6 - 7. Stage 5 is a hidden-info deck
     * stop; stage 7's reward REPEATS AI Central, whose action draws. The server
     * resolves the whole traversal inside the request that answers the stage-5
     * pick, so AI Central's batch is on the wire while the marker stands on 5.
     *
     * The animation driver here is fully DEFERRED - every leg's lock/release is
     * served by hand - so each intermediate phase can be HELD and interrogated.
     * A final-state assertion cannot see an ordering defect; that is the point.
     */
    describe('a FUTURE step may not activate before its own cell', () => {
      /** A director that serves the queued lock/release only when asked. */
      function manualDirector(): {beat: () => Promise<void>, stop: () => void} {
        let pending: Array<() => void> = [];
        const serve = () => registerHydroMarkerHandle({
          lock: (onLand) => pending.push(onLand),
          release: (onGone) => pending.push(onGone),
          skip: () => {},
        });
        serve();
        const stop = watch(() => hydroMarkerState.nonce, () => serve());
        return {
          /**
           * Advance the flight by exactly ONE beat: yield a macrotask (so the
           * previous beat's microtask continuations have queued their next
           * callback), then serve whatever the director is holding. One call =
           * one lock or one release, which is what makes every intermediate
           * phase below a state the test can stand still in.
           */
          beat: async () => {
            await new Promise((r) => setTimeout(r, 0));
            const q = pending;
            pending = [];
            q.forEach((fn) => fn());
          },
          stop,
        };
      }

      const SURGE = [
        {position: 5, transfers: [], stop: 'deck-draw' as const},
        {position: 6, transfers: []},
        {position: 7, transfers: [], stop: 'repeat' as const, sourceCard: CardName.AI_CENTRAL},
      ];

      it('holds the copied action through EVERY intermediate phase, then admits it on arrival', async () => {
        const d = manualDirector();
        enableHydroStepTrace(true);
        try {
          hydroMarkerState.reducedMotion = true;
          armHydroMarkerTraversal(4, SURGE, 'blue');
          hydroMarkerState.reducedMotion = true;

          // PHASE A: the move 4 -> 5 is in flight. The server's answer (with AI
          // Central's batch already inside it) may land at any moment here.
          expect(hydroStepQueuedFor(CardName.AI_CENTRAL), 'queued in flight').to.eq(true);
          expect(hydroStepOwnerFor({type: 'card', cardName: CardName.AI_CENTRAL})).to.eq(7);
          expect(hydroActiveStepSourceCard(), 'no source seat while walking').to.eq(undefined);

          detectHydroMarker();
          const gate = runHydroMarker();
          await d.beat(); // LOCK on 5
          await gate;
          endHydroMarker();
          await d.beat(); // the proxy RELEASES on 5 -> the step activates
          await until(() => hydroTraversalPaused());

          // PHASE B: parked ON the stage-5 stop. This is the screenshot's frame
          // - the deck pick is answered, its cards are leaving, the marker is on
          // 5. NOTHING of stage 7 may exist.
          expect(hydroVisualTrackPosition()).to.eq(5);
          expect(hydroStepActivated(5)).to.eq(true);
          expect(hydroStepActivated(7), 'stage 7 has NOT arrived').to.eq(false);
          expect(hydroStepQueuedFor(CardName.AI_CENTRAL), 'still queued on 5').to.eq(true);
          expect(hydroActiveStepSourceCard(), 'the seat belongs to 7').to.eq(undefined);

          // PHASE C: the stop resolved; the marker is walking 5 -> 6.
          resumeHydroMarkerTraversal();
          await until(() => hydroMarkerState.toPosition === 6);
          expect(hydroStepQueuedFor(CardName.AI_CENTRAL), 'queued mid-walk').to.eq(true);

          // PHASE D: LOCK on 6, then its release - the arrival. A stage-7
          // reward is STILL not admissible: "the previous scene has left" is
          // not "we are there", which is exactly what the old exit-only
          // barrier conflated.
          await d.beat(); // lock on 6
          expect(hydroStepQueuedFor(CardName.AI_CENTRAL), 'queued mid-lock').to.eq(true);
          await d.beat(); // release on 6 -> activation, then the 6 -> 7 leg
          await until(() => hydroStepActivated(6));
          expect(hydroStepQueuedFor(CardName.AI_CENTRAL), 'queued on 6').to.eq(true);

          // PHASE E: the walk 6 -> 7, then the arrival.
          await until(() => hydroMarkerState.toPosition === 7);
          expect(hydroStepQueuedFor(CardName.AI_CENTRAL), 'queued approaching 7').to.eq(true);
          await d.beat(); // lock on 7
          expect(hydroStepQueuedFor(CardName.AI_CENTRAL), 'queued until it SETTLES').to.eq(true);
          await d.beat(); // release on 7 -> arrivedAndSettled
          await until(() => hydroStepActivated(7));

          // PHASE F: ONLY NOW. The step owns the scene: its batch is admitted
          // and its source card materialises.
          expect(hydroStepQueuedFor(CardName.AI_CENTRAL), 'admitted at last').to.eq(false);
          await until(() => hydroTraversalPaused());
          expect(hydroActiveStepSourceCard()).to.eq(CardName.AI_CENTRAL);

          // THE ORDERED TRACE. The contract is a statement about ORDER, so it is
          // asserted as one - the partial order, in full.
          const trace = hydroStepTrace();
          const at = (e: string) => {
            const i = trace.indexOf(e);
            expect(i, e + ' in ' + JSON.stringify(trace)).to.be.greaterThan(-1);
            return i;
          };
          expect(at('stage:5:arrivedAndSettled')).to.be.lessThan(at('stage:5:stopOpened'));
          expect(at('stage:5:stopOpened')).to.be.lessThan(at('stage:5:presentationComplete'));
          expect(at('stage:5:presentationComplete')).to.be.lessThan(at('move:5-6:start'));
          expect(at('move:5-6:start')).to.be.lessThan(at('stage:6:arrivedAndSettled'));
          expect(at('stage:6:arrivedAndSettled')).to.be.lessThan(at('move:6-7:start'));
          expect(at('move:6-7:start')).to.be.lessThan(at('stage:7:arrivedAndSettled'));
          expect(at('stage:7:arrivedAndSettled')).to.be.lessThan(at('stage:7:stopOpened'));
        } finally {
          enableHydroStepTrace(false);
          d.stop();
        }
      });

      it('activates each cell EXACTLY ONCE, and a fresh plan inherits nothing', async () => {
        const stop = autoDirector();
        try {
          hydroMarkerState.reducedMotion = true;
          armHydroMarkerTraversal(6, [
            {position: 7, transfers: [], stop: 'repeat', sourceCard: CardName.AI_CENTRAL},
          ], 'blue');
          hydroMarkerState.reducedMotion = true;
          detectHydroMarker();
          await runHydroMarker();
          endHydroMarker();
          await until(() => hydroTraversalPaused());
          expect(hydroStepActivated(7)).to.eq(true);
          // A repeated resume is a no-op: the sequence is serial and the ledger
          // is a Set, so a stale completion callback cannot re-activate a step.
          resumeHydroMarkerTraversal();
          resumeHydroMarkerTraversal();
          await until(() => !hydroTraversalPending());

          // A NEW plan repeating the SAME card owns nothing until it arrives.
          armHydroMarkerTraversal(0, [
            {position: 1, transfers: []},
            {position: 3, transfers: [], stop: 'repeat', sourceCard: CardName.AI_CENTRAL},
          ], 'blue');
          expect(hydroStepActivated(7), 'the old activation is gone').to.eq(false);
          expect(hydroStepQueuedFor(CardName.AI_CENTRAL), 'earned again').to.eq(true);
        } finally {
          stop();
        }
      });

      it('an ABORT opens the gate - a dead plan may never hold a surface hostage', () => {
        const stop = autoDirector();
        try {
          armHydroMarkerTraversal(4, SURGE, 'blue');
          expect(hydroStepQueuedFor(CardName.AI_CENTRAL)).to.eq(true);
          abortHydroMarker();
          expect(hydroStepQueuedFor(CardName.AI_CENTRAL)).to.eq(false);
          expect(hydroActiveStepSourceCard()).to.eq(undefined);
        } finally {
          stop();
        }
      });

      it('REDUCED MOTION reaches the same order - the gate is not a duration', async () => {
        const stop = autoDirector();
        try {
          hydroMarkerState.reducedMotion = true;
          armHydroMarkerTraversal(4, SURGE, 'blue');
          hydroMarkerState.reducedMotion = true;
          detectHydroMarker();
          await runHydroMarker();
          endHydroMarker();
          await until(() => hydroTraversalPaused());
          expect(hydroStepQueuedFor(CardName.AI_CENTRAL), 'held with no animation').to.eq(true);
          resumeHydroMarkerTraversal();
          await until(() => hydroStepActivated(7));
          expect(hydroStepQueuedFor(CardName.AI_CENTRAL)).to.eq(false);
        } finally {
          stop();
        }
      });
    });

    it('an EXCLUDED cell (the 2 VP crossing) is walked through — settle, no wave, the sequence continues', async () => {
      const stop = autoDirector();
      try {
        armHydroMarkerTraversal(9, [
          {position: 10, transfers: [], excluded: true},
          {position: 11, transfers: []},
        ], 'blue');
        hydroMarkerState.reducedMotion = true;
        detectHydroMarker();
        await runHydroMarker();
        const seen: Array<number> = [];
        const unwatch = watch(() => hydroMarkerState.visualPosition, (v) => {
          if (v >= 0) {
            seen.push(v);
          }
        });
        endHydroMarker();
        await until(() => !hydroTraversalPending());
        unwatch();
        // The marker physically crossed the excluded cell before the finish.
        expect(seen).to.deep.eq([10, 11]);
      } finally {
        stop();
      }
    });

    it('abort mid-plan clears the plan and yields the visual cursor to the server truth', async () => {
      armHydroMarkerTraversal(0, [
        {position: 1, transfers: []},
        {position: 2, transfers: [], stop: 'deck-draw'},
      ], 'blue');
      abortHydroMarker();
      expect(hydroTraversalPending()).to.eq(false);
      expect(hydroVisualTrackPosition()).to.eq(-1);
      expect(isHydroMarkerActive()).to.eq(false);
    });

    it('an interactive stop\'s OWN gains fly at the RESUME, never on arrival (the closing beat)', async () => {
      // A repeated action's rewards exist only once its whole presentation
      // (reveal, picks, the hand intake) has finished — so the stop's
      // transfers are stashed at the pause and become the resume's wave. The
      // panel hold is the witness: seeded with the response, still HELD
      // through the whole pause, released only by the resume's wave (jsdom
      // degrades the flight and releases per spec — honest, just instant).
      const stop = autoDirector();
      const steel: ResourceTransferSpec = {channel: 'stock', resource: 'steel', amount: 2};
      try {
        armHydroMarkerTraversal(6, [
          {position: 7, transfers: [steel], stop: 'repeat'},
        ], 'blue');
        // The transport's synchronous seed (same block as the view apply).
        seedHydroMarkerRewardHold();
        expect(panelRewardHold.active, 'seeded with the response').to.eq(true);
        detectHydroMarker();
        await runHydroMarker();
        endHydroMarker();
        await until(() => hydroTraversalPaused());
        // Parked ON the stop: nothing flew — the reward is still held.
        expect(panelRewardHold.active, 'held through the pause').to.eq(true);
        expect(hydroTraversalPending()).to.eq(true);
        resumeHydroMarkerTraversal();
        await until(() => !hydroTraversalPending());
        // The resume's wave released the hold (per touchdown; degraded =
        // instant) and the one-leg plan finished.
        expect(panelRewardHold.active, 'released by the resume wave').to.eq(false);
        expect(hydroMarkerState.settledPosition).to.eq(7);
      } finally {
        stop();
        clearPanelRewardHold();
      }
    });

    it('abort while parked at a stop clears the stashed resume wave (no ghost flight later)', () => {
      armHydroMarkerTraversal(6, [
        {position: 7, transfers: [{channel: 'stock', resource: 'steel', amount: 2}], stop: 'repeat'},
      ], 'blue');
      abortHydroMarker();
      // A resume after the abort must be a no-op: no plan, no wave, no hold.
      resumeHydroMarkerTraversal();
      expect(hydroTraversalPending()).to.eq(false);
      expect(panelRewardHold.active).to.eq(false);
    });

    // ── THE PRESENTED TARGET CARD'S EXIT HANDSHAKE (pos 9) ────────────────
    // The stage-9 payout lands ON a presented card, and the sequence may not
    // move past the cell while that card is still on stage: the section
    // reports presence, the leg awaits its full LEAVE before the next leg.
    describe('the pos-9 presented card holds the sequence until its exit', () => {
      it('a reported presence BLOCKS the next leg; ending it releases the walk', async () => {
        const stop = autoDirector();
        try {
          hydroMarkerState.reducedMotion = true;
          // The section stands the pos-9 card up (the arrival mounts it).
          noteHydroLandPresence(9, true);
          armHydroMarkerTraversal(8, [
            {position: 9, transfers: []},
            {position: 10, transfers: []},
          ], 'blue');
          detectHydroMarker();
          await runHydroMarker();
          endHydroMarker();
          // The cell resolved: the cursor has moved past it…
          await until(() => hydroMarkerState.planCursor === 1);
          // …but the NEXT leg does not start while the card still stands —
          // its glide would re-target the marker under a face mid-payout.
          const nonceAtHold = hydroMarkerState.nonce;
          await new Promise((r) => setTimeout(r, 60));
          expect(hydroMarkerState.nonce, 'no next-leg glide during the hold').to.eq(nonceAtHold);
          expect(hydroTraversalPending(), 'the plan stands').to.eq(true);
          // The leave transition ends → the sequence continues to 10.
          noteHydroLandPresence(9, false);
          await until(() => !hydroTraversalPending());
          expect(hydroMarkerState.settledPosition).to.eq(10);
        } finally {
          stop();
        }
      });

      it('REGRESSION: the LAST leg never awaits its presented card’s exit — the walk finalizes', async () => {
        // The field wedge (2026-09-10): a Delta-Surge 3→9 finished every
        // segment, the animals landed on the presented stage-9 card — and the
        // walk hung on «Маркер движется по треку» for ~30 s. The exit wait is
        // triggered by the CURSOR moving to the NEXT segment; past the FINAL
        // leg the presentation falls back to the destination — the same cell —
        // so the card legitimately STAYS as the landing's own result face and
        // its leave only comes with the flow's result stage, which is gated on
        // this very finalize. The last leg therefore finalizes WITHOUT the
        // wait; the mid-path contract above is untouched.
        const stop = autoDirector();
        try {
          hydroMarkerState.reducedMotion = true;
          noteHydroLandPresence(9, true); // the destination card is ON stage…
          armHydroMarkerTraversal(7, [
            {position: 8, transfers: []},
            {position: 9, transfers: []}, // …and 9 is the LAST leg
          ], 'blue');
          detectHydroMarker();
          await runHydroMarker();
          endHydroMarker();
          // The walk must finalize with NOBODY ever reporting the card's exit.
          await until(() => !hydroTraversalPending());
          expect(isHydroMarkerActive(), 'the transaction is over').to.eq(false);
          expect(hydroMarkerState.settledPosition).to.eq(9);
        } finally {
          noteHydroLandPresence(9, false);
          stop();
        }
      });

      it('a card that never presented blocks NOTHING (the wait is keyed on the report)', async () => {
        const stop = autoDirector();
        try {
          hydroMarkerState.reducedMotion = true;
          armHydroMarkerTraversal(8, [
            {position: 9, transfers: []},
            {position: 10, transfers: []},
          ], 'blue');
          detectHydroMarker();
          await runHydroMarker();
          endHydroMarker();
          await until(() => !hydroTraversalPending());
          expect(hydroMarkerState.settledPosition).to.eq(10);
        } finally {
          stop();
        }
      });

      it('an abort resolves the waiter — a torn-down scene can never hang the plan epoch', async () => {
        const stop = autoDirector();
        try {
          hydroMarkerState.reducedMotion = true;
          noteHydroLandPresence(9, true);
          armHydroMarkerTraversal(8, [
            {position: 9, transfers: []},
            {position: 10, transfers: []},
          ], 'blue');
          detectHydroMarker();
          await runHydroMarker();
          endHydroMarker();
          await until(() => hydroMarkerState.planCursor === 1);
          abortHydroMarker();
          expect(hydroTraversalPending()).to.eq(false);
          // The waiter died with the abort: a LATE leave report is a no-op.
          noteHydroLandPresence(9, false);
          expect(hydroTraversalPending()).to.eq(false);
        } finally {
          stop();
        }
      });
    });
  });
});
