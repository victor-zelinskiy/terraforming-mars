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
  rewardChoice: number | undefined;
  selectedCard?: CardName;
  /** The composed stage-7 repeat pick (console-only pre-collection). */
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
  return [
    ...prefix,
    {type: 'deltaProject' as const, amount: steps},
    ...hydroAdvanceTail(payload),
  ];
}

/** The PLAYER'S OWN advance: `activate` is the already-wrapped action-menu
 *  option response (the caller resolves the live path), and the standard action
 *  spends one energy per step, so the distance IS the spend. */
export function hydroAdvanceResponses(activate: unknown, payload: HydroAdvancePayload): Array<unknown> {
  return hydroAdvanceBatch([activate], payload.spend, payload);
}
