/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE WALK OF THE AGENDA TRACK — ONE PHRASE for the track's three engines
 * (TR04 Minority Representation, docs/TURMOIL_REDUX_MINORITY_REPRESENTATION.md):
 * the sitting's winner step, the chairman quest's step and a card's «advance
 * N steps» are the same walk with a different N.
 *
 * The phrase, per step k of the record:
 *   LEAD    — the segment k−1 → k lights (`AGENDA_SEGMENT_MS`, ONE segment,
 *             never the whole distance);
 *   LEG     — the marker glides that one segment (the shared marker director's
 *             own phrase: charge on the FIRST leg only — after that the cube
 *             is «in hand»: lift → glide → arrive → lock → pulse);
 *   LANDING — the marker LOCKS on k: the hold moves to {from: k}, the node
 *             blooms, the band grows the step's chip;
 *   REWARD  — only what THIS step pays, and only now that the cube has
 *             touched (parliament law 11): a TR step flies its chip from the
 *             step's node to the rail and the counter ticks on contact; a card
 *             step lets its parked reveal go; an influence step pays nothing
 *             on the spot — the level is READ, the tier ticks it. The next
 *             lead waits for the reward to LAND (a hold, never a timer);
 *   GAP     — `AGENDA_BEAT_GAP_MS` before the next lead;
 * and after the LAST leg: RELEASE (the proxy crossfades onto the real cube)
 * → `onLanded`. For N = 1 this is byte-for-byte the sitting's ПОВЕСТКА beat
 * (lead 150 ms + the shared glide ≈ 1.07 s, then the bonus off the reached
 * step) — the window `console-parliament-sitting-v4.spec.ts` asserts.
 *
 * The DOM is the tier's (`ConsoleParliamentAgenda.playAgendaWalk` measures
 * the rows, owns the proxy, hides the cubes, moves the hold); this file owns
 * the ORDER and the WAITS. Beats ride the motion clock (`parliamentBeat.ts`),
 * never a wall clock; `skip()` is idempotent and tears down the beats — the
 * tier's own teardown takes the poses to their final state.
 */
import {reactive, watch} from 'vue';
import {Color} from '@/common/Color';
import {AgendaAdvanceStep} from '@/common/parliament/ParliamentTypes';
import {markerTimings, reducedMarkerTimings} from '@/client/console/hydroMarker/hydroMarkerModel';
import {runResourceTransfers} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {pendingRevealEvents} from '@/client/components/drawnCards/drawnCardsState';
import {agendaTrackOnScreen, armBoardCardBonus, boardCardBonusState, isAgendaReveal} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import {onIntakeTouchdown} from '@/client/console/handDock/handDeliveryState';
import {ParliamentBeat, scheduleParliamentBeat} from './parliamentBeat';
import {agendaCardOwed, flushAgendaBonus, markAgendaBonusLanded, markAgendaCardLifted, takeAgendaBonus} from './parliamentRewardBeat';

/**
 * THE WALK'S MOTION STATE its holders read (the tier's glide hold, the
 * section's walk hold): a CARD step whose reward is in the PLAYER's hands —
 * the cover has been lifted off the node, the card flies to the viewer, the
 * viewer waits for «Взять», the card flies to the dock — is not animation the
 * walk owns, so the walk's animation holds STAND DOWN for it (a wall clock
 * over a player's reading is a wedge net over nothing) and stand up again
 * for the legs that follow. `awaitingCard` names the step while that take is
 * owed; `undefined` otherwise.
 */
export const agendaWalkMotion = reactive({
  awaitingCard: undefined as number | undefined,
});

/** The segment lead — ONE segment lights before the marker leaves (the sitting's own constant, v4). */
export const AGENDA_SEGMENT_MS = 150;
/** The pause between a step's landed reward and the next lead. */
export const AGENDA_BEAT_GAP_MS = 250;
/** The read after the last landing — the `CARD_EFFECT_READ_MS` class: the result is looked at before the surface leaves. */
export const AGENDA_WALK_READ_MS = 520;
/** The walk's animation hold: the one-step budget, plus one per further step. */
export const AGENDA_WALK_HOLD_BASE_MS = 5000;
export const AGENDA_WALK_HOLD_STEP_MS = 3000;

export type AgendaWalkRecordLike = {
  player: Color;
  from: number;
  to: number;
  steps: ReadonlyArray<AgendaAdvanceStep>;
};

/** ONE leg of the walk: the segment the marker crosses, and what the step it reaches is. */
export type AgendaWalkLeg = {
  index: number;
  from: number;
  to: number;
  /** The marker CHARGES before it leaves (the first leg only — after that the cube is already in hand). */
  charge: boolean;
  last: boolean;
  step: AgendaAdvanceStep;
};

