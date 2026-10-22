import {expect} from 'chai';
import {
  computeCommitGate, commitAllowed, commitAcceptsCursor, commitCursorTarget,
  commitFocusVerb, commitRedirectTarget, CommitRequirement,
  nextCursorAfterAnswer, commitPressAbsorbed, COMMIT_ARRIVAL_ABSORB_MS,
} from '@/client/console/consoleCommitGate';
import {CURSOR_MS} from '@/client/components/motion/motionTokens';
import {SETTLE_FIRST_MS} from '@/client/console/promptSequence';
import {focusCommandRun} from '@/client/console/consoleActionFlow';

const req = (over: Partial<CommitRequirement> = {}): CommitRequirement =>
  ({index: 0, verb: 'Choose a card', satisfied: false, ...over});

/**
 * THE GATE IS ONE ANSWER, and that is the whole point.
 *
 * «Обстрел кометами» shipped with a commit row that was a cursor stop wearing
 * the full active treatment — bright ring, live Ⓐ — while a required card pick
 * was still empty and pressing A did nothing at all. Every local boolean behind
 * that screen was individually right; what was missing was a single value the
 * ring, the glyph, the command bar and the click handler all had to obey. These
 * specs pin that they cannot disagree again.
 */
describe('consoleCommitGate — one answer to «may this be confirmed yet»', () => {
  describe('states', () => {
    /** #13 — an action with nothing to configure is confirmable at once. The
     *  gating must not tax the simple case. */
    it('is READY with no requirements at all', () => {
      const gate = computeCommitGate({requirements: [], submitting: false});
      expect(gate.kind).to.eq('ready');
      expect(commitAllowed(gate)).to.eq(true);
      expect(commitAcceptsCursor(gate)).to.eq(true);
    });

    /** #1 — the reported case: a required target is empty, so the commit is not
     *  available and the gate names what is in the way. */
    it('is INCOMPLETE while a requirement is unanswered, and names it', () => {
      const gate = computeCommitGate({
        requirements: [req({index: 2, verb: 'Choose a card'})], submitting: false,
      });
      expect(gate.kind).to.eq('incomplete');
      expect(commitAllowed(gate)).to.eq(false);
      expect(gate.kind === 'incomplete' && gate.blocking.index).to.eq(2);
      expect(gate.kind === 'incomplete' && gate.blocking.verb).to.eq('Choose a card');
    });

    /** The FIRST outstanding one leads — the player is walked through them in
     *  the order the screen presents them, never dropped at an arbitrary one. */
    it('blocks on the FIRST outstanding requirement and counts the rest', () => {
      const gate = computeCommitGate({
        requirements: [
          req({index: 0, satisfied: true}),
          req({index: 1, verb: 'Choose a player'}),
          req({index: 2, verb: 'Heat sources'}),
        ],
        submitting: false,
      });
      expect(gate.kind === 'incomplete' && gate.blocking.index).to.eq(1);
      expect(gate.kind === 'incomplete' && gate.outstanding).to.eq(2);
    });

    /** #5 — answering the last one activates the commit, and nothing else. */
    it('turns READY only when EVERY requirement is answered', () => {
      const two = [req({index: 0}), req({index: 1})];
      expect(computeCommitGate({requirements: two, submitting: false}).kind).to.eq('incomplete');
      const one = [req({index: 0, satisfied: true}), req({index: 1})];
      expect(computeCommitGate({requirements: one, submitting: false}).kind).to.eq('incomplete');
      const all = [req({index: 0, satisfied: true}), req({index: 1, satisfied: true})];
      expect(computeCommitGate({requirements: all, submitting: false}).kind).to.eq('ready');
    });

    /** #10 — a target that stopped being legal is NOT the same as one never
     *  chosen: the player did the work and something moved under them. */
    it('separates a STALE answer from one never given', () => {
      const gate = computeCommitGate({
        requirements: [req({index: 1, satisfied: false, stale: true})], submitting: false,
      });
      expect(gate.kind).to.eq('stale');
      expect(commitAllowed(gate)).to.eq(false);
      expect(commitAcceptsCursor(gate)).to.eq(false);
    });

    /** A commit in flight outranks everything — the press has been taken. */
    it('SUBMITTING outranks every other reading', () => {
      const gate = computeCommitGate({
        requirements: [req()], submitting: true, unavailable: 'Unavailable right now',
      });
      expect(gate.kind).to.eq('submitting');
      expect(commitAllowed(gate)).to.eq(false);
    });

    /** An unavailable action outranks its own empty fields: filling them would
     *  change nothing, so the reason stays on the commit row. */
    it('BLOCKED outranks outstanding requirements (filling them changes nothing)', () => {
      const gate = computeCommitGate({
        requirements: [req()], submitting: false, unavailable: 'Unavailable right now',
      });
      expect(gate.kind).to.eq('blocked');
      expect(gate.kind === 'blocked' && gate.reason).to.eq('Unavailable right now');
      // …and the row KEEPS the cursor: nothing else on the screen explains why,
      // and there is no requirement to redirect to.
      expect(commitAcceptsCursor(gate)).to.eq(true);
      expect(commitAllowed(gate)).to.eq(false);
    });
  });

  describe('the cursor', () => {
    /** #2 — THE REPORTED DEFECT. A commit row that would refuse A must not be
     *  a place the cursor can arrive at. */
    it('refuses the commit row while a requirement is waiting', () => {
      const gate = computeCommitGate({requirements: [req({index: 3})], submitting: false});
      expect(commitAcceptsCursor(gate)).to.eq(false);
      expect(commitCursorTarget(gate, 9)).to.eq(3);
    });

    /** #6 — with everything answered the commit row IS the next natural step,
     *  so the cursor may land there. (Landing on it is not pressing it.) */
    it('sends the cursor to the commit row once ready', () => {
      const gate = computeCommitGate({requirements: [req({satisfied: true})], submitting: false});
      expect(commitAcceptsCursor(gate)).to.eq(true);
      expect(commitCursorTarget(gate, 9)).to.eq(9);
    });

    /** Mid-flight the cursor is frozen — moving it under the player would be a
     *  jump they did not ask for. */
    it('leaves the cursor alone while submitting or blocked', () => {
      expect(commitCursorTarget(computeCommitGate({requirements: [], submitting: true}), 9)).to.eq(undefined);
      const blocked = computeCommitGate({requirements: [], submitting: false, unavailable: 'x'});
      expect(commitCursorTarget(blocked, 9)).to.eq(undefined);
    });

    /** #8 — after a variant switch re-introduces a requirement, the answer
     *  changes with it: the cursor cannot stay parked on a row that has since
     *  stopped working. */
    it('re-seats the cursor the moment a requirement comes back', () => {
      const ready = computeCommitGate({requirements: [req({index: 0, satisfied: true})], submitting: false});
      expect(commitCursorTarget(ready, 4)).to.eq(4);
      // the branch switched — a new requirement appeared at row 1
      const reblocked = computeCommitGate({
        requirements: [req({index: 0, satisfied: true}), req({index: 1, verb: 'Choose a player'})],
        submitting: false,
      });
      expect(commitCursorTarget(reblocked, 4)).to.eq(1);
    });
  });

  /**
   * THE ONE CURSOR RULE AFTER AN ANSWER (T14, ledger CC): every composer asks THIS after every answer — the row that
   * holds the commit, else a question offered and not yet visited, else the commit row (armed when it runs, «held» when
   * it cannot and the row is what says why). One table, so the three composers cannot answer it three ways again.
   */
  describe('nextCursorAfterAnswer — one landing rule for every composer', () => {
    const ready = computeCommitGate({requirements: [req({index: 0, satisfied: true})], submitting: false});
    const incomplete = computeCommitGate({requirements: [req({index: 0, satisfied: true}), req({index: 2})], submitting: false});
    const stale = computeCommitGate({requirements: [req({index: 1, satisfied: false, stale: true})], submitting: false});
    const blocked = computeCommitGate({requirements: [], submitting: false, unavailable: 'Not enough M€'});
    const submitting = computeCommitGate({requirements: [], submitting: true});

    it('a requirement still open: the cursor goes to it — a QUESTION', () => {
      expect(nextCursorAfterAnswer(incomplete, 9)).to.deep.eq({kind: 'question', index: 2});
    });

    it('a target gone stale: the cursor goes to the row that lost its answer — a QUESTION', () => {
      expect(nextCursorAfterAnswer(stale, 9)).to.deep.eq({kind: 'question', index: 1});
    });

    it('a requirement outranks an offered question (an offer never holds the commit; a requirement does)', () => {
      expect(nextCursorAfterAnswer(incomplete, 9, 5)).to.deep.eq({kind: 'question', index: 2});
    });

    it('nothing holds the commit but a deferrable question was offered: it is visited first — OFFERED', () => {
      expect(nextCursorAfterAnswer(ready, 9, 5)).to.deep.eq({kind: 'offered', index: 5});
      expect(nextCursorAfterAnswer(ready, 9, -1), '-1 is «none»').to.deep.eq({kind: 'commit', index: 9});
    });

    it('nothing left to ask and the commit runs: the commit row — COMMIT (the armed arrival)', () => {
      expect(nextCursorAfterAnswer(ready, 9)).to.deep.eq({kind: 'commit', index: 9});
      expect(nextCursorAfterAnswer(computeCommitGate({requirements: [], submitting: false}), 0)).to.deep.eq({kind: 'commit', index: 0});
    });

    it('nothing left to ask but the commit cannot run: the commit row that names why — HELD, never armed', () => {
      expect(nextCursorAfterAnswer(blocked, 9)).to.deep.eq({kind: 'held', index: 9});
    });

    it('a press in flight: the cursor is frozen (undefined — leave it alone)', () => {
      expect(nextCursorAfterAnswer(submitting, 9, 5)).to.eq(undefined);
    });

    it('agrees with the gate everywhere they overlap (commitCursorTarget is the open-time half of the same rule)', () => {
      for (const gate of [ready, incomplete, stale]) {
        expect(nextCursorAfterAnswer(gate, 9)?.index).to.eq(commitCursorTarget(gate, 9));
      }
    });
  });

  /**
   * THE COMMIT ARRIVES — a press inside its arrival window is the arrival, never the move (decision 4): before the pose
   * is painted, within the ring's clock and a frame after it, and — on an open whose every answer was seeded — inside
   * the decision family's first settle.
   */
  describe('commitPressAbsorbed — the inertia gate of the commit arrival', () => {
    it('the window is the cursor clock and a frame', () => {
      expect(COMMIT_ARRIVAL_ABSORB_MS).to.be.gte(CURSOR_MS);
      expect(COMMIT_ARRIVAL_ABSORB_MS).to.be.lte(CURSOR_MS + 34);
    });

    it('no arrival recorded (the player WALKED onto the commit row): nothing is absorbed', () => {
      expect(commitPressAbsorbed(undefined, 1000)).to.eq(false);
    });

    it('a press before the pose is painted is absorbed — however late', () => {
      expect(commitPressAbsorbed({at: 0, paintedAt: undefined, settleUntil: 0}, 5000)).to.eq(true);
    });

    it('a press inside the window after the paint is absorbed; the next one after it is the move', () => {
      const arrival = {at: 100, paintedAt: 120, settleUntil: 0};
      expect(commitPressAbsorbed(arrival, 120)).to.eq(true);
      expect(commitPressAbsorbed(arrival, 120 + COMMIT_ARRIVAL_ABSORB_MS - 1)).to.eq(true);
      expect(commitPressAbsorbed(arrival, 120 + COMMIT_ARRIVAL_ABSORB_MS)).to.eq(false);
    });

    it('an open with everything seeded: the decision settle is a floor under the window', () => {
      const arrival = {at: 0, paintedAt: 0, settleUntil: SETTLE_FIRST_MS};
      expect(commitPressAbsorbed(arrival, COMMIT_ARRIVAL_ABSORB_MS + 10), 'past the ring, still inside the settle').to.eq(true);
      expect(commitPressAbsorbed(arrival, SETTLE_FIRST_MS)).to.eq(false);
    });
  });

  describe('the execution guard', () => {
    /** #11 — the cursor rule is the real protection, but a mouse click, a
     *  stale press or a repeat during a transition must not slip through. */
    it('redirects a refused submit instead of failing silently', () => {
      const gate = computeCommitGate({requirements: [req({index: 5})], submitting: false});
      expect(commitRedirectTarget(gate)).to.eq(5);
    });

    it('never redirects when the commit is legitimately runnable or in flight', () => {
      expect(commitRedirectTarget(computeCommitGate({requirements: [], submitting: false}))).to.eq(undefined);
      expect(commitRedirectTarget(computeCommitGate({requirements: [req()], submitting: true}))).to.eq(undefined);
      expect(commitRedirectTarget(computeCommitGate({requirements: [], submitting: false, unavailable: 'x'}))).to.eq(undefined);
    });
  });

  describe('the command bar', () => {
    /** #4 — the bar names the NEXT REAL STEP. A greyed «ПОДТВЕРДИТЬ» beside a
     *  press that would open a card selector describes the screen's eventual
     *  purpose instead of what A does now. */
    it('publishes the blocking requirement\'s own verb, never a dead confirm', () => {
      const gate = computeCommitGate({requirements: [req({verb: 'Choose a card'})], submitting: false});
      expect(commitFocusVerb(gate, false)).to.eq('Choose a card');
      // …even if a stale frame somehow reports the cursor on the commit row.
      expect(commitFocusVerb(gate, true)).to.eq('Choose a card');
    });

    it('publishes the confirm ONLY on the commit row, once ready', () => {
      const ready = computeCommitGate({requirements: [], submitting: false});
      expect(commitFocusVerb(ready, true)).to.eq('Confirm action');
      expect(commitFocusVerb(ready, false)).to.eq(undefined);
    });

    it('publishes nothing at all while the commit is in flight', () => {
      expect(commitFocusVerb(computeCommitGate({requirements: [], submitting: true}), true)).to.eq(undefined);
    });
  });

  /**
   * The bar is generated from the same verdict the row paints itself with, so
   * the two cannot drift. These pin the wiring, not just the model.
   */
  describe('the action composer\'s bar honours the gate', () => {
    it('offers NO confirm entry while the commit cannot run', () => {
      const run = focusCommandRun({state: 'main', focused: 'pick', canConfirm: false, pickVerb: 'Choose a card'});
      expect(run.some((c) => c.control === 'confirm' && c.label === 'Confirm')).to.eq(false);
      // …and A names the step that IS live.
      expect(run.find((c) => c.control === 'confirm')?.label).to.eq('Choose a card');
    });

    it('an ANSWERED pick offers «Изменить», not the requirement\'s open verb', () => {
      const run = focusCommandRun({
        state: 'main', focused: 'pick', resolved: true, canConfirm: true, pickVerb: 'Choose a card',
      });
      expect(run.find((c) => c.control === 'confirm')?.label).to.eq('Change');
    });

    it('offers the confirm on the commit row once the gate is ready', () => {
      const run = focusCommandRun({state: 'main', focused: 'none', canConfirm: true});
      expect(run.find((c) => c.control === 'confirm')?.label).to.eq('Confirm');
    });

    /** A dead A must not be published even as a greyed entry — the bar helps
     *  the player, it does not inventory the screen. */
    it('publishes no greyed confirm on a commit row that cannot run', () => {
      const run = focusCommandRun({state: 'main', focused: 'none', canConfirm: false});
      expect(run.some((c) => c.control === 'confirm')).to.eq(false);
    });
  });
});
