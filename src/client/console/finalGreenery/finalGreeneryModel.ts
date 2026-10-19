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
import type {Color} from '@/common/Color';

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
  /**
   * A LAW REPLACES THE GREENERY (Turmoil Redux RX35, decision Р2 — the server's marker): the placing branch is a
   * plain OPTION (no cell), the plants buy `data` data on one of the seat's cards, and the law's own «where» follows.
   */
  diverted?: {resolution: string, data: number};
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
/** The board's room, when it is what caps the count: «Свободных клеток: ${0}». */
export const BANK_CELLS = 'Free cells: ${0}';
/** The per-greenery yield tail of the exchange formula. */
export const YIELD_VP = '+1 VP per greenery';
export const YIELD_TR = '+1 TR per greenery';
/** …and under a law that REPLACES the greenery (Turmoil Redux RX35): the plants buy data, no tile. */
export const YIELD_DATA = '+1 data per greenery';
/** The finale ORDER block: every seat's place in the phase. */
export const QUEUE_LABEL = 'Finale order';
export const SEAT_DONE = 'Finished';
export const SEAT_PLACING = 'Placing greeneries';
export const SEAT_WAITING = 'Waiting';
export const SEAT_YOU = 'you';
/** The stage words (the eyebrow's right pill). */
export const STAGE_PICK = 'Cell choice';
export const STAGE_LANDING = 'Landing';
export const STAGE_WAIT = 'Waiting on a seat';
/** The wait stage's line: «Ждём ответа: ${0}». */
export const WAITING_ON = 'Waiting for ${0} to answer';
/** …and the reason the finish is disabled meanwhile. */
export const FINISH_WAITS = 'Finish is available once ${0} has answered';
/** The landing stage's line. */
export const LANDING_LINE = 'The greenery is landing — the next pick follows';

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
  // board pick, stopping is a leaf. Under a REPLACING law (the marker's `diverted`) the placing branch is a leaf too
  // — the FIRST one, the stop the second (the server's order, pinned by its own spec).
  let placeIndex = -1;
  let stopIndex = -1;
  input.options.forEach((option, index) => {
    if (marker.diverted !== undefined) {
      if (option.type === 'option' && placeIndex === -1) {
        placeIndex = index;
      } else if (option.type === 'option' && stopIndex === -1) {
        stopIndex = index;
      }
    } else if (option.type === 'space' && placeIndex === -1) {
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
    ...(marker.diverted !== undefined ? {diverted: marker.diverted} : {}),
  };
}

/** One place of the plant bank: a whole greenery the stock pays for, or the part-filled rest. */
export type FinalGreeneryBankSlot =
  | {kind: 'full'}
  | {kind: 'part', have: number, need: number};

/**
 * The hex SIZE TIER — the bank is drawn to the COUNT (PL-305): two greeneries are two big hexes, twelve are
 * twelve small ones over two rows; never a fixed size that runs off the column or a tiny row for a stock of two.
 */
export type FinalGreeneryBankTier = 'xl' | 'lg' | 'md' | 'sm' | 'xs';

export type FinalGreeneryBank = {
  slots: ReadonlyArray<FinalGreeneryBankSlot>;
  /** Whole greeneries beyond the drawn hexes (an absurd stock reads «+N», never a wall of hexes). */
  overflow: number;
  /** How many greeneries the stock pays for — the number the decision turns on. */
  affordable: number;
  /** What finishing now would leave unused (every plant in stock). */
  burns: number;
  /** The hexes' size tier, by the count drawn. */
  tier: FinalGreeneryBankTier;
};

/** The stock arithmetic without a prompt — the wait stage has no prompt and still shows the bank. */
export type FinalGreeneryStock = {plants: number, cost: number, affordable: number, remainder: number};

export function finaleStock(plants: number, plantsNeededForGreenery: number): FinalGreeneryStock {
  const cost = Math.max(1, plantsNeededForGreenery);
  const stock = Math.max(0, plants);
  return {plants: stock, cost, affordable: Math.floor(stock / cost), remainder: stock % cost};
}

/** The hexes' tier by how many are drawn (whole + the rest). */
export function finalGreeneryBankTier(drawn: number): FinalGreeneryBankTier {
  if (drawn <= 2) {
    return 'xl';
  }
  if (drawn <= 4) {
    return 'lg';
  }
  if (drawn <= 8) {
    return 'md';
  }
  if (drawn <= 14) {
    return 'sm';
  }
  return 'xs';
}

/**
 * THE PLANT STOCK AS OBJECTS — the arithmetic the old dialog printed as three
 * numbers («Растения 16 · Цена 8 · Ещё 2»), drawn instead: one hex per greenery
 * the plants still pay for, then the rest as a hex filled `have / need` (only
 * when there IS a rest). The hexes take their SIZE from their count and WRAP
 * into rows (PL-305); only an absurd stock is cut, and the cut is stated as «+N».
 */
export function finalGreeneryBank(stock: FinalGreeneryStock, cap = 24): FinalGreeneryBank {
  const shown = Math.min(stock.affordable, Math.max(1, cap));
  const slots: Array<FinalGreeneryBankSlot> = [];
  for (let i = 0; i < shown; i++) {
    slots.push({kind: 'full'});
  }
  if (stock.remainder > 0) {
    slots.push({kind: 'part', have: stock.remainder, need: stock.cost});
  }
  return {
    slots,
    overflow: stock.affordable - shown,
    affordable: stock.affordable,
    burns: stock.plants,
    tier: finalGreeneryBankTier(slots.length),
  };
}

// ── the SESSION's stages and the table's places (PL-303 / PL-304) ───────────

/**
 * WHERE THE CONTEXT STANDS. `pick` — the board pick is out; `landing` — a greenery is on its way (the commit is
 * on the wire, or the next prompt stands and the pick follows by itself); `wait` — the seat holds no prompt and
 * another seat decides (a triggered pick of theirs). Derived from facts, never from a title.
 */
export type FinaleStage = 'pick' | 'landing' | 'wait';

export function finaleStageOf(facts: {
  /** The finale's own board pick is out. */
  pickOut: boolean,
  /** The viewer holds the finale prompt (raw — admission may still be waiting out a scene). */
  promptStands: boolean,
  /** The last answer is on the wire / its landing has not released the loop yet. */
  committing: boolean,
}): FinaleStage {
  if (facts.pickOut) {
    return 'pick';
  }
  if (facts.promptStands || facts.committing) {
    return 'landing';
  }
  return 'wait';
}

export type FinaleSeatState = 'done' | 'placing' | 'waiting';
export type FinaleSeat = {color: Color, name: string, state: FinaleSeatState, viewer: boolean};

/**
 * THE FINALE ORDER — every seat's place in the phase, in the table's order: done (placed all it could, or
 * stopped — the server's `finalGreenery.done`), placing (the seat holding the finale prompt), waiting for its turn.
 */
export function finaleQueue(
  players: ReadonlyArray<{color: Color, name: string, isWaitingForInput?: boolean, waitingForKind?: string}>,
  done: ReadonlyArray<Color>,
  viewerColor: Color,
  /** The viewer's own finale is IN PROGRESS (the session stands): their row reads «placing» even while another seat's triggered pick holds the prompt. */
  viewerInFinale = false,
): Array<FinaleSeat> {
  return players.map((p) => {
    const viewer = p.color === viewerColor;
    const asked = p.isWaitingForInput === true && p.waitingForKind === 'finalgreenery';
    return {
      color: p.color,
      name: p.name,
      state: done.includes(p.color) ? 'done' : (asked || (viewer && viewerInFinale)) ? 'placing' : 'waiting',
      viewer,
    };
  });
}

/**
 * WHO THE SERVER WAITS ON while the viewer's finale stands without a prompt — another seat's triggered pick. The
 * live poll's list outranks the model's snapshot when it has one; the viewer is never the answer.
 */
export function finaleWaitingOn(
  players: ReadonlyArray<{color: Color, name: string, isWaitingForInput?: boolean}>,
  viewerColor: Color,
  live: ReadonlyArray<Color> | undefined,
): {color: Color, name: string} | undefined {
  const waited = live !== undefined && live.length > 0 ?
    players.filter((p) => live.includes(p.color)) :
    players.filter((p) => p.isWaitingForInput === true);
  const other = waited.find((p) => p.color !== viewerColor);
  return other === undefined ? undefined : {color: other.color, name: other.name};
}

/**
 * THE DOSSIER'S FINALE BLOCK — what the panel draws for the session's whole life (PL-304): the stock as objects,
 * the board's room when it caps the count, the per-greenery yield, every seat's place, the stage, and in the wait
 * stage who the table waits on. Built by the shell from the public model; the panel renders it and nothing else.
 */
export type FinalePanelModel = {
  stage: FinaleStage;
  plants: number;
  cost: number;
  bank: FinalGreeneryBank;
  /** Legal cells left when THEY are what caps the count (fewer than the plants pay for); undefined otherwise. */
  freeCells?: number;
  /** The yield tail's i18n key (`YIELD_VP` / `YIELD_TR`). */
  yieldKey: string;
  queue: ReadonlyArray<FinaleSeat>;
  /** The seat the server waits on (the wait stage only). */
  waitingOn?: {color: Color, name: string};
};

/** What one final greenery is worth under the table's rules (classic: 1 VP for the tile; Turmoil Redux: +1 TR). */
export function finaleYieldKey(parliament: boolean, diverted = false): string {
  if (diverted) {
    return YIELD_DATA;
  }
  return parliament ? YIELD_TR : YIELD_VP;
}

/**
 * THE FINISH VERB — the one command the finale adds to the placement bar. A
 * HOLD in the danger tone, never dropped by the fit (priority 0): it is the
 * only way to stop placing, and it ends the player's game.
 */
export function finalGreeneryFinishCommand(): ConsoleCommand {
  return {control: 'triggerR', label: FINISH_LABEL, hold: true, tone: 'danger', priority: 0};
}
