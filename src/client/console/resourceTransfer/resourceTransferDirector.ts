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
  TransferPoint, transferArcPlan, transferArcPoint, transferChipScaleAt, transferLiftBias,
  TRANSFER_POP_MS, TRANSFER_ARC_MS, TRANSFER_SETTLE_MS, TRANSFER_BEAT_MS,
} from '@/client/console/resourceTransfer/resourceTransferModel';

export type TransferStagePiece = {
  chip: HTMLElement,
  beat: HTMLElement | undefined,
};

export type TransferFlightOpts = {
  from: TransferPoint;
  to: TransferPoint;
  /** Position in the wave — drives the deterministic arc-lift separation. */
  index: number;
  /** Launch delay within the wave (already motion-scaled). */
  delayMs: number;
  uiScale: number;
  /** `true` → the chip RESTS on the destination after touchdown (the sale);
   *  `false` → contact beat + absorb right after arrival (the reward wave). */
  hold: boolean;
};

export type TransferFlightHandles = {
  /** Resolves at TOUCHDOWN (after the settle) — the commit/hold-release gate. */
  touched: Promise<void>;
  /** Resolves when the piece is fully done ('landed' = resting, hold mode). */
  finished: Promise<'landed' | 'done'>;
};

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

/**
 * One chip's flight. The chip is CSS-sized (rem — profile-correct); the
 * director only moves/scales it, centring the box on the arc points.
 */
export function runTransferFlight(piece: TransferStagePiece, opts: TransferFlightOpts): TransferFlightHandles {
  const chip = piece.chip;
  const w = chip.offsetWidth || 48;
  const h = chip.offsetHeight || 48;
  const plan = transferArcPlan(opts.from, opts.to, transferLiftBias(opts.index));
  const startTilt = (opts.index % 2 === 0 ? -1 : 1) * 7;
  const settlePx = Math.max(2, Math.round(2.5 * opts.uiScale));
  const popMs = motionMs(TRANSFER_POP_MS);
  const arcMs = motionMs(TRANSFER_ARC_MS);
  const settleMs = motionMs(TRANSFER_SETTLE_MS);

  gsap.set(chip, {
    x: opts.from.x - w / 2,
    y: opts.from.y - h / 2,
    scale: transferChipScaleAt(0),
    rotation: startTilt,
    transformOrigin: 'center center',
    autoAlpha: 0,
  });

  const touched = guarded((done) => {
    const tl = gsap.timeline({delay: opts.delayMs / 1000, onComplete: done});
    // Materialize at the source — the chip is BORN there, never teleported in.
    tl.to(chip, {autoAlpha: 1, duration: popMs / 1000, ease: 'power1.out'}, 0);
    // ONE progress tween drives the whole flight through the model's arc —
    // position, the bloom-then-approach scale and the unwinding tilt behave
    // as one physical object on one curve.
    const prog = {q: 0};
    tl.to(prog, {
      q: 1,
      duration: (popMs + arcMs) / 1000,
      ease: 'power1.inOut',
      onUpdate: () => {
        const p = transferArcPoint(plan, prog.q);
        gsap.set(chip, {
          x: p.x - w / 2,
          y: p.y - h / 2,
          scale: transferChipScaleAt(prog.q),
          rotation: startTilt * (1 - prog.q), // fully square at the landing
        });
      },
    }, 0);
    // Touchdown: microscopic damped weight — felt, not seen.
    tl.to(chip, {y: `+=${settlePx}`, duration: 0.08, ease: 'power1.out'});
    tl.to(chip, {y: `-=${settlePx}`, duration: (settleMs / 1000) - 0.08, ease: 'power2.out'});
  }, opts.delayMs + popMs + arcMs + settleMs);

  const finished: Promise<'landed' | 'done'> = touched.then(() => {
    if (opts.hold) {
      return 'landed' as const;
    }
    return absorbChip(piece, opts.to, motionMs(TRANSFER_BEAT_MS)).then(() => 'done' as const);
  });

  return {touched, finished};
}

/**
 * The contact beat + absorb: a pointed one-shot halo wakes on the
 * destination zone while the chip is drawn INTO it — short, material,
 * no bloom, no bounce.
 */
function absorbChip(piece: TransferStagePiece, at: TransferPoint, beatMs: number): Promise<void> {
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
      tl.to(piece.beat, {scale: 1.35, autoAlpha: 0, duration: beatMs / 1000, ease: 'power2.out'}, 0);
    }
    tl.to(piece.chip, {scale: 0.5, autoAlpha: 0, duration: Math.min(0.24, beatMs / 1000), ease: 'power2.in'}, 0.02);
  }, beatMs + 200);
}

/** Absorb a RESTING (hold-mode) chip — the sale's post-commit settle. */
export function settleTransferChip(piece: TransferStagePiece, at: TransferPoint, beatMs: number): Promise<void> {
  return absorbChip(piece, at, beatMs);
}

/** Abort/unmount: kill the piece's tweens (idempotent). */
export function killTransferPiece(piece: TransferStagePiece): void {
  gsap.killTweensOf(piece.chip);
  if (piece.beat !== undefined) {
    gsap.killTweensOf(piece.beat);
  }
}
