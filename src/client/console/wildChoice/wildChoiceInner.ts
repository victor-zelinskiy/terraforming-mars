/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE WILD-RESOURCE CHOICE — ONE inner step for every «a standard resource OR a resource on a card» (P43 · ledger EO —
 * the owner, 2026-11-02: «по механике это похоже на бонус последней шкалы Венеры — у нас уже есть pre-select для него с
 * таким OR-выбором: переиспользовать и ВЫНЕСТИ В ОБЩИЙ КОМПОНЕНТ»). Extracted from the Venus bonus's inner pre-select
 * (P89 · EM, `venusBonusInner.ts` — now its adapter); the PURE half: the zones, the 2-D cursor, what every verb does and
 * what the bar says. Two hosts, one grammar:
 *  · the VENUS bonus (`exclusive: false`) — a BASE of standard resources always laid out on the grid, the 30 % wild an
 *    OR above it (shown only where it is really taken), «on a card» a slot of candidates, «a standard resource» +1 on
 *    the same grid; the grid a DIAL (LB/RB one unit, RT the rest);
 *  · P43 Applied Science's action (`exclusive: true`) — the OR IS the whole question (the branch); under it ONE slot
 *    whose two faces never coexist: «on a card» → the candidates, «a standard resource» → the 2 × 3 grid as a RADIO
 *    (budget 1: A chooses and leaves — no dial, no pills, no «Осталось»). Nothing is «always» there.
 *
 * Zones, top to bottom — each a ROW of the cursor's grid:
 *  · `wild` — the OR: «on a card» | «a standard resource» (a plate the rules refuse stays, with its reason);
 *  · `card` — the candidates (only while the wild goes onto a card);
 *  · `lane` — the six standard resources, a FIXED grid of 2 rows × 3 (`WILD_GRID_COLS`), never reflowing.
 * A is the zone's verb, B leaves the step with the draft kept (a pre-select — nothing was sent).
 *
 * «ON A CARD» MAY BE A LEVEL OF ITS OWN (`nestedPick` — the owner, 2026-11-03, the Venus 30 % finish with thirteen
 * holders: «места для карт нет и они идут в один ряд … класть на карту делать ЕЩЁ ОДНИМ вложенным шагом, иначе мы
 * не можем отдать достаточно свободного места для выбора»). The `card` zone is then ONE door row (the chosen card, or
 * «choose a card»); A on it — or choosing «on a card» with no card yet — enters `pick`: the step gives the WHOLE column
 * to the console's target selector (pages, the outcome tags, X with the dossier). The selector's cursor and its
 * geometry are the HOST's (a pure model has no boxes); this model only says where the cursor stands and what A / B do:
 * A with the selector's focused card answers it and returns to the grid, B is one level back — to the door.
 */
import {CardName} from '@/common/cards/CardName';
import {GlyphControl} from '@/client/gamepad/glyphSets';
import {SpreadState, pourRemaining, spreadComplete, spreadRemaining, spreadTotal, stepSpread} from '@/client/console/cardResourceDistribution';
import {STANDARD_UNITS} from '@/client/console/taskResponses';

/** The resource grid: 2 rows × 3 columns, in the server's lane order (M€ · steel · titanium / plants · energy · heat). */
export const WILD_GRID_COLS = 3;
export const WILD_LANES: ReadonlyArray<string> = STANDARD_UNITS;

export type WildKind = 'onCard' | 'asStandard';
export type WildZone = 'wild' | 'card' | 'lane' | 'pick';
export type WildFocus = {zone: WildZone, index: number};
export type WildVerb = 'primary' | 'back' | 'prevSection' | 'nextSection' | 'nextTab';

/** The draft: the OR's answer (with its card) and the standard resources laid out. */
export type WildParts = {
  wild?: {wild: WildKind, card?: CardName},
  spread?: SpreadState,
};

export type WildResult = {parts: WildParts, focus: WildFocus, exit?: 'confirm' | 'back'};

/** The two options of the OR, in the server's order for both hosts' plates (on a card · a standard resource). */
export const WILD_OPTIONS: ReadonlyArray<{key: WildKind, title: string, desc: string}> = [
  {key: 'onCard', title: 'Put it on a card', desc: 'A resource of the card’s own kind'},
  {key: 'asStandard', title: 'One more standard resource', desc: 'Lay it out with the others'},
];

