import {expect} from 'chai';
import {branchPositionForNode, branchPositionsForNode, branchSetAvailability, nodeAvailability, stripNodeOr} from '@/client/components/actions/actionBranchView';
import {ActionGroup} from '@/client/components/actions/actionExtraction';
import {ActionPreviewBranch} from '@/common/models/ActionPreviewModel';

// Minimal mocks: a node's `text` doubles as its description (actionNodeDescription
// returns it when there's no actionNode), and a branch's string title is its match
// token source — exactly the inputs the token-overlap matcher consumes.
function group(nodeTexts: ReadonlyArray<string>): ActionGroup {
  return {
    nodes: nodeTexts.map((t, i) => ({key: 'k' + i, actionNode: undefined, renderRoot: undefined, text: t})),
  } as unknown as ActionGroup;
}
function branches(titles: ReadonlyArray<string>): ReadonlyArray<ActionPreviewBranch> {
  return titles.map((t, i) => ({title: t, index: i, available: true, effects: [], steps: []})) as unknown as ReadonlyArray<ActionPreviewBranch>;
}

/** Refuse a branch the way the server does — a template plus its params. */
function block(branch: ActionPreviewBranch, reason: string, params?: ReadonlyArray<string>): void {
  const b = branch as {available: boolean, unavailableReason?: string, unavailableReasonParams?: ReadonlyArray<string>};
  b.available = false;
  b.unavailableReason = reason;
  b.unavailableReasonParams = params;
}

describe('branchPositionForNode', () => {
  it('inverts the node↔branch match so a row selects ITS OWN branch when orders differ', () => {
    // Regolith Eaters: render nodes printed [add, spend]; server branches [spend, add].
    // A naive positional map (node i → branch i) would SWAP the cost/result.
    const g = group([
      'Add 1 microbe to this card.',
      'Remove 2 microbes from this card to raise oxygen level 1 step.',
    ]);
    const b = branches([
      'Remove 2 microbes to raise oxygen level 1 step',
      'Add 1 microbe to this card',
    ]);
    expect(branchPositionForNode(g, b, 0)).eq(1); // node 0 (add) → branch 1 (add)
    expect(branchPositionForNode(g, b, 1)).eq(0); // node 1 (spend) → branch 0 (spend)
  });

  it('a single-action card maps node 0 → branch 0 regardless of node order', () => {
    expect(branchPositionForNode(group(['x']), branches(['y']), 0)).eq(0);
  });

  it('BioPrinting: each printed box selects its OWN branch (plants box / animal box)', () => {
    // Render nodes printed [plants box, animal box]; server branches [animal, plants].
    // So selecting a row must resolve to its OWN outcome, not a positional swap.
    const g = group([
      'Spend 2 energy to gain 2 plants.',
      'Spend 2 energy to add 1 animal to ANOTHER card.',
    ]);
    const b = branches([
      'Add 1 animal to another card',
      'Gain 2 plants',
    ]);
    expect(branchPositionForNode(g, b, 0)).eq(1); // plants box → the gain-plants branch
    expect(branchPositionForNode(g, b, 1)).eq(0); // animal box → the add-animal branch
  });

  it('a combined node (1 node draws 2 branches) → undefined (picker fallback)', () => {
    expect(branchPositionForNode(group(['combined graphic']), branches(['a', 'b']), 0)).eq(undefined);
  });

  it('no branches (preview not loaded yet) → undefined', () => {
    expect(branchPositionForNode(group(['x', 'y']), branches([]), 0)).eq(undefined);
  });
  it('maps multiple server branches to one printed row when a row contains an OR outcome', () => {
    const g = group([
      'Spend 1 M€ to add 1 asteroid to ANY card.',
      'Spend 1 asteroid here to increase M€ production 1 step OR gain 2 titanium.',
    ]);
    const b = branches([
      'Remove 1 asteroid on this card to gain 2 titanium',
      'Remove 1 asteroid on this card to increase M€ production 1 step',
      'Add 1 asteroid to this card',
    ]);

    expect(branchPositionsForNode(g, b, 0)).deep.eq([2]);
    expect(branchPositionsForNode(g, b, 1)).deep.eq([0, 1]);
    expect(branchPositionForNode(g, b, 0)).eq(2);
    expect(branchPositionForNode(g, b, 1)).eq(undefined);
  });
});

describe('stripNodeOr', () => {
  it('is a no-op for a node with no actionNode (text fallback row)', () => {
    const n = {key: 'k', actionNode: undefined, renderRoot: undefined, text: 'x'} as unknown as ActionGroup['nodes'][number];
    expect(stripNodeOr(n)).eq(n);
  });
});

