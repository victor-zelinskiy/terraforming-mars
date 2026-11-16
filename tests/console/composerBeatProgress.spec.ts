import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {CLAIM_ARRIVAL_SAFETY_MS, CLAIM_BEAT_SAFETY_MS} from '@/client/console/consoleWorkspaceClaim';
import {
  claimWorkspaceOutcome, markWorkspaceOutcomeAnswerIn, markWorkspaceOutcomeArrivalFlown, markWorkspaceOutcomeBeatDone, rearmWorkspaceOutcomeBeat,
  resetWorkspaceOutcome, workspaceOutcomeArrivalPending, workspaceOutcomeBeatPending,
} from '@/client/console/consoleWorkspaceOutcome';
import {enterWorkspace, resetWorkspaceStack} from '@/client/console/consoleWorkspaceStack';

/*
 * THE DRAW BEAT'S BACKSTOP FOLLOWS ITS FLIGHT (FLAKE ZERO · class N — `ConsoleActionComposer.vue` § the beat flight,
 * `consoleWorkspaceClaim.ts` `CLAIM_BEAT_SAFETY_MS`).
 *
 * The claim's execution beat has a 2.6 s backstop: a beat it marks done lets the shell present the REAL cards in the
 * zone. Re-armed only at the launch, it ran out on a slow renderer while a search's rejects were still streaming off
 * the deck, a merged assembly was dealing its later runs, or the faces were turning — the claim presented its cards
 * under their own proxies still in the air (the duplicate card's class). The backstop now guards a beat that STALLED:
 * every step of the flight re-arms it (a card leaving its pile, a face turning, the batch landing; the discard stream
 * while it deals), and only 2.6 s with NO progress lets it fall.
 */
describe('the composer\'s draw beat · its backstop follows the flight\'s progress', () => {
  describe('the claim: re-armed per step, a beat falls only 2.6 s after its LAST step', () => {
    let clock: ManualFlowClock;
    beforeEach(() => {
      resetWorkspaceOutcome();
      resetWorkspaceStack();
      clock = createManualClock(0);
      setFlowClock(clock);
    });
    afterEach(() => {
      resetWorkspaceOutcome();
      resetWorkspaceStack();
      setFlowClock(undefined);
    });

    it('a flight that keeps progressing for 6 s keeps the beat pending; its settle (or a stall) ends it', () => {
      enterWorkspace('card-actions');
      claimWorkspaceOutcome('card-actions', 'Some Card', ['draw']);
      markWorkspaceOutcomeArrivalFlown(); // the launch
      for (let t = 0; t < 6000; t += 800) {
        clock.advance(800);
        rearmWorkspaceOutcomeBeat(); // a card peeled / a face turned
      }
      expect(workspaceOutcomeBeatPending(), 'the flight is still progressing').to.eq(true);
      clock.advance(CLAIM_BEAT_SAFETY_MS - 1);
      expect(workspaceOutcomeBeatPending()).to.eq(true);
      clock.advance(1);
      expect(workspaceOutcomeBeatPending(), 'a stall: 2.6 s with no step').to.eq(false);
      markWorkspaceOutcomeBeatDone();
    });

    it('the ARRIVAL gate never opens while the beat still flies; its 5 s restart at the beat\'s settle', () => {
      enterWorkspace('card-actions');
      claimWorkspaceOutcome('card-actions', 'Some Card', ['draw', 'pick']);
      markWorkspaceOutcomeAnswerIn(); // the arrival's backstop is armed from the answer
      markWorkspaceOutcomeArrivalFlown();
      for (let t = 0; t < 8000; t += 800) {
        clock.advance(800);
        rearmWorkspaceOutcomeBeat();
      }
      expect(workspaceOutcomeArrivalPending(), 'the beat\'s cards are still in the air — no press may land').to.eq(true);
      markWorkspaceOutcomeBeatDone(); // the flight settled: the hand-over starts
      clock.advance(CLAIM_ARRIVAL_SAFETY_MS - 1);
      expect(workspaceOutcomeArrivalPending()).to.eq(true);
      clock.advance(1);
      expect(workspaceOutcomeArrivalPending(), 'a hand-over that never reported: its own bound').to.eq(false);
    });
  });

  describe('the composer wires every step of the beat\'s flight to its backstop', () => {
    const source = fs.readFileSync(path.resolve('src/client/components/console/ConsoleActionComposer.vue'), 'utf8');
    const body = (name: string): string => {
      const at = source.indexOf(`function ${name}(`);
      expect(at, `function ${name}`).to.be.greaterThan(-1);
      const next = source.indexOf('\nfunction ', at + 1);
      return source.slice(at, next < 0 ? undefined : next);
    };

    it('the batch arrival: each card peeled, each face shown, the landing', () => {
      const launch = body('launchBeatBatch');
      expect(launch).to.match(/onCardPeeled: \(\) => beatProgressed\(\)/);
      expect(launch).to.match(/onFaceShown: \(\) => beatProgressed\(\)/);
      expect(launch).to.match(/onLanded: \(\) => \{[^}]*beatProgressed\(\)/);
    });

    it('the merged assembly: each card of each run', () => {
      expect(body('launchBeatAssembly')).to.match(/onCardPeeled: \(\) => beatProgressed\(\)/);
    });

    it('the discard stream: re-armed while it deals, up to the found cards\' launch', () => {
      const begin = body('beginBeatFlight');
      expect(begin).to.match(/flow\.every\(CLAIM_BEAT_SAFETY_MS \/ 2,/);
      expect(begin).to.match(/if \(launched \|\| !beatFlightOn\.value \|\| !deckDrawState\.streaming\)/);
    });

    it('a step re-arms the claim\'s beat (and only while the claim awaits — the facade\'s own guard)', () => {
      expect(body('beatProgressed')).to.match(/rearmWorkspaceOutcomeBeat\(\)/);
    });
  });
});
