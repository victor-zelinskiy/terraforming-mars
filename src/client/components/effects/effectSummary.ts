/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 * Before changing it, check the console consumers in DESKTOP_DEPRECATION_AUDIT.md.
 */
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
  'corporation' | 'discount' | 'resourceAccumulation' | 'payment' |
  'paymentValueBonus' | 'colonyTrade' | 'tradeDiscount' | 'greeneryDiscount' |
  'passiveTr' | 'passiveProduction' | 'trigger' | 'ruleChange';

/**
 * How well we can quantify an effect's contribution — surfaced so the player knows
 * whether a number is an EXACT tally, a PARTIAL measurable slice (exact facts, no
 * M€ valuation), or a genuine RULE-ONLY effect with no numeric delta. Never
 * over-claims a value we can't honestly compute (see the Trading Colony note).
 */
export type EffectConfidence = 'exact' | 'partial' | 'ruleOnly';

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
  /** The card resource is spendable as M€ payment ("X = N M€" — Psychrophiles
   *  microbes, Carbon Nanosystems graphene, Kuiper asteroids). */
  valueAsPayment: boolean;
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
  /** Optional secondary rows beneath the impact lines — a per-target breakdown
   *  (e.g. Trading Colony's "which colonies, how many steps"). Labels are i18n keys
   *  OR already-translatable names (colony names). */
  breakdown?: ReadonlyArray<{label: string; value: string}>;
  /** How quantifiable this effect's contribution is (exact / partial / rule-only). */
  confidence?: EffectConfidence;
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
  // A "spend this card resource as M€" effect (Psychrophiles / Carbon Nanosystems /
  // Kuiper) is about USAGE, not accumulation — even on a corporation.
  if (ctx.signature?.valueAsPayment === true) {
    return 'payment';
  }
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
  if (sig.valueAsPayment) {
    return 'payment';
  }
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

/**
 * The CLIENT can't read a card's server `behavior`, so the few cards whose passive
 * rule is a steel/titanium VALUE modifier are listed here (the same pattern as
 * CARD_HEADLINE / EFFECT_SUMMARY_NOTES). This drives only the EMPTY-state framing
 * (headline + honest note + category) — once a payment is made the dedicated
 * `paymentValueBonusViewModel` takes over from the RECORDED stat. The server records
 * EVERY such card generically (via `behavior.steelValue/titanumValue`), so a new
 * expansion modifier still tallies correctly; add it here only for the pre-payment
 * note. Guarded by `effectSummaryCoverage`.
 */
const PAYMENT_VALUE_MODIFIER_CARDS: ReadonlySet<CardName> = new Set([
  CardName.ADVANCED_ALLOYS, CardName.REGO_PLASTICS, CardName.MERCURIAN_ALLOYS, CardName.PHOBOLOG,
]);

/** Cards whose passive rule advances a colony track before trading (`tradeOffset`).
 *  The server records EVERY such card generically; this drives only the pre-trade note. */
const COLONY_TRADE_OFFSET_CARDS: ReadonlySet<CardName> = new Set([
  CardName.TRADING_COLONY, CardName.TRADE_ENVOYS,
]);

/** Cards whose passive rule makes a trade cost fewer resources (`tradeDiscount`). */
const TRADE_DISCOUNT_CARDS: ReadonlySet<CardName> = new Set([
  CardName.CRYO_SLEEP, CardName.RIM_FREIGHTERS,
]);

/** Cards whose passive rule makes greenery cost fewer plants (`greeneryDiscount`).
 *  The server records EVERY such card generically; this drives only the pre-conversion note. */
const GREENERY_DISCOUNT_CARDS: ReadonlySet<CardName> = new Set([
  CardName.ECOLINE,
]);

/**
 * The category to FRAME an empty effect's note by — what the effect CAN do (its
 * render signature), NOT the (empty) data. The ROOT-CAUSE fix: without this, an
 * unfired trigger / unused discount classified data-driven to `ruleChange` and
 * showed the bare "passive rule" note. Unlike `classifyEffectSignature` this does
 * NOT treat `valueModifier` as rule-only (that heuristic mislabels threshold
 * conditions like "play a 20 M€ card" — Advertising / CrediCor — as value modifiers);
 * the genuine value modifiers are the explicit set above.
 */
