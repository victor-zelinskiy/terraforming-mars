/*
 * railProtectionModel — the PURE read-model behind the console left rail's
 * PROTECTION MARKS: «этот запас у меня под защитой».
 *
 * Three questions, three server-authoritative answers, no rule restated here:
 *
 *  1. STOCK (the six resource rows) — `PublicPlayerModel.protectedResources`,
 *     built by `ServerModel.getResourceProtections` from the engine's own
 *     `plantsAreProtected()` / `alloysAreProtected()` (Protected Habitats,
 *     Asteroid Deflection System, the Hollandia deflection zone, Lunar
 *     Security Stations) plus Botanical Experience's `half`.
 *  2. PRODUCTION (the row's brown chip) — `protectedProduction`, same builder
 *     family (Lunar Security Stations' alloys, Private Security's blanket).
 *  3. CARD RESOURCES (the ДОП.РЕСУРСЫ chips) — two layers that must NOT be
 *     folded together: the blanket type-wide shield
 *     (`protectedCardResources`, today Protected Habitats over animals and
 *     microbes) and the PRINTED per-card shield (`CardModel.protectedResources`
 *     — Pets, Bioengineering Enclosure), which covers ONE holder's stock. A
 *     chip aggregates every holder, so claiming the whole type is safe when
 *     only one card is would be a lie: that case reports `partial` and the
 *     exact protected/total split.
 *
 * `half` is the RULE Botanical Experience prints, and it is not «half of the
 * stock is safe»: a removal still happens, its amount is halved (rounded up —
 * `Math.ceil(qty / 2)` in every removal path). The copy this model feeds must
 * say that, never «половина защищена».
 *
 * Everything reads off the DISPLAYED player's own model, so an inspected
 * opponent (Y) gets their own marks. No Vue / DOM / i18n; memoized by model
 * identity like its sibling `railValueModel`.
 */

import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {Protection, PublicPlayerModel} from '@/common/models/PlayerModel';
import {ALL_RESOURCES, Resource} from '@/common/Resource';
import {getCard} from '@/client/cards/ClientCardManifest';

/**
 * How a stock reads on the rail:
 *  - `full`    — an opponent cannot take it at all;
 *  - `half`    — they can, but the amount taken is halved, rounded up;
 *  - `partial` — only part of THIS stock is shielded (an aggregated
 *                card-resource chip whose holders differ).
 */
export type RailProtectionKind = 'full' | 'half' | 'partial';

export type RailProtectionMark = {
  kind: RailProtectionKind;
  /** Cards that grant it, for the accessible sentence (may be empty). */
  sources: ReadonlyArray<CardName>;
  /** `partial` only: how much of the chip's total is actually shielded. */
  protectedAmount?: number;
  total?: number;
};

/** The standard rows that can carry a stock / production mark. */
export type RailStockKey = Resource;

export type RailProtections = {
  /** Stock marks by resource key (absent = unprotected). */
  stock: Partial<Record<RailStockKey, RailProtectionMark>>;
  /** Production marks by resource key (absent = unprotected). */
  production: Partial<Record<RailStockKey, RailProtectionMark>>;
  /** Card-resource marks, keyed like the ДОП.РЕСУРСЫ groups. */
  cardResources: ReadonlyMap<CardResource, RailProtectionMark>;
};

/** The six rows, from the enum itself — a new resource joins for free. */
const STOCK_KEYS: ReadonlyArray<Resource> = ALL_RESOURCES;

/**
 * Which played cards explain a protection, so a mark can name its cause.
 * Membership is a TABLEAU LOOKUP, never a re-derivation of the rule: the
 * verdict itself always comes from the server's own map, so a source list
 * that misses a future card costs a name in the aria, never a wrong mark.
 */
const STOCK_PROTECTION_SOURCES: Partial<Record<Resource, ReadonlyArray<CardName>>> = {
  [Resource.PLANTS]: [CardName.PROTECTED_HABITATS, CardName.ASTEROID_DEFLECTION_SYSTEM, CardName.BOTANICAL_EXPERIENCE],
  [Resource.STEEL]: [CardName.LUNAR_SECURITY_STATIONS],
  [Resource.TITANIUM]: [CardName.LUNAR_SECURITY_STATIONS],
};

