import {expect} from 'chai';
import {branchPositionForNode, branchPositionsForNode, stripNodeOr} from '@/client/components/actions/actionBranchView';
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
