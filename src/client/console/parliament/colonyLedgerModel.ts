/*
 * THE COLONY LEDGER, the CLIENT reading (Turmoil Redux — Colonial Affairs).
 *
 * «Gain all your colony bonuses k times» is read on every surface as ONE
 * ledger: the multiplier line in the influence-yield grammar («[influence] 3
 * → ×3», «×4 if you win»), then a row per tile the seat has a cube on — the
 * tile, its printed bonus, «× k =», the row's total — and the sums by unit.
 * Nothing here decides what a colony bonus is: the rows come from the seat's
 * registry the SERVER ships (`ParliamentPlayerModel.colonyBonuses`), the
 * multiplier from the one shared formula (`voteYieldsOf` / `enactedYieldsOf`
 * over the declaration), the states from the server's own records. Pure: no
 * Vue, no DOM, no i18n; `ConsoleColonyLedger.vue` renders it.
 */
import {Color} from '@/common/Color';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {ParliamentEnactOutcomeModel, ParliamentModel, ParliamentPlayerModel, seatEnacts} from '@/common/models/ParliamentModel';
import {InfluenceScaledEffect, InfluenceYield} from '@/common/parliament/influenceScaling';
import {AllColonyBonusesModel, ColonyBonusAsk} from '@/common/models/ColonyBonusLedgerModel';
import {ColonyLedgerRow, ColonyLedgerTotals, colonyLedgerRows, colonyLedgerTotals, recordedMultiplierOf} from '@/common/parliament/colonyLedger';
import {colonyBonusesEffectOf} from './resolutionFamily';
import {enactedYieldsOf, ReadingPerson, voteYieldsOf} from './influenceYieldModel';

/**
 * WHO reads the ledger, and when:
 *  · a RESOLUTION's — `vote` (the card is up for the vote: estimate + the win's forecast), `resolving` (the
 *    payout is being made), `applied` (recorded);
 *  · a CARD's («gain all your colony bonuses» paid by Habitat Science / Productive Outpost — the reading outside
 *    the Parliament): `preview` (before the press — every row promised), `paying` (the rows pay in turn),
 *    `paid` (the ledger stands as a receipt).
 */
export type ColonyLedgerContext = 'vote' | 'resolving' | 'applied' | 'preview' | 'paying' | 'paid';

/** Is this a CARD's reading (no influence, no records — the rows' receipts are the scene's own landings)? */
export function isCardLedgerContext(context: ColonyLedgerContext): boolean {
  return context === 'preview' || context === 'paying' || context === 'paid';
}

export type ColonyLedgerReading = {
  /** The scaled effect a RESOLUTION's ledger multiplies by — absent for a card's reading. */
  effect?: InfluenceScaledEffect;
  context: ColonyLedgerContext;
  /**
   * The multiplier's readings, in the yield block's own shape (the estimate and, apart, the win's forecast; or
   * the fixed record). Absent / empty for a card's reading: a card pays once per cube, there is no «× k» line.
   */
  yields?: ReadonlyArray<InfluenceYield>;
  /** k — the multiplier the rows stand on (the estimate's / the record's; a card's «times» — 1, Yvonne's 2). */
  multiplier: number;
  /** k if the viewer wins the vote, when it differs (the vote only). */
  winMultiplier?: number;
  rows: ReadonlyArray<ColonyLedgerRow>;
  totals: ColonyLedgerTotals;
  /** The seat has no cube anywhere — the ledger says so in words, never an empty box. */
  empty: boolean;
};

/** A RESOLUTION's reading: the effect and its yields are always there. */
export type ResolutionColonyLedgerReading = ColonyLedgerReading & {effect: InfluenceScaledEffect, yields: ReadonlyArray<InfluenceYield>};

function seatOf(model: ParliamentModel | undefined, viewer: Color | undefined): ParliamentPlayerModel | undefined {
  if (model === undefined || viewer === undefined) {
    return undefined;
  }
  const seat = model.players.find((p) => p.color === viewer);
  return seat !== undefined && seatEnacts(seat) ? seat : undefined;
}

/** The viewer's own records of `effect` in the live phase, else in the last one. */
function recordsOf(model: ParliamentModel | undefined, viewer: Color | undefined, effect: InfluenceScaledEffect): Array<ParliamentEnactOutcomeModel> {
  const outcomes = model?.phase?.outcomes ?? model?.lastPhase?.outcomes ?? [];
  return viewer === undefined ? [] : outcomes.filter((o) => o.player === viewer && o.effect === effect.id && o.kind !== 'reaction');
}

