/*
 * Best-effort per-card VICTORY-POINT decomposition (rework §6).
 *
 * The server stores each card's VP as a single summed number
 * (`CardVictoryPointsDetail.victoryPoint`) — it never exposes WHERE that number came
 * from (printed VP vs VP-per-animal vs VP-per-jovian-tag vs city VP …). Refactoring the
 * server `Counter` to split it is out of scope. Instead this module attributes the
 * already-final number to a SOURCE client-side, by reading the card's `victoryPoints`
 * DECLARATION (`number | 'special' | CountableVictoryPoints`) + its `resourceType`/tags.
 *
 * A card almost always carries ONE victoryPoints declaration, so the attribution is
 * usually unambiguous (high confidence); the few genuinely composite / 'special' cards
 * are attributed with a lower confidence so the storyteller can hedge. This is exactly
 * the "best-effort, mark confidence lower" the spec sanctions — no fabricated numbers.
 *
 * Design contract (mirrors the other endgame engine modules):
 *   • PURE — no Vue / DOM / i18n / card manifest. The card declaration is INJECTED via a
 *     `CardLookup` (the client wires the real `getCard`), so it stays unit-testable under
 *     the server runner with a mock lookup.
 */
import {Tag} from '@/common/cards/Tag';
import {CardType} from '@/common/cards/CardType';
import {CardResource} from '@/common/CardResource';
import type {CountableVictoryPoints} from '@/common/cards/CountableVictoryPoints';
import type {CardVictoryPointsDetail} from '@/common/game/VictoryPointsBreakdown';

/** Where a card's victory points came from (the §6 source taxonomy). */
export type CardVpSource =
  | 'printed' // a flat printed number
  | 'animal' | 'microbe' | 'floater' // VP per animal / microbe / floater on the card
  | 'jovian' // VP per jovian tag
  | 'tagMultiplier' // VP per (other) tag
  | 'city' // VP per (adjacent / all) city
  | 'resource' // VP per other card-resource
  | 'condition' // 'special' / requirement-gated VP
  | 'event' // VP attached to an event card
  | 'other'; // penalties / unclassifiable

export const CARD_VP_SOURCES: ReadonlyArray<CardVpSource> = [
  'printed', 'animal', 'microbe', 'floater', 'jovian', 'tagMultiplier',
  'city', 'resource', 'condition', 'event', 'other',
];

export type VpConfidence = 'high' | 'medium' | 'low';

/** One card's contribution, attributed to its source. */
export type CardScoreContribution = {
  cardName: string;
  totalVp: number;
  source: CardVpSource;
  /** Resource units currently on the card (for the resource sources). */
  resourcesOnCard: number;
  tags: ReadonlyArray<Tag>;
  confidence: VpConfidence;
};

/** Per-player aggregate of card VP by source. */
export type CardVpBySource = Record<CardVpSource, number> & {
  total: number; // sum of POSITIVE card VP (penalties excluded)
  penalties: number; // sum of negative card VP (<= 0)
  confidence: VpConfidence; // weakest contribution confidence that carried weight
};

/** The minimal card declaration the decomposition needs (injected from the manifest). */
export type CardDecl = {
  victoryPoints?: number | 'special' | CountableVictoryPoints;
  resourceType?: CardResource;
  tags: ReadonlyArray<Tag>;
  type: CardType;
};
export type CardLookup = (name: string) => CardDecl | undefined;

const RESOURCE_SOURCE: Partial<Record<CardResource, CardVpSource>> = {
  [CardResource.ANIMAL]: 'animal',
  [CardResource.MICROBE]: 'microbe',
  [CardResource.FLOATER]: 'floater',
};

function emptyBySource(): CardVpBySource {
  const base = {} as Record<CardVpSource, number>;
  for (const s of CARD_VP_SOURCES) {
    base[s] = 0;
  }
  return {...base, total: 0, penalties: 0, confidence: 'high'};
}

