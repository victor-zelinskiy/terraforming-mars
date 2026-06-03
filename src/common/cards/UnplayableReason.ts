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
  /** English i18n template, e.g. `'Requires ${0}% oxygen'`. */
  message: string;
  /** Values for the template's `${0}`, `${1}`, … slots. */
  params?: ReadonlyArray<string>;
  /** When set, the popover renders this tag's icon next to the text. */
  tag?: Tag;
  /** When set, the popover renders this resource's icon next to the text. */
  resource?: Resource;
  /** The player's current value, shown as a muted "now: N" badge. */
  current?: number;
}
