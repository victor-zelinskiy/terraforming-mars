import {CardName} from '../cards/CardName';
import {CardType} from '../cards/CardType';
import {RequirementType} from '../cards/RequirementType';
import {Tag} from '../cards/Tag';
import {GlobalParameter} from '../GlobalParameter';
import {EventSource} from '../events/EventSource';
import {PartyName} from '../turmoil/PartyName';

/**
 * WHAT A ONE-PLAY EFFECT DOES to the card that spends it — the four kinds the
 * card set prints (TR49 class, `docs/TURMOIL_REDUX_CUTTING_EDGE_DESIGN.md`):
 *
 * - `requirementShift` — every global requirement of the next card is ±`steps`
 *   steps (Special Design: ±2, «your choice in each case»); `parameter` narrows
 *   it to one scale (none in the set today — the field is the declaration's).
 * - `requirementWaiver` — the next card IGNORES its global requirements
 *   (Cutting-Edge Design TR49, Ecology Experts). A KIND, never a number: an
 *   ignored requirement is MET, not «stretched by 50 steps».
 * - `partyWaiver` — the next card IGNORES its PARTY requirement (Backroom Deal
 *   TR70). The same kind of thing as the global waiver, for the other
 *   requirement family: never a global parameter, never the party's EFFECT.
 * - `discount` — the next card costs `amount` M€ less (Indentured Workers 8,
 *   Conscription 16, Eccentric Sponsor 25; Backroom Deal 10 beside its waiver —
 *   the set's first card that arms TWO effects at once).
 */
export type ArmedPlayEffectKind =
  | {kind: 'requirementShift'; steps: number; parameter?: GlobalParameter}
  | {kind: 'requirementWaiver'; parameter?: GlobalParameter}
  | {kind: 'partyWaiver'}
  | {kind: 'discount'; amount: number; tag?: Tag};

/**
 * AN ARMED ONE-PLAY EFFECT — what the NEXT card this player plays this
 * generation will spend. Armed by the card that was played last
 * (`IPlayer.lastCardPlayed` — one field, so one armed card at a time: a new
 * play REPLACES what was armed), spent by the next card played by ANY road
 * (from hand, from a prelude's «play a card», a variant), whether or not that
 * card needs it; lost on the pass that ends the player's generation.
 *
 * Read by ONE server reader (`cards/armedPlayEffects.ts`) off the source
 * card's own declarations, and published PUBLICLY on the seat
 * (`PublicPlayerModel.armedPlayEffects`): the arming card lies face-up on the
 * table and `lastCardPlayed` is public already, so a rival's «ЭФФЕКТЫ» shows
 * what this seat holds just as its own hand does.
 */
export type ArmedPlayEffectModel = {
  /** The card that armed it — the card played last. */
  source: CardName;
  /** The source's type — a PRELUDE hosts its own next play inside its effect. */
  sourceType: CardType;
  effect: ArmedPlayEffectKind;
  /** It ends with the next card play (or the pass that ends the generation). */
  expires: 'next-play';
};

/**
 * ONE MODIFIER OF A PRINTED GLOBAL REQUIREMENT, named — a card, a corporation,
 * a party policy, an underground token (`EventSource`, the same naming the
 * discount breakdown uses). `shift` moves the bound by `steps` (both
 * directions — a MIN bound relaxes down, a MAX bound stretches up); `waive`
 * sets the requirement aside entirely. `oneShot` = the next card play spends it.
 */
export type RequirementEasingSourceModel = {
  source: EventSource;
  kind: 'shift' | 'waive';
  /** For `shift`: the steps this source adds (always > 0 in the set). */
  steps?: number;
  oneShot: boolean;
};

/**
 * A PRINTED GLOBAL REQUIREMENT UNDER A MODIFIER — the server's ONE reading
 * (`models/requirementEasing.ts`) of how the player's modifiers bend one
 * global-parameter requirement of one card, so every surface that prints the
 * requirement (the face's requirement cassette in the hand / the composer's
 * hero / the inspector, the hand's plate, the availability verdict, «ДЛЯ ВАС»,
 * the composer's requirement row) tells the SAME story without deriving a
 * rule: printed → effective, by whom, for one play or for good.
 *
 * Present only when at least one modifier touches the requirement. Self-only
 * (rides the viewer's own hand, like `unplayableReasons`): a rival's card
 * face stays printed.
 */
export type RequirementEasingModel = {
  /**
   * The requirement's address — the same `req:<type>[~n]` the rules block and
   * `UnplayableReason.requirementKey` use, so the cassette, the reason and
   * the rule line point at one requirement.
   */
  key: string;
  /** Position in the card's printed requirement list (the cassette's order). */
  index: number;
  type: RequirementType;
  /** The scale of a GLOBAL-PARAMETER requirement; absent for a PARTY requirement. */
  parameter?: GlobalParameter;
  /**
   * The party of a PARTY requirement (Backroom Deal TR70 lifts it): such a
   * requirement is only ever WAIVED — `printed` is the delegates the printed
   * rule asks for (`PARTY_EFFECT_DELEGATES`), `current` the player's own on
   * that party's resolution, `effective` always `'waived'`.
   */
  party?: PartyName;
  /** A MAX bound («or less»). */
  max: boolean;
  /** The printed bound, in the scale's own units. */
  printed: number;
  /** The bound after every modifier; `'waived'` = the requirement is ignored. */
  effective: number | 'waived';
  /** The scale's value now (the HUD number). */
  current: number;
  /** The modifiers, named, in the order the engine sums them. */
  sources: ReadonlyArray<RequirementEasingSourceModel>;
  /** Met with the modifiers. */
  met: boolean;
  /**
   * Met ONLY because of the modifiers — the printed bound alone fails it. The
   * card is playable THANKS TO a named effect, and every surface says so.
   */
  decisive: boolean;
};

/**
 * WHAT THIS PLAY SPENDS (TR49 class): every armed one-play effect is spent by
 * the next card played, whether that card needs it or not — so the composer of
 * the next card names each one, and says whether THIS card uses it (`used`: a
 * requirement it lets through, a price it lowers) or spends it for nothing.
 * Computed by the server beside the play's forecast (`models/armedPlayForecast.ts`).
 */
export type ArmedPlayConsumption = {
  armed: ArmedPlayEffectModel;
  used: boolean;
};

/** The play's whole reading of the class: what it spends, and its requirements under modifiers. */
export type ArmedPlayForecast = {
  consumes: ReadonlyArray<ArmedPlayConsumption>;
  easings: ReadonlyArray<RequirementEasingModel>;
};
