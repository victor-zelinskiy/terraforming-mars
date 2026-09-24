/**
 * PURE view-model of the EFFECT FORECAST — the compact «Сработает» row, the
 * per-variant reaction chips, the payment head's discount tail and the eight
 * groups of the R3 «Эффекты» layer, all derived from the SERVER's
 * `EffectForecast` (`common/models/EffectForecastModel.ts`). The client adds
 * no rule of its own: every fact already answers WHAT / WHY / UNDER WHAT
 * CONDITION / TO WHOM / WHEN, and this module only arranges them.
 *
 * No Vue / DOM / i18n / manifest (labels are English i18n KEYS; card names ARE
 * keys) — runs under the server test runner
 * (`tests/console/effectForecastModel.spec.ts`).
 */
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {
  EffectForecast,
  EffectForecastCertainty,
  EffectForecastFact,
  EffectForecastPaymentValue,
  EffectForecastRecipient,
  EffectForecastTiming,
  allForecastFacts,
  forecastSourceIsCardless,
} from '@/common/models/EffectForecastModel';
import {EventSource} from '@/common/events/EventSource';
import {EventTrigger} from '@/common/events/GameEvent';
import {EffectSignature} from '@/client/components/effects/effectSummary';
import {expectedChannelsFor} from '@/client/components/effects/effectChannels';

// ── The compact «Сработает» row ─────────────────────────────────────────────

/** How many chips the row shows before folding the rest into «+N». */
export const FORECAST_CHIP_CAP = 4;

/**
 * The four chip forms of the row (§5.2): a guaranteed own gain, a gain the
 * player will be ASKED about («?» badge), another seat's gain / loss (the
 * colour bar), and ONE «⚡ ?» for every uncomputed reaction — plus the «+N»
 * fold past the cap. `facts` is the number of DISTINCT facts the chip stands
 * for (the parity guard's unit). `production` names the pool the bare chip
 * moves (a production step wears the production plate on its icon — the
 * one distinction a note-less chip must keep).
 */
export type ForecastChip =
  | {kind: 'own', key: string, effect: ActionEffect, production: boolean, facts: number}
  | {kind: 'asks', key: string, effect: ActionEffect, production: boolean, facts: number}
  | {kind: 'other', key: string, effect: ActionEffect, production: boolean, color: Color, bot: boolean, facts: number}
  /**
   * YOUR OWN reaction that fires but has nowhere to apply (Mars University
   * with no other card in hand, Pharmacy Union's TR under an unaffordable Reds
   * tax): the lost magnitude as a STRUCK, muted chip with a «⚠» badge — the
   * row's own language, never the amber warning strip (that strip is for the
   * CARD's own skipped effects). A foreign seat's skipped reaction is not the
   * viewer's loss and never reaches the row — the layer's «Пропустится» names
   * it under its owner.
   */
  | {kind: 'skipped', key: string, effect: ActionEffect, production: boolean, facts: number}
  | {kind: 'unknown', key: string, facts: number}
  | {kind: 'more', key: string, count: number, facts: number};

/** Which operation the forecast describes — the WHEN vocabulary differs. */
export type ForecastOperation = 'play' | 'action';

/** A production-step chip (the builders' `note: 'production'`). */
export function isProductionChip(effect: ActionEffect): boolean {
  return effect.note === 'production';
}

export type ForecastRow = {
  chips: ReadonlyArray<ForecastChip>;
  /** The DISTINCT facts the row REPRESENTS (shown chips + the fold) — the
   *  parity guard: no fact of the row's membership goes unaccounted for. */
  represented: number;
  /** The facts that BELONG in the row (exact own gains, asks, other seats'
   *  exact / asks, unknowns) — must equal `represented`. */
  total: number;
};

/**
 * THE MERGE KEY of the row — `direction | icon | stock/production`. Two
 * sources of «+2 M€» become «+4 M€»; a production step never merges with a
 * stock gain of the same resource. The ASSIGNMENT of a card resource («on
 * this card» / «on the played card» / «to a card») is deliberately NOT in
 * the key: a microbe on Decomposers and a microbe on the card being played
 * add up to «+2 🦠» here — the layer lays them out per host card. Direction
 * stays in the key: a gain and a loss of one pool are two facts the row must
 * state, never a net the server never computed. Degrees (exact / asks) and
 * recipients are separate maps, so they can never merge by construction.
 */
