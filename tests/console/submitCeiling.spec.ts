import {expect} from 'chai';
import {armSubmitCeiling, CeilingClock, SUBMIT_NO_RESPONSE_MS} from '@/client/console/transport/submitCeiling';

/**
 * THE SUBMIT'S ONE HONEST CEILING (the owner, 2026-10-31): it fires ONLY when the server never answered — a generous
 * minute — cancels the request and says it was the server's silence; an answer at any time before that stands it down.
 */
describe('submitCeiling', () => {
  /** A hand-driven clock: `tick(ms)` runs what is due. */
  function manualClock() {
    let now = 0;
    const due: Array<{at: number, run: () => void, id: number}> = [];
    let nextId = 1;
    const clock: CeilingClock = {
      schedule: (run, ms) => {
        const id = nextId++;
        due.push({at: now + ms, run, id});
        return id;
      },
      cancel: (handle) => {
        const i = due.findIndex((d) => d.id === handle);
        if (i !== -1) {
          due.splice(i, 1);
        }
      },
    };
    const tick = (ms: number) => {
      now += ms;
      for (const d of due.filter((x) => x.at <= now)) {
        due.splice(due.indexOf(d), 1);
        d.run();
      }
    };
    return {clock, tick, pending: () => due.length};
  }

  it('is generous — a minute, far above any honest answer', () => {
    expect(SUBMIT_NO_RESPONSE_MS).to.be.at.least(45_000);
  });

  it('fires only after the whole silence: aborts the request and names the server\'s silence', () => {
    const {clock, tick} = manualClock();
    const fired: Array<number> = [];
    const c = armSubmitCeiling((ms) => fired.push(ms), SUBMIT_NO_RESPONSE_MS, clock);
    tick(SUBMIT_NO_RESPONSE_MS - 1);
    expect(fired, 'a slow answer is not a dead server').to.deep.equal([]);
    expect(c.silent()).is.false;
    expect(c.signal?.aborted ?? false).is.false;
    tick(1);
    expect(fired).to.deep.equal([SUBMIT_NO_RESPONSE_MS]);
    expect(c.silent()).is.true;
    if (c.signal !== undefined) {
      expect(c.signal.aborted, 'the request is cancelled').is.true;
    }
  });

  it('an answer at any moment before stands it down — nothing fires, nothing is cancelled', () => {
    const {clock, tick, pending} = manualClock();
    const fired: Array<number> = [];
    const c = armSubmitCeiling((ms) => fired.push(ms), SUBMIT_NO_RESPONSE_MS, clock);
    tick(SUBMIT_NO_RESPONSE_MS - 5);
    c.clear();
    expect(pending()).to.equal(0);
    tick(SUBMIT_NO_RESPONSE_MS);
    expect(fired).to.deep.equal([]);
    expect(c.silent()).is.false;
    expect(c.signal?.aborted ?? false).is.false;
    // Idempotent.
    c.clear();
  });
});
