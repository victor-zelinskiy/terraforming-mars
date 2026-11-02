/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE VENUS BONUS — THE INNER PRE-SELECT (P89 · ledger EM — the owner, 2026-11-02: «сам pre-select надо доработать
 * внутренним шагом, иначе он слишком много забирает места … все бонусы агрегировать внутри одного внутреннего
 * pre-select, сначала OR-выбор касательно финального бонуса (показывается только если он реально здесь забирается) и в
 * зависимости от него ниже отображается раздел «положить на карту» либо просто добавляется ещё один выбор ресурса. Саму
 * зону выбора ресурса сделать фиксированной 2 ряда по 3 ресурса с грамотной навигацией по d-pad»).
 *
 * The composer keeps ONE row for the whole bonus (its answer read back in chips); A on it enters this inner step — a
 * level of the composer (`sub`), never a modal — and its own confirm leaves it. The PURE half: the zones, the 2-D cursor,
 * what every verb does and what the bar says. Every host (the play sheet, the blue action's setup, the colony trade's
 * stage) stands on it, so the three can never walk the bonus differently.
 *
 * Zones, top to bottom — each a ROW of the cursor's grid:
 *  · `wild`  — the 30 % finish's OR (only when the step really reaches 30 % AND a card can hold the wild; with no such
 *              card the wild is simply one more standard resource): «on a card» | «one more standard resource»;
 *  · `card`  — «Put it on a card»: the candidates (only while the wild goes onto a card);
 *  · `lane`  — the six standard resources, a FIXED grid of 2 rows × 3 (`VENUS_GRID_COLS`): ↑↓ change the row, ←→ the
 *              column, LB/RB one unit, RT the rest. The grid never reflows — a lane keeps its place whatever is placed.
 * A is the verb of the zone: choose the option · choose the card · on a lane «+1 here» until the bonus is laid out, then
 * «Подтвердить» (leaves the step). B leaves the step with the draft kept (a pre-select — nothing was sent).
 */
import {CardName} from '@/common/cards/CardName';
import {GlyphControl} from '@/client/gamepad/glyphSets';
import {CardModel} from '@/common/models/CardModel';
import {VenusBonusPromptMeta} from '@/common/models/PlayerInputModel';
import {SpreadState, pourRemaining, spreadRemaining, spreadTotal, stepSpread} from '@/client/console/cardResourceDistribution';
import {venusWildTargets} from '@/client/console/compositePrompts';
import {VENUS_SPREAD_LANES, VenusBonusParts, venusPreselectResponse, venusSpreadAmount, venusWildAsks} from '@/client/console/venusBonus/venusBonusPreselect';

/** The resource grid: 2 rows × 3 columns, in the server's lane order (M€ · steel · titanium / plants · energy · heat). */
export const VENUS_GRID_COLS = 3;

export type VenusInnerZone = 'wild' | 'card' | 'lane';

/** The cursor of the inner step. `index` — the option (0 on a card · 1 a standard resource), the candidate, the lane. */
export type VenusInnerFocus = {zone: VenusInnerZone, index: number};

/** The verbs the inner step answers — the composer's own `ConsoleAction` names. */
export type VenusInnerVerb = 'primary' | 'back' | 'prevSection' | 'nextSection' | 'nextTab';

/** What a press did: the new draft, the new cursor, and whether the step is left (`confirm` · `back`). */
export type VenusInnerResult = {parts: VenusBonusParts, focus: VenusInnerFocus, exit?: 'confirm' | 'back'};

/** The two options of the 30 % wild, in the server's branch order. */
export const VENUS_WILD_OPTIONS: ReadonlyArray<{key: 'onCard' | 'asStandard', title: string, desc: string}> = [
  {key: 'onCard', title: 'Put it on a card', desc: 'A resource of the card’s own kind'},
  {key: 'asStandard', title: 'One more standard resource', desc: 'Lay it out with the others'},
];

/** Is the wild's OR asked HERE (the 30 % finish, a card able to hold it)? */
export function venusInnerWildShown(meta: VenusBonusPromptMeta): boolean {
  return venusWildAsks(meta);
}

