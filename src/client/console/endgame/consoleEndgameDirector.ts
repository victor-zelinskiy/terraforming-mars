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
 *  · SKIP: kill everything, then `finalizeCeremony` — one atomic jump to the
 *    canonical final state; repeated skips are no-ops by construction;
 *  · PAUSE/RESUME — the B=«Свернуть» round trip: the timeline freezes where
 *    it stands and continues from the same beat on return;
 *  · a safety net (a stalled rAF in a hidden tab must not pin the ceremony's
 *    animation hold at its 35s ceiling — the net finalizes honestly instead,
 *    and RE-ARMS while the ceremony is deliberately paused/collapsed).
 *
 * The component contributes the DOM moments the director cannot know:
 * `onRankFlip` (measure → reorder → invert → play), `onWinnerFx` (the
 * ceremonyFx burst on the winner row) and `onCount` (the total sink) — the
 * first two register their teardown via `addCleanup`, so a skip can never
 * leave a half-played FLIP transform.
 */
import {gsap} from 'gsap';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import type {ConsoleEndgameVm} from '@/client/console/endgame/consoleEndgameModel';
import {ceremonyBeats, ceremonyTotalMs} from '@/client/console/endgame/consoleEndgameScript';
import {consoleEndgameUi, finalizeCeremony} from '@/client/console/endgame/consoleEndgameState';

export type CeremonyHooks = {
  /** Measure current row rects, flip `ranked` on, invert+play — the FLIP. */
  onRankFlip: () => void,
  /** The winner burst (ceremonyFx) — fired once at the winner beat. */
  onWinnerFx: () => void,
  /** The live count-up sink — a DIRECT DOM write, one integer per frame. */
  onCount: (color: string, value: number) => void,
  /** The champion FIX accent (a quiet ping on each champion total) — fired
   *  once at the champion beat's fix window. Campaign finale only. */
  onChampionFx?: () => void,
};

export type CeremonyHandle = {
  /** Atomic jump to the final state. Idempotent; safe at any moment. */
  skip: () => void,
  /** Tear down without finalizing (unmount / workspace closed). */
  kill: () => void,
  /** Freeze the timeline in place (B = «Свернуть» while the count runs). */
  pause: () => void,
  /** Continue from the paused beat. */
  resume: () => void,
  /** Register extra teardown (the component's own tweens). */
  addCleanup: (fn: () => void) => void,
};

export function runEndgameCeremony(vm: ConsoleEndgameVm, hooks: CeremonyHooks): CeremonyHandle {
  const s = consoleEndgameUi;
  const beats = ceremonyBeats(vm);
  const sec = (ms: number) => consoleMotionMs(ms) / 1000;

  const cleanups: Array<() => void> = [];
  let done = false;
  let chipSeq = 0;

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

  const popChips = (at: number, values: Record<string, number>) => {
    tl.call(() => {
      const next: Record<string, {value: number, seq: number} | undefined> = {};
      for (const row of vm.rows) {
        const v = values[row.color] ?? 0;
        // A zero is not an award — no chip, no fake celebration. The value
        // rail still states the honest 0 at the category settle.
        next[row.color] = v !== 0 ? {value: v, seq: ++chipSeq} : undefined;
      }
      s.chips = next;
    }, [], at);
  };

  const clearChips = (at: number) => {
    tl.call(() => {
      s.chips = {};
    }, [], at);
  };

  // ── lay the beats onto the timeline ──────────────────────────────────────
  let at = 0;
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
      // FOCUS — the rail spotlights the coming category; nothing moves yet.
      tl.call(() => {
        s.catIdx = beat.idx;
        s.subIdx = -1;
        s.beatStage = 'focus';
      }, [], at);
      at += sec(beat.focusMs);
      // GROW — bars and counts move together, the «+N» chip rides the edge.
      tl.call(() => {
        s.beatStage = 'grow';
      }, [], at);
      popChips(at, cat.values);
      for (const row of vm.rows) {
        countUp(at + sec(60), row.color, cat.values[row.color] ?? 0, beat.growMs * 0.85);
      }
      at += sec(beat.growMs);
      // SETTLE — the segment locks, the exact value lands under it.
      tl.call(() => {
        s.beatStage = 'settle';
        s.catsSettled = beat.idx + 1;
      }, [], at);
      settleTotals(at);
      at += sec(beat.settleMs);
      // PAUSE — a breath; the chip lets go mid-way.
      clearChips(at + sec(beat.pauseMs * 0.45));
      at += sec(beat.pauseMs);
      break;
    }

    case 'subIntro': {
      tl.call(() => {
        s.catIdx = beat.idx;
        s.subIdx = -1;
        s.beatStage = 'focus';
      }, [], at);
      at += sec(beat.ms);
      break;
    }

    case 'sub': {
      const cat = vm.categories[beat.idx];
      const sub = cat.subs[beat.sub];
      tl.call(() => {
        s.catIdx = beat.idx;
        s.subIdx = beat.sub;
        s.beatStage = 'grow';
        s.subsOn = {...s.subsOn, [cat.key]: beat.sub + 1};
      }, [], at);
      popChips(at + sec(30), sub.values);
      for (const row of vm.rows) {
        countUp(at + sec(60), row.color, sub.values[row.color] ?? 0, beat.ms * 0.8);
      }
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
      clearChips(at + sec(beat.ms * 0.5));
      at += sec(beat.ms);
      break;
    }

    case 'preRank':
      tl.call(() => {
        s.phase = 'settling';
        s.catIdx = -1;
        s.beatStage = '';
        s.chips = {};
      }, [], at);
      at += sec(beat.ms);
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
  // player's own deliberate state, so the net re-arms and waits it out.
  const totalMs = consoleMotionMs(ceremonyTotalMs(beats));
  const netDelay = totalMs * 1.6 + 2500;
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

  tl.play(0);

  return {
    skip,
    kill: teardown,
    pause: () => {
      if (!done) {
        tl.pause();
      }
    },
    resume: () => {
      if (!done && consoleEndgameUi.phase !== 'actions') {
        tl.resume();
      }
    },
    addCleanup: (fn) => {
      cleanups.push(fn);
    },
  };
}
