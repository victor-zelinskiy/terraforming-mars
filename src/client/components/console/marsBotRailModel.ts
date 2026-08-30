/*
 * marsBotRailModel — PURE, DOM-free model of the LEFT RAIL's MarsBot
 * presentation (the Information Workspace inspects the bot seat) and of the
 * bot's «Доп. ресурсы» adapter.
 *
 * THE PARITY CONTRACT (info-panel rework): the bot reads as ONE MORE
 * PARTICIPANT, not a technical panel. So the rail keeps the HUMAN geometry:
 *
 *  - the resource rows show only what the Automa REALLY accumulates — the
 *    M€ supply always, plus its corporation's own store when that store is
 *    a real resource (Ecoline/Ecotec plants, Philares/Spire science, the
 *    Mining Guild / Factorum M€ till). No fake +0 production chips, no
 *    invented stocks; the unfilled rows stay deliberate empty space so the
 *    МЕТКИ block never changes its vertical anchor between seats.
 *
 *  - the МЕТКИ zone is the SAME tag matrix as a human's — because the bot's
 *    track positions ARE its tag counts by the engine's own rule
 *    (`AutomaTargeting.effectiveTagCount`: per-tag effects, requirements,
 *    awards and milestones all read the track). One track can serve several
 *    tags (POWER+JOVIAN, EARTH+CITY, the bio track) — each mapped tag cell
 *    shows that shared position, which is exactly what the engine answers.
 *    A cell whose tag maps to NO track (wild, clone, no-tag) is «not
 *    tracked» — rendered as a dash, never a lying 0.
 *
 * The old dominant «ТРЕКИ БОТА» progress-bar array moved to the bot's OWN
 * internals screen («Экран бота» → «Планшет бота») — a player who does not
 * care how the algorithm works sees the familiar participant model.
 *
 * Data is public and server-authoritative (MarsBotModel mirrors the table).
 */

import {Tag} from '@/common/cards/Tag';
import {CardResource} from '@/common/CardResource';
import {MarsBotModel} from '@/common/models/MarsBotModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {MarsBotCorpResource} from '@/common/automa/MarsBotCorpData';
import {cardResourceCSS} from '@/client/components/common/cardResources';
import {additionalResourceMetricKey} from '@/client/components/additionalResources/additionalResources';
import {consoleAvailableTags, ConsoleTagCell} from '@/client/components/console/consoleTagMatrix';

export type MarsBotRailEconomyRow = {
  /** Stable row key (also the v-for key). */
  key: string;
  /** Ready-to-render icon classes (resource_icon / card-resource family). */
  iconClass: string;
  value: number;
  /** AnimatedMetricValue key — shares the human families so the delta-chip
   *  language stays identical (scope = the bot seat's color). */
  metricKey: string;
};

/** Which corp stores are REAL resources (a cube marker is a state flag). */
const CORP_STORE_ICON: Partial<Record<MarsBotCorpResource, string>> = {
  'plant': 'resource_icon resource_icon--plants',
  'megacredits': 'resource_icon resource_icon--megacredits',
  'science': `card-resource ${cardResourceCSS[CardResource.SCIENCE]}`,
};

/**
 * The bot's real economy rows: the M€ supply, plus its corporation's own
 * store when that store is a genuine resource with a non-zero balance.
 * (Floaters are NOT an economy row — they are the bot's «Доп. ресурсы»,
 * same as a human's card-held resources; see `marsBotExtraResources`.)
 */
export function marsBotRailEconomy(bot: PublicPlayerModel, automa: MarsBotModel): Array<MarsBotRailEconomyRow> {
  const rows: Array<MarsBotRailEconomyRow> = [
    {
      key: 'megacredits',
      iconClass: 'resource_icon resource_icon--megacredits',
      value: bot.megacredits,
      metricKey: 'megacredits.stock',
    },
  ];
  const corp = automa.corporation;
  if (corp?.resource !== undefined && corp.resources > 0) {
    const icon = CORP_STORE_ICON[corp.resource];
    if (icon !== undefined) {
      rows.push({
        key: `corp-${corp.resource}`,
        iconClass: icon,
        value: corp.resources,
        metricKey: `botcorp.${corp.resource}`,
      });
    }
  }
  return rows;
}

// ── the tag matrix (parity with the human МЕТКИ block) ─────────────────────

export type MarsBotTagEntry = {
  tag: ConsoleTagCell;
  /** The engine's tag count = the mapped track's position. `undefined` =
   *  this tag maps to no track (wild / clone / no-tag) — «not tracked». */
  count: number | undefined;
};

/**
 * The bot's tag matrix over the SAME cell set a human shows (game.tags →
 * `consoleAvailableTags`), with counts read from the printed tracks. One
 * position may serve several cells — that is the rule, not a display bug.
 */