/** The candidates of «Put it on a card» — shown only while the wild goes onto a card. */
export function venusInnerCards(meta: VenusBonusPromptMeta, parts: VenusBonusParts): ReadonlyArray<CardName> {
  return venusInnerWildShown(meta) && parts.wild?.wild === 'onCard' ? venusWildTargets(meta) : [];
}

/** One row of the cursor's grid. */
type GridRow = {zone: VenusInnerZone, first: number, count: number};

function gridRows(meta: VenusBonusPromptMeta, parts: VenusBonusParts): Array<GridRow> {
  const rows: Array<GridRow> = [];
  if (venusInnerWildShown(meta)) {
    rows.push({zone: 'wild', first: 0, count: VENUS_WILD_OPTIONS.length});
  }
  const cards = venusInnerCards(meta, parts);
  if (cards.length > 0) {
    rows.push({zone: 'card', first: 0, count: cards.length});
  }
  for (let first = 0; first < VENUS_SPREAD_LANES.length; first += VENUS_GRID_COLS) {
    rows.push({zone: 'lane', first, count: Math.min(VENUS_GRID_COLS, VENUS_SPREAD_LANES.length - first)});
  }
  return rows;
}

function rowOf(rows: ReadonlyArray<GridRow>, focus: VenusInnerFocus): number {
  return rows.findIndex((r) => r.zone === focus.zone && focus.index >= r.first && focus.index < r.first + r.count);
}

/** The column a cursor keeps when it changes rows — proportional, so a 2-wide row and a 3-wide one meet at both edges. */
function carryColumn(col: number, from: number, to: number): number {
  if (to <= 1) {
    return 0;
  }
  if (from <= 1) {
    return Math.min(col, to - 1);
  }
  return Math.min(to - 1, Math.round(col * (to - 1) / (from - 1)));
}

/** Is the wild answered — the option chosen, and on a card the card too? */
export function venusInnerWildAnswered(meta: VenusBonusPromptMeta, parts: VenusBonusParts): boolean {
  if (!venusInnerWildShown(meta)) {
    return true;
  }
  return parts.wild?.wild === 'asStandard' || (parts.wild?.wild === 'onCard' && parts.wild.card !== undefined);
}

/** The whole bonus answered (the composer's commit may go) — the ONE answer exists. */
export function venusInnerComplete(meta: VenusBonusPromptMeta, parts: VenusBonusParts): boolean {
  return venusPreselectResponse(meta, parts) !== undefined;
}

/** The units still to lay out on the grid. */
export function venusInnerLeft(meta: VenusBonusPromptMeta, parts: VenusBonusParts): number {
  return spreadRemaining(venusSpreadAmount(meta, parts), parts.spread ?? {});
}

/**
 * WHERE THE STEP OPENS: the first question still open — the wild's option, its card, then the grid (on the first lane
 * holding a unit, so a re-entry lands where the player left the layout).
 */
export function venusInnerOpen(meta: VenusBonusPromptMeta, parts: VenusBonusParts): VenusInnerFocus {
  if (venusInnerWildShown(meta) && parts.wild === undefined) {
    return {zone: 'wild', index: 0};
  }
  if (parts.wild?.wild === 'onCard' && parts.wild.card === undefined && venusInnerCards(meta, parts).length > 0) {
    return {zone: 'card', index: 0};
  }
  const filled = VENUS_SPREAD_LANES.findIndex((key) => (parts.spread?.[key] ?? 0) > 0);
  return {zone: 'lane', index: Math.max(0, filled)};
}

/** A cursor that still points at something (a zone that went away — the cards after «a standard resource» — falls to the grid). */
export function venusInnerClamp(meta: VenusBonusPromptMeta, parts: VenusBonusParts, focus: VenusInnerFocus): VenusInnerFocus {
  const rows = gridRows(meta, parts);
  return rowOf(rows, focus) >= 0 ? focus : {zone: 'lane', index: 0};
}

