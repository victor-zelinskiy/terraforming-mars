/*
 * THE ASSEMBLY DIRECTOR — the GSAP half of «one press drew from several places» («ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР»,
 * Ф3): ONE choreography for every host that deals a merged batch — the deck-draw layer (a standalone scene, a
 * workspace it serves, the guest run behind the board card-bonus scene) and the card-actions composer's own
 * execution beat. The pure plan is `intakeAssemblyPlan.ts`; this module turns it into flights and never decides
 * the order or the places itself.
 *
 * A HOST provides what only it has: its stage rect (the room the trigger seat is solved in), the trigger faces it
 * rendered (one per `card`-origin run, by the run's index), and whether a board cell is measurable on its screen.
 * Every run flies through `runBatchArrival({from})` — the SAME director every deck flight in the fork uses — so a
 * card dealt by a trigger and a card dealt by the deck are physically the same object.
 */
import {CardName} from '@/common/cards/CardName';
import {CardIntakeSegment} from '@/common/models/CardDrawRevealModel';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {ArrivalOrigin, BatchArrivalHandle, runBatchArrival} from '@/client/console/consoleBatchArrivalMotion';
import {recedeReactor, riseReactor} from '@/client/console/cardReaction/cardReactionStage';
import {findPrintedCardsIcon} from '@/client/console/consoleActionCommitMotion';
import {cardArrivalTimings, reducedCardArrivalTimings} from '@/client/console/consoleCardArrival';
import {restingRectOf} from '@/client/console/cardFlight/landingRect';
import {noteTransferTrail} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {
  IntakeAssemblyPlan, IntakeAssemblyTimings, IntakeRun, RectLike, intakeAssemblyTimings, planIntakeAssembly,
  reducedIntakeAssemblyTimings, rowRectOf, triggerSeatRect,
} from '@/client/console/cardIntake/intakeAssemblyPlan';
import {consoleSessionScope} from '@/client/console/session/consoleSession';
import {motionSpan} from '@/client/console/session/sessionWaits';

export type IntakeAssemblyHost = {
  /** The room the trigger seat is solved in (a workspace's band, the opening, the viewport). */
  stageRect: () => RectLike;
  /** The trigger face the host rendered for a run (by the run's index) — `null` while it is not in the DOM. */
  triggerEl: (runIndex: number) => HTMLElement | null;
  /** A board cell's printed card bonus, measurable on THIS screen — `undefined` when the board is covered. */
  cellIconRect: (spaceId: string) => DOMRect | undefined;
};

/** One trigger face the host must render (the assembly names them; the host owns the DOM). */
export type IntakeTriggerFace = {key: string, name: CardName, run: number};

/** PLAN the assembly for a batch on this host: the runs, and the trigger faces the host must render before playing. */
export function planAssemblyFor(
  segments: ReadonlyArray<CardIntakeSegment>,
  host: Pick<IntakeAssemblyHost, 'cellIconRect'>,
  stageCard: string | undefined,
): {plan: IntakeAssemblyPlan, triggers: Array<IntakeTriggerFace>} {
  const reduced = consoleReducedMotionActive();
  const tileSegments = segments.filter((s) => s.source?.type === 'tile' && s.source.spaceId !== undefined);
  const boardVisible = tileSegments.length > 0 && tileSegments.every((s) =>
    s.source?.type === 'tile' && s.source.spaceId !== undefined && host.cellIconRect(s.source.spaceId) !== undefined);
  const plan = planIntakeAssembly(
    {segments, stageCard, boardVisible},
    reduced ? reducedCardArrivalTimings() : cardArrivalTimings(),
    reduced ? reducedIntakeAssemblyTimings() : intakeAssemblyTimings());
  const triggers = plan.runs.filter((r) => r.origin.kind === 'card').map((r) => ({
    key: `${r.index}:${r.origin.kind === 'card' ? r.origin.card : ''}`,
    name: r.origin.kind === 'card' ? r.origin.card : ('' as CardName),
    run: r.index,
  }));
  return {plan, triggers};
}

