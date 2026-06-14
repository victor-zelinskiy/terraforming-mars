import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {Units} from '@/common/Units';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {EventSource} from '@/common/events/EventSource';

/**
 * PURE view-model for the EFFECTS-overlay detail panel — turns a lightweight
 * {@link EffectOverlayStat} (the whole-game per-source aggregate) into "what did
 * this effect actually DO this game". No Vue / DOM / i18n evaluation: labels are
 * English i18n KEYS, icons are keys the component resolves through `iconClassFor`.
 * Deterministic + unit-testable (like victoryPointsModel).
 *
 * Each effect is summarised INDIVIDUALLY, but without 80+ hand-written templates:
 *  1. a per-card HEADLINE override / bespoke PROVIDER for the few that read best
 *     with their own wording (Pharmacy Union, the resource-farming cards);
 *  2. otherwise a CATEGORY (discount / trigger / resource / production / TR / rule
 *     / corporation) — classified from the stat + the card — that gives a headline
 *     + ordering so a discount reads as savings, a resource card as accumulation, …;
 *  3. and when an effect has produced NOTHING measurable (a rule-changer, or it
 *     just hasn't fired yet), a thematic NOTE — never a dead empty state.
 *
 * To add a bespoke summary for a card, add a CARD_HEADLINE / EFFECT_SUMMARY_NOTES
 * entry or register a provider; never special-case in the UI.
 */

export type EffectSummaryLine = {
  /** Icon key for `iconClassFor` (a Resource / CardResource / 'tr' / 'cards' / global param). */
  icon?: string;
  /** English i18n key — the metric label (e.g. 'Saved', 'Added', 'Production'). */
  label: string;
  /** Pre-formatted value (e.g. '+6', '12'). */
  value: string;
};

/**
 * The NATURE of an effect, used to frame the summary (headline + line ordering +
 * fallback note) so each effect reads individually even without a bespoke entry.
 */
export type EffectCategory =
  'corporation' | 'discount' | 'resourceAccumulation' |
  'passiveTr' | 'passiveProduction' | 'trigger' | 'ruleChange';

/**
 * The per-effect IMPACT SIGNATURE (what an effect's result produces) — extracted
 * from the render node by `effectExtraction.effectSignature`. Lets the details
 * panel scope the per-game stats to the SELECTED effect on a multi-effect card.
 * (Defined here, the PURE layer, so `effectExtraction` imports it one-directionally
 * and this module stays Vue/manifest-free for the server test runner.)
 */
export type EffectSignature = {
  icons: ReadonlyArray<string>;
  discount: boolean;
  valueModifier: boolean;
};

export type EffectSummaryViewModel = {
  /** True when the effect has produced nothing measurable — the panel shows `note`. */
  empty: boolean;
  triggerCount: number;
  /** Optional headline i18n key (the category headline, or a per-card override). */
  headline?: string;
  /** The classified category (drives the panel accent + ordering). */
  category?: EffectCategory;
  lines: ReadonlyArray<EffectSummaryLine>;
  /** The live "current value" on the card right now (resource cards) — distinct
   *  from the cumulative "+N added" line. */
  currentValue?: {icon: string; value: string};
  /** A thematic note shown when there is nothing to tally (never a dead state). */
  note?: string;
  /** Optional "last triggered" hint (the generation of the last contribution). */
  lastTrigger?: {generation: number};
  /** True when the source card grants SEVERAL effects — the per-game stats are
   *  aggregated at the CARD level (the event stream attributes to the card, not a
   *  single effect), so the panel captions the summary as card-wide. */
  cardScoped?: boolean;
};

