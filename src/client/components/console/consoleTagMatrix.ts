/*
 * consoleTagMatrix — PURE, DOM-free model of the МЕТКИ matrix in the console
 * left rail (and the Info Mode tag block): WHICH tags this game can produce,
 * in WHAT fixed order, with the viewer's current counts attached.
 *
 * Availability is SERVER-authoritative: `game.tags` (GameModel.tags) is the
 * set of printed tags found across every deck at game creation — it already
 * encodes the expansions, the game options and the exact card pool, so the
 * client never re-derives "is Venus in this game" from options. Two cells are
 * client-side additions because no deck can print them:
 *   · EVENT — event cards don't PRINT the event tag (Tags.countAllTags counts
 *     played events separately), so `game.tags` may not contain it even
 *     though every configuration has events;
 *   · NO_TAG_CELL — the count of played cards that print NO tag at all. It is
 *     the ABSENCE of a tag, so it can never be in `game.tags`, yet it is a
 *     scored quantity with its own printed medallion (Community Services pays
 *     per such card, Sagitta Frontier Services triggers on one, the
 *     Administrator award ranks them) — the matrix tracks it like the rest.
 * Both are always available.
 *
 * The order is canonical and value-independent (desktop PlayerTags ORDER:
 * card tags first, the meta counters — wild / clone / events / no-tags —
 * last), so a cell NEVER moves for the whole game: a count change only
 * mutates the number and the zero-state class, never the grid.
 */

import {Tag} from '@/common/cards/Tag';

/**
 * The one matrix cell that is NOT a tag: cards played with no printed tag.
 * Its count comes from `PublicPlayerModel.noTagsCount` (server:
 * `Tags.numberOfCardsWithNoTags` — events excluded, wild-only cards counted),
 * never from the per-tag count map. The string doubles as the DOM cell key
 * and as the `.tag-none` medallion's class suffix.
 */
export const NO_TAG_CELL = 'none';

/** A matrix cell: a printed tag, or the no-tag meta counter. */
export type ConsoleTagCell = Tag | typeof NO_TAG_CELL;

export interface ConsoleTagEntry {
  tag: ConsoleTagCell;
  count: number;
}

/** Canonical display order — fixed for the whole game, never resorted. */
export const CONSOLE_TAG_ORDER: ReadonlyArray<ConsoleTagCell> = [
  Tag.BUILDING, Tag.SPACE, Tag.SCIENCE, Tag.POWER, Tag.EARTH, Tag.JOVIAN,
  Tag.VENUS, Tag.PLANT, Tag.MICROBE, Tag.ANIMAL, Tag.CITY, Tag.MOON,
  Tag.MARS, Tag.CRIME, Tag.WILD, Tag.CLONE, Tag.EVENT, NO_TAG_CELL,
];

/*
 * Degraded fallback for a game model that carries no tag set (a save created
 * before `game.tags` existed): the base-game printed tags + the deck-less
 * counters. Deliberately conservative — better to miss an expansion tag on an
 * ancient save than to show Moon/clone cells in a base-only game.
 */
const FALLBACK_TAGS: ReadonlyArray<ConsoleTagCell> = [
  Tag.BUILDING, Tag.SPACE, Tag.SCIENCE, Tag.POWER, Tag.EARTH, Tag.JOVIAN,
  Tag.PLANT, Tag.MICROBE, Tag.ANIMAL, Tag.CITY, Tag.EVENT, NO_TAG_CELL,
];

/**
 * The tags available in this game, in canonical order. `gameTags` is
 * `playerView.game.tags` — pass it straight through; membership (not count)
 * decides visibility, so the result is stable for the whole game.
 */
export function consoleAvailableTags(gameTags: ReadonlyArray<Tag> | undefined): ReadonlyArray<ConsoleTagCell> {
  if (gameTags === undefined || gameTags.length === 0) {
    return FALLBACK_TAGS;
  }
  const inGame = new Set<ConsoleTagCell>(gameTags);
  inGame.add(Tag.EVENT); // events never print their tag — see the header note
  inGame.add(NO_TAG_CELL); // the absence of a tag is never in a deck's set
  return CONSOLE_TAG_ORDER.filter((tag) => inGame.has(tag));
}

/**
 * The full matrix for one player: every available tag with its current
 * count (0 when the map has no entry — the setup-reveal staged override
 * carries a partial map), plus the no-tag counter fed by its OWN server
 * field. Zero-count cells are INCLUDED by design.
 */
export function consoleTagEntries(
  gameTags: ReadonlyArray<Tag> | undefined,
  counts: Partial<Record<Tag, number>> | undefined,
  noTagsCount?: number,
): Array<ConsoleTagEntry> {
  return consoleAvailableTags(gameTags).map((tag) => ({
    tag,
    count: (tag === NO_TAG_CELL ? noTagsCount : counts?.[tag]) ?? 0,
  }));
}
