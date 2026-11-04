import {expect} from 'chai';
import {nestCellInBranchPick} from '../../src/client/console/stagedPlay';

/**
 * THE CELL IS THE BRANCH PICK'S ANSWER (P67 World Government Advisor · ledger GK): the World Government's «Add an
 * ocean» is a `SelectSpace` NESTED in its `OrOptions`, so the staged confirm folds the cell into the batch's branch
 * pick — `{type: 'or', index, response: {type: 'space', spaceId}, for}` — byte-identical to the answer the live
 * question takes, never a tail the replay would offer to the next prompt.
 */
describe('stagedPlay · nestCellInBranchPick', () => {
  const activate = {type: 'or', index: 1, response: {type: 'card', cards: ['World Government Advisor']}};
  const branch = {type: 'or', index: 2, response: {type: 'option'}, for: {role: 'or', source: {kind: 'card', card: 'World Government Advisor'}}};

  it('the cell replaces the LAST or answer\'s response — its index and its address kept', () => {
    const out = nestCellInBranchPick([activate, branch], {type: 'space', spaceId: '33'});
    expect(out).deep.eq([activate, {...branch, response: {type: 'space', spaceId: '33'}}]);
  });

  it('the batch it was given is not mutated', () => {
    const batch = [activate, branch];
    nestCellInBranchPick(batch, {type: 'space', spaceId: '33'});
    expect(batch[1]).deep.eq(branch);
  });

  it('no or answer at all: the cell rides as the tail, never dropped', () => {
    expect(nestCellInBranchPick([{type: 'card', cards: []}], {type: 'space', spaceId: '12'})).deep.eq([{type: 'card', cards: []}, {type: 'space', spaceId: '12'}]);
  });
});