export type IntakeAssemblyArgs = {
  plan: IntakeAssemblyPlan;
  /** Play the runs whose first card is at or past this index (the cards before were flown by another scene). */
  fromCard?: number;
  /** …and before this index (exclusive) — the runs from here on belong to another scene (the search theatre, R4). */
  untilCard?: number;
  /** One flyer pair per card of the batch, in batch order (the host's own proxies). */
  pairs: ReadonlyArray<{proxy: HTMLElement, flip: HTMLElement}>;
  /** The prepared landing slots, in the same order. */
  slots: ReadonlyArray<HTMLElement>;
  host: IntakeAssemblyHost;
  /** The host is still the batch's presenter (a torn-down host stops every scheduled beat). */
  alive: () => boolean;
  onCardPeeled?: () => void;
  /** The first run's first card is on its final approach — the host cues its frame. */
  onFirstApproach?: () => void;
  /** The host owns the deck counter: the first card of a DECK-origin run has left the pile. */
  onDeckDeparted?: () => void;
  /** Every run has settled and the last trigger has receded. */
  onDone: () => void;
};

export type IntakeAssemblyHandle = {
  /** Abort: kills every run's flight and clears the timers; fires nothing. */
  kill: () => void;
};

/** WHERE a run's cards are born: the trigger's printed icon, the cell's printed bonus, or the deck (undefined). */
function originOf(run: IntakeRun, host: IntakeAssemblyHost): ArrivalOrigin | undefined {
  if (run.origin.kind === 'card') {
    const face = host.triggerEl(run.index);
    if (face !== null) {
      const icon = findPrintedCardsIcon(face);
      const rect = (icon ?? face).getBoundingClientRect();
      if (rect.width > 2 && rect.height > 2) {
        return {rect, kind: 'card'};
      }
    }
    return undefined;
  }
  if (run.origin.kind === 'board-cell') {
    const rect = host.cellIconRect(run.origin.spaceId);
    return rect === undefined ? undefined : {rect, kind: 'cell'};
  }
  return undefined;
}

/**
 * THE TRIGGER RISES THROUGH THE ONE PRIMITIVE («СРАБАТЫВАНИЕ КАРТЫ — ОДИН ФРЕЙМВОРК»): the assembly scene's trigger
 * and a reacting card are the same physical move — `cardReactionStage.riseReactor` / `recedeReactor`, the numbers this
 * scene set (surface 260 / recede 220; reduced 140 / 120). The assembly's own timings map onto the primitive's.
 */
function surfaceTrigger(face: HTMLElement, seat: RectLike, t: IntakeAssemblyTimings, reduced: boolean): Promise<void> {
  return riseReactor(face, seat, {riseMs: t.surfaceMs, holdMs: t.holdMs, settleMs: 0, recedeMs: t.recedeMs, overlapMs: t.overlapMs, staggerMs: 0}, reduced);
}

function recedeTrigger(face: HTMLElement, t: IntakeAssemblyTimings, reduced: boolean): void {
  void recedeReactor(face, undefined, {riseMs: t.surfaceMs, holdMs: t.holdMs, settleMs: 0, recedeMs: t.recedeMs, overlapMs: t.overlapMs, staggerMs: 0}, reduced);
}

/**
 * PLAY the runs. Every run leaves from its own place on the plan's clock; a trigger surfaces before its run deals
 * and recedes after its last landing; `onDone` fires once the last run has settled and its trigger has receded.
 *
 * A TRIGGER'S RUN DEALS OFF THE TRIGGER'S OWN RISE, never off a parallel timer (`.claude/rules/animations.md` § A
 * MOTION IS RIGHT ON A SLOW FRAME BY CONSTRUCTION, law 2). The rise waits for its posed face to be PAINTED (two
 * frames) before it tweens; the deal used to fire on its own wall-clock timer `surfaceMs + holdMs` after the
 * surface's — on a starved renderer the two paint frames outlasted that, the card left a face still at opacity 0,
 * landed, and the landing's recede killed the rise before it was half way: the card came out of an invisible
 * university (Natural Preserve under Mars University — the trigger never painted). So the runs are CHAINED: each
 * waits its planned offset from the previous run's DEAL, and a trigger's run deals `holdMs` after its rise has
 * COMPLETED (the hold on the rise's own GSAP clock) — a late rise pushes its run, and every run after it, by exactly
 * its lateness; a trigger that cannot surface deals at its planned moment.
 */