/**
 * THE LEDGER for the viewer — undefined when the resolution pays no colony
 * bonuses, or the viewer has no seat (a spectator reads the card's graphic
 * alone: no invented list).
 *  · `enacted: false` (the vote): the multiplier by the current influence with the win's forecast beside
 *    it, every row `pending`;
 *  · `enacted: true`: the recorded multiplier (or the seat's influence before the first record), the
 *    rows' states off the records — `live` reads «this payout», else «received».
 */
export function colonyLedgerOf(
  resolution: IClientResolution | undefined,
  model: ParliamentModel | undefined,
  viewer: Color | undefined,
  opts: {enacted?: boolean, live?: boolean} = {},
): ResolutionColonyLedgerReading | undefined {
  const effect = resolution === undefined ? undefined : colonyBonusesEffectOf(resolution);
  const seat = seatOf(model, viewer);
  if (resolution === undefined || effect === undefined || seat === undefined) {
    return undefined;
  }
  const entries = seat.colonyBonuses ?? [];
  if (opts.enacted === true) {
    const records = recordsOf(model, viewer, effect);
    const yields = enactedYieldsOf(resolution, model, viewer, {live: opts.live === true}).filter((y) => y.effect.id === effect.id);
    const fixed = yields.find((y) => y.context === 'resolving' || y.context === 'applied');
    const multiplier = recordedMultiplierOf(records) ?? fixed?.amount ?? 0;
    const rows = colonyLedgerRows(entries, multiplier, records);
    return {
      effect, context: opts.live === true ? 'resolving' : 'applied', yields, multiplier, rows, totals: colonyLedgerTotals(rows), empty: entries.length === 0,
    };
  }
  const yields = voteYieldsOf(resolution, model, viewer).filter((y) => y.effect.id === effect.id);
  const estimate = yields.find((y) => y.context === 'estimate');
  const forecast = yields.find((y) => y.context === 'forecast');
  const multiplier = estimate?.amount ?? 0;
  const rows = colonyLedgerRows(entries, multiplier);
  const reading: ResolutionColonyLedgerReading = {effect, context: 'vote', yields, multiplier, rows, totals: colonyLedgerTotals(rows), empty: entries.length === 0};
  if (forecast?.amount !== undefined && forecast.amount !== multiplier) {
    reading.winMultiplier = forecast.amount;
  }
  return reading;
}

/**
 * THE LEDGER OF A CARD — «gain all your colony bonuses» paid by a card's action or play (TR23 Habitat Science,
 * Productive Outpost), read outside the Parliament: the neighbour of `colonyLedgerOf` on the very same rows
 * (`colonyLedgerRows` / `colonyLedgerBonusOf`). The entries are the SERVER's (`ActionPreviewBranch.colonyBonuses`
 * — in the order the engine pays them, each with what it will ask and what cannot land); there is no influence
 * and no record, so there is no multiplier line: a row's «× N» is its cubes (× the card's `times`), printed only
 * when above one. `context` is the composer's own fact: `preview` before the press, `paying` while the rows pay
 * in turn, `paid` once the ledger stands as a receipt.
 */
export function cardColonyLedgerOf(model: AllColonyBonusesModel, context: 'preview' | 'paying' | 'paid' = 'preview'): ColonyLedgerReading {
  const times = model.times ?? 1;
  const rows = colonyLedgerRows(model.entries, times);
  return {context, multiplier: times, rows, totals: colonyLedgerTotals(rows), empty: model.entries.length === 0};
}

/** The word a pending row of a CARD's ledger wears for what it will ask after the press (an i18n key). */
export function colonyLedgerAskKey(asks: ColonyBonusAsk | undefined): string | undefined {
  switch (asks) {
  case 'card': return 'card choice';
  case 'draw': return 'take the card';
  case 'draw-discard': return 'card → discard';
  case 'choice': return 'your choice';
  default: return undefined;
  }
}

/** The i18n keys of the ledger's own words — one place, the glossary's. */
export const COLONY_LEDGER_KICKER = 'Colony bonuses';
export const COLONY_LEDGER_EMPTY = 'You have no colonies';
/** …and the same emptiness about ANOTHER seat — the subject is named by the block's kicker, never twice. */
export const COLONY_LEDGER_EMPTY_THIRD = 'No colonies';
export const COLONY_LEDGER_TOTAL = 'Total';

/** WHICH emptiness this reading prints — the ledger's one second-person phrase. */
export function colonyLedgerEmptyKey(person: ReadingPerson = 'you'): string {
  return person === 'they' ? COLONY_LEDGER_EMPTY_THIRD : COLONY_LEDGER_EMPTY;
}
