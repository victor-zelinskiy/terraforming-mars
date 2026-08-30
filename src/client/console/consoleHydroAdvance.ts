/*
 * CONSOLE HYDRO ADVANCE BATCH — the pure response assembly for «Укрепить
 * гидросеть» (the console shell's submitHydroAdvance). Extracted so the batch
 * shape is unit-guarded, exactly like the play/action composers' builders.
 *
 * The server contract (DeltaProjectExpansion.advance): the activate option is
 * answered first, then the `{deltaProject, amount}` MOVE step. Every
 * stage-level ask the player pre-answered — the reward choice (pos 1/2), the
 * repeated action (pos 7, its composed nested responses included), the animal
 * target (pos 9) — rides the move step's own `answers` field, one entry per
 * position, CONSUMED by the server's reward resolution itself. Nothing
 * stage-level rides the response stream any more: a positional stream had
 * three silent loss modes (parked behind the stage-5 hidden draw, the whole
 * remainder wiped by one value refusal, a same-shaped entry swallowed by the
 * wrong stage's prompt), and each of them ended as a re-asked question the
 * player had already answered.
 *
 * The ONE remaining stream consumer is the PROMPT door (`hydroAdvanceTail`,
 * used by submitHydroBonus): a card-granted offer answers with a bare
 * OrOptions index — there is no move step to carry the plan — and its
 * single-step advance defers its stage's asks inline, where the positional
 * replay is unambiguous.
 *
 * A repeat composition whose `chosenCard` no longer matches the plan's
 * `selectedCard` is STALE (the plan moved / the preview refreshed) — it
 * degrades to the bare card pick, whose follow-ups then arrive as native
 * sequential tasks (the legacy-supported contract). Never a silent drop of
 * the reward itself.
 */
import {CardName} from '@/common/cards/CardName';
import type {DeltaStageAnswer, InputResponse} from '@/common/inputs/InputResponse';
import {RepeatComposed, buildActionBatch, repeatActionResponses} from '@/client/console/consoleActionComposer';
import type {ConsoleRepeatPickResult} from '@/client/console/consoleRepeatPick';

export type HydroAdvancePayload = {
  spend: number;
  /**
   * Steel spent 1:1 in place of energy (Delta Works) — the ONE linked value;
   * the energy share is the remainder. Absent/0 = energy-only, and the wire
   * key is then omitted so the batch stays byte-identical to the historical
   * shape. Card moves (DP04) never set it: their toll is energy-only.
   */
  steelSpend?: number;
  rewardChoice: number | undefined;
  selectedCard?: CardName;
  /** The composed stage-7 repeat pick (console-only pre-collection). */
  repeat?: ConsoleRepeatPickResult;
  /**
   * The player CONSCIOUSLY declined the landed stage's target reward (pos 7
   * repeat / pos 9 animals) — the warned second press. Rides the
   * `{deltaProject}` step as `waiveReward`, so the server defers no follow-up
   * SelectCard: «если не выбрал — значит не надо», with no prompt after the
   * confirm. Never set alongside `selectedCard`.
   */
  waiveTarget?: boolean;
  /**
   * A MULTI-REWARD TRAVERSAL'S ORDERED ANSWERS (Delta Surge) — one entry per
   * rewarded stage that ASKS, in path order. Present ⇒ the tail is built from
   * THIS (the single-landing fields above are the historical shape and are
   * ignored), because the server defers one reward step per stage in exactly
   * this order. A stage-5 crossing contributes NOTHING here: its answer is
   * hidden information, asked at the stop (the batch parks behind it).
   */
  traversalAnswers?: ReadonlyArray<HydroTraversalAnswer>;
  /** Per-position conscious declines of target-bearing stages — rides the
   *  move step as `waivedSteps` (the server unions it with `waiveReward`). */
  waivedSteps?: ReadonlyArray<number>;
  /**
   * THE DECLARED RESOURCE PLAN — the pre-selected repeated action(s) (and
   * the choice answers whose gains fund them), each at its stage. Rides the
   * MOVE step: the server re-walks the ordered projection against it BEFORE
   * any mutation, so a starving mix refuses atomically with nothing spent.
   */
  plannedActions?: ReadonlyArray<{position: number, card: CardName}>;
  plannedChoices?: ReadonlyArray<{position: number, choice: number}>;
  /** The landing position — the single-landing answer's address on the move
   *  step (a traversal's answers carry their own positions). */
  toPosition?: number;
};