/**
 * WHAT ONE HOST ASKS — the specification the one component and the one model read.
 *  · `or` — the OR is asked (absent: the wild is not a question here); `onCardOff` names why «on a card» is refused
 *    (shown disabled with the reason, never hidden — invariant 2);
 *  · `holders` — the candidates of «on a card», in the server's order;
 *  · `amount(wild)` — the standard resources to lay out for an answer of the OR (0 = no grid owed) — a FUNCTION, so a
 *    host may hand in a budget that MOVES (P49: the branch's amount dial — «+X» on every lane, re-read on every turn);
 *  · `exclusive` — the grid belongs to «a standard resource» ALONE (P43); otherwise the grid is always there (Venus);
 *  · `lanes` — `dial` (LB/RB/RT, A «+1 сюда» then «Подтвердить») or `radio` (budget 1: A chooses and leaves);
 *  · `mode` — `gain` (the default: a lane reads `stock → stock + N`) or `spend` (P50 · FC — «spend 1 standard resource»:
 *    a lane reads `stock → stock − N`); a SPEND is never a dial — the owner, 2026-11-03: «тут только 1 ресурс, так что
 *    без LB/RB, просто селект»;
 *  · `laneOff(lane)` — why a lane cannot be chosen (a spend from an empty supply — «нет растений»): the lane STAYS on the
 *    grid, dimmed with its reason (invariant 2 — never hidden), the cursor steps over it and A refuses it.
 */
export type WildChoiceSpec = {
  or?: {onCardOff?: string},
  holders: ReadonlyArray<CardName>,
  amount: (wild: WildKind | undefined) => number,
  exclusive: boolean,
  lanes: 'dial' | 'radio',
  /** «On a card» is a NESTED level (`pick`) behind ONE door row — never a strip of every holder (see the header). */
  nestedPick?: boolean,
  mode?: 'gain' | 'spend',
  laneOff?: (lane: string) => string | undefined,
};

/** Why `lane` cannot be chosen (undefined: it can). */
export function wildLaneOff(spec: WildChoiceSpec, lane: string | undefined): string | undefined {
  return lane === undefined ? undefined : spec.laneOff?.(lane);
}

/** May the lane at `index` take the cursor and the press? */
function laneLive(spec: WildChoiceSpec, index: number): boolean {
  return WILD_LANES[index] !== undefined && wildLaneOff(spec, WILD_LANES[index]) === undefined;
}

/** Is the OR asked here? */
export function wildShown(spec: WildChoiceSpec): boolean {
  return spec.or !== undefined;
}

/** May the plate `key` be chosen (a refused «on a card» stays on screen, unchosen)? */
export function wildOptionLive(spec: WildChoiceSpec, key: WildKind): boolean {
  return key !== 'onCard' || (spec.or?.onCardOff === undefined && spec.holders.length > 0);
}

/** The candidates of «on a card» — shown only while the wild goes onto a card. */
export function wildCards(spec: WildChoiceSpec, parts: WildParts): ReadonlyArray<CardName> {
  return wildShown(spec) && parts.wild?.wild === 'onCard' ? spec.holders : [];
}

/** The standard resources the current answer owes on the grid. */
export function wildAmount(spec: WildChoiceSpec, parts: WildParts): number {
  return spec.amount(parts.wild?.wild);
}

/**
 * Is the grid part of the step right now? Venus: always; P43: only once the wild is «a standard resource»; an exclusive
 * step whose OR is NOT asked (P49 — the dial's resource: the branch already chose «a standard resource») — always.
 */
export function wildLanesShown(spec: WildChoiceSpec, parts: WildParts): boolean {
  return spec.exclusive && wildShown(spec) ? parts.wild?.wild === 'asStandard' : true;
}

type GridRow = {zone: WildZone, first: number, count: number};

function gridRows(spec: WildChoiceSpec, parts: WildParts): Array<GridRow> {
  const rows: Array<GridRow> = [];
  if (wildShown(spec)) {
    rows.push({zone: 'wild', first: 0, count: WILD_OPTIONS.length});
  }
  const cards = wildCards(spec, parts);
  if (cards.length > 0) {
    // A nested pick stands behind ONE door — the row the cursor walks is that door, never the holders.
    rows.push({zone: 'card', first: 0, count: spec.nestedPick === true ? 1 : cards.length});
  }
  if (wildLanesShown(spec, parts)) {
    for (let first = 0; first < WILD_LANES.length; first += WILD_GRID_COLS) {
      rows.push({zone: 'lane', first, count: Math.min(WILD_GRID_COLS, WILD_LANES.length - first)});
    }
  }
  return rows;
}