function poolKey(effect: ActionEffect): string {
  return `${effect.direction}|${effect.icon}|${isProductionChip(effect) ? 'production' : 'stock'}`;
}

/** Merge two same-pool chips: the amounts add, the chip stays bare. */
function mergeEffect(into: ActionEffect, add: ActionEffect): ActionEffect {
  return {...into, amount: into.amount + add.amount};
}

/** Which of a fact's chips the row shows for an ASKS fact — the first GAIN of
 *  the first outcome (the layer shows the whole question). */
export function askedChip(fact: EffectForecastFact): ActionEffect | undefined {
  return fact.effects.find((e) => e.direction === 'gain') ?? fact.effects[0];
}

/** Does this fact belong in the row at all (§5.2 — never a deferred /
 *  conditional / no fact, never a FOREIGN skipped one; those live in the layer
 *  or the variant cards)? */
export function factInRow(fact: EffectForecastFact): boolean {
  if (fact.certainty === 'unknown') {
    return true;
  }
  if (fact.certainty === 'exact' || fact.certainty === 'asks') {
    return fact.effects.length > 0 || fact.certainty === 'asks';
  }
  if (fact.certainty === 'skipped') {
    // Your own lost gain is worth a glance; somebody else's non-event is not.
    return fact.recipient.kind === 'you' && fact.effects.length > 0;
  }
  return false;
}

type ChipSlot = {effect: ActionEffect, production: boolean, facts: Set<string>};

/**
 * A chip as the ROW (and a variant card) shows it — the BARE DELTA: direction,
 * icon, amount and the unit suffix, nothing else. No «было → станет», no note,
 * no basis, no host: a «⬡ 0 → 1» or a «+1 на разыгранную карту ?» pushed the
 * row onto a second line already at 4K, and the layer is where every one of
 * those readings lives (the meta line, the dossier, the detail stage). The
 * production / stock distinction survives as the chip's `production` flag,
 * not as a word.
 */
export function rowChip(effect: ActionEffect): ActionEffect {
  const bare: ActionEffect = {direction: effect.direction, icon: effect.icon, amount: effect.amount};
  if (effect.unit !== undefined) {
    bare.unit = effect.unit;
  }
  return bare;
}

function mergeInto(map: Map<string, ChipSlot>, key: string, effect: ActionEffect, factId: string): void {
  const slot = map.get(key);
  if (slot === undefined) {
    map.set(key, {effect: rowChip(effect), production: isProductionChip(effect), facts: new Set([factId])});
  } else {
    slot.effect = mergeEffect(slot.effect, effect);
    slot.facts.add(factId);
  }
}

/**
 * The row: own exact → asks → other seats (per seat, per pool) → your own
 * SKIPPED gains → «⚡ ?», merged by pool inside a degree, capped at
 * {@link FORECAST_CHIP_CAP} with «+N». Only `forecast.facts` — a branch-tied
 * fact is drawn INSIDE its variant.
 */