/** One traversal stage's pre-collected answer. */
export type HydroTraversalAnswer = {
  position: number;
  /** Choice stages (1/2): the picked alternative index. */
  rewardChoice?: number;
  /** Target stages (7/9): the picked card. */
  selectedCard?: CardName;
  /** Stage 7: the composed repeat (byte-parity with the landing case). */
  repeat?: ConsoleRepeatPickResult;
};

/**
 * THE PROMPT DOOR'S RESPONSE STREAM — everything the server defers after a
 * card-granted offer is taken: the reward choice (pos 1/2) and the card pick
 * (pos 7 reuse-action / pos 9 animal target, the latter possibly carrying the
 * composed repeat tail). The offer answers with a bare OrOptions index — there
 * is no move step to carry the invocation plan — and its single-step advance
 * defers its stage's asks inline, where the positional replay is unambiguous
 * (no hidden-information stop can stand between an answer and its prompt).
 *
 * The MOVE-STEP doors (the player's own advance, a card's chosen advance) no
 * longer ride this: their whole plan is `answers` on the move step itself
 * (see `moveStepAnswers`), consumed by the server's reward resolution.
 */
export function hydroAdvanceTail(payload: HydroAdvancePayload): Array<unknown> {
  // A traversal's answers ride in PATH ORDER — the server's per-stage reward
  // steps defer in exactly that order, so position K's answer meets position
  // K's prompt. Each entry reuses the single-landing shapes verbatim.
  if (payload.traversalAnswers !== undefined) {
    const tail: Array<unknown> = [];
    for (const a of payload.traversalAnswers) {
      if (a.rewardChoice !== undefined) {
        tail.push({type: 'or' as const, index: a.rewardChoice, response: {type: 'option' as const}});
      }
      if (a.selectedCard !== undefined) {
        if (a.repeat !== undefined && a.repeat.chosenCard === a.selectedCard) {
          tail.push(...repeatActionResponses(a.repeat.chosenCard, a.repeat.composed));
        } else {
          tail.push({type: 'card' as const, cards: [a.selectedCard]});
        }
      }
    }
    return tail;
  }
  const tail: Array<unknown> = [];
  if (payload.rewardChoice !== undefined) {
    tail.push({type: 'or' as const, index: payload.rewardChoice, response: {type: 'option' as const}});
  }
  if (payload.selectedCard !== undefined) {
    if (payload.repeat !== undefined && payload.repeat.chosenCard === payload.selectedCard) {
      // The premium stage-7 flow: the card pick + the chosen action's own
      // composed responses in defer order (byte-parity with ProjInsp/Viron).
      tail.push(...repeatActionResponses(payload.repeat.chosenCard, payload.repeat.composed));
    } else {
      tail.push({type: 'card' as const, cards: [payload.selectedCard]});
    }
  }
  return tail;
}

/**
 * THE REPEATED ACTION'S OWN COMPOSED RESPONSES, WITHOUT the root card pick —
 * what rides `DeltaStageAnswer.repeatResponses`. The server consumes the root
 * pick from the answer itself and runs `card.action()`; these are the answers
 * to the prompts THAT raises, in defer order — byte-identical to what follows
 * the `{card:[chosen]}` pick in a direct activation's batch (the same
 * `buildActionBatch`, with an empty prefix).
 */
export function repeatComposedResponses(composed: RepeatComposed): Array<unknown> {
  return buildActionBatch({
    performPath: [],
    cardName: CardName.DELTA_PROJECT, // unused: the empty prefix wins
    prefix: [],
    branchIndex: composed.branchIndex,
    preResponses: composed.preResponses,
    optionResponse: composed.optionResponse,
    stepResponses: composed.stepResponses,
  });
}

/**
 * THE MOVE STEP'S INVOCATION PLAN — one `DeltaStageAnswer` per pre-answered
 * stage ask, consumed server-side by the reward resolution itself. A stale
 * composed repeat (chosenCard ≠ the drafted pick) degrades to the bare card
 * answer — the action's own inputs then arrive as embedded runtime follow-ups.
 */
