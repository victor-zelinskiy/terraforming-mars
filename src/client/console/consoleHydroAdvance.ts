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

/** Assemble the full advance batch: `[activate, {deltaProject,amount}, choice?,
 *  card-pick / composed-repeat tail?]`. `activate` is the already-wrapped
 *  action-menu option response (the caller resolves the live path). */
export function hydroAdvanceResponses(activate: unknown, payload: HydroAdvancePayload): Array<unknown> {
  const responses: Array<unknown> = [
    activate,
    {type: 'deltaProject' as const, amount: payload.spend},
  ];
  if (payload.rewardChoice !== undefined) {
    responses.push({type: 'or' as const, index: payload.rewardChoice, response: {type: 'option' as const}});
  }
  if (payload.selectedCard !== undefined) {
    if (payload.repeat !== undefined && payload.repeat.chosenCard === payload.selectedCard) {
      // The premium stage-7 flow: the card pick + the chosen action's own
      // composed responses in defer order (byte-parity with ProjInsp/Viron).
      responses.push(...repeatActionResponses(payload.repeat.chosenCard, payload.repeat.composed));
    } else {
      responses.push({type: 'card' as const, cards: [payload.selectedCard]});
    }
  }
  return responses;
}
