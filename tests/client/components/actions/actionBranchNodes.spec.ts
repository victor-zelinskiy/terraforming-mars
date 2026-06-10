import {expect} from 'chai';
import {assignBranchNodes} from '@/client/components/actions/actionBranchNodes';

describe('assignBranchNodes', () => {
  it('matches branches to render nodes by title even when the order differs', () => {
    // Regolith Eaters: behavior order is [spend, add] but the card PRINTS
    // [add, spend], so a positional map would be wrong.
    const branchTitles = [
      'Remove 2 microbes to raise oxygen level 1 step',
      'Add 1 microbe to this card',
    ];
    const nodeDescriptions = [
      'Add 1 microbe to this card.',
      'Remove 2 microbes from this card to raise oxygen level 1 step.',
    ];
    const map = assignBranchNodes(branchTitles, nodeDescriptions);
    expect(map[0]).eq(1); // spend → the "remove 2 microbes" node
    expect(map[1]).eq(0); // add → the "add 1 microbe" node
  });

  it('never assigns the same node to two branches (greedy)', () => {
    const map = assignBranchNodes(
      ['Add a floater', 'Add a floater to this card'],
      ['Add a floater', 'Add a floater to this card'],
    );
    expect(new Set(map).size).eq(map.length);
  });

  it('falls back to the ordinal node when there is no token overlap', () => {
    const map = assignBranchNodes(['альфа', 'бета'], ['xxxx', 'yyyy']);
    expect(map[0]).eq(0);
    expect(map[1]).eq(1);
  });

  it('returns -1 for branches with no node left to assign', () => {
    const map = assignBranchNodes(['a branch', 'another branch'], ['only one node here']);
    expect(map[1]).eq(-1);
  });
});
