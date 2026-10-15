import {expect} from 'chai';
import {
  CardReceiveScene, abortCardReceive, cardReceiveActive, cardReceiveState, runCardReceive,
} from '@/client/console/cardReceive/cardReceiveDirector';

/**
 * «ПРИЁМ РЕСУРСА КАРТОЙ» — the ONE grammar (TR53 iteration): PRESENT · PAY ·
 * READ · RETURN in that order, whatever the host; a host move that finds
 * nothing to measure degrades the scene (its holds released at once, the next
 * phases never run); an abort stops at the next phase; the holds a host seeded
 * are released EXACTLY once on every way out; scenes never overlap.
 */
function scene(over: Partial<CardReceiveScene> = {}, log: Array<string> = []): CardReceiveScene {
  return {
    host: 'prompt',
    card: 'Tardigrades',
    readMs: 0,
    present: async () => {
      log.push('present');
      return true;
    },
    pay: async () => {
      log.push('pay');
      return true;
    },
    ret: async () => {
      log.push('ret');
    },
    release: () => log.push('release'),
    ...over,
  };
}

describe('cardReceiveDirector — one grammar of «a resource lands on a card»', () => {
  afterEach(() => {
    abortCardReceive();
  });

  it('walks PRESENT → PAY → READ → RETURN and releases the holds once, at the end', async () => {
    const log: Array<string> = [];
    const outcome = await runCardReceive(scene({}, log));
    expect(outcome).eq('done');
    expect(log).deep.eq(['present', 'pay', 'ret', 'release']);
    expect(cardReceiveState.walked).deep.eq(['present', 'pay', 'read', 'return']);
    expect(cardReceiveState.phase).eq('idle');
    expect(cardReceiveState.outcome).eq('done');
    expect(cardReceiveActive()).is.false;
  });

  it('the phase is published while the host moves (the probe reads it, the hold rides it)', async () => {
    const seen: Array<string> = [];
    await runCardReceive(scene({
      present: async () => {
        seen.push(cardReceiveState.phase);
        return true;
      },
      pay: async () => {
        seen.push(cardReceiveState.phase);
        expect(cardReceiveActive()).is.true;
        return true;
      },
      ret: async () => {
        seen.push(cardReceiveState.phase);
      },
    }));
    expect(seen).deep.eq(['present', 'pay', 'return']);
  });

  it('a PRESENT with nothing to measure degrades: no pay, no return, the holds released', async () => {
    const log: Array<string> = [];
    const outcome = await runCardReceive(scene({present: async () => false}, log));
    expect(outcome).eq('degraded');
    expect(log).deep.eq(['release']);
    expect(cardReceiveState.outcome).eq('degraded');
  });

  it('a PAY that degrades skips the read and the return', async () => {
    const log: Array<string> = [];
    const outcome = await runCardReceive(scene({
      pay: async () => {
        log.push('pay');
        return false;
      },
    }, log));
    expect(outcome).eq('degraded');
    expect(log).deep.eq(['present', 'pay', 'release']);
  });

  it('a host move that THROWS degrades the scene — never a rejection, never a stranded hold', async () => {
    const log: Array<string> = [];
    // The director WARNS with the Error in a dev build: printing its stack resolves the whole suite bundle's source
    // map (seconds in the full `test:client` — the «warn-stack» trap), so the warn is caught and counted here.
    const warn = console.warn;
    let warned = 0;
    console.warn = () => {
      warned++;
    };
    try {
      const outcome = await runCardReceive(scene({
        pay: async () => {
          throw new Error('the capsule is gone');
        },
      }, log));
      expect(outcome).eq('degraded');
      expect(log).deep.eq(['present', 'release']);
      expect(warned, 'the degrade names itself').eq(1);
    } finally {
      console.warn = warn;
    }
  });

  it('a host that is gone (alive false) stops at the next phase, its holds released', async () => {
    const log: Array<string> = [];
    let alive = true;
    const outcome = await runCardReceive(scene({
      present: async () => {
        log.push('present');
        alive = false;
        return true;
      },
      alive: () => alive,
    }, log));
    expect(outcome).eq('aborted');
    expect(log).deep.eq(['present', 'release']);
  });

  it('a new scene aborts the one on stage: the old holds released first, the new scene plays whole', async () => {
    const log: Array<string> = [];
    let unblock: () => void = () => {};
    const first = runCardReceive(scene({
      card: 'A',
      pay: () => new Promise<boolean>((resolve) => {
        unblock = () => resolve(true);
      }),
      release: () => log.push('release A'),
    }));
    await Promise.resolve();
    await Promise.resolve();
    const second = runCardReceive(scene({card: 'B', release: () => log.push('release B')}, log));
    unblock();
    expect(await first).eq('aborted');
    expect(await second).eq('done');
    expect(log.filter((l) => l.startsWith('release'))).deep.eq(['release A', 'release B']);
    expect(cardReceiveState.card).eq('B');
  });
});
