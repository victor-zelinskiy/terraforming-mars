import type {Page} from '@playwright/test';
import {expect} from './consoleTest';
import {firstWhere, inOrder, ObservedSample, sequenceOf} from './observeCore';
import {readTransient, recordTransient, stopTransient} from './transientRecorder';

/**
 * ⭐ A WITNESS IS A RECORDING WITH QUESTIONS — the e2e flake architecture, CLASSES B · J · K (FLAKE ZERO, 2026-11-15).
 *
 * A spec that must know whether something SHORT happened (a pose, a puff, a plate, a tick, an order of three beats)
 * arms a witness BEFORE the press and asks it after. Under the hood it is `recordTransient` — the product's own writes
 * observed in the task that makes them (MutationObserver + a frame tick), every change pushed to the Node side at once,
 * re-installed in every new document of the page (a reload by the product neither loses the record nor stops it) — so a
 * starved renderer can slow a transient but never hide it, and no spec keeps a `setInterval` sampler of its own.
 *
 *   const plate = await armWitness(page, 'plate', () => document.querySelector('.con-mandatory') !== null);
 *   … the press …
 *   expect(await plate.ever((up) => up), 'the plate never stood').toBe(true);
 *
 * The reader runs IN THE PAGE and must be self-contained (serialized — pass values through `opts.args`); it returns a
 * plain JSON value — an OBSERVATION, never a counter of its own calls (a count of samples is a count of frames, i.e. a
 * statement about the machine). Element identity across samples: keep a `WeakMap` on `window` inside the reader.
 * A coexistence / order claim («never two at once», «the old one gone before the new one stands») arms `settled: true`.
 */
export type Witness<T> = {
  readonly key: string,
  /** Every distinct value with the page's time and its document — across reloads. */
  samples(): Promise<Array<ObservedSample<T>>>,
  /** Every distinct value, in order. */
  values(): Promise<Array<T>>,
  /** The last value the product wrote (undefined before the first sample). */
  last(): Promise<T | undefined>,
  /** Did any recorded value satisfy `pred`? — «did it ever happen». */
  ever(pred: (v: T) => boolean): Promise<boolean>,
  /** The first recorded sample satisfying `pred`. */
  firstWhere(pred: (v: T) => boolean): Promise<ObservedSample<T> | undefined>,
  /** The values mapped, consecutive duplicates collapsed — «what happened, in order». */
  sequence<K>(map: (v: T) => K): Promise<Array<K>>,
  /** Is `expected` a subsequence of the mapped sequence — an ORDER claim that holds at any frame rate. */
  happenedInOrder<K>(map: (v: T) => K, expected: ReadonlyArray<K>): Promise<boolean>,
  /** Wait until some recorded value satisfies `pred` (returns at once when one already did); throws with `message`. */
  waitFor(pred: (v: T) => boolean, opts?: {timeoutMs?: number, message?: string}): Promise<ObservedSample<T>>,
  /** Stop recording; returns what was recorded. */
  stop(): Promise<Array<ObservedSample<T>>>,
};

export type WitnessOptions<A> = {
  args?: A,
  /** Sample the state a task LEAVES (after its microtasks) — for a coexistence / order claim. */
  settled?: boolean,
  /** The kept samples (default 4000 — oldest dropped). */
  max?: number,
  /** Also sample once per animation frame (default true — a CSS transition moves no DOM). */
  rafTick?: boolean,
  /** A TIMER tick too (ms) — a TIMING witness only, to tell a still screen from a stalled main thread. */
  tickMs?: number,
};

/**
 * The PAGE's clock now — the clock a witness stamps its samples with (`t`). A duration a spec asserts runs between two
 * readings of THIS clock (a reading taken before the action, a sample's `t` after it), never the driver's `Date.now()`:
 * the driver's clock adds its own protocol round-trips and a starved worker's stalls to what the product did.
 */
export async function pageNow(page: Page): Promise<number> {
  return page.evaluate(() => Date.now());
}

export async function armWitness<T, A = null>(page: Page, key: string, reader: (args: A) => T, opts: WitnessOptions<A> = {}): Promise<Witness<T>> {
  await recordTransient<A, T>(page, key, reader, {args: opts.args, settled: opts.settled, max: opts.max, rafTick: opts.rafTick, tickMs: opts.tickMs});
  return witnessOf<T>(page, key);
}

/** The questions over a recording armed elsewhere (`recordTransient(page, key, …)`). */
export function witnessOf<T>(page: Page, key: string): Witness<T> {
  const samples = () => readTransient<T>(page, key);
  const values = async () => (await samples()).map((s) => s.v);
  const w: Witness<T> = {
    key,
    samples,
    values,
    last: async () => (await samples()).at(-1)?.v,
    ever: async (pred) => firstWhere(await samples(), pred) !== undefined,
    firstWhere: async (pred) => firstWhere(await samples(), pred),
    sequence: async (map) => sequenceOf(await values(), map),
    happenedInOrder: async (map, expected) => inOrder(sequenceOf(await values(), map), expected),
    waitFor: async (pred, o = {}) => {
      await expect.poll(async () => firstWhere(await samples(), pred) !== undefined, {
        timeout: o.timeoutMs ?? 30_000,
        message: o.message ?? `witness «${key}» never recorded the awaited value`,
      }).toBe(true);
      return firstWhere(await samples(), pred) as ObservedSample<T>;
    },
    stop: () => stopTransient<T>(page, key),
  };
  return w;
}
