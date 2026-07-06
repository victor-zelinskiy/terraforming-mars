/*
 * consoleHandFilter — PURE, DOM-free tag-filter model for the console hand
 * grid. The desktop overlay has a rich MULTI-select faceted filter; the
 * console needs a lean, gamepad-cycled SINGLE-select filter: "Все" or exactly
 * one tag, changed with LT/RT and reset with R3.
 *
 * Reuses the desktop `FILTERABLE_TAGS` canonical order and the same printed
 * tags (`getCard(name).tags`), so the two surfaces never disagree on which
 * tags exist or how they're ordered. The manifest lookup is isolated in
 * `cardTags` (injectable) so the option/cycle/filter logic is unit-testable
 * without the client card manifest.
 */

import {Tag} from '@/common/cards/Tag';
import {CardModel} from '@/common/models/CardModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import {FILTERABLE_TAGS} from '@/client/components/handCards/handCardModel';

/** The active filter — `'all'` (no narrowing) or exactly one printed tag. */
export type HandTagFilter = Tag | 'all';

export interface ConsoleTagFilterOption {
  value: HandTagFilter;
  /** Cards in the hand carrying this tag (or the total, for `'all'`). */
  count: number;
}

export type TagsOf = (card: CardModel) => ReadonlyArray<Tag>;

/** Printed tags of a hand card (client manifest — no auto-added EVENT tag). */
export const cardTags: TagsOf = (card) => getCard(card.name)?.tags ?? [];

/**
 * The filter options for the current hand: `'all'` first (count = total), then
 * every FILTERABLE tag PRESENT in the hand (count ≥ 1) in the canonical order.
 * The `active` tag is always kept even at count 0 — so a filter whose last
 * matching card just left the hand stays visible + cyclable + resettable
 * (mirrors the desktop `activeEmpty` rule) instead of vanishing under the pad.
 */
export function buildConsoleTagFilters(
  cards: ReadonlyArray<CardModel>,
  active: HandTagFilter = 'all',
  tagsOf: TagsOf = cardTags,
): Array<ConsoleTagFilterOption> {
  const counts = new Map<Tag, number>();
  for (const card of cards) {
    for (const tag of tagsOf(card)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  const options: Array<ConsoleTagFilterOption> = [{value: 'all', count: cards.length}];
  for (const tag of FILTERABLE_TAGS) {
    const count = counts.get(tag) ?? 0;
    if (count > 0 || tag === active) {
      options.push({value: tag, count});
    }
  }
  return options;
}

/** Narrow hand entries to the active tag (`'all'` returns them unchanged). */
export function filterHandByTag<T extends {card: CardModel}>(
  entries: ReadonlyArray<T>,
  active: HandTagFilter,
  tagsOf: TagsOf = cardTags,
): ReadonlyArray<T> {
  if (active === 'all') {
    return entries;
  }
  return entries.filter((e) => tagsOf(e.card).includes(active));
}

/**
 * Cycle the active filter through `options` by `dir` (+1 = next, -1 = prev),
 * wrapping around (LT/RT is a ring). An `active` value not present in the
 * options starts the cycle from `'all'` (index 0).
 */
export function cycleTagFilter(
  options: ReadonlyArray<ConsoleTagFilterOption>,
  active: HandTagFilter,
  dir: 1 | -1,
): HandTagFilter {
  if (options.length === 0) {
    return 'all';
  }
  const at = options.findIndex((o) => o.value === active);
  const from = at === -1 ? 0 : at;
  const next = (from + dir + options.length) % options.length;
  return options[next].value;
}