const PRODUCTION_PROTECTION_SOURCES: ReadonlyArray<CardName> = [
  CardName.LUNAR_SECURITY_STATIONS, CardName.PRIVATE_SECURITY,
];

function playedSources(player: PublicPlayerModel, candidates: ReadonlyArray<CardName>): ReadonlyArray<CardName> {
  return candidates.filter((name) => player.tableau.some((card) => card.name === name));
}

function markFor(protection: Protection | undefined, sources: ReadonlyArray<CardName>): RailProtectionMark | undefined {
  if (protection === 'on') {
    return {kind: 'full', sources};
  }
  if (protection === 'half') {
    return {kind: 'half', sources};
  }
  return undefined;
}

const memo = new WeakMap<PublicPlayerModel, RailProtections>();

/** Every protection mark for the DISPLAYED player (self or inspected seat). */
export function railProtections(player: PublicPlayerModel): RailProtections {
  const memoized = memo.get(player);
  if (memoized !== undefined) {
    return memoized;
  }
  const stock: Partial<Record<RailStockKey, RailProtectionMark>> = {};
  const production: Partial<Record<RailStockKey, RailProtectionMark>> = {};
  for (const key of STOCK_KEYS) {
    const stockMark = markFor(player.protectedResources?.[key],
      playedSources(player, STOCK_PROTECTION_SOURCES[key] ?? []));
    if (stockMark !== undefined) {
      stock[key] = stockMark;
    }
    const productionMark = markFor(player.protectedProduction?.[key],
      playedSources(player, PRODUCTION_PROTECTION_SOURCES));
    if (productionMark !== undefined) {
      production[key] = productionMark;
    }
  }

  const cardResources = new Map<CardResource, RailProtectionMark>();
  // Layer 1 — the blanket type-wide shield (Protected Habitats).
  const blanket = player.protectedCardResources ?? {};
  for (const [resource, protection] of Object.entries(blanket) as Array<[CardResource, Protection]>) {
    const mark = markFor(protection, playedSources(player, [CardName.PROTECTED_HABITATS]));
    if (mark !== undefined) {
      cardResources.set(resource, mark);
    }
  }
  // Layer 2 — the PRINTED per-card shield, aggregated per resource type. A
  // type already covered by the blanket keeps the blanket verdict.
  type TypeTally = {
    protectedAmount: number,
    total: number,
    sources: Array<CardName>,
    holders: number,
    protectedHolders: number,
  };
  const perType = new Map<CardResource, TypeTally>();
  for (const card of player.tableau) {
    const resourceType = getCard(card.name)?.resourceType;
    if (resourceType === undefined) {
      continue;
    }
    const entry: TypeTally = perType.get(resourceType) ??
      {protectedAmount: 0, total: 0, sources: [], holders: 0, protectedHolders: 0};
    const amount = card.resources ?? 0;
    entry.total += amount;
    entry.holders++;
    if (card.protectedResources === true) {
      entry.protectedAmount += amount;
      entry.protectedHolders++;
      entry.sources.push(card.name);
    }
    perType.set(resourceType, entry);
  }
  perType.forEach((entry, resource) => {
    if (cardResources.has(resource) || entry.protectedHolders === 0) {
      return;
    }
    // Every holder printed-protected ⇒ the whole chip is safe; otherwise the
    // chip aggregates both kinds and the mark must say so (with the split, so
    // the reader is never told more than is true).
    if (entry.protectedHolders === entry.holders) {
      cardResources.set(resource, {kind: 'full', sources: entry.sources});
    } else {
      cardResources.set(resource, {
        kind: 'partial',
        sources: entry.sources,
        protectedAmount: entry.protectedAmount,
        total: entry.total,
      });
    }
  });

  const result: RailProtections = {stock, production, cardResources};
  memo.set(player, result);
  return result;
}
