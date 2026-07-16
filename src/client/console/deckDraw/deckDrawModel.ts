/*
 * DECK-DRAW MODEL — the PURE plan of the console "cards physically come off
 * the top-bar deck" cinematic (no DOM, no GSAP — unit-tested under the server
 * runner, like cardDealModel / boardCardBonusModel).
 *
 * The story (consoleDeckDraw.ts / deckDrawDirector.ts): the project deck in
 * the top bar is the SOURCE. Two scenarios, one language:
 *
 *  plain   — "draw N": the top cards peel off one by one, stay FACE DOWN and
 *            gather in the hold zone. No verdicts, no tray.
 *  search  — "reveal until you find N matching cards" (Acquired Space Agency
 *            and friends): each card peels off, flips at the inspect point,
 *            and its SERVER verdict routes it — a discard flows on into the
 *            compact tray; a match settles into the hold zone as a hero.
 *
 * Either way the scene ENDS with the found cards standing in the hold zone;
 * the reveal modal then assembles around them (the transition is the
 * director's, staged exactly like the board card-bonus handoff).
 *
 * Everything here is BASE milliseconds — the director resolves through
 * motionMs() so the whole choreography follows the fork-wide speed presets.
 *
 * NOTE: the ORDER is never computed here. It arrives from the server
 * (CardDrawRevealModel.sequence) and is replayed verbatim.
 */

import {conUiScale} from '@/client/console/consoleLayoutProfile';

/** A plain rect (screen px) — DOMRect-compatible, test-friendly. */
export type RectLike = {left: number, top: number, width: number, height: number};

/** What the deck turned over, and what the server decided about it. */
export type DrawBeatKind = 'match' | 'discard' | 'plain';

/**
 * ONE card's beat in the scene, already resolved to concrete timings. The
 * director just plays these in order.
 */
export type DrawBeat = {
  /** Index within the server's reveal sequence (the proxy id). */
  index: number,
  kind: DrawBeatKind,
  /** Scene-relative launch time of this card's peel-off. */
  atMs: number,
  /** Deck → inspect point (a 'plain' beat flies straight to its hold slot). */
  travelMs: number,
  /** Portion of the travel spent completing the back→face flip (0 = stays down). */
  flipPortion: number,
  /** Readable hold at the inspect point before the verdict routes the card. */
  inspectMs: number,
  /** Inspect point → tray / hold slot. */
  routeMs: number,
  /** Which hold-zone slot a matched card lands in (matches only). */
  holdSlot?: number,
  /** Which tray depth a discarded card lands at (discards only). */
  trayDepth?: number,
};

export type DeckDrawTimings = {
  /** The top card separates from the stack (rise + slight grow). */
  peelMs: number,
  /** Deck → inspect point (a MATCH) or deck → tray (a discard). */
  travelMs: number,
  /** A MATCH's readable hold at the inspect point (discards never pause). */
  inspectMs: number,
  /** Inspect point → hold slot (a MATCH). */
  routeMs: number,
  /** Gap between a match leaving the inspect zone and the next card peeling. */
  gapMs: number,
  /**
   * The tight cadence of the DISCARD stream: a discard peels off every
   * `streamStepMs`, so several are in the air at once flowing to the tray.
   * The player reads the COUNT (how many cards streamed between two finds),
   * never each card — they never flip face-up, they just flow past.
   */
  streamStepMs: number,
  flipPortion: number,
  /** The final "search complete" hero beat before the reveal assembles. */
  settleMs: number,
  /** The reveal frame materializes AROUND the held cards. */
  frameMs: number,
  /** Proxy → real card crossfade (the handoff). */
  handoffMs: number,
};

/**
 * The base rhythm. A MATCH gets a full (but unshowy) hero beat — it flips
 * face-up, is read for a moment, and settles into the hold zone. DISCARDS
 * never pause: they flow past face-DOWN in a tight, quick stream straight to
 * the tray, so the player reads their COUNT, not each card.
 */
