import {CardComponent} from '@/common/cards/render/CardComponent';
import {CardRenderSymbolType} from '@/common/cards/render/CardRenderSymbolType';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {isICardRenderItem, isICardRenderSymbol, ItemType} from '@/common/cards/render/Types';
import {buildMechanics, MechGroup} from '@/client/components/premiumCard/mechanicsModel';

/*
 * THE VARIANT CHOICE — ONE grammar for every «choose one of these» in the console (TR51 Influential Discovery, the
 * owner's order of 2026-10-12: «the choice elements themselves more premium — strictly pre-select»).
 *
 * Five surfaces used to ask the same question in five dialects with three different marks for «this is my answer»
 * (the play composer's ✓, the action composer's ◉ / ○, the nested list's ✓ / ›) and a `filter` on the unavailable
 * option the console strips. This module is the pure half of the ONE replacement (`ConsoleVariantChoice.vue`):
 *
 *  · STATE → PAINT: three facts are three different things on screen — the CURSOR (where the player stands), the
 *    CHOICE (the answer given, which survives the cursor leaving) and AVAILABILITY (with its reason). A decided group
 *    lets its unchosen options RECEDE (never hide) — the answer reads before the options it excluded.
 *  · THE PRINTED ROW: an option of a card's choice carries the card's OWN printed graphic of that branch — the same
 *    render nodes the premium face draws (`buildMechanics` keeps node REFERENCES), sliced at the printed OR — never a
 *    copy. The face, the choice and the commit's impulse are one object.
 *
 * No rule lives here: availability, reasons and outcomes are the server's; this module only decides how they look.
 */

export type VariantChoiceState = {
  /** The cursor stands here (the cold ring). */
  focused: boolean;
  /** The player's answer (the seal) — survives the cursor walking away. */
  selected: boolean;
  /** The rules refuse it (shown, never hidden — with its reason). */
  off: boolean;
};

export type VariantChoiceOption = {
  key: string;
  state: VariantChoiceState;
  /** The option's own words (already translated). Empty → the printed row speaks alone. */
  title: string;
  /** Why the rules refuse it (already translated). Absent → the tile says nothing (PL-171: one loss, one voice). */
  reason?: string;
  /**
   * The option is LIVE but would change nothing right now — the server's proven «no effect» verdict, already
   * translated. The tile quiets (its print a step back) and names it in a calm line; it stays a full answer (a
   * player may take it to stall). Never on an `off` option — a refusal already says why.
   */
  quiet?: string;
  /** The card's printed graphic of THIS option (face node references) — the tile's headline. */
  printed?: ReadonlyArray<ItemType>;
  /** The option OPENS a pick of its own (a door, not an answer) — the ›. */
  door?: boolean;
  /** A player row's colour (the owner dot). */
  color?: string;
  /** The host's own data attributes on the tile (its e2e / probe hooks — `data-branch-pos`, …). */
  attrs?: Readonly<Record<string, string | undefined>>;
};

/** Is the group DECIDED — has the player given an answer? */
export function groupDecided(options: ReadonlyArray<{state: VariantChoiceState}>): boolean {
  return options.some((o) => o.state.selected);
}

/**
 * A decided group's unchosen options RECEDE — the answer reads first, the rest stay legible and reachable. The
 * cursor's own option never recedes (the player is reading it), and an unavailable one has its own paint.
 */
export function variantRecedes(state: VariantChoiceState, decided: boolean): boolean {
  return decided && !state.selected && !state.focused && !state.off;
}

/** The option tile's classes — the ONE mapping of the three facts to paint. */
export function variantOptionClasses(state: VariantChoiceState, decided: boolean): Record<string, boolean> {
  return {
    'con-vchoice__opt--focused': state.focused,
    'con-vchoice__opt--selected': state.selected,
    'con-vchoice__opt--off': state.off,
    'con-vchoice__opt--recede': variantRecedes(state, decided),
  };
}