export function compactForecastChips(forecast: EffectForecast | undefined): ForecastRow {
  if (forecast === undefined) {
    return {chips: [], represented: 0, total: 0};
  }
  const own = new Map<string, ChipSlot>();
  const asks = new Map<string, ChipSlot>();
  const other = new Map<string, ChipSlot & {color: Color, bot: boolean}>();
  const skipped = new Map<string, ChipSlot>();
  const unknown = new Set<string>();
  let total = 0;
  for (const fact of forecast.facts) {
    if (!factInRow(fact)) {
      continue;
    }
    total++;
    if (fact.certainty === 'unknown') {
      unknown.add(fact.id);
      continue;
    }
    if (fact.certainty === 'skipped') {
      // Own only (`factInRow`): the lost gain — the first GAIN of the fact.
      const lost = askedChip(fact);
      if (lost !== undefined) {
        mergeInto(skipped, poolKey(lost), lost, fact.id);
      }
      continue;
    }
    if (fact.recipient.kind === 'you') {
      if (fact.certainty === 'exact') {
        for (const effect of fact.effects) {
          mergeInto(own, poolKey(effect), effect, fact.id);
        }
      } else {
        const effect = askedChip(fact);
        if (effect !== undefined) {
          mergeInto(asks, poolKey(effect), effect, fact.id);
        }
      }
      continue;
    }
    const color = fact.recipient.color;
    const bot = fact.recipient.kind === 'bot';
    const effects = fact.certainty === 'exact' ? fact.effects : [askedChip(fact)].filter((e): e is ActionEffect => e !== undefined);
    for (const effect of effects) {
      // Per seat, per degree, per pool — two seats never merge, and an asked
      // foreign gain never merges with a guaranteed one.
      const key = `${color}|${fact.certainty}|${poolKey(effect)}`;
      const slot = other.get(key);
      if (slot === undefined) {
        other.set(key, {effect: rowChip(effect), production: isProductionChip(effect), color, bot, facts: new Set([fact.id])});
      } else {
        slot.effect = mergeEffect(slot.effect, effect);
        slot.facts.add(fact.id);
      }
    }
  }
  const ordered: Array<{chip: ForecastChip, ids: Set<string>}> = [];
  for (const [key, slot] of own) {
    ordered.push({chip: {kind: 'own', key: `own:${key}`, effect: slot.effect, production: slot.production, facts: slot.facts.size}, ids: slot.facts});
  }
  for (const [key, slot] of asks) {
    ordered.push({chip: {kind: 'asks', key: `asks:${key}`, effect: slot.effect, production: slot.production, facts: slot.facts.size}, ids: slot.facts});
  }
  for (const [key, slot] of other) {
    ordered.push({chip: {kind: 'other', key: `other:${key}`, effect: slot.effect, production: slot.production, color: slot.color, bot: slot.bot, facts: slot.facts.size}, ids: slot.facts});
  }
  for (const [key, slot] of skipped) {
    ordered.push({chip: {kind: 'skipped', key: `skipped:${key}`, effect: slot.effect, production: slot.production, facts: slot.facts.size}, ids: slot.facts});
  }
  if (unknown.size > 0) {
    ordered.push({chip: {kind: 'unknown', key: 'unknown', facts: unknown.size}, ids: unknown});
  }
  const distinct = (entries: ReadonlyArray<{ids: Set<string>}>): number => {
    const all = new Set<string>();
    for (const e of entries) {
      for (const id of e.ids) {
        all.add(id);
      }
    }
    return all.size;
  };
  if (ordered.length <= FORECAST_CHIP_CAP) {
    return {chips: ordered.map((o) => o.chip), represented: distinct(ordered), total};
  }
  const shown = ordered.slice(0, FORECAST_CHIP_CAP - 1);
  const folded = ordered.slice(FORECAST_CHIP_CAP - 1);
  const more: ForecastChip = {kind: 'more', key: 'more', count: folded.length, facts: distinct(folded)};
  return {chips: [...shown.map((o) => o.chip), more], represented: distinct(ordered), total};
}

// ── The variant cards' reaction chips (§5.3) ────────────────────────────────

export const VARIANT_REACTION_CAP = 2;

export type VariantReactionChip = {
  key: string,
  /** The BARE delta (the row's `rowChip`). */
  effect: ActionEffect,
  production: boolean,
  color?: Color,
  bot?: boolean,
  asks: boolean,
  /** The DISTINCT facts this chip stands for (merged by the row's key). */
  facts: number,
};

export type VariantReaction = {
  chips: ReadonlyArray<VariantReactionChip>;
  /** Chips folded past the cap. */
  more: number;
  /** Every fact of the branch the chips + the fold represent. */
  total: number;
};

/**
 * The «⚡ сработает» chips drawn INSIDE a variant card: ONLY the branch-tied
 * facts (`byBranch[pos]`), as bare deltas merged by the row's own key inside
 * one degree and one recipient (own guaranteed → asked → other seats), capped
 * at two + «+N». The row never repeats them.
 */
