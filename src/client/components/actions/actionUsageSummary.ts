import {EffectOverlayStat, VictimRecord} from '@/common/events/aggregate';
import {Units} from '@/common/Units';
import {EffectSummaryLine, EffectConfidence, genericLines} from '@/client/components/effects/effectSummary';

/**
 * PURE view-model for the ДЕЙСТВИЯ overlay's "this game" usage summary — turns the
 * whole-game per-card ACTION aggregate ({@link EffectOverlayStat} from
 * `actionOverlayStats`) into "how this blue-card / corp action performed this game".
 * No Vue / DOM / i18n: labels are English i18n KEYS, icons resolve via `iconClassFor`.
 * Deterministic + unit-testable (like `effectSummary` / `victoryPointsModel`).
 *
 * Unlike a passive effect (which may never fire), an action is explicitly activated,
 * so the empty state is "not used yet" — never the "passive rule" framing. The lines
 * reuse the generic impact extraction (resources gained/spent, cards drawn, TR,
 * production, global parameters, card resources); a category drives the headline.
 */

/** The KIND of value an action produces — drives the headline (the brief's A–H). */
export type ActionValueKind =
  'resource' | 'conversion' | 'draw' | 'terraform' | 'usage';

export type ActionUsageViewModel = {
  /** True when the action has never been activated (no recorded stat). */
  empty: boolean;
  /** How many times the action was activated this game. */
  activations: number;
  /** The classified value kind (headline + confidence). */
  kind: ActionValueKind;
  /** Headline i18n key. */
  headline: string;
  /** Impact lines (gained / spent / drawn / TR / production / params). */
  lines: ReadonlyArray<EffectSummaryLine>;
  /** The generation of the last activation, if any. */
  lastGeneration?: number;
  /** How quantifiable the summary is. */
  confidence: EffectConfidence;
  /** Opponents this action made LOSE resources (attacks), strongest-hit first. */
  victims: ReadonlyArray<VictimRecord>;
  /** A note shown when the action hasn't been used (never a dead state). */
  note?: string;
};

const UNIT_KEYS: ReadonlyArray<keyof Units> = ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'];

const HEADLINE: Record<ActionValueKind, string> = {
  resource: 'Resources gained',
  conversion: 'Conversions',
  draw: 'Cards drawn',
  terraform: 'Terraforming',
  usage: 'Activations',
};

/** Classify what an action produced from its aggregate footprint. */
function classifyAction(stat: EffectOverlayStat): ActionValueKind {
  const hasNegativeStock = UNIT_KEYS.some((k) => stat.stock[k] < 0);
  const hasPositiveStock = UNIT_KEYS.some((k) => stat.stock[k] > 0);
  const hasCardResources = Object.values(stat.cardResources).some((v) => (v ?? 0) !== 0);
  const hasGlobalParam = Object.values(stat.globalParameterSteps).some((v) => (v ?? 0) !== 0);
  // A spend + a gain (or a card-resource spent for a gain) reads as a conversion.
  if ((hasNegativeStock && (hasPositiveStock || stat.tr !== 0 || stat.cardsDrawn !== 0)) ||
      (Object.values(stat.cardResources).some((v) => (v ?? 0) < 0) && (hasPositiveStock || stat.tr !== 0))) {
    return 'conversion';
  }
  if (stat.cardsDrawn > 0) {
    return 'draw';
  }
  if (hasGlobalParam || (stat.tr !== 0 && !hasPositiveStock && !hasCardResources)) {
    return 'terraform';
  }
  if (hasPositiveStock || hasCardResources || UNIT_KEYS.some((k) => stat.production[k] !== 0)) {
    return 'resource';
  }
  return 'usage';
}

function confidenceForKind(kind: ActionValueKind): EffectConfidence {
  // Every measurable kind is an exact count/tally; a bare activation is rule-only.
  return kind === 'usage' ? 'ruleOnly' : 'exact';
}

export function getActionUsageSummary(stat: EffectOverlayStat | undefined): ActionUsageViewModel {
  const activations = stat?.triggerCount ?? 0;
  const lines = stat !== undefined ? genericLines(stat) : [];
  const empty = activations === 0 && lines.length === 0;
  const kind = stat !== undefined ? classifyAction(stat) : 'usage';
  return {
    empty,
    activations,
    kind,
    headline: HEADLINE[kind],
    lines,
    lastGeneration: stat?.lastTrigger?.generation,
    confidence: confidenceForKind(kind),
    victims: stat?.victims ?? [],
    note: empty ? 'Action not used yet — its usage stats will appear here.' : undefined,
  };
}
