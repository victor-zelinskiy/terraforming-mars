import {CardModel} from '@/common/models/CardModel';
import {CardType} from '@/common/cards/CardType';
import {Tag} from '@/common/cards/Tag';
import {CardName} from '@/common/cards/CardName';
import {GameModel} from '@/common/models/GameModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
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

export type HandFilterState = {
  availability: AvailabilityFilter;
  /** Type keys the player has toggled OFF (hidden). Empty = all shown. */
  hiddenTypes: ReadonlyArray<HandTypeKey>;
  /** Tags the player has selected to narrow to. Empty = no tag narrowing. */
  activeTags: ReadonlyArray<Tag>;
  sort: HandSortMode;
};

export const DEFAULT_HAND_FILTER: HandFilterState = {
  availability: 'all',
  hiddenTypes: [],
  activeTags: [],
  sort: 'availability',
};

export function buildHandEntries(
  cards: ReadonlyArray<CardModel>,
  game: GameModel,
  player: PublicPlayerModel,
  turnAvailable: boolean,
  playableNames: ReadonlySet<CardName>,
): ReadonlyArray<HandCardEntry> {
  return cards.map((card) => {
    const clientCard = getCard(card.name);
    const type = clientCard?.type ?? CardType.AUTOMATED;
    const tags = clientCard?.tags ?? [];
    const cost = card.calculatedCost ?? clientCard?.cost ?? 0;
    const state = computeHandCardPlayState(card, game, player, turnAvailable, playableNames.has(card.name));
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

export function filterHandEntries(
  entries: ReadonlyArray<HandCardEntry>,
  filter: HandFilterState,
): ReadonlyArray<HandCardEntry> {
  const hidden = new Set(filter.hiddenTypes);
  const activeTags = new Set(filter.activeTags);
  return entries.filter((e) => {
    if (filter.availability === 'playable' && !e.state.playable) {
      return false;
    }
    if (filter.availability === 'unplayable' && e.state.playable) {
      return false;
    }
    if (e.typeKey !== undefined && hidden.has(e.typeKey)) {
      return false;
    }
    if (activeTags.size > 0 && !e.tags.some((t) => activeTags.has(t))) {
      return false;
    }
    return true;
  });
}

export function sortHandEntries(
  entries: ReadonlyArray<HandCardEntry>,
  sort: HandSortMode,
): ReadonlyArray<HandCardEntry> {
  const out = entries.slice();
  const byName = (a: HandCardEntry, b: HandCardEntry) =>
    translateText(a.name).localeCompare(translateText(b.name));
  const typeRank = (e: HandCardEntry) => (e.typeKey !== undefined ? TYPE_ORDER[e.typeKey] : 99);
  out.sort((a, b) => {
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
  });
  return out;
}

export type HandTypeChip = {
  key: HandTypeKey;
  label: string;
  count: number;
  enabled: boolean;
};

export function buildTypeChips(
  entries: ReadonlyArray<HandCardEntry>,
  hiddenTypes: ReadonlyArray<HandTypeKey>,
): ReadonlyArray<HandTypeChip> {
  const hidden = new Set(hiddenTypes);
  return HAND_TYPE_DEFS
    .map((def) => ({
      key: def.key,
      label: def.label,
      count: entries.filter((e) => e.typeKey === def.key).length,
      enabled: !hidden.has(def.key),
    }))
    .filter((chip) => chip.count > 0);
}

export type HandTagChip = {
  tag: Tag;
  count: number;
  active: boolean;
};

// Tags worth offering as filters — printed gameplay tags. WILD / CLONE are
// dropped (not meaningful hand filters); EVENT is never in printed tags.
const FILTERABLE_TAGS: ReadonlyArray<Tag> = [
  Tag.BUILDING, Tag.SPACE, Tag.SCIENCE, Tag.POWER, Tag.EARTH, Tag.JOVIAN,
  Tag.VENUS, Tag.PLANT, Tag.MICROBE, Tag.ANIMAL, Tag.CITY, Tag.MOON, Tag.MARS,
];

export function buildTagChips(
  entries: ReadonlyArray<HandCardEntry>,
  activeTags: ReadonlyArray<Tag>,
): ReadonlyArray<HandTagChip> {
  const active = new Set(activeTags);
  const counts = new Map<Tag, number>();
  for (const e of entries) {
    for (const tag of e.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return FILTERABLE_TAGS
    .filter((tag) => (counts.get(tag) ?? 0) > 0)
    .map((tag) => ({tag, count: counts.get(tag) ?? 0, active: active.has(tag)}));
}

export function countPlayable(entries: ReadonlyArray<HandCardEntry>): number {
  return entries.reduce((n, e) => n + (e.state.playable ? 1 : 0), 0);
}