function moveStepAnswers(payload: HydroAdvancePayload): Array<DeltaStageAnswer> | undefined {
  const toWire = (a: HydroTraversalAnswer): DeltaStageAnswer | undefined => {
    const entry: {
      position: number, rewardChoice?: number, selectedCard?: CardName,
      repeatResponses?: ReadonlyArray<InputResponse>,
    } = {position: a.position};
    let has = false;
    if (a.rewardChoice !== undefined) {
      entry.rewardChoice = a.rewardChoice;
      has = true;
    }
    if (a.selectedCard !== undefined) {
      entry.selectedCard = a.selectedCard;
      has = true;
      if (a.repeat !== undefined && a.repeat.chosenCard === a.selectedCard) {
        const composed = repeatComposedResponses(a.repeat.composed);
        if (composed.length > 0) {
          // The composed responses are heterogeneous wire shapes — typed at
          // the boundary exactly as the batch route consumes them.
          entry.repeatResponses = composed as ReadonlyArray<InputResponse>;
        }
      }
    }
    return has ? entry : undefined;
  };
  if (payload.traversalAnswers !== undefined) {
    const answers = payload.traversalAnswers
      .map(toWire)
      .filter((a): a is DeltaStageAnswer => a !== undefined);
    return answers.length > 0 ? answers : undefined;
  }
  if (payload.toPosition === undefined) {
    return undefined;
  }
  const single = toWire({
    position: payload.toPosition,
    rewardChoice: payload.rewardChoice,
    selectedCard: payload.selectedCard,
    repeat: payload.repeat,
  });
  return single !== undefined ? [single] : undefined;
}

/**
 * Assemble a full advance batch from an arbitrary PREFIX: `[...prefix,
 * {deltaProject, amount, answers?}]` — the whole invocation plan rides the
 * move step (see the module header); the response stream past it is empty.
 *
 * The prefix is the only thing the two AUTHORISED ways onto the track differ
 * by. The player's own action authorises with ONE response (the wrapped
 * action-menu option); a CARD ACTION authorises with two (the wrapped activate
 * pick + the branch pick — Storm Surge Barrier's advance mode). From the
 * `{deltaProject, amount}` step on they reach the same server code, so they
 * must send the same bytes — which is why there is one assembler and not two.
 *
 * `steps` is the TRACK distance (what `DeltaProjectInput` validates), kept
 * separate from the payload's `spend` because for a card move the two are
 * different quantities that merely happen to coincide: the card charges its own
 * whole-move toll, not the standard per-step price.
 */
export function hydroAdvanceBatch(
  prefix: ReadonlyArray<unknown>, steps: number, payload: HydroAdvancePayload,
): Array<unknown> {
  // The waive and the steel share ride the MOVE's own step, and each key
  // exists only when meaningful — every energy-only, non-waiving batch stays
  // byte-identical to the historical shape.
  const move: {
    type: 'deltaProject', amount: number, waiveReward?: true, steel?: number,
    waivedSteps?: ReadonlyArray<number>,
    plannedActions?: ReadonlyArray<{position: number, card: CardName}>,
    plannedChoices?: ReadonlyArray<{position: number, choice: number}>,
    answers?: ReadonlyArray<DeltaStageAnswer>,
  } = {type: 'deltaProject', amount: steps};
  if (payload.waiveTarget === true) {
    move.waiveReward = true;
  }
  if (payload.steelSpend !== undefined && payload.steelSpend > 0) {
    move.steel = payload.steelSpend;
  }
  if (payload.waivedSteps !== undefined && payload.waivedSteps.length > 0) {
    move.waivedSteps = payload.waivedSteps;
  }
  if (payload.plannedActions !== undefined && payload.plannedActions.length > 0) {
    move.plannedActions = payload.plannedActions;
  }
  if (payload.plannedChoices !== undefined && payload.plannedChoices.length > 0) {
    move.plannedChoices = payload.plannedChoices;
  }
  const answers = moveStepAnswers(payload);
  if (answers !== undefined) {
    move.answers = answers;
  }
  return [
    ...prefix,
    move,
  ];
}

/** The PLAYER'S OWN advance: `activate` is the already-wrapped action-menu
 *  option response (the caller resolves the live path), and the standard action
 *  spends one energy per step, so the distance IS the spend. */
export function hydroAdvanceResponses(activate: unknown, payload: HydroAdvancePayload): Array<unknown> {
  return hydroAdvanceBatch([activate], payload.spend, payload);
}
