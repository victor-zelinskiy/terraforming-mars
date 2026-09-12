/**
 * PURE view-model for the console EFFECTS EXPLORER («Информация › Эффекты») —
 * the browse grid of per-EFFECT tiles in the card-actions visual language, the
 * per-family counts of the summary zone, and the d-pad geometry.
 *
 * No Vue / DOM / i18n / manifest: effect entries are INJECTED (the component
 * derives them via `effectExtraction.playerEffects`, which is manifest-bound),
 * labels are English i18n KEYS, and the module runs under the server test
 * runner (`tests/console/effectsExplorerModel.spec.ts`). Host-agnostic on
 * purpose — a future workspace (e.g. «effects this play would trigger») feeds
 * its own entries/cards/stats and reuses everything here.
 */
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {EffectCategory, EffectSignature, classifyEffectSignature, curatedCategoryFor} from '@/client/components/effects/effectSummary';
import {PerEffectStat, perEffectStat} from '@/client/components/effects/effectChannels';

// ── Families ────────────────────────────────────────────────────────────────

/**
 * The player-facing FAMILY of one effect — the summary zone's counting unit and
 * the browse filter's facet. Deliberately four: finer granularity belongs to
 * the per-effect summary, not to a count row.
 */
export type EffectFamily = 'triggers' | 'discounts' | 'payValue' | 'rules';

export const EFFECT_FAMILY_ORDER: ReadonlyArray<EffectFamily> = ['triggers', 'discounts', 'payValue', 'rules'];

/** English i18n keys («Триггеры» / «Скидки» / «Ценность оплаты» / «Правила»). */
export const EFFECT_FAMILY_LABEL: Record<EffectFamily, string> = {
  triggers: 'Triggers',
  discounts: 'Discounts',
  payValue: 'Spending power',
  rules: 'Rules',
};

/**
 * EffectCategory → family, TOTAL over all 12 categories (a new category fails
 * the compile until it declares its family). `corporation` is unreachable by
 * construction — `effectFamily` classifies with a forced 'card' source kind so
 * a corporation's effect lands in its MECHANICAL family — but the record stays
 * total for safety (spec-pinned).
 */
const CATEGORY_FAMILY: Record<EffectCategory, EffectFamily> = {
  trigger: 'triggers',
  resourceAccumulation: 'triggers',
  passiveTr: 'triggers',
  passiveProduction: 'triggers',
  colonyTrade: 'triggers',
  discount: 'discounts',
  tradeDiscount: 'discounts',
  greeneryDiscount: 'discounts',
  payment: 'payValue',
  paymentValueBonus: 'payValue',
  ruleChange: 'rules',
  corporation: 'rules',
};

/**
 * Family overrides for cards the render signature cannot classify: Helion's
 * heat-as-M€ is a corp ability with no printed payment formula (its stats land
 * on `resource-payment`), and the two EMPTY_SIGNATURE render overrides are
 * trigger effects that would otherwise fall to `rules`. Closed set, spec'd;
 * the coverage sweep keeps candidates visible.
 */
const FAMILY_OVERRIDES: Partial<Record<CardName, EffectFamily>> = {
  [CardName.HELION]: 'payValue',
  [CardName.OLYMPUS_CONFERENCE]: 'triggers',
  [CardName.NEPTUNIAN_POWER_CONSULTANTS]: 'triggers',
};

/** The slice of `effectExtraction.EffectEntry` the model reads (structurally
 *  assignable — the component passes the real entries through unchanged). */
export type ExplorerEffectInput = {
  key: string;
  cardName: CardName;
  effectIndex: number;
  isCorporation: boolean;
  isDisabled: boolean;
  signature: EffectSignature;
};

/**
 * The family ONE effect belongs to. Precedence (each step needed, spec'd):
 * structural payment → curated special category → family override → printed
 * discount → the server's declared `CardModel.discount` (single-effect cards
 * only, so a card-level field can never mis-family a sibling effect) → the
 * render-signature classification with a FORCED 'card' kind (a corporation
 * classifies by the effect's nature, never by being a corporation).
 */
