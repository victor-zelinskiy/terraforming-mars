/*
 * CONSOLE FINAL SCORING — the pure ceremony SCRIPT.
 *
 * The choreography as data: an ordered list of beats with base durations,
 * derived from the VM alone. The director turns it into ONE GSAP timeline
 * (every duration through motionMs / the reduced-motion cap); tests assert
 * the structure (order, what plays, what is skipped) without any DOM.
 *
 * THE LIGHT BUDGET (CI, the owner 2026-10-23: «мигает как на дискотеке, особенно ускоренный подсчёт») — the law every
 * beat below obeys, on ANY pace:
 *  · ONE light lives the whole count: it RISES once with the first category, GLIDES from category to category along
 *    the rail (its hotspot under the category's chip, its tone the category's — a shift, never a new switch-on), and
 *    lets go once at the preRank. Never «falls and releases» per category;
 *  · no luminous event is shorter than `CEREMONY_MS.minEvent` — a FLOOR no pace scales (`luminousMs`);
 *  · a seat's medallion ignites ONCE per category, a soft rise (≥ 400 ms, ease-out, no ring-flash) — the sub-steps of
 *    TR / Cards count on under the same rise, never re-igniting;
 *  · X is its OWN choreography (`hurriedBeats`): the categories left are ONE continuous pass of the light along the
 *    rail, the totals an ODOMETER (one tween per seat to its final sum), the segments one fill, the head's cell following
 *    the light — never `timeScale` of the natural script. The ranking, the places, the winner hold, the crowning and
 *    the campaign champion are the SAME beats on both paces (`tailBeats`), always at ×1.
 *
 * Rhythm rules kept from T08 / TR69:
 *  · a MAIN category is one phrase — focus (the rail spotlights the coming category, the
 *    light glides to its chip) → ignite (the seats' OWN medallions ignite in turn, left to right; each seat's segment
 *    grows out of its medallion and its total ticks on ITS ignition) → settle (the value stands in the medallion) → a
 *    breath before the next category. One reveal = one readable event;
 *  · a category is ONE beat, never a per-point tick — a +72 and a +3 cost the same time;
 *  · sub-steps that are zero for everyone never exist (dropped by the VM) — absent expansions cost zero seconds;
 *  · the ranking never starts the same instant the last number lands — a breath first (preRank), then the FLIP, then
 *    places, then a second quiet hold before the winner beat (the reveal must not ride the FLIP).
 */
import type {ConsoleEndgameVm} from '@/client/console/endgame/consoleEndgameModel';

/** Base durations (ms, pre-motionMs). Tuned by eye at standard speed. */
export const CEREMONY_MS = {
  /** Rows stagger in; bars still empty. */
  enter: 640,
  /**
   * CI — THE FLOOR of every luminous event (the light's rise / glide / release, a medallion's ignition, the rail's
   * spotlight): no pace scales under it — `luminousMs` applies it after `motionMs`. 240 ms is where
   * a change of light stops reading as a flash and starts reading as a motion.
   */
  minEvent: 240,
  /** The MAIN-category phrase: the rail spotlights it, the light starts its glide. */
  categoryFocus: 220,
  /** The light's way to the category's chip — the first seat ignites as it arrives (its glide is `lightGlide`). */
  categoryLight: 280,
  /** The ignition cascade — each next seat (left to right) ignites this much later (the rise itself is `igniteRise`). */
  igniteStagger: 100,
  /** A seat's medallion IGNITES: a soft rise, ease-out, no attack (≥ 400 — the owner's «без кольца-вспышки»). */
  igniteRise: 420,
  categoryGrow: 440,
  categorySettle: 180,
  categoryPause: 180,
  /** The head hands over to a multi-sub category (its sources line opens) and the light glides to it before the first sub. */
  subIntro: 360,
  /** One inner source (a TR row / a card family) — the seats count on under the SAME rise, never re-igniting. */
  sub: 340,
  /** The first sub-step's cascade (the category's ONE ignition per seat). */
  subStagger: 100,
  /** The seams dissolve; the category reads as ONE segment again (the multi-sub category's own settle + breath). */
  subMerge: 400,
  /** THE ONE LIGHT: it rises with the first category… */
  lightRise: 600,
  /** …glides to every next category (hotspot under its chip, tone to its own)… */
  lightGlide: 500,
  /** …and lets go once, at the preRank — its fall longer than its rise. */
  lightRelease: 760,
  /** The quiet breath after the last category, before anything moves. */
  preRank: 720,
  /** CI — X: the categories left are ONE pass of the light along the rail, this long at the least / at the most
   *  (`hurrySweepMs` — the fewer left, the shorter, never under the floor of a readable pass). */
  hurrySweepMin: 1200,
  hurrySweepMax: 1800,
  hurrySweepBase: 450,
  hurrySweepPerCategory: 225,
  /** The odometer runs on past the light's last chip this long (the totals land after the light, never before). */
  hurryOdometerTail: 260,
  /** The hurried preRank: one breath at ×1 before the ranking. */
  hurryPreRank: 460,
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
  /** TR69: the CROWNING FLIP inside the winner beat — the winner rises to the hero, the places step down. */
  crown: 640,
  /** ── THE CAMPAIGN CHAMPION beat (final mission only) — five windows of ONE
   *  beat, ~5s total: the mission's winner reveal has landed, and the four-
   *  mission arc now closes over it. Every window is a MEANING, not a timing:
   *  pause (the result is fixed; the interface separates the count from the
   *  crowning) → seal («ИТОГИ ПАРТИИ» → «КАМПАНИЯ ЗАВЕРШЕНА») → sweep (light
   *  runs the champion row's own frame) → plate («ПОБЕДИТЕЛЬ» becomes
   *  «ЧЕМПИОН КАМПАНИИ», the mission pips light in sequence) → fix (the final
   *  VP total's one strong, restrained fixation) → hold (read the result). */
  championPause: 620,
  championSeal: 850,
  championSweep: 1000,
  championPlate: 1050,
  championFix: 700,
  championHold: 1250,
  /** The action list materializes. */
  actionsIn: 360,
} as const;

