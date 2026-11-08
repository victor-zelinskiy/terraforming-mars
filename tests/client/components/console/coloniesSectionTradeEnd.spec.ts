import {expect} from 'chai';
import ConsoleColoniesSection from '@/client/components/console/ConsoleColoniesSection.vue';

/*
 * WAIT GRAPH R7 — the colonies stage's ending after a TRADE. The trade's falling edge stands the completion down while
 * the trade fleet is still active (the fleet owns that window), so the fleet's OWN fall must re-ask it — otherwise the
 * stage stands with nothing owed until an unrelated edge happens by. The watchers are driven directly on a minimal
 * component context (mounting the whole section is an e2e's job).
 */
type Ctx = {
  focusState: {open: boolean},
  tradeState: {active: boolean},
  buildState: {active: boolean},
  tradeFleetState: {active: boolean},
  tradeEndOwed: boolean,
  completed: number,
  completeFlow(): void,
};

type Watcher = (this: Ctx, now: boolean, was: boolean) => void;

const watchers = (ConsoleColoniesSection as unknown as {watch: Record<string, Watcher>}).watch;

function ctx(over: Partial<Ctx> = {}): Ctx {
  return {
    focusState: {open: true},
    tradeState: {active: false},
    buildState: {active: false},
    tradeFleetState: {active: false},
    tradeEndOwed: false,
    completed: 0,
    completeFlow() {
      this.completed++;
    },
    ...over,
  };
}

describe('ConsoleColoniesSection — the trade ending is re-asked when the fleet ends (wait graph R7)', () => {
  const tradeEdge = watchers['tradeState.active'];
  const fleetEdge = watchers['tradeFleetState.active'];

  it('the trade falling with no fleet completes at once (unchanged)', () => {
    const c = ctx();
    tradeEdge.call(c, false, true);
    expect(c.completed).eq(1);
    expect(c.tradeEndOwed).eq(false);
  });

  it('the trade falling while the fleet flies OWES the ending, and the fleet’s fall pays it', () => {
    const c = ctx({tradeFleetState: {active: true}});
    tradeEdge.call(c, false, true);
    expect(c.completed, 'the fleet owns the window').eq(0);
    expect(c.tradeEndOwed).eq(true);
    c.tradeFleetState.active = false;
    fleetEdge.call(c, false, true);
    expect(c.completed, 'the fleet’s own fall re-asks the ending').eq(1);
    expect(c.tradeEndOwed).eq(false);
  });

  it('a fleet falling with no owed trade ending completes nothing (the normal dock, mid-trade)', () => {
    const c = ctx({tradeState: {active: true}});
    fleetEdge.call(c, false, true);
    expect(c.completed).eq(0);
  });

  it('a new trade armed before the fleet fell forgets the old owe', () => {
    const c = ctx({tradeFleetState: {active: true}});
    tradeEdge.call(c, false, true);
    c.tradeState.active = true;
    tradeEdge.call(c, true, false);
    expect(c.tradeEndOwed).eq(false);
    fleetEdge.call(c, false, true);
    expect(c.completed).eq(0);
  });

  it('a stage already folded owes nothing', () => {
    const c = ctx({tradeFleetState: {active: true}, focusState: {open: false}});
    tradeEdge.call(c, false, true);
    expect(c.tradeEndOwed).eq(false);
  });
});
