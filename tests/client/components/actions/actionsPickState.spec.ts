import {expect} from 'chai';
import {
  actionsPickState,
  enterActionsPick,
  resolveActionsPick,
  cancelActionsPick,
  exitActionsPick,
  isActionsPickCandidate,
} from '@/client/components/actions/actionsPickState';
import {actionRepeatPickResult, deliverActionRepeatPick} from '@/client/components/actions/actionRepeatPick';
import {CardName} from '@/common/cards/CardName';

describe('actionsPickState', () => {
  afterEach(() => exitActionsPick());

  it('enter sets the state + candidates; resolve fires onResolve with the card + branch node and exits', () => {
    let resolved: {card: CardName, nodeIndex: number} | undefined;
    enterActionsPick({
      title: 'Choose an action to repeat',
      selectable: [CardName.REGOLITH_EATERS, CardName.SEARCH_FOR_LIFE],
      onResolve: (card, nodeIndex) => {
        resolved = {card, nodeIndex};
      },
    });
    expect(actionsPickState.active).is.true;
    expect(actionsPickState.selectable).deep.eq([CardName.REGOLITH_EATERS, CardName.SEARCH_FOR_LIFE]);
    expect(isActionsPickCandidate(CardName.REGOLITH_EATERS)).is.true;
    expect(isActionsPickCandidate(CardName.ANTS)).is.false;

    // A split action's 2nd branch (nodeIndex 1).
    resolveActionsPick(CardName.REGOLITH_EATERS, 1);
    expect(resolved).deep.eq({card: CardName.REGOLITH_EATERS, nodeIndex: 1});
    // Resolve EXITS the state BEFORE firing the callback, so the activeOverlay
    // cancel-net never mistakes a resolve for an abandon.
    expect(actionsPickState.active).is.false;
  });

  it('resolve ignores a non-candidate card', () => {
    let resolved: CardName | undefined;
    enterActionsPick({title: '', selectable: [CardName.ANTS], onResolve: (c) => {
      resolved = c;
    }});
    resolveActionsPick(CardName.PREDATORS); // not a candidate
    expect(resolved).is.undefined;
    expect(actionsPickState.active).is.true; // still waiting
  });

  it('cancel exits WITHOUT firing onResolve', () => {
    let resolved: CardName | undefined;
    enterActionsPick({title: '', selectable: [CardName.ANTS], onResolve: (c) => {
      resolved = c;
    }});
    cancelActionsPick();
    expect(resolved).is.undefined;
    expect(actionsPickState.active).is.false;
  });

  it('deliverActionRepeatPick carries the branch node + bumps the epoch each time', () => {
    const before = actionRepeatPickResult.epoch;
    deliverActionRepeatPick(CardName.REGOLITH_EATERS, 1);
    expect(actionRepeatPickResult.epoch).eq(before + 1);
    expect(actionRepeatPickResult.card).eq(CardName.REGOLITH_EATERS);
    expect(actionRepeatPickResult.nodeIndex).eq(1);
    // Two picks of the SAME card both fire (epoch bumps); default node is 0.
    deliverActionRepeatPick(CardName.ANTS);
    expect(actionRepeatPickResult.epoch).eq(before + 2);
    expect(actionRepeatPickResult.nodeIndex).eq(0);
  });
});
