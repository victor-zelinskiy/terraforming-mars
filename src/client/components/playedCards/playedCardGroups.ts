import {CardModel} from '@/common/models/CardModel';
import {CardType} from '@/common/cards/CardType';
import {Tag} from '@/common/cards/Tag';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {getCard} from '@/client/cards/ClientCardManifest';

/**
 * Group model for the "played cards" board overlay.
 *
 * Cards are grouped by their CardType into a small, stable set of
 * semantic groups (corporation / preludes / CEO / active / automated /
 * events) — the same families the physical tableau reads as. Grouping is
 * structural (by `CardType` via `getCardsByType`), never by text.
 *
 * `identity` groups (corporation, preludes, CEO) are the few cards that
 * define WHO the player is — they're always shown as full cards and never
 * collapse into stacks. The rest are "project" groups whose presentation
 * adapts (expanded → compact → vertical stacks) to the card count.
 */
export type PlayedGroupKey = 'corporation' | 'prelude' | 'ceo' | 'active' | 'automated' | 'event';

export type PlayedGroupDef = {
  key: PlayedGroupKey;
  types: ReadonlyArray<CardType>;
  /** i18n key for the group header / filter chip. */
  label: string;
  /** CSS accent modifier (matches the card-type colour family). */
  accent: PlayedGroupKey;
  /** Identity card (corp/prelude/ceo): always shown full, never stacked. */
  identity: boolean;
};

// Logical, stable order — identity first (corp → preludes → CEO), then the
// project families by colour (blue → green → orange).
export const PLAYED_GROUPS: ReadonlyArray<PlayedGroupDef> = [
  {key: 'corporation', types: [CardType.CORPORATION], label: 'Corporation', accent: 'corporation', identity: true},
  {key: 'prelude', types: [CardType.PRELUDE], label: 'Preludes', accent: 'prelude', identity: true},
  {key: 'ceo', types: [CardType.CEO], label: 'CEO', accent: 'ceo', identity: true},
  {key: 'active', types: [CardType.ACTIVE], label: 'Active', accent: 'active', identity: false},
  {key: 'automated', types: [CardType.AUTOMATED], label: 'Automated', accent: 'automated', identity: false},
  {key: 'event', types: [CardType.EVENT], label: 'Events', accent: 'event', identity: false},
];

export type PlayedGroup = PlayedGroupDef & {
  cards: ReadonlyArray<CardModel>;
};

/**
 * Cards of the given types, in PLAY ORDER (oldest → newest). The tableau
 * is appended as cards are played, so its natural order is oldest-first;
 * we preserve it (unlike `CardUtils.getCardsByType`, which reverses). The
 * grid renders this order directly ("сначала старые потом новые"); the
 * vertical stacks render it reversed so the newest sits on top.
 */
function cardsOfTypes(tableau: ReadonlyArray<CardModel>, types: ReadonlyArray<CardType>): ReadonlyArray<CardModel> {
  return tableau.filter((c) => {
    const type = getCard(c.name)?.type;
    return type !== undefined && types.includes(type);
  });
}

/** Builds every group (including empty ones — callers filter as needed). */
export function buildPlayedGroups(tableau: ReadonlyArray<CardModel>): ReadonlyArray<PlayedGroup> {
  return PLAYED_GROUPS.map((def) => ({
    ...def,
    cards: cardsOfTypes(tableau, def.types),
  }));
}

export function totalPlayedCards(player: PublicPlayerModel): number {
  return buildPlayedGroups(player.tableau).reduce((sum, g) => sum + g.cards.length, 0);
}

// ── Filtering (type + tag) ────────────────────────────────────────────
//
// The board has TWO independent filter dimensions:
//  - type groups the player has hidden (`hiddenGroups`, toggle-to-hide);
//  - tags the player has selected to narrow to (`activeTags`, positive
//    narrowing — empty means "no tag narrowing", mirrors the hand overlay).
// They AND together. The faceted chip counts follow the standard rule (each
// dimension's count keeps the OTHER dimension but excludes its own).

export type PlayedFilter = {
  hiddenGroups: ReadonlyArray<PlayedGroupKey>;
  activeTags: ReadonlyArray<Tag>;
};

// Tags worth offering as played-card filters — the same printed gameplay tags
// the hand overlay offers. WILD / CLONE are dropped (not meaningful filters);
// EVENT is the auto-added type tag, never a printed tag.
export const PLAYED_FILTERABLE_TAGS: ReadonlyArray<Tag> = [
  Tag.BUILDING, Tag.SPACE, Tag.SCIENCE, Tag.POWER, Tag.EARTH, Tag.JOVIAN,
  Tag.VENUS, Tag.PLANT, Tag.MICROBE, Tag.ANIMAL, Tag.CITY, Tag.MOON, Tag.MARS,
];

