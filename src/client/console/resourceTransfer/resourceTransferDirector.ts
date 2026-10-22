/*
 * resourceTransferDirector — the GSAP hands of the resource-transfer
 * framework. Owns ONLY the DOM/tween work on one chip piece (the chip + its
 * contact-beat halo, mounted by ConsoleResourceTransferLayer):
 *
 *   the pop out of the source → ONE progress tween mapping the whole flight
 *   (position + the bloom-then-approach scale + a small unwinding tilt)
 *   through the model's arc → the two-frame touchdown settle → the contact
 *   beat (a pointed halo on the destination) → the absorb (`auto`) or the
 *   rest-on-target hold (`hold`, absorbed later by settleTransferChip).
 *
 * Physics discipline (the project flight rules): transform/opacity only,
 * geometry measured BEFORE the timeline, `will-change` scoped to the layer's
 * own classes, every entry point resolves (guarded budgets) and
 * `killTransferPiece` reverts everything. No game state, no Vue.
 */

import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {
  TransferArcPlan, TransferCover, TransferLaunch, TransferPaintLayer, TransferPaintPlan, TransferPoint, TransferRect, transferArcPlan, transferArcPoint,
  transferCeilingFor, transferChipScaleAt, transferEndMoved, transferLiftBias, transferRetargetWeight, transferTurnDue,
  TRANSFER_POP_MS, TRANSFER_ARC_MS, TRANSFER_SETTLE_MS, TRANSFER_BEAT_MS, TRANSFER_QUICK_ABSORB_MS, TRANSFER_RETARGET_AT,
  TRANSFER_HANDOVER_FROM, TRANSFER_HANDOVER_MS,
} from '@/client/console/resourceTransfer/resourceTransferModel';

export type TransferStagePiece = {
  chip: HTMLElement,
  beat: HTMLElement | undefined,
  /** The receiver's ring (T06 — «адресат объявляет себя»): drawn over the destination from the token's birth to its touchdown. */
  expect?: HTMLElement,
  /**
   * THE TWO PAINTS (T12 / CA): put the token (`chip`) or its destination's marks (`end` — the contact beat and the
   * receiver's ring) into the lit layer or its shaded twin. The SAME element moves — its transform, its tweens and its
   * box are untouched (both layers are `fixed; inset: 0`): a handover is never a jump.
   */
  setLayer?: (part: 'chip' | 'end', layer: TransferPaintLayer) => void,
};

/**
 * What a token's paint is, asked once in its birth frame (`opts.paint`): its plan, the cover it was planned against,
 * and — asked at the handover — how much of the token's paint the dim over the board lets through RIGHT NOW (1 — nothing
 * dims the board: the surfacing needs no ramp; the shade on — about .3).
 */
export type TransferFlightPaint = {plan: TransferPaintPlan, cover: TransferCover, through?: () => number};

/** Below this the surfacing ramps from the dim's paint; at or above it the token simply changes layer (no visible step). */
const SURFACING_RAMP_BELOW = 0.95;

/** The three moments the paint sentinel asks «is the token the topmost thing painted here?». */
export type TransferPaintMoment = 'birth' | 'approach' | 'touchdown';

