import {Message} from '../../common/logs/Message';
import {OptionMetadata} from '../../common/models/PlayerInputModel';
import {IColony} from './IColony';

/** Something that can pay for trading with colonies. */
export interface IColonyTrader {
  canUse(): boolean;
  optionText(): string | Message;
  trade(colony: IColony): void;
  /** OPTIONAL premium-UI metadata for the trade-payment picker (resource icon +
   *  cost + current→resulting). Standard-resource traders supply it; card
   *  traders may omit it (text fallback). */
  optionMetadata?(): OptionMetadata;
  /** OPTIONAL reason this payment can't be used right now (shown as a DISABLED
   *  option). Supplied by standard-resource traders so an unaffordable resource
   *  is shown greyed instead of vanishing. */
  disabledReason?(): string | Message;
}