export function deckDrawTimings(): DeckDrawTimings {
  return {
    peelMs: 190,
    travelMs: 300,
    inspectMs: 260,
    routeMs: 300,
    gapMs: 90,
    streamStepMs: 95,
    flipPortion: 0.62,
    settleMs: 320,
    frameMs: 240,
    handoffMs: 170,
  };
}

/**
 * Reduced motion: the SHORT but still complete physical path (deck → hold /
 * deck → tray → reveal). The story must read; only the theatrics go (mirrors
 * reducedBonusSceneTimings).
 */
export function reducedDeckDrawTimings(): DeckDrawTimings {
  return {
    peelMs: 50,
    travelMs: 110,
    inspectMs: 90,
    routeMs: 110,
    gapMs: 20,
    streamStepMs: 45,
    flipPortion: 0.5,
    settleMs: 90,
    frameMs: 100,
    handoffMs: 90,
  };
}

/**
 * How many DISCARDS play at the full, teaching rhythm before the stream
 * tightens. The first couple show the principle completely; after that the
 * player has understood the mechanism and only needs to see it keep working.
 */
export const FULL_RHYTHM_DISCARDS = 2;

/** The floor the tightening ramp approaches (never a flicker). */
export const MIN_DISCARD_PACE = 0.42;

/** How fast the ramp falls off — each further discard shaves this much. */
const PACE_STEP = 0.14;

/**
 * The pace multiplier for the Nth discard of the scene (0-based).
 *
 * A long unlucky search must not grow linearly into a 20-second wait, but it
 * must never stop being an honest physical process either: the ramp only ever
 * tightens the SPEED of a beat that still fully happens — no discard is
 * skipped, batched or teleported into the tray.
 */
export function discardPace(discardOrdinal: number): number {
  if (discardOrdinal < FULL_RHYTHM_DISCARDS) {
    return 1;
  }
  const steps = discardOrdinal - FULL_RHYTHM_DISCARDS + 1;
  return Math.max(MIN_DISCARD_PACE, 1 - steps * PACE_STEP);
}

/** One server reveal step, reduced to what the plan needs. */
export type PlanStep = {matched: boolean};

/**
 * Build the whole scene plan from the server's reveal sequence.
 *
 * `steps` is the sequence VERBATIM (never re-sorted): the player watches the
 * exact search the deck performed. A `plain` scene (no search / nothing
 * discarded) passes every step as matched and gets the simpler language: the
 * cards never flip, never pause to be judged, and fly straight to the hold
 * zone with a light stagger.
 */
export function planDeckDraw(
  steps: ReadonlyArray<PlanStep>,
  t: DeckDrawTimings,
  plain: boolean,
): Array<DrawBeat> {
  const beats: Array<DrawBeat> = [];
  let at = 0;
  let holdSlot = 0;
  let trayDepth = 0;
  let discardOrdinal = 0;

  steps.forEach((step, index) => {
    if (plain) {
      // No verdict to show: one calm staggered stream into the hold zone.
      beats.push({
        index,
        kind: 'plain',
        atMs: at,
        travelMs: t.travelMs + t.routeMs * 0.5,
        flipPortion: 0,
        inspectMs: 0,
        routeMs: 0,
        holdSlot: holdSlot++,
      });
      at += t.peelMs + t.gapMs * 1.4;
      return;
    }

    if (!step.matched) {
      // A DISCARD flows past face-down straight to the tray — no inspect, no
      // flip, no per-card beat. Several are in the air at once (the next
      // peels after only `streamStepMs`), so the player reads the COUNT of
      // the stream, not each card. A long unlucky run tightens the cadence
      // (discardPace) so it stays quick, but EVERY discarded card still
      // physically flows — none is skipped or teleported.
      const pace = discardPace(discardOrdinal);
      beats.push({
        index,
        kind: 'discard',
        atMs: at,
        travelMs: t.travelMs * pace,
        flipPortion: 0,
        inspectMs: 0,
        routeMs: 0,
        trayDepth: trayDepth++,
      });
      discardOrdinal++;
      at += t.streamStepMs * pace;
      return;
    }

    // A MATCH gets the full hero beat: peel → travel → judged face-up →
    // settle into the hold zone. It waits for the discard stream ahead of it
    // to have cleared the deck (the stream is already flowing to the tray on
    // the right, this card goes to the centre), so the two never tangle.
    beats.push({
      index,
      kind: 'match',
      atMs: at,
      travelMs: t.travelMs,
      flipPortion: t.flipPortion,
      inspectMs: t.inspectMs * 1.45,
      routeMs: t.routeMs,
      holdSlot: holdSlot++,
    });
    at += t.peelMs + t.travelMs + t.inspectMs * 1.45 + t.routeMs * 0.45 + t.gapMs;
  });

  return beats;
}

