/*
 * CONSOLE HYDRO ADVANCE BATCH — the pure response assembly for «Укрепить
 * гидросеть» (the console shell's submitHydroAdvance). Extracted so the batch
 * shape is unit-guarded, exactly like the play/action composers' builders.
 *
 * The server contract (DeltaProjectExpansion.advance): the activate option is
 * answered first, then the `{deltaProject, amount}` step; a CHOICE stage
 * (pos 1/2) defers an OrOptions answered by `{or, index}`; a CARD-pick stage
 * defers a SelectCard (pos 7 reuse-action / pos 9 animal target) answered by
 * `{card:[X]}`. For pos 7 the chosen action then RUNS — its own inputs arrive
 * next, so a COMPOSED repeat (the console ДЕЙСТВИЯ КАРТ repeat surface) appends
 * the byte-identical `repeatActionResponses` tail: `[{card:[chosen]}, ...the
 * chosen action's own composed responses]` — the same tail ProjectInspection /
 * Viron ride.
 *
 * A repeat composition whose `chosenCard` no longer matches the plan's
 * `selectedCard` is STALE (the plan moved / the preview refreshed) — it
 * degrades to the bare card pick, whose follow-ups then arrive as native
 * sequential tasks (the legacy-supported contract). Never a silent drop of
 * the reward itself.
 */
import {CardName} from '@/common/cards/CardName';
import {repeatActionResponses} from '@/client/console/consoleActionComposer';
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
 * THE LANDED STAGE'S OWN ANSWERS — everything the server defers AFTER the move
 * itself: the reward choice (pos 1/2) and the card pick (pos 7 reuse-action /
 * pos 9 animal target, the latter possibly carrying the composed repeat tail).
 *
 * SEPARATE from the prefix on purpose. The two ways onto the track differ ONLY
 * in how the move is authorised — the player's own action (`activate` +
 * `{deltaProject, amount}`) or a card's offer (one `OrOptions` index) — and
 * from the landing on they are the same server code, so they must be the same
 * batch. A bonus move that assembled its own tail is how the stage-7 pick
 * ended up arriving as a standalone legacy card browser instead of being
 * pre-collected in the workspace that asked for it.
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
 * Assemble a full advance batch from an arbitrary PREFIX: `[...prefix,
 * {deltaProject, amount}, choice?, card-pick / composed-repeat tail?]`.
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
  const move: {type: 'deltaProject', amount: number, waiveReward?: true, steel?: number, waivedSteps?: ReadonlyArray<number>} =
    {type: 'deltaProject', amount: steps};
  if (payload.waiveTarget === true) {
    move.waiveReward = true;
  }
  if (payload.steelSpend !== undefined && payload.steelSpend > 0) {
    move.steel = payload.steelSpend;
  }
  if (payload.waivedSteps !== undefined && payload.waivedSteps.length > 0) {
    move.waivedSteps = payload.waivedSteps;
  }
  return [
    ...prefix,
    move,
    ...hydroAdvanceTail(payload),
  ];
}

/** The PLAYER'S OWN advance: `activate` is the already-wrapped action-menu
 *  option response (the caller resolves the live path), and the standard action
 *  spends one energy per step, so the distance IS the spend. */
export function hydroAdvanceResponses(activate: unknown, payload: HydroAdvancePayload): Array<unknown> {
  return hydroAdvanceBatch([activate], payload.spend, payload);
}
