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

  it('enter sets the state + candidates; resolve fires onResolve with the card and exits', () => {
    let resolved: CardName | undefined;
    enterActionsPick({
      title: 'Choose an action to repeat',
      selectable: [CardName.REGOLITH_EATERS, CardName.SEARCH_FOR_LIFE],
      onResolve: (card) => {
        resolved = card;
      },
    });
    expect(actionsPickState.active).is.true;
    expect(actionsPickState.selectable).deep.eq([CardName.REGOLITH_EATERS, CardName.SEARCH_FOR_LIFE]);
    expect(isActionsPickCandidate(CardName.REGOLITH_EATERS)).is.true;
    expect(isActionsPickCandidate(CardName.ANTS)).is.false;

    resolveActionsPick(CardName.SEARCH_FOR_LIFE);
    expect(resolved).eq(CardName.SEARCH_FOR_LIFE);
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

  it('deliverActionRepeatPick bumps the epoch each time (so two picks of the SAME card both fire)', () => {
    const before = actionRepeatPickResult.epoch;
    deliverActionRepeatPick(CardName.ANTS);
    expect(actionRepeatPickResult.epoch).eq(before + 1);
    expect(actionRepeatPickResult.card).eq(CardName.ANTS);
    deliverActionRepeatPick(CardName.ANTS);
    expect(actionRepeatPickResult.epoch).eq(before + 2);
  });
});
