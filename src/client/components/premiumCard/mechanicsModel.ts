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
import {Size} from '@/common/cards/render/Size';
import {deriveGraphicIds} from '@/common/cards/render/cardGraphicIds';
import {
  ItemType,
  ICardRenderCorpBoxAction,
  ICardRenderCorpBoxEffect,
  ICardRenderCorpBoxEffectAction,
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
  /**
   * Stable content-derived id of this group's ROOT ROW — the address the
   * card-information model's blocks link to (`CardInfoBlock.graphicId`).
   * Shared derivation with the build-time generator (cardGraphicIds.ts),
   * so the mapping can never disagree.
   */
  graphicId?: string;
  /**
   * This group is an ALTERNATIVE to the previous one — the panel renders
   * the premium «ИЛИ» divider before it instead of the plain hairline.
   * Set from an explicit OR-only DSL row (normalized away), or inserted
   * STRUCTURALLY between consecutive action groups with no drawn OR (a
   * card has exactly ONE activatable action — 2+ action rows ARE a
   * choice; losing the marker would misread as "do both").
   */
  orJoin?: boolean;
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

/* ── OR-marker classification (see buildMechanics) ──────────────────── */

function isSpacerNode(node: ItemType): boolean {
  if (node === undefined || typeof node === 'string') {
    return true;
  }
  if (isICardRenderSymbol(node)) {
    return node.type === CardRenderSymbolType.NBSP || node.type === CardRenderSymbolType.EMPTY || node.type === CardRenderSymbolType.VSPACE;
  }
  return isICardRenderItem(node) && node.type === CardRenderItemType.NBSP;
}

function isOrNode(node: ItemType): boolean {
  return node !== undefined && typeof node !== 'string' && isICardRenderSymbol(node) && node.type === CardRenderSymbolType.OR;
}

/** Index of the last non-spacer node, or -1. */
function lastMeaningful(nodes: ReadonlyArray<ItemType>): number {
  for (let i = nodes.length - 1; i >= 0; i--) {
    if (!isSpacerNode(nodes[i])) {
      return i;
    }
  }
  return -1;
}

/** Drop a TRAILING connector OR (+ its spacers) — it renders as the group divider. */
function dropTrailingOr(nodes: ReadonlyArray<ItemType>): Array<ItemType> {
  const j = lastMeaningful(nodes);
  return (j >= 0 && isOrNode(nodes[j])) ? nodes.slice(0, j) : [...nodes];
}

/**
 * An effect node whose CAUSE row draws NOTHING (`eb.empty().startEffect`) — the
 * idiom where the trigger is drawn as a standalone ROOT row before the effect
 * box (Viral Enhancers: `b.tag(PLANT).slash().tag(MICROBE).slash().tag(ANIMAL).br;
 * b.effect(eb => eb.empty().startEffect…)`). Spacer/empty symbols don't count.
 */
function emptyCauseEffect(nodes: ReadonlyArray<ItemType>): ICardRenderEffect | undefined {
  for (const node of nodes) {
    if (node !== undefined && typeof node !== 'string' && isICardRenderEffect(node) &&
        renderableNodes(node.rows[0] ?? []).every(isSpacerNode)) {
      return node;
    }
  }
  return undefined;
}

export function effectParts(node: ICardRenderEffect): EffectParts {
  const rows = node.rows;
  const delimiterRow = rows.length > 1 ? rows[1] : [];
  const delimiter = delimiterRow.find(isICardRenderSymbol);
  return {
    cause: renderableNodes(rows[0] ?? []),
    delimiter,
    // A trailing OR inside the result is a CONNECTOR to the next action row
    // (drawn as the «ИЛИ» divider), never an inline glyph.
    result: dropTrailingOr(renderableNodes(rows[2] ?? [])),
  };
}

/** Does this group's LAST node draw a trailing OR inside its effect frame? */
function effectFrameTrailingOr(nodes: ReadonlyArray<ItemType>): boolean {
  const j = lastMeaningful(nodes);
  const node = j >= 0 ? nodes[j] : undefined;
  if (node === undefined || typeof node === 'string' || !isICardRenderEffect(node)) {
    return false;
  }
  const result = renderableNodes(node.rows[2] ?? []);
  const k = lastMeaningful(result);
  return k >= 0 && isOrNode(result[k]);
}

type OrEdges = {nodes: Array<ItemType>, leadingOr: boolean, trailingOr: boolean};

/**
 * Split a group's EDGE connector ORs (leading / trailing — at the root OR
 * inside a trailing effect frame) from its inline content. An edge OR joins
 * two alternative groups and becomes the «ИЛИ» divider; an INTERIOR OR
 * (between two content items in one row) stays inline.
 */
function orEdges(rawNodes: ReadonlyArray<ItemType>): OrEdges {
  let nodes = [...rawNodes];
  let leadingOr = false;
  let trailingOr = false;

  // leading connector OR (root level)
  let i = 0;
  while (i < nodes.length && isSpacerNode(nodes[i])) {
    i++;
  }
  if (i < nodes.length && isOrNode(nodes[i])) {
    leadingOr = true;
    nodes = nodes.slice(i + 1);
  }
  // trailing connector OR (root level)
  const j = lastMeaningful(nodes);
  if (j >= 0 && isOrNode(nodes[j])) {
    trailingOr = true;
    nodes = nodes.slice(0, j);
  } else if (effectFrameTrailingOr(nodes)) {
    // trailing OR lives inside the effect frame — effectParts strips it from
    // the RENDER; here it only signals the join.
    trailingOr = true;
  }
  return {nodes, leadingOr, trailingOr};
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

type CorpBoxNode = ICardRenderCorpBoxEffect | ICardRenderCorpBoxAction | ICardRenderCorpBoxEffectAction;

function isCorpBoxNode(node: ItemType): node is CorpBoxNode {
  return node !== undefined && typeof node !== 'string' &&
    (isICardRenderCorpBoxEffect(node) || isICardRenderCorpBoxAction(node) || isICardRenderCorpBoxEffectAction(node));
}

/**
 * CORPORATION BOX FLATTENING — the legacy corp box (`b.corpBox('effect'|
 * 'action'|'effect-action', …)`) is pure legacy-face CHROME (a framed zone
 * with an "effect"/"action" caption). On the premium face its content becomes
 * ordinary root rows: each effect/action frame inside gets its OWN engraved
 * group (arrow vs colon classification, «ИЛИ» joins, prose dropping — the
 * same pipeline as project cards). The corp builders chain several frames
 * into ONE row (`ce.action(…); ce.effect(…)` with no `br` — StormCraft), so
 * a corp-box row is additionally SPLIT at every effect frame; the loose
 * nodes between frames (vSpace runs, connector ORs) keep their own row and
 * resolve through the normal spacer / or-only handling. Expanded rows carry
 * NO rowIndex (corp cards are outside the card-information scope) and a
 * `fromCorpBox` marker — the Viral-Enhancers trigger splice must never fire
 * for them (`startEffect`/`startAction` inside a corp box is a genuinely
 * empty cause, NOT a trigger drawn on the preceding row; the splice was
 * eating the corp's starting-resources row).
 */
type SourceRow = {row: ReadonlyArray<ItemType>, rowIndex: number | undefined, fromCorpBox?: boolean};

function corpBoxSourceRows(box: CorpBoxNode): Array<SourceRow> {
  const result: Array<SourceRow> = [];
  for (const boxRow of box.rows) {
    let pending: Array<ItemType> = [];
    const flush = () => {
      if (pending.length > 0) {
        result.push({row: pending, rowIndex: undefined, fromCorpBox: true});
        pending = [];
      }
    };
    for (const node of boxRow) {
      if (node !== undefined && typeof node !== 'string' && isICardRenderEffect(node)) {
        flush();
        result.push({row: [node], rowIndex: undefined, fromCorpBox: true});
      } else {
        pending.push(node);
      }
    }
    flush();
  }
  return result;
}

function flattenCorpBoxRows(rows: ReadonlyArray<ReadonlyArray<ItemType>>): Array<SourceRow> {
  const result: Array<SourceRow> = [];
  rows.forEach((row, rowIndex) => {
    if (!row.some(isCorpBoxNode)) {
      result.push({row, rowIndex});
      return;
    }
    const rest = row.filter((node) => !isCorpBoxNode(node));
    if (renderableNodes(rest).length > 0) {
      result.push({row: rest, rowIndex});
    }
    for (const node of row) {
      if (isCorpBoxNode(node)) {
        result.push(...corpBoxSourceRows(node));
      }
    }
  });
  return result;
}

/** The vpText fine-print marker: `b.vpText()` emits TEXT at TINY, uppercase. */
function isVpTextItem(node: ItemType): boolean {
  return node !== undefined && typeof node !== 'string' && isICardRenderItem(node) &&
    node.type === CardRenderItemType.TEXT && node.size === Size.TINY && node.isUppercase === true;
}

/**
 * A PROSE description node — `b.plainText(...)` (the parenthetical rule
 * restatement upstream cards draw under the icons: Martian Lumber Corp,
 * AI Central, …). Dropped on the ICONS-ONLY premium face — the prose belongs
 * to the fullscreen info panel, not baked onto the card. `plainText` emits
 * TEXT with `isBold: false`; a MEANINGFUL text label (`text('X')`, «+/- 2»,
 * a whole text-only card like Business Contacts) is `isBold: true` and KEPT,
 * and the TINY-uppercase vpText fine print keeps its own handling.
 */
function isProseTextItem(node: ItemType): boolean {
  return node !== undefined && typeof node !== 'string' && isICardRenderItem(node) &&
    node.type === CardRenderItemType.TEXT && node.isBold !== true && !isVpTextItem(node);
}

/**
 * THE PLAY ZONE — the card's on-play mechanics («при розыгрыше») — is the
 * TRAILING run of plain/production groups (the DSL convention draws
 * effect/action frames first, immediate mechanics last; guard-tested against
 * the card-information model in premiumCardViewModel.spec, so a future card
 * breaking the invariant fails with its name). Returns the index of the
 * first group of that run, or `groups.length` when the card has no play
 * zone (pure effect/action cards). The premium face draws the card-native
 * play-rail accent right before this index; the fullscreen rule overlay
 * tethers its «При розыгрыше» block to that rail.
 */
export function playZoneStart(groups: ReadonlyArray<MechGroup>): number {
  const isPlayKind = (kind: MechGroupKind) => kind === 'plain' || kind === 'production';
  let start = groups.length;
  while (start > 0 && isPlayKind(groups[start - 1].kind)) {
    start--;
  }
  return start;
}

export type BuildMechanicsOptions = {
  /**
   * Drop the printed VP fine print (the TINY-uppercase vpText items) from
   * the face — the rule lives in the card-information VP block now, shown
   * by overlays / the future info panel next to the VP badge. Passed only
   * for cards with a DYNAMIC VP (the vpText population), so ordinary tiny
   * notes on other cards are untouched.
   */
  dropVpText?: boolean;
};

export function buildMechanics(renderData: CardComponent | undefined, options: BuildMechanicsOptions = {}): MechanicsVM {
  if (renderData === undefined || !isICardRenderRoot(renderData)) {
    return {groups: [], density: 'sparse', score: 0, textOnly: true};
  }
  const graphicIds = deriveGraphicIds(renderData);

  /*
   * The CHOICE marker must never be lost (the player has to read "one of
   * these, not both" from the face), and it must never leave a stray glyph:
   *  1. every EDGE connector OR (leading / trailing at the root OR inside a
   *     trailing effect frame — an OR-only row is just the degenerate case,
   *     its content strips to empty) is removed from the render (`orEdges`
   *     + `effectParts`) and re-expressed as `orJoin` on the group it
   *     joins → the panel draws the premium «ИЛИ» divider, not a lone «или»;
   *  2. consecutive ACTION groups with no OR resolved at their junction get
   *     a STRUCTURAL orJoin — one card = one activatable action, so multiple
   *     action rows are by definition alternatives (the Vermin class, whose
   *     per-branch split dropped the printed OR entirely).
   */
  const groups: Array<MechGroup> = [];
  let pendingOr = false;
  for (const {row, rowIndex, fromCorpBox} of flattenCorpBoxRows(renderData.rows)) {
    // Icons-only face: drop prose `plainText` (a row that was ONLY prose then
    // collapses and is skipped; a prose node chained onto an icon row — AI
    // Central — is removed while the icon stays).
    let rowNodes = renderableNodes(row).filter((node) => !isProseTextItem(node));
    if (options.dropVpText === true) {
      rowNodes = rowNodes.filter((node) => !isVpTextItem(node));
    }
    if (rowNodes.length === 0 || rowNodes.every(isSpacerNode)) {
      continue; // a description-only / spacer-only / dropped-fine-print row
    }
    const {nodes, leadingOr, trailingOr} = orEdges(rowNodes);
    if (nodes.length === 0) {
      pendingOr = pendingOr || leadingOr || trailingOr; // an OR-only row
      continue;
    }
    // Viral-Enhancers idiom: the effect's TRIGGER is drawn as a standalone
    // root row BEFORE an empty-cause effect box. Splice that trigger into the
    // effect's cause and drop the standalone group so the whole graphic reads
    // as ONE effect (mirrors effectExtraction.withSplicedCause; the tag row was
    // rendering as a separate block on the premium face).
    let effectiveNodes = nodes;
    const emptyEffect = fromCorpBox === true ? undefined : emptyCauseEffect(nodes);
    const prev = groups[groups.length - 1];
    if (emptyEffect !== undefined && prev !== undefined && prev.kind === 'plain' && prev.orJoin !== true) {
      effectiveNodes = nodes.map((node) => (node === emptyEffect ?
        {...emptyEffect, rows: [[...prev.nodes], emptyEffect.rows[1], emptyEffect.rows[2]]} :
        node));
      groups.pop();
    }
    const group: MechGroup = {
      kind: groupKindOf(effectiveNodes),
      nodes: effectiveNodes,
      weight: sumNodes(effectiveNodes),
      graphicId: rowIndex === undefined ? undefined : graphicIds.find((ref) => ref.rowIndex === rowIndex)?.id,
    };
    if (pendingOr || leadingOr) {
      group.orJoin = true;
    }
    pendingOr = trailingOr;
    groups.push(group);
  }

  for (let i = 1; i < groups.length; i++) {
    if (groups[i].kind === 'action' && groups[i - 1].kind === 'action' && groups[i].orJoin !== true) {
      groups[i].orJoin = true;
    }
  }

  const score = groups.reduce((acc, g) => acc + g.weight, 0);
  return {
    groups,
    density: densityOf(groups.length, score),
    score,
    textOnly: groups.length === 0,
  };
}
