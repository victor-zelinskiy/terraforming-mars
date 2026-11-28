import {expect} from 'chai';
import {watch} from 'vue';
import {createManualClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {dumpFlowTree, resetFlowKernel} from '@/client/console/kernel/flowScope';
import {beginConsoleSession, resetConsoleSession} from '@/client/console/session/consoleSession';
import {pressState, submitInFlight} from '@/client/console/session/pressState';
import {announceSubmitTicket, SubmitSettle, SubmitTicket} from '@/client/console/transport/submitTicket';

/**
 * A LATCH OF A PRESS IS THE SUBMIT's (`session/pressState.ts` — FREEZE ZERO, stage 9; the family of #119). «A commit
 * is on its way» raised before the answer exists is bound to the submit its press makes and cannot outlive it: the
 * finale's «Завершить свою партию» held its own question down for good when the network lost the answer — no unwind
 * was declared for that press, and the latch's release waited for an applied view that an unmade move never brings.
 */
describe('pressState — a latch of a press is bound to its submit, and cannot outlive it', () => {
  beforeEach(() => {
    resetFlowKernel();
    resetConsoleSession();
    resetFlowKernel();
    setFlowClock(createManualClock(0));
    beginConsoleSession();
  });
  afterEach(() => {
    resetConsoleSession();
    setFlowClock(undefined);
  });

  const standing = (label: string): Array<string> => dumpFlowTree().filter((line) => line.includes(`step:${label}#`));
  const flush = async (): Promise<void> => {
    for (let i = 0; i < 4; i++) {
      await Promise.resolve();
    }
  };
  /** A press taken by the funnel: the ticket the transport announces, and the door that ends its submit. */
  const press = (id: string): {ticket: SubmitTicket, end: (status: SubmitSettle['status']) => Promise<void>} => {
    let settle: (value: SubmitSettle) => void = () => {};
    const ticket: SubmitTicket = {accepted: true, id, settled: new Promise<SubmitSettle>((resolve) => {
      settle = resolve;
    })};
    return {ticket, end: async (status) => {
      settle({id, status});
      await flush();
    }};
  };
  const warned = async (run: () => Promise<void>): Promise<Array<string>> => {
    const lines: Array<string> = [];
    const original = console.warn;
    console.warn = (...args: Array<unknown>) => {
      lines.push(args.map(String).join(' '));
    };
    try {
      await run();
    } finally {
      console.warn = original;
    }
    return lines;
  };

  for (const status of ['refused', 'failed', 'silent'] as const) {
    it(`THE MOVE WAS NOT MADE (${status}): the latch falls at the submit's end — nothing else had to remember`, async () => {
      const committing = pressState('final-greenery-committing', false);
      const seen: Array<boolean> = [];
      watch(committing, (value) => seen.push(value), {flush: 'sync'});
      const sent = press('submit#1');

      committing.value = true;
      announceSubmitTicket(sent.ticket);
      await flush();
      expect(committing.value, 'in flight: the latch stands, and the tree names it').to.eq(true);
      expect(standing('final-greenery-committing')).to.have.length(1);
      expect(submitInFlight(), 'the question is held by its submit').to.eq(true);

      await sent.end(status);
      expect(committing.value).to.eq(false);
      expect(standing('final-greenery-committing')).to.deep.eq([]);
      expect(seen, 'a reader (the door that re-opens the surface) sees it fall').to.deep.eq([true, false]);
      expect(submitInFlight()).to.eq(false);
    });
  }

  it('THE FUNNEL NEVER TOOK THE PRESS: it falls at once — nothing was sent, nothing will come', async () => {
    const committing = pressState('final-greenery-committing', false);
    committing.value = true;
    announceSubmitTicket({accepted: false, id: '', reason: 'busy', settled: Promise.resolve({id: '', status: 'rejected'})});
    expect(committing.value).to.eq(false);
    expect(submitInFlight()).to.eq(false);
  });

  it('APPLIED: it falls with the submit; STAGED · ABANDONED — the view is still coming by another road, the latch stays the module\'s', async () => {
    const committing = pressState('final-greenery-committing', false);
    const applied = press('submit#1');
    committing.value = true;
    announceSubmitTicket(applied.ticket);
    await applied.end('applied');
    expect(committing.value).to.eq(false);

    for (const status of ['staged', 'abandoned'] as const) {
      const sent = press(`submit#${status}`);
      committing.value = true;
      announceSubmitTicket(sent.ticket);
      await sent.end(status);
      expect(committing.value, `${status}: falling under the OLD view would re-open a question already answered`).to.eq(true);
      // …the module's own release (the answer's view applied) lowers it, as before.
      committing.value = false;
      expect(standing('final-greenery-committing')).to.deep.eq([]);
    }
  });

  it('AN ARM WITH NO PRESS: raised in a task that made no submit — lowered at the task\'s end, and said', async () => {
    const committing = pressState('final-greenery-committing', false);
    const lines = await warned(async () => {
      committing.value = true;
      await flush();
    });
    expect(committing.value).to.eq(false);
    expect(lines).to.have.length(1);
    expect(lines[0]).to.match(/^\[invariant\] press-state:final-greenery-committing — raised for a press, and no submit was made/);
  });

  it('a latch lowered by hand is no longer the press\'s: a LATER raise is another press, and the first submit\'s end does not touch it', async () => {
    const committing = pressState('final-greenery-committing', false);
    const first = press('submit#1');
    committing.value = true;
    announceSubmitTicket(first.ticket);
    // (The module's own unwind put the pick back, and lowered the latch itself.)
    committing.value = false;

    const second = press('submit#2');
    committing.value = true;
    announceSubmitTicket(second.ticket);
    const lines = await warned(async () => {
      await first.end('refused');
    });
    expect(committing.value, 'the second press is still in flight').to.eq(true);
    expect(lines, 'bound: no «arm with no press»').to.deep.eq([]);
    await second.end('refused');
    expect(committing.value).to.eq(false);
  });

  it('one press, two latches: both are its submit\'s; a ticket binds only what was raised for it', async () => {
    const committing = pressState('committing', false);
    const pick = pressState('pick-answered', '' as string);
    const sent = press('submit#1');
    committing.value = true;
    pick.value = 'or#12';
    announceSubmitTicket(sent.ticket);
    // (Raised AFTER the ticket was announced: another press's — it waits for its own.)
    const late = pressState('late', false);
    const lines = await warned(async () => {
      late.value = true;
      await sent.end('silent');
    });
    expect([committing.value, pick.value]).to.deep.eq([false, '']);
    expect(late.value, 'never bound to submit#1 — it was an arm with no press of its own').to.eq(false);
    expect(lines.join('\n')).to.contain('[invariant] press-state:late');
  });
});