export function marsBotTagEntries(
  gameTags: ReadonlyArray<Tag> | undefined,
  automa: MarsBotModel,
): Array<MarsBotTagEntry> {
  const positionOf = new Map<Tag, number>();
  for (const track of automa.tracks) {
    const position = Math.max(0, track.position);
    for (const tag of track.tags) {
      positionOf.set(tag, position);
    }
  }
  return consoleAvailableTags(gameTags).map((tag) => ({
    tag,
    count: tag === 'none' ? undefined : positionOf.get(tag as Tag),
  }));
}

// ── «Доп. ресурсы» — the bot's extra-resource adapter ──────────────────────

export type MarsBotExtraGroup = {
  key: string;
  /** Ready-to-render icon classes. */
  iconClass: string;
  /** i18n KEY of the resource-type name. */
  label: string;
  total: number;
  /** WHERE it is held — the colony tiles (i18n keys: colony names are keys).
   *  Empty for the one-pool floater stock. */
  holders: Array<{name: string, amount: number}>;
  metricKey: string;
};

/**
 * What each shipping area STORES, by the official board (rulebook A p.2 /
 * `docs/AUTOMA_DATA_AUDIT.md` §4): the type is what human steal/remove
 * effects target there, so this is rules truth, not a display invention.
 * Titan (floaters) and Europa (never stores) are deliberately absent —
 * Titan's pool is `automa.floaters` and must never be double-counted.
 */
const STORAGE_RESOURCE: Readonly<Record<string, {key: string, iconClass: string, label: string}>> = {
  'Ceres': {key: 'steel', iconClass: 'resource_icon resource_icon--steel', label: 'Steel'},
  'Luna': {key: 'megacredits', iconClass: 'resource_icon resource_icon--megacredits', label: 'Megacredits'},
  'Io': {key: 'heat', iconClass: 'resource_icon resource_icon--heat', label: 'Heat'},
  'Enceladus': {key: 'microbes', iconClass: `card-resource ${cardResourceCSS[CardResource.MICROBE]}`, label: 'Microbes'},
  'Ganymede': {key: 'plants', iconClass: 'resource_icon resource_icon--plants', label: 'Plants'},
  'Callisto': {key: 'energy', iconClass: 'resource_icon resource_icon--energy', label: 'Energy'},
  'Miranda': {key: 'animals', iconClass: `card-resource ${cardResourceCSS[CardResource.ANIMAL]}`, label: 'Animals'},
  'Triton': {key: 'titanium', iconClass: 'resource_icon resource_icon--titanium', label: 'Titanium'},
  'Pluto': {key: 'cards', iconClass: 'resource_icon resource_icon--cards', label: 'Cards'},
};

/**
 * The bot's REAL extra accumulations, adapted to the shared «Доп. ресурсы»
 * area — the same semantic shape as a human's card-held resources: groups
 * BY RESOURCE TYPE, each naming its holders (colony tiles instead of
 * cards). Disjoint pools by construction (no double count — Titan's
 * floaters live ONLY in `automa.floaters`, never in `shippingStorage`; the
 * corporation's own store is an ECONOMY row and is deliberately absent).
 */
export function marsBotExtraGroups(automa: MarsBotModel): Array<MarsBotExtraGroup> {
  const out: Array<MarsBotExtraGroup> = [];
  if (automa.floaters > 0) {
    out.push({
      key: 'floaters',
      iconClass: `card-resource ${cardResourceCSS[CardResource.FLOATER]}`,
      label: 'Floaters',
      total: automa.floaters,
      holders: [],
      metricKey: additionalResourceMetricKey(CardResource.FLOATER),
    });
  }
  const byType = new Map<string, MarsBotExtraGroup>();
  for (const {colony, count} of shippingStorageEntries(automa)) {
    const meta = STORAGE_RESOURCE[colony];
    if (meta === undefined) {
      continue; // Titan/Europa never appear; an unknown area stays silent
    }
    const group = byType.get(meta.key) ?? {
      key: meta.key,
      iconClass: meta.iconClass,
      label: meta.label,
      total: 0,
      holders: [],
      metricKey: `botstorage.${meta.key}`,
    };
    group.total += count;
    group.holders.push({name: colony, amount: count});
    byType.set(meta.key, group);
  }
  out.push(...[...byType.values()].sort((a, b) => b.total - a.total));
  return out;
}

/** The per-colony storage split (the extras detail + the bot screen). */
export function shippingStorageEntries(automa: MarsBotModel): Array<{colony: string, count: number}> {
  const storage = automa.shippingStorage;
  if (storage === undefined) {
    return [];
  }
  return Object.entries(storage)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0)
    .map(([colony, count]) => ({colony, count}));
}
