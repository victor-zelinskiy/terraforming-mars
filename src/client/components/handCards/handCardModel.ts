/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 * Before changing it, check the console consumers in docs/DESKTOP_DEPRECATION_AUDIT.md.
 */
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
  /**
   * Acquisition order — the index of the card in the server's `cardsInHand`
   * array. The server pushes newly drawn cards to the END of that array
   * (`cardsInHand.push(...)`) and removing a played/sold card preserves the
   * relative order of the rest, so a smaller index === acquired earlier.
   * Drives the "By acquisition time" sort (the default). There's no real
   * timestamp on a hand card, so this stable server order is the proxy.
   */
  order: number;
  state: HandCardPlayState;
};

export type AvailabilityFilter = 'all' | 'playable' | 'unplayable';
// 'received' = acquisition order (server hand order, oldest → newest). It's
// the default because that's the most natural way to read a freshly-grown hand.
export type HandSortMode = 'received' | 'availability' | 'cost' | 'type' | 'tag' | 'name';
export type HandSortDir = 'asc' | 'desc';

export type HandFilterState = {
  availability: AvailabilityFilter;
  /**
   * Card types the player has selected to narrow to (POSITIVE narrowing, same
   * model as `activeTags`). Empty = no type narrowing (all shown). Unified
   * with the tag filter so both behave identically (select-to-keep), rather
   * than the old toggle-to-hide semantics.
   */
  activeTypes: ReadonlyArray<HandTypeKey>;
  /** Tags the player has selected to narrow to. Empty = no tag narrowing. */
  activeTags: ReadonlyArray<Tag>;
  sort: HandSortMode;
  /** Ascending applies each sort's natural order; descending reverses it. */
  sortDir: HandSortDir;
};

export const DEFAULT_HAND_FILTER: HandFilterState = {
  availability: 'all',
  activeTypes: [],
  activeTags: [],
  // Default to acquisition order (oldest → newest) — the most natural way to
  // perceive the hand as it grows. Ascending keeps the oldest cards first.
  sort: 'received',
  sortDir: 'asc',
};

