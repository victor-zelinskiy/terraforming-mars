/*
 * CONSOLE FINAL SCORING — the ceremony DIRECTOR.
 *
 * Turns the pure beat script into ONE paused GSAP timeline whose calls
 * advance the module-reactive ceremony state; the template's CSS transitions
 * (transform/opacity only) do the actual painting. The director owns:
 *
 *  · the count-up tweens — the ONLY per-frame work, and it deliberately goes
 *    through `hooks.onCount` into a DIRECT textContent write (never a
 *    reactive write: one number per player per frame would re-render the
 *    whole workspace 60×/s and judder every CSS transition under it).
 *    The REACTIVE `displayTotals` is written once per BEAT BOUNDARY with the
 *    precomputed running sum — the canonical settle record;
 *  · the beat cadence (every duration through consoleMotionMs — speed presets
 *    scale it, reduced motion caps every beat at its short variant); a LUMINOUS
 *    event additionally keeps the floor no pace scales (`luminousMs`, CI);
 *  · THE ONE LIGHT (CI «ФИНАЛ — ПРЕМИУМ, НЕ ДИСКОТЕКА»): it RISES with the first category, GLIDES to every next one
 *    (`onLight` 'glide' — its hotspot under the category's chip, its tone the category's), and lets go ONCE at the
 *    preRank — never a fall and a release per category;
 *  · THE IGNITION (T08): every seat's OWN medallion ignites once per category, in turn, left to right in the count's
 *    seat order (`igniteOffsets` — the times are the script's, never the DOM's), and that seat's total starts ticking
 *    on ITS ignition; a multi-sub category ignites on its first source and counts on under the same rise;
 *  · HURRY (CI — X): its OWN choreography, never `timeScale`. The rest of the count is cut at the playhead and the
 *    hurried script (`hurriedBeats`) is laid in its place — ONE pass of the light over the categories left, the totals
 *    an ODOMETER (one tween per seat to its final sum), one breath — and then the SAME tail (ranking, places, winner
 *    hold, crowning, champion) at ×1; a second hurry is a no-op by construction;
 *  · SKIP: kill everything, then `finalizeCeremony` — one atomic jump to the
 *    canonical final state, kept for the safety net and a teardown; repeated
 *    skips are no-ops by construction;
 *  · PAUSE/RESUME — the B=«Свернуть» round trip: the timeline freezes where
 *    it stands and continues from the same beat on return;
 *  · a safety net (a stalled rAF in a hidden tab must not pin the ceremony's
 *    animation hold at its 35s ceiling — the net finalizes honestly instead,
 *    and RE-ARMS while the ceremony is deliberately paused/collapsed). It is
 *    sized from the LAID timeline (`tl.duration()`), never from a capped sum:
 *    under reduced motion every window is capped on its own.
 *
 * The component contributes the DOM moments the director cannot know:
 * `onRankFlip` (measure → reorder → invert → play), `onCrown` (the podium's
 * own FLIP — the winner rises, the places step down), `onWinnerFx` (the
 * ceremonyFx wave on the winner seat), `onLight` (the one light: rise / glide /
 * sweep / release), `onIgnite` (a seat's medallion igniting) and `onCount` (the
 * total sink) — every motion is put under the director's clock (`attach`) or
 * its teardown (`addCleanup`), so a pause freezes it and a skip can never leave
 * a half-played transform.
 */
import {gsap} from 'gsap';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import type {ConsoleEndgameVm} from '@/client/console/endgame/consoleEndgameModel';
import {
  CEREMONY_MS, CeremonyBeat, ceremonyBeats, finalSums, hurriedBeats, igniteOffsets, igniteSpanMs, luminousMs,
} from '@/client/console/endgame/consoleEndgameScript';
import {consoleEndgameUi, finalizeCeremony} from '@/client/console/endgame/consoleEndgameState';

/**
 * The ONE light (CI): `rise` (it comes on with the first category), `glide` (it moves to the next category — hotspot
 * and tone, one motion), `sweep` (X — one continuous pass over `path`), `release` (it lets go, once, at the preRank).
 */
