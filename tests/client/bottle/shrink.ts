/*
 * THE SHRINK — a walk that names a class, cut down to the steps that make it (FREEZE ZERO · B4 / B5).
 *
 * The monkey files a class with the walk that found it: sixty presses, the other seats' moves, the pauses. What the
 * class NEEDS is usually three of them — the chairmanship wedged on «A, then A again 0.9 s later», and that was found
 * by cutting the walk by hand, a bottle at a time. This is that cutting, done by the machine: delta debugging
 * (Zeller's ddmin, its «reduce to complement» half) over the list of steps, each candidate REPLAYED on a fresh
 * bottle and kept only while it still names the class.
 *
 * Generic on purpose — the judge is the caller's (`stillNames`): the monkey's steps, a test's own steps with a plant
 * among them, a recorded walk from the field.
 *
 * It finds a 1-MINIMAL list (no single step can be taken out), not the global minimum; and it shrinks WHICH steps,
 * never their pauses — a class that lives in a gap («0.9 s later») keeps its gap.
 *
 * THE TAIL GOES FIRST. A class is named at some step of the walk and everything after it is the walk going on — so
 * before the cutting, the shortest PREFIX that still names the class is found by halving (a handful of replays for
 * sixty steps; «a longer prefix names what a shorter one named» is assumed, and CHECKED: a prefix that does not
 * name the class is never kept). The cutting then works on a third of the walk.
 */

export type ShrinkResult<T> = {
  /** The steps that are left — still naming the class. */
  steps: Array<T>,
  /** How many candidates were replayed. */
  tries: number,
  /** The budget ran out before the list was 1-minimal. */
  cut: boolean,
};

/**
 * `steps` MUST name the class as given (the caller checked — a shrink of a walk that does not reproduce is a walk of
 * nothing). `stillNames(candidate)` replays the candidate from a fresh start and answers whether the class is named.
 * `budget` bounds the replays (each one is a bottle).
 */
export async function shrinkSteps<T>(steps: ReadonlyArray<T>, stillNames: (candidate: ReadonlyArray<T>) => Promise<boolean>, budget = 240): Promise<ShrinkResult<T>> {
  let current = [...steps];
  let chunks = 2;
  let tries = 0;
  // THE TAIL: the shortest prefix that names the class (lo = a length known NOT to, hi = a length known to).
  let lo = 0;
  let hi = current.length;
  while (hi - lo > 1 && tries < budget) {
    const mid = Math.floor((lo + hi) / 2);
    tries++;
    if (await stillNames(current.slice(0, mid))) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  current = current.slice(0, hi);
  while (current.length >= 2) {
    const size = Math.ceil(current.length / chunks);
    let reduced = false;
    for (let from = 0; from < current.length; from += size) {
      // The walk WITHOUT one chunk.
      const candidate = [...current.slice(0, from), ...current.slice(from + size)];
      if (candidate.length === 0) {
        continue;
      }
      if (tries >= budget) {
        return {steps: current, tries, cut: true};
      }
      tries++;
      if (await stillNames(candidate)) {
        current = candidate;
        // A chunk went: the same granularity over a shorter list (never coarser than halves).
        chunks = Math.max(chunks - 1, 2);
        reduced = true;
        break;
      }
    }
    if (!reduced) {
      if (size <= 1) {
        break; // every single step was tried and is needed: 1-minimal
      }
      chunks = Math.min(current.length, chunks * 2);
    }
  }
  return {steps: current, tries, cut: false};
}