/** THE PLAN (pure): the legs of a record, in order — one per recorded step. */
export function agendaWalkPlan(record: AgendaWalkRecordLike): Array<AgendaWalkLeg> {
  const steps = record.steps.length > 0 ? record.steps : (record.to > record.from ? [{to: record.to}] : []);
  return steps.map((step, index) => ({
    index,
    from: index === 0 ? record.from : steps[index - 1].to,
    to: step.to,
    charge: index === 0,
    last: index === steps.length - 1,
    step,
  }));
}

/** The walk's hold ceiling: the one-step budget, plus one per further step. */
export function agendaWalkHoldMs(record: AgendaWalkRecordLike): number {
  const legs = Math.max(1, agendaWalkPlan(record).length);
  return AGENDA_WALK_HOLD_BASE_MS + AGENDA_WALK_HOLD_STEP_MS * (legs - 1);
}

/**
 * THE BUDGET (pure, base ms): what the phrase costs before any reward — the
 * lead, the marker director's own leg (charge on the first leg only), the
 * gaps between legs. What the storyboards and the specs reason about.
 */
export function agendaWalkBudgetMs(record: AgendaWalkRecordLike, reduced = false): number {
  const t = reduced ? reducedMarkerTimings() : markerTimings();
  const legs = agendaWalkPlan(record);
  let total = 0;
  for (const leg of legs) {
    total += AGENDA_SEGMENT_MS + (leg.charge ? t.chargeMs : 0) + t.liftMs + t.glideMs + t.arriveMinMs + t.lockMs;
    if (!leg.last) {
      total += AGENDA_BEAT_GAP_MS;
    }
  }
  return total + (legs.length > 0 ? t.pulseMs : 0);
}

/** What the tier gives the phrase — the DOM half, one callback per physical act. */
export type AgendaWalkStage = {
  /** The segment the marker is about to cross lights. */
  onLead: (leg: AgendaWalkLeg) => void;
  /** Glide ONE leg; `onLocked` fires when the marker has LOCKED on `leg.to` (the node may bloom, the hold has moved). */
  glide: (leg: AgendaWalkLeg, onLocked: () => void) => void;
  /** After the LAST leg's lock: the proxy crossfades onto the real cube; `onGone` when it has. */
  release: (onGone: () => void) => void;
  /** The reward of an INTERMEDIATE step — `done` once it has LANDED (a chip on the rail, a cover released; at once for influence). */
  rewardStep: (leg: AgendaWalkLeg, done: () => void) => void;
  /** Every landed step, in order (the band grows). */
  onStep?: (leg: AgendaWalkLeg) => void;
  /** The marker has settled on the last step and the proxy is gone. The LAST step's reward is the caller's. */
  onLanded: () => void;
  /**
   * The clock of the phrase's own waits (the lead, the gaps between legs) —
   * the motion clock by default; the sitting hands the one «дожать» fires at
   * once (`scheduleHurriedParliamentBeat`), so a press mid-lead moves the
   * marker NOW, as the sitting's every other wait does.
   */
  beat?: AgendaWalkBeatScheduler;
};

/** A beat on the motion clock, or on one a director may hurry. */
export type AgendaWalkBeatScheduler = (delayMs: number, fire: () => void) => ParliamentBeat;

/** What a CALLER of the tier's walk hands it (`ConsoleParliamentAgenda.playAgendaWalk`) — the landing, and its clock if it owns one. */
export type AgendaWalkHooks = {
  onLanded: () => void;
  beat?: AgendaWalkBeatScheduler;
};

export type AgendaWalkHandle = {
  /** Tear the beats down (idempotent) — the tier takes the poses to their end. */
  skip: () => void;
  /** The walk has NOT finished (its last leg is not released yet). */
  active: () => boolean;
};

/**
 * RUN the phrase over `stage`. Every wait is a real callback (the leg's lock,
 * the reward's landing) or a beat on the motion clock; nothing here reads
 * the DOM.
 */
export function runAgendaWalk(record: AgendaWalkRecordLike, stage: AgendaWalkStage): AgendaWalkHandle {
  const legs = agendaWalkPlan(record);
  let killed = false;
  let done = false;
  const beats: Array<ParliamentBeat> = [];
  const schedule = stage.beat ?? scheduleParliamentBeat;
  const beat = (ms: number, fn: () => void): void => {
    if (killed) {
      return;
    }
    beats.push(schedule(ms, () => {
      if (!killed) {
        fn();
      }
    }));
  };
  const finish = (): void => {
    if (killed || done) {
      return;
    }
    done = true;
    stage.onLanded();
  };
  const play = (index: number): void => {
    if (killed) {
      return;
    }
    const leg = legs[index];
    if (leg === undefined) {
      finish();
      return;
    }
    stage.onLead(leg);
    beat(AGENDA_SEGMENT_MS, () => {
      stage.glide(leg, () => {
        if (killed) {
          return;
        }
        stage.onStep?.(leg);
        if (leg.last) {
          stage.release(() => finish());
          return;
        }
        // The next segment waits for THIS step's reward to land — the cause before the effect, a hold, never a clock.
        stage.rewardStep(leg, () => beat(AGENDA_BEAT_GAP_MS, () => play(index + 1)));
      });
    });
  };
  if (legs.length === 0) {
    finish();
  } else {
    play(0);
  }
  return {
    skip: () => {
      if (killed) {
        return;
      }
      killed = true;
      beats.splice(0).forEach((b) => b.kill());
    },
    active: () => !killed && !done,
  };
}

