import {ICard} from '../ICard';
import {IPlayer} from '../../IPlayer';
import {PlayerInput} from '../../PlayerInput';
import {CardType} from '../../../common/cards/CardType';
import {Behavior} from '../../behavior/Behavior';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';

export interface ICorporationCard extends ICard {
  type: CardType.CORPORATION;
  initialActionText?: string;
  initialAction?(player: IPlayer): PlayerInput | undefined;
  firstAction?: Behavior,
  /**
   * READ-ONLY preview of the corporation's MANDATORY first action — the
   * first-action analog of `ICard.cardPlayPreview`. CO-LOCATED in the card
   * file next to `initialAction` (the fork's co-location rule: an upstream
   * change to the action lands in the same diff as its preview). Only needed
   * for a BESPOKE `initialAction` override; a declarative `firstAction`
   * behavior auto-derives via the generic walkers. Built from the
   * `actionPreviews.ts` builders (`firstActionBranch` + note/chip helpers).
   */
  firstActionPreview?(player: IPlayer): ActionPreview;
  startingMegaCredits: number;
  cardCost?: number;
  // TODO(kberg): Remove after 2027-04-01
  onCardPlayedForCorps?: never;
}

export function isICorporationCard(card: ICard): card is ICorporationCard {
  return card.type === CardType.CORPORATION;
}
