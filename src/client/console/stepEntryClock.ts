/*
 * A HANDOVER OF TWO ENTRIES RUNS ON ONE CLOCK — the follower's start time IS the leader's.
 *
 * The action composer hands its stage to a full-stage step (the Parliament's vote, the hand album): the hero and the
 * setup RELEASE (`con-composer-setup-release`, 200 ms) while the step RISES (`con-parl-step-in`, 240 ms), keyed on one
 * style change so both are committed together. Committed together is not STARTED together: a composited opacity
 * animation on a heavy, freshly mounted layer takes its start time from the compositor's first frame after raster, a
 * main-thread one from the frame it was resolved in — on a software renderer a frame or more apart. The release had run
 * out (its `forwards` holding 0) while the step's entry still sat at its first frame: an EMPTY STAGE between the two
 * (CI 2026-11-05, `console-martian-census` § gaps — «parl=0.02 setup=0.00»; on the box the release's start / end events
 * landed one frame before the step's). So the follower is PAUSED in the task the step is inserted in (a mutation
 * observer runs before any frame), and takes the leader's resolved `startTime` on the leader's `ready` — one clock, the
 * same progress in every sample. A leader that already finished finishes the follower; a step with no entry of its own
 * leaves the follower on its own clock (the release then runs as the stylesheet wrote it). Read-only toward the DOM: it
 * moves no element, it only re-times two animations the stylesheet created.
 */

/** The slice of a WAAPI `Animation` the clock touches (a fake in the spec). */
export type ClockAnimation = {
  readonly playState: Animation['playState'];
  readonly ready: Promise<unknown>;
  startTime: Animation['startTime'];
  pause(): void;
  play(): void;
  finish(): void;
};

/** Put the followers on the leader's clock (see the header). `alive` false → the handover was superseded: leave them. */
export function followLeaderClock(followers: ReadonlyArray<ClockAnimation>, leader: ClockAnimation | undefined, alive: () => boolean): void {
  if (followers.length === 0 || leader === undefined) {
    return;
  }
  if (leader.playState === 'finished') {
    followers.forEach((a) => a.finish());
    return;
  }
  followers.forEach((a) => a.pause());
  leader.ready.then(() => {
    if (!alive()) {
      return;
    }
    for (const a of followers) {
      if (leader.startTime === null) {
        a.play();
      } else {
        a.startTime = leader.startTime;
      }
    }
  }, () => {
    // The leader was cancelled (the step left before it rose): a follower still alive runs on its own clock.
    if (alive()) {
      followers.forEach((a) => a.play());
    }
  });
}

/** The element's own CSS animation (never its subtree's) — the step's entry. */
function entryOf(step: Element): ClockAnimation | undefined {
  if (typeof step.getAnimations !== 'function') {
    return undefined;
  }
  return step.getAnimations().find((a) => typeof (a as CSSAnimation).animationName === 'string');
}

/**
 * Bind the release to the entry of the first STEP ELEMENT that stands in one of `zones` (a teleport's anchors are text
 * nodes — an element is the step): at once when it already stands, else in the mutation observer's callback of its
 * insertion. Bounded — a step that never comes leaves the release to the stylesheet. Returns the unbinder.
 */
export function syncReleaseToStepEntry(opts: {
  zones: ReadonlyArray<Element>,
  followers: () => Array<ClockAnimation>,
  alive: () => boolean,
  maxMs: number,
}): () => void {
  let observer: MutationObserver | undefined;
  let timer: number | undefined;
  const stop = (): void => {
    observer?.disconnect();
    observer = undefined;
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
    }
  };
  const bind = (): boolean => {
    if (!opts.alive()) {
      return true;
    }
    const step = opts.zones.map((zone) => zone.firstElementChild).find((el): el is Element => el !== null);
    if (step === undefined) {
      return false;
    }
    followLeaderClock(opts.followers(), entryOf(step), opts.alive);
    return true;
  };
  if (bind() || typeof MutationObserver === 'undefined' || typeof window === 'undefined') {
    return stop;
  }
  observer = new MutationObserver(() => {
    if (bind()) {
      stop();
    }
  });
  opts.zones.forEach((zone) => observer?.observe(zone, {childList: true}));
  timer = window.setTimeout(stop, opts.maxMs);
  return stop;
}