export type TransferFlightOpts = {
  from: TransferPoint;
  to: TransferPoint;
  /** Position in the wave — drives the deterministic arc-lift separation. */
  index: number;
  /** Launch delay within the wave (already motion-scaled AND paced). */
  delayMs: number;
  uiScale: number;
  /** `true` → the chip RESTS on the destination after touchdown (the sale);
   *  `false` → contact beat + absorb right after arrival (the reward wave). */
  hold: boolean;
  /** Wave tempo (already clamped by the run, ≤1 = quicker) — scales the
   *  flight's own durations, never its arc or easing. Default 1. */
  pace?: number;
  /** How the chip leaves its source (`transferArcPlan`) — `side` for a departure off a RAIL row (PL-104). Default `toss`. */
  launch?: TransferLaunch;
  /**
   * `quick` (PL-140): a price token drawn INTO the printed result it buys — no settle at the touchdown, the short
   * absorb beat (`TRANSFER_QUICK_ABSORB_MS`) — so the result is born out of it at once.
   */
  absorb?: 'quick';
  /**
   * THE SOURCE, RE-MEASURED AT THE BIRTH (T06 — «оба конца живые»): asked in the very tick the chip turns visible.
   * A point — the chip is born THERE (the object moved since the plan: the arc is planned again from it); undefined —
   * the object is no longer painted (a folded composer, a card that left): the chip is NEVER born, the flight is
   * reported `unpainted` and resolves at once (the caller's counter ticks — the honest degradation).
   */
  liveFrom?: () => TransferPoint | undefined;
  /**
   * THE DESTINATION, RE-MEASURED ON THE FINAL APPROACH (past `TRANSFER_RETARGET_AT` — the difference is ramped in, no
   * jerk) and AT THE TOUCHDOWN (the settle glides onto it). Undefined — the object is gone: `standIn` is asked for the
   * same object's double (a rail row, the satellite cell, a seat chip); with none the chip is ABSORBED WHERE IT IS.
   */
  liveTo?: () => TransferPoint | undefined;
  standIn?: () => TransferPoint | undefined;
  /**
   * THE RECEIVER ANNOUNCES ITSELF (T06, the owner's decision 7 — «ожидает» везде): the destination's box as it rests,
   * asked in the birth frame and on the final approach — the piece's ring stands over it (a thin line in the
   * resource's tone, ≤ .5) from the birth to the touchdown, following it; undefined — no ring (a bare point, a
   * receiver that announces itself — the seat's intake plaque).
   */
  expectRect?: () => TransferRect | undefined;
  /**
   * THE PAINT OF THE TOKEN (T12 / CA): asked in the birth frame with the token's box there — the layer it is born in,
   * the layer it lands in, the one turn between them (`resourceTransferModel.transferPaintPlan`). Undefined — the lit
   * layer for the whole flight (a token born on a lit surface).
   */
  paint?: (birthBox: TransferRect) => TransferFlightPaint | undefined;
  /**
   * THE PAINT SENTINEL (T12 / CA, decision 5): «what is painted over the token here?» — undefined when the token is
   * the topmost thing at its centre; asked at the birth, on the final approach and at the touchdown, only while the token
   * is in the LIT layer (under the shade it is the board's background story by plan).
   */
  probePaint?: (chip: HTMLElement) => string | undefined;
};

/** What happened to a flight's two ends — filled as the flight goes (the run's trail and its degradations read it). */
export type TransferFlightReport = {
  /** `painted` — born on its live source; `unpainted` — the source was gone at the birth: never born. */
  born?: 'painted' | 'unpainted';
  /** `live` — landed where planned; `moved` — the object moved, the approach followed it; `stand-in` — re-homed; `lost` — absorbed in place. */
  end?: 'live' | 'moved' | 'stand-in' | 'lost';
  /** Where the chip was born / came to rest (the sentinel asks what was painted there). */
  bornAt?: TransferPoint;
  restAt?: TransferPoint;
  /** The layer the token was born in and the one it ended in (T12 / CA). */
  bornLayer?: TransferPaintLayer;
  layer?: TransferPaintLayer;
  /** Where the token was handed between the layers (arc progress), when it was. */
  handover?: {turn: 'up' | 'down', q: number};
  /** Every moment the sentinel found the token painted UNDER something (in the lit layer) — empty when it never was. */
  paintedUnder?: Array<{at: TransferPaintMoment, under: string}>;
};

export type TransferFlightHandles = {
  /** Resolves at the LAUNCH — the chip is whole at its source and starts its arc (a LOSS releases its row here). Never after `touched`. */
  launched: Promise<void>;
  /** Resolves at TOUCHDOWN (after the settle) — the commit/hold-release gate. */
  touched: Promise<void>;
  /** Resolves when the piece is fully done ('landed' = resting, hold mode). */
  finished: Promise<'landed' | 'done'>;
  /** The flight's ends as they happened (complete once `touched` resolves). */
  report: TransferFlightReport;
};

