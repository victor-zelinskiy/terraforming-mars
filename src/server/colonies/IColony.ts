import {IPlayer} from '../IPlayer';
import {PlayerInput} from '../PlayerInput';
import {PlayerId, SpaceId} from '../../common/Types';
import {IGame} from '../IGame';
import {SerializedColony} from '../SerializedColony';
import {ColonyMetadata} from '../../common/colonies/ColonyMetadata';
import {ColonyName} from '../../common/colonies/ColonyName';
import {ColonyTradeGrantModel} from '../../common/models/ColonyTradeManifestModel';
import {ITradeDestination} from './ITradeDestination';

export type TradeOptions = {
  usesTradeFleet?: boolean;
  decreaseTrackAfterTrade?: boolean;
  giveColonyBonuses?: boolean;
  selfishTrade?: boolean;
};

/** Which of a recipient's cubes on a colony is resolving (1-based) of how many. */
export type ColonyBonusOrdinal = {index: number, total: number};

/**
 * WHAT THE PATH A TRADE IS PAID BY BRINGS TO THE COLONY'S OWN JUDGEMENT —
 * everything a tile's rule about the player may depend on that is not the
 * player's state alone:
 *  · `bonusTradeOffset` — the extra track step the path grants before the
 *    income is read (the Unity action's +1, Trade Advance): a refusal at the
 *    low positions can lift when the reach is longer (the Redux Pluto);
 *  · `feeMegacredits` — the M€ the path will TAKE as the fee before the
 *    income is read: 0 for a path paid in energy / titanium / a card, 0 once
 *    the fee is paid (`Colony.trade` runs after it). The Redux Venus's «if
 *    you do not have the EXTRA 4 M€» is judged over this — a player with 10 M€
 *    can pay a 9 M€ fee OR the 4 M€ the 1st position takes, never both, and a
 *    fee paid into a refusal is the one outcome the offer must never allow.
 * The OFFER is judged by the best usable path (the longest reach, the
 * cheapest M€ fee), the chosen path re-judges at the submit — the same two
 * moments the offset already had.
 */
export type TradeTerms = {
  bonusTradeOffset?: number;
  feeMegacredits?: number;
};

/** The terms in full — a bare number is the historical «bonusTradeOffset only» call. */
export function tradeTermsOf(terms: number | TradeTerms | undefined): Required<TradeTerms> {
  if (typeof terms === 'number') {
    return {bonusTradeOffset: terms, feeMegacredits: 0};
  }
  return {bonusTradeOffset: terms?.bonusTradeOffset ?? 0, feeMegacredits: terms?.feeMegacredits ?? 0};
}

/**
 * THE REACH OF ONE TRADE — how far this player's trade offset carries the
 * marker before the income is read, and which of those positions the colony
 * LETS this player read (`tradeIncomeBlockedReason`). `Colony.trade` executes
 * exactly this plan and the read-only preview plans from it, so the promise
 * and the payout cannot drift.
 */
export type TradeTrackPlan = {
  /** The marker now. */
  current: number;
  /** The farthest position the offset reaches (capped at the track's end). */
  max: number;
  /**
   * The steps the trade advances when it does not ask — the farthest LEGAL
   * step: `max − current` for a `yes` colony, 0 for a `no` colony, and for an
   * `ask` colony the top of the legal range (the prompt's first option).
   */
  steps: number;
  /**
   * The fewest steps the player may choose: 0 when «don't advance» is legal,
   * more when the colony refuses this player its income below that point.
   */
  minSteps: number;
  /** The server ASKS how far to advance (`IncreaseColonyTrack`). */
  ask: boolean;
  /**
   * Set when NO position in reach may be traded — the colony's own refusal
   * read at the farthest reach (the rules' «you could only go up to the 5th
   * position»). A trade with this set never runs.
   */
  blockedReason?: string;
};

/**
 * A colony tile. It is a TRADE DESTINATION (`ITradeDestination` — the other
 * one being a fleet-dock card): `tradeSource` names it and `trade` is the door
 * every payment path hands its paid trade to.
 */
