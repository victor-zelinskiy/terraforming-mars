/*
 * MECHANICS MODEL — the pure normalization layer between a card's
 * `metadata.renderData` (the shared render DSL) and the premium mechanics
 * panel.
 *
 * What it does:
 *  - walks the DSL via the common type guards (never by class names / text),
 *  - DROPS plain-string description rows (the premium face is icons-only —
 *    prose lives in overlays / the future fullscreen text panel),
 *  - groups the remaining nodes row-by-row and classifies each group
 *    (plain / effect / action / production / corp box),
 *  - computes a DENSITY tier from analytic node weights — this is what lets
 *    the art viewport shrink predictably (4 CSS presets, no JS measuring).
 *
 * Nodes are kept as REFERENCES to the original DSL objects (no copies) so
 * the model can never drift from the manifest.
 */

import {CardComponent} from '@/common/cards/render/CardComponent';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {CardRenderSymbolType} from '@/common/cards/render/CardRenderSymbolType';
import {
  ItemType,
  ICardRenderEffect,
  ICardRenderSymbol,
  isICardRenderCorpBoxAction,
  isICardRenderCorpBoxEffect,
  isICardRenderCorpBoxEffectAction,
  isICardRenderEffect,
  isICardRenderItem,
  isICardRenderProductionBox,
  isICardRenderRoot,
  isICardRenderSymbol,
  isICardRenderTile,
} from '@/common/cards/render/Types';

export type MechGroupKind = 'plain' | 'effect' | 'action' | 'production' | 'corp-effect' | 'corp-action';
export type MechDensity = 'sparse' | 'normal' | 'dense' | 'veryDense';

export type MechGroup = {
  kind: MechGroupKind;
  /** References into the original renderData tree (strings/undefined already dropped). */
  nodes: ReadonlyArray<ItemType>;
  weight: number;
};

export type MechanicsVM = {
  groups: ReadonlyArray<MechGroup>;
  density: MechDensity;
  score: number;
  /** True when the card's mechanics could not be extracted as graphics (prose-only render). */
  textOnly: boolean;
};

/** The cause / delimiter / result triple of an effect node (the DSL's 3-row invariant). */
export type EffectParts = {
  cause: ReadonlyArray<ItemType>;
  delimiter: ICardRenderSymbol | undefined;
  result: ReadonlyArray<ItemType>;
};

function isRenderableNode(node: ItemType): node is CardComponent {
  return node !== undefined && typeof node !== 'string';
}

/** Strip strings (descriptions) and undefined from a row, keeping node references. */
export function renderableNodes(row: ReadonlyArray<ItemType>): Array<ItemType> {
  return row.filter(isRenderableNode);
}

export function effectParts(node: ICardRenderEffect): EffectParts {
  const rows = node.rows;
  const delimiterRow = rows.length > 1 ? rows[1] : [];
  const delimiter = delimiterRow.find(isICardRenderSymbol);
  return {
    cause: renderableNodes(rows[0] ?? []),
    delimiter,
    result: renderableNodes(rows[2] ?? []),
  };
}

/** Whether an effect node draws as an ACTION (arrow delimiter) or a passive EFFECT (colon). */
export function effectKindOf(node: ICardRenderEffect): 'effect' | 'action' {
  const {delimiter} = effectParts(node);
  return delimiter?.type === CardRenderSymbolType.ARROW ? 'action' : 'effect';
}

/** How many icon instances an item draws (mirrors the legacy digit heuristic). */
export function itemRepeats(item: {amount: number, showDigit?: true, amountInside?: true}): number {
  if (item.showDigit === true || item.amountInside === true) {
    return 1;
  }
  const n = Math.abs(item.amount);
  if (n === 0 || Number.isNaN(n)) {
    return 1;
  }
  return n > 5 ? 1 : n; // >5 auto-renders as digit + one icon.
}

function nodeWeight(node: ItemType): number {
  if (!isRenderableNode(node)) {
    return 0;
  }
  if (isICardRenderItem(node)) {
    if (node.type === CardRenderItemType.NBSP) {
      return 0;
    }
    if (node.type === CardRenderItemType.TEXT || node.type === CardRenderItemType.PLATE) {
      return 1.2;
    }
    return 0.9 + 0.55 * (itemRepeats(node) - 1);
  }
  if (isICardRenderSymbol(node)) {
    return 0.35;
  }
  if (isICardRenderTile(node)) {
    return 1.6;
  }
  if (isICardRenderProductionBox(node)) {
    return 1.2 + sumRows(node.rows);
  }
  if (isICardRenderEffect(node)) {
    const {cause, result} = effectParts(node);
    return Math.max(3, 1.8 + sumNodes(cause) + sumNodes(result));
  }
  if (isICardRenderCorpBoxEffect(node) || isICardRenderCorpBoxAction(node) || isICardRenderCorpBoxEffectAction(node)) {
    return 1.5 + sumRows(node.rows);
  }
  return 1;
}

function sumNodes(nodes: ReadonlyArray<ItemType>): number {
  return nodes.reduce((acc, n) => acc + nodeWeight(n), 0);
}

function sumRows(rows: ReadonlyArray<ReadonlyArray<ItemType>>): number {
  return rows.reduce((acc, row) => acc + sumNodes(row), 0);
}

function groupKindOf(nodes: ReadonlyArray<ItemType>): MechGroupKind {
  for (const node of nodes) {
    if (isICardRenderEffect(node)) {
      return effectKindOf(node);
    }
    if (isICardRenderCorpBoxEffect(node)) {
      return 'corp-effect';
    }
    if (isICardRenderCorpBoxAction(node) || isICardRenderCorpBoxEffectAction(node)) {
      return 'corp-action';
    }
  }
  if (nodes.length === 1 && isICardRenderProductionBox(nodes[0])) {
    return 'production';
  }
  return 'plain';
}

const DENSITY_ORDER: ReadonlyArray<MechDensity> = ['sparse', 'normal', 'dense', 'veryDense'];

function densityOf(groupCount: number, score: number): MechDensity {
  if (groupCount <= 1 && score <= 4) {
    return 'sparse';
  }
  if (groupCount <= 2 && score <= 9) {
    return 'normal';
  }
  if (groupCount <= 3 && score <= 15) {
    return 'dense';
  }
  return 'veryDense';
}

export function densityAtLeast(density: MechDensity, threshold: MechDensity): boolean {
  return DENSITY_ORDER.indexOf(density) >= DENSITY_ORDER.indexOf(threshold);
}

export function buildMechanics(renderData: CardComponent | undefined): MechanicsVM {
  if (renderData === undefined || !isICardRenderRoot(renderData)) {
    return {groups: [], density: 'sparse', score: 0, textOnly: true};
  }
  const groups: Array<MechGroup> = [];
  for (const row of renderData.rows) {
    const nodes = renderableNodes(row);
    if (nodes.length === 0) {
      continue; // a description-only / spacer row
    }
    groups.push({
      kind: groupKindOf(nodes),
      nodes,
      weight: sumNodes(nodes),
    });
  }
  const score = groups.reduce((acc, g) => acc + g.weight, 0);
  return {
    groups,
    density: densityOf(groups.length, score),
    score,
    textOnly: groups.length === 0,
  };
}