/** The chip's first PAINTED pose: at its source, the first frame of its pop (the pop then rises from here). */
const TRANSFER_BIRTH_ALPHA = 0.35;

/** A flight that has been asked for but not flown yet (see `bornThenFlown`), per chip — a kill cancels it too. */
const pendingStarts = new WeakMap<HTMLElement, {cancel: () => void}>();

/**
 * THE CHIP IS BORN AT ITS SOURCE — painted there once — AND ONLY THEN FLOWN, on the animation clock.
 *
 * Two clocks used to decide the chip's first painted pose, and neither was the chip's own:
 *  · GSAP's global time advances ONLY at a tick, and a timeline created between two ticks starts at the LAST one.
 *    A reward wave is launched from the response's own task (the answer is applied, a watcher flies the row), so a
 *    long task (measured: 146 ms of `Response.json().then` on the Habitat Science ledger) put the timeline's first
 *    rendered frame 150 ms into its flight;
 *  · a SLOW FRAME does the same after a correct start: the first tick after the start lands a whole frame later
 *    (a headless 4K frame is hundreds of ms), and the chip — `autoAlpha: 0` at its birth — was first painted 40 %
 *    along its arc, above the panel, born out of nothing.
 * So the birth is its own beat: after the wave's stagger, ON a tick, the chip turns visible at its source (the
 * first frame of the pop); the flight starts on the NEXT tick (a later frame — the birth has been painted between
 * them) and runs from there. Whatever the frames cost afterwards, the first thing the player sees is the source.
 * The cost is one frame.
 */
function bornThenFlown(chip: HTMLElement, delayMs: number, fly: () => void, place?: () => boolean): void {
  pendingStarts.get(chip)?.cancel();
  let listener: (() => void) | undefined;
  const birth = gsap.delayedCall(delayMs / 1000, () => {
    // THE BIRTH FRAME (T06): the source is measured HERE, in the tick the chip turns visible — a source that is no
    // longer painted gets no chip at all (`place` answers false and owns the outcome), never a token out of its old pose.
    if (place !== undefined && !place()) {
      cancel();
      return;
    }
    gsap.set(chip, {autoAlpha: TRANSFER_BIRTH_ALPHA});
    const bornFrame = gsap.ticker.frame;
    // A listener added while this tick dispatches is called in this very tick — hence the frame count.
    listener = () => {
      if (gsap.ticker.frame <= bornFrame) {
        return;
      }
      cancel();
      fly();
    };
    gsap.ticker.add(listener);
  });
  const cancel = (): void => {
    birth.kill();
    if (listener !== undefined) {
      gsap.ticker.remove(listener);
      listener = undefined;
    }
    pendingStarts.delete(chip);
  };
  pendingStarts.set(chip, {cancel});
}

function guarded(run: (done: () => void) => void, budgetMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        window.clearTimeout(safety);
        resolve();
      }
    };
    const safety = window.setTimeout(done, budgetMs + 1200);
    run(done);
  });
}

/** The lower edge of the cockpit's top rail (the status strip), 0 when none stands (a non-console host, a spec). */
function topRailBottom(): number {
  if (typeof document === 'undefined') {
    return 0;
  }
  const rect = document.querySelector('.con-status')?.getBoundingClientRect();
  return rect !== undefined && rect.height > 0 ? Math.max(0, rect.bottom) : 0;
}

/** The ring's air around its receiver (px @ ui 1). */
const EXPECT_PAD = 4;
/** The ring arrives in one short fade — never a line appearing in one frame (ms @ motion scale 1). */
const EXPECT_IN_MS = 160;
const EXPECT_OUT_MS = 120;

/** Stand the receiver's ring over `rect` (its first frame fades in, a later one follows the receiver). */
function placeExpect(piece: TransferStagePiece, rect: TransferRect | undefined, uiScale: number, first: boolean): void {
  const ring = piece.expect;
  if (ring === undefined || rect === undefined) {
    return;
  }
  const pad = EXPECT_PAD * uiScale;
  gsap.set(ring, {x: rect.x - pad, y: rect.y - pad, width: rect.w + 2 * pad, height: rect.h + 2 * pad});
  if (first) {
    gsap.set(ring, {autoAlpha: 0});
    gsap.to(ring, {autoAlpha: 1, duration: motionMs(EXPECT_IN_MS) / 1000, ease: 'none'});
  }
}