export function buildHandEntries(
  cards: ReadonlyArray<CardModel>,
  turnAvailable: boolean,
  playableNames: ReadonlySet<CardName>,
  awaitingInput: boolean,
): ReadonlyArray<HandCardEntry> {
  return cards.map((card, index) => {
    const clientCard = getCard(card.name);
    const type = clientCard?.type ?? CardType.AUTOMATED;
    const tags = clientCard?.tags ?? [];
    const cost = card.calculatedCost ?? clientCard?.cost ?? 0;
    const state = computeHandCardPlayState(card, turnAvailable, playableNames.has(card.name), awaitingInput);
    return {
      card,
      name: card.name,
      type,
      typeKey: TYPE_TO_KEY[type],
      tags,
      cost,
      // Index in the server's cardsInHand array (newest pushed last) — the
      // acquisition-order proxy used by the 'received' sort.
      order: index,
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

// "Unplayable" means unplayable BY THE RULES (block === 'rules'). A soft block
// (not your turn / finish your current action) is NOT a rule failure, so it
// counts as playable here — it must never land in the "unavailable" bucket.
// This keeps All = Playable + Unplayable, so the faceted segment math holds.
//
// `selectable` re-points the availability dimension for a SELECT / PICK context
// (the КАРТЫ В РУКЕ overlay in sale / mandatory-select / client-pick mode): there
// "available" means the card can be CHOSEN right now (it's in the prompt's
// candidate set), NOT "can be played". So the Available / Unavailable chips
// describe the current pick, not playability. Pass it whenever the overlay is in
// a select mode; omit it for normal play.
function isEntryAvailable(e: HandCardEntry, selectable: ReadonlySet<CardName> | undefined): boolean {
  return selectable !== undefined ? selectable.has(e.name) : e.state.block !== 'rules';
}
function passAvailability(e: HandCardEntry, availability: AvailabilityFilter, selectable?: ReadonlySet<CardName>): boolean {
  switch (availability) {
  case 'playable': return isEntryAvailable(e, selectable);
  case 'unplayable': return !isEntryAvailable(e, selectable);
  default: return true;
  }
}

// Positive narrowing, mirrors passTags: no selection = all pass; otherwise
// only the selected types pass.
function passTypes(e: HandCardEntry, activeTypes: ReadonlySet<HandTypeKey>): boolean {
  return activeTypes.size === 0 || (e.typeKey !== undefined && activeTypes.has(e.typeKey));
}

function passTags(e: HandCardEntry, activeTags: ReadonlySet<Tag>): boolean {
  return activeTags.size === 0 || e.tags.some((t) => activeTags.has(t));
}

export function filterHandEntries(
  entries: ReadonlyArray<HandCardEntry>,
  filter: HandFilterState,
  selectable?: ReadonlySet<CardName>,
): ReadonlyArray<HandCardEntry> {
  const activeTypes = new Set(filter.activeTypes);
  const activeTags = new Set(filter.activeTags);
  return entries.filter((e) =>
    passAvailability(e, filter.availability, selectable) &&
    passTypes(e, activeTypes) &&
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
  // Availability rank: playable now → soft-blocked (waiting for turn) →
  // unplayable by rules. So the cards the player can act on float to the top.
  const playRank = (e: HandCardEntry) => (e.state.block === 'none' ? 0 : e.state.block === 'soft' ? 1 : 2);
  // The "natural" (ascending) comparator for each mode. Descending simply
  // flips its sign, which reverses the primary key and its tie-breakers
  // together — fine for a display sort.
  const ascending = (a: HandCardEntry, b: HandCardEntry): number => {
    switch (sort) {
    case 'received':
      // Acquisition order (server hand order). Ascending = oldest first.
      return a.order - b.order;
    case 'availability': {
      const av = playRank(a) - playRank(b);
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
  selectable?: ReadonlySet<CardName>,
): ReadonlyArray<AvailabilityChip> {
  const activeTypes = new Set(filter.activeTypes);
  const activeTags = new Set(filter.activeTags);
  const base = entries.filter((e) => passTypes(e, activeTypes) && passTags(e, activeTags));
  // In a SELECT context "available" = selectable-in-this-pick; in normal play it
  // = playable-by-rules (a soft turn/phase block still counts as playable, so it
  // sits on the "available" side of the segment).
  let unplayable = 0;
  for (const e of base) {
    if (!isEntryAvailable(e, selectable)) {
      unplayable++;
    }
  }
  const counts: Record<AvailabilityFilter, number> = {
    all: base.length,
    playable: base.length - unplayable,
    unplayable,
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
  /** Selected to narrow to (POSITIVE narrowing — same as tag chips). */
  active: boolean;
  /** Faceted count is 0 and the type isn't selected — render it muted. */
  muted: boolean;
  /**
   * Selected AND its faceted count is now 0 — the deliberate premium
   * "filter on, no results left" state. The chip stays visible + clickable
   * (so the player can always clear it) but renders ghosted. Distinct from
   * `muted` (which is the unselected no-results state). See `buildTagChips`.
   */
  activeEmpty: boolean;
};

/**
 * Type chips with faceted counts. POSITIVE narrowing, identical model to the
 * tag chips: an unselected chip is neutral, a selected chip narrows the hand
 * to that type, and selecting one doesn't change the other chips' numbers
 * (the count keeps the availability + tag filters but EXCLUDES the type
 * dimension itself). A chip is rendered while the type exists ANYWHERE in the
 * hand OR it's the active selection (so an active filter survives the last
 * matching card leaving the hand — `visible = exists || active`); an
 * unselected chip with a 0 faceted count goes `muted`, an active chip with a
 * 0 faceted count goes `activeEmpty`. Selected chips stay interactive at 0 so
 * they can always be cleared.
 */
export function buildTypeChips(
  entries: ReadonlyArray<HandCardEntry>,
  filter: HandFilterState,
  selectable?: ReadonlySet<CardName>,
): ReadonlyArray<HandTypeChip> {
  const active = new Set(filter.activeTypes);
  const activeTags = new Set(filter.activeTags);
  const base = entries.filter((e) => passAvailability(e, filter.availability, selectable) && passTags(e, activeTags));
  return HAND_TYPE_DEFS
    .filter((def) => entries.some((e) => e.typeKey === def.key) || active.has(def.key))
    .map((def) => {
      const count = base.filter((e) => e.typeKey === def.key).length;
      const isActive = active.has(def.key);
      return {
        key: def.key,
        label: def.label,
        count,
        active: isActive,
        muted: count === 0 && !isActive,
        activeEmpty: count === 0 && isActive,
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
  /**
   * Selected AND its faceted count is now 0 — the deliberate premium
   * "filter on, no results left" state (the player narrowed to this tag and
   * then played/removed the last matching card). The chip stays visible +
   * clickable so the filter can be cleared directly; it renders ghosted to
   * signal "no results", and clicking it clears the filter. Distinct from
   * `muted`, which is the UNSELECTED no-results state.
   */
  activeEmpty: boolean;
};

// Tags worth offering as filters — printed gameplay tags. WILD / CLONE are
// dropped (not meaningful hand filters); EVENT is never in printed tags.
// Exported so the console-native hand filter reuses the SAME canonical order.
export const FILTERABLE_TAGS: ReadonlyArray<Tag> = [
  Tag.BUILDING, Tag.SPACE, Tag.SCIENCE, Tag.POWER, Tag.EARTH, Tag.JOVIAN,
  Tag.VENUS, Tag.PLANT, Tag.MICROBE, Tag.ANIMAL, Tag.CITY, Tag.MOON, Tag.MARS,
];

/**
 * Tag chips with faceted counts. The count keeps the availability + type
 * filters but EXCLUDES the tag dimension (the standard faceted rule for an
 * OR multi-select group), so each tag reads "how many cards carry it in the
 * current slice". A chip is rendered while the tag exists anywhere in the
 * hand OR it's the active selection — so an active tag filter survives the
 * last matching card leaving the hand (`visible = exists || active`, the
 * premium "the filter stays directly clearable" rule). An unselected tag
 * with a 0 faceted count is `muted`; an active tag with a 0 faceted count is
 * `activeEmpty` (ghosted, still clickable). Selected tags stay interactive
 * even at 0 so the player can always clear them. The chips keep the stable
 * `FILTERABLE_TAGS` order, so an active-empty chip never jumps position.
 */
export function buildTagChips(
  entries: ReadonlyArray<HandCardEntry>,
  filter: HandFilterState,
  selectable?: ReadonlySet<CardName>,
): ReadonlyArray<HandTagChip> {
  const active = new Set(filter.activeTags);
  const activeTypes = new Set(filter.activeTypes);
  const base = entries.filter((e) => passAvailability(e, filter.availability, selectable) && passTypes(e, activeTypes));
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
    .filter((tag) => (globalCounts.get(tag) ?? 0) > 0 || active.has(tag))
    .map((tag) => {
      const count = facetCounts.get(tag) ?? 0;
      const isActive = active.has(tag);
      return {tag, count, active: isActive, muted: count === 0 && !isActive, activeEmpty: count === 0 && isActive};
    });
}

// The header "Can play: N" counts cards playable BY THE RULES (everything that
// isn't a 'rules' block) — matching the "playable" availability chip. A soft
// block (not your turn / finish current action) doesn't make a card
// unavailable, so such cards still count here; on your own turn there are no
// soft blocks, so this equals the count of cards you can act on right now.
export function countPlayable(entries: ReadonlyArray<HandCardEntry>): number {
  return entries.reduce((n, e) => n + (e.state.block !== 'rules' ? 1 : 0), 0);
}
