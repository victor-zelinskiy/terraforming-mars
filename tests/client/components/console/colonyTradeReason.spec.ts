import {expect} from 'chai';
import {colonyTradeReason, ColonyTradeReasonInput} from '@/client/console/colonyTradeReason';
import {AVAILABILITY_BLOCKERS} from '@/common/availability/AvailabilityBlocker';
import {Color} from '@/common/Color';

// The ONE smart source of «why can't I trade at THIS colony» — PURE, runs under
// the server runner. The ladder is colony-intrinsic → no fleet → afford → turn;
// the generic turn message is ONLY the last resort (the regression this guards:
// pressing trade on your own docked colony read «finish your current action»).
describe('colonyTradeReason (console trade blocker ladder)', () => {
  const base = (over: Partial<ColonyTradeReasonInput> = {}): ColonyTradeReasonInput => ({
    colony: {name: 'Pluto', isActive: true, visitor: undefined},
    tradeable: [],
    viewerColor: 'red' as Color,
    availableFleets: 1,
    myTurn: true,
    awaitingInput: true,
    resolveName: (c) => (c === 'green' ? 'Бот' : String(c)),
    ...over,
  });

  it('a tradeable colony has NO blocker', () => {
    expect(colonyTradeReason(base({tradeable: ['Pluto']}))).to.eq(undefined);
  });

  it('the screenshot case: YOUR fleet is docked → «your fleet is here», NOT a turn message', () => {
    const r = colonyTradeReason(base({colony: {name: 'Pluto', isActive: true, visitor: 'red' as Color}, availableFleets: 0}));
    expect(r).to.deep.eq({key: 'Your trade fleet is currently here', intrinsic: true, blocker: AVAILABILITY_BLOCKERS.DOMAIN});
  });

  it('another player\'s fleet is docked → names them (intrinsic)', () => {
    const r = colonyTradeReason(base({colony: {name: 'Io', isActive: true, visitor: 'green' as Color}}));
    expect(r).to.deep.eq({key: 'Trade fleet of ${0} is currently here', params: ['Бот'], intrinsic: true, blocker: AVAILABILITY_BLOCKERS.DOMAIN});
  });

  it('a colony not built yet is intrinsic (beats turn/fleet)', () => {
    const r = colonyTradeReason(base({colony: {name: 'Titan', isActive: false, visitor: undefined}, availableFleets: 0, awaitingInput: false, myTurn: false}));
    expect(r).to.deep.eq({key: 'This colony is not active yet', intrinsic: true, blocker: AVAILABILITY_BLOCKERS.DOMAIN});
  });

  it('no free trade fleet → the real capability reason (not a turn message)', () => {
    const r = colonyTradeReason(base({availableFleets: 0}));
    expect(r).to.deep.eq({key: 'No trade fleet available', intrinsic: false, blocker: AVAILABILITY_BLOCKERS.DOMAIN});
  });

  it('a window open for OTHERS but this trade withheld → can\'t afford', () => {
    const r = colonyTradeReason(base({tradeable: ['Ganymede'], availableFleets: 1}));
    expect(r?.key).to.eq('Not enough resources to cover the cost');
  });

  it('action menu live + a free fleet but no trade offered → can\'t afford', () => {
    const r = colonyTradeReason(base({myTurn: true, availableFleets: 1, tradeable: []}));
    expect(r?.key).to.eq('Not enough resources to cover the cost');
  });

  it('genuinely mid a mandatory decision (no window, free fleet, not the action menu) → finish current action', () => {
    const r = colonyTradeReason(base({myTurn: false, awaitingInput: true, availableFleets: 1}));
    expect(r).to.deep.eq({key: 'Finish your current action first', intrinsic: false, blocker: AVAILABILITY_BLOCKERS.FINISH_CURRENT_ACTION});
  });

  it('genuine opponent turn → not your turn (last resort only)', () => {
    const r = colonyTradeReason(base({myTurn: false, awaitingInput: false, availableFleets: 1}));
    expect(r).to.deep.eq({key: 'Not your turn to take any actions', intrinsic: false, blocker: AVAILABILITY_BLOCKERS.NOT_YOUR_TURN});
  });

  /*
   * POTENTIAL vs EXECUTABLE NOW. The turn gate is the one rung of this ladder
   * that says nothing about the trade: every rule is satisfied, only the clock
   * is wrong. It must therefore paint the calm register and keep the trade in
   * the wheel's count — while a real trade rule (a docked fleet, an empty
   * supply, an unaffordable fee) does the opposite.
   */
  it('the turn gate is a WARNING that keeps the trade potentially available', () => {
    const r = colonyTradeReason(base({myTurn: false, awaitingInput: false, availableFleets: 1}));
    expect(r?.blocker.tone).to.eq('warning');
    expect(r?.blocker.affectsPotentialCount).to.eq(false);
    expect(r?.blocker.blocksExecutionNow, 'the commit must stay blocked').to.eq(true);
  });

  it('every REAL trade blocker is a DANGER that removes it from the count', () => {
    const cases = [
      base({availableFleets: 0}), // no free fleet
      base({colony: {name: 'Pluto', isActive: false, visitor: undefined}}), // not built
      base({colony: {name: 'Io', isActive: true, visitor: 'green' as Color}}), // docked
      base({myTurn: true, availableFleets: 1}), // can't pay the fee
    ];
    for (const input of cases) {
      const r = colonyTradeReason(input);
      expect(r?.blocker.tone, r?.key).to.eq('danger');
      expect(r?.blocker.affectsPotentialCount, r?.key).to.eq(true);
    }
  });
});
