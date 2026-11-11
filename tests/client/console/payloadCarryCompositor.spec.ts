import {expect} from 'chai';
import {playPayloadCarry, playPayloadReturn} from '@/client/console/played/payloadCarry';

/*
 * THE TARGET STEP ENTERS ON THE COMPOSITOR'S CLOCK (CI 2026-11-11, `console-smoothness` (A) — the action composer's step:
 * «cards 260→260 ms SNAPPED»). The carry is played in the flush that MOUNTS the step; a GSAP timeline created there
 * started on the tick BEFORE the mount's long task and its first painted frame was the cascade well past its start.
 * The phrase is now Web Animations: each group from opacity 0 to its own resting value, `fill: backwards` (the first
 * painted frame is the from-state), the stagger kept, nothing inline left behind; one episode per root.
 */

type AnimOptions = {duration?: number, delay?: number, easing?: string, fill?: string};
type Call = {keyframes: Array<Record<string, unknown>>, options: AnimOptions};

class FakeAnimation {
  public playState: 'running' | 'finished' | 'idle' = 'running';
  public cancelled = false;
  private settle!: () => void;
  private fail!: (e: unknown) => void;
  public readonly finished = new Promise<void>((resolve, reject) => {
    this.settle = resolve;
    this.fail = reject;
  });
  constructor() {
    this.finished.catch(() => undefined);
  }
  public finish(): void {
    this.playState = 'finished';
    this.settle();
  }
  public cancel(): void {
    this.cancelled = true;
    this.playState = 'idle';
    this.fail(new Error('cancelled'));
  }
}

function stub(el: HTMLElement, calls: Array<Call>, anims: Array<FakeAnimation>): void {
  (el as unknown as {animate: unknown}).animate = (keyframes: Array<Record<string, unknown>>, options: AnimOptions) => {
    calls.push({keyframes, options});
    const a = new FakeAnimation();
    anims.push(a);
    return a;
  };
}

function groups(root: HTMLElement, n: number): Array<HTMLElement> {
  return Array.from({length: n}, () => {
    const g = document.createElement('div');
    g.setAttribute('data-unfold-item', '');
    root.appendChild(g);
    return g;
  });
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('payloadCarry · the step enters on the compositor clock', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
  });
  afterEach(() => {
    root.remove();
  });

  it('a step with nothing to carry: every group rises from opacity 0, painted from-state first, staggered', () => {
    const calls: Array<Call> = [];
    const anims: Array<FakeAnimation> = [];
    for (const g of groups(root, 3)) {
      stub(g, calls, anims);
    }
    playPayloadCarry(root, undefined, undefined);
    expect(calls).to.have.length(3);
    for (const c of calls) {
      expect(c.keyframes[0].opacity, 'from opacity 0').to.equal(0);
      expect(c.keyframes[1].transform, 'to its own box').to.equal('none');
      expect(c.options.fill, 'the first painted frame is the from-state; nothing stays inline').to.equal('backwards');
    }
    const delays = calls.map((c) => Number(c.options.delay));
    expect(delays[0]).to.equal(0);
    expect(delays[1]).to.be.greaterThan(delays[0]);
    expect(delays[2]).to.be.greaterThan(delays[1]);
  });

  it('the return: `done` fires once, after every animation of the phrase has finished', async () => {
    const calls: Array<Call> = [];
    const anims: Array<FakeAnimation> = [];
    for (const g of groups(root, 2)) {
      stub(g, calls, anims);
    }
    let done = 0;
    playPayloadReturn(root, {left: 0, top: 0, width: 10, height: 10}, () => done++);
    expect(anims).to.have.length(2);
    anims[0].finish();
    await tick();
    expect(done, 'not before the last group').to.equal(0);
    anims[1].finish();
    await tick();
    await tick();
    expect(done).to.equal(1);
  });

  it('a new phrase on the same root cancels the old one — whose `done` still fires, once', async () => {
    const calls: Array<Call> = [];
    const anims: Array<FakeAnimation> = [];
    for (const g of groups(root, 2)) {
      stub(g, calls, anims);
    }
    let first = 0;
    playPayloadReturn(root, {left: 0, top: 0, width: 10, height: 10}, () => first++);
    const old = anims.slice();
    playPayloadReturn(root, {left: 0, top: 0, width: 10, height: 10}, () => undefined);
    expect(old.every((a) => a.cancelled), 'the old phrase is cancelled').to.equal(true);
    await tick();
    await tick();
    expect(first).to.equal(1);
  });
});