/** THE D-PAD — a 2-D walk over the grid's rows: ↑↓ change the row keeping the column, ←→ move within the row (no wrap). */
export function venusInnerNav(meta: VenusBonusPromptMeta, parts: VenusBonusParts, focus: VenusInnerFocus, dir: 'up' | 'down' | 'left' | 'right'): VenusInnerFocus {
  const rows = gridRows(meta, parts);
  const at = rowOf(rows, focus);
  if (at < 0) {
    return venusInnerClamp(meta, parts, focus);
  }
  const row = rows[at];
  const col = focus.index - row.first;
  if (dir === 'left' || dir === 'right') {
    const next = Math.max(0, Math.min(row.count - 1, col + (dir === 'left' ? -1 : 1)));
    return {zone: row.zone, index: row.first + next};
  }
  const target = rows[at + (dir === 'up' ? -1 : 1)];
  if (target === undefined) {
    return focus;
  }
  return {zone: target.zone, index: target.first + carryColumn(col, row.count, target.count)};
}

/** The spread cut down to a smaller sum (the wild moved from «a standard resource» onto a card) — the LAST lanes give way. */
export function trimVenusSpread(spread: SpreadState, amount: number): SpreadState {
  let over = spreadTotal(spread) - amount;
  if (over <= 0) {
    return spread;
  }
  const out: Record<string, number> = {...spread};
  for (const key of [...VENUS_SPREAD_LANES].reverse()) {
    const n = out[key] ?? 0;
    const cut = Math.min(n, over);
    if (cut > 0) {
      over -= cut;
      if (n - cut === 0) {
        delete out[key];
      } else {
        out[key] = n - cut;
      }
    }
  }
  return out;
}

function withWild(meta: VenusBonusPromptMeta, parts: VenusBonusParts, wild: VenusBonusParts['wild']): VenusBonusParts {
  const next: VenusBonusParts = {...parts, wild};
  return {...next, spread: trimVenusSpread(parts.spread ?? {}, venusSpreadAmount(meta, next))};
}

function firstLane(parts: VenusBonusParts): VenusInnerFocus {
  const filled = VENUS_SPREAD_LANES.findIndex((key) => (parts.spread?.[key] ?? 0) > 0);
  return {zone: 'lane', index: Math.max(0, filled)};
}

/** WHAT A PRESS DOES — pure; the host writes `parts` back and leaves the step on `exit`. */
export function venusInnerPress(meta: VenusBonusPromptMeta, parts: VenusBonusParts, focus: VenusInnerFocus, verb: VenusInnerVerb): VenusInnerResult {
  const stay = {parts, focus};
  if (verb === 'back') {
    return {...stay, exit: 'back'};
  }
  if (focus.zone === 'wild') {
    if (verb !== 'primary') {
      return stay;
    }
    if (VENUS_WILD_OPTIONS[focus.index]?.key === 'asStandard') {
      const next = withWild(meta, parts, {wild: 'asStandard'});
      return {parts: next, focus: firstLane(next)};
    }
    // ON A CARD: a sole holder is the answer, SHOWN and marked (T14 — the composer seed), never asked twice.
    const targets = venusWildTargets(meta);
    const kept = parts.wild?.wild === 'onCard' ? parts.wild.card : undefined;
    const card = kept ?? (targets.length === 1 ? targets[0] : undefined);
    const next = withWild(meta, parts, {wild: 'onCard', ...(card !== undefined ? {card} : {})});
    return {parts: next, focus: card === undefined ? {zone: 'card', index: 0} : firstLane(next)};
  }
  if (focus.zone === 'card') {
    if (verb !== 'primary') {
      return stay;
    }
    const card = venusInnerCards(meta, parts)[focus.index];
    if (card === undefined) {
      return stay;
    }
    const next = withWild(meta, parts, {wild: 'onCard', card});
    return {parts: next, focus: firstLane(next)};
  }
  const key = VENUS_SPREAD_LANES[focus.index];
  if (key === undefined) {
    return stay;
  }
  const amount = venusSpreadAmount(meta, parts);
  const spread = parts.spread ?? {};
  switch (verb) {
  case 'primary':
    if (venusInnerComplete(meta, parts)) {
      return {...stay, exit: 'confirm'};
    }
    // Not laid out yet: A places one unit HERE (the bar says so — «+1 сюда»).
    return {parts: {...parts, spread: stepSpread(spread, key, 1, amount)}, focus};
  case 'prevSection':
  case 'nextSection':
    return {parts: {...parts, spread: stepSpread(spread, key, verb === 'prevSection' ? -1 : 1, amount)}, focus};
  case 'nextTab':
    return {parts: {...parts, spread: pourRemaining(spread, key, amount)}, focus};
  default:
    return stay;
  }
}