export function effectFamily(entry: ExplorerEffectInput, card: CardModel | undefined, isOnlyEffect: boolean): EffectFamily {
  if (entry.signature.valueAsPayment) {
    return 'payValue';
  }
  const curated = curatedCategoryFor(entry.cardName);
  if (curated !== undefined) {
    return CATEGORY_FAMILY[curated];
  }
  const override = FAMILY_OVERRIDES[entry.cardName];
  if (override !== undefined) {
    return override;
  }
  if (entry.signature.discount) {
    return 'discounts';
  }
  if (isOnlyEffect && (card?.discount?.length ?? 0) > 0) {
    return 'discounts';
  }
  const category = classifyEffectSignature(entry.signature, {sourceName: entry.cardName, sourceKind: 'card'});
  return CATEGORY_FAMILY[category];
}

// ── Tile meta (the honesty ladder) ──────────────────────────────────────────

/** The quiet one-liner under a tile's graphic. Labels are i18n keys; `none`
 *  renders nothing (stats loading/absent — no fake zeros, ever). */
export type EffectTileMeta =
  | {kind: 'stat', label: string, value: string, icon?: string}
  | {kind: 'idle', label: string}
  | {kind: 'cardScoped', label: string}
  | {kind: 'none'};

/**
 * The meta line for one tile. `per === undefined` means the stats have not
 * arrived (loading / fetch failed with no prior answer) — nothing is claimed.
 * A `rules` effect never tallies (it shapes play); a multi-effect card whose
 * channels could not be split says so instead of guessing.
 */
export function effectTileMeta(family: EffectFamily, per: PerEffectStat | undefined): EffectTileMeta {
  if (per === undefined) {
    return {kind: 'none'};
  }
  if (family === 'rules') {
    return {kind: 'idle', label: 'Ongoing rule'};
  }
  if (per.scope === 'card') {
    return {kind: 'cardScoped', label: 'Card-level stats'};
  }
  const stat = per.stat;
  if (stat === undefined) {
    return {kind: 'idle', label: 'Not triggered yet'};
  }
  if (family === 'discounts') {
    if (stat.megacreditsSaved > 0) {
      return {kind: 'stat', label: 'Saved', value: `${stat.megacreditsSaved}`, icon: 'megacredits'};
    }
    const tradeCount = stat.tradeDiscount.count + stat.greeneryDiscount.count;
    if (tradeCount > 0) {
      return {kind: 'stat', label: 'Times triggered', value: `${tradeCount}`};
    }
  }
  if (family === 'payValue') {
    if (stat.paymentValueBonus.bonusValue > 0) {
      return {kind: 'stat', label: 'Extra value', value: `+${stat.paymentValueBonus.bonusValue}`, icon: 'megacredits'};
    }
    if (stat.megacreditsSaved > 0) {
      return {kind: 'stat', label: 'Payment value', value: `${stat.megacreditsSaved}`, icon: 'megacredits'};
    }
  }
  if (stat.triggerCount > 0) {
    return {kind: 'stat', label: 'Times triggered', value: `${stat.triggerCount}`};
  }
  return {kind: 'idle', label: 'Not triggered yet'};
}

// ── The browse model ────────────────────────────────────────────────────────

export type EffectsTileVm<E extends ExplorerEffectInput> = {
  key: string;
  entry: E;
  family: EffectFamily;
  familyLabel: string;
  /** The per-effect stat resolution (undefined while stats are loading). */
  per: PerEffectStat | undefined;
  meta: EffectTileMeta;
};

export type EffectsGroupVm<E extends ExplorerEffectInput> = {
  key: string;
  cardName: CardName;
  isCorporation: boolean;
  isDisabled: boolean;
  /** >1 effect → the group takes the full grid row (tiles abreast). */
  wide: boolean;
  tiles: Array<EffectsTileVm<E>>;
};

export type EffectsFamilyChip = {
  id: EffectFamily | 'all';
  label: string;
  count: number;
  active: boolean;
};

