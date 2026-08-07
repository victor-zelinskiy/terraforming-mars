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
  /**
   * Why this payment path can't be used right now — shown as a DISABLED option
   * so an unusable path is greyed WITH its reason instead of vanishing.
   *
   * Returning `undefined` means "show nothing at all", and there is exactly one
   * honest use for it: the player does not OWN the card this trader belongs to,
   * so there is no option to explain. Every other refusal must name its blocker.
   */
  disabledReason?(): string | Message | undefined;
}