/** The touchdown takes the ring down (the contact beat is the receiver's answer now). */
function dropExpect(piece: TransferStagePiece): void {
  if (piece.expect !== undefined) {
    gsap.to(piece.expect, {autoAlpha: 0, duration: motionMs(EXPECT_OUT_MS) / 1000, ease: 'none', overwrite: true});
  }
}

/**
 * One chip's flight. The chip is CSS-sized (rem — profile-correct); the
 * director only moves/scales it, centring the box on the arc points.
 */
export function runTransferFlight(piece: TransferStagePiece, opts: TransferFlightOpts): TransferFlightHandles {
  const chip = piece.chip;
  const w = chip.offsetWidth || 48;
  const h = chip.offsetHeight || 48;
  // The chip stays IN VIEW for its whole flight (see `transferArcPlan` — a toss into the rail's top rows used to
  // leave the viewport and come back down onto its row). The line it may not cross is the lower edge of the top
  // HUD rail — the flight layer paints UNDER the cockpit rails, so a chip above that edge is a chip cut in half —
  // and, for a row that itself stands above that line, the top of the screen.
  const planFrom = (from: TransferPoint): TransferArcPlan =>
    transferArcPlan(from, opts.to, transferLiftBias(opts.index), transferCeilingFor(from, opts.to, h, opts.uiScale, topRailBottom()), opts.launch);
  let plan = planFrom(opts.from);
  const report: TransferFlightReport = {};
  // THE PAINT (T12 / CA): planned in the birth frame, turned at most once on the way, asked by the sentinel at three
  // moments. A token with no plan paints in the lit layer for its whole flight.
  let paint: TransferFlightPaint | undefined;
  let layer: TransferPaintLayer = 'lit';
  let turned = false;
  let approachAsked = false;
  /** The token's box at a point of the arc (its transform-origin is its centre). */
  const boxAt = (at: TransferPoint, q: number): TransferRect => {
    const s = transferChipScaleAt(q);
    return {x: at.x - (w * s) / 2, y: at.y - (h * s) / 2, w: w * s, h: h * s};
  };
  /** The birth frame plans the paint: the layer the token is born in, the one its destination's marks stand in. */
  const planPaint = (at: TransferPoint): void => {
    paint = opts.paint?.(boxAt(at, 0));
    if (paint === undefined) {
      return;
    }
    layer = paint.plan.birth;
    report.bornLayer = layer;
    piece.setLayer?.('chip', layer);
    piece.setLayer?.('end', paint.plan.end);
  };
  /** The one turn: the SAME element moves to the other layer; surfacing out of the shade ramps up from the shade's paint. */
  const handOver = (q: number): void => {
    if (paint === undefined || paint.plan.turn === 'none') {
      return;
    }
    turned = true;
    layer = paint.plan.end;
    report.handover = {turn: paint.plan.turn, q: Math.round(q * 100) / 100};
    piece.setLayer?.('chip', layer);
    // Surfacing out of a DIM ramps from what that dim let through — never a flash; with nothing dimming the board (the
    // start scene yielded to the field, the shade off) the token was already at full paint and only changes layer.
    const from = paint.plan.turn === 'up' ? (paint.through?.() ?? TRANSFER_HANDOVER_FROM) : 1;
    if (from < SURFACING_RAMP_BELOW) {
      gsap.fromTo(chip, {opacity: from}, {opacity: 1, duration: motionMs(TRANSFER_HANDOVER_MS) / 1000, ease: 'power1.out'});
    }
  };
  /** THE PAINT SENTINEL: after the layer's move has landed (a microtask — the stage moves the element in its own flush). */
  const askPaint = (at: TransferPaintMoment): void => {
    const probe = opts.probePaint;
    if (probe === undefined) {
      return;
    }
    void Promise.resolve().then(() => {
      if (layer !== 'lit' || !chip.isConnected) {
        return;
      }
      const under = probe(chip);
      if (under !== undefined) {
        (report.paintedUnder ??= []).push({at, under});
      }
    });
  };
  // Where the chip comes to rest — the planned landing, the followed one, a stand-in, or the air where its end vanished.
  let restingAt: TransferPoint = opts.to;
  const startTilt = (opts.index % 2 === 0 ? -1 : 1) * 7;
  const settlePx = Math.max(2, Math.round(2.5 * opts.uiScale));
  const pace = opts.pace ?? 1;
  const popMs = motionMs(TRANSFER_POP_MS) * pace;
  const arcMs = motionMs(TRANSFER_ARC_MS) * pace;
  const settleMs = opts.absorb === 'quick' ? 0 : motionMs(TRANSFER_SETTLE_MS) * pace;
  const absorbMs = opts.absorb === 'quick' ? motionMs(TRANSFER_QUICK_ABSORB_MS) : motionMs(TRANSFER_BEAT_MS) * pace;

  gsap.set(chip, {
    x: opts.from.x - w / 2,
    y: opts.from.y - h / 2,
    scale: transferChipScaleAt(0),
    rotation: startTilt,
    transformOrigin: 'center center',
    autoAlpha: 0,
  });

  let launchedResolve: () => void = () => {};
  const launchedAt = new Promise<void>((resolve) => {
    launchedResolve = resolve;
  });
  let unborn = false;
  const touched = guarded((done) => bornThenFlown(chip, opts.delayMs, () => {
    // (The wave's stagger was the birth's — the flight starts the moment it is called.)
    // The birth frame has been painted (in its layer) — the sentinel asks what stands over it.
    askPaint('birth');
    const tl = gsap.timeline({onComplete: () => touchdown(done)});
    // Materialize at the source — the chip is BORN there, never teleported in (its first frame is already painted).
    tl.to(chip, {autoAlpha: 1, duration: popMs / 1000, ease: 'power1.out'}, 0);
    // …and LEAVES it once whole: the launch is the end of the pop.
    tl.call(() => launchedResolve(), undefined, popMs / 1000);
    // ONE progress tween drives the whole flight through the model's arc —
    // position, the bloom-then-approach scale and the unwinding tilt behave
    // as one physical object on one curve. Past `TRANSFER_RETARGET_AT` the destination is read LIVE once and the
    // difference ramps in over the rest of the curve (T06 — an end that moved is followed; one that vanished is
    // re-homed, or the chip is absorbed where it is).
    const prog = {q: 0};
    const corr = {x: 0, y: 0, readAt: -1};
    tl.to(prog, {
      q: 1,
      duration: (popMs + arcMs) / 1000,
      ease: 'power1.inOut',
      onUpdate: () => {
        if (corr.readAt < 0 && prog.q >= TRANSFER_RETARGET_AT && opts.liveTo !== undefined) {
          corr.readAt = prog.q;
          const live = finalApproach();
          if (live === undefined) {
            // The end is gone and nothing stands in for it: the chip is absorbed in the air where it is.
            restingAt = transferArcPoint(plan, prog.q);
            report.restAt = restingAt;
            dropExpect(piece);
            tl.kill();
            done();
            return;
          }
          corr.x = live.x - plan.p1.x;
          corr.y = live.y - plan.p1.y;
          // The ring follows its receiver (a stand-in gets none — it was never announced there).
          if (report.end !== 'stand-in') {
            placeExpect(piece, opts.expectRect?.(), opts.uiScale, false);
          } else {
            dropExpect(piece);
          }
        }
        const p = transferArcPoint(plan, prog.q);
        const cw = transferRetargetWeight(prog.q, corr.readAt);
        const at = {x: p.x + corr.x * cw, y: p.y + corr.y * cw};
        gsap.set(chip, {
          x: at.x - w / 2,
          y: at.y - h / 2,
          scale: transferChipScaleAt(prog.q),
          rotation: startTilt * (1 - prog.q), // fully square at the landing
        });
        // THE HANDOVER (T12 / CA): at the edge of the covered area — never one z for both ends of the flight.
        if (!turned && paint !== undefined && paint.plan.turn !== 'none' && transferTurnDue(paint.plan.turn, boxAt(at, prog.q), paint.cover, prog.q)) {
          handOver(prog.q);
        }
        if (!approachAsked && prog.q >= TRANSFER_RETARGET_AT) {
          approachAsked = true;
          askPaint('approach');
        }
      },
      onComplete: () => {
        restingAt = {x: plan.p1.x + corr.x, y: plan.p1.y + corr.y};
      },
    }, 0);
  }, () => {
    // THE BIRTH FRAME: the source as painted NOW — moved since the plan → the arc starts from where it IS; gone → no chip.
    if (opts.liveFrom === undefined) {
      report.born = 'painted';
      report.bornAt = opts.from;
      planPaint(opts.from);
      placeExpect(piece, opts.expectRect?.(), opts.uiScale, true);
      return true;
    }
    const at = opts.liveFrom();
    if (at === undefined) {
      report.born = 'unpainted';
      unborn = true;
      done();
      return false;
    }
    if (transferEndMoved(opts.from, at)) {
      plan = planFrom(at);
      gsap.set(chip, {x: at.x - w / 2, y: at.y - h / 2});
    }
    report.born = 'painted';
    report.bornAt = at;
    planPaint(at);
    placeExpect(piece, opts.expectRect?.(), opts.uiScale, true);
    return true;
  }), opts.delayMs + popMs + arcMs + settleMs + 200);

  /** The final approach's read: the live end, else its stand-in, else undefined (lost). Fills the report. */
  function finalApproach(): TransferPoint | undefined {
    const live = opts.liveTo?.();
    if (live !== undefined) {
      report.end = transferEndMoved(plan.p1, live) ? 'moved' : 'live';
      return live;
    }
    const standIn = opts.standIn?.();
    report.end = standIn === undefined ? 'lost' : 'stand-in';
    return standIn;
  }

  /**
   * THE TOUCHDOWN: the destination is read once more — an object that moved again since the final approach is met by
   * the settle (a short glide onto it, never a jump); then the microscopic damped weight — felt, not seen. A QUICK
   * absorb has no settle (the token is drawn in) and glides only when its end moved.
   */
  function touchdown(done: () => void): void {
    dropExpect(piece);
    // A turn still owed lands now at the latest (a dive into a covered cell); the touchdown is then asked about its paint.
    if (!turned && paint !== undefined && paint.plan.turn !== 'none') {
      handOver(1);
    }
    report.layer = layer;
    askPaint('touchdown');
    if (report.end === undefined) {
      report.end = 'live';
    }
    const live = report.end === 'stand-in' || opts.liveTo === undefined ? undefined : opts.liveTo();
    const glide = live !== undefined && transferEndMoved(restingAt, live);
    if (glide) {
      restingAt = live;
      if (report.end === 'live') {
        report.end = 'moved';
      }
    }
    report.restAt = restingAt;
    if (settleMs <= 0 && !glide) {
      done();
      return;
    }
    const tl = gsap.timeline({onComplete: done});
    if (glide) {
      tl.to(chip, {x: restingAt.x - w / 2, y: restingAt.y - h / 2, duration: Math.max(0.08, settleMs / 1000), ease: 'power2.out'});
    } else {
      tl.to(chip, {y: `+=${settlePx}`, duration: 0.08, ease: 'power1.out'});
      tl.to(chip, {y: `-=${settlePx}`, duration: (settleMs / 1000) - 0.08, ease: 'power2.out'});
    }
  }

  const finished: Promise<'landed' | 'done'> = touched.then(() => {
    if (unborn) {
      return 'done' as const;
    }
    if (opts.hold) {
      return 'landed' as const;
    }
    return absorbChip(piece, restingAt, absorbMs).then(() => 'done' as const);
  });
  // A launch that never fired (a killed timeline, the guard's budget) resolves with the touchdown: never a hang.
  const launched = Promise.race([launchedAt, touched]);

  return {launched, touched, finished, report};
}