export type CeremonyBeat =
  | {kind: 'enter', ms: number}
  /** CI — X: the categories `fromIdx`…`toIdx` in ONE pass of the light (`stepMs` between two chips). */
  | {kind: 'sweep', fromIdx: number, toIdx: number, ms: number, stepMs: number}
  /** CI — X: every seat's total to its final sum in ONE tween (the odometer — never a step per category). */
  | {kind: 'odometer', ms: number}
  | {kind: 'category', idx: number, focusMs: number, lightMs: number, staggerMs: number, growMs: number, settleMs: number, pauseMs: number}
  | {kind: 'subIntro', idx: number, ms: number, lightMs: number}
  | {kind: 'sub', idx: number, sub: number, ms: number, staggerMs: number}
  | {kind: 'subMerge', idx: number, ms: number}
  | {kind: 'preRank', ms: number}
  | {kind: 'ranking', ms: number, placesMs: number}
  | {kind: 'tiebreak', announceMs: number, valuesMs: number, resolveMs: number}
  | {kind: 'winnerHold', ms: number}
  | {kind: 'winner', ms: number}
  | {kind: 'champion', pauseMs: number, sealMs: number, sweepMs: number, plateMs: number, fixMs: number, holdMs: number}
  | {kind: 'actions', ms: number};

/** The full NATURAL beat list for this game's VM — the director plays it verbatim. */
export function ceremonyBeats(vm: ConsoleEndgameVm): Array<CeremonyBeat> {
  return [...countBeats(vm), {kind: 'preRank', ms: CEREMONY_MS.preRank}, ...tailBeats(vm)];
}

/** The natural COUNT: the entrance and every category in turn (the light's rise / glides are the director's). */
export function countBeats(vm: ConsoleEndgameVm): Array<CeremonyBeat> {
  const beats: Array<CeremonyBeat> = [{kind: 'enter', ms: CEREMONY_MS.enter}];
  vm.categories.forEach((cat, idx) => {
    if (cat.subs.length > 1) {
      beats.push({kind: 'subIntro', idx, ms: CEREMONY_MS.subIntro, lightMs: CEREMONY_MS.categoryLight});
      cat.subs.forEach((_, sub) => {
        // The category's ONE cascade rides its first source; the later sources count on at once, never re-igniting.
        beats.push({kind: 'sub', idx, sub, ms: CEREMONY_MS.sub, staggerMs: sub === 0 ? CEREMONY_MS.subStagger : 0});
      });
      beats.push({kind: 'subMerge', idx, ms: CEREMONY_MS.subMerge});
    } else {
      beats.push({
        kind: 'category', idx,
        focusMs: CEREMONY_MS.categoryFocus,
        lightMs: CEREMONY_MS.categoryLight,
        staggerMs: CEREMONY_MS.igniteStagger,
        growMs: CEREMONY_MS.categoryGrow,
        settleMs: CEREMONY_MS.categorySettle,
        pauseMs: CEREMONY_MS.categoryPause,
      });
    }
  });
  return beats;
}

/**
 * The TAIL — the same beats on both paces, always at ×1: the ranking FLIP, the places, the tie-break, the winner hold,
 * the crowning, the campaign champion, the actions.
 */