export type CeremonyLightBeat = {
  catIdx: number,
  kind: 'rise' | 'glide' | 'sweep' | 'release',
  /** The motion's length, ms (already through `consoleMotionMs`, and never under `CEREMONY_MS.minEvent`). */
  ms: number,
  /** `sweep`: the categories the light passes, in order (the last is where it rests). */
  path?: ReadonlyArray<number>,
};

/** One seat's ignition (T08): its medallion of `catIdx` lights with the value this beat brings it. */
export type CeremonyIgnition = {
  color: string,
  catIdx: number,
  /** The sub-step inside a multi-sub category, −1 for a whole category. */
  subIdx: number,
  /** The signed points this ignition brings the seat (0 = a quiet zero, no accent). */
  value: number,
  /** The rise's length, ms (already floored) — the host's soft ignition plays exactly this long. */
  ms: number,
};

export type CeremonyHooks = {
  /** Measure current row rects, flip `ranked` on, invert+play — the FLIP. */
  onRankFlip: () => void,
  /** TR69: the podium FORMS — the crowned seats rise, the rest step down (a FLIP of the seats' boxes). Fired with
   *  the winner beat, before the wave. */
  onCrown?: () => void,
  /** CI: the ONE light — rise / glide / sweep / release. Each tween is handed to `attach` so the ceremony's pause /
   *  kill reach it. Absent → no light (the count still runs). */
  onLight?: (beat: CeremonyLightBeat, attach: (tween: gsap.core.Animation) => void) => void,
  /** T08: a seat's medallion ignites (the accent is the host's; under `attach` like the light). */
  onIgnite?: (ignition: CeremonyIgnition, attach: (tween: gsap.core.Animation) => void) => void,
  /** The winner's wave (ceremonyFx) — fired once at the winner beat. */
  onWinnerFx: () => void,
  /** The live count-up sink — a DIRECT DOM write, one integer per frame. */
  onCount: (color: string, value: number) => void,
  /** The champion FIX accent (a quiet ping on each champion total) — fired
   *  once at the champion beat's fix window. Campaign finale only. */
  onChampionFx?: () => void,
};

export type CeremonyHandle = {
  /** Atomic jump to the final state. Idempotent; safe at any moment. The net / an explicit end / a teardown. */
  skip: () => void,
  /**
   * CI — X: cut the count at the playhead and lay the HURRIED script in its place (one pass of the light, the
   * odometer, one breath, then the same tail at ×1). True when it took effect; false (a no-op) once hurried, past the
   * count, or after the end.
   */
  hurry: () => boolean,
  /** Tear down without finalizing (unmount / workspace closed). */
  kill: () => void,
  /** Freeze the timeline in place (B = «Свернуть» while the count runs). */
  pause: () => void,
  /** Continue from the paused beat. */
  resume: () => void,
  /** Register extra teardown (the component's own tweens). */
  addCleanup: (fn: () => void) => void,
  /** The ONE timeline — the unit specs' seam (seek it with events on); never driven by product code. */
  readonly timeline: gsap.core.Timeline,
};

export type CeremonyOptions = {
  /** Start playing at once (the product); a spec passes false and seeks the timeline itself. */
  autoplay?: boolean,
};

