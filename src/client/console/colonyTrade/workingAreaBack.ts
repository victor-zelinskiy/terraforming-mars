/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE WORKING AREA IS BACK when its OWN return transitions have run out — not when a wall-clock dwell says so.
 *
 * The colony stage's working area (`.con-colfocus__main`, where the track is drawn) lets go of the screen for the
 * payout (`--handing` / `--carding` → opacity 0) and comes back over a CSS transition. The trade's closing beat — the
 * track reset — may start only once it is back (`setColonyStageYielded(false)`). A fixed dwell sized from the
 * transition's durations (`WORKING_AREA_BACK_MS`) is the wrong clock on a slow frame: a composited opacity transition
 * stays PENDING until the compositor gives it a start time, so on a starved software-rendered frame the dwell ran out
 * while the area still stood at a fraction of its opacity and the white marker glided over a track nobody could see
 * (CI 2026-11-11, `console-colony-pluto-embed` — `glideOverBlankStage`; animations.md laws 7 and 9). The dwell stays
 * as the floor; this waits for the element's own transitions (pending ones included) to finish, bounded.
 */

export function workingAreaSettled(el: Element | null | undefined, ceilingMs: number): Promise<void> {
  if (el === null || el === undefined || typeof (el as Element & {getAnimations?: unknown}).getAnimations !== 'function') {
    return Promise.resolve();
  }
  const running = el.getAnimations().filter((a) => {
    const property = (a as Animation & {transitionProperty?: string}).transitionProperty;
    return property === 'opacity' || property === 'transform';
  });
  if (running.length === 0) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    let done = false;
    const end = () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve();
      }
    };
    // A cancelled transition REJECTS its `finished` — that is an ending too (the pose was re-raised or the node left).
    Promise.all(running.map((a) => a.finished.catch(() => undefined))).then(end, end);
    const timer = setTimeout(end, Math.max(0, ceilingMs));
  });
}
