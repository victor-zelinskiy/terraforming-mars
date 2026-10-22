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
 *    scale it, reduced motion caps every beat at its short variant);
 *  · THE IGNITION (T08 «СЧЁТ ПРИХОДИТ СВЕТОМ»): a category's light falls from
 *    its plate (`onLight`), then every seat's OWN medallion ignites in turn,
 *    left to right in the count's seat order (`igniteOffsets` — the times are
 *    the script's, never the DOM's), and that seat's total starts ticking on
 *    ITS ignition; a zero ignites too (a quiet «0», no celebration);
 *  · HURRY (T08 — X): the timeline and every attached tween play at
 *    `HURRY_SCALE` until the preRank's breath, where the pace RETURNS to ×1 —
 *    the ranking FLIP, the places, the winner hold and the crowning always
 *    play at the full pace; a second hurry is a no-op by construction;
 *  · SKIP: kill everything, then `finalizeCeremony` — one atomic jump to the
 *    canonical final state, kept for reduced motion, the safety net and a
 *    teardown; repeated skips are no-ops by construction;
 *  · PAUSE/RESUME — the B=«Свернуть» round trip: the timeline freezes where
 *    it stands and continues from the same beat (and pace) on return;
 *  · a safety net (a stalled rAF in a hidden tab must not pin the ceremony's
 *    animation hold at its 35s ceiling — the net finalizes honestly instead,
 *    and RE-ARMS while the ceremony is deliberately paused/collapsed). It is
 *    sized from the LAID timeline (`tl.duration()`), never from a capped sum:
 *    under reduced motion every window is capped on its own.
 *
 * The component contributes the DOM moments the director cannot know:
 * `onRankFlip` (measure → reorder → invert → play), `onCrown` (the podium's
 * own FLIP — the winner rises, the places step down), `onWinnerFx` (the
 * ceremonyFx burst on the winner seat), `onLight` (the category's one light
 * falling from the plate / letting go), `onIgnite` (a seat's medallion
 * igniting) and `onCount` (the total sink) — every motion is put under the
 * director's clock (`attach`) or its teardown (`addCleanup`), so a pause
 * freezes it, a hurry scales it and a skip can never leave a half-played
 * transform.
 */
import {gsap} from 'gsap';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import type {ConsoleEndgameVm} from '@/client/console/endgame/consoleEndgameModel';
import {CEREMONY_MS, ceremonyBeats, HURRY_SCALE, igniteOffsets, igniteSpanMs} from '@/client/console/endgame/consoleEndgameScript';
import {consoleEndgameUi, finalizeCeremony} from '@/client/console/endgame/consoleEndgameState';

/** One category's light (T08): it FALLS from the plate and stays, or it lets go. */
export type CeremonyLightBeat = {
  catIdx: number,
  kind: 'fall' | 'release',
  /** The motion's length, ms (already through `consoleMotionMs`). */
  ms: number,
};

/** One seat's ignition (T08): its medallion of `catIdx` lights with the value this beat brings it. */
export type CeremonyIgnition = {
  color: string,
  catIdx: number,
  /** The sub-step inside a multi-sub category, −1 for a whole category. */
  subIdx: number,
  /** The signed points this ignition brings the seat (0 = a quiet zero, no accent). */
  value: number,
};

export type CeremonyHooks = {
  /** Measure current row rects, flip `ranked` on, invert+play — the FLIP. */
  onRankFlip: () => void,
  /** TR69: the podium FORMS — the crowned seats rise, the rest step down (a FLIP of the seats' boxes). Fired with
   *  the winner beat, before the burst. */
  onCrown?: () => void,
  /** T08: the category's ONE light — falls from its plate onto the podium, lets go at the settle. Each tween is
   *  handed to `attach` so the ceremony's pause / hurry / kill reach it. Absent → no light (the count still runs). */
  onLight?: (beat: CeremonyLightBeat, attach: (tween: gsap.core.Animation) => void) => void,
  /** T08: a seat's medallion ignites (the accent is the host's; under `attach` like the light). */
  onIgnite?: (ignition: CeremonyIgnition, attach: (tween: gsap.core.Animation) => void) => void,
  /** The winner burst (ceremonyFx) — fired once at the winner beat. */
  onWinnerFx: () => void,
  /** The live count-up sink — a DIRECT DOM write, one integer per frame. */
  onCount: (color: string, value: number) => void,
  /** The champion FIX accent (a quiet ping on each champion total) — fired
   *  once at the champion beat's fix window. Campaign finale only. */
  onChampionFx?: () => void,
};

