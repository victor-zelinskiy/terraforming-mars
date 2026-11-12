import {expect} from 'chai';
import {readFileSync} from 'fs';
import {join} from 'path';
import {createDeckTickPacer} from '../../src/client/console/deckDraw/deckTickPacer';

/** A frame queue the spec steps by hand: `frame()` runs what the previous frame scheduled. */
function frames() {
  let queue: Array<() => void> = [];
  return {
    nextFrame: (fn: () => void) => {
      queue.push(fn);
    },
    frame: () => {
      const run = queue;
      queue = [];
      run.forEach((fn) => fn());
    },
    pending: () => queue.length,
  };
}

describe('deckTickPacer — one card, one tick, its own frame (CI 43066263512: 283 → 280 in one step)', () => {
  it('the first owed tick is written at once — the departure IS the event', () => {
    const f = frames();
    const log: Array<string> = [];
    const pacer = createDeckTickPacer({tick: () => log.push('tick'), nextFrame: f.nextFrame});
    pacer.owe();
    expect(log).to.deep.eq(['tick']);
  });

  it('cards that leave in ONE task tick in successive frames, never merged into one repaint', () => {
    const f = frames();
    const log: Array<string> = [];
    const pacer = createDeckTickPacer({tick: () => log.push('tick'), nextFrame: f.nextFrame});
    // Two beats started on one starved GSAP tick: both «drawn» calls land in the same task.
    pacer.owe();
    pacer.owe();
    expect(log, 'only the first in this frame').to.deep.eq(['tick']);
    f.frame();
    expect(log, 'the second a frame later').to.deep.eq(['tick', 'tick']);
    expect(pacer.ticked).to.eq(2);
  });

  it('a backstop that catches up N cards writes them one per frame, never one jump', () => {
    const f = frames();
    let held = 283;
    const seen: Array<number> = [held];
    const pacer = createDeckTickPacer({
      tick: () => {
        held--;
        seen.push(held);
      },
      nextFrame: f.nextFrame,
    });
    pacer.owe(3);
    f.frame();
    f.frame();
    f.frame();
    expect(seen).to.deep.eq([283, 282, 281, 280]);
  });

  it('«drained» runs a frame AFTER the last tick — the owner\'s release never shares its repaint', () => {
    const f = frames();
    const log: Array<string> = [];
    const pacer = createDeckTickPacer({tick: () => log.push('tick'), nextFrame: f.nextFrame});
    pacer.owe();
    pacer.owe();
    pacer.whenDrained(() => log.push('release'));
    expect(log).to.deep.eq(['tick']);
    f.frame();
    expect(log, 'the second tick, still no release in its frame').to.deep.eq(['tick', 'tick']);
    f.frame();
    expect(log).to.deep.eq(['tick', 'tick', 'release']);
    expect(f.pending(), 'the pump stops once drained').to.eq(0);
  });

  it('«drained» with nothing owed runs at once; a release is never called twice by one wait', () => {
    const f = frames();
    let releases = 0;
    const pacer = createDeckTickPacer({tick: () => undefined, nextFrame: f.nextFrame});
    pacer.whenDrained(() => releases++);
    expect(releases).to.eq(1);
    pacer.owe();
    pacer.whenDrained(() => releases++);
    f.frame();
    f.frame();
    expect(releases).to.eq(2);
  });

  it('owe(0) changes nothing', () => {
    const f = frames();
    let ticks = 0;
    const pacer = createDeckTickPacer({tick: () => ticks++, nextFrame: f.nextFrame});
    pacer.owe(0);
    expect(ticks).to.eq(0);
    expect(f.pending()).to.eq(0);
  });
});

describe('the discard stream ticks the deck through the pacer (source guard)', () => {
  const src = readFileSync(join(__dirname, '../../src/client/components/console/deckDraw/ConsoleDeckDrawLayer.vue'), 'utf8');
  const start = src.indexOf('playDiscardStream(req: DiscardStreamRequest)');
  const end = src.indexOf('endDiscardStream(eventId: number, lease: string)');
  const body = src.slice(start, end);

  it('finds the stream', () => {
    expect(start).to.be.greaterThan(0);
    expect(end).to.be.greaterThan(start);
  });

  it('a peel OWES its tick — it never writes the deck count itself', () => {
    expect(body).to.contain('createDeckTickPacer(');
    expect(body.match(/tickDeckDisplay\(\)/g)?.length, 'tickDeckDisplay is called only inside the pacer\'s own tick').to.eq(1);
    expect(body).to.match(/onDrawn: \(\) => \{[\s\S]*?owe\(beat\.index\)/);
  });

  it('nothing hands the owner «all peeled» except through the pacer\'s drain (the net catches up, it never jumps)', () => {
    const direct = body.split('\n').filter((line) => /\ballPeeled\(\)/.test(line) && !/const allPeeled/.test(line));
    expect(direct, `direct «all peeled» calls in the stream:\n${direct.join('\n')}`).to.deep.eq([]);
    expect(body).to.contain('pacer.whenDrained(allPeeled)');
  });
});