export type EffectsBrowseModel<E extends ExplorerEffectInput> = {
  /** The visible groups (per SOURCE card, corp-first tableau order preserved). */
  groups: ReadonlyArray<EffectsGroupVm<E>>;
  /** Flat focus order over the visible tiles. */
  flatKeys: ReadonlyArray<string>;
  /** The grid's focus rows (mirror the CSS exactly — see {@link packEffectRows}). */
  rows: ReadonlyArray<ReadonlyArray<string>>;
  /** The family facet chips (non-empty families only + «all»), counts filter-independent. */
  familyChips: ReadonlyArray<EffectsFamilyChip>;
  /** Per-effect counts over ALL entries (filter-independent). */
  familyCounts: Partial<Record<EffectFamily, number>>;
  /** Total effects (filter-independent). */
  total: number;
};

export type EffectsBrowseInput<E extends ExplorerEffectInput> = {
  entries: ReadonlyArray<E>;
  /** The seat's tableau (for `CardModel.discount` + live resources). */
  tableau: ReadonlyArray<CardModel>;
  /** The seat's effect stats (undefined = loading/absent — metas degrade). */
  stats: ReadonlyArray<EffectOverlayStat> | undefined;
  familyFilter: EffectFamily | 'all';
  columns: 1 | 2;
};

function cardOf(tableau: ReadonlyArray<CardModel>, name: CardName): CardModel | undefined {
  return tableau.find((c) => c.name === name);
}

function statOf(stats: ReadonlyArray<EffectOverlayStat> | undefined, entry: ExplorerEffectInput): EffectOverlayStat | undefined {
  return stats?.find((s) => s.card === entry.cardName && (s.kind === 'corporation') === entry.isCorporation);
}

/** Build the whole browse model in one pass (groups, geometry, facets, counts). */
export function buildEffectsBrowseModel<E extends ExplorerEffectInput>(input: EffectsBrowseInput<E>): EffectsBrowseModel<E> {
  const {entries, tableau, stats, familyFilter, columns} = input;
  const byCard = new Map<CardName, Array<E>>();
  for (const entry of entries) {
    const list = byCard.get(entry.cardName);
    if (list === undefined) {
      byCard.set(entry.cardName, [entry]);
    } else {
      list.push(entry);
    }
  }
  const familyCounts: Partial<Record<EffectFamily, number>> = {};
  const groups: Array<EffectsGroupVm<E>> = [];
  for (const [cardName, cardEntries] of byCard) {
    const card = cardOf(tableau, cardName);
    const cardStat = statOf(stats, cardEntries[0]);
    const tiles: Array<EffectsTileVm<E>> = [];
    for (const entry of cardEntries) {
      const family = effectFamily(entry, card, cardEntries.length === 1);
      familyCounts[family] = (familyCounts[family] ?? 0) + 1;
      const per = stats === undefined ? undefined : perEffectStat(entry, cardEntries, cardStat);
      tiles.push({
        key: entry.key,
        entry,
        family,
        familyLabel: EFFECT_FAMILY_LABEL[family],
        per,
        meta: effectTileMeta(family, per),
      });
    }
    const visible = familyFilter === 'all' ? tiles : tiles.filter((t) => t.family === familyFilter);
    if (visible.length === 0) {
      continue;
    }
    groups.push({
      key: cardName,
      cardName,
      isCorporation: cardEntries[0].isCorporation,
      isDisabled: cardEntries[0].isDisabled,
      wide: visible.length > 1,
      tiles: visible,
    });
  }
  const total = entries.length;
  const familyChips: Array<EffectsFamilyChip> = [
    {id: 'all', label: 'All', count: total, active: familyFilter === 'all'},
    ...EFFECT_FAMILY_ORDER
      .filter((f) => (familyCounts[f] ?? 0) > 0)
      .map((f) => ({id: f, label: EFFECT_FAMILY_LABEL[f], count: familyCounts[f] ?? 0, active: familyFilter === f})),
  ];
  const rows = packEffectRows(groups, columns);
  return {
    groups,
    flatKeys: groups.flatMap((g) => g.tiles.map((t) => t.key)),
    rows,
    familyChips,
    familyCounts,
    total,
  };
}