export type CeremonyHandle = {
  /** Atomic jump to the final state. Idempotent; safe at any moment. Reduced motion / the net / an explicit end. */
  skip: () => void,
  /**
   * T08 — X: play the rest of the COUNT at `HURRY_SCALE` (the pace returns at the preRank's breath). True when it
   * took effect; false (a no-op) once hurried, past the breath, or after the end.
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
  const beats = ceremonyBeats(vm);
  const sec = (ms: number) => consoleMotionMs(ms) / 1000;
  // The count's seat order — the seats stand in the VM's order until the ranking FLIP (the cascade reads left to
  // right as the player sees it).
  const seats = vm.rows.map((r) => r.color);

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

  // The host's own tweens (the light, the ignitions) — under the SAME clock as the timeline: paused, resumed, hurried
  // and killed with it. The tween's OWN onComplete is kept (its cleanup — chained, never replaced).
  const attached = new Set<gsap.core.Animation>();
  const attach = (tween: gsap.core.Animation) => {
    if (done) {
      tween.kill();
      return;
    }
    attached.add(tween);
    tween.timeScale(tl.timeScale());
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

  const light = (at: number, catIdx: number, kind: CeremonyLightBeat['kind'], ms: number) => {
    tl.call(() => {
      hooks.onLight?.({catIdx, kind, ms: consoleMotionMs(ms)}, attach);
    }, [], at);
  };

  /**
   * One ignition CASCADE at `at` (the light's start, or the sub-step's): seat `i` ignites at its offset, its medallion
   * lights, its count starts. Returns the time the LAST seat ignites.
   */
  const cascade = (at: number, catIdx: number, subIdx: number, values: Record<string, number>, leadMs: number, staggerMs: number, countMs: (span: number) => number): number => {
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
        hooks.onIgnite?.({color, catIdx, subIdx, value}, attach);
      }, [], t);
      countUp(t, color, value, countMs(span));
    });
    return at + (offsets[offsets.length - 1] ?? 0);
  };

  // ── lay the beats onto the timeline ──────────────────────────────────────
  let at = 0;
  // The point where a hurried count returns to the full pace (the preRank's breath).
  let paceReturnAt: number | undefined;
  for (const beat of beats) {
    switch (beat.kind) {
    case 'enter':
      tl.call(() => {
        s.phase = 'entering';
      }, [], at);
      at += sec(beat.ms);
      tl.call(() => {
        s.phase = 'scoring';
      }, [], at);
      break;

    case 'category': {
      const cat = vm.categories[beat.idx];
      // FOCUS — the rail spotlights the coming category, the plate takes it; nothing on the seats moves yet.
      tl.call(() => {
        s.catIdx = beat.idx;
        s.subIdx = -1;
        s.beatStage = 'focus';
        s.seatSub = {};
      }, [], at);
      at += sec(beat.focusMs);
      // LIGHT — the category's one light falls from the plate; nothing on the seats has moved yet.
      tl.call(() => {
        s.beatStage = 'light';
      }, [], at);
      light(at, beat.idx, 'fall', beat.lightMs);
      // GROW — the medallions ignite in turn; each seat's count starts on ITS ignition.
      const last = cascade(at, beat.idx, -1, cat.values, beat.lightMs, beat.staggerMs, () => beat.growMs * 0.8);
      at = last + sec(beat.growMs);
      // SETTLE — the segment locks, the value stands in the medallion, the light lets go.
      tl.call(() => {
        s.beatStage = 'settle';
        s.catsSettled = beat.idx + 1;
      }, [], at);
      settleTotals(at);
      light(at, beat.idx, 'release', beat.settleMs);
      at += sec(beat.settleMs);
      // PAUSE — a breath.
      at += sec(beat.pauseMs);
      break;
    }

    case 'subIntro': {
      // The plate takes the category and its ONE light falls — it is held through every sub-step.
      tl.call(() => {
        s.catIdx = beat.idx;
        s.subIdx = -1;
        s.beatStage = 'focus';
        s.seatSub = {};
      }, [], at);
      light(at, beat.idx, 'fall', beat.lightMs);
      at += sec(beat.ms);
      break;
    }

    case 'sub': {
      const cat = vm.categories[beat.idx];
      const sub = cat.subs[beat.sub];
      // The plate names the source; every seat re-ignites under the held light — no light of its own.
      tl.call(() => {
        s.catIdx = beat.idx;
        s.subIdx = beat.sub;
      }, [], at);
      cascade(at, beat.idx, beat.sub, sub.values, 0, beat.staggerMs, (span) => Math.max(0, beat.ms - span) * 0.85);
      at += sec(beat.ms);
      break;
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
      light(at, beat.idx, 'release', CEREMONY_MS.lightRelease);
      at += sec(beat.ms);
      break;
    }

    case 'preRank':
      tl.call(() => {
        s.phase = 'settling';
        s.catIdx = -1;
        s.beatStage = '';
        s.seatCat = {};
        s.seatSub = {};
      }, [], at);
      at += sec(Math.max(0, beat.ms - beat.breathMs));
      // THE PACE RETURNS — whatever X did to the count, the ranking and the crowning play at ×1 from here.
      paceReturnAt = at;
      tl.call(() => {
        if (s.hurry === 'on') {
          tl.timeScale(1);
          for (const tween of attached) {
            tween.timeScale(1);
          }
          s.hurry = 'returned';
        }
      }, [], at);
      at += sec(beat.breathMs);
      break;

    case 'ranking':
      tl.call(() => {
        s.phase = 'ranking';
        hooks.onRankFlip();
      }, [], at);
      at += sec(beat.ms);
      tl.call(() => {
        s.placesShown = true;
      }, [], at);
      at += sec(beat.placesMs);
      break;

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
      at += sec(beat.resolveMs);
      break;

    case 'winnerHold':
      // The quiet hold between the settled ranking and the crowning —
      // deliberately empty: stillness is what makes the next beat an event.
      at += sec(beat.ms);
      break;

    case 'winner':
      tl.call(() => {
        s.phase = 'winner';
        // The podium FORMS with the crowning (the seats measured before the class lands, played after it).
        hooks.onCrown?.();
        s.winnerShown = true;
        hooks.onWinnerFx();
      }, [], at);
      at += sec(beat.ms);
      break;

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
      at += sec(beat.holdMs);
      break;

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
      at += sec(beat.ms);
      break;
    }
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
    if (p !== 'idle' && p !== 'entering' && p !== 'scoring' && p !== 'settling') {
      return false;
    }
    if (paceReturnAt !== undefined && tl.time() >= paceReturnAt) {
      return false;
    }
    s.hurry = 'on';
    tl.timeScale(HURRY_SCALE);
    for (const tween of attached) {
      tween.timeScale(HURRY_SCALE);
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