export type EffectSummaryContext = {
  sourceName: CardName;
  sourceKind: EventSource['kind'];
  /** The resource the source card holds, if any (for the current-value line + classify). */
  cardResourceType?: CardResource;
  /** The live count of that resource on the card right now. */
  currentCardResource?: number;
  /** The ordinal of THIS effect within its source card (0-based) — per-effect-ready. */
  effectIndex?: number;
  /** How many effects the source card grants (>1 → scope the stats per effect). */
  effectCount?: number;
  /** THIS effect's impact signature (what its result produces) — drives per-effect
   *  line filtering + headline on a multi-effect card. */
  signature?: EffectSignature;
  /** The union of the OTHER same-card effects' result icons — a metric in here but
   *  NOT in `signature.icons` belongs to a sibling effect and is hidden. */
  siblingIcons?: ReadonlyArray<string>;
};

export interface EffectSummaryProvider {
  appliesTo(ctx: EffectSummaryContext): boolean;
  build(stat: EffectOverlayStat, ctx: EffectSummaryContext): EffectSummaryViewModel;
}

const UNIT_KEYS: ReadonlyArray<keyof Units> = ['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat'];

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/** The generic impact lines every summary can fall back to (fixed order). */
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

// ── Classification ──────────────────────────────────────────────────────────

/** Classify an effect by its nature (the stat's footprint + the card's kind). */
export function classifyEffect(ctx: EffectSummaryContext, stat: EffectOverlayStat): EffectCategory {
  if (ctx.sourceKind === 'corporation') {
    return 'corporation';
  }
  if (stat.megacreditsSaved > 0) {
    return 'discount';
  }
  if (ctx.cardResourceType !== undefined) {
    return 'resourceAccumulation';
  }
  const hasProduction = UNIT_KEYS.some((k) => stat.production[k] !== 0);
  const hasStock = UNIT_KEYS.some((k) => stat.stock[k] !== 0);
  if (stat.tr !== 0 && !hasProduction && !hasStock) {
    return 'passiveTr';
  }
  if (hasProduction || hasStock) {
    return 'passiveProduction';
  }
  if (stat.triggerCount > 0) {
    return 'trigger';
  }
  return 'ruleChange';
}

// Icon keys that are NOT card resources (standard resources / TR / cards / global
// params). Anything else in a signature is a card resource → resourceAccumulation.
const STANDARD_ICON_KEYS: ReadonlySet<string> =
  new Set(['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat', 'tr', 'cards', 'temperature', 'oxygen', 'ocean', 'oceans', 'venus']);

function isCardResourceIcon(icon: string): boolean {
  return !STANDARD_ICON_KEYS.has(icon);
}

/**
 * Per-EFFECT category from its render signature (used on a multi-effect card, where
 * the card-level stat can't say which effect a category belongs to). Mirrors
 * `classifyEffect` but reads what the EFFECT produces, not the card aggregate.
 */
export function classifyEffectSignature(sig: EffectSignature, ctx: EffectSummaryContext): EffectCategory {
  if (ctx.sourceKind === 'corporation') {
    return 'corporation';
  }
  if (sig.valueModifier) {
    return 'ruleChange';
  }
  if (sig.discount) {
    return 'discount';
  }
  if (sig.icons.some(isCardResourceIcon)) {
    return 'resourceAccumulation';
  }
  if (sig.icons.includes('tr')) {
    return 'passiveTr';
  }
  if (sig.icons.length > 0) {
    return 'trigger';
  }
  return 'ruleChange';
}

const CATEGORY_HEADLINE: Record<EffectCategory, string> = {
  corporation: 'Corporation ability',
  discount: 'Cost reductions this game',
  resourceAccumulation: 'Resources collected',
  passiveTr: 'Terraforming contributed',
  passiveProduction: 'Ongoing output',
  trigger: 'Triggered effects',
  ruleChange: 'Ongoing rule',
};

/** A useful per-category note when an effect is empty and has no curated note. */
const CATEGORY_FALLBACK_NOTE: Record<EffectCategory, string> = {
  corporation: 'This corporation ability has not contributed yet this game.',
  discount: 'No discount has applied yet — it applies when you play a matching card.',
  resourceAccumulation: 'No resources collected on this card yet.',
  passiveTr: 'No terraforming from this effect yet.',
  passiveProduction: 'This ongoing effect has not produced yet.',
  trigger: 'This effect has not triggered yet this game.',
  ruleChange: 'A passive rule — it shapes how you play rather than producing a tally.',
};

