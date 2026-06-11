import {CardResource} from '@/common/CardResource';

/**
 * Why a played card CAN'T be the target of an "add a resource to a card" pick
 * (РАЗЫГРАНО pick mode). The candidates all hold the resource being added, so the
 * target resource type(s) are inferred from the selectable set; this maps a
 * non-candidate card's own `resourceType` to a clear reason. PURE — the overlay
 * supplies the manifest lookups (and translates the returned English i18n key).
 *
 * Maximum clarity for the player: a card that holds no resources, or a different
 * resource than the one being added, says exactly that; the rare "right type but
 * excluded by a tag / minimum count" case falls back to a generic requirement
 * message (the server constraint isn't exposed to the client here).
 */
export const PICK_REASON_NO_RESOURCE = 'This card cannot hold resources';
export const PICK_REASON_WRONG_RESOURCE = 'This card holds a different resource';
export const PICK_REASON_CONDITION = 'This card does not meet the requirement';
// Non-resource picks (e.g. Cyberia copies production of building cards): a
// resource reason would mislead, so a plain "not eligible" / "already chosen".
export const PICK_REASON_GENERIC = 'This card cannot be chosen here';
export const PICK_REASON_ALREADY_PICKED = 'This card is already chosen';

export function playedPickUnavailableReason(
  cardResourceType: CardResource | undefined,
  targetResourceTypes: ReadonlySet<CardResource | undefined>,
): string {
  if (cardResourceType === undefined) {
    return PICK_REASON_NO_RESOURCE;
  }
  // A single concrete target resource type → a different type is the clear reason.
  if (targetResourceTypes.size === 1) {
    const [t] = [...targetResourceTypes];
    if (t !== undefined && cardResourceType !== t) {
      return PICK_REASON_WRONG_RESOURCE;
    }
  }
  // Right type (or an "any resource" target) but excluded by a tag / minimum count.
  return PICK_REASON_CONDITION;
}
