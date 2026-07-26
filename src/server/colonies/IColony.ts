import {IPlayer} from '../IPlayer';
import {PlayerInput} from '../PlayerInput';
import {PlayerId} from '../../common/Types';
import {IGame} from '../IGame';
import {SerializedColony} from '../SerializedColony';
import {ColonyMetadata} from '../../common/colonies/ColonyMetadata';
import {ColonyName} from '../../common/colonies/ColonyName';

export type TradeOptions = {
  usesTradeFleet?: boolean;
  decreaseTrackAfterTrade?: boolean;
  giveColonyBonuses?: boolean;
  selfishTrade?: boolean;
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
   * `cubes` = how many of this recipient's cubes the call settles (1 for the
   * per-cube fan-out; the recipient's whole count for a BATCHED bonus — see
   * colonyBonusBatching.ts).
   */
  giveColonyBonus(player: IPlayer, isGiveColonyBonus?: boolean, cubes?: number): undefined | PlayerInput;
  serialize(): SerializedColony;
}
