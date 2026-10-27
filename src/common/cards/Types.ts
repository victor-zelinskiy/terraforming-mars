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
 * The PARTY requirement is IGNORED (Backroom Deal TR70 — «ignore any party
 * requirements on the next card you play this generation»): the one-play
 * class's FOURTH kind, declared like the global waiver and read by the same
 * readers (`armedPlayEffects`, `requirementEasing`), paid by
 * `PartyRequirement.satisfies` through `IPlayer.partyRequirementWaiver`. A
 * KIND, never a number — a party requirement has no scale to stretch. It
 * never touches a global-parameter requirement (that is the other kind) and
 * never grants the party's EFFECT (TR36's law: the effect's threshold is the
 * Parliament's, a requirement is the card's).
 */
export type PartyRequirementWaiver = {
  /**
   * Only the next card played spends it (Backroom Deal TR70). Absent — a STANDING waiver, live while the card is on
   * the table (TR83 The Deimos Group: «when playing cards, you can ignore all party requirements»); the readers name
   * a standing waiver before an armed one (`IPlayer.partyRequirementWaiver`).
   */
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