/**
 * Per-card HEADLINE overrides — make a summary read individually ("Microbes
 * farmed" vs a generic "Resources collected") without a whole provider.
 */
const CARD_HEADLINE: Partial<Record<CardName, string>> = {
  [CardName.PETS]: 'Animals gathered from cities',
  [CardName.DECOMPOSERS]: 'Microbes farmed from played cards',
  [CardName.HERBIVORES]: 'Animals grazing on greenery',
  [CardName.ARKLIGHT]: 'Animals raised',
  [CardName.VENUSIAN_ANIMALS]: 'Animals bred from Venus science',
};

/**
 * Curated thematic notes for the rule-changing / non-numeric effects that have
 * nothing to tally (the dead-state risk). English i18n keys. Everything else
 * falls back to the category note, so a note is ALWAYS available.
 */
const EFFECT_SUMMARY_NOTES: Partial<Record<CardName, string>> = {
  [CardName.PROTECTED_HABITATS]: 'Shields your plants, microbes and animals from opponents — protection, not a tally.',
  [CardName.ADAPTATION_TECHNOLOGY]: 'Eases your global-requirement cards by ±2 — a rule bonus, not a tally.',
  [CardName.STANDARD_TECHNOLOGY]: 'Refunds 3 M€ each time you pay for a standard project.',
  [CardName.MEDIA_GROUP]: 'Earns 3 M€ each time you play an event card.',
  [CardName.OLYMPUS_CONFERENCE]: 'Adds science to itself — or draws a card — whenever you play a science-tag card.',
  [CardName.SUPERCAPACITORS]: 'Lets you convert all your energy into heat — a conversion you choose to use.',
  [CardName.NEPTUNIAN_POWER_CONSULTANTS]: 'Rewards M€ whenever an ocean is placed — its gains are listed above when they fire.',
};

function reorder(lines: Array<EffectSummaryLine>, category: EffectCategory): Array<EffectSummaryLine> {
  const lead = leadPredicate(category);
  if (lead === undefined) {
    return lines;
  }
  return [...lines.filter(lead), ...lines.filter((l) => !lead(l))];
}

/** The line a category should lead with (so the summary reads in its own terms). */
function leadPredicate(category: EffectCategory): ((l: EffectSummaryLine) => boolean) | undefined {
  switch (category) {
  case 'discount': return (l) => l.label === 'Saved';
  case 'resourceAccumulation': return (l) => l.label === 'Added';
  case 'passiveTr': return (l) => l.icon === 'tr';
  case 'passiveProduction': return (l) => l.label === 'Production';
  default: return undefined;
  }
}

function currentValueLine(ctx: EffectSummaryContext): {icon: string; value: string} | undefined {
  if (ctx.cardResourceType !== undefined && ctx.currentCardResource !== undefined) {
    return {icon: ctx.cardResourceType, value: String(ctx.currentCardResource)};
  }
  return undefined;
}

function noteFor(ctx: EffectSummaryContext, category: EffectCategory): string {
  return EFFECT_SUMMARY_NOTES[ctx.sourceName] ?? CATEGORY_FALLBACK_NOTE[category];
}

