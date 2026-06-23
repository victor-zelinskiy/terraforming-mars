/*
 * Story EVIDENCE model (Iteration 17 §11/§19).
 *
 * The canonical "where did this number come from" descriptor every chip / popover / term
 * can reference, so a displayed value is always backed by a typed SOURCE + CONFIDENCE and
 * a low-confidence fact never becomes a decisive claim. PURE (no Vue / DOM / i18n).
 */
import type {CardVpSource} from '@/client/components/endgame/cardScoreContribution';

export type EvidenceSourceType =
  | 'scoreBreakdown' // the server VictoryPointsBreakdown categories
  | 'cardScore' // a card's printed / countable VP
  | 'cardResource' // VP per resource on a card (animals / microbes / floaters)
  | 'gameEvent' // an event-stream fact (economy / attack / reveal …)
  | 'award' | 'milestone'
  | 'colonyTrade'
  | 'globalParameter'
  | 'tilePlacement'
  | 'playerState' // leftover M€ / production at game end
  | 'derived'; // inferred (e.g. VP-acceleration "engine online")

export type EvidenceConfidence = 'measured' | 'partial' | 'derived' | 'low';

export type StoryEvidence = {
  label: string; // i18n key / card name
  value?: string; // final display text (e.g. "+12")
  sourceType: EvidenceSourceType;
  sourceId?: string;
  confidence: EvidenceConfidence;
  detailId?: string;
};

/** Map a per-card VP source to the evidence source type. */
export function cardVpSourceToEvidence(source: CardVpSource): EvidenceSourceType {
  switch (source) {
  case 'animal':
  case 'microbe':
  case 'floater':
  case 'resource':
    return 'cardResource';
  default:
    return 'cardScore';
  }
}