/**
 * A DETACHED flight (PL-165, the owner's law «результат переживает поверхность»): the destination exists but is
 * COVERED by the standing surface that produced the token (the ДОП. РЕСУРСЫ satellite under the action composer's
 * glass while its ledger pays) — so the chip is BORN on its visible source and pops out of it like any token, then
 * WAITS there in the app-level layer (`.con-transfer`, above every band surface) while the surface leaves under it;
 * only when the destination is painted does the arc start, from where the chip stands to the measured point. A
 * destination that never opens within the caller's budget is no destination: the chip is ABSORBED IN PLACE (the
 * counter ticks with its chip — the honest degradation), never flown into glass.
 *
 * `launched` resolves at the POP — the token has left its source, which is the moment the caller's own flow may go
 * on (its surface may now fold: the chip no longer needs it). `touched` resolves at the real touchdown, or at the
 * in-place absorb. The birth is the same `bornThenFlown` beat as every chip (painted at its source first).
 */
export type DetachedFlightOpts = TransferFlightOpts & {
  /** Resolves with the measured destination once it is painted, or undefined once the wait is over. */
  awaitTo: () => Promise<TransferPoint | undefined>;
  /** The wait's own ceiling (already motion-scaled) — the guard budget of the whole flight includes it. */
  waitBudgetMs: number;
  /** The arc starts (the destination opened) — the run's bookkeeping turns the waiting chip into a flying one. */
  onArc?: () => void;
};

