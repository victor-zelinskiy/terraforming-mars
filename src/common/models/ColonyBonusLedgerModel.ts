import {ColonyName} from '../colonies/ColonyName';
import {ColonyTradeGrantModel} from './ColonyTradeManifestModel';

/**
 * WHAT A ROW OF A CARD'S PAYOUT WILL ASK OF THE PLAYER once the press is made
 * («gain all your colony bonuses» paid by a card — Habitat Science, Productive
 * Outpost, Yvonne): a card TARGET for a resource («where does the floater
 * go»), a TAKE of drawn cards, Pluto's pair «take 1, then discard 1», or a
 * decision the ledger has no word of its own for (a paid reveal, a copied
 * trade). Absent for a bonus that simply lands (a supply / production gain).
 */
export type ColonyBonusAsk = 'card' | 'draw' | 'draw-discard' | 'choice';

/**
 * A bonus that CANNOT land, named BEFORE the press with its size: the same
 * refusal the paying step records after it (no card can hold the resource).
 * `reason` is an English key; `amount` is the row's whole forfeit (per cube ×
 * cubes × times).
 */
export type ColonyBonusSkip = {reason: string, amount: number};

/**
 * ONE ROW OF A COLONY LEDGER: a tile the seat has a cube on and its PRINTED
 * colony bonus (the tile's third line — what a cube's owner receives when
 * somebody else trades there). Read by the Parliament («gain all your colony
 * bonuses k times» — `ParliamentPlayerModel.colonyBonuses`) and by a card
 * that pays the same bonuses (`AllColonyBonusesModel`).
 */
export type ColonyLedgerEntryModel = {
  colony: ColonyName;
  grant: ColonyTradeGrantModel;
  /** The tile's printed description of the bonus — an English key of the colony's own. */
  description: string;
  /**
   * HOW MANY CUBES of the seat stand on the tile. Each cube is a colony and
   * pays the bonus in full (two cubes on Luna = the bonus twice) — the
   * engine's own law (`ColoniesHandler.coloniesOf`, one entry per cube).
   */
  cubes: number;
  /** A CARD's payout only — what the row asks after the press (see {@link ColonyBonusAsk}). */
  asks?: ColonyBonusAsk;
  /** A CARD's payout only — the row cannot land (see {@link ColonyBonusSkip}). */
  skipped?: ColonyBonusSkip;
};

/**
 * «ALL YOUR COLONY BONUSES» AS A CARD PAYS THEM — the ledger the composer
 * shows before the press and the scene pays from after it. The rows stand IN
 * THE ORDER THE ENGINE PAYS THEM (`allColonyBonusesLedger`), never re-sorted
 * on the client.
 */
export type AllColonyBonusesModel = {
  entries: ReadonlyArray<ColonyLedgerEntryModel>;
  /** How many times every cube pays (Yvonne's «twice»). Absent = once. */
  times?: number;
};
