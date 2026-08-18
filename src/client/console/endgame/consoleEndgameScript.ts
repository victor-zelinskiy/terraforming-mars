/*
 * CONSOLE FINAL SCORING — the pure ceremony SCRIPT.
 *
 * The choreography as data: an ordered list of beats with base durations,
 * derived from the VM alone. The director turns it into ONE GSAP timeline
 * (every duration through motionMs / the reduced-motion cap); tests assert
 * the structure (order, what plays, what is skipped) without any DOM.
 *
 * Rhythm rules encoded here (the whole point of the ceremony):
 *  · a category is ONE beat (~0.9s), never a per-point tick — a +72 and a +3
 *    cost the same time;
 *  · TR and Cards run their sub-steps as a QUICK inner cadence (~0.43s each),
 *    then MERGE back into one calm segment;
 *  · sub-steps that are zero for everyone never exist (dropped by the VM) —
 *    absent expansions cost zero seconds;
 *  · the ranking never starts the same instant the last number lands —
 *    a breath first (preRank), then the FLIP, then the winner.
 */
import type {ConsoleEndgameVm} from '@/client/console/endgame/consoleEndgameModel';

/** Base durations (ms, pre-motionMs). Tuned by eye at standard speed. */
export const CEREMONY_MS = {
  /** Rows stagger in; bars still empty. */
  enter: 720,
  /** A single-beat category: bar growth + count-up… */
  categoryGrow: 640,
  /** …and its settle read before the focus moves on. */
  categoryHold: 300,
  /** Caption hands over to a multi-sub category before its first sub. */
  subIntro: 240,
  /** One inner source (a TR row / a card family) — all players at once. */
  sub: 440,
  /** The seams fade; the category reads as one segment again. */
  subMerge: 430,
  /** The quiet breath after the last category, before anything moves. */
  preRank: 700,
  /** The FLIP into final order. */
  rankFlip: 780,
  /** Place numerals fade in after the rows land. */
  placesIn: 320,
  /** Tie-break: announce the tie → show the M€ values → resolve. */
  tieAnnounce: 760,
  tieValues: 820,
  tieResolve: 460,
  /** The winner beat (plate + burst) before the actions arrive. */
  winner: 1550,
  /** The action list materializes. */
  actionsIn: 300,
} as const;

export type CeremonyBeat =
  | {kind: 'enter', ms: number}
  | {kind: 'category', idx: number, ms: number, holdMs: number}
  | {kind: 'subIntro', idx: number, ms: number}
  | {kind: 'sub', idx: number, sub: number, ms: number}
  | {kind: 'subMerge', idx: number, ms: number}
  | {kind: 'preRank', ms: number}
  | {kind: 'ranking', ms: number, placesMs: number}
  | {kind: 'tiebreak', announceMs: number, valuesMs: number, resolveMs: number}
  | {kind: 'winner', ms: number}
  | {kind: 'actions', ms: number};

/** The full beat list for this game's VM — the director plays it verbatim. */
export function ceremonyBeats(vm: ConsoleEndgameVm): Array<CeremonyBeat> {
  const beats: Array<CeremonyBeat> = [{kind: 'enter', ms: CEREMONY_MS.enter}];
  vm.categories.forEach((cat, idx) => {
    if (cat.subs.length > 1) {
      beats.push({kind: 'subIntro', idx, ms: CEREMONY_MS.subIntro});
      cat.subs.forEach((_, sub) => {
        beats.push({kind: 'sub', idx, sub, ms: CEREMONY_MS.sub});
      });
      beats.push({kind: 'subMerge', idx, ms: CEREMONY_MS.subMerge});
    } else {
      beats.push({kind: 'category', idx, ms: CEREMONY_MS.categoryGrow, holdMs: CEREMONY_MS.categoryHold});
    }
  });
  beats.push({kind: 'preRank', ms: CEREMONY_MS.preRank});
  beats.push({kind: 'ranking', ms: CEREMONY_MS.rankFlip, placesMs: CEREMONY_MS.placesIn});
  if (vm.tieBreak !== undefined) {
    beats.push({kind: 'tiebreak', announceMs: CEREMONY_MS.tieAnnounce, valuesMs: CEREMONY_MS.tieValues, resolveMs: CEREMONY_MS.tieResolve});
  }
  beats.push({kind: 'winner', ms: CEREMONY_MS.winner});
  beats.push({kind: 'actions', ms: CEREMONY_MS.actionsIn});
  return beats;
}

/** Total base length (pre-motionMs) — a sanity bound for tests: the ceremony
 *  must stay a compact act, not a screensaver. */
export function ceremonyTotalMs(beats: ReadonlyArray<CeremonyBeat>): number {
  let total = 0;
  for (const b of beats) {
    switch (b.kind) {
    case 'category': total += b.ms + b.holdMs; break;
    case 'ranking': total += b.ms + b.placesMs; break;
    case 'tiebreak': total += b.announceMs + b.valuesMs + b.resolveMs; break;
    default: total += b.ms;
    }
  }
  return total;
}
