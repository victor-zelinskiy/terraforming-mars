/**
 * THE PURE HALF OF THE OBSERVATION PRIMITIVES (FLAKE ZERO, 2026-11-15) — no Playwright here, so the server runner pins
 * it (`tests/console/observeCore.spec.ts`). The page halves are `settledRead.ts` (`readSettled`) and `witness.ts`
 * (`armWitness`); what they decide — «is this read settled», «did it ever happen», «in which order» — is decided here.
 */

/** The default equality of two reads: the same JSON (a read is a plain value — numbers, strings, objects of them). */
export function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * A READ IS SETTLED WHEN THE LAST `equal` READS AGREE — two reads a frame apart that return the same value. One read is
 * a sample of wherever the machine had got to (a box mid-entrance on a 300 ms software frame); the streak is what turns
 * it into a statement about rest. Returns the settled value, or `undefined` while the streak is short.
 */
export function settledValue<T>(reads: ReadonlyArray<T>, equal: number, same: (a: T, b: T) => boolean = sameJson): {value: T} | undefined {
  const need = Math.max(1, Math.floor(equal));
  if (reads.length < need) {
    return undefined;
  }
  const tail = reads.slice(reads.length - need);
  for (let i = 1; i < tail.length; i++) {
    if (!same(tail[i - 1], tail[i])) {
      return undefined;
    }
  }
  return {value: tail[tail.length - 1]};
}

/** A sample of a recording — the shape `transientRecorder.ts` keeps (its time is the PAGE's clock). */
export type ObservedSample<T> = {t: number, v: T, doc: string};

/** The first sample whose value satisfies `pred` (undefined when none did). */
export function firstWhere<T>(samples: ReadonlyArray<ObservedSample<T>>, pred: (v: T) => boolean): ObservedSample<T> | undefined {
  return samples.find((s) => pred(s.v));
}

/** The values mapped by `map`, consecutive duplicates collapsed — «what happened, in order», whatever the frame rate. */
export function sequenceOf<T, K>(values: ReadonlyArray<T>, map: (v: T) => K): Array<K> {
  const out: Array<K> = [];
  for (const v of values) {
    const k = map(v);
    if (out.length === 0 || !sameJson(out[out.length - 1], k)) {
      out.push(k);
    }
  }
  return out;
}

/**
 * Is `expected` a SUBSEQUENCE of `seen` (in order, gaps allowed)? An ORDER claim — «the plate, then the flight, then the
 * tick» — must hold for any frame rate: a slow machine skips intermediate states, it never reorders them.
 */
export function inOrder<K>(seen: ReadonlyArray<K>, expected: ReadonlyArray<K>): boolean {
  let i = 0;
  for (const k of seen) {
    if (i < expected.length && sameJson(k, expected[i])) {
      i++;
    }
  }
  return i === expected.length;
}

/** A bounded, printable trail of reads for a failure message (the last `keep`, each on its own line). */
export function readTrail<T>(reads: ReadonlyArray<T>, keep = 8): string {
  return reads.slice(-keep).map((r, i, a) => `  #${reads.length - a.length + i + 1} ${JSON.stringify(r)}`).join('\n');
}