/** Resolve which source the card's printed-resource VP belongs to. */
function resourceSourceOf(decl: CardDecl): CardVpSource {
  const mapped = decl.resourceType !== undefined ? RESOURCE_SOURCE[decl.resourceType] : undefined;
  return mapped ?? 'resource';
}

/**
 * Classify a single card's already-final VP to a source + confidence by reading its
 * `victoryPoints` declaration. Returns `other`/low when nothing matches (unknown card,
 * negative penalty, composite declaration).
 */
export function classifyCardVp(
  detail: CardVictoryPointsDetail,
  decl: CardDecl | undefined,
): {source: CardVpSource; confidence: VpConfidence} {
  const vp = detail.victoryPoint;
  if (vp < 0 || detail.kind === 'penalty') {
    return {source: 'other', confidence: vp < 0 ? 'high' : 'medium'};
  }
  if (decl === undefined) {
    // No manifest data — fall back to the server's coarse kind classification.
    if (detail.kind === 'resource') {
      return {source: 'resource', confidence: 'low'};
    }
    return {source: detail.kind === 'fixed' ? 'printed' : 'condition', confidence: 'low'};
  }
  const d = decl.victoryPoints;
  if (typeof d === 'number') {
    return {source: decl.type === CardType.EVENT ? 'event' : 'printed', confidence: 'high'};
  }
  if (d === 'special') {
    // 'special' is a bespoke getVictoryPoints — attribute by resourceType when it has one
    // (e.g. a resource card), else it's a conditional/threshold score.
    if (decl.resourceType !== undefined) {
      return {source: resourceSourceOf(decl), confidence: 'medium'};
    }
    return {source: 'condition', confidence: 'medium'};
  }
  if (typeof d === 'object' && d !== null) {
    const c = d as CountableVictoryPoints;
    if (c.resourcesHere !== undefined) {
      return {source: resourceSourceOf(decl), confidence: 'high'};
    }
    if (c.tag !== undefined) {
      return {source: c.tag === Tag.JOVIAN ? 'jovian' : 'tagMultiplier', confidence: 'high'};
    }
    if (c.cities !== undefined) {
      return {source: 'city', confidence: 'high'};
    }
    // oceans / moon / colonies / other countables → a board/condition score.
    return {source: 'condition', confidence: 'medium'};
  }
  return {source: 'printed', confidence: 'low'};
}

const CONFIDENCE_RANK: Readonly<Record<VpConfidence, number>> = {high: 0, medium: 1, low: 2};

/**
 * Decompose a player's card VP. Returns the per-card contributions + a by-source
 * aggregate. `cardResources` is the card-name → on-card resource count map (for the
 * `resourcesOnCard` field). Pure — `lookup` injects the manifest.
 */
export function decomposePlayerCardVp(
  details: ReadonlyArray<CardVictoryPointsDetail>,
  cardResources: Partial<Record<string, number>>,
  lookup: CardLookup,
): {contributions: Array<CardScoreContribution>; bySource: CardVpBySource} {
  const bySource = emptyBySource();
  const contributions: Array<CardScoreContribution> = [];
  let weakest: VpConfidence = 'high';
  for (const detail of details) {
    const decl = lookup(detail.cardName);
    const {source, confidence} = classifyCardVp(detail, decl);
    const vp = detail.victoryPoint;
    contributions.push({
      cardName: detail.cardName,
      totalVp: vp,
      source,
      resourcesOnCard: cardResources[detail.cardName] ?? 0,
      tags: decl?.tags ?? [],
      confidence,
    });
    if (vp < 0) {
      bySource.penalties += vp;
      bySource.other += vp;
    } else {
      bySource[source] += vp;
      bySource.total += vp;
      // Only positive, non-trivial contributions degrade the aggregate confidence.
      if (vp >= 2 && CONFIDENCE_RANK[confidence] > CONFIDENCE_RANK[weakest]) {
        weakest = confidence;
      }
    }
  }
  bySource.confidence = weakest;
  contributions.sort((a, b) => b.totalVp - a.totalVp);
  return {contributions, bySource};
}
