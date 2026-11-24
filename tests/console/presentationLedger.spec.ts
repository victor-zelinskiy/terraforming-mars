/*
 * PRESENTATION LEDGER — the debt book of deferred presentation
 * (src/client/console/presentationLedger.ts). Pure module (no Vue), so it
 * runs under the fast server runner. Pins the laws of mechanism B:
 *
 *  1. REDRIVE — a due story whose `ready()` holds is re-driven through the
 *     owner's own entry, at most once per min-gap.
 *  2. DEGRADE IS NAMED — past `dueMs` the degrade runs once, the story
 *     retires, and the counter moves (a safety is never silent again).
 *  3. THE CLOCK IS THE FIRST DEFERRAL'S — a re-owe of the same id keeps the
 *     original `since`.
 *  4. WITNESS — a lie must outlive its grace continuously before the heal.
 *  5. THE HEARTBEAT ticks on its own while something is owed.
 */
import {expect} from 'chai';
import {
  LEDGER_TICK_MS, STORY_TELLING_GRACE_MS,
  owePresentation, presentationLedgerSnapshot, presentationLedgerStats,
  registerTruthWitness, resetPresentationLedger, settlePresentationDue,
} from '../../src/client/console/presentationLedger';
import {dumpFlowTree} from '../../src/client/console/kernel/flowScope';
import {beginConsoleSession, endConsoleSession} from '../../src/client/console/session/consoleSession';
import {createManualClock, FlowClock, setFlowClock} from '../../src/client/console/kernel/flowClock';
import {__resetFrameWitnessForTesting} from '../../src/client/console/kernel/frameWitness';
import {causeOf} from '../../src/common/diagnostics/cause';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