export function runDetachedTransferFlight(piece: TransferStagePiece, opts: DetachedFlightOpts): TransferFlightHandles {
  const chip = piece.chip;
  const report: TransferFlightReport = {};
  let unborn = false;
  let from = opts.from;
  const w = chip.offsetWidth || 48;
  const h = chip.offsetHeight || 48;
  const startTilt = (opts.index % 2 === 0 ? -1 : 1) * 7;
  const pace = opts.pace ?? 1;
  const popMs = motionMs(TRANSFER_POP_MS) * pace;
  const arcMs = motionMs(TRANSFER_ARC_MS) * pace;
  const settleMs = motionMs(TRANSFER_SETTLE_MS) * pace;
  const settlePx = Math.max(2, Math.round(2.5 * opts.uiScale));
  // The waiting pose: the chip has popped OUT of its source (a quarter of the bloom) and holds there, square.
  const holdScale = transferChipScaleAt(0.25);

  gsap.set(chip, {
    x: opts.from.x - w / 2,
    y: opts.from.y - h / 2,
    scale: transferChipScaleAt(0),
    rotation: startTilt,
    transformOrigin: 'center center',
    autoAlpha: 0,
  });

  let launchedResolve: () => void = () => {};
  const launchedAt = new Promise<void>((resolve) => {
    launchedResolve = resolve;
  });
  // Where the chip came to rest — its destination, or its source when it never left (read by the absorb, whatever ended the flight).
  let restingAt: TransferPoint = opts.from;
  const touched = guarded((done) => bornThenFlown(chip, opts.delayMs, () => {
    // THE POP — the chip is born at its source and comes whole out of it; then it has LEFT its source.
    const pop = gsap.timeline({onComplete: () => {
      launchedResolve();
      void opts.awaitTo().then((to) => {
        if (to === undefined) {
          // Nowhere visible to go: absorbed where it stands — the counter ticks with its chip.
          report.end = 'lost';
          report.restAt = restingAt;
          done();
          return;
        }
        opts.onArc?.();
        report.end = 'live';
        const ceiling = transferCeilingFor(from, to, h, opts.uiScale, topRailBottom());
        const plan = transferArcPlan(from, to, transferLiftBias(opts.index), ceiling, opts.launch);
        const prog = {q: 0};
        const arc = gsap.timeline({onComplete: () => {
          restingAt = to;
          report.restAt = to;
          done();
        }});
        arc.to(prog, {
          q: 1,
          duration: arcMs / 1000,
          ease: 'power1.inOut',
          onUpdate: () => {
            const p = transferArcPoint(plan, prog.q);
            gsap.set(chip, {
              x: p.x - w / 2,
              y: p.y - h / 2,
              // From the waiting pose to the landing size — the same approach curve as every flight's second half.
              scale: holdScale + (transferChipScaleAt(Math.max(0.25, prog.q)) - holdScale) * prog.q,
            });
          },
        }, 0);
        arc.to(chip, {y: `+=${settlePx}`, duration: 0.08, ease: 'power1.out'});
        arc.to(chip, {y: `-=${settlePx}`, duration: Math.max(0.02, (settleMs / 1000) - 0.08), ease: 'power2.out'});
      });
    }});
    pop.to(chip, {autoAlpha: 1, scale: holdScale, rotation: 0, duration: popMs / 1000, ease: 'power1.out'}, 0);
  }, () => {
    // THE BIRTH FRAME (T06): the same live source as an ordinary flight — gone → no chip, moved → born where it is.
    if (opts.liveFrom === undefined) {
      report.born = 'painted';
      report.bornAt = from;
      return true;
    }
    const at = opts.liveFrom();
    if (at === undefined) {
      report.born = 'unpainted';
      unborn = true;
      done();
      return false;
    }
    from = at;
    restingAt = at;
    gsap.set(chip, {x: at.x - w / 2, y: at.y - h / 2});
    report.born = 'painted';
    report.bornAt = at;
    return true;
  }), opts.delayMs + popMs + opts.waitBudgetMs + arcMs + settleMs);

  const finished: Promise<'landed' | 'done'> = touched.then(() => (unborn ? undefined : absorbChip(piece, restingAt, motionMs(TRANSFER_BEAT_MS) * pace))).then(() => 'done' as const);
  const launched = Promise.race([launchedAt, touched]);
  return {launched, touched, finished, report};
}