/**
 * THE DEFAULT REWARD OF A STEP — what the ledger owes for it, delivered from
 * the step's own node on `root`: a TR step's chip leaves the step's printed
 * rating glyph for the rail (the counter ticks on contact —
 * `markAgendaBonusLanded(step)` releases exactly that step's hold); a CARD
 * step arms the cover scene off THIS node now that the marker has LOCKED on
 * it, and `done` fires when the card has LANDED in the dock
 * (`deliverAgendaCardStep`); nothing owed → nothing flies. An unmeasurable
 * step releases the hold at once (honestly late, never lost). `generation`
 * undefined accepts any owed entry of the step (the tier's own watcher path).
 */
export function deliverAgendaStepReward(root: HTMLElement, generation: number | undefined, step: number, done: () => void): void {
  const bonus = takeAgendaBonus(generation, step);
  if (bonus === undefined) {
    done();
    return;
  }
  if (bonus.kind === 'card') {
    deliverAgendaCardStep(step, done);
    return;
  }
  if (bonus.spec === undefined) {
    markAgendaBonusLanded(step);
    done();
    return;
  }
  const node = root.querySelector<HTMLElement>(`.con-parl__step[data-step="${step}"] .con-parl__step-res`) ??
    root.querySelector<HTMLElement>(`.con-parl__step[data-step="${step}"]`);
  const r = node?.getBoundingClientRect();
  if (r === undefined || r.width < 2) {
    flushAgendaBonus('unmeasurable-step');
    done();
    return;
  }
  void runResourceTransfers({
    specs: [bonus.spec],
    source: {point: {x: r.left + r.width / 2, y: r.top + r.height / 2}},
    arrival: 'auto',
    onArrive: () => markAgendaBonusLanded(step),
  }).then(done, done);
}

/**
 * THE CARD STEP'S REWARD (TR37 — the card step in the MIDDLE of a walk, and
 * the same path for a card step LAST): the marker has LOCKED on `step`, so
 * the cover scene is ARMED off that very node NOW — «the marker sat on k» is
 * the scene's signal, never «the track has settled» (TR04's «honestly late»).
 * The scene lifts the cover, flies it to the viewer, the viewer waits for
 * «Взять», the card flies into the dock — and `done` fires on that TOUCHDOWN
 * (the next leg waits for the reward to LAND, as a TR step's waits for its
 * chip to touch the rail; the owner's decision 4). Every wait is a real
 * signal: the dock's touchdown of one of THIS batch's cards, the ledger's
 * entry leaving the queue (the touchdown, a flush, the registry's ceiling),
 * the scene's own end. Nothing to lift (an empty deck dealt no card), no
 * track on screen, reduced motion, or another scene owning the layer →
 * released at once, honestly — the standard draw presents what there is.
 */
function deliverAgendaCardStep(step: number, done: () => void): void {
  const batch = pendingRevealEvents().find((e) => isAgendaReveal(e.source) && e.cards.length > 0);
  if (batch === undefined || !agendaTrackOnScreen() || consoleReducedMotionActive() || boardCardBonusState.active) {
    markAgendaBonusLanded(step);
    done();
    return;
  }
  const names = batch.cards.map((c) => c.name);
  armBoardCardBonus({kind: 'agenda-step', step, landed: true});
  agendaWalkMotion.awaitingCard = step;
  let finished = false;
  const finish = (): void => {
    if (finished) {
      return;
    }
    finished = true;
    stopOwed();
    stopScene();
    offTouchdown();
    if (agendaWalkMotion.awaitingCard === step) {
      agendaWalkMotion.awaitingCard = undefined;
    }
    done();
  };
  // THE TOUCHDOWN: one of the batch's cards landed in the dock — the step's reward has LANDED.
  const offTouchdown = onIntakeTouchdown((name) => {
    if (names.includes(name)) {
      markAgendaBonusLanded(step);
    }
  });
  // The entry leaves the queue — by the touchdown above, by a flush (the section unmounts, the motion is cut), or
  // by the registry's ceiling: the walk goes on either way, never earlier.
  const stopOwed = watch(() => agendaCardOwed(step), (owed) => {
    if (!owed) {
      finish();
    }
  }, {flush: 'sync'});
  // The scene ended before its cover lifted (no measurable node, its own safety): the park may not outlive the
  // scene — lifted or not, the batch is free for the standard draw to present, and the walk still waits for the
  // card to land.
  const stopScene = watch(() => boardCardBonusState.active, (active) => {
    if (!active) {
      markAgendaCardLifted(step);
    }
  }, {flush: 'sync'});
}
