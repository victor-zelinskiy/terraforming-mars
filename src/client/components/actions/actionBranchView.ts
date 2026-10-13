import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {Message} from '@/common/logs/Message';
import {TileType} from '@/common/TileType';
import {ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {CardRenderSymbolType} from '@/common/cards/render/CardRenderSymbolType';
import {ICardRenderEffect, ItemType, isICardRenderEffect, isICardRenderItem, isICardRenderProductionBox, isICardRenderSymbol, isICardRenderTile} from '@/common/cards/render/Types';
import {ActionGroup, actionNodeDescription, branchActionNode} from '@/client/components/actions/actionExtraction';
import {assignBranchNodes, bestBranchNode, branchNodeOverlapScore} from '@/client/components/actions/actionBranchNodes';

/*
 * Shared branch/render-node mapping for activatable actions.
 *
 * A card has one action, but that action can draw several render nodes and expose
 * several server preview branches. The counts are not always equal: Asteroid
 * Rights draws two rows but has three branches because one printed row represents
 * two spend-asteroid outcomes. The overlay needs the full node -> branch set, not
 * only a single branch, otherwise it can incorrectly enable a disabled row by
 * falling back to a different available branch.
 */

type GroupNode = ActionGroup['nodes'][number];

export type BranchView = {
  key: string;
  node: GroupNode | undefined;
  branch: ActionPreviewBranch;
  /**
   * THE FACE'S OWN NODES of THIS branch's printed graphic — what the option tile prints as its headline:
   *  · a row the branch has to itself → the whole action box (its printed OR-connector stripped);
   *  · a row the server splits into SEVERAL branches («аэростат → 2 титан / 3 энергия / 4 тепло», «астероид →
   *    производство M€ ИЛИ 2 титан») → the branch's OWN segment of the result, sliced at the printed «/» and «ИЛИ»
   *    (`printedAlternatives`) and claimed by the branch's title (`assignPrintedAlternatives`) — the cause those
   *    branches share is the action's price, which the composer prints once above the tiles;
   *  · `undefined` when the print cannot say which outcome is which — the option then speaks in words and chips.
   * References into the card's render tree, never copies: the face, the option and the commit's impulse are one object.
   */
  printed: ReadonlyArray<ItemType> | undefined;
};

export function branchTitleText(b: ActionPreviewBranch): string {
  return typeof b.title === 'string' ? b.title : (b.title as Message).message;
}

function nodeAt(nodes: ReadonlyArray<GroupNode>, idx: number | undefined): GroupNode | undefined {
  return (idx !== undefined && idx >= 0) ? nodes[idx] : undefined;
}

function strippedBranchNode(node: GroupNode | undefined): GroupNode | undefined {
  if (node === undefined || node.actionNode === undefined) {
    return node;
  }
  return {...node, actionNode: branchActionNode(node.actionNode)};
}

export function stripNodeOr(node: GroupNode): GroupNode {
  return strippedBranchNode(node) ?? node;
}

export function branchNodeIndexForBranch(
  group: ActionGroup,
  branches: ReadonlyArray<ActionPreviewBranch>,
  branchIndex: number,
): number | undefined {
  if (branches.length === 0) {
    return undefined;
  }
  if (branches.length === 1) {
    return 0;
  }
  if (group.nodes.length === 1) {
    return undefined;
  }
  if (group.nodes.length < branches.length) {
    return bestBranchNode(branchTitleText(branches[branchIndex]), group.nodes.map((n) => actionNodeDescription(n)));
  }
  const indices = assignBranchNodes(
    branches.map((b) => branchTitleText(b)),
    group.nodes.map((n) => actionNodeDescription(n)),
  );
  const p = indices[branchIndex];
  return p >= 0 ? p : undefined;
}

export function branchPositionsForNode(
  group: ActionGroup,
  branches: ReadonlyArray<ActionPreviewBranch>,
  nodeIndex: number,
): ReadonlyArray<number> {
  if (branches.length === 0) {
    return [];
  }
  if (branches.length === 1) {
    return [0];
  }
  if (group.nodes.length === 1) {
    return branches.map((_b, i) => i);
  }
  const out: Array<number> = [];
  for (let i = 0; i < branches.length; i++) {
    if (branchNodeIndexForBranch(group, branches, i) === nodeIndex) {
      out.push(i);
    }
  }
  return out;
}

export function branchPositionForNode(
  group: ActionGroup,
  branches: ReadonlyArray<ActionPreviewBranch>,
  nodeIndex: number,
): number | undefined {
  const positions = branchPositionsForNode(group, branches, nodeIndex);
  return positions.length === 1 ? positions[0] : undefined;
}

// ── THE PRINTED ROW OF ONE BRANCH ────────────────────────────────────────────

/** The printed seam between two alternatives of one result: the DSL's `or()` and `slash()`. */
function isAlternativeSeam(item: ItemType): boolean {
  return item !== undefined && (item as unknown) !== null && typeof item !== 'string' && isICardRenderSymbol(item) &&
    (item.type === CardRenderSymbolType.OR || item.type === CardRenderSymbolType.SLASH);
}

/** Layout filler beside a seam — the spacing the DSL writes around a connector, and the row builder's empty tail. */
function isFiller(item: ItemType): boolean {
  if (item === undefined || (item as unknown) === null || typeof item === 'string') {
    return true;
  }
  if (isICardRenderSymbol(item)) {
    return item.type === CardRenderSymbolType.NBSP || item.type === CardRenderSymbolType.EMPTY || item.type === CardRenderSymbolType.VSPACE;
  }
  return isICardRenderItem(item) && item.type === CardRenderItemType.NBSP;
}

function trimFillers(items: ReadonlyArray<ItemType>): ReadonlyArray<ItemType> {
  let a = 0;
  let b = items.length;
  while (a < b && isFiller(items[a])) {
    a++;
  }
  while (b > a && isFiller(items[b - 1])) {
    b--;
  }
  return items.slice(a, b);
}

/**
 * The ALTERNATIVES an action box prints in its result — «2 [titanium] / 3 [energy] / 4 [heat]», «[production M€] OR
 * 2 [titanium]» — as separate item runs (face references), in the printed order; `[]` when the result has no seam.
 */
export function printedAlternatives(node: ICardRenderEffect): ReadonlyArray<ReadonlyArray<ItemType>> {
  const result: ReadonlyArray<ItemType> = node.rows?.[2] ?? [];
  const runs: Array<Array<ItemType>> = [[]];
  for (const item of result) {
    if (isAlternativeSeam(item)) {
      runs.push([]);
      continue;
    }
    runs[runs.length - 1].push(item);
  }
  const trimmed = runs.map(trimFillers).filter((run) => run.length > 0);
  return trimmed.length >= 2 ? trimmed : [];
}

/** Words a branch title may use for a printed thing, beside the render type's own name. */
const PRINTED_WORDS: Partial<Record<string, string>> = {
  [CardRenderItemType.MEGACREDITS]: 'megacredits',
  [CardRenderItemType.PLANTS]: 'plant plants',
  [CardRenderItemType.CARDS]: 'card cards draw',
  [CardRenderItemType.TR]: 'terraform rating',
  [CardRenderItemType.OCEANS]: 'ocean oceans',
  [CardRenderItemType.COLONIES]: 'colony colonies',
  [CardRenderItemType.DELEGATES]: 'delegate delegates',
  [CardRenderItemType.GREENERY]: 'greenery forest',
  [CardRenderItemType.TRADE_FLEET]: 'trade fleet',
  /** The «?» cube — «gain a standard resource» (AstroDrill's «[asteroid]* / [?]» row). */
  [CardRenderItemType.WILD]: 'wild any standard resource',
};

function printedWords(name: string): string {
  const own = PRINTED_WORDS[name];
  if (own !== undefined) {
    return own;
  }
  const singular = name.replace(/s$/, '');
  return `${name} ${singular} ${singular}s`;
}

/**
 * The ENGLISH words of one printed segment — the same token source the branch titles are matched by (the server's
 * behavior titles are English source strings at this layer): «2 titanium», «production megacredits», «floater».
 */
export function printedSegmentDescription(items: ReadonlyArray<ItemType>): string {
  const out: Array<string> = [];
  const walk = (item: ItemType): void => {
    if (item === undefined || (item as unknown) === null || typeof item === 'string') {
      return;
    }
    if (isICardRenderItem(item)) {
      if (item.amount > 0) {
        out.push(String(item.amount));
      }
      out.push(printedWords(item.type));
      if (item.resource !== undefined) {
        out.push(printedWords(String(item.resource).toLowerCase()));
      }
      return;
    }
    if (isICardRenderProductionBox(item)) {
      out.push('production');
      item.rows.forEach((row) => row.forEach(walk));
      return;
    }
    if (isICardRenderTile(item)) {
      out.push('tile', (TileType[item.tile] ?? '').toLowerCase().replace(/_/g, ' '));
      return;
    }
    if (isICardRenderEffect(item)) {
      item.rows.forEach((row) => row.forEach(walk));
    }
  };
  items.forEach(walk);
  return out.join(' ');
}

/**
 * Which printed alternative is WHICH branch: each title claims the segment its words overlap most. UNAMBIGUOUS or
 * nothing — every branch must claim a segment of its own by a positive score, no two the same, no tie — a wrong
 * graphic on an option is the lie the slice exists to end, so a guess is never taken. `undefined` → the options speak
 * in words and chips.
 */
export function assignPrintedAlternatives(
  titles: ReadonlyArray<string>,
  segments: ReadonlyArray<ReadonlyArray<ItemType>>,
): ReadonlyArray<number> | undefined {
  if (titles.length < 2 || titles.length !== segments.length) {
    return undefined;
  }
  const descriptions = segments.map(printedSegmentDescription);
  const picks = titles.map((title) => {
    let best = -1;
    let bestScore = 0;
    let tie = false;
    descriptions.forEach((description, i) => {
      const score = branchNodeOverlapScore(title, description);
      if (score > bestScore) {
        bestScore = score;
        best = i;
        tie = false;
      } else if (score === bestScore && score > 0) {
        tie = true;
      }
    });
    return tie ? -1 : best;
  });
  if (picks.some((p) => p < 0) || new Set(picks).size !== picks.length) {
    return undefined;
  }
  return picks;
}

/** The printed row of every branch (see `BranchView.printed`), given which node each branch maps to. */
function printedBranchRows(
  nodes: ReadonlyArray<GroupNode>,
  branches: ReadonlyArray<ActionPreviewBranch>,
  nodeOf: ReadonlyArray<number | undefined>,
): Array<ReadonlyArray<ItemType> | undefined> {
  const out: Array<ReadonlyArray<ItemType> | undefined> = branches.map(() => undefined);
  const byNode = new Map<number, Array<number>>();
  nodeOf.forEach((ni, pos) => {
    if (ni !== undefined && ni >= 0) {
      byNode.set(ni, [...(byNode.get(ni) ?? []), pos]);
    }
  });
  for (const [ni, positions] of byNode) {
    const actionNode = nodes[ni]?.actionNode;
    if (actionNode === undefined) {
      continue;
    }
    if (positions.length === 1) {
      out[positions[0]] = [branchActionNode(actionNode)];
      continue;
    }
    const segments = printedAlternatives(actionNode);
    const picks = assignPrintedAlternatives(positions.map((p) => branchTitleText(branches[p])), segments);
    if (picks === undefined) {
      continue;
    }
    positions.forEach((p, k) => {
      out[p] = segments[picks[k]];
    });
  }
  return out;
}

export function buildBranchViews(
  cardName: CardName,
  group: ActionGroup,
  branches: ReadonlyArray<ActionPreviewBranch>,
): ReadonlyArray<BranchView> {
  const nodes = group.nodes;
  // The node each branch maps to (`undefined` — none): a COMBINED node (one row drawing every branch) keeps its
  // picker fallback as `node`, and its print is still tried — a single «→ a / b» row slices like any other.
  let nodeOf: Array<number | undefined>;
  let printedNodeOf: ReadonlyArray<number | undefined>;
  if (nodes.length === 1 && branches.length > 1) {
    nodeOf = branches.map(() => undefined);
    printedNodeOf = branches.map(() => 0);
  } else if (nodes.length < branches.length) {
    nodeOf = branches.map((_branch, i) => branchNodeIndexForBranch(group, branches, i));
    printedNodeOf = nodeOf;
  } else {
    const indices = assignBranchNodes(
      branches.map((b) => branchTitleText(b)),
      nodes.map((n) => actionNodeDescription(n)),
    );
    nodeOf = indices.map((p) => (p >= 0 ? p : undefined));
    printedNodeOf = nodeOf;
  }
  const printed = printedBranchRows(nodes, branches, printedNodeOf);
  return branches.map((branch, i): BranchView => ({
    key: cardName + '#br' + i,
    node: nodeOf[i] === undefined ? undefined : strippedBranchNode(nodeAt(nodes, nodeOf[i])),
    branch,
    printed: printed[i],
  }));
}

/** A branch's "why not", normalized: the raw i18n template + its params. */
/** A branch's refusal. `tag` is the one it is ABOUT, when it is about one —
 *  the surface fills the message's `${0}` from its translated name (never a
 *  server-worded param, which would freeze the sentence to one language). */
export type BranchReason = {message: string | Message, params: ReadonlyArray<string>, tag?: Tag};

/**
 * THE PER-VARIANT VERDICT — one render node judged against its WHOLE branch set.
 *
 * A printed action row is NOT always one server branch: «Права на астероиды»
 * draws «астероид отсюда → производство M€ ИЛИ титан» as ONE row the server
 * splits into TWO branches, «Атмосферные коллекторы» into three, and a
 * single-node card (Robinson Industries) draws its whole action as one row over
 * six. A surface that resolved such a row to a SINGLE branch got `undefined` —
 * the mapping is ambiguous by construction — and then fell back to the CARD's
 * availability, so a row whose every inner branch was blocked was offered as
 * AVAILABLE: the player descended into it and found every option inside refused
 * («Недостаточно ресурсов на этой карте» twice, nothing to press but B). The row
 * is what the player presses, so the row itself must carry the verdict.
 *
 * The rule is one line: a variant is unavailable exactly when EVERY branch it
 * offers is unavailable (one live inner branch keeps the row live). It subsumes
 * the single-branch case (a set of one), so a consumer needs no second path.
 *
 * SAFE by the server invariant `canAct === true` ⇒ at least one branch available
 * (guarded corpus-wide by tests/models/actionBranchAvailability.spec.ts): a
 * variant can only ever be blocked here when the server agrees something in it
 * is really blocked.
 */
export type NodeAvailability = {
  /** The branches this node maps to (empty when the preview has not loaded). */
  branches: ReadonlyArray<ActionPreviewBranch>;
  /** The preview mapped this node to at least one branch. */
  known: boolean;
  /** The node offers more than one branch — activating it asks WHICH. */
  branching: boolean;
  /** EVERY branch this node offers is unavailable: the variant cannot be performed. */
  allBlocked: boolean;
  /**
   * The blocked branches' reasons, deduped, in branch order — empty unless
   * `allBlocked`. They are all true SIMULTANEOUSLY (each dead option's own
   * refusal), so this is a conjunction and never a «X or Y» guess; a one-line
   * consumer takes `[0]`.
   */
  reasons: ReadonlyArray<BranchReason>;
};

function reasonKey(r: BranchReason): string {
  return (typeof r.message === 'string' ? r.message : r.message.message) +
    ' ' + r.params.join(' ') + ' ' + (r.tag ?? '');
}

export function nodeAvailability(
  group: ActionGroup,
  branches: ReadonlyArray<ActionPreviewBranch>,
  nodeIndex: number,
): NodeAvailability {
  return branchSetAvailability(branchPositionsForNode(group, branches, nodeIndex)
    .map((p) => branches[p])
    .filter((b): b is ActionPreviewBranch => b !== undefined));
}

/**
 * The same verdict over a branch set the caller already resolved — the composer
 * asks it of the set it is actually RENDERING (its `positions`, which also cover
 * the «no node, every branch» case). Two entry points, ONE rule: the browse grid
 * that refuses the row and the screen that would host it can never disagree.
 */
export function branchSetAvailability(mine: ReadonlyArray<ActionPreviewBranch>): NodeAvailability {
  const branching = mine.length > 1;
  if (mine.length === 0) {
    return {branches: mine, known: false, branching, allBlocked: false, reasons: []};
  }
  const blocked = mine.filter((b) => b.available === false);
  if (blocked.length < mine.length) {
    return {branches: mine, known: true, branching, allBlocked: false, reasons: []};
  }
  const reasons: Array<BranchReason> = [];
  const seen = new Set<string>();
  for (const b of blocked) {
    if (b.unavailableReason === undefined) {
      continue;
    }
    const reason: BranchReason = {
      message: b.unavailableReason,
      params: [...(b.unavailableReasonParams ?? [])],
      tag: b.unavailableReasonTag,
    };
    const key = reasonKey(reason);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    reasons.push(reason);
  }
  return {branches: mine, known: true, branching, allBlocked: true, reasons};
}
