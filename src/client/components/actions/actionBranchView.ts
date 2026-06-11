import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import {ActionGroup, actionNodeDescription, branchActionNode} from '@/client/components/actions/actionExtraction';
import {assignBranchNodes} from '@/client/components/actions/actionBranchNodes';

/*
 * Shared branch ↔ render-node mapping for an activatable action. A card has ONE
 * action but may draw 2+ render NODES for an `or` (Regolith Eaters / Jupiter
 * Floating Station → 2 nodes; Self-Replicating Robots → 1 combined node / 2
 * branches). This was duplicated across ActionBlock, CardActionConfirmContent and
 * (now) ActionDetailsPanel — extracted here so the three surfaces stay in lockstep.
 */

type GroupNode = ActionGroup['nodes'][number];

export type BranchView = {
  /** Stable v-for key (cardName + branch ordinal). */
  key: string;
  /** The render node that draws THIS branch — undefined when the card draws all
   *  branches in one combined node (then the surface falls back to the title). */
  node: GroupNode | undefined;
  branch: ActionPreviewBranch;
};

/** A branch title as plain text (Message → its `.message`). */
export function branchTitleText(b: ActionPreviewBranch): string {
  return typeof b.title === 'string' ? b.title : (b.title as Message).message;
}

function nodeAt(nodes: ReadonlyArray<GroupNode>, idx: number | undefined): GroupNode | undefined {
  return (idx !== undefined && idx >= 0) ? nodes[idx] : undefined;
}

/** A branch's render node with a leading OR connector stripped, so a lone branch
 *  graphic isn't orphaned by an "ИЛИ" join. */
function strippedBranchNode(node: GroupNode | undefined): GroupNode | undefined {
  if (node === undefined || node.actionNode === undefined) {
    return node;
  }
  return {...node, actionNode: branchActionNode(node.actionNode)};
}

/**
 * Pair each preview branch with the render node that draws it. When the render
 * SPLITS CLEANLY (≥ one node per branch) each branch gets its own graphic (matched
 * by token overlap via `assignBranchNodes`); when ALL branches share ONE combined
 * node (`nodes.length < branches.length`), every branch gets `node: undefined` and
 * the surface shows the branch TITLE instead (never the whole combined action).
 */
export function buildBranchViews(
  cardName: CardName,
  group: ActionGroup,
  branches: ReadonlyArray<ActionPreviewBranch>,
): ReadonlyArray<BranchView> {
  const nodes = group.nodes;
  if (nodes.length < branches.length) {
    return branches.map((branch, i): BranchView => ({key: cardName + '#br' + i, node: undefined, branch}));
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