/** Printed tags of a played card (no auto EVENT tag) — matches the chips. */
export function playedCardTags(card: CardModel): ReadonlyArray<Tag> {
  return getCard(card.name)?.tags ?? [];
}

function passTagFilter(card: CardModel, activeTags: ReadonlySet<Tag>): boolean {
  if (activeTags.size === 0) {
    return true;
  }
  return playedCardTags(card).some((t) => activeTags.has(t));
}

/**
 * Applies both filter dimensions to the built (non-empty) groups: drops
 * hidden-type groups, narrows each surviving group's cards by the tag
 * filter, then drops any group left empty. Returns the visible groups (each
 * with its filtered card list), preserving group + play order.
 */
export function filterPlayedGroups(
  groups: ReadonlyArray<PlayedGroup>,
  filter: PlayedFilter,
): ReadonlyArray<PlayedGroup> {
  const hidden = new Set(filter.hiddenGroups);
  const activeTags = new Set(filter.activeTags);
  const out: Array<PlayedGroup> = [];
  for (const g of groups) {
    if (g.cards.length === 0 || hidden.has(g.key)) {
      continue;
    }
    const cards = activeTags.size === 0 ? g.cards : g.cards.filter((c) => passTagFilter(c, activeTags));
    if (cards.length > 0) {
      out.push({...g, cards});
    }
  }
  return out;
}

// ── Type chips (faceted by the tag filter) ────────────────────────────

export type PlayedTypeChip = {
  key: PlayedGroupKey;
  label: string;
  accent: PlayedGroupKey;
  /** Cards of this type that pass the CURRENT tag filter. */
  count: number;
  /** Group is shown (not toggled off). */
  enabled: boolean;
};

/**
 * One chip per non-empty card-type group. The count is faceted by the tag
 * dimension (so it reflects what the tag narrowing leaves) but NOT by the
 * group's own hidden state — the count tells the player how many cards the
 * group would contribute if shown.
 */
export function buildPlayedTypeChips(
  nonEmptyGroups: ReadonlyArray<PlayedGroup>,
  filter: PlayedFilter,
): ReadonlyArray<PlayedTypeChip> {
  const hidden = new Set(filter.hiddenGroups);
  const activeTags = new Set(filter.activeTags);
  return nonEmptyGroups.map((g) => ({
    key: g.key,
    label: g.label,
    accent: g.accent,
    count: activeTags.size === 0 ? g.cards.length : g.cards.filter((c) => passTagFilter(c, activeTags)).length,
    enabled: !hidden.has(g.key),
  }));
}

// ── Tag chips (faceted by the type filter) ────────────────────────────

export type PlayedTagChip = {
  tag: Tag;
  /** Cards carrying this tag within the current (non-hidden) type slice. */
  count: number;
  active: boolean;
  /** Faceted count is 0 and the tag isn't selected — render it muted. */
  muted: boolean;
};

/**
 * Tag chips with faceted counts. The base keeps the type dimension (drops
 * hidden groups) but EXCLUDES the tag dimension, so each tag reads "how many
 * still-visible cards carry it". A chip is rendered while the tag exists in
 * ANY played card (so the row never reflows); an unselected tag absent from
 * the current slice goes muted. Selected tags stay clickable at 0 so they can
 * always be cleared.
 */
export function buildPlayedTagChips(
  nonEmptyGroups: ReadonlyArray<PlayedGroup>,
  filter: PlayedFilter,
): ReadonlyArray<PlayedTagChip> {
  const hidden = new Set(filter.hiddenGroups);
  const active = new Set(filter.activeTags);
  const globalCounts = new Map<Tag, number>();
  const facetCounts = new Map<Tag, number>();
  for (const g of nonEmptyGroups) {
    const visible = !hidden.has(g.key);
    for (const card of g.cards) {
      for (const tag of playedCardTags(card)) {
        globalCounts.set(tag, (globalCounts.get(tag) ?? 0) + 1);
        if (visible) {
          facetCounts.set(tag, (facetCounts.get(tag) ?? 0) + 1);
        }
      }
    }
  }
  return PLAYED_FILTERABLE_TAGS
    .filter((tag) => (globalCounts.get(tag) ?? 0) > 0)
    .map((tag) => {
      const count = facetCounts.get(tag) ?? 0;
      const isActive = active.has(tag);
      return {tag, count, active: isActive, muted: count === 0 && !isActive};
    });
}