export interface IColony extends ITradeDestination {
  readonly name: ColonyName;
  readonly metadata: ColonyMetadata;

  isActive: boolean;
  colonies: Array<PlayerId>;
  trackPosition: number;
  visitor: PlayerId | undefined;
  /**
   * WHAT LIES ON THIS TILE besides cubes and a fleet — the cells whose TILE
   * stands on the colony tile (Turmoil Redux TR22 Nova City: «place a city ON
   * A COLONY TILE»). The tile says WHERE; the CELL says what and whose
   * (`space.tile`, `space.player`) — one truth per question. Empty on every
   * tile nothing was placed on. ONE writer: `ColoniesHandler.placeCityOnColonyTile`.
   */
  tiles: Array<SpaceId>;

  endGeneration(game: IGame): void;
  increaseTrack(steps?: number): void;
  decreaseTrack(steps?: number): void;
  /** Record (analytics only) a trade-offset effect (Trading Colony) advancing this
   *  track by `appliedSteps` from `oldPosition`, attributing the steps + the exact
   *  extra trade reward to the owning card(s). */
  recordTradeTrackBonus(player: IPlayer, oldPosition: number, appliedSteps: number): void;
  isFull(): boolean;
  addColony(player: IPlayer, options?: {giveBonusTwice: boolean}): void;
  trade(player: IPlayer, tradeOptions?: TradeOptions, bonusTradeOffset?: number): void;
  /**
   * Why THIS player may not collect the trade income read at `position` —
   * a rule of the COLONY about the player (the Turmoil Redux Pluto: data at
   * the low positions needs a card that can hold data), or `undefined` when
   * they may. An English i18n key. A colony without such a rule never
   * refuses (the base class). READ-ONLY; co-located in the colony's own file,
   * never a central table. `terms` is what the paying path brings to the
   * judgement (the M€ it takes as the fee — the Redux Venus's «extra 4 M€»).
   */
  tradeIncomeBlockedReason(player: IPlayer, position: number, terms?: TradeTerms): string | undefined;
  /**
   * The reach of a trade by this player here (see {@link TradeTrackPlan}) —
   * the offset's arithmetic and the colony's per-position refusals folded
   * into one plan. `terms` are the paying path's (see {@link TradeTerms}); a
   * bare number is the extra step alone.
   */
  tradeTrackPlan(player: IPlayer, terms?: number | TradeTerms): TradeTrackPlan;
  /**
   * Why THIS player may not trade here at all right now, or `undefined` when
   * a trade can legally read its income somewhere within the offset's reach.
   * The colony's OWN gate only — whether the tile is active and unvisited is
   * `ColoniesHandler.openColonies`' question, and the player's fleet / fee is
   * `player.colonies.tradeBlockedReason()`'s.
   */
  tradeBlockedReason(player: IPlayer, terms?: number | TradeTerms): string | undefined;
  /**
   * `ordinal` = WHICH of this recipient's cubes on this colony is resolving
   * (1-based) out of how many they own. Each cube resolves separately and in
   * full; an interactive bonus uses this only to say which colony is paying.
   *
   * `trader` = who made the trade that pays this bonus, when there is one. A
   * bonus paid to somebody ELSE is DELIVERED (the recipient collects it, and
   * the cards are drawn on their answer); the trader's own cube resolves
   * inline. Absent for the self-directed grants (ProductiveOutpost, Yvonne).
   */
  giveColonyBonus(player: IPlayer, isGiveColonyBonus?: boolean, ordinal?: ColonyBonusOrdinal, trader?: IPlayer): undefined | PlayerInput;
  /**
   * THE PRINTED COLONY BONUS AS A GRANT — the same descriptor the trade
   * manifest carries for the per-cube payout (`colonyBonus`), read off this
   * tile's own metadata, so a payer other than a trade (an enacted resolution
   * paying «all your colony bonuses») pays exactly what the tile prints and
   * never re-states it.
   */
  colonyBonusGrant(): ColonyTradeGrantModel;
  serialize(): SerializedColony;
}