export function variantReactionChips(forecast: EffectForecast | undefined, branchPos: number): VariantReaction {
  const facts = forecast?.byBranch?.[branchPos] ?? [];
  const own = new Map<string, ChipSlot>();
  const asks = new Map<string, ChipSlot>();
  const other = new Map<string, ChipSlot & {color: Color, bot: boolean, asks: boolean}>();
  let total = 0;
  for (const fact of facts) {
    if (fact.certainty === 'unknown' || fact.certainty === 'no' || fact.certainty === 'skipped') {
      continue;
    }
    const effect = askedChip(fact);
    if (effect === undefined) {
      continue;
    }
    total++;
    const asked = fact.certainty === 'asks';
    if (fact.recipient.kind === 'you') {
      mergeInto(asked ? asks : own, poolKey(effect), effect, fact.id);
      continue;
    }
    const color = fact.recipient.color;
    const key = `${color}|${fact.certainty}|${poolKey(effect)}`;
    const slot = other.get(key);
    if (slot === undefined) {
      other.set(key, {effect: rowChip(effect), production: isProductionChip(effect), color, bot: fact.recipient.kind === 'bot', asks: asked, facts: new Set([fact.id])});
    } else {
      slot.effect = mergeEffect(slot.effect, effect);
      slot.facts.add(fact.id);
    }
  }
  const chips: Array<VariantReactionChip> = [];
  for (const [key, slot] of own) {
    chips.push({key: `own:${key}`, effect: slot.effect, production: slot.production, asks: false, facts: slot.facts.size});
  }
  for (const [key, slot] of asks) {
    chips.push({key: `asks:${key}`, effect: slot.effect, production: slot.production, asks: true, facts: slot.facts.size});
  }
  for (const [key, slot] of other) {
    chips.push({key: `other:${key}`, effect: slot.effect, production: slot.production, color: slot.color, bot: slot.bot ? true : undefined, asks: slot.asks, facts: slot.facts.size});
  }
  if (chips.length <= VARIANT_REACTION_CAP) {
    return {chips, more: 0, total};
  }
  return {chips: chips.slice(0, VARIANT_REACTION_CAP), more: chips.length - VARIANT_REACTION_CAP, total};
}

// ── The payment head's discount tail (§5.4) ─────────────────────────────────

export type DiscountTail = {base: number, final: number, saved: number};

export function discountTail(forecast: EffectForecast | undefined): DiscountTail | undefined {
  if (forecast === undefined || forecast.discounts.final >= forecast.discounts.base) {
    return undefined;
  }
  return {base: forecast.discounts.base, final: forecast.discounts.final, saved: forecast.discounts.base - forecast.discounts.final};
}

// ── Does the forecast have a LAYER to open at all (§6.7)? ───────────────────

/** R3 is published iff the layer would show something: any fact, a discount
 *  or a payment value. An empty forecast publishes nothing. */
export function forecastLayerAvailable(forecast: EffectForecast | undefined): boolean {
  if (forecast === undefined) {
    return false;
  }
  return allForecastFacts(forecast).length > 0 ||
    forecast.discounts.final < forecast.discounts.base ||
    forecast.paymentValues.length > 0;
}

/** The compact row exists iff it has at least one chip (a discount-only
 *  forecast keeps R3 but draws no row). */
export function forecastRowPresent(forecast: EffectForecast | undefined): boolean {
  return compactForecastChips(forecast).chips.length > 0;
}

// ── The eight groups of the layer (§6.3) ────────────────────────────────────

export type ForecastGroupId = 'receive' | 'asked' | 'depends' | 'discounts' | 'others' | 'later' | 'skipped' | 'no';

export const FORECAST_GROUP_ORDER: ReadonlyArray<ForecastGroupId> = ['receive', 'asked', 'depends', 'discounts', 'others', 'later', 'skipped', 'no'];

/** Glyph + English label per group — the glyph is the SAME the compact row's
 *  chip / badge carries, so the legend is learnt by adjacency. */
export const FORECAST_GROUP_META: Readonly<Record<ForecastGroupId, {glyph: string, label: string}>> = {
  receive: {glyph: '⚡', label: 'You will receive'},
  asked: {glyph: '?', label: 'You will be asked'},
  // The SAME bolt the variant cards' «⚡ сработает» caption carries — the
  // legend is learnt by adjacency, so the group that explains those chips
  // wears their glyph (the «↳» arrow told the player nothing).
  depends: {glyph: '⚡', label: 'Depends on your choice'},
  discounts: {glyph: '−', label: 'Discounts and payment'},
  others: {glyph: '▍', label: 'Others receive'},
  later: {glyph: '…', label: 'Later'},
  skipped: {glyph: '⚠', label: 'Will be skipped'},
  no: {glyph: '✕', label: 'Will not trigger'},
};

/** One item of a group. A FACT item carries the server's fact; the discounts
 *  group carries the itemized discounts / the remainder / the payment values. */
