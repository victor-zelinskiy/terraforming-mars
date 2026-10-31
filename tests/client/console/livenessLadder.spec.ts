import {expect} from 'chai';
import {livenessLadder, runLivenessRung} from '@/client/console/consoleLiveness';
// The modules that own a rung register it at import — the shell's own two (workspace-beat · stack-home) are
// registered at the shell's mount and are not in this bundle.
import '@/client/console/presentationLedger';
import '@/client/console/consoleForegroundWatchdog';
import '@/client/console/consoleWorkspaceOutcome';
import '@/client/console/colonyTrade/consoleColonyTrade';
import '@/client/console/cardDiscard/consoleCardDiscard';
import '@/client/console/transport/gameTransport';
import {claimWorkspaceOutcome, resetWorkspaceOutcome, workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {armColonyTrade, colonyTradeState, resetColonyTrade} from '@/client/console/colonyTrade/consoleColonyTrade';
import {ColonyName} from '@/common/colonies/ColonyName';
import type {Color} from '@/common/Color';

/**
 * THE LIVENESS LADDER AS THE MODULES COMPOSE IT: the order is the order of how much truth a rung restores and how
 * little it destroys — the presentation debts first, then the holds and claims, then the flows, then the transport.
 * A new owner of a wedge registers its release here; a rung that is not on this list is a cure the arbiter cannot run.
 */
describe('the liveness ladder', () => {
  afterEach(() => {
    resetWorkspaceOutcome();
    resetColonyTrade();
  });

  it('is composed in rank order: debts → foreground → flows → transport', () => {
    // Within one rank the order is the modules' import order — immaterial (a rank runs whole); across ranks it is the law.
    const ranks = livenessLadder().map((r) => r.rank);
    expect([...ranks].sort((a, b) => a - b)).to.deep.equal(ranks);
    const byRank = new Map<number, Array<string>>();
    for (const r of livenessLadder()) {
      byRank.set(r.rank, [...(byRank.get(r.rank) ?? []), r.name].sort());
    }
    expect([...byRank.entries()]).to.deep.equal([
      [0, ['presentation-ledger']],
      [10, ['foreground']],
      [20, ['card-discard', 'colony-trade', 'workspace-outcome']],
      [22, ['transport']],
    ]);
  });

  it('the flows\' rung releases a standing claim with force and concludes a live trade — and says so', () => {
    claimWorkspaceOutcome('card-actions', 'Some Card', ['deck-check'], 0);
    armColonyTrade(ColonyName.LUNA, 'blue' as Color);
    expect(workspaceOutcomeState.sourceCard).to.equal('Some Card');
    expect(colonyTradeState.active).is.true;
    const did = runLivenessRung(2);
    expect(did).to.contain('workspace-outcome: released card-actions/Some Card [deck-check]');
    expect(did).to.contain('colony-trade: concluded Luna');
    expect(workspaceOutcomeState.sourceCard).to.equal('');
    expect(colonyTradeState.active).is.false;
    // Nothing standing → every release of the rank says nothing.
    expect(runLivenessRung(2)).to.equal('rank 20: nothing to release');
  });

  it('the transport rung never cuts a request still on the wire', () => {
    // No root → nothing to release (the funnel is the root's); the rung is quiet, never throws.
    expect(runLivenessRung(3)).to.equal('rank 22: nothing to release');
  });
});
