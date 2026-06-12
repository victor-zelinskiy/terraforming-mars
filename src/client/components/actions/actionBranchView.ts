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