export type ForecastItem =
  | {kind: 'fact', key: string, fact: EffectForecastFact, group: ForecastGroupId, branchPos?: number}
  | {kind: 'discount', key: string, source: EventSource, amount: number, group: 'discounts'}
  | {kind: 'other-discount', key: string, amount: number, group: 'discounts'}
  | {kind: 'payment', key: string, value: EffectForecastPaymentValue, group: 'discounts'}
  | {kind: 'branch-empty', key: string, branchPos: number, group: 'depends'};

export type ForecastGroup = {
  id: ForecastGroupId;
  glyph: string;
  label: string;
  items: ReadonlyArray<ForecastItem>;
};

export type ForecastBranchInfo = {pos: number, title: string | Message, available: boolean};

/** Which group a fact belongs to — the certainty ladder (§7) crossed with the recipient. */
export function groupOfFact(fact: EffectForecastFact, branchTied: boolean): ForecastGroupId {
  if (branchTied || fact.certainty === 'conditional') {
    return 'depends';
  }
  switch (fact.certainty) {
  case 'skipped': return 'skipped';
  case 'no': return 'no';
  case 'unknown': return 'later';
  case 'deferred': return fact.recipient.kind === 'you' ? 'later' : 'others';
  case 'asks': return fact.recipient.kind === 'you' ? 'asked' : 'others';
  case 'exact': return fact.recipient.kind === 'you' ? 'receive' : 'others';
  default: return 'later';
  }
}

/**
 * The groups, in the fixed order, NON-EMPTY only. The «depends» group lists
 * one row per AVAILABLE branch — its facts, or «nothing will trigger».
 */
export function forecastGroups(
  forecast: EffectForecast | undefined,
  branches: ReadonlyArray<ForecastBranchInfo> = [],
): Array<ForecastGroup> {
  if (forecast === undefined) {
    return [];
  }
  const items: Record<ForecastGroupId, Array<ForecastItem>> = {
    receive: [], asked: [], depends: [], discounts: [], others: [], later: [], skipped: [], no: [],
  };
  for (const fact of forecast.facts) {
    const group = groupOfFact(fact, false);
    items[group].push({kind: 'fact', key: fact.id, fact, group});
  }
  const byBranch = forecast.byBranch ?? {};
  const branchPositions = branches.length > 0 ?
    branches.filter((b) => b.available).map((b) => b.pos) :
    Object.keys(byBranch).map(Number).sort((a, b) => a - b);
  for (const pos of branchPositions) {
    const facts = byBranch[pos] ?? [];
    if (facts.length === 0) {
      if (branches.length > 0) {
        items.depends.push({kind: 'branch-empty', key: `branch-${pos}-empty`, branchPos: pos, group: 'depends'});
      }
      continue;
    }
    for (const fact of facts) {
      items.depends.push({kind: 'fact', key: `${pos}:${fact.id}`, fact, group: 'depends', branchPos: pos});
    }
  }
  const d = forecast.discounts;
  if (d.final < d.base) {
    for (const [i, item] of d.items.entries()) {
      items.discounts.push({kind: 'discount', key: `discount-${i}`, source: item.source, amount: item.amount, group: 'discounts'});
    }
    if (d.other > 0) {
      items.discounts.push({kind: 'other-discount', key: 'discount-other', amount: d.other, group: 'discounts'});
    }
  }
  for (const [i, value] of forecast.paymentValues.entries()) {
    items.discounts.push({kind: 'payment', key: `payment-${i}`, value, group: 'discounts'});
  }
  return FORECAST_GROUP_ORDER
    .filter((id) => items[id].length > 0)
    .map((id) => ({id, glyph: FORECAST_GROUP_META[id].glyph, label: FORECAST_GROUP_META[id].label, items: items[id]}));
}

/** The LT/RT section chips: «All N» + every non-empty group. */
export function forecastSectionChips(groups: ReadonlyArray<ForecastGroup>, active: ForecastGroupId | 'all'):
  Array<{id: ForecastGroupId | 'all', glyph: string, label: string, count: number, active: boolean}> {
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  return [
    {id: 'all', glyph: '', label: 'All', count: total, active: active === 'all'},
    ...groups.map((g) => ({id: g.id, glyph: g.glyph, label: g.label, count: g.items.length, active: active === g.id})),
  ];
}