function rowOf(rows: ReadonlyArray<GridRow>, focus: WildFocus): number {
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

/** Is the OR answered — the option chosen, and on a card the card too? */
export function wildAnswered(spec: WildChoiceSpec, parts: WildParts): boolean {
  if (!wildShown(spec)) {
    return true;
  }
  return parts.wild?.wild === 'asStandard' || (parts.wild?.wild === 'onCard' && parts.wild.card !== undefined);
}

/** The whole step answered — the OR (with its card) and the grid laid out exactly. */
export function wildComplete(spec: WildChoiceSpec, parts: WildParts): boolean {
  return wildAnswered(spec, parts) && (!wildLanesShown(spec, parts) || spreadComplete(wildAmount(spec, parts), parts.spread ?? {}));
}

/** The units still to lay out on the grid. */
export function wildLeft(spec: WildChoiceSpec, parts: WildParts): number {
  return wildLanesShown(spec, parts) ? spreadRemaining(wildAmount(spec, parts), parts.spread ?? {}) : 0;
}

function firstLane(parts: WildParts, spec?: WildChoiceSpec): WildFocus {
  const filled = WILD_LANES.findIndex((key) => (parts.spread?.[key] ?? 0) > 0);
  if (filled >= 0) {
    return {zone: 'lane', index: filled};
  }
  // A lane refused with its reason never takes the cursor first (a spend opens on the first resource the player holds).
  const live = spec === undefined ? 0 : WILD_LANES.findIndex((_, i) => laneLive(spec, i));
  return {zone: 'lane', index: Math.max(0, live)};
}

/** The first live plate — a refused «on a card» never takes the cursor first. */
function firstLivePlate(spec: WildChoiceSpec, parts: WildParts): number {
  const chosen = WILD_OPTIONS.findIndex((o) => o.key === parts.wild?.wild);
  if (chosen >= 0) {
    return chosen;
  }
  const live = WILD_OPTIONS.findIndex((o) => wildOptionLive(spec, o.key));
  return Math.max(0, live);
}

/**
 * WHERE THE STEP OPENS: the first question still open — the OR, its card, then the grid (on the first lane holding a
 * unit, so a re-entry lands where the player left the layout). An answered exclusive step re-opens on its answer.
 */
export function wildOpen(spec: WildChoiceSpec, parts: WildParts): WildFocus {
  if (wildShown(spec) && parts.wild === undefined) {
    return {zone: 'wild', index: firstLivePlate(spec, parts)};
  }
  if (parts.wild?.wild === 'onCard') {
    const cards = wildCards(spec, parts);
    const at = parts.wild.card === undefined ? 0 : Math.max(0, cards.indexOf(parts.wild.card));
    if (spec.exclusive || parts.wild.card === undefined) {
      return cards.length > 0 ? {zone: 'card', index: at} : {zone: 'wild', index: 0};
    }
  }
  if (!wildLanesShown(spec, parts)) {
    return {zone: 'wild', index: firstLivePlate(spec, parts)};
  }
  return firstLane(parts, spec);
}

/** A cursor that still points at something (a zone that went away falls to the first row standing). */
export function wildClamp(spec: WildChoiceSpec, parts: WildParts, focus: WildFocus): WildFocus {
  if (focus.zone === 'pick') {
    return wildCards(spec, parts).length > 0 ? focus : {zone: 'wild', index: 0};
  }
  const rows = gridRows(spec, parts);
  if (rowOf(rows, focus) >= 0) {
    return focus;
  }
  const lane = rows.find((r) => r.zone === 'lane');
  return lane !== undefined ? {zone: 'lane', index: 0} : {zone: rows[0]?.zone ?? 'wild', index: 0};
}

/** THE D-PAD — a 2-D walk over the grid's rows: ↑↓ change the row keeping the column, ←→ move within the row (no wrap). */
export function wildNav(spec: WildChoiceSpec, parts: WildParts, focus: WildFocus, dir: 'up' | 'down' | 'left' | 'right'): WildFocus {
  if (focus.zone === 'pick') {
    return focus; // the selector walks its own boxes — the host's
  }
  const rows = gridRows(spec, parts);
  const at = rowOf(rows, focus);
  if (at < 0) {
    return wildClamp(spec, parts, focus);
  }
  const row = rows[at];
  const col = focus.index - row.first;
  // A lane refused with its reason (a spend from an empty supply) is STEPPED OVER — never a stop of the cursor.
  const live = (r: GridRow, c: number) => r.zone !== 'lane' || laneLive(spec, r.first + c);
  if (dir === 'left' || dir === 'right') {
    const step = dir === 'left' ? -1 : 1;
    for (let c = col + step; c >= 0 && c < row.count; c += step) {
      if (live(row, c)) {
        return {zone: row.zone, index: row.first + c};
      }
    }
    return focus; // the edge (or only refused lanes beyond it) HOLDS — never a wrap
  }
  for (let r = at + (dir === 'up' ? -1 : 1); r >= 0 && r < rows.length; r += dir === 'up' ? -1 : 1) {
    const target = rows[r];
    const carried = carryColumn(col, row.count, target.count);
    if (live(target, carried)) {
      return {zone: target.zone, index: target.first + carried};
    }
    // The carried column is refused: the nearest live column of that row, else the row is skipped.
    for (let d = 1; d < target.count; d++) {
      for (const c of [carried - d, carried + d]) {
        if (c >= 0 && c < target.count && live(target, c)) {
          return {zone: target.zone, index: target.first + c};
        }
      }
    }
  }
  return focus;
}

/** The spread cut down to a smaller sum (the wild moved from «a standard resource» onto a card) — the LAST lanes give way. */
export function trimWildSpread(spread: SpreadState, amount: number): SpreadState {
  let over = spreadTotal(spread) - amount;
  if (over <= 0) {
    return spread;
  }
  const out: Record<string, number> = {...spread};
  for (const key of [...WILD_LANES].reverse()) {
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

function withWild(spec: WildChoiceSpec, parts: WildParts, wild: WildParts['wild']): WildParts {
  const next: WildParts = {...parts, wild};
  // An exclusive «on a card» owes no grid: its layout is dropped, never kept as a hidden half-answer.
  const amount = spec.exclusive && wild?.wild === 'onCard' ? 0 : spec.amount(wild?.wild);
  return {...next, spread: trimWildSpread(parts.spread ?? {}, amount)};
}

/** The nested pick's own level (`pick`) — entered from the door or from choosing «on a card» with no card yet. */
const PICK: WildFocus = {zone: 'pick', index: 0};

/**
 * WHAT A PRESS DOES — pure; the host writes `parts` back and leaves the step on `exit`. In the nested pick (`pick`)
 * the host hands in the selector's focused, choosable card as `picked` (undefined: A answers nothing).
 */
export function wildPress(spec: WildChoiceSpec, parts: WildParts, focus: WildFocus, verb: WildVerb, picked?: CardName): WildResult {
  const stay = {parts, focus};
  if (focus.zone === 'pick') {
    if (verb === 'back') {
      return {parts, focus: {zone: 'card', index: 0}}; // ONE level back — to the door, the draft kept
    }
    if (verb !== 'primary' || picked === undefined || !spec.holders.includes(picked)) {
      return stay;
    }
    const next = withWild(spec, parts, {wild: 'onCard', card: picked});
    return {parts: next, focus: firstLane(next, spec)};
  }
  if (verb === 'back') {
    return {...stay, exit: 'back'};
  }
  if (focus.zone === 'wild') {
    const key = WILD_OPTIONS[focus.index]?.key;
    if (verb !== 'primary' || key === undefined || !wildOptionLive(spec, key)) {
      return stay;
    }
    if (key === 'asStandard') {
      const next = withWild(spec, parts, {wild: 'asStandard'});
      return {parts: next, focus: firstLane(next, spec)};
    }
    // ON A CARD: a sole holder is SEEDED — shown and marked (T14 — the composer seed), never applied silently: the
    // cursor stands on it in the slot and the answer is confirmed by the player's own A there (exclusive) or rides
    // into the grid below (Venus, where the grid is the rest of the question).
    const kept = parts.wild?.wild === 'onCard' ? parts.wild.card : undefined;
    const card = kept ?? (spec.holders.length === 1 ? spec.holders[0] : undefined);
    const next = withWild(spec, parts, {wild: 'onCard', ...(card !== undefined ? {card} : {})});
    if (spec.nestedPick === true && card === undefined) {
      return {parts: next, focus: PICK};
    }
    if (spec.exclusive || card === undefined) {
      const at = card === undefined ? 0 : Math.max(0, spec.holders.indexOf(card));
      return {parts: next, focus: {zone: 'card', index: at}};
    }
    return {parts: next, focus: firstLane(next, spec)};
  }
  if (focus.zone === 'card') {
    if (verb !== 'primary') {
      return stay;
    }
    if (spec.nestedPick === true) {
      return wildCards(spec, parts).length > 0 ? {parts, focus: PICK} : stay;
    }
    const card = wildCards(spec, parts)[focus.index];
    if (card === undefined) {
      return stay;
    }
    const next = withWild(spec, parts, {wild: 'onCard', card});
    // Exclusive: the card IS the whole answer — A chooses and leaves.
    if (spec.exclusive) {
      return {parts: next, focus, exit: 'confirm'};
    }
    return {parts: next, focus: firstLane(next, spec)};
  }
  const key = WILD_LANES[focus.index];
  if (key === undefined || wildLaneOff(spec, key) !== undefined) {
    return stay; // a refused lane takes no answer (its reason is on it)
  }
  const amount = wildAmount(spec, parts);
  const spread = parts.spread ?? {};
  if (spec.lanes === 'radio') {
    // A RADIO (budget 1): A chooses this resource for the whole budget and leaves; the bumpers say nothing here.
    if (verb !== 'primary' || amount <= 0) {
      return stay;
    }
    return {parts: {...parts, spread: {[key]: amount}}, focus, exit: 'confirm'};
  }
  switch (verb) {
  case 'primary':
    if (wildComplete(spec, parts)) {
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
export type WildBar = {
  primary: {label: string, enabled: boolean},
  /** LB/RB on a dial lane: −1 / +1. */
  bumpers?: {canDecrease: boolean, canIncrease: boolean},
  /** RT on a dial lane: the rest here. */
  pour: boolean,
  /** Why the step cannot be confirmed yet (the first open question) — an i18n key + params, or undefined. */
  blocked?: {key: string, params: ReadonlyArray<string>},
  /** X inspects the focused candidate (the nested pick — the target dossier). */
  inspect?: boolean,
};

export function wildBlocked(spec: WildChoiceSpec, parts: WildParts, keys: {chooseWild: string, chooseCard: string}): WildBar['blocked'] {
  if (wildShown(spec) && parts.wild === undefined) {
    return {key: keys.chooseWild, params: []};
  }
  if (!wildAnswered(spec, parts)) {
    return {key: keys.chooseCard, params: []};
  }
  const left = wildLeft(spec, parts);
  return left > 0 ? {key: 'Left to place: ${0}', params: [String(left)]} : undefined;
}

export function wildBar(spec: WildChoiceSpec, parts: WildParts, focus: WildFocus, keys: {chooseWild: string, chooseCard: string}): WildBar {
  const blocked = wildBlocked(spec, parts, keys);
  if (focus.zone === 'wild') {
    const key = WILD_OPTIONS[focus.index]?.key;
    return {primary: {label: 'Choose', enabled: key !== undefined && wildOptionLive(spec, key)}, pour: false, blocked};
  }
  if (focus.zone === 'pick') {
    return {primary: {label: 'Choose', enabled: true}, pour: false, blocked, inspect: true};
  }
  if (focus.zone === 'card') {
    return {primary: {label: spec.nestedPick === true && parts.wild?.card !== undefined ? 'Change the card' : 'Choose', enabled: true}, pour: false, blocked};
  }
  if (spec.lanes === 'radio') {
    const off = wildLaneOff(spec, WILD_LANES[focus.index]) !== undefined;
    return {primary: {label: 'Choose', enabled: wildAmount(spec, parts) > 0 && !off}, pour: false, blocked};
  }
  const key = WILD_LANES[focus.index] ?? '';
  const on = parts.spread?.[key] ?? 0;
  const left = wildLeft(spec, parts);
  const complete = wildComplete(spec, parts);
  return {
    // Laid out → A confirms and leaves; otherwise A places one unit here (refused only with nothing left to place —
    // the wild still open is the one reason then).
    primary: complete ? {label: 'Confirm', enabled: true} : {label: 'Add one here', enabled: left > 0},
    bumpers: {canDecrease: on > 0, canIncrease: left > 0},
    pour: left > 0,
    blocked,
  };
}

/** One command of the inner step's bar — the shape both composers' bars take (`FootHint` / `ConsoleCommand`). */
export type WildCommand = {control: GlyphControl, control2?: GlyphControl, label: string, enabled?: boolean};

/**
 * THE INNER STEP'S BAR — ONE list for every host: the d-pad, A (the zone's verb), on a dial lane LB/RB «−1 / +1» and RT
 * «the rest» (dimmed at their limits, never dropped — the bar's shape stands still while the player lays out), B back.
 */
export function wildFootHints(bar: WildBar): Array<WildCommand> {
  const out: Array<WildCommand> = [
    {control: 'dpad', label: 'Navigate'},
    {control: 'confirm', label: bar.primary.label, enabled: bar.primary.enabled},
  ];
  if (bar.inspect === true) {
    out.push({control: 'secondary', label: 'Inspect'});
  }
  if (bar.bumpers !== undefined) {
    out.push({control: 'bumperL', control2: 'bumperR', label: '−1 / +1', enabled: bar.bumpers.canDecrease || bar.bumpers.canIncrease});
    out.push({control: 'triggerR', label: 'The rest', enabled: bar.pour});
  }
  out.push({control: 'back', label: 'Back'});
  return out;
}
