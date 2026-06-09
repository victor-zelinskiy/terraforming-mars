import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {CardResource} from '@/common/CardResource';
import {CardType} from '@/common/cards/CardType';
import {getCard} from '@/client/cards/ClientCardManifest';

/**
 * Additional (card) resources — the aggregation layer behind the
 * "ДОП. РЕСУРСЫ" side panel + its hover tooltip + detail overlay.
 *
 * These are resources stored ON cards/corporations (microbes, animals,
 * floaters, science, data, …) — NOT the six standard production resources.
 * A resource TYPE is "unlocked" for a player the moment they play a
 * card/corporation that CAN hold it, even while the count is still 0.
 *
 * Everything here is derived 100% client-side from the public player model:
 *   - each tableau `CardModel` carries the live `resources` COUNT;
 *   - the static client manifest (`getCard`) carries the `resourceType`
 *     (what the card can hold) even when the live count is 0.
 *
 * Ordering is FIRST-APPEARANCE: a resource type's slot is fixed by the play
 * order of the first card that unlocks it (tableau is oldest→newest), so rows
 * never jump around as amounts change.
 */

export interface AdditionalResourceCardEntry {
  /** The card/corporation holding (or able to hold) this resource. */
  readonly name: CardName;
  /** Live amount of this resource on that card (may be 0). */
  readonly amount: number;
  /** True for corporation cards, so the UI can flag the source kind. */
  readonly isCorporation: boolean;
}

export interface AdditionalResourceGroup {
  readonly resource: CardResource;
  /** Aggregated total across every capable card/corporation. */
  readonly total: number;
  /**
   * Every card/corporation that can hold this resource, in tableau (play)
   * order — INCLUDING those currently holding 0.
   */
  readonly cards: ReadonlyArray<AdditionalResourceCardEntry>;
}

/**
 * Build the ordered list of additional-resource groups for a player's tableau.
 *
 * @param tableau the player's played cards + corporation(s), in play order.
 */
export function additionalResourceGroups(
  tableau: ReadonlyArray<CardModel>,
): ReadonlyArray<AdditionalResourceGroup> {
  // `result` IS the first-appearance order (a group is pushed the first time
  // its resource is seen); the map only holds references INTO `result` for
  // O(1) accumulation, so no separate order list / non-null lookup is needed.
  const result: Array<{
    resource: CardResource;
    total: number;
    cards: Array<AdditionalResourceCardEntry>;
  }> = [];
  const byResource = new Map<CardResource, typeof result[number]>();

  for (const card of tableau) {
    const client = getCard(card.name);
    const resourceType = client?.resourceType;
    if (resourceType === undefined) {
      continue;
    }
    let group = byResource.get(resourceType);
    if (group === undefined) {
      group = {resource: resourceType, total: 0, cards: []};
      byResource.set(resourceType, group);
      result.push(group);
    }
    const amount = card.resources ?? 0;
    group.cards.push({
      name: card.name,
      amount,
      isCorporation: client?.type === CardType.CORPORATION,
    });
    group.total += amount;
  }

  return result;
}

/**
 * Find a single resource group within a tableau (used by the detail overlay,
 * which re-resolves the live player by colour on every render so it tracks
 * resource changes while open). Returns undefined if the player no longer has
 * any card capable of holding that resource.
 */
export function additionalResourceGroup(
  tableau: ReadonlyArray<CardModel>,
  resource: CardResource,
): AdditionalResourceGroup | undefined {
  return additionalResourceGroups(tableau).find((g) => g.resource === resource);
}

/** Stable per-resource metric key for the AnimatedMetricValue delta system. */
export function additionalResourceMetricKey(resource: CardResource): string {
  return `card-resource.${resource}.stock`;
}

/**
 * Resource-based victory-point scoring for a card.
 *
 * Every `resourcesHere` VP rule in the manifest is a PURE resource scorer
 * (verified across all cards — only the `per` / `each` modifiers ever appear,
 * never mixed with tag/cities/oceans/etc.), so detection is simply the
 * presence of `resourcesHere`. Semantics mirror the server `Counter.count`:
 *   sum = resources;  if (each) sum *= each;  if (per) sum = floor(sum / per)
 * → `each` = "VP per resource", `per` = "resources per VP". Returns undefined
 * for cards that merely STORE the resource without scoring from it.
 */
export interface ResourceScoring {
  /** Resources needed per 1 VP (server `per`, default 1). */
  readonly per: number;
  /** VP per resource before the `per` divisor (server `each`, default 1). */
  readonly each: number;
}

export function resourceScoring(name: CardName): ResourceScoring | undefined {
  const vp = getCard(name)?.victoryPoints;
  if (typeof vp !== 'object' || vp.resourcesHere === undefined) {
    return undefined;
  }
  return {per: vp.per ?? 1, each: vp.each ?? 1};
}

/** VP yielded by ONE resource (display-only linear rate: e.g. 1, 0.5, 2). */
export function vpPerResource(name: CardName): number {
  const s = resourceScoring(name);
  return s === undefined ? 0 : Number((s.each / s.per).toFixed(2));
}

/** Exact VP accrued on the card from `amount` resources (server formula). */
export function accumulatedVp(name: CardName, amount: number): number {
  const s = resourceScoring(name);
  return s === undefined ? 0 : Math.floor((amount * s.each) / s.per);
}