/** The next section on an LT/RT press (wrapping), over the non-empty groups. */
export function cycleForecastSection(groups: ReadonlyArray<ForecastGroup>, current: ForecastGroupId | 'all', dir: 1 | -1): ForecastGroupId | 'all' {
  const ids: Array<ForecastGroupId | 'all'> = ['all', ...groups.map((g) => g.id)];
  const at = Math.max(0, ids.indexOf(current));
  return ids[(at + dir + ids.length) % ids.length];
}

// ── The BROWSE model of the layer (the explorer's grid in forecast mode) ────

export type ForecastTileVm = {
  key: string;
  item: ForecastItem;
  group: ForecastGroupId;
  glyph: string;
  groupLabel: string;
};

export type ForecastSectionVm = {
  id: ForecastGroupId;
  glyph: string;
  label: string;
  tiles: ReadonlyArray<ForecastTileVm>;
};

export type ForecastBrowseModel = {
  /** The visible sections (the active facet only), fixed group order. */
  sections: ReadonlyArray<ForecastSectionVm>;
  /** Flat focus order over the visible tiles. */
  flatKeys: ReadonlyArray<string>;
  /** The grid's focus rows — per section, `columns` abreast (the section
   *  header spans the grid, so every section restarts at column 1). */
  rows: ReadonlyArray<ReadonlyArray<string>>;
  chips: ReturnType<typeof forecastSectionChips>;
  /** Every group (facet-independent) — the LT/RT cycle and the counts. */
  groups: ReadonlyArray<ForecastGroup>;
  total: number;
};

export function buildForecastBrowseModel(input: {
  forecast: EffectForecast | undefined,
  branches: ReadonlyArray<ForecastBranchInfo>,
  sectionFilter: ForecastGroupId | 'all',
  columns: 1 | 2,
}): ForecastBrowseModel {
  const groups = forecastGroups(input.forecast, input.branches);
  const visible = input.sectionFilter === 'all' ? groups : groups.filter((g) => g.id === input.sectionFilter);
  const sections: Array<ForecastSectionVm> = visible.map((g) => ({
    id: g.id,
    glyph: g.glyph,
    label: g.label,
    tiles: g.items.map((item) => ({key: item.key, item, group: g.id, glyph: g.glyph, groupLabel: g.label})),
  }));
  const rows: Array<Array<string>> = [];
  for (const s of sections) {
    for (let i = 0; i < s.tiles.length; i += input.columns) {
      rows.push(s.tiles.slice(i, i + input.columns).map((t) => t.key));
    }
  }
  return {
    sections,
    flatKeys: sections.flatMap((s) => s.tiles.map((t) => t.key)),
    rows,
    chips: forecastSectionChips(groups, input.sectionFilter),
    groups,
    total: groups.reduce((n, g) => n + g.items.length, 0),
  };
}

/** The source CARD an item stands on (undefined for a rule source / the
 *  cardless remainder / an empty branch). */
export function forecastItemCard(item: ForecastItem): CardName | undefined {
  switch (item.kind) {
  case 'fact':
    return forecastSourceIsCardless(item.fact.source) ? undefined : item.fact.source.name as CardName;
  case 'discount':
  case 'payment': {
    const source = item.kind === 'discount' ? item.source : item.value.source;
    return source.kind === 'card' || source.kind === 'corporation' ? source.card : undefined;
  }
  default:
    return undefined;
  }
}

/**
 * The CARDLESS POLITICAL source of a DISCOUNT item (Turmoil Redux): an
 * enacted resolution's law (Heat Capture's 3 M€ off a Building tag) or a
 * party's policy took M€ off the price. The explorer NAMES it — a resolution
 * through the parliament manifest, a party by its name — instead of filing the
 * line under «Other discounts»: a price that fell for no named reason is the
 * silent loss this exists to prevent. Undefined for a card / corporation
 * source (the tile is the card's own) and for every non-discount item.
 */
export function forecastItemPoliticalSource(item: ForecastItem): Extract<EventSource, {kind: 'resolution' | 'party'}> | undefined {
  if (item.kind !== 'discount') {
    return undefined;
  }
  const source = item.source;
  return source.kind === 'resolution' || source.kind === 'party' ? source : undefined;
}

