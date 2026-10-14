import {GlobalParameter} from '../GlobalParameter';
import {Tag} from './Tag';

/**
 * Description of a discount for playing project tags.
 */
export type CardDiscount = {
  /** The tag this discount applies to, or when undefined, it applies to all cards. */
  tag?: Tag,
  /** The M€ discount. */
  amount: number,
  /** Describes whether the discount is applied once for the card, or for ever tag. */
  per?: 'card' | 'tag',
  /**
   * A ONE-PLAY discount: it applies only to the NEXT card the owner plays this
   * generation (while `lastCardPlayed` names the declaring card) — Indentured
   * Workers, Conscription, Eccentric Sponsor. The same knob, the same reading
   * as `GlobalParameterRequirementBonus.nextCardOnly` (TR49 class).
   */
  nextCardOnly?: boolean,
 }

/**
 * A type of global parameter requirement bonus.
 */
export type GlobalParameterRequirementBonus = {
  /** The size of the bonus, in steps. Exactly one of `steps` / `waive`. */
  steps?: number,
  /**
   * The requirements are IGNORED rather than shifted (Cutting-Edge Design
   * TR49, Ecology Experts): a waived requirement is MET — never a bound
   * «stretched by 50», which would leak a sentinel number into every reader.
   */
  waive?: true,
  /** The global parameter it applies to */
  parameter?: GlobalParameter,
  /** This discount only applies to the next card played when this is true. */
  nextCardOnly?: boolean,
};

/**
 * Describes which non-megacredit resources a standard project accepts as payment.
 */
export type StandardProjectCanPayWith = {
  steel?: boolean,
  titanium?: boolean,
  seeds?: boolean,
  kuiperAsteroids?: boolean,
}

/**
 * When defined, this indicates additional costs required to play a card.
 */
export type AdditionalProjectCosts = {
  /** Any resources that need to come off Think Tank to meet global requirements. */
  thinkTankResources?: number,
  /** Any resources that need to come off Aeron Genomics to meet global requirements. */
  aeronGenomicsResources?: number,
  /** Any predicted fees required to play this card because Reds are in power. */
  redsCost?: number,
}
