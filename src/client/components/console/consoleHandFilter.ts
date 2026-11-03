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

// ── THE PICKER'S FILTER (P50's polish companion · ledger FD — the owner, 2026-11-03: «экран выбора карт на сброс
// получает ФИЛЬТРЫ как в „Картах в руке“ … особенно полезно для сброса на действия Красных») ───────────────────────
//
// Every album mode wears the SAME row of chips (select / sale / a composer's pick), but a PICKER keeps its OWN state
// (`consoleState.selectTagFilter`, reset on entry and on the answer): the browse tag (`handTagFilter`, a session-long
// state) is never read in a pick, so a tag left on in the hand can never hide a candidate of a mandatory discard. A
// discard whose exchange pays PER TAG (the Reds: 2 M€ per plant / microbe / animal tag) adds the preset «ПЛАТЯТ» — the
// cards whose own payout is above zero — read off the server's `exchange` marker, never a title or a client constant.

/** The picker's active filter — a tag, «all», or the «pays» preset of a per-tag exchange. */
export type AlbumFilter = HandTagFilter | 'pays';

export interface AlbumFilterOption {
  value: AlbumFilter;
  count: number;
}

/** The exchange a discard marker carries (the shape the picker reads — `DiscardPromptMeta.exchange`). */
export type FilterExchange = {icon: string, amount: number, perCard?: boolean, perTag?: ReadonlyArray<Tag>};

/**
 * What ONE card thrown pays under `exchange` — `perTag`: the amount for EVERY printed matching tag (a card may pay
 * twice); `perCard`: the amount; otherwise 0 (a flat exchange is the pick's, not the card's). The header's own rule
 * (`cardDiscard/discardIntent.ts`), card by card.
 */
export function cardPayout(card: CardModel, exchange: FilterExchange | undefined, tagsOf: TagsOf = cardTags): number {
  if (exchange === undefined) {
    return 0;
  }
  if (exchange.perTag !== undefined) {
    const paying = new Set(exchange.perTag);
    return tagsOf(card).filter((tag) => paying.has(tag)).length * exchange.amount;
  }
  return exchange.perCard === true ? exchange.amount : 0;
}

/** Does the picker offer the «ПЛАТЯТ» preset? Only a PER-TAG exchange — a per-card one pays for every card alike. */
export function paysPresetOffered(exchange: FilterExchange | undefined): boolean {
  return exchange?.perTag !== undefined && exchange.perTag.length > 0;
}

/**
 * The picker's chips: «ВСЕ», then «ПЛАТЯТ» (a per-tag exchange only), then every tag present — the browse row's own
 * order and counts. The active value always stays (a chip whose last card left the hand stays cyclable).
 */
export function buildAlbumFilters(
  cards: ReadonlyArray<CardModel>,
  active: AlbumFilter,
  exchange?: FilterExchange,
  tagsOf: TagsOf = cardTags,
): Array<AlbumFilterOption> {
  const tags = buildConsoleTagFilters(cards, active === 'pays' ? 'all' : active, tagsOf);
  if (!paysPresetOffered(exchange)) {
    return tags;
  }
  const pays = cards.filter((card) => cardPayout(card, exchange, tagsOf) > 0).length;
  return [tags[0], {value: 'pays', count: pays}, ...tags.slice(1)];
}

/** Narrow the picker's entries to its active filter. */
export function filterAlbumEntries<T extends {card: CardModel}>(
  entries: ReadonlyArray<T>,
  active: AlbumFilter,
  exchange?: FilterExchange,
  tagsOf: TagsOf = cardTags,
): ReadonlyArray<T> {
  if (active === 'pays') {
    return entries.filter((e) => cardPayout(e.card, exchange, tagsOf) > 0);
  }
  return filterHandByTag(entries, active, tagsOf);
}

/** How many CANDIDATES the filter hides — the honesty count beside the discard's exchange («скрыто фильтром: N»). */
export function hiddenByFilter(candidates: ReadonlyArray<string>, visible: ReadonlyArray<string>): number {
  const shown = new Set(visible);
  return candidates.filter((name) => !shown.has(name)).length;
}
