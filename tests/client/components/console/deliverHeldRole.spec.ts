import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {armDeliveryHold, deliverHeldRole, resetHandDelivery, runHandDelivery} from '@/client/console/handDock/handDeliveryDirector';
import {handDeliveryState} from '@/client/console/handDock/handDeliveryState';

/*
 * THE HOLD WHOSE PRESS WENT BY ANOTHER ROAD (the box's game 2607 — `start-shadow/cure/release/game/none`,
 * `unsettled: handDeliveryState.held`): the start's bought cards are withheld until the pay confirm flies them; a
 * payment answered while the start stood folded never ran that confirm, and the hold stood for the rest of the deal.
 */
describe('handDeliveryDirector — deliverHeldRole', () => {
  afterEach(() => {
    resetHandDelivery();
  });

  it('a role still holding past its press: its OWN cards leave the withhold — the dock never sticks short', () => {
    armDeliveryHold('bought', 'deal-1', [CardName.FISH, CardName.ANTS]);
    expect(handDeliveryState.held).to.deep.equal([CardName.FISH, CardName.ANTS]);
    expect(deliverHeldRole('bought'), 'it delivered').to.equal(true);
    expect(handDeliveryState.held, 'nothing withheld any more').to.deep.equal([]);
    expect(deliverHeldRole('bought'), 'once — the episode flies, it does not hold').to.equal(false);
  });

  it('a role whose confirm already flew it: a no-op — nothing re-delivered, another role\'s hold untouched', () => {
    armDeliveryHold('bought', 'deal-1', [CardName.FISH]);
    runHandDelivery('bought', [CardName.FISH], new Map());
    armDeliveryHold('legacy', 'deal-1', [CardName.ANTS]);
    expect(deliverHeldRole('bought')).to.equal(false);
    expect(handDeliveryState.held, 'the legacy cards stay withheld — they are another press\'s').to.deep.equal([CardName.ANTS]);
  });

  it('no episode at all: a no-op', () => {
    expect(deliverHeldRole('bought')).to.equal(false);
    expect(handDeliveryState.held).to.deep.equal([]);
  });
});
