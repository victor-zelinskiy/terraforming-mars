import {CardModel} from '@/common/models/CardModel';
import {CardType} from '@/common/cards/CardType';
import {Tag} from '@/common/cards/Tag';
import {CardName} from '@/common/cards/CardName';
import {getCard} from '@/client/cards/ClientCardManifest';
import {translateText} from '@/client/directives/i18n';
import {computeHandCardPlayState, HandCardPlayState} from '@/client/components/handCards/cardPlayability';

/**
 * Presentation model for the premium "cards in hand" overlay. Builds a
 * flat, filterable, sortable list of hand entries (the overlay lays them
 * out in an adaptive grid — NO type grouping, unlike the played-cards
 * board) plus the data that drives the filter chips. Playability comes
 * from `cardPlayability.ts`.
 */

export type HandTypeKey = 'active' | 'automated' | 'event';

export type HandTypeDef = {
  key: HandTypeKey;
  type: CardType;
  /** i18n key for the filter chip (reuses existing card-type labels). */
  label: string;
};

// Project cards in hand are only these three types. Stable display order:
// active (blue) → automated (green) → events (red), matching the rest of
// the fork's card-family ordering.
export const HAND_TYPE_DEFS: ReadonlyArray<HandTypeDef> = [
  {key: 'active', type: CardType.ACTIVE, label: 'Active'},
  {key: 'automated', type: CardType.AUTOMATED, label: 'Automated'},
  {key: 'event', type: CardType.EVENT, label: 'Events'},
];

const TYPE_TO_KEY: Partial<Record<CardType, HandTypeKey>> = {
  [CardType.ACTIVE]: 'active',
  [CardType.AUTOMATED]: 'automated',
  [CardType.EVENT]: 'event',
};

const TYPE_ORDER: Record<HandTypeKey, number> = {active: 0, automated: 1, event: 2};

export type HandCardEntry = {
  card: CardModel;
  name: CardName;
  type: CardType;
  typeKey: HandTypeKey | undefined;
  /** Printed tags (no auto-added EVENT tag) — drives tag chips + filter. */
  tags: ReadonlyArray<Tag>;
  /** Effective (discounted) cost used for the cost sort + badges. */
  cost: number;
  state: HandCardPlayState;
};

export type AvailabilityFilter = 'all' | 'playable' | 'unplayable';
export type HandSortMode = 'availability' | 'cost' | 'type' | 'tag' | 'name';
export type HandSortDir = 'asc' | 'desc';

export type HandFilterState = {
  availability: AvailabilityFilter;
  /** Type keys the player has toggled OFF (hidden). Empty = all shown. */
  hiddenTypes: ReadonlyArray<HandTypeKey>;
  /** Tags the player has selected to narrow to. Empty = no tag narrowing. */
  activeTags: ReadonlyArray<Tag>;
  sort: HandSortMode;
  /** Ascending applies each sort's natural order; descending reverses it. */
  sortDir: HandSortDir;
};

export const DEFAULT_HAND_FILTER: HandFilterState = {
  availability: 'all',
  hiddenTypes: [],
  activeTags: [],
  sort: 'availability',
  sortDir: 'asc',
};

export function buildHandEntries(
  cards: ReadonlyArray<CardModel>,
  turnAvailable: boolean,
  playableNames: ReadonlySet<CardName>,
): ReadonlyArray<HandCardEntry> {
  return cards.map((card) => {
    const clientCard = getCard(card.name);
    const type = clientCard?.type ?? CardType.AUTOMATED;
    const tags = clientCard?.tags ?? [];
    const cost = card.calculatedCost ?? clientCard?.cost ?? 0;
    const state = computeHandCardPlayState(card, turnAvailable, playableNames.has(card.name));
    return {
      card,
      name: card.name,
      type,
      typeKey: TYPE_TO_KEY[type],
      tags,
      cost,
      state,
    };
  });
}

// ── Per-dimension predicates ─────────────────────────────────────────
// Each filter group is one independent dimension. Keeping the predicates
// separate lets `filterHandEntries` compose all three AND lets the faceted
// count builders re-apply every dimension EXCEPT the one they're counting
// (the standard faceted-search rule — a group never zeroes out its own
// options). See `buildAvailabilityChips` / `buildTypeChips` / `buildTagChips`.

