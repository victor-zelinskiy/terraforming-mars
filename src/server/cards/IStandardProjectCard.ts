import {ICard} from './ICard';
import {CardType} from '../../common/cards/CardType';
import {CanAffordOptions, IPlayer} from '../IPlayer';
import {Payment} from '../../common/inputs/Payment';
import {Units} from '../../common/Units';
import {StandardProjectCanPayWith} from '../../common/cards/Types';
import {ActionEffect} from '../../common/models/ActionPreviewModel';

export interface IStandardProjectCard extends ICard {
  type: CardType.STANDARD_PROJECT;
  cost: number;
  /** Units that must be held back from payment because they are consumed during project execution (e.g. Moon tile titanium costs). */
  reserveUnits?: Units;
  /**
   * The PAY-ON-COMMIT target this project asks for after the initial submit
   * (`payAndExecute` defers a CANCELLABLE placement / colony pick and charges
   * only inside its commit). Co-located with that very override so the two
   * can't drift — a `payAndExecute` branch that falls back to the committed
   * path (Aquifer with oceans maxed) answers `undefined` on the same
   * condition. Absent = the submit itself is the commit (terminal project).
   */
  standardProjectTarget?(player: IPlayer): 'space' | 'colony' | undefined;
  /**
   * Co-located GUARANTEED-effect chips beyond what the generic preview derives
   * from `cost` + `tr` (a production step, a bespoke gain). READ-ONLY — never
   * mutates state; wording comes from the `cards/actionPreviews.ts` builders.
   */
  standardProjectPreviewEffects?(player: IPlayer): ReadonlyArray<ActionEffect>;
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