export function playIntakeAssembly(args: IntakeAssemblyArgs): IntakeAssemblyHandle {
  const reduced = consoleReducedMotionActive();
  const t = reduced ? reducedIntakeAssemblyTimings() : intakeAssemblyTimings();
  const runs = args.plan.runs.filter((r) => r.first >= (args.fromCard ?? 0) && r.first < (args.untilCard ?? Number.POSITIVE_INFINITY));
  // The scene's beats — GUARANTEED releases of the session (PLAN §10 · C1): each links an `await` of this sequence or
  // a callback its host waits for, so none is ever dropped; `kill` disarms them all (fires nothing), and `alive()`
  // guards every one that comes due.
  const timers: Array<() => void> = [];
  const handles: Array<BatchArrivalHandle> = [];
  let dead = false;
  const kill = () => {
    dead = true;
    timers.forEach((disarm) => disarm());
    timers.length = 0;
    handles.forEach((h) => h.kill());
    handles.length = 0;
  };
  if (runs.length === 0 || typeof window === 'undefined') {
    args.onDone();
    return {kill};
  }
  const alive = () => !dead && args.alive();
  const base = runs[0].surfaceAtMs ?? runs[0].dealAtMs;
  const row = rowRectOf(args.slots.map((el) => restingRectOf(el)));
  const seat = row === undefined ? undefined : triggerSeatRect(args.host.stageRect(), row);
  let settled = 0;
  let approached = false;
  const sleep = (ms: number) => new Promise<void>((resolve) => {
    timers.push(consoleSessionScope().guarantee(Math.max(0, ms), 'the beat before a run of the intake deals', resolve));
  });
  const deal = (run: IntakeRun) => {
    const from = originOf(run, args.host);
    const handle = runBatchArrival({
      cards: args.pairs.slice(run.first, run.first + run.count),
      slots: args.slots.slice(run.first, run.first + run.count),
      mode: 'in-flight-reveal',
      from,
      onCardPeeled: () => args.onCardPeeled?.(),
      onDeparted: () => {
        if (from === undefined) {
          args.onDeckDeparted?.();
        }
      },
      onLanded: () => {
        const face = args.host.triggerEl(run.index);
        if (run.origin.kind === 'card' && face !== null) {
          recedeTrigger(face, t, reduced);
        }
      },
      onSettled: () => {
        settled++;
        if (settled === runs.length) {
          // The last trigger's recede is the scene's tail.
          timers.push(consoleSessionScope().guarantee(run.origin.kind === 'card' ? motionMs(t.recedeMs) : 0, 'the last trigger recedes (the intake is done)', () => {
            if (alive()) {
              args.onDone();
            }
          }));
        }
      },
    });
    handles.push(handle);
    if (!approached) {
      approached = true;
      const firstLand = handle.plan.beats[0]?.landAtMs ?? 0;
      timers.push(consoleSessionScope().guarantee(Math.max(0, motionMs(firstLand) - motionMs(70)), 'the first card\'s final approach (the host cues its frame)', () => {
        if (alive()) {
          args.onFirstApproach?.();
        }
      }));
    }
  };
  void (async () => {
    // The plan's moment of the previous run's deal — every run waits its planned OFFSET from that deal's real moment.
    let lastDealAt = base;
    for (const run of runs) {
      await sleep(motionMs((run.surfaceAtMs ?? run.dealAtMs) - lastDealAt));
      if (!alive()) {
        return;
      }
      if (run.surfaceAtMs !== undefined) {
        const face = args.host.triggerEl(run.index);
        if (face !== null && seat !== undefined) {
          await surfaceTrigger(face, seat, t, reduced);
          if (!alive()) {
            return;
          }
          // The read beat between the surfaced face and its first card — on the rise's own clock.
          await motionSpan(motionMs(t.holdMs));
        } else {
          // No face to raise (an unmeasurable stage): the run deals at its planned moment, and the trail says why.
          noteTransferTrail('intake:no-trigger', {run: run.index, face: face !== null, seat: seat !== undefined});
          await sleep(motionMs(run.dealAtMs - run.surfaceAtMs));
        }
        if (!alive()) {
          return;
        }
      }
      lastDealAt = run.dealAtMs;
      deal(run);
    }
  })();
  return {kill};
}