/** The bar of the inner step — ONE reading for every host (labels are i18n keys). */
export type VenusInnerBar = {
  primary: {label: string, enabled: boolean},
  /** LB/RB on a lane: −1 / +1. */
  bumpers?: {canDecrease: boolean, canIncrease: boolean},
  /** RT on a lane: the rest here. */
  pour: boolean,
  /** Why the step cannot be confirmed yet (the first open question) — an i18n key + params, or undefined. */
  blocked?: {key: string, params: ReadonlyArray<string>},
};

export function venusInnerBlocked(meta: VenusBonusPromptMeta, parts: VenusBonusParts): VenusInnerBar['blocked'] {
  if (venusInnerWildShown(meta) && parts.wild === undefined) {
    return {key: 'Choose where the 30 % bonus goes', params: []};
  }
  if (!venusInnerWildAnswered(meta, parts)) {
    return {key: 'Choose a card for the wild resource', params: []};
  }
  const left = venusInnerLeft(meta, parts);
  return left > 0 ? {key: 'Left to place: ${0}', params: [String(left)]} : undefined;
}

export function venusInnerBar(meta: VenusBonusPromptMeta, parts: VenusBonusParts, focus: VenusInnerFocus): VenusInnerBar {
  const blocked = venusInnerBlocked(meta, parts);
  if (focus.zone === 'wild') {
    return {primary: {label: 'Choose', enabled: true}, pour: false, blocked};
  }
  if (focus.zone === 'card') {
    return {primary: {label: 'Choose', enabled: true}, pour: false, blocked};
  }
  const key = VENUS_SPREAD_LANES[focus.index] ?? '';
  const on = parts.spread?.[key] ?? 0;
  const left = venusInnerLeft(meta, parts);
  const complete = venusInnerComplete(meta, parts);
  return {
    // Laid out → A confirms and leaves; otherwise A places one unit here (refused only with nothing left to place —
    // the wild still open is the one reason then).
    primary: complete ? {label: 'Confirm', enabled: true} : {label: 'Add one here', enabled: left > 0},
    bumpers: {canDecrease: on > 0, canIncrease: left > 0},
    pour: left > 0,
    blocked,
  };
}

/** The candidates' live models, in the server's order — the card zone's faces and their «current → resulting». */
export function venusWildCardModels(cards: ReadonlyArray<CardName>, candidates: ReadonlyArray<CardModel> | undefined): Array<CardModel | undefined> {
  return cards.map((name) => candidates?.find((c) => c.name === name));
}

/** One command of the inner step's bar — the shape both composers' bars take (`FootHint` / `ConsoleCommand`). */
export type VenusInnerCommand = {control: GlyphControl, control2?: GlyphControl, label: string, enabled?: boolean};

/**
 * THE INNER STEP'S BAR — ONE list for every host: the d-pad, A (the zone's verb), on a lane LB/RB «−1 / +1» and RT «the
 * rest» (dimmed at their limits, never dropped — the bar's shape stands still while the player lays out), B back.
 */
export function venusInnerFootHints(bar: VenusInnerBar): Array<VenusInnerCommand> {
  const out: Array<VenusInnerCommand> = [
    {control: 'dpad', label: 'Navigate'},
    {control: 'confirm', label: bar.primary.label, enabled: bar.primary.enabled},
  ];
  if (bar.bumpers !== undefined) {
    out.push({control: 'bumperL', control2: 'bumperR', label: '−1 / +1', enabled: bar.bumpers.canDecrease || bar.bumpers.canIncrease});
    out.push({control: 'triggerR', label: 'The rest', enabled: bar.pour});
  }
  out.push({control: 'back', label: 'Back'});
  return out;
}
