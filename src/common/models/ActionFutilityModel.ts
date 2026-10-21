import {CardResource} from '../CardResource';

/**
 * AN ACTION WITH NO EFFECT — the server's PROVEN verdict that an action the rules allow would change nothing of value
 * right now (the owner's iteration of 2026-10-15: «действия, которые фактически не имеют смысла»).
 *
 * A heat conversion at the temperature's maximum, a card action whose whole result is a step of a maxed parameter
 * (Water Splitting Plant at 14 % oxygen), Search For Life holding its science already, a «1 M€ per city» with no city:
 * the action is LEGAL — and a player may take it on purpose to stall instead of passing, so nothing is ever blocked —
 * but it must not be counted, warned about or painted as an opportunity.
 *
 * PROVEN, never guessed: no verdict = the action has value. The verdict is given only when every yield of the action is
 * provably empty AND nothing on the table answers it (a Whales owner's animal on a blocked ocean, a card reacting to a
 * resource added, a still-live award / milestone / chairman quest counting it, a standard project's rebate). A card-level
 * `warnings` entry (`maxtemp`, …) is NOT this verdict: it says «PART of the effect is wasted» (Ironworks still pays its
 * steel at 14 % oxygen) — `server/models/actionFutility.ts` is the one writer.
 */

/** Why the action changes nothing. */
export type ActionFutilityKind =
  /** Its whole result is a step of a global parameter already at its limit. */
  | 'parameter-maxed'
  /** Its counted gain comes to nothing right now («1 M€ per city on Mars» with none). */
  | 'zero-yield'
  /** It adds a resource to «any card» and no card can take it. */
  | 'no-target'
  /** It adds a resource to a card whose points no longer grow, and nothing else uses or counts it. */
  | 'vp-capped'
  /**
   * Its whole result is a terraform rating the enacted law refuses (Turmoil Redux RX42 UNMI Veto: the player is
   * first by rating). A step of a scale under the veto is NOT this — the scale moves (the table moved, never nothing).
   */
  | 'rating-vetoed';

/** The global parameters a step of which can be all an action does. */
export type FutileParameter = 'temperature' | 'oxygen' | 'oceans' | 'venus';

export type ActionFutilityVerdict = {
  kind: ActionFutilityKind;
  /** The cause in words — an i18n key (+ params), printed on the action's tile and in its composer. */
  reason: string;
  reasonParams?: ReadonlyArray<string>;
  /** `parameter-maxed`: the parameter at its limit. */
  parameter?: FutileParameter;
  /** `vp-capped`: the resource that would land for nothing. */
  resource?: CardResource;
};

/** One branch of the action, in `ActionPreview.branches` order. */
export type ActionBranchFutility = {
  futile: boolean;
  verdict?: ActionFutilityVerdict;
};

export type ActionFutility = {
  /** Present iff EVERY branch the player can take now is futile — the whole action has no effect. */
  verdict?: ActionFutilityVerdict;
  /** Per branch (multi-branch actions only), positions of `ActionPreview.branches`. */
  branches?: ReadonlyArray<ActionBranchFutility>;
};