export function runEndgameCeremony(vm: ConsoleEndgameVm, hooks: CeremonyHooks, options: CeremonyOptions = {}): CeremonyHandle {
  const s = consoleEndgameUi;
  const sec = (ms: number) => consoleMotionMs(ms) / 1000;
  /** A luminous event's length, ms — the motion preset applied, then the floor no pace may cut. */
  const lum = (ms: number) => luminousMs(consoleMotionMs(ms));
  // The count's seat order — the seats stand in the VM's order until the ranking FLIP (the cascade reads left to
  // right as the player sees it).
  const seats = vm.rows.map((r) => r.color);
  const finals = finalSums(vm);

  const cleanups: Array<() => void> = [];
  let done = false;

  // One proxy per player for the eased count-up. Targets are ABSOLUTE running
  // sums, precomputed while laying the beats (a relative `+=` on a negative
  // penalty is exactly the string-parse edge a scoring screen must not ride).
  const counters: Record<string, {v: number}> = {};
  const runningTargets: Record<string, number> = {};
  for (const row of vm.rows) {
    counters[row.color] = {v: 0};
    runningTargets[row.color] = 0;
    s.displayTotals[row.color] = 0;
    hooks.onCount(row.color, 0);
  }

  const tl = gsap.timeline({paused: true});

  // The host's own tweens (the light, the ignitions) — under the SAME clock as the timeline: paused, resumed and
  // killed with it. The tween's OWN onComplete is kept (its cleanup — chained, never replaced).
  const attached = new Set<gsap.core.Animation>();
  const attach = (tween: gsap.core.Animation) => {
    if (done) {
      tween.kill();
      return;
    }
    attached.add(tween);
    if (tl.paused()) {
      tween.pause();
    }
    const own = tween.eventCallback('onComplete') as ((...args: Array<unknown>) => void) | null | undefined;
    tween.eventCallback('onComplete', (...args: Array<unknown>) => {
      attached.delete(tween);
      own?.(...args);
    });
  };

  const countUp = (at: number, color: string, add: number, ms: number) => {
    if (add === 0) {
      return;
    }
    const proxy = counters[color];
    runningTargets[color] += add;
    const target = runningTargets[color];
    tl.to(proxy, {
      v: target,
      duration: sec(ms),
      ease: 'power1.out',
      onUpdate: () => {
        hooks.onCount(color, Math.round(proxy.v));
      },
    }, at);
  };

  /** The reactive settle record — ONE write per player per beat boundary. */
  const settleTotals = (at: number) => {
    const snapshot: Record<string, number> = {};
    for (const row of vm.rows) {
      snapshot[row.color] = runningTargets[row.color];
    }
    tl.call(() => {
      for (const color of Object.keys(snapshot)) {
        s.displayTotals[color] = snapshot[color];
        hooks.onCount(color, snapshot[color]);
      }
    }, [], at);
  };

  // THE ONE LIGHT: is it already up (so the next category GLIDES it) — a laying-time fact, the beats are laid in order;
  // `lightLit` is the same fact on the PLAYHEAD (a hurry lays its pass from what is really on screen).
  let lightUp = false;
  let lightLit = false;
  const light = (at: number, catIdx: number, kind: CeremonyLightBeat['kind'], ms: number, path?: ReadonlyArray<number>) => {
    const beat: CeremonyLightBeat = {catIdx, kind, ms: lum(ms), ...(path !== undefined ? {path} : {})};
    tl.call(() => {
      lightLit = kind !== 'release';
      hooks.onLight?.(beat, attach);
    }, [], at);
  };
  /** The light comes to category `catIdx`: it rises the first time, glides every time after. */
  const lightTo = (at: number, catIdx: number) => {
    if (lightUp) {
      light(at, catIdx, 'glide', CEREMONY_MS.lightGlide);
    } else {
      light(at, catIdx, 'rise', CEREMONY_MS.lightRise);
      lightUp = true;
    }
  };

  /**
   * One ignition CASCADE at `at` (the light's arrival, or the sub-step's): seat `i` ignites at its offset — once per
   * category (`ignite`), the later sources of a multi-sub category counting on under the same rise — and its count
   * starts. Returns the time the LAST seat ignites.
   */
  const cascade = (at: number, catIdx: number, subIdx: number, values: Record<string, number>, leadMs: number, staggerMs: number, countMs: (span: number) => number, ignite: boolean): number => {
    const cat = vm.categories[catIdx];
    const offsets = igniteOffsets(seats.length, consoleMotionMs(leadMs), consoleMotionMs(staggerMs)).map((ms) => ms / 1000);
    const span = igniteSpanMs(seats.length, staggerMs);
    seats.forEach((color, i) => {
      const t = at + offsets[i];
      const value = values[color] ?? 0;
      tl.call(() => {
        if (i === 0) {
          s.beatStage = 'grow';
        }
        s.seatCat = {...s.seatCat, [color]: catIdx};
        if (subIdx >= 0) {
          s.seatSub = {...s.seatSub, [color]: subIdx + 1};
          if (i === seats.length - 1) {
            s.subsOn = {...s.subsOn, [cat.key]: subIdx + 1};
          }
        }
        if (ignite) {
          hooks.onIgnite?.({color, catIdx, subIdx, value, ms: lum(CEREMONY_MS.igniteRise)}, attach);
        }
      }, [], t);
      countUp(t, color, value, countMs(span));
    });
    return at + (offsets[offsets.length - 1] ?? 0);
  };

  /** The odometer's start (the hurried pass's) — the odometer beat runs UNDER the sweep. */
  let sweepAt = 0;

  /** Lay ONE beat at `at`; returns where the next beat starts. */
  const layBeat = (beat: CeremonyBeat, at: number): number => {
    switch (beat.kind) {
    case 'enter':
      tl.call(() => {
        s.phase = 'entering';
      }, [], at);
      at += sec(beat.ms);
      tl.call(() => {
        s.phase = 'scoring';
      }, [], at);
      return at;

    case 'category': {
      const cat = vm.categories[beat.idx];
      // FOCUS — the rail spotlights the coming category, the plate slides to it, the light sets off towards it.
      tl.call(() => {
        s.catIdx = beat.idx;
        s.subIdx = -1;
        s.beatStage = 'focus';
        s.seatSub = {};
      }, [], at);
      lightTo(at, beat.idx);
      at += sec(beat.focusMs);
      tl.call(() => {
        s.beatStage = 'light';
      }, [], at);
      // IGNITE — the medallions ignite in turn as the light arrives; each seat's count starts on ITS ignition.
      const last = cascade(at, beat.idx, -1, cat.values, beat.lightMs, beat.staggerMs, () => beat.growMs * 0.8, true);
      at = last + sec(beat.growMs);
      // SETTLE — the segment locks, the value stands in the medallion; the light stays (it glides on to the next).
      tl.call(() => {
        s.beatStage = 'settle';
        s.catsSettled = beat.idx + 1;
      }, [], at);
      settleTotals(at);
      at += sec(beat.settleMs);
      // PAUSE — a breath.
      return at + sec(beat.pauseMs);
    }

    case 'subIntro':
      // The plate takes the category and the light glides to it — held through every sub-step.
      tl.call(() => {
        s.catIdx = beat.idx;
        s.subIdx = -1;
        s.beatStage = 'focus';
        s.seatSub = {};
      }, [], at);
      lightTo(at, beat.idx);
      return at + sec(beat.ms);

    case 'sub': {
      const cat = vm.categories[beat.idx];
      const sub = cat.subs[beat.sub];
      // The plate names the source; the first source ignites the seats in turn, the later ones count on at once.
      tl.call(() => {
        s.catIdx = beat.idx;
        s.subIdx = beat.sub;
      }, [], at);
      cascade(at, beat.idx, beat.sub, sub.values, 0, beat.staggerMs, (span) => Math.max(0, beat.ms - span) * 0.85, beat.sub === 0);
      return at + sec(beat.ms);
    }

    case 'subMerge': {
      const cat = vm.categories[beat.idx];
      tl.call(() => {
        s.merged = {...s.merged, [cat.key]: true};
        s.subIdx = -1;
        s.beatStage = 'settle';
        s.catsSettled = beat.idx + 1;
      }, [], at);
      settleTotals(at);
      return at + sec(beat.ms);
    }

    case 'sweep': {
      // CI — X: ONE pass over the categories left. The light glides chip to chip in one motion (`sweep`), each
      // category falls into place as the light passes it (every seat's medallion at once — one comb), the plate
      // slides after the light at the pass's own step. No ignition accents: the pass IS the light.
      sweepAt = at;
      const path: Array<number> = [];
      for (let i = beat.fromIdx; i <= beat.toIdx; i++) {
        path.push(i);
      }
      const stepSec = sec(beat.stepMs);
      tl.call(() => {
        s.phase = 'scoring';
        s.sweepStepMs = consoleMotionMs(beat.stepMs);
      }, [], at);
      light(at, beat.toIdx, lightUp ? 'sweep' : 'rise', beat.ms, path);
      lightUp = true;
      path.forEach((idx, i) => {
        const cat = vm.categories[idx];
        const t = at + i * stepSec;
        tl.call(() => {
          s.catIdx = idx;
          s.subIdx = -1;
          s.beatStage = 'grow';
          const lit: Record<string, number> = {};
          const subs: Record<string, number> = {};
          for (const color of seats) {
            lit[color] = idx;
            subs[color] = cat.subs.length;
          }
          s.seatCat = lit;
          s.seatSub = subs;
          s.subsOn = {...s.subsOn, [cat.key]: cat.subs.length};
          s.merged = {...s.merged, [cat.key]: true};
          // The category before this one is passed — it stands settled.
          s.catsSettled = Math.max(s.catsSettled, idx);
        }, [], t);
      });
      at += sec(beat.ms);
      tl.call(() => {
        s.beatStage = 'settle';
        s.catsSettled = vm.categories.length;
        s.sweepStepMs = 0;
      }, [], at);
      return at;
    }

    case 'odometer':
      // CI — X: every seat's total runs ONCE from where it stands to its final sum (one ease, never a step per
      // category).
      if (s.hurry !== 'off') {
        for (const color of seats) {
          const proxy = counters[color];
          runningTargets[color] = finals[color];
          tl.to(proxy, {
            v: finals[color],
            duration: sec(beat.ms),
            ease: 'power2.out',
            onUpdate: () => {
              hooks.onCount(color, Math.round(proxy.v));
            },
          }, sweepAt);
        }
        settleTotals(sweepAt + sec(beat.ms));
      }
      return at;

    case 'preRank':
      tl.call(() => {
        s.phase = 'settling';
        s.catIdx = -1;
        s.beatStage = '';
        s.seatCat = {};
        s.seatSub = {};
        if (s.hurry === 'on') {
          // The hurried pass is over: the breath, the ranking and the crowning are the natural ones, at ×1.
          s.hurry = 'returned';
        }
      }, [], at);
      if (lightUp) {
        light(at, vm.categories.length - 1, 'release', CEREMONY_MS.lightRelease);
      }
      return at + sec(beat.ms);

    case 'ranking':
      tl.call(() => {
        s.phase = 'ranking';
        hooks.onRankFlip();
      }, [], at);
      at += sec(beat.ms);
      tl.call(() => {
        s.placesShown = true;
      }, [], at);
      return at + sec(beat.placesMs);

    case 'tiebreak':
      tl.call(() => {
        s.phase = 'tiebreak';
        s.tieStage = 0;
      }, [], at);
      at += sec(beat.announceMs);
      tl.call(() => {
        s.tieStage = 1;
      }, [], at);
      at += sec(beat.valuesMs);
      tl.call(() => {
        s.tieStage = 2;
      }, [], at);
      return at + sec(beat.resolveMs);

    case 'winnerHold':
      // The quiet hold between the settled ranking and the crowning —
      // deliberately empty: stillness is what makes the next beat an event.
      return at + sec(beat.ms);

    case 'winner':
      tl.call(() => {
        s.phase = 'winner';
        // The podium FORMS with the crowning (the seats measured before the class lands, played after it).
        hooks.onCrown?.();
        s.winnerShown = true;
        hooks.onWinnerFx();
      }, [], at);
      return at + sec(beat.ms);

    case 'champion':
      // The MANDATORY campaign-champion ceremony (final mission only). One
      // beat, five windows — each advances a reactive stage the template's
      // CSS narrates. Entering the phase is what locks the pad (the
      // workspace absorbs every press while `phase === 'champion'`) and what
      // separates the count from the crowning (the root's phase class dims
      // the surroundings). The PAUSE window deliberately changes nothing
      // else: the result stands fixed, still, before the campaign speaks.
      tl.call(() => {
        s.phase = 'champion';
        s.championStage = 0;
      }, [], at);
      at += sec(beat.pauseMs);
      tl.call(() => {
        s.championStage = 1; // seal — «ИТОГИ ПАРТИИ» → «КАМПАНИЯ ЗАВЕРШЕНА»
      }, [], at);
      at += sec(beat.sealMs);
      tl.call(() => {
        s.championStage = 2; // sweep — light runs the champion row's frame
      }, [], at);
      at += sec(beat.sweepMs);
      tl.call(() => {
        s.championStage = 3; // plate — «ПОБЕДИТЕЛЬ» → «ЧЕМПИОН КАМПАНИИ»
      }, [], at);
      at += sec(beat.plateMs);
      tl.call(() => {
        s.championStage = 4; // fix — the final VP total's fixation accent
        hooks.onChampionFx?.();
      }, [], at);
      at += sec(beat.fixMs);
      // The reading hold — deliberately empty stillness before the actions.
      return at + sec(beat.holdMs);

    case 'actions':
      tl.call(() => {
        s.phase = 'actions';
        s.actionsOn = true;
        s.ceremonyPlayed = true;
        // The natural ending and the skip land on the SAME canonical state —
        // finalize re-asserts every terminal value (idempotent), so a drifted
        // count-up rounding or an interrupted tween can never leave a lane
        // one point off the authoritative total.
        finalizeCeremony(vm);
      }, [], at);
      return at + sec(beat.ms);
    }
  };

  // ── lay the natural beats onto the timeline ──────────────────────────────
  let at = 0;
  for (const beat of ceremonyBeats(vm)) {
    at = layBeat(beat, at);
  }

  // Safety net: a hidden tab starves rAF and freezes the timeline mid-flight;
  // the ceremony's animation hold would then sit until its 35s ceiling. The
  // net finalizes honestly instead — but a PAUSED (collapsed) ceremony is the
  // player's own deliberate state, so the net re-arms and waits it out. Sized
  // from the LAID timeline: a capped sum (reduced motion caps the WHOLE total
  // at one window) once cut the ceremony short.
  const netDelay = tl.duration() * 1000 * 1.6 + 2500;
  let safety = 0;
  const armSafety = () => {
    safety = window.setTimeout(() => {
      if (done || consoleEndgameUi.phase === 'actions') {
        return;
      }
      if (tl.paused()) {
        armSafety();
        return;
      }
      skip();
    }, netDelay);
  };
  armSafety();

  const teardown = () => {
    if (done) {
      return;
    }
    done = true;
    window.clearTimeout(safety);
    tl.kill();
    for (const tween of attached) {
      tween.kill();
    }
    attached.clear();
    for (const fn of cleanups.splice(0)) {
      try {
        fn();
      } catch { /* teardown must never throw over another teardown */ }
    }
  };

  const skip = () => {
    if (consoleEndgameUi.phase === 'actions' && done) {
      return;
    }
    teardown();
    finalizeCeremony(vm);
  };

  const hurry = (): boolean => {
    if (done || s.hurry !== 'off') {
      return false;
    }
    const p = s.phase;
    if (p !== 'idle' && p !== 'entering' && p !== 'scoring') {
      return false;
    }
    // From the category the count stands in (still unsettled), else the next one.
    const from = s.catIdx >= 0 && s.catsSettled <= s.catIdx ? s.catIdx : s.catsSettled;
    const beats = hurriedBeats(vm, from);
    if (beats.length === 0) {
      return false;
    }
    // CUT the rest of the count at the playhead: every beat not yet played and every count-up still running (its
    // proxy keeps the value it stands at — the odometer runs on from there). What the player already saw stays.
    const now = tl.time();
    for (const child of tl.getChildren(false, true, true)) {
      if (child.startTime() + child.totalDuration() > now + 1e-6) {
        child.kill();
      }
    }
    // The running totals the odometer counts on from: what each seat shows NOW.
    for (const color of seats) {
      runningTargets[color] = Math.round(counters[color].v);
    }
    s.hurry = 'on';
    lightUp = lightLit;
    let next = now;
    for (const beat of beats) {
      next = layBeat(beat, next);
    }
    return true;
  };

  if (options.autoplay !== false) {
    tl.play(0);
  }

  return {
    skip,
    hurry,
    kill: teardown,
    pause: () => {
      if (!done) {
        tl.pause();
        for (const tween of attached) {
          tween.pause();
        }
      }
    },
    resume: () => {
      if (!done && consoleEndgameUi.phase !== 'actions') {
        tl.resume();
        for (const tween of attached) {
          tween.resume();
        }
      }
    },
    addCleanup: (fn) => {
      cleanups.push(fn);
    },
    timeline: tl,
  };
}
