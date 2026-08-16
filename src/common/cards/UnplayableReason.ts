import {Tag} from './Tag';
import {Resource} from '../Resource';

/**
 * A single, structured reason a project card in hand can't be played right
 * now. Produced authoritatively on the SERVER from the real playability
 * logic (`src/server/models/unplayableReasons.ts` — reuses each card's
 * `CardRequirement.satisfies`, the player's affordability computation, and
 * the board placement / target checks from the behavior executor), then
 * rendered by the premium hand overlay popover (`HandCardReasonPopover`).
 *
 * `turn` / `phase` are the exception: they describe the action window rather
 * than the card itself, so the client adds them from `playerView.waitingFor`
 * (the server doesn't know "is it this viewer's turn" when serializing a
 * card in isolation).
 *
 * `message` is an English i18n template (translated client-side via
 * `translateTextWithParams`); `params` fills its `${0}` slots. Optional
 * `tag` / `resource` drive an inline icon, and `current` renders a muted
 * "now: N" badge so the player sees the gap (required vs. current) at a
 * glance.
 */
export type UnplayableReasonType =
  | 'megacredits' // affordability gap, in M€-equivalent (after discounts + Reds)
  | 'resource' // not enough of a standard resource in stock (renders its icon) — used by action availability
  | 'globalParameter' // oxygen / temperature / Venus / oceans (min or max)
  | 'tr' // terraform-rating requirement
  | 'tag' // tag-count requirement (renders the tag icon)
  | 'production' // production requirement (renders the resource icon)
  | 'count' // a counted requirement (cities, colonies, greeneries, rates, …)
  | 'party' // Turmoil political requirement (chairman / party / leaders)
  | 'placement' // no available space for a tile the card must place
  | 'target' // no valid target for the card's effect
  | 'phase' // cards can't be played in the current phase (client-derived)
  | 'turn' // not this player's action window (client-derived)
  | 'rule' // a bespoke can-play rule we can't introspect further
  | 'generic'; // a requirement type we don't describe in detail

export interface UnplayableReason {
  type: UnplayableReasonType;
  /**
   * This reason is a PRINTED CARD REQUIREMENT — the condition written on the
   * card itself (a global parameter, a tag count, a production, a TR, a
   * counted thing, a political situation), produced by
   * `collectRequirementReasons` from the card's own `CardRequirement.satisfies`.
   *
   * Everything else is SITUATIONAL: affordability, "no space for the tile",
   * "no valid target", a bespoke rule ("no card action was used this
   * generation"), the client's turn/phase. Those describe THIS MOMENT, not
   * the card, so a surface that is about the CARD (the draft pick, the
   * research buy — where the card is being taken for LATER) must show only
   * the requirements. `type` alone cannot express this: `production` and
   * `party` are each produced by both paths.
   */
  requirement?: boolean;
  /** English i18n template, e.g. `'Requires ${0}% oxygen'`. */
  message: string;
  /** Values for the template's `${0}`, `${1}`, … slots. */
  params?: ReadonlyArray<string>;
  /** When set, the popover renders this tag's icon next to the text. */
  tag?: Tag;
  /** When set, the popover renders this resource's icon next to the text. */
  resource?: Resource;
  /**
   * For `type: 'globalParameter'` — WHICH parameter, structurally (so a client
   * compact label doesn't have to sniff the translatable `message` text for
   * "Venus" / "ocean" / "oxygen", which vanishes in non-English locales).
   */
  globalParameter?: 'temperature' | 'oxygen' | 'oceans' | 'venus';
  /** The player's current value, shown as a muted "now: N" badge. */
  current?: number;
  /**
   * Only ever set together with `requirement: true`: this printed requirement
   * is PROVABLY no longer satisfiable in this game — the parameter is past a
   * maximum bound, cannot decrease under the active expansions' real rules,
   * and every requirement modifier the player currently has (Inventrix,
   * Adaptation Technology, an armed Special Design, policies, tokens — they
   * are all folded into the real `satisfies` check) still leaves the card
   * short. Computed by `requirementUnattainable` in
   * `src/server/models/unplayableReasons.ts`; absent = the requirement may
   * still be met later, so a card-evaluation surface (draft, research buy)
   * shows the softer "not met YET" voice.
   */
  unattainable?: boolean;
  /**
   * For a global-parameter requirement whose player currently holds a
   * requirement-bonus (±2-step effects and friends): the EFFECTIVE bound in
   * the parameter's own units after those modifiers, when it differs from the
   * printed `params` value. Lets the UI explain "your modifiers stretch this
   * to N" without re-deriving game rules client-side.
   */
  effectiveCount?: number;
  /**
   * The `CardInfoBlock.id` of the RULES block this reason fully restates —
   * the same `req:<RequirementType>[:<tag|resource>][~<n>]` address the
   * build-time card-information generator produces for that very requirement
   * (`buildCardInformation.requirementBlock`). A surface showing both the
   * availability verdict AND the rules panel suppresses that one block, so a
   * requirement is never printed twice — once as a rule and once as the
   * reason it is unmet (the reason strictly dominates: it adds the CURRENT
   * value).
   *
   * Set ONLY when the reason is a complete restatement. A requirement whose
   * printed rule says more than the reason does — «(any player)» (`all`), an
   * adjacency (`nextTo`), a political situation, a consolidated block like
   * «city adjacent to an ocean» — deliberately carries no key, and its rule
   * stays visible. Never a text comparison: both sides derive the address
   * from the same structured descriptor.
   */
  requirementKey?: string;
}
