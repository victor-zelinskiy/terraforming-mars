import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {
  handSelectState,
  enterClientHandSelect,
  resolveClientHandSelect,
  cancelClientHandSelect,
  toggleHandSelectSelection,
  isHandSelectable,
  handSelectReason,
  exitHandSelect,
} from '@/client/components/handCards/handSelectState';
import {handActionPickResult, deliverActionPick} from '@/client/components/handCards/handActionPick';

describe('client-driven hand card pick (Self-Replicating Robots etc.)', () => {
  afterEach(() => exitHandSelect());

  function enter(onResolve = () => {}, onCancel = () => {}) {
    enterClientHandSelect({
      title: 'Select card to link with Self-replicating Robots',
      buttonLabel: 'Link card',
      selectable: [CardName.ANTS, CardName.PREDATORS],
      reasons: {[CardName.TARDIGRADES]: 'No building or space tag'},
      onResolve,
      onCancel,
    });
  }

  it('enters a CLIENT pick: active + clientPick + selectable + per-card reasons', () => {
    enter();
    expect(handSelectState.active).is.true;
    expect(handSelectState.clientPick).is.true;
    expect(handSelectState.min).eq(1);
    expect(handSelectState.max).eq(1);
    expect(isHandSelectable(CardName.ANTS)).is.true;
    expect(isHandSelectable(CardName.TARDIGRADES)).is.false;
    expect(handSelectReason(CardName.TARDIGRADES)).eq('No building or space tag');
    expect(handSelectReason(CardName.ANTS)).eq(''); // selectable → no reason
  });

  it('single-pick REPLACES the previous selection (no deselect needed)', () => {
    enter();
    toggleHandSelectSelection(CardName.ANTS);
    expect(handSelectState.selected).deep.eq([CardName.ANTS]);
    toggleHandSelectSelection(CardName.PREDATORS);
    expect(handSelectState.selected).deep.eq([CardName.PREDATORS]); // replaced, not rejected
    // A non-selectable card is ignored.
    toggleHandSelectSelection(CardName.TARDIGRADES);
    expect(handSelectState.selected).deep.eq([CardName.PREDATORS]);
  });

  it('resolve fires onResolve with the picked names and exits the mode', () => {
    let resolved: ReadonlyArray<CardName> | undefined;
    enter((cards) => {
      resolved = cards;
    });
    toggleHandSelectSelection(CardName.ANTS);
    resolveClientHandSelect();
    expect(resolved).deep.eq([CardName.ANTS]);
    expect(handSelectState.active).is.false;
    expect(handSelectState.clientPick).is.false;
  });

  it('cancel fires onCancel and exits without resolving', () => {
    let cancelled = false;
    let resolved = false;
    enter(() => {
      resolved = true;
    }, () => {
      cancelled = true;
    });
    cancelClientHandSelect();
    expect(cancelled).is.true;
    expect(resolved).is.false;
    expect(handSelectState.active).is.false;
  });

  it('deliverActionPick bumps the bridge epoch every time (even for the same card)', () => {
    const start = handActionPickResult.epoch;
    deliverActionPick(CardName.ANTS);
    expect(handActionPickResult.card).eq(CardName.ANTS);
    expect(handActionPickResult.epoch).eq(start + 1);
    deliverActionPick(CardName.ANTS);
    expect(handActionPickResult.epoch).eq(start + 2);
  });
});