/*
 * THE PER-VARIANT VERDICT. A printed row is available exactly when SOMETHING
 * inside it is; the bug this covers is «Права на астероиды» offering its whole
 * spend-an-asteroid row while both of that row's branches were refused, because
 * the row resolved to no single branch and inherited the CARD's «available».
 */
describe('nodeAvailability', () => {
  const ASTEROID_RIGHTS_NODES = [
    'Spend 1 M€ to add 1 asteroid to ANY card.',
    'Spend 1 asteroid here to increase M€ production 1 step OR gain 2 titanium.',
  ];
  const ASTEROID_RIGHTS_BRANCHES = [
    'Remove 1 asteroid on this card to gain 2 titanium',
    'Remove 1 asteroid on this card to increase M€ production 1 step',
    'Add 1 asteroid to this card',
  ];

  it('a row over several branches is BLOCKED when every one of them is', () => {
    const g = group(ASTEROID_RIGHTS_NODES);
    const b = branches(ASTEROID_RIGHTS_BRANCHES);
    block(b[0], 'Not enough resources on this card');
    block(b[1], 'Not enough resources on this card');

    const spendRow = nodeAvailability(g, b, 1);
    expect(spendRow.branching, 'the row asks WHICH outcome').eq(true);
    expect(spendRow.allBlocked).eq(true);
    // ONE reason: both dead options give the same one, so it is stated once.
    expect(spendRow.reasons).to.have.length(1);
    expect(spendRow.reasons[0].message).eq('Not enough resources on this card');
    // The other row still maps to its own live branch and stays available.
    expect(nodeAvailability(g, b, 0).allBlocked).eq(false);
  });

  it('one live branch keeps the row live', () => {
    const g = group(ASTEROID_RIGHTS_NODES);
    const b = branches(ASTEROID_RIGHTS_BRANCHES);
    block(b[0], 'Not enough resources on this card');

    const spendRow = nodeAvailability(g, b, 1);
    expect(spendRow.allBlocked).eq(false);
    expect(spendRow.reasons, 'a live row has no blocker to name').to.deep.eq([]);
  });

  it('subsumes the single-branch case (a set of one)', () => {
    const g = group(['use it']);
    const b = branches(['use it']);
    expect(nodeAvailability(g, b, 0).allBlocked).eq(false);
    block(b[0], 'Not enough steel');
    const one = nodeAvailability(g, b, 0);
    expect(one.branching, 'nothing to choose between').eq(false);
    expect(one.allBlocked).eq(true);
    expect(one.reasons[0].message).eq('Not enough steel');
  });

  it('a single-node card that draws EVERY branch is judged over all of them', () => {
    // Robinson Industries: one printed row, six server branches.
    const g = group(['increase your lowest production 1 step']);
    const b = branches(['a', 'b', 'c', 'd', 'e', 'f']);
    b.forEach((branch) => block(branch, 'Need ${0} more M€', ['4']));
    const row = nodeAvailability(g, b, 0);
    expect(row.branches).to.have.length(6);
    expect(row.allBlocked).eq(true);
    // The template AND its params survive — a reason that loses them prints «${0}».
    expect(row.reasons).to.have.length(1);
    expect(row.reasons[0].params).to.deep.eq(['4']);
  });

  it('DISTINCT reasons are all kept, in branch order, deduped', () => {
    const g = group(['combined graphic']);
    const b = branches(['a', 'b', 'c']);
    block(b[0], 'Not enough steel');
    block(b[1], 'Not enough steel');
    block(b[2], 'No card to add an animal to');
    const row = nodeAvailability(g, b, 0);
    expect(row.reasons.map((r) => r.message)).to.deep.eq([
      'Not enough steel',
      'No card to add an animal to',
    ]);
  });

  it('an unloaded preview is UNKNOWN, never blocked', () => {
    const row = nodeAvailability(group(['x', 'y']), branches([]), 0);
    expect(row.known).eq(false);
    expect(row.allBlocked, 'a missing preview may never refuse an action').eq(false);
  });
});

describe('branchSetAvailability', () => {
  it('answers the SAME rule for a set the caller already resolved (the composer)', () => {
    const b = branches(['a', 'b']);
    expect(branchSetAvailability(b).allBlocked).eq(false);
    block(b[0], 'Not enough resources on this card');
    expect(branchSetAvailability(b).allBlocked).eq(false);
    block(b[1], 'Not enough resources on this card');
    const verdict = branchSetAvailability(b);
    expect(verdict.allBlocked).eq(true);
    expect(verdict.reasons).to.have.length(1);
  });
});