/** A live option the server proved changes nothing — the quiet paint and its line (never on a refused one). */
export function variantQuiet(opt: {state: VariantChoiceState, quiet?: string}): boolean {
  return !opt.state.off && opt.quiet !== undefined && opt.quiet !== '';
}

function isOrNode(node: ItemType): boolean {
  return node !== undefined && node !== null && typeof node !== 'string' && isICardRenderSymbol(node) && node.type === CardRenderSymbolType.OR;
}

function isSpacer(node: ItemType): boolean {
  if (node === undefined || node === null || typeof node === 'string') {
    return true;
  }
  if (isICardRenderSymbol(node)) {
    return node.type === CardRenderSymbolType.NBSP || node.type === CardRenderSymbolType.EMPTY || node.type === CardRenderSymbolType.VSPACE;
  }
  return isICardRenderItem(node) && node.type === CardRenderItemType.NBSP;
}

function trimmed(nodes: ReadonlyArray<ItemType>): ReadonlyArray<ItemType> {
  let a = 0;
  let b = nodes.length;
  while (a < b && isSpacer(nodes[a])) {
    a++;
  }
  while (b > a && isSpacer(nodes[b - 1])) {
    b--;
  }
  return nodes.slice(a, b);
}

/** Every maximal run of groups joined by the face's «ИЛИ» divider (`orJoin`) — the alternatives drawn as separate rows. */
function orJoinedRuns(groups: ReadonlyArray<MechGroup>): Array<ReadonlyArray<MechGroup>> {
  const runs: Array<Array<MechGroup>> = [];
  let run: Array<MechGroup> = [];
  for (const group of groups) {
    if (group.orJoin === true && run.length > 0) {
      run.push(group);
      continue;
    }
    if (run.length > 1) {
      runs.push(run);
    }
    run = [group];
  }
  if (run.length > 1) {
    runs.push(run);
  }
  return runs;
}

/** A group split at its INTERIOR printed ORs («[science]* OR 6 [data]*») — the alternatives drawn on one row. */
function interiorSegments(group: MechGroup): ReadonlyArray<ReadonlyArray<ItemType>> {
  const segments: Array<Array<ItemType>> = [[]];
  for (const node of group.nodes) {
    if (isOrNode(node)) {
      segments.push([]);
      continue;
    }
    segments[segments.length - 1].push(node);
  }
  return segments.map(trimmed).filter((s) => s.length > 0);
}

/**
 * The card's PRINTED graphic of each option of its choice, in the printed order — the SAME node references the
 * premium face renders (`buildMechanics`), sliced at the printed OR. Two shapes the face knows: alternatives drawn as
 * separate rows joined by the «ИЛИ» divider (an action's two variants), and alternatives drawn on ONE row around an
 * interior OR (a play's «2 [animal]* OR 4 [microbe]*»). The slice is taken only when it is UNAMBIGUOUS — exactly one
 * candidate with exactly `count` alternatives; anything else answers `undefined` and the options speak in words.
 */
export function printedVariantRows(renderData: CardComponent | undefined, count: number): ReadonlyArray<ReadonlyArray<ItemType>> | undefined {
  if (count < 2) {
    return undefined;
  }
  const vm = buildMechanics(renderData);
  const candidates: Array<ReadonlyArray<ReadonlyArray<ItemType>>> = [];
  for (const run of orJoinedRuns(vm.groups)) {
    if (run.length === count) {
      candidates.push(run.map((g) => trimmed(g.nodes)));
    }
  }
  for (const group of vm.groups) {
    const segments = interiorSegments(group);
    if (segments.length === count && segments.length > 1) {
      candidates.push(segments);
    }
  }
  return candidates.length === 1 ? candidates[0] : undefined;
}

/**
 * Does an option DRAW a card when chosen? The ONE reading lives with the rule that needs it
 * (`common/models/tableQuestionDeferral.ts` — a discard behind a draw may wait for it); re-exported for the readers here.
 */
export {optionDraws} from '@/common/models/tableQuestionDeferral';
