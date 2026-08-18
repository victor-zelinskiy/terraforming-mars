import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import {ActionGroup, actionNodeDescription, branchActionNode} from '@/client/components/actions/actionExtraction';
import {assignBranchNodes, bestBranchNode} from '@/client/components/actions/actionBranchNodes';

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

export function buildBranchViews(
  cardName: CardName,
  group: ActionGroup,
  branches: ReadonlyArray<ActionPreviewBranch>,
): ReadonlyArray<BranchView> {
  const nodes = group.nodes;
  if (nodes.length === 1 && branches.length > 1) {
    return branches.map((branch, i): BranchView => ({key: cardName + '#br' + i, node: undefined, branch}));
  }
  if (nodes.length < branches.length) {
    return branches.map((branch, i): BranchView => ({
      key: cardName + '#br' + i,
      node: strippedBranchNode(nodeAt(nodes, branchNodeIndexForBranch(group, branches, i))),
      branch,
    }));
  }
  const indices = assignBranchNodes(
    branches.map((b) => branchTitleText(b)),
    nodes.map((n) => actionNodeDescription(n)),
  );
  return branches.map((branch, i): BranchView => ({
    key: cardName + '#br' + i,
    node: strippedBranchNode(nodeAt(nodes, indices[i])),
    branch,
  }));
}

/** A branch's "why not", normalized: the raw i18n template + its params. */
export type BranchReason = {message: string | Message, params: ReadonlyArray<string>};

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
  return (typeof r.message === 'string' ? r.message : r.message.message) + ' ' + r.params.join(' ');
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
    const reason: BranchReason = {message: b.unavailableReason, params: [...(b.unavailableReasonParams ?? [])]};
    const key = reasonKey(reason);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    reasons.push(reason);
  }
  return {branches: mine, known: true, branching, allBlocked: true, reasons};
}