/** When the last card has fully landed (scene-relative). */
export function planEndMs(beats: ReadonlyArray<DrawBeat>, t: DeckDrawTimings): number {
  let end = 0;
  for (const b of beats) {
    end = Math.max(end, b.atMs + t.peelMs + b.travelMs + b.inspectMs + b.routeMs);
  }
  return end;
}

/** Total BASE duration incl. the finish + handoff (the safety budget). */
export function deckDrawBudgetMs(beats: ReadonlyArray<DrawBeat>, t: DeckDrawTimings): number {
  return planEndMs(beats, t) + t.settleMs + t.frameMs + t.handoffMs;
}

/**
 * The count the DECK shows once `revealed` cards have physically left it.
 * The scene holds the pre-draw number and ticks it down per peel-off, so the
 * counter and the physical stack always tell the same story.
 */
export function deckCountAfter(preDrawSize: number, revealed: number): number {
  return Math.max(0, preDrawSize - revealed);
}

/**
 * The INSPECT point — where a card pauses to be judged. Centred horizontally,
 * high enough to sit clear of the hold zone below it, and always well below
 * the top bar so the deck it came from stays visible (the source must never
 * be covered by the card it just produced).
 */
export function inspectPoint(viewportW: number, viewportH: number): {x: number, y: number} {
  return {x: viewportW / 2, y: Math.max(140 * conUiScale(), viewportH * 0.34)};
}

/**
 * The scale a card is presented at while being judged. Big enough to take in
 * at a glance — the player must SEE that a real card was turned over — but
 * never a fullscreen event: a discard is shown, not offered for reading.
 */
export function inspectScale(viewportH: number, naturalH: number): number {
  const s = conUiScale();
  return Math.min(0.66 * s, Math.max(0.3 * s, (viewportH * 0.42) / Math.max(1, naturalH)));
}

/**
 * The HOLD-ZONE slot centres — where found cards wait for the rest of the
 * search. A centred row that re-balances as it grows (the director tweens the
 * already-placed cards to their new centres, so nothing ever jumps).
 */
export function holdSlots(
  count: number, viewportW: number, viewportH: number, cardW: number,
): Array<{x: number, y: number}> {
  if (count <= 0) {
    return [];
  }
  const gap = 26 * conUiScale();
  const pitch = cardW + gap;
  const totalW = count * cardW + (count - 1) * gap;
  // The row must stay inside the free band between the side rails (the left
  // resource rail ends ~11%, the right dashboard starts ~76%), so a big find
  // overlaps rather than running under a panel — on any profile.
  const maxW = viewportW * 0.46;
  const squeeze = totalW > maxW ? maxW / totalW : 1;
  const step = pitch * squeeze;
  const first = viewportW / 2 - (step * (count - 1)) / 2;
  const y = viewportH * 0.62;
  return Array.from({length: count}, (_, i) => ({x: first + step * i, y}));
}

/**
 * The scale found cards rest at in the hold zone. They are the scene's
 * heroes, so they stay clearly readable — a notch under the inspect pose
 * (that one is the card's moment), never a thumbnail.
 */
export function holdScale(viewportH: number, naturalH: number): number {
  const s = conUiScale();
  return Math.min(0.5 * s, Math.max(0.24 * s, (viewportH * 0.3) / Math.max(1, naturalH)));
}