function passAvailability(e: HandCardEntry, availability: AvailabilityFilter): boolean {
  switch (availability) {
  case 'playable': return e.state.playable;
  case 'unplayable': return !e.state.playable;
  default: return true;
  }
}

function passTypes(e: HandCardEntry, hidden: ReadonlySet<HandTypeKey>): boolean {
  return e.typeKey === undefined || !hidden.has(e.typeKey);
}

function passTags(e: HandCardEntry, activeTags: ReadonlySet<Tag>): boolean {
  return activeTags.size === 0 || e.tags.some((t) => activeTags.has(t));
}

export function filterHandEntries(
  entries: ReadonlyArray<HandCardEntry>,
  filter: HandFilterState,
): ReadonlyArray<HandCardEntry> {
  const hidden = new Set(filter.hiddenTypes);
  const activeTags = new Set(filter.activeTags);
  return entries.filter((e) =>
    passAvailability(e, filter.availability) &&
    passTypes(e, hidden) &&
    passTags(e, activeTags));
}

export function sortHandEntries(
  entries: ReadonlyArray<HandCardEntry>,
  sort: HandSortMode,
  dir: HandSortDir = 'asc',
): ReadonlyArray<HandCardEntry> {
  const out = entries.slice();
  const byName = (a: HandCardEntry, b: HandCardEntry) =>
    translateText(a.name).localeCompare(translateText(b.name));
  const typeRank = (e: HandCardEntry) => (e.typeKey !== undefined ? TYPE_ORDER[e.typeKey] : 99);
  // The "natural" (ascending) comparator for each mode. Descending simply
  // flips its sign, which reverses the primary key and its tie-breakers
  // together — fine for a display sort.
  const ascending = (a: HandCardEntry, b: HandCardEntry): number => {
    switch (sort) {
    case 'availability': {
      const av = Number(b.state.playable) - Number(a.state.playable);
      return av !== 0 ? av : a.cost - b.cost;
    }
    case 'cost':
      return a.cost - b.cost || byName(a, b);
    case 'type':
      return typeRank(a) - typeRank(b) || a.cost - b.cost;
    case 'tag': {
      const ta = a.tags[0] ?? '';
      const tb = b.tags[0] ?? '';
      return ta.localeCompare(tb) || byName(a, b);
    }
    case 'name':
    default:
      return byName(a, b);
    }
  };
  const sign = dir === 'asc' ? 1 : -1;
  out.sort((a, b) => sign * ascending(a, b));
  return out;
}

// ── Availability chips (faceted) ─────────────────────────────────────

export type AvailabilityChip = {
  value: AvailabilityFilter;
  label: string;
  /** Cards in this availability mode WITHIN the current type + tag slice. */
  count: number;
  active: boolean;
};

export const AVAILABILITY_DEFS: ReadonlyArray<{value: AvailabilityFilter; label: string}> = [
  {value: 'all', label: 'All'},
  {value: 'playable', label: 'Playable'},
  {value: 'unplayable', label: 'Unplayable'},
];

/**
 * Counts for the All / Playable / Unplayable segment. Faceted: the type +
 * tag filters are KEPT, only the availability dimension is varied — so each
 * button reads "how many cards would remain in that mode given everything
 * else I've already picked" (spec rule #3).
 */
export function buildAvailabilityChips(
  entries: ReadonlyArray<HandCardEntry>,
  filter: HandFilterState,
): ReadonlyArray<AvailabilityChip> {
  const hidden = new Set(filter.hiddenTypes);
  const activeTags = new Set(filter.activeTags);
  const base = entries.filter((e) => passTypes(e, hidden) && passTags(e, activeTags));
  let playable = 0;
  for (const e of base) {
    if (e.state.playable) {
      playable++;
    }
  }
  const counts: Record<AvailabilityFilter, number> = {
    all: base.length,
    playable,
    unplayable: base.length - playable,
  };
  return AVAILABILITY_DEFS.map((def) => ({
    value: def.value,
    label: def.label,
    count: counts[def.value],
    active: filter.availability === def.value,
  }));
}