/** The category-aware generic view-model — the default for every non-bespoke effect. */
function defaultViewModel(stat: EffectOverlayStat, ctx: EffectSummaryContext): EffectSummaryViewModel {
  const multi = (ctx.effectCount ?? 1) > 1;
  // Per-effect category on a multi-effect card (from the effect's render signature);
  // otherwise the data-driven card classification (the card stat IS the effect).
  const category = (multi && ctx.signature !== undefined) ?
    classifyEffectSignature(ctx.signature, ctx) :
    classifyEffect(ctx, stat);
  let lines = reorder(genericLines(stat), category);
  let currentValue = currentValueLine(ctx);
  // PER-EFFECT scoping on a multi-effect card: hide a metric that belongs ONLY to a
  // sibling effect (in siblingIcons but NOT this effect's signature). A metric in
  // BOTH effects (or in neither) is kept — we never wrongly hide this effect's own
  // or an ambiguous line. (PolderTech / Solar Logistics → genuinely per-effect.)
  if (multi) {
    const sibling = ctx.siblingIcons ?? [];
    const mine = ctx.signature?.icons ?? [];
    const siblingOnly = (icon?: string): boolean =>
      icon !== undefined && sibling.includes(icon) && !mine.includes(icon);
    lines = lines.filter((l) => !siblingOnly(l.icon));
    if (currentValue !== undefined && siblingOnly(currentValue.icon)) {
      currentValue = undefined;
    }
  }
  // For a multi-effect card an effect is "empty" when ITS filtered lines are empty
  // (the card-level trigger count can't say which effect fired); for a single-effect
  // card the card stat IS the effect, so the trigger count counts too.
  const empty = multi ? lines.length === 0 : (stat.triggerCount === 0 && lines.length === 0);
  return {
    empty,
    // Trigger count + last-trigger are card-level (the stream attributes to the
    // card) — shown ONLY for a single-effect card, where they're unambiguous.
    triggerCount: multi ? 0 : stat.triggerCount,
    headline: CARD_HEADLINE[ctx.sourceName] ?? CATEGORY_HEADLINE[category],
    category,
    lines,
    currentValue,
    // An empty effect shows its note; a non-empty one with a curated note keeps it
    // as supporting context (e.g. Supercapacitors' "you choose to use" framing).
    note: empty ? noteFor(ctx, category) : EFFECT_SUMMARY_NOTES[ctx.sourceName],
    lastTrigger: !multi && stat.lastTrigger !== undefined ? {generation: stat.lastTrigger.generation} : undefined,
    // A multi-effect card with shown stats captions that some metrics are card-level.
    cardScoped: (multi && !empty) ? true : undefined,
  };
}

const DEFAULT_PROVIDER: EffectSummaryProvider = {
  appliesTo: () => true,
  build: (stat, ctx) => defaultViewModel(stat, ctx),
};

// ── Bespoke providers (only where custom LINE construction is needed) ────────

/** Pharmacy Union — lead the corporation summary with diseases placed + TR earned. */
const PHARMACY_UNION_PROVIDER: EffectSummaryProvider = {
  appliesTo: (ctx) => ctx.sourceName === CardName.PHARMACY_UNION,
  build: (stat, ctx) => {
    const base = defaultViewModel(stat, ctx);
    const lines: Array<EffectSummaryLine> = [];
    const diseases = stat.cardResources[CardResource.DISEASE];
    if (diseases !== undefined && diseases !== 0) {
      lines.push({icon: CardResource.DISEASE, label: 'Diseases', value: signed(diseases)});
    }
    if (stat.tr !== 0) {
      lines.push({icon: 'tr', label: 'TR', value: signed(stat.tr)});
    }
    // Keep any other generic impact below the headline metrics.
    for (const line of base.lines) {
      if (line.icon !== CardResource.DISEASE && line.icon !== 'tr') {
        lines.push(line);
      }
    }
    return {...base, headline: 'Corporation ability', lines};
  },
};

const PROVIDERS: ReadonlyArray<EffectSummaryProvider> = [
  PHARMACY_UNION_PROVIDER,
];

/**
 * Resolve the summary for an effect source: the first bespoke provider that
 * applies, else the category-aware default.
 */
export function getEffectSummary(stat: EffectOverlayStat, ctx: EffectSummaryContext): EffectSummaryViewModel {
  const provider = PROVIDERS.find((p) => p.appliesTo(ctx)) ?? DEFAULT_PROVIDER;
  return provider.build(stat, ctx);
}
