/*
 * CONSOLE FINAL SCORING — the pure ceremony SCRIPT.
 *
 * The choreography as data: an ordered list of beats with base durations,
 * derived from the VM alone. The director turns it into ONE GSAP timeline
 * (every duration through motionMs / the reduced-motion cap); tests assert
 * the structure (order, what plays, what is skipped) without any DOM.
 *
 * Rhythm rules encoded here (the whole point of the ceremony):
 *  · a MAIN category is a FOUR-PART PHRASE — focus (the rail spotlights the
 *    coming category, nothing moves yet) → grow (the bars and the count move
 *    together) → settle (the exact value lands under its segment) → a breath
 *    before the next category. One reveal = one readable event.
 *  · a category is ONE beat, never a per-point tick — a +72 and a +3 cost
 *    the same time;
 *  · TR and Cards run their sub-steps as a QUICK inner cadence, then MERGE
 *    back into one calm segment (the merge is itself a visible settle);
 *  · sub-steps that are zero for everyone never exist (dropped by the VM) —
 *    absent expansions cost zero seconds;
 *  · the ranking never starts the same instant the last number lands —
 *    a breath first (preRank), then the FLIP, then places, then a second
 *    quiet hold before the winner beat (the reveal must not ride the FLIP).
 */
import type {ConsoleEndgameVm} from '@/client/console/endgame/consoleEndgameModel';

/** Base durations (ms, pre-motionMs). Tuned by eye at standard speed. */
export const CEREMONY_MS = {
  /** Rows stagger in; bars still empty. */
  enter: 640,
  /** The four-part MAIN-category phrase. */
  categoryFocus: 220,
  categoryGrow: 640,
  categorySettle: 240,
  categoryPause: 270,
  /** Caption hands over to a multi-sub category before its first sub. */
  subIntro: 300,
  /** One inner source (a TR row / a card family) — all players at once. */
  sub: 390,
  /** The seams dissolve; the category reads as ONE segment again (this is
   *  the multi-sub category's own settle + breath). */
  subMerge: 500,
  /** The quiet breath after the last category, before anything moves. */
  preRank: 720,
  /** The FLIP into final order. */
  rankFlip: 820,
  /** Place numerals fade in after the rows land. */
  placesIn: 340,
  /** The hold between the settled ranking and the winner reveal — the
   *  crowning is its own event, never the tail of the FLIP. */
  winnerHold: 480,
  /** Tie-break: announce the tie → show the M€ values → resolve. */
  tieAnnounce: 880,
  tieValues: 880,
  tieResolve: 480,
  /** The winner beat (row hero + burst) before the actions arrive. */
  winner: 1500,
  /** The action list materializes. */
  actionsIn: 360,
} as const;

export type CeremonyBeat =
  | {kind: 'enter', ms: number}
  | {kind: 'category', idx: number, focusMs: number, growMs: number, settleMs: number, pauseMs: number}
  | {kind: 'subIntro', idx: number, ms: number}
  | {kind: 'sub', idx: number, sub: number, ms: number}
  | {kind: 'subMerge', idx: number, ms: number}
  | {kind: 'preRank', ms: number}
  | {kind: 'ranking', ms: number, placesMs: number}
  | {kind: 'tiebreak', announceMs: number, valuesMs: number, resolveMs: number}
  | {kind: 'winnerHold', ms: number}
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
      beats.push({
        kind: 'category', idx,
        focusMs: CEREMONY_MS.categoryFocus,
        growMs: CEREMONY_MS.categoryGrow,
        settleMs: CEREMONY_MS.categorySettle,
        pauseMs: CEREMONY_MS.categoryPause,
      });
    }
  });
  beats.push({kind: 'preRank', ms: CEREMONY_MS.preRank});
  beats.push({kind: 'ranking', ms: CEREMONY_MS.rankFlip, placesMs: CEREMONY_MS.placesIn});
  if (vm.tieBreak !== undefined) {
    beats.push({kind: 'tiebreak', announceMs: CEREMONY_MS.tieAnnounce, valuesMs: CEREMONY_MS.tieValues, resolveMs: CEREMONY_MS.tieResolve});
  }
  beats.push({kind: 'winnerHold', ms: CEREMONY_MS.winnerHold});
  beats.push({kind: 'winner', ms: CEREMONY_MS.winner});
  beats.push({kind: 'actions', ms: CEREMONY_MS.actionsIn});
  return beats;
}

/** A beat's full length on the clock (all sub-phases included). */
export function beatLengthMs(beat: CeremonyBeat): number {
  switch (beat.kind) {
  case 'category': return beat.focusMs + beat.growMs + beat.settleMs + beat.pauseMs;
  case 'ranking': return beat.ms + beat.placesMs;
  case 'tiebreak': return beat.announceMs + beat.valuesMs + beat.resolveMs;
  default: return beat.ms;
  }
}

/** Total base length (pre-motionMs) — a sanity bound for tests: the ceremony
 *  must stay a compact act, not a screensaver. */
export function ceremonyTotalMs(beats: ReadonlyArray<CeremonyBeat>): number {
  let total = 0;
  for (const b of beats) {
    total += beatLengthMs(b);
  }
  return total;
}