// ── Type chips (faceted) ─────────────────────────────────────────────

export type HandTypeChip = {
  key: HandTypeKey;
  label: string;
  /** Cards of this type WITHIN the current availability + tag slice. */
  count: number;
  /** Not toggled off by the player. */
  enabled: boolean;
  /** Faceted count is 0 — present in the hand but not in this slice. */
  muted: boolean;
};

/**
 * Type chips with faceted counts. The count keeps the availability + tag
 * filters but EXCLUDES the type dimension itself, so toggling one type
 * doesn't change the numbers shown on the other type chips. A chip is
 * rendered as long as the type exists ANYWHERE in the hand (so the row
 * never reflows when a slice empties a type); when its faceted count hits 0
 * it's `muted` (disabled-looking) instead of vanishing (spec rule #5).
 */
export function buildTypeChips(
  entries: ReadonlyArray<HandCardEntry>,
  filter: HandFilterState,
): ReadonlyArray<HandTypeChip> {
  const hidden = new Set(filter.hiddenTypes);
  const activeTags = new Set(filter.activeTags);
  const base = entries.filter((e) => passAvailability(e, filter.availability) && passTags(e, activeTags));
  return HAND_TYPE_DEFS
    .filter((def) => entries.some((e) => e.typeKey === def.key))
    .map((def) => {
      const count = base.filter((e) => e.typeKey === def.key).length;
      return {
        key: def.key,
        label: def.label,
        count,
        enabled: !hidden.has(def.key),
        muted: count === 0,
      };
    });
}

// ── Tag chips (faceted) ──────────────────────────────────────────────

export type HandTagChip = {
  tag: Tag;
  /** Cards carrying this tag WITHIN the current availability + type slice. */
  count: number;
  active: boolean;
  /** Faceted count is 0 and the tag isn't selected — render it muted. */
  muted: boolean;
};

// Tags worth offering as filters — printed gameplay tags. WILD / CLONE are
// dropped (not meaningful hand filters); EVENT is never in printed tags.
const FILTERABLE_TAGS: ReadonlyArray<Tag> = [
  Tag.BUILDING, Tag.SPACE, Tag.SCIENCE, Tag.POWER, Tag.EARTH, Tag.JOVIAN,
  Tag.VENUS, Tag.PLANT, Tag.MICROBE, Tag.ANIMAL, Tag.CITY, Tag.MOON, Tag.MARS,
];

/**
 * Tag chips with faceted counts. The count keeps the availability + type
 * filters but EXCLUDES the tag dimension (the standard faceted rule for an
 * OR multi-select group), so each tag reads "how many cards carry it in the
 * current slice". A chip is rendered while the tag exists anywhere in the
 * hand; an unselected tag with a 0 faceted count is `muted`. Selected tags
 * stay interactive even at 0 so the player can always clear them.
 */
export function buildTagChips(
  entries: ReadonlyArray<HandCardEntry>,
  filter: HandFilterState,
): ReadonlyArray<HandTagChip> {
  const active = new Set(filter.activeTags);
  const hidden = new Set(filter.hiddenTypes);
  const base = entries.filter((e) => passAvailability(e, filter.availability) && passTypes(e, hidden));
  const globalCounts = new Map<Tag, number>();
  for (const e of entries) {
    for (const tag of e.tags) {
      globalCounts.set(tag, (globalCounts.get(tag) ?? 0) + 1);
    }
  }
  const facetCounts = new Map<Tag, number>();
  for (const e of base) {
    for (const tag of e.tags) {
      facetCounts.set(tag, (facetCounts.get(tag) ?? 0) + 1);
    }
  }
  return FILTERABLE_TAGS
    .filter((tag) => (globalCounts.get(tag) ?? 0) > 0)
    .map((tag) => {
      const count = facetCounts.get(tag) ?? 0;
      const isActive = active.has(tag);
      return {tag, count, active: isActive, muted: count === 0 && !isActive};
    });
}

export function countPlayable(entries: ReadonlyArray<HandCardEntry>): number {
  return entries.reduce((n, e) => n + (e.state.playable ? 1 : 0), 0);
}
