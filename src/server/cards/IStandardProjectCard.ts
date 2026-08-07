import {ICard} from './ICard';
import {CardType} from '../../common/cards/CardType';
import {CanAffordOptions, IPlayer} from '../IPlayer';
import {Payment} from '../../common/inputs/Payment';
import {Units} from '../../common/Units';
import {StandardProjectCanPayWith} from '../../common/cards/Types';

export interface IStandardProjectCard extends ICard {
  type: CardType.STANDARD_PROJECT;
  cost: number;
  /** Units that must be held back from payment because they are consumed during project execution (e.g. Moon tile titanium costs). */
  reserveUnits?: Units;
  /** Whether the player meets all prerequisites to use this standard project. */
  canAct(player: IPlayer): boolean;
  /** Which non-megacredit resources (steel, titanium, seeds, etc.) are accepted as payment for this project. */
  canPayWith(player: IPlayer): StandardProjectCanPayWith;
  /** Base cost minus any applicable discounts. */
  getAdjustedCost(player: IPlayer): number;
  /**
   * The full affordability request `canAct` checks — adjusted cost, TR bump,
   * reserved units, payable-with flags. Exposed so the read-only explainer
   * (`src/server/models/standardProjectReasons.ts`) can name the payment gap
   * from the SAME request the gate uses instead of rebuilding it.
   */
  canPlayOptions(player: IPlayer): CanAffordOptions;
  /** Deducts the payment and carries out the standard project's effect. */
  payAndExecute(player: IPlayer, payment: Payment): void;
}

export function isIStandardProjectCard(card: ICard): card is IStandardProjectCard {
  return card.type === CardType.STANDARD_PROJECT;
}
