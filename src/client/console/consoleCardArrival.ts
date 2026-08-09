/*
 * @console-shared LIVE — console native stands on this file.
 *
 * CARD ARRIVAL — the PURE plan of «N cards physically come off the project
 * deck and land in N prepared slots» (no DOM, no GSAP — unit-tested under the
 * server runner, like deckDrawModel / cardDealModel).
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * The workspace's execution beat used to fly ONE proxy into ONE slot and only
 * then hand the zone to a surface that rendered the whole batch, so a two-card
 * draw read as «one card arrived and multiplied». A batch of N is N physical
 * objects from the first frame or it is not a batch — hence a plan that knows
 * the COUNT before anything moves, gives every card its own launch time and
 * its own destination, and never re-lays-out once the flight has begun.
 *
 * ── THE THREE MODES ARE SEMANTIC, NEVER TIMING ─────────────────────────────
 * `resolveCardArrivalMode` derives the mode from what the ACTION IS, plus the
 * one honest data question (are the faces known?):
 *
 *   'in-flight-reveal'   the normal draw / buy-the-revealed-card. The faces are
 *                        known, so the cards leave the pile face-down, tumble
 *                        OPEN on their own trajectory, and land face-up. There
 *                        is no post-landing flip in this mode — ever.
 *   'awaiting-data'      the count is known, the faces are not (a slow server).
 *                        N separate backs fly to N slots and wait there; the
 *                        reveal is a short cascade once the answer lands, or —
 *                        if the answer beats a card's own flip window — that
 *                        card simply continues into the normal in-flight turn.
 *   'conditional-reveal' the OPENING IS THE GAME EVENT (Search For Life and
 *                        friends: draw a card, then check it). Face-down
 *                        arrival, a deliberate beat, then one accented turn.
 *                        This is the ONLY mode allowed to flip after landing,
 *                        and it is chosen because the action is a deck CHECK —
 *                        never because a response happened to be late.
 *
 * Everything here is BASE milliseconds — the director resolves through
 * motionMs() so the whole choreography follows the fork-wide speed presets.
 */

/** How this batch is allowed to open. See the header for the semantics. */
export type CardArrivalMode = 'in-flight-reveal' | 'awaiting-data' | 'conditional-reveal';

export type CardArrivalContext = {
  /**
   * The claim's outcome kinds. A `deck-check` claim IS the conditional-reveal
   * family — the action's whole point is that a card is turned over and judged
   * (structural, from `branch.reveal` in the preview; never a card-name table).
   */
  kinds: ReadonlyArray<string>;
  /** Are the actual card faces renderable at launch time? */
  dataReady: boolean;
};

/**
 * THE mode resolver. Deliberately total and pure so the choice is auditable:
 * a deck check is always the deliberate reveal, and nothing else may ever
 * become one just because the server was slow.
 */
export function resolveCardArrivalMode(ctx: CardArrivalContext): CardArrivalMode {
  if (ctx.kinds.includes('deck-check')) {
    return 'conditional-reveal';
  }
  return ctx.dataReady ? 'in-flight-reveal' : 'awaiting-data';
}

export type CardArrivalTimings = {
  /** The card frees itself from the pile (rise + slight grow). */
  peelMs: number;
  /** Deck → slot travel. */
  travelMs: number;
  /**
   * Launch interval between the FIRST two cards. SHORT on purpose: the batch
   * has to read as one draw, not as a dealer handing out cards one at a time —
   * the next card leaves while the previous is barely a third of the way there.
   */
  stepMs: number;
  /**
   * How the interval TIGHTENS per card (each gap is this fraction of the one
   * before it). The first gap teaches the rhythm — «these are separate cards»
   * — and after that the player has understood it and only needs to see the
   * rest come out, so a bigger batch must not grow linearly into a queue.
   * Same principle as the deck-draw cinematic's discard ramp.
   */
  stepDecay: number;
  /** Where in the travel the turn starts (0..1 of `travelMs`). */
  flipAt: number;
  /** How much of the travel the turn spans (0..1 of `travelMs`). */
  flipSpan: number;
  /** The single soft settle after touchdown. No bounce, no second hop. */
  settleMs: number;
  /** `awaiting-data`: the cascade step of the in-place reveal. */
  holdRevealStepMs: number;
  /** `awaiting-data` / `conditional-reveal`: the in-place turn. */
  turnMs: number;
  /** `conditional-reveal`: the deliberate pause between landing and the turn. */
  dwellMs: number;
  /** Depth push of the turn (px at scale 1). */
  turnPush: number;
};

/**
 * The base rhythm. A batch of 2–4 is fully delivered in ≈0.95–1.15 s: the
 * cards leave almost together, are visibly several by the first quarter, open
 * while they travel and settle once. Confident, not leisurely.
 */