/**
 * The contact beat + absorb: a pointed one-shot halo wakes on the
 * destination zone while the chip is drawn INTO it — short, material,
 * no bloom, no bounce.
 */
function absorbChip(piece: TransferStagePiece, at: TransferPoint, beatMs: number): Promise<void> {
  // THE HALO KEEPS ITS FULL BEAT whatever the absorb's speed: a QUICK absorb (PL-140) sinks the chip in 180 ms, but the
  // contact's mark is what the eye (and every probe) reads as «it landed» — shortened with the sink it was visible for
  // ≈ 120 ms and fell inside one stalled frame on a loaded 4K runner. Only the piece's removal waits for it; the
  // touchdown (and so the next link's birth) was released before this ran.
  const haloMs = Math.max(beatMs, motionMs(TRANSFER_BEAT_MS));
  return guarded((done) => {
    const tl = gsap.timeline({onComplete: done});
    if (piece.beat !== undefined) {
      const bw = piece.beat.offsetWidth || 56;
      gsap.set(piece.beat, {
        x: at.x - bw / 2,
        y: at.y - bw / 2,
        scale: 0.55,
        autoAlpha: 0.5,
        transformOrigin: 'center center',
      });
      tl.to(piece.beat, {scale: 1.35, autoAlpha: 0, duration: haloMs / 1000, ease: 'power2.out'}, 0);
    }
    tl.to(piece.chip, {scale: 0.5, autoAlpha: 0, duration: Math.min(0.24, beatMs / 1000), ease: 'power2.in'}, 0.02);
  }, haloMs + 200);
}

/** Absorb a RESTING (hold-mode) chip — the sale's post-commit settle. */
export function settleTransferChip(piece: TransferStagePiece, at: TransferPoint, beatMs: number): Promise<void> {
  return absorbChip(piece, at, beatMs);
}

/** Abort/unmount: kill the piece's tweens (idempotent). */
export function killTransferPiece(piece: TransferStagePiece): void {
  pendingStarts.get(piece.chip)?.cancel();
  gsap.killTweensOf(piece.chip);
  if (piece.beat !== undefined) {
    gsap.killTweensOf(piece.beat);
  }
  if (piece.expect !== undefined) {
    gsap.killTweensOf(piece.expect);
    gsap.set(piece.expect, {autoAlpha: 0});
  }
}
