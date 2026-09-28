import {IPlayer} from '../IPlayer';
import {PlayerInput} from '../PlayerInput';
import {PlayerId} from '../../common/Types';
import {IGame} from '../IGame';
import {SerializedColony} from '../SerializedColony';
import {ColonyMetadata} from '../../common/colonies/ColonyMetadata';
import {ColonyName} from '../../common/colonies/ColonyName';
import {ColonyTradeGrantModel} from '../../common/models/ColonyTradeManifestModel';

export type TradeOptions = {
  usesTradeFleet?: boolean;
  decreaseTrackAfterTrade?: boolean;
  giveColonyBonuses?: boolean;
  selfishTrade?: boolean;
};

/** Which of a recipient's cubes on a colony is resolving (1-based) of how many. */
export type ColonyBonusOrdinal = {index: number, total: number};

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

export interface IColony {
  readonly name: ColonyName;
  readonly metadata: ColonyMetadata;

  isActive: boolean;
  colonies: Array<PlayerId>;
  trackPosition: number;
  visitor: PlayerId | undefined;

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
   * never a central table.
   */
  tradeIncomeBlockedReason(player: IPlayer, position: number): string | undefined;
  /**
   * The reach of a trade by this player here (see {@link TradeTrackPlan}) —
   * the offset's arithmetic and the colony's per-position refusals folded
   * into one plan. `bonusTradeOffset` is the extra step a payment path
   * grants (the Unity action, Trade Advance).
   */
  tradeTrackPlan(player: IPlayer, bonusTradeOffset?: number): TradeTrackPlan;
  /**
   * Why THIS player may not trade here at all right now, or `undefined` when
   * a trade can legally read its income somewhere within the offset's reach.
   * The colony's OWN gate only — whether the tile is active and unvisited is
   * `ColoniesHandler.openColonies`' question, and the player's fleet / fee is
   * `player.colonies.tradeBlockedReason()`'s.
   */
  tradeBlockedReason(player: IPlayer, bonusTradeOffset?: number): string | undefined;
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