/**
 * Pack the visible groups into the browse grid's FOCUS ROWS, mirroring the CSS
 * exactly (the `packActionRows` law, re-stated over effect groups): a
 * single-effect card takes one of the two columns (consecutive singles pack
 * abreast), a multi-effect card takes the whole row — its tiles stand side by
 * side on the same physical columns, so every tile shares one width rhythm.
 * Handheld (columns 1) stacks every tile.
 */
export function packEffectRows(
  groups: ReadonlyArray<{tiles: ReadonlyArray<{key: string}>}>,
  columns: 1 | 2,
): Array<Array<string>> {
  const rows: Array<Array<string>> = [];
  let half: Array<string> | undefined;
  const flushHalf = () => {
    if (half !== undefined) {
      rows.push(half);
      half = undefined;
    }
  };
  for (const g of groups) {
    if (g.tiles.length === 1 && columns === 2) {
      if (half === undefined) {
        half = [g.tiles[0].key];
      } else {
        half.push(g.tiles[0].key);
        flushHalf();
      }
      continue;
    }
    flushHalf();
    if (columns === 1) {
      for (const t of g.tiles) {
        rows.push([t.key]);
      }
      continue;
    }
    for (let i = 0; i < g.tiles.length; i += columns) {
      rows.push(g.tiles.slice(i, i + columns).map((t) => t.key));
    }
  }
  flushHalf();
  return rows;
}

/** The next/prev effect over the visible flat order (detail LB/RB) — clamped. */
export function stepEffect(flatKeys: ReadonlyArray<string>, current: string, dir: 1 | -1): string {
  if (flatKeys.length === 0) {
    return current;
  }
  const i = flatKeys.indexOf(current);
  if (i === -1) {
    return flatKeys[0];
  }
  return flatKeys[Math.min(flatKeys.length - 1, Math.max(0, i + dir))];
}

// ── The summary-zone readouts ───────────────────────────────────────────────

export type EffectsZoneCounts = {
  total: number;
  /** Non-zero families in canonical order (label = i18n key). */
  families: ReadonlyArray<{family: EffectFamily, label: string, count: number}>;
  /** Disabled entries are COUNTED in their family (they are visible dimmed
   *  tiles — the zone must agree with the grid) and reported separately. */
  disabledCount: number;
};

/** Per-EFFECT counts for the overview zone (the per-card «Активные/Скидки»
 *  readout this replaces counted rows, and its discount predicate was always
 *  true — see the plan). */
export function effectsZoneCounts(entries: ReadonlyArray<ExplorerEffectInput>, tableau: ReadonlyArray<CardModel>): EffectsZoneCounts {
  const perCard = new Map<CardName, number>();
  for (const entry of entries) {
    perCard.set(entry.cardName, (perCard.get(entry.cardName) ?? 0) + 1);
  }
  const counts: Partial<Record<EffectFamily, number>> = {};
  let disabledCount = 0;
  for (const entry of entries) {
    const family = effectFamily(entry, cardOf(tableau, entry.cardName), perCard.get(entry.cardName) === 1);
    counts[family] = (counts[family] ?? 0) + 1;
    if (entry.isDisabled) {
      disabledCount++;
    }
  }
  return {
    total: entries.length,
    families: EFFECT_FAMILY_ORDER
      .filter((f) => (counts[f] ?? 0) > 0)
      .map((f) => ({family: f, label: EFFECT_FAMILY_LABEL[f], count: counts[f] ?? 0})),
    disabledCount,
  };
}

/**
 * The zone's quiet whole-game line: total effect firings + direct M€ saved.
 * `undefined` while the stats have not arrived — the line does not render
 * (loading must never read as «ничего не сработало»).
 */
export function effectsZoneStatsLine(stats: ReadonlyArray<EffectOverlayStat> | undefined): {triggers: number, savedMc: number} | undefined {
  if (stats === undefined) {
    return undefined;
  }
  let triggers = 0;
  let savedMc = 0;
  for (const s of stats) {
    triggers += s.triggerCount;
    savedMc += s.megacreditsSaved;
  }
  return {triggers, savedMc};
}
