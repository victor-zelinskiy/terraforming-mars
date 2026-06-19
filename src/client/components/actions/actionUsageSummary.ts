import {EffectOverlayStat, VictimRecord} from '@/common/events/aggregate';
import {Units} from '@/common/Units';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
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
  /** True when this is ONE branch of a multi-branch action: the impact lines are
   *  filtered to THIS branch, but the activation COUNT / last-used are card-level
   *  (the aggregate doesn't split activations per branch) — drives a caption. */
  cardScoped?: boolean;
};

/**
 * A multi-branch action's per-branch SCOPE — which result metrics belong to the
 * SELECTED branch (`mineTokens`) vs its siblings (`siblingTokens`). A whole-card
 * aggregate folds every branch's outcome into ONE stat (Red Spot Observatory's
 * "add a floater" + "spend a floater to draw" both land on the same card), so the
 * details panel must show only the SELECTED branch's lines — exactly the per-effect
 * filtering the Эффекты overlay does. A line whose metric token is ONLY a sibling's
 * is hidden; one in mine (or in neither — shared/ambiguous) is kept.
 */
export type ActionBranchScope = {
  mineTokens: ReadonlyArray<string>;
  siblingTokens: ReadonlyArray<string>;
};

/**
 * The metric TOKEN a preview-branch EFFECT lays claim to — must line up with
 * {@link lineMetricToken} so a branch's effects map onto the aggregate lines.
 * A card-resource COST (spending the resource) does NOT claim the net "Added"
 * line — that accumulation belongs to the branch that ADDS the resource.
 */
export function branchMetricTokens(effects: ReadonlyArray<ActionEffect>): Array<string> {
  const out: Array<string> = [];
  for (const e of effects) {
    // A card-resource gain — added to THIS card (`on this card`) OR to ANOTHER card
    // (`to a card`, e.g. BioPrinting's "add 1 animal to another card") — claims the
    // aggregate's net "Added" line (token `cardres:<icon>`). A card-resource COST
    // (spending it) does NOT claim that accumulation line.
    if (e.note === 'on this card' || e.note === 'to a card') {
      if (e.direction === 'gain') {
        out.push('cardres:' + e.icon);
      }
    } else if (e.note === 'production') {
      out.push('prod:' + e.icon);
    } else if (e.note === 'draw' || e.icon === 'cards') {
      out.push('cards');
    } else {
      out.push(e.icon);
    }
  }
  return out;
}

/** The metric TOKEN of a generic summary LINE (mirrors `branchMetricTokens`). */
function lineMetricToken(l: EffectSummaryLine): string {
  switch (l.label) {
  case 'Added': return 'cardres:' + (l.icon ?? '');
  case 'Production': return 'prod:' + (l.icon ?? '');
  default: return l.icon ?? '';
  }
}

/** Per-branch value kind, classified from the FILTERED lines (not the whole stat). */
function kindFromLines(lines: ReadonlyArray<EffectSummaryLine>): ActionValueKind {
  if (lines.some((l) => l.label === 'Cards drawn')) {
    return 'draw';
  }
  const hasLoss = lines.some((l) => l.label === 'Lost');
  const hasGain = lines.some((l) => l.label === 'Gained' || l.label === 'Added' || l.label === 'Production' || l.label === 'Saved');
  if (hasLoss && hasGain) {
    return 'conversion';
  }
  if (lines.some((l) => l.label === 'TR' || l.label === 'Global parameter') && !hasGain) {
    return 'terraform';
  }
  return lines.length > 0 ? 'resource' : 'usage';
}

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

export function getActionUsageSummary(stat: EffectOverlayStat | undefined, scope?: ActionBranchScope): ActionUsageViewModel {
  const activations = stat?.triggerCount ?? 0;
  let lines = stat !== undefined ? genericLines(stat) : [];
  // Per-branch filtering: keep a line only when its metric belongs to THIS branch
  // (or is shared/ambiguous — in neither set); drop a sibling-only metric so a
  // card's "add floater" branch never shows the "draw" branch's cards (and vice
  // versa). Only kicks in for a genuine multi-branch action (siblingTokens present).
  const cardScoped = scope !== undefined && scope.siblingTokens.length > 0;
  if (scope !== undefined && cardScoped) {
    const mine = new Set(scope.mineTokens);
    const sib = new Set(scope.siblingTokens);
    lines = lines.filter((l) => {
      const t = lineMetricToken(l);
      return mine.has(t) || !sib.has(t);
    });
  }
  const empty = activations === 0 && lines.length === 0;
  // A multi-branch action classifies per BRANCH (its filtered lines); a single
  // action keeps the whole-stat classification (back-compat with the bare call).
  const kind = empty ? 'usage' : (cardScoped ? kindFromLines(lines) : (stat !== undefined ? classifyAction(stat) : 'usage'));
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
    cardScoped: cardScoped && !empty ? true : undefined,
  };
}
