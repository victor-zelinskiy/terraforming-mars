import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {Units} from '@/common/Units';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {EventSource} from '@/common/events/EventSource';

/**
 * PURE view-model for the EFFECTS-overlay summary panel — turns a lightweight
 * {@link EffectOverlayStat} into a list of renderable lines. No Vue / DOM / i18n
 * evaluation: labels are English i18n KEYS, icons are keys the component resolves
 * through `iconClassFor`. Deterministic + unit-testable (like victoryPointsModel).
 *
 * Per the brief, each effect MAY have its own specialised summary — so this is a
 * REGISTRY of providers: the first card/corporation-specific provider that
 * `appliesTo` the source wins, otherwise the generic provider runs. To add a
 * bespoke summary for a card, register a provider; never special-case in the UI.
 */

export type EffectSummaryLine = {
  /** Icon key for `iconClassFor` (a Resource / CardResource / 'tr' / 'cards' / global param). */
  icon?: string;
  /** English i18n key — the metric label (e.g. 'Saved', 'Added', 'Times triggered'). */
  label: string;
  /** Pre-formatted value (e.g. '+6', '12'). */
  value: string;
};

export type EffectSummaryViewModel = {
  /** True when the effect has never fired — the panel shows an empty state. */
  empty: boolean;
  triggerCount: number;
  /** Optional headline i18n key for a bespoke summary (generic summaries omit it). */
  headline?: string;
  lines: ReadonlyArray<EffectSummaryLine>;
  /** Optional "last triggered" hint (generation + the i18n key for the contribution). */
  lastTrigger?: {generation: number};
};

export type EffectSummaryContext = {
  sourceName: CardName;
  sourceKind: EventSource['kind'];
};

export interface EffectSummaryProvider {
  appliesTo(ctx: EffectSummaryContext): boolean;
  build(stat: EffectOverlayStat, ctx: EffectSummaryContext): EffectSummaryViewModel;
}

const UNIT_KEYS: ReadonlyArray<keyof Units> = ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'];

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/** The generic impact lines every summary can fall back to. */
export function genericLines(stat: EffectOverlayStat): Array<EffectSummaryLine> {
  const lines: Array<EffectSummaryLine> = [];
  if (stat.megacreditsSaved > 0) {
    lines.push({icon: 'megacredits', label: 'Saved', value: `${stat.megacreditsSaved}`});
  }
  for (const k of UNIT_KEYS) {
    if (stat.stock[k] !== 0) {
      lines.push({icon: k, label: stat.stock[k] > 0 ? 'Gained' : 'Lost', value: signed(stat.stock[k])});
    }
  }
  for (const k of UNIT_KEYS) {
    if (stat.production[k] !== 0) {
      lines.push({icon: k, label: 'Production', value: signed(stat.production[k])});
    }
  }
  for (const [cardResource, amount] of Object.entries(stat.cardResources)) {
    if (amount !== undefined && amount !== 0) {
      lines.push({icon: cardResource, label: 'Added', value: signed(amount)});
    }
  }
  if (stat.cardsDrawn !== 0) {
    lines.push({icon: 'cards', label: 'Cards drawn', value: signed(stat.cardsDrawn)});
  }
  if (stat.tr !== 0) {
    lines.push({icon: 'tr', label: 'TR', value: signed(stat.tr)});
  }
  for (const [parameter, steps] of Object.entries(stat.globalParameterSteps)) {
    if (steps !== undefined && steps !== 0) {
      lines.push({icon: parameter, label: 'Global parameter', value: signed(steps)});
    }
  }
  return lines;
}

function baseViewModel(stat: EffectOverlayStat): EffectSummaryViewModel {
  return {
    empty: stat.triggerCount === 0,
    triggerCount: stat.triggerCount,
    lines: genericLines(stat),
    lastTrigger: stat.lastTrigger !== undefined ? {generation: stat.lastTrigger.generation} : undefined,
  };
}

const DEFAULT_PROVIDER: EffectSummaryProvider = {
  appliesTo: () => true,
  build: (stat) => baseViewModel(stat),
};

// ── Bespoke providers (examples of the architecture) ────────────────────────

/** Pets — frame the summary around the animals gathered from city placements. */
const PETS_PROVIDER: EffectSummaryProvider = {
  appliesTo: (ctx) => ctx.sourceName === CardName.PETS,
  build: (stat) => ({
    ...baseViewModel(stat),
    headline: 'Animals gathered from cities',
  }),
};

/** Pharmacy Union — a corporation summary led by diseases placed + TR earned. */
const PHARMACY_UNION_PROVIDER: EffectSummaryProvider = {
  appliesTo: (ctx) => ctx.sourceName === CardName.PHARMACY_UNION,
  build: (stat) => {
    const lines: Array<EffectSummaryLine> = [];
    const diseases = stat.cardResources[CardResource.DISEASE];
    if (diseases !== undefined && diseases !== 0) {
      lines.push({icon: CardResource.DISEASE, label: 'Diseases', value: signed(diseases)});
    }
    if (stat.tr !== 0) {
      lines.push({icon: 'tr', label: 'TR', value: signed(stat.tr)});
    }
    // Keep any other generic impact below the headline metrics.
    for (const line of genericLines(stat)) {
      if (line.icon !== CardResource.DISEASE && line.icon !== 'tr') {
        lines.push(line);
      }
    }
    return {
      empty: stat.triggerCount === 0,
      triggerCount: stat.triggerCount,
      headline: 'Corporation ability',
      lines,
      lastTrigger: stat.lastTrigger !== undefined ? {generation: stat.lastTrigger.generation} : undefined,
    };
  },
};

const PROVIDERS: ReadonlyArray<EffectSummaryProvider> = [
  PETS_PROVIDER,
  PHARMACY_UNION_PROVIDER,
];

/**
 * Resolve the summary for an effect source: the first bespoke provider that
 * applies, else the generic default.
 */
export function getEffectSummary(stat: EffectOverlayStat, ctx: EffectSummaryContext): EffectSummaryViewModel {
  const provider = PROVIDERS.find((p) => p.appliesTo(ctx)) ?? DEFAULT_PROVIDER;
  return provider.build(stat, ctx);
}