/** The seat that HOLDS the item's source (undefined when unknown). */
export function forecastItemOwner(item: ForecastItem, viewer: Color): Color | undefined {
  switch (item.kind) {
  case 'fact':
    return item.fact.source.owner;
  case 'discount':
  case 'payment': {
    const source = item.kind === 'discount' ? item.source : item.value.source;
    return source.kind === 'card' || source.kind === 'corporation' ? (source.owner ?? viewer) : viewer;
  }
  default:
    return viewer;
  }
}

/** The recipient an item pays out to (the discount family pays the viewer). */
export function forecastItemRecipient(item: ForecastItem): EffectForecastRecipient {
  return item.kind === 'fact' ? item.fact.recipient : {kind: 'you'};
}

// ── The «ПОРЯДОК» band (§6.6) ───────────────────────────────────────────────

export type OrderStep =
  | {kind: 'fact', key: string, fact: EffectForecastFact}
  | {kind: 'card-choice', key: 'card-choice'}
  | {kind: 'cell', key: 'cell'};

const TIMING_RANK: Readonly<Record<EffectForecastTiming, number>> = {
  'before-card-choices': 0,
  'immediate': 0,
  'after-card': 2,
  'after-placement': 4,
  'on-draw': 5,
  'unknown': 6,
};

/**
 * The band: every asks / deferred fact in timing order (before the card's
 * own choices → the card's choice → after it → the cell → after the tile),
 * with the card-choice and cell markers inserted where the play's own steps
 * stand. Rendered ONLY when two or more asks / deferred facts exist and every
 * one of them declares a `sequence` — a guessed order is worse than none.
 */
export function forecastOrderBand(
  forecast: EffectForecast | undefined,
  selectedBranchPos: number | undefined,
  flags: {cardChoices: boolean, placesTile: boolean},
): Array<OrderStep> {
  if (forecast === undefined) {
    return [];
  }
  const facts = [...forecast.facts, ...(selectedBranchPos !== undefined ? (forecast.byBranch?.[selectedBranchPos] ?? []) : [])]
    .filter((f) => f.certainty === 'asks' || f.certainty === 'deferred' || (f.certainty === 'conditional' && f.timing === 'after-placement'));
  if (facts.length < 2 || facts.some((f) => f.sequence === undefined)) {
    return [];
  }
  const steps: Array<{rank: number, seq: number, order: number, step: OrderStep}> = facts.map((f, i) => ({
    rank: TIMING_RANK[f.timing],
    seq: f.sequence ?? 0,
    order: i,
    step: {kind: 'fact', key: f.id, fact: f},
  }));
  if (flags.cardChoices) {
    steps.push({rank: 1, seq: 0, order: -1, step: {kind: 'card-choice', key: 'card-choice'}});
  }
  if (flags.placesTile) {
    steps.push({rank: 3, seq: 0, order: -1, step: {kind: 'cell', key: 'cell'}});
  }
  steps.sort((a, b) => a.rank - b.rank || a.seq - b.seq || a.order - b.order);
  return steps.map((s) => s.step);
}

// ── Attribution of a fact to the printed effect block (§4.4) ────────────────

/** The slice of an `EffectEntry` the attribution reads. */
export type AttributableEffect = {key: string, cardName: CardName, effectIndex: number, signature: EffectSignature};

/**
 * WHICH printed effect of the source card a fact belongs to — through the
 * effects explorer's channel plan (`expectedChannelsFor`, the same table the
 * per-effect statistics ride). One candidate on the fact's channel → that
 * effect; a single-effect card → its one effect; anything else → `undefined`,
 * and the tile falls back to the honest «an effect of this card» without
 * pointing at a block it cannot vouch for.
 */
export function attributeFactToEffect<E extends AttributableEffect>(channel: EventTrigger, entries: ReadonlyArray<E>, printedEffect?: number): E | undefined {
  // The card FILE declared the block (its halves share one live channel —
  // Pharmacy Union): the declaration wins over the plan.
  if (printedEffect !== undefined) {
    const declared = entries.find((e) => e.effectIndex === printedEffect);
    if (declared !== undefined) {
      return declared;
    }
  }
  if (entries.length === 1) {
    return entries[0];
  }
  const onChannel = entries.filter((e) => (expectedChannelsFor(e.cardName, e.effectIndex, e.signature) ?? []).includes(channel as never));
  return onChannel.length === 1 ? onChannel[0] : undefined;
}