export function tailBeats(vm: ConsoleEndgameVm): Array<CeremonyBeat> {
  const beats: Array<CeremonyBeat> = [];
  beats.push({kind: 'ranking', ms: CEREMONY_MS.rankFlip, placesMs: CEREMONY_MS.placesIn});
  if (vm.tieBreaks.length > 0) {
    beats.push({kind: 'tiebreak', announceMs: CEREMONY_MS.tieAnnounce, valuesMs: CEREMONY_MS.tieValues, resolveMs: CEREMONY_MS.tieResolve});
  }
  beats.push({kind: 'winnerHold', ms: CEREMONY_MS.winnerHold});
  beats.push({kind: 'winner', ms: CEREMONY_MS.winner});
  if (vm.campaignFinale !== undefined) {
    // The campaign's own finale — ONLY on the last mission, and only after
    // the full ordinary sequence (every category incl. «Титулы» settled, the
    // ranking FLIPped, the tie-break resolved, the winner revealed). The
    // endgame winner IS the campaign champion: no second ranking, ever.
    beats.push({
      kind: 'champion',
      pauseMs: CEREMONY_MS.championPause,
      sealMs: CEREMONY_MS.championSeal,
      sweepMs: CEREMONY_MS.championSweep,
      plateMs: CEREMONY_MS.championPlate,
      fixMs: CEREMONY_MS.championFix,
      holdMs: CEREMONY_MS.championHold,
    });
  }
  beats.push({kind: 'actions', ms: CEREMONY_MS.actionsIn});
  return beats;
}

/** CI — the hurried pass's length for `remaining` categories: the fewer left, the shorter; floor and ceiling hold. */
export function hurrySweepMs(remaining: number): number {
  const raw = CEREMONY_MS.hurrySweepBase + CEREMONY_MS.hurrySweepPerCategory * Math.max(0, remaining);
  return Math.min(CEREMONY_MS.hurrySweepMax, Math.max(CEREMONY_MS.hurrySweepMin, raw));
}

/**
 * CI — X: the HURRIED script from category `fromIdx` on — its OWN choreography, never the natural one sped up (the
 * owner's choice of 2026-10-23 on the live mockups, M1 over the per-category comb and the all-at-once curtain): one
 * pass of the light over the categories left (`sweep` — each category falls into place as the light passes it), the
 * odometer under it, one breath at ×1, then the SAME tail. A count already past its last category has nothing left to
 * hurry (`[]`).
 */
export function hurriedBeats(vm: ConsoleEndgameVm, fromIdx: number): Array<CeremonyBeat> {
  const last = vm.categories.length - 1;
  const from = Math.max(0, fromIdx);
  if (from > last) {
    return [];
  }
  const remaining = last - from + 1;
  const ms = hurrySweepMs(remaining);
  return [
    {kind: 'sweep', fromIdx: from, toIdx: last, ms, stepMs: Math.round(ms / remaining)},
    {kind: 'odometer', ms: ms + CEREMONY_MS.hurryOdometerTail},
    {kind: 'preRank', ms: CEREMONY_MS.hurryPreRank},
    ...tailBeats(vm),
  ];
}

/** The final sum of every seat — what the odometer lands on (the categories' own values, never a second total). */
export function finalSums(vm: ConsoleEndgameVm): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of vm.rows) {
    out[row.color] = vm.categories.reduce((sum, cat) => sum + (cat.values[row.color] ?? 0), 0);
  }
  return out;
}

/**
 * CI — a luminous event's length on the clock: the motion preset applied (`scaled` = `motionMs(base)`), then the
 * FLOOR no pace may cut (`CEREMONY_MS.minEvent`). Reduced motion draws no light at all, so it never asks.
 */
export function luminousMs(scaled: number): number {
  return Math.max(scaled, CEREMONY_MS.minEvent);
}

/**
 * T08: one ignition cascade, ms from the light's start — seat `i` (left to right, the count's own seat order) ignites
 * at `lightMs + i × staggerMs`: the light lands on the medallion row first, the rest follow in reading order. Pure —
 * the director lays exactly these times, the e2e reads the stagger back off the medallions.
 */
export function igniteOffsets(seats: number, lightMs: number, staggerMs: number): Array<number> {
  return Array.from({length: Math.max(0, seats)}, (_, i) => lightMs + i * staggerMs);
}

/** A cascade's span: from the first seat's ignition to the last one's. */
export function igniteSpanMs(seats: number, staggerMs: number): number {
  return Math.max(0, seats - 1) * staggerMs;
}

/** A beat's full length on the clock (all sub-phases included); `seats` sizes a category's ignition cascade. */
export function beatLengthMs(beat: CeremonyBeat, seats = 1): number {
  switch (beat.kind) {
  case 'category': return beat.focusMs + beat.lightMs + igniteSpanMs(seats, beat.staggerMs) + beat.growMs + beat.settleMs + beat.pauseMs;
  case 'ranking': return beat.ms + beat.placesMs;
  case 'tiebreak': return beat.announceMs + beat.valuesMs + beat.resolveMs;
  case 'champion': return beat.pauseMs + beat.sealMs + beat.sweepMs + beat.plateMs + beat.fixMs + beat.holdMs;
  // The odometer runs UNDER the sweep (it starts with it) — the sweep owns the clock.
  case 'odometer': return 0;
  default: return beat.ms;
  }
}

/** Total base length (pre-motionMs) — a sanity bound for tests: the ceremony
 *  must stay a compact act, not a screensaver. */
export function ceremonyTotalMs(beats: ReadonlyArray<CeremonyBeat>, seats = 1): number {
  let total = 0;
  for (const b of beats) {
    total += beatLengthMs(b, seats);
  }
  return total;
}
