/*
 * FINAL GREENERY — the PURE model of the endgame beat where a player turns
 * leftover plants into greeneries, one at a time, until they choose to stop.
 *
 * THE FINALE IS PLAYED ON THE BOARD (the owner's decision of 2026-10-14). It
 * used to be its own screen: a small dialog over a dimmed planet («Превратить
 * растения в озеленения?» + three numbers + two rows), then the board for the
 * cell, then the dialog again — one screen change per tile, the planet the
 * phase is ABOUT hidden behind glass every time the player came back to it. Now
 * the announce's A puts the board straight into placement, the dossier of the
 * cell carries the finale's own block (the plant stock as objects — one hex per
 * greenery the plants still pay for, the rest as a part-filled hex — and what
 * stopping costs), and after each landing the board simply stays in placement
 * for the next one. The decision the dialog existed for is still a decision:
 *
 *  · PLACE is the board's ordinary two-phase pick (A locks, A confirms);
 *  · FINISH ends the player's game, irreversibly, while their plants are still
 *    worth victory points — so it is a HOLD (the console's shared
 *    hold-to-confirm, the same gesture as «Пас»), never a press: a hold cannot
 *    be produced by mashing A through the endgame, and letting go is a safe
 *    cancel;
 *  · B minimizes (look at the board, come back from the board home's plate) —
 *    the mandatory-task verb every other prompt uses.
 *
 * Everything here is derived from the server's structural marker
 * (`finalGreeneryPrompt`) plus the public player model — never from titles.
 * No Vue, no DOM, no i18n: keys out, the surface translates. Unit-tested under
 * the server runner (tests/client/components/console/finalGreeneryModel.spec.ts).
 */

import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';

export type FinalGreeneryViewModel = {
  /** Plants in stock right now. */
  plants: number;
  /** What one greenery costs THIS player (discounts already applied). */
  cost: number;
  /** How many more greeneries those plants can still pay for. */
  affordable: number;
  /** Plants left over beyond the last whole greenery (0 ≤ remainder < cost). */
  remainder: number;
  /** Legal spaces left on the board (server-supplied — a board rule). */
  spaces: number;
  /** `OrOptions.options` index of the board pick — what the placement answers. */
  placeIndex: number;
  /** `OrOptions.options` index of «I am done» — what the finish hold submits. */
  stopIndex: number;
};

// ── copy keys (English text IS the i18n key) ────────────────────────────────

/** The announce's kicker and the dossier block's eyebrow. */
export const FINALE_KICKER = 'End of the game';
/** The phase's name — the announce's ask and the dossier block's title. */
export const FINALE_TITLE = 'Final greenery';
/** The bar's finish verb (a HOLD). */
export const FINISH_LABEL = 'Finish your game';
/** The plate's A, and the way back from a minimized finale. */
export const FINALE_OPEN = 'Place a greenery';
export const FINALE_RETURN = 'Return to the final greenery';
/** The bank's count line: «Хватит на ${0}». */
export const BANK_ENOUGH = 'Enough for ${0}';
/** What stopping now leaves unused: «При завершении сгорят: ${0}». */
export const BANK_BURNS = 'Burns on finishing: ${0}';
/** The bank's heading. */
export const BANK_LABEL = 'Plant stock';

/**
 * Build the finale's view, or `undefined` when this prompt is not it. Like
 * every other console adapter, an unrecognised shape keeps its existing UI
 * rather than being half-rendered.
 *
 * @param viewer the public model of the player being asked (plants + the
 *   discount-aware greenery cost live there; the marker must not duplicate them).
 */
export function buildFinalGreenery(
  input: PlayerInputModel | undefined,
  viewer: {plants: number, plantsNeededForGreenery: number} | undefined,
): FinalGreeneryViewModel | undefined {
  const marker = input?.finalGreeneryPrompt;
  if (marker === undefined || input?.type !== 'or' || viewer === undefined) {
    return undefined;
  }
  // The branches are told apart by TYPE, never by title: the placement is a
  // board pick, stopping is a leaf.
  let placeIndex = -1;
  let stopIndex = -1;
  input.options.forEach((option, index) => {
    if (option.type === 'space' && placeIndex === -1) {
      placeIndex = index;
    } else if (option.type === 'option' && stopIndex === -1) {
      stopIndex = index;
    }
  });
  if (placeIndex === -1 || stopIndex === -1) {
    return undefined;
  }
  const cost = Math.max(1, viewer.plantsNeededForGreenery);
  const plants = Math.max(0, viewer.plants);
  return {
    plants,
    cost,
    affordable: Math.floor(plants / cost),
    remainder: plants % cost,
    spaces: marker.spaces,
    placeIndex,
    stopIndex,
  };
}

/** One place of the plant bank: a whole greenery the stock pays for, or the part-filled rest. */
export type FinalGreeneryBankSlot =
  | {kind: 'full'}
  | {kind: 'part', have: number, need: number};

export type FinalGreeneryBank = {
  slots: ReadonlyArray<FinalGreeneryBankSlot>;
  /** Whole greeneries beyond the drawn hexes (a huge stock reads «+N», never a row that runs off the panel). */
  overflow: number;
  /** How many greeneries the stock pays for — the number the decision turns on. */
  affordable: number;
  /** What finishing now would leave unused (every plant in stock). */
  burns: number;
};

/**
 * THE PLANT STOCK AS OBJECTS — the arithmetic the old dialog printed as three
 * numbers («Растения 16 · Цена 8 · Ещё 2»), drawn instead: one hex per greenery
 * the plants still pay for, then the rest as a hex filled `have / need` (only
 * when there IS a rest). The count of whole hexes is capped so the row never
 * outgrows its column; the cut is stated as «+N».
 */
export function finalGreeneryBank(vm: FinalGreeneryViewModel, cap = 6): FinalGreeneryBank {
  const shown = Math.min(vm.affordable, Math.max(1, cap));
  const slots: Array<FinalGreeneryBankSlot> = [];
  for (let i = 0; i < shown; i++) {
    slots.push({kind: 'full'});
  }
  if (vm.remainder > 0) {
    slots.push({kind: 'part', have: vm.remainder, need: vm.cost});
  }
  return {slots, overflow: vm.affordable - shown, affordable: vm.affordable, burns: vm.plants};
}

/**
 * THE FINISH VERB — the one command the finale adds to the placement bar. A
 * HOLD in the danger tone, never dropped by the fit (priority 0): it is the
 * only way to stop placing, and it ends the player's game.
 */
export function finalGreeneryFinishCommand(): ConsoleCommand {
  return {control: 'triggerR', label: FINISH_LABEL, hold: true, tone: 'danger', priority: 0};
}
