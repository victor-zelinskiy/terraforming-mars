import type {Page} from '@playwright/test';
import {finiteMotion, settle} from './consoleStart';
import {readTrail, sameJson, settledValue} from './observeCore';

/**
 * ⭐ ONE SETTLED READ — the e2e flake architecture, CLASS C (FLAKE ZERO, 2026-11-15).
 *
 * A box, a position, an opacity read ONCE is wherever the machine had got to: on CI's software raster (a frame of
 * 300 ms) an entrance of 180 ms is still at its first keyframe when the read lands, and «the commit 18 px below its
 * sheet» is a statement about the CPU. `settle` waits for the product's facts (holds, the transport, finite motion);
 * this adds the last word — the value itself holds still: the reader runs until `equal` consecutive reads, each at
 * least one FRAME after the last, return the same value. A comparison of two measurements takes BOTH through here
 * (`tests.md` — «a comparison is only as settled as its least settled side»).
 *
 *   const box = await readSettled(page, () => rectOf(page, '.con-composer__commit'), {message: 'the commit plate'});
 *
 * The reader is a NODE-side function (it may call `page.evaluate` itself) returning a plain value; round what you will
 * compare (a subpixel that jitters is not motion). On timeout the error prints the last reads.
 */
export type ReadSettledOptions<T> = {
  /** Consecutive equal reads required (default 2). */
  equal?: number,
  /** The whole budget, `settle` excluded (default 10 s). */
  timeoutMs?: number,
  /** Run `settle(page)` first (default true) — pass false INSIDE a chain, where a blocking hold legitimately stands. */
  settle?: boolean,
  /** Equality of two reads (default: the same JSON). */
  same?: (a: T, b: T) => boolean,
  /** What is being read — named in the error. */
  message?: string,
};

/** The page half of the gap between two reads: two animation frames, or — on a still page that paints none — 100 ms of
 *  no running animation. Bounded (2 s): a page that neither paints nor stands still is a moving page, read again. */
async function nextFrame(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => {
    let done = false;
    const end = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    window.requestAnimationFrame(() => window.requestAnimationFrame(end));
    const still = () => {
      if (done) {
        return;
      }
      const moving = typeof document.getAnimations === 'function' &&
        document.getAnimations().some((a) => a.playState === 'running' || a.pending);
      if (moving) {
        window.setTimeout(still, 100);
      } else {
        end();
      }
    };
    window.setTimeout(still, 100);
    window.setTimeout(end, 2000);
  })).catch(() => undefined); // a navigating page: the next read says what stands
}

/** How long a read waits for finite motion before it stops minding it (the same budget `settle` gives motion). */
const MOTION_SOFT_MS = 5000;

export async function readSettled<T>(page: Page, read: () => Promise<T>, opts: ReadSettledOptions<T> = {}): Promise<T> {
  const equal = opts.equal ?? 2;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const same = opts.same ?? sameJson;
  if (opts.settle !== false) {
    await settle(page);
  }
  const started = Date.now();
  const deadline = started + timeoutMs;
  const reads: Array<T> = [];
  for (;;) {
    // A read taken while a FINITE motion runs — or waits for the compositor to start it (a PENDING animation holds its
    // first keyframe on the main thread, so two reads a frame apart agree on a pose that is about to move) — never
    // counts toward the streak. Softly: past MOTION_SOFT_MS the motion is ambient to this read and equality decides.
    const moving = Date.now() - started < MOTION_SOFT_MS && await finiteMotion(page) > 0;
    const value = await read();
    if (moving) {
      reads.length = 0;
    } else {
      reads.push(value);
    }
    if (reads.length > 64) {
      reads.shift();
    }
    const hit = settledValue(reads, equal, same);
    if (hit !== undefined) {
      return hit.value;
    }
    if (moving && Date.now() >= deadline) {
      reads.push(value);
    }
    if (Date.now() >= deadline) {
      throw new Error(`readSettled${opts.message === undefined ? '' : ` (${opts.message})`}: never read the same value ` +
        `${equal}× in a row within ${timeoutMs} ms — the last reads:\n${readTrail(reads)}`);
    }
    await nextFrame(page);
  }
}
