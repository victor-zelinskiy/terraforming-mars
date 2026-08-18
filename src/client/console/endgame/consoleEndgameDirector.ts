/*
 * CONSOLE FINAL SCORING — the ceremony DIRECTOR.
 *
 * Turns the pure beat script into ONE paused GSAP timeline whose calls
 * advance the module-reactive ceremony state; the template's CSS transitions
 * (transform/opacity only) do the actual painting. The director owns:
 *
 *  · the count-up tweens (the ONLY per-frame JS work — one eased number per
 *    player per beat, snapped to integers);
 *  · the beat cadence (every duration through consoleMotionMs — speed presets
 *    scale it, reduced motion caps every beat at its short variant);
 *  · SKIP: kill everything, then `finalizeCeremony` — one atomic jump to the
 *    canonical final state; repeated skips are no-ops by construction;
 *  · a safety net (a stalled rAF in a hidden tab must not pin the ceremony's
 *    animation hold at its 35s ceiling — the net finalizes honestly instead).
 *
 * The component contributes two DOM moments the director cannot know:
 * `onRankFlip` (measure → reorder → invert → play) and `onWinnerFx` (the
 * ceremonyFx burst on the winner row) — both register their teardown via
 * `addCleanup`, so a skip can never leave a half-played FLIP transform.
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
};

export type CeremonyHandle = {
  /** Atomic jump to the final state. Idempotent; safe at any moment. */
  skip: () => void,
  /** Tear down without finalizing (unmount / workspace closed). */
  kill: () => void,
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

  // One proxy per player for the eased count-up; the reactive write happens in
  // onUpdate so Vue renders exactly one integer change per frame per player.
  // Targets are ABSOLUTE running sums (a relative `+=` on a negative penalty
  // is exactly the kind of string-parse edge a scoring screen must not ride).
  const counters: Record<string, {v: number}> = {};
  const runningTargets: Record<string, number> = {};
  for (const row of vm.rows) {
    counters[row.color] = {v: 0};
    runningTargets[row.color] = 0;
    s.displayTotals[row.color] = 0;
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
        s.displayTotals[color] = Math.round(proxy.v);
      },
    }, at);
  };

  const popChips = (at: number, values: Record<string, number>) => {
    tl.call(() => {
      const next: Record<string, {value: number, seq: number} | undefined> = {};
      for (const row of vm.rows) {
        const v = values[row.color] ?? 0;
        // A zero is not an award — no chip, no fake celebration. The value
        // strip still states the honest 0 at the category settle.
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
      tl.call(() => {
        s.catIdx = beat.idx;
        s.subIdx = -1;
      }, [], at);
      popChips(at + sec(60), cat.values);
      for (const row of vm.rows) {
        countUp(at + sec(120), row.color, cat.values[row.color] ?? 0, beat.ms * 0.8);
      }
      at += sec(beat.ms);
      tl.call(() => {
        s.catsSettled = beat.idx + 1;
      }, [], at);
      clearChips(at + sec(beat.holdMs * 0.7));
      at += sec(beat.holdMs);
      break;
    }

    case 'subIntro': {
      tl.call(() => {
        s.catIdx = beat.idx;
        s.subIdx = -1;
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
        s.subsOn = {...s.subsOn, [cat.key]: beat.sub + 1};
      }, [], at);
      popChips(at + sec(40), sub.values);
      for (const row of vm.rows) {
        countUp(at + sec(80), row.color, sub.values[row.color] ?? 0, beat.ms * 0.75);
      }
      at += sec(beat.ms);
      break;
    }

    case 'subMerge': {
      const cat = vm.categories[beat.idx];
      tl.call(() => {
        s.merged = {...s.merged, [cat.key]: true};
        s.subIdx = -1;
        s.catsSettled = beat.idx + 1;
      }, [], at);
      clearChips(at + sec(beat.ms * 0.5));
      at += sec(beat.ms);
      break;
    }

    case 'preRank':
      tl.call(() => {
        s.phase = 'settling';
        s.catIdx = -1;
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

    case 'winner':
      tl.call(() => {
        s.phase = 'winner';
        s.winnerShown = true;
        hooks.onWinnerFx();
      }, [], at);
      at += sec(beat.ms);
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
  // net finalizes honestly instead. (The finalize IS reactive state — the
  // hold releases through its own supplier, never through this timer.)
  const totalMs = consoleMotionMs(ceremonyTotalMs(beats));
  const safety = window.setTimeout(() => {
    if (!done && consoleEndgameUi.phase !== 'actions') {
      skip();
    }
  }, totalMs * 1.6 + 2500);

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
    addCleanup: (fn) => {
      cleanups.push(fn);
    },
  };
}