describe('presentationLedger', function() {
  // The heartbeat test walks real timer windows.
  // eslint-disable-next-line no-invalid-this
  this.timeout(10_000);

  beforeEach(() => {
    resetPresentationLedger();
    presentationLedgerStats.redrives = 0;
    presentationLedgerStats.degrades = 0;
    presentationLedgerStats.heals = 0;
  });

  after(() => {
    // Module state is process-shared — a leaked story would tick its
    // heartbeat under every later spec.
    resetPresentationLedger();
  });

  it('AN OWED STORY IS A `story` SCOPE of the session: it stands in the tree until it settles — and ends with its session', () => {
    beginConsoleSession();
    const standing = (): Array<string> => dumpFlowTree().filter((line) => line.includes('owed:spec-park'));
    const first = owePresentation({id: 'spec-park', ready: () => false, redrive: () => {}, dueMs: 60_000});
    expect(standing(), 'one scope per story').to.have.length(1);
    expect(standing()[0]).to.include('story:owed:spec-park#');
    // A re-owe is the same story deferring again: the same scope, as the same clock.
    const second = owePresentation({id: 'spec-park', ready: () => false, redrive: () => {}, dueMs: 60_000});
    expect(standing()).to.have.length(1);
    first.settle(); // an older handle never settles the newer owe
    expect(standing()).to.have.length(1);
    second.settle();
    expect(standing(), 'settled: the scope ended').to.deep.eq([]);
    expect(presentationLedgerSnapshot().stories).to.deep.eq([]);

    // A debt of a game screen that LEFT is not re-driven into the next one: the story leaves the book with its session.
    let redriven = 0;
    let degraded = 0;
    owePresentation({id: 'spec-park', ready: () => true, redrive: () => redriven++, dueMs: 60_000, degrade: () => degraded++});
    endConsoleSession();
    expect(standing()).to.deep.eq([]);
    expect(presentationLedgerSnapshot().stories).to.deep.eq([]);
    settlePresentationDue();
    expect(redriven, 'no redrive for a story whose session ended').to.equal(0);
    expect(degraded, 'and no degrade: the owner\'s own reset lets its values go').to.equal(0);
  });

  it('re-drives a ready story through the owner entry, once per min-gap', () => {
    let redriven = 0;
    owePresentation({
      id: 'story',
      ready: () => true,
      redrive: () => redriven++,
      dueMs: 60_000,
    });
    settlePresentationDue();
    settlePresentationDue(); // inside the min-gap — must not double-fire
    expect(redriven).to.equal(1);
    expect(presentationLedgerStats.redrives).to.equal(1);
  });

  it('never re-drives a story that is not ready', () => {
    let redriven = 0;
    owePresentation({
      id: 'story',
      ready: () => false,
      redrive: () => redriven++,
      dueMs: 60_000,
    });
    settlePresentationDue();
    expect(redriven).to.equal(0);
    expect(presentationLedgerSnapshot().stories.map((s) => s.id)).to.deep.equal(['story']);
  });

  it('the snapshot says WHY each owed story still waits (PL-778)', () => {
    owePresentation({id: 'told', ready: () => false, redrive: () => {}, dueMs: 60_000, diagnose: () => ({marker: false, held: 'oxygen'})});
    owePresentation({id: 'silent', ready: () => false, redrive: () => {}, dueMs: 60_000});
    owePresentation({id: 'broken', ready: () => false, redrive: () => {}, dueMs: 60_000, diagnose: () => {
      throw new Error('gone');
    }});
    const why = Object.fromEntries(presentationLedgerSnapshot().stories.map((s) => [s.id, s.why]));
    expect(why).to.deep.equal({told: '{"marker":false,"held":"oxygen"}', silent: '', broken: '(diagnose threw: Error: gone)'});
  });

  it('degrades a past-due story exactly once and retires it', () => {
    let degraded = 0;
    owePresentation({
      id: 'story',
      ready: () => false,
      redrive: () => {},
      dueMs: 0,
      degrade: () => degraded++,
    });
    settlePresentationDue();
    settlePresentationDue();
    expect(degraded).to.equal(1);
    expect(presentationLedgerStats.degrades).to.equal(1);
    expect(presentationLedgerSnapshot().stories).to.deep.equal([]);
  });

  it('settle retires the story — no later degrade can fire', () => {
    let degraded = 0;
    const handle = owePresentation({
      id: 'story',
      ready: () => false,
      redrive: () => {},
      dueMs: 0,
      degrade: () => degraded++,
    });
    handle.settle();
    settlePresentationDue();
    expect(degraded).to.equal(0);
  });

  it('an OLDER handle never settles the story a newer owe of the same id wrote (wait graph inventory H1)', () => {
    let degraded = 0;
    const old = owePresentation({id: 'story', ready: () => false, redrive: () => {}, dueMs: 0, degrade: () => {}});
    const fresh = owePresentation({id: 'story', ready: () => false, redrive: () => {}, dueMs: 0, degrade: () => degraded++});
    old.settle();
    settlePresentationDue();
    expect(degraded, 'the newer wait kept its net').to.equal(1);
    fresh.settle();
  });

  it('a re-owe of the same id keeps the ORIGINAL clock', async () => {
    let degraded = 0;
    owePresentation({id: 'story', ready: () => false, redrive: () => {}, dueMs: 40, degrade: () => degraded++});
    await delay(60);
    // The same story deferring again — the debt is as old as its first owe.
    owePresentation({id: 'story', ready: () => false, redrive: () => {}, dueMs: 40, degrade: () => degraded++});
    settlePresentationDue();
    expect(degraded).to.equal(1);
  });

  it('a witness heals only after the lie outlives its grace CONTINUOUSLY', () => {
    let lying = true;
    let healed = 0;
    registerTruthWitness({
      id: 'liar',
      lying: () => lying,
      graceMs: 0,
      heal: () => healed++,
    });
    settlePresentationDue(); // first sighting — starts the clock
    expect(healed).to.equal(0);
    settlePresentationDue(); // grace 0 elapsed → heal
    expect(healed).to.equal(1);
    // The lie clears → the clock resets; a re-appearance starts over.
    lying = false;
    settlePresentationDue();
    lying = true;
    settlePresentationDue();
    expect(healed).to.equal(1);
    expect(presentationLedgerStats.heals).to.equal(1);
  });

  it('the heartbeat ticks on its own while something is owed', async () => {
    let redriven = 0;
    owePresentation({
      id: 'story',
      ready: () => true,
      redrive: () => redriven++,
      dueMs: 60_000,
    });
    await delay(LEDGER_TICK_MS * 3 + 80);
    expect(redriven).to.be.greaterThan(0);
  });

  /*
   * A STORY's DUE IS JUDGED AGAINST THE FRAMES THE PAGE PAINTED (freeze zero, stage 1 — CI `fz1` · duo,
   * `info-dossier-rich`, 2026-11-19): the page behind another window, a marker moving at a frame a second, and two
   * stories «degraded after 30 s — the release edge never came», each a defect, beside a ceiling of the same scene
   * already read as «the page gave the motion 3375 of 32138 ms». Nothing is judged on a page that does not paint.
   */
  for (const page of ['behind another window', 'in front'] as const) {
    it(`a story that comes due on a page ${page}: ${page === 'in front' ? 'the defect it always was' : 'its due is the honest end — said with what the page gave'}`, () => {
      const base = createManualClock(1_000);
      // (Behind: time runs and timers fire; a frame never comes.)
      const clock: FlowClock = page === 'in front' ? base : {...base, nextFrame: () => () => undefined};
      const realNow = Date.now;
      const said: Array<string> = [];
      const warn = console.warn;
      console.warn = (...args: Array<unknown>) => said.push(args.map(String).join(' '));
      __resetFrameWitnessForTesting();
      setFlowClock(clock);
      try {
        owePresentation({id: 'spec-behind', ready: () => false, redrive: () => {}, dueMs: 30_000, diagnose: () => ({watchable: true, coveredBy: []})});
        base.advance(29_000);
        expect(said, 'not due yet').to.deep.eq([]);
        Date.now = () => realNow() + 30_000;
        base.advance(LEDGER_TICK_MS);
        expect(said).to.have.length(1);
        expect(said[0]).to.match(/^\[presentation-ledger\] story «spec-behind» degraded after \d+s — the release edge never came — \{"watchable":true,"coveredBy":\[\]\}/);
        if (page === 'in front') {
          expect(said[0]).to.not.match(/planned:/);
          expect(causeOf(said[0], 'warn')?.tier).to.eq('defect');
        } else {
          expect(said[0]).to.match(/ \(planned: the page gave the motion \d+ of \d+ ms, .* a motion cannot keep its bound on a page that does not paint\)$/);
          expect(causeOf(said[0], 'warn')?.tier).to.eq('planned');
        }
        expect(presentationLedgerSnapshot().stories).to.deep.equal([]);
      } finally {
        Date.now = realNow;
        console.warn = warn;
        resetPresentationLedger();
        setFlowClock(undefined);
        __resetFrameWitnessForTesting();
      }
    });
  }

  /*
   * A STORY BEING TOLD AT ITS DUE IS NOT CUT (the box's whole games, 2026-11-24 — game 107): the board came into view
   * in the last second of the park's thirty, the drain opened — and the due degraded the story under its own motion
   * («watchable: true, draining: true, drains: 1»): the scales snapping mid-glide, filed as a defect. The telling
   * finishes within a bounded grace; one that outlives the grace is degraded like any other.
   */
  it('a story being TOLD at its due finishes — within a bounded grace; past the grace it is degraded all the same', () => {
    const realNow = Date.now;
    let t = realNow();
    Date.now = () => t;
    const warn = console.warn;
    const said: Array<string> = [];
    console.warn = (...args: Array<unknown>) => said.push(args.map(String).join(' '));
    try {
      let degraded = 0;
      let telling = true;
      const told = owePresentation({id: 'told', ready: () => false, redrive: () => {}, dueMs: 30_000, degrade: () => degraded++, telling: () => telling});
      t += 30_500;
      settlePresentationDue();
      expect(degraded, 'told at its due: not cut').to.equal(0);
      expect(said).to.deep.eq([]);
      // …its owner settles it when the telling ends: no degrade ever comes.
      told.settle();
      t += 60_000;
      settlePresentationDue();
      expect(degraded).to.equal(0);

      // A telling that STOPS without settling (the board covered again) is past its due: degraded at the next look.
      owePresentation({id: 'stopped', ready: () => false, redrive: () => {}, dueMs: 30_000, degrade: () => degraded++, telling: () => telling});
      t += 30_500;
      settlePresentationDue();
      expect(degraded).to.equal(0);
      telling = false;
      settlePresentationDue();
      expect(degraded, 'no longer told: the honest degrade').to.equal(1);

      // …and a telling that never ends is bounded by the grace.
      telling = true;
      owePresentation({id: 'endless', ready: () => false, redrive: () => {}, dueMs: 30_000, degrade: () => degraded++, telling: () => telling});
      t += 30_000 + STORY_TELLING_GRACE_MS - 500;
      settlePresentationDue();
      expect(degraded, 'inside the grace').to.equal(1);
      t += 1_000;
      settlePresentationDue();
      expect(degraded, 'past the grace').to.equal(2);
      expect(said.filter((line) => line.includes('degraded after'))).to.have.length(2);
    } finally {
      Date.now = realNow;
      console.warn = warn;
      resetPresentationLedger();
    }
  });

  it('reset clears stories and witnesses', () => {
    owePresentation({id: 'story', ready: () => true, redrive: () => {}, dueMs: 60_000});
    registerTruthWitness({id: 'liar', lying: () => true, graceMs: 0, heal: () => {}});
    resetPresentationLedger();
    expect(presentationLedgerSnapshot().stories).to.deep.equal([]);
    expect(presentationLedgerSnapshot().witnesses).to.deep.equal([]);
  });
});