export function cardArrivalTimings(): CardArrivalTimings {
  return {
    peelMs: 130,
    travelMs: 620,
    stepMs: 92,
    // The gap tightens per card so a big batch does not grow into a queue —
    // but at 0.7 it collapsed: seven cards launched across 271 ms total, four
    // of them within 200 ms, and the eye read one BURST off the pile instead
    // of seven cards being dealt. 0.86 keeps the tightening (a 12-card batch
    // still converges) while a seven-card draw spreads over ~390 ms, which is
    // the smallest window in which «several separate cards» is legible.
    stepDecay: 0.86,
    // A touch later, so the card reads as a BACK travelling off the deck for a
    // beat before it opens — the turn is the event, and an event needs a
    // before.
    flipAt: 0.32,
    flipSpan: 0.62,
    settleMs: 130,
    holdRevealStepMs: 90,
    turnMs: 460,
    dwellMs: 340,
    turnPush: 74,
  };
}

/**
 * Reduced motion: the SHORT but still complete physical path. The story must
 * read (cards leave the deck, arrive separately, open); only the theatrics go.
 */
export function reducedCardArrivalTimings(): CardArrivalTimings {
  return {
    peelMs: 40,
    travelMs: 150,
    stepMs: 26,
    stepDecay: 0.7,
    flipAt: 0.3,
    flipSpan: 0.5,
    settleMs: 40,
    holdRevealStepMs: 40,
    turnMs: 130,
    dwellMs: 90,
    turnPush: 0,
  };
}

/** ONE card's arrival, already resolved to concrete scene-relative timings. */
export type CardArrivalBeat = {
  /** Index in the batch — also the slot it is aimed at. */
  index: number;
  /** Scene-relative moment this card starts leaving the pile. */
  atMs: number;
  /** The peel leg. */
  peelMs: number;
  /** The travel leg (starts at `atMs + peelMs`). */
  travelMs: number;
  /**
   * Scene-relative start of the in-flight turn, or `undefined` when this batch
   * does not open in flight (`awaiting-data` / `conditional-reveal`).
   */
  flipAtMs?: number;
  /** Duration of the in-flight turn. */
  flipMs: number;
  /** Scene-relative touchdown. */
  landAtMs: number;
  /**
   * The LATEST moment a late answer can still be turned into an in-flight
   * reveal for this card without a visual jump: the turn must fit before the
   * card is committed to its landing. Past this the card opens in place.
   */
  flipWindowEndsMs: number;
};

export type CardArrivalPlan = {
  mode: CardArrivalMode;
  beats: ReadonlyArray<CardArrivalBeat>;
  /** Everything has landed and settled. */
  totalMs: number;
};

/**
 * Build the whole batch plan. `count` is known BEFORE anything moves (from the
 * answer when it is already in, else from the branch preview's promised card
 * amount) — that is what makes the layout, the slots and the focus target
 * computable up front, so nothing is re-measured mid-flight.
 */
export function planCardArrival(
  count: number, t: CardArrivalTimings, mode: CardArrivalMode,
): CardArrivalPlan {
  const n = Math.max(0, Math.floor(count));
  const inFlight = mode === 'in-flight-reveal';
  const beats: Array<CardArrivalBeat> = [];
  let atMs = 0;
  let gap = t.stepMs;
  for (let index = 0; index < n; index++) {
    if (index > 0) {
      atMs += gap;
      gap *= t.stepDecay;
    }
    const travelStart = atMs + t.peelMs;
    const flipMs = t.travelMs * t.flipSpan;
    const flipAtMs = travelStart + t.travelMs * t.flipAt;
    beats.push({
      index,
      atMs,
      peelMs: t.peelMs,
      travelMs: t.travelMs,
      flipAtMs: inFlight ? flipAtMs : undefined,
      flipMs,
      landAtMs: travelStart + t.travelMs,
      // The turn has to be finished by the time the card is settling, or the
      // "flip" becomes a snap on the slot — which is the very thing the
      // deliberate mode exists to own.
      flipWindowEndsMs: travelStart + t.travelMs * (1 - t.flipSpan * 0.5),
    });
  }
  let totalMs = 0;
  for (const b of beats) {
    totalMs = Math.max(totalMs, b.landAtMs + t.settleMs);
  }
  return {mode, beats, totalMs};
}

/**
 * The SOURCE FAN — the small lateral offsets the cards are born at, so the
 * pile reads as a compact physical STACK of N cards rather than one card that
 * later divides. Deterministic (the fork bans Math.random in plans), centred,
 * and proportional to the deck's own width so it never detaches from the pile.
 */
export function arrivalSourceFan(count: number, deckW: number): Array<{dx: number, dy: number}> {
  const n = Math.max(0, Math.floor(count));
  if (n <= 1) {
    return n === 1 ? [{dx: 0, dy: 0}] : [];
  }
  const spread = Math.max(3, deckW * 0.42);
  const mid = (n - 1) / 2;
  return Array.from({length: n}, (_, i) => ({
    dx: (i - mid) * spread,
    dy: (mid - Math.abs(i - mid)) * -spread * 0.22,
  }));
}

/**
 * How long the whole batch owes the flow at minimum — the beat gate's budget.
 * Used only as a SAFETY ceiling by the caller; the real release is the
 * director's own settle callback (a critical animation never ends on a timer).
 */
export function cardArrivalBudgetMs(plan: CardArrivalPlan, t: CardArrivalTimings): number {
  return plan.totalMs + t.turnMs + t.dwellMs + t.holdRevealStepMs * Math.max(0, plan.beats.length - 1);
}