/** The same attribution for every item kind: a discount item points at the
 *  card's discount block, a payment value at its spending-power block. */
export function attributeItemToEffect<E extends AttributableEffect>(item: ForecastItem, entries: ReadonlyArray<E>): E | undefined {
  switch (item.kind) {
  case 'fact':
    return attributeFactToEffect(item.fact.source.channel, entries, item.fact.source.printedEffect);
  case 'discount': {
    const discounts = entries.filter((e) => e.signature.discount);
    return discounts.length === 1 ? discounts[0] : (entries.length === 1 ? entries[0] : undefined);
  }
  case 'payment': {
    const pay = entries.filter((e) => e.signature.valueAsPayment);
    return pay.length === 1 ? pay[0] : (entries.length === 1 ? entries[0] : undefined);
  }
  default:
    return undefined;
  }
}

// ── The five questions of an item (§6.4) ────────────────────────────────────

/** English i18n keys for the WHEN answer. */
export const TIMING_LABEL: Readonly<Record<EffectForecastTiming, string>> = {
  'immediate': 'Right after the play',
  'before-card-choices': 'Before the card\'s own choices',
  'after-card': 'After the card',
  'after-placement': 'After the tile is placed',
  'on-draw': 'When the cards are drawn',
  'unknown': 'Timing unknown',
};

/**
 * The WHEN answer for THIS operation: an immediate reaction to a card PLAY
 * lands «сразу после розыгрыша», the same reaction to a card ACTION «сразу
 * после выполнения» (Meat Industry paying for Livestock's animal). Every other
 * timing names its own moment and reads the same on both screens.
 */
export function timingLabel(timing: EffectForecastTiming, operation: ForecastOperation = 'play'): string {
  if (timing === 'immediate' && operation === 'action') {
    return 'Right after the action';
  }
  return TIMING_LABEL[timing];
}

/** English i18n keys for the certainty pill. */
export const CERTAINTY_LABEL: Readonly<Record<EffectForecastCertainty, string>> = {
  exact: 'Will trigger',
  asks: 'You will be asked',
  conditional: 'Depends on your choice',
  deferred: 'Later',
  unknown: 'Not calculated',
  skipped: 'Will be skipped',
  no: 'Will not trigger',
};

/** A fact whose chips carry no arrow states «сверх собственного эффекта карты»
 *  — the play touches that pool itself (the engine stripped the arrow). */
export function factBeyondOwnEffect(fact: EffectForecastFact): boolean {
  return fact.recipient.kind === 'you' && fact.effects.length > 0 && fact.effects.every((e) => e.current === undefined && e.direction === 'gain');
}

/**
 * The tile's META LINE — the forecast for THIS play in one quiet line: the
 * chips (WHAT) and the one word that qualifies them (asked / later / not
 * calculated / skipped / will not trigger). An exact own gain needs no word —
 * the chips ARE the sentence. `alternative` carries the asks fact's second
 * outcome so the line can read «жетон или карта».
 */
export type ForecastMetaLine = {
  chips: ReadonlyArray<ActionEffect>;
  /** English i18n key, or undefined when the chips speak alone. */
  label: string | undefined;
  /** For an ASKS fact: the first alternative's chips (or its label). */
  alternative?: {chips: ReadonlyArray<ActionEffect>, label: string | Message};
  recipient: EffectForecastRecipient;
};

export function forecastMetaLine(item: ForecastItem, operation: ForecastOperation = 'play'): ForecastMetaLine {
  if (item.kind !== 'fact') {
    return {chips: [], label: undefined, recipient: {kind: 'you'}};
  }
  const fact = item.fact;
  const line: ForecastMetaLine = {chips: fact.effects, label: undefined, recipient: fact.recipient};
  switch (fact.certainty) {
  case 'exact':
    break;
  case 'asks': {
    line.label = CERTAINTY_LABEL.asks;
    const alt = fact.alternatives?.[0];
    if (alt !== undefined) {
      line.alternative = {chips: alt.effects, label: alt.label};
    }
    break;
  }
  case 'conditional':
    line.label = CERTAINTY_LABEL.conditional;
    break;
  case 'deferred':
    line.label = timingLabel(fact.timing, operation);
    break;
  default:
    line.label = CERTAINTY_LABEL[fact.certainty];
    break;
  }
  return line;
}
