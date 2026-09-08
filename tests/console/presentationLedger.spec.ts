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
  LEDGER_TICK_MS,
  owePresentation, presentationLedgerSnapshot, presentationLedgerStats,
  registerTruthWitness, resetPresentationLedger, settlePresentationDue,
} from '../../src/client/console/presentationLedger';

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

  it('reset clears stories and witnesses', () => {
    owePresentation({id: 'story', ready: () => true, redrive: () => {}, dueMs: 60_000});
    registerTruthWitness({id: 'liar', lying: () => true, graceMs: 0, heal: () => {}});
    resetPresentationLedger();
    expect(presentationLedgerSnapshot().stories).to.deep.equal([]);
    expect(presentationLedgerSnapshot().witnesses).to.deep.equal([]);
  });
});
