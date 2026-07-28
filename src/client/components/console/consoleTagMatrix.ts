/*
 * consoleTagMatrix — PURE, DOM-free model of the МЕТКИ matrix in the console
 * left rail (and the Info Mode tag block): WHICH tags this game can produce,
 * in WHAT fixed order, with the viewer's current counts attached.
 *
 * Availability is SERVER-authoritative: `game.tags` (GameModel.tags) is the
 * set of printed tags found across every deck at game creation — it already
 * encodes the expansions, the game options and the exact card pool, so the
 * client never re-derives "is Venus in this game" from options. The ONE
 * client-side addition is EVENT: event cards don't PRINT the event tag
 * (Tags.countAllTags counts played events separately), so `game.tags` may
 * not contain it even though every configuration has events — it is always
 * available.
 *
 * The order is canonical and value-independent (desktop PlayerTags ORDER:
 * card tags first, the meta counters — wild / clone / events — last), so a
 * tag's cell NEVER moves for the whole game: a count change only mutates the
 * number and the zero-state class, never the grid.
 */

import {Tag} from '@/common/cards/Tag';

export interface ConsoleTagEntry {
  tag: Tag;
  count: number;
}

/** Canonical display order — fixed for the whole game, never resorted. */
export const CONSOLE_TAG_ORDER: ReadonlyArray<Tag> = [
  Tag.BUILDING, Tag.SPACE, Tag.SCIENCE, Tag.POWER, Tag.EARTH, Tag.JOVIAN,
  Tag.VENUS, Tag.PLANT, Tag.MICROBE, Tag.ANIMAL, Tag.CITY, Tag.MOON,
  Tag.MARS, Tag.CRIME, Tag.WILD, Tag.CLONE, Tag.EVENT,
];

/*
 * Degraded fallback for a game model that carries no tag set (a save created
 * before `game.tags` existed): the base-game printed tags + the events
 * counter. Deliberately conservative — better to miss an expansion tag on an
 * ancient save than to show Moon/clone cells in a base-only game.
 */
const FALLBACK_TAGS: ReadonlyArray<Tag> = [
  Tag.BUILDING, Tag.SPACE, Tag.SCIENCE, Tag.POWER, Tag.EARTH, Tag.JOVIAN,
  Tag.PLANT, Tag.MICROBE, Tag.ANIMAL, Tag.CITY, Tag.EVENT,
];

/**
 * The tags available in this game, in canonical order. `gameTags` is
 * `playerView.game.tags` — pass it straight through; membership (not count)
 * decides visibility, so the result is stable for the whole game.
 */
export function consoleAvailableTags(gameTags: ReadonlyArray<Tag> | undefined): ReadonlyArray<Tag> {
  if (gameTags === undefined || gameTags.length === 0) {
    return FALLBACK_TAGS;
  }
  const inGame = new Set<Tag>(gameTags);
  inGame.add(Tag.EVENT); // events never print their tag — see the header note
  return CONSOLE_TAG_ORDER.filter((tag) => inGame.has(tag));
}

/**
 * The full matrix for one player: every available tag with its current
 * count (0 when the map has no entry — the setup-reveal staged override
 * carries a partial map). Zero-count tags are INCLUDED by design.
 */
export function consoleTagEntries(
  gameTags: ReadonlyArray<Tag> | undefined,
  counts: Partial<Record<Tag, number>> | undefined,
): Array<ConsoleTagEntry> {
  return consoleAvailableTags(gameTags).map((tag) => ({tag, count: counts?.[tag] ?? 0}));
}