function emptyNoteCategory(sig: EffectSignature, ctx: EffectSummaryContext): EffectCategory {
  if (ctx.sourceKind === 'corporation') {
    return 'corporation';
  }
  if (sig.valueAsPayment) {
    return 'payment';
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

/** The category an EMPTY effect should frame itself as (special cards → their special
 *  category; else by render signature). */
function emptyCategory(ctx: EffectSummaryContext): EffectCategory {
  if (PAYMENT_VALUE_MODIFIER_CARDS.has(ctx.sourceName)) {
    return 'paymentValueBonus';
  }
  if (COLONY_TRADE_OFFSET_CARDS.has(ctx.sourceName)) {
    return 'colonyTrade';
  }
  if (TRADE_DISCOUNT_CARDS.has(ctx.sourceName)) {
    return 'tradeDiscount';
  }
  if (GREENERY_DISCOUNT_CARDS.has(ctx.sourceName)) {
    return 'greeneryDiscount';
  }
  if (ctx.signature !== undefined) {
    return emptyNoteCategory(ctx.signature, ctx);
  }
  return ctx.sourceKind === 'corporation' ? 'corporation' : 'ruleChange';
}

/** Confidence to surface for a category (only where it adds signal). */
function confidenceFor(category: EffectCategory): EffectConfidence | undefined {
  switch (category) {
  case 'ruleChange': return 'ruleOnly';
  case 'colonyTrade': return 'partial';
  case 'tradeDiscount': return 'partial';
  case 'greeneryDiscount': return 'exact';
  case 'paymentValueBonus': return 'exact';
  default: return undefined;
  }
}

const CATEGORY_HEADLINE: Record<EffectCategory, string> = {
  corporation: 'Corporation ability',
  discount: 'Cost reductions this game',
  resourceAccumulation: 'Resources collected',
  payment: 'Used as payment',
  paymentValueBonus: 'Payment value bonus',
  colonyTrade: 'Colony track advanced',
  tradeDiscount: 'Trade discount',
  greeneryDiscount: 'Greenery discount',
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
  payment: 'Spend this card resource as M€ when paying — none spent yet this game.',
  paymentValueBonus: 'Makes your steel or titanium worth more — the extra value is tallied once you spend them.',
  colonyTrade: 'Advances a colony track before you trade there — its steps and extra reward are tallied once you trade.',
  tradeDiscount: 'Makes trading cost fewer resources — the resources saved are tallied once you trade.',
  greeneryDiscount: 'Lets you place greenery for fewer plants — the plants saved are tallied once you convert.',
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
  [CardName.INVENTRIX]: 'Eases your temperature, oxygen, ocean and Venus requirements by ±2 — a rule bonus, not a tally.',
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

/**
 * A "spend this card resource as M€" effect (Psychrophiles / Carbon Nanosystems /
 * Kuiper) — show what it actually did: the M€ value realized + the resource USED +
 * the live count still available. NEVER the accumulation "Added" (that belongs to
 * the accumulator effect / the card's action).
 */
function paymentViewModel(stat: EffectOverlayStat, ctx: EffectSummaryContext): EffectSummaryViewModel {
  const resourceType = ctx.cardResourceType;
  const used = resourceType !== undefined ? ((stat.paymentResources ?? {})[resourceType] ?? 0) : 0;
  const value = stat.megacreditsSaved;
  const lines: Array<EffectSummaryLine> = [];
  if (value > 0) {
    lines.push({icon: 'megacredits', label: 'Payment value', value: `${value}`});
  }
  if (used > 0 && resourceType !== undefined) {
    lines.push({icon: resourceType, label: 'Spent as payment', value: `${used}`});
  }
  const empty = lines.length === 0;
  return {
    empty,
    triggerCount: 0,
    headline: CATEGORY_HEADLINE['payment'],
    category: 'payment',
    lines,
    currentValue: currentValueLine(ctx),
    note: empty ? (EFFECT_SUMMARY_NOTES[ctx.sourceName] ?? CATEGORY_FALLBACK_NOTE['payment']) : EFFECT_SUMMARY_NOTES[ctx.sourceName],
  };
}

/**
 * A steel/titanium VALUE-modifier effect (Advanced Alloys / Rego Plastics / PhoboLog
 * …) — show what it actually did: how much steel/titanium was spent UNDER the effect
 * and the EXACT extra M€ value it added. A genuine economic stat, not a rule note.
 */
function paymentValueBonusViewModel(stat: EffectOverlayStat, ctx: EffectSummaryContext): EffectSummaryViewModel {
  const pvb = stat.paymentValueBonus;
  const lines: Array<EffectSummaryLine> = [];
  if (pvb.bonusValue > 0) {
    lines.push({icon: 'megacredits', label: 'Extra value', value: `+${pvb.bonusValue}`});
  }
  if (pvb.steel > 0) {
    lines.push({icon: 'steel', label: 'Spent under effect', value: `${pvb.steel}`});
  }
  if (pvb.titanium > 0) {
    lines.push({icon: 'titanium', label: 'Spent under effect', value: `${pvb.titanium}`});
  }
  const empty = pvb.bonusValue === 0 && pvb.count === 0;
  return {
    empty,
    triggerCount: pvb.count,
    headline: CATEGORY_HEADLINE['paymentValueBonus'],
    category: 'paymentValueBonus',
    lines,
    confidence: 'exact',
    note: empty ? noteFor(ctx, 'paymentValueBonus') : EFFECT_SUMMARY_NOTES[ctx.sourceName],
  };
}

/**
 * A trade-offset effect (Trading Colony) — show the EXACT colony-track steps it
 * advanced, the extra trade reward (in resource units), and a per-colony breakdown.
 * Confidence is `partial`: the track + reward facts are exact, but their M€ value is
 * deliberately NOT estimated (it depends on each colony's reward mapping).
 */
function colonyTradeViewModel(stat: EffectOverlayStat, ctx: EffectSummaryContext): EffectSummaryViewModel {
  const ct = stat.colonyTrack;
  const lines: Array<EffectSummaryLine> = [];
  if (ct.steps > 0) {
    lines.push({label: 'Track advanced', value: `+${ct.steps}`});
  }
  if (ct.extraReward > 0) {
    lines.push({label: 'Extra trade reward', value: `+${ct.extraReward}`});
  }
  const breakdown = Object.entries(ct.colonies)
    .filter((e): e is [string, number] => e[1] !== undefined && e[1] > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([colony, steps]) => ({label: colony, value: `+${steps}`}));
  const empty = ct.steps === 0 && ct.count === 0;
  return {
    empty,
    triggerCount: ct.count,
    headline: CATEGORY_HEADLINE['colonyTrade'],
    category: 'colonyTrade',
    lines,
    breakdown: breakdown.length > 0 ? breakdown : undefined,
    confidence: 'partial',
    note: empty ?
      noteFor(ctx, 'colonyTrade') :
      'Extra reward is shown in resource units; its M€ value is not estimated.',
  };
}

/**
 * A trade-discount effect (Cryo-Sleep / Rim Freighters) — show the EXACT trade
 * resources saved (per resource type) + a per-colony breakdown. Confidence partial:
 * the saved counts are exact, but only titanium/M€ have a clean M€ valuation.
 */
function tradeDiscountViewModel(stat: EffectOverlayStat, ctx: EffectSummaryContext): EffectSummaryViewModel {
  const td = stat.tradeDiscount;
  const lines: Array<EffectSummaryLine> = [];
  if (td.energy > 0) {
    lines.push({icon: 'energy', label: 'Saved on trades', value: `${td.energy}`});
  }
  if (td.titanium > 0) {
    lines.push({icon: 'titanium', label: 'Saved on trades', value: `${td.titanium}`});
  }
  if (td.megacredits > 0) {
    lines.push({icon: 'megacredits', label: 'Saved on trades', value: `${td.megacredits}`});
  }
  const breakdown = Object.entries(td.colonies)
    .filter((e): e is [string, number] => e[1] !== undefined && e[1] > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([colony, amount]) => ({label: colony, value: `${amount}`}));
  const empty = td.count === 0;
  return {
    empty,
    triggerCount: td.count,
    headline: CATEGORY_HEADLINE['tradeDiscount'],
    category: 'tradeDiscount',
    lines,
    breakdown: breakdown.length > 0 ? breakdown : undefined,
    confidence: 'partial',
    note: empty ? noteFor(ctx, 'tradeDiscount') : EFFECT_SUMMARY_NOTES[ctx.sourceName],
  };
}

/**
 * A greenery-discount effect (EcoLine) — show the EXACT plants saved across all
 * plants→greenery conversions made under the effect + how many conversions. An exact
 * tally in plant units (its M€ value is not estimated — plants aren't M€).
 */
function greeneryDiscountViewModel(stat: EffectOverlayStat, ctx: EffectSummaryContext): EffectSummaryViewModel {
  const gd = stat.greeneryDiscount;
  const lines: Array<EffectSummaryLine> = [];
  if (gd.plants > 0) {
    lines.push({icon: 'plants', label: 'Plants saved', value: `${gd.plants}`});
  }
  const empty = gd.count === 0;
  return {
    empty,
    triggerCount: gd.count,
    headline: CATEGORY_HEADLINE['greeneryDiscount'],
    category: 'greeneryDiscount',
    lines,
    confidence: 'exact',
    note: empty ? noteFor(ctx, 'greeneryDiscount') : EFFECT_SUMMARY_NOTES[ctx.sourceName],
  };
}

/** The category-aware generic view-model — the default for every non-bespoke effect. */
function defaultViewModel(stat: EffectOverlayStat, ctx: EffectSummaryContext): EffectSummaryViewModel {
  // Dedicated economic-modifier summaries, resolved from the RECORDED stat — these
  // are the special handlers that turn a former "passive rule" into real numbers.
  // Defensive access: an older serialized stat (or a partial test fixture) may omit
  // these fields, so a missing dimension is treated as "no contribution".
  const pvb = stat.paymentValueBonus;
  if (pvb !== undefined && (pvb.count > 0 || pvb.bonusValue > 0)) {
    return paymentValueBonusViewModel(stat, ctx);
  }
  const ct = stat.colonyTrack;
  if (ct !== undefined && (ct.count > 0 || ct.steps > 0)) {
    return colonyTradeViewModel(stat, ctx);
  }
  const td = stat.tradeDiscount;
  if (td !== undefined && td.count > 0) {
    return tradeDiscountViewModel(stat, ctx);
  }
  const gd = stat.greeneryDiscount;
  if (gd !== undefined && gd.count > 0) {
    return greeneryDiscountViewModel(stat, ctx);
  }

  const multi = (ctx.effectCount ?? 1) > 1;
  // Per-effect category on a multi-effect card (from the effect's render signature);
  // otherwise the data-driven card classification (the card stat IS the effect).
  const dataCategory = (multi && ctx.signature !== undefined) ?
    classifyEffectSignature(ctx.signature, ctx) :
    classifyEffect(ctx, stat);
  // A resource-as-payment effect has its own model (used / value / available), not
  // the accumulation lines — applies to single AND multi effect cards.
  if (dataCategory === 'payment') {
    return paymentViewModel(stat, ctx);
  }
  let lines = reorder(genericLines(stat), dataCategory);
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
  // ROOT-CAUSE FIX: when there's nothing recorded yet, frame the NOTE by what the
  // effect CAN do (its render signature / special kind), NOT by the (empty) data —
  // else every unfired trigger / unused discount collapsed to the bare "passive rule"
  // note. With data present, use the data-driven category (so the headline + lead
  // line match what actually happened).
  const category = empty ? emptyCategory(ctx) : dataCategory;
  return {
    empty,
    // Trigger count + last-trigger are card-level (the stream attributes to the
    // card) — shown ONLY for a single-effect card, where they're unambiguous.
    triggerCount: multi ? 0 : stat.triggerCount,
    headline: CARD_HEADLINE[ctx.sourceName] ?? CATEGORY_HEADLINE[category],
    category,
    lines,
    currentValue,
    confidence: confidenceFor(category),
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
