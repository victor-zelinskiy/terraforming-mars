import {expect} from 'chai';
import {colonyTradeReason, ColonyTradeReasonInput} from '@/client/console/colonyTradeReason';
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
    expect(r).to.deep.eq({key: 'Your trade fleet is currently here', intrinsic: true});
  });

  it('another player\'s fleet is docked → names them (intrinsic)', () => {
    const r = colonyTradeReason(base({colony: {name: 'Io', isActive: true, visitor: 'green' as Color}}));
    expect(r).to.deep.eq({key: 'Trade fleet of ${0} is currently here', params: ['Бот'], intrinsic: true});
  });

  it('a colony not built yet is intrinsic (beats turn/fleet)', () => {
    const r = colonyTradeReason(base({colony: {name: 'Titan', isActive: false, visitor: undefined}, availableFleets: 0, awaitingInput: false, myTurn: false}));
    expect(r).to.deep.eq({key: 'This colony is not active yet', intrinsic: true});
  });

  it('no free trade fleet → the real capability reason (not a turn message)', () => {
    const r = colonyTradeReason(base({availableFleets: 0}));
    expect(r).to.deep.eq({key: 'No trade fleet available', intrinsic: false});
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
    expect(r).to.deep.eq({key: 'Finish your current action first', intrinsic: false});
  });

  it('genuine opponent turn → not your turn (last resort only)', () => {
    const r = colonyTradeReason(base({myTurn: false, awaitingInput: false, availableFleets: 1}));
    expect(r).to.deep.eq({key: 'Not your turn to take any actions', intrinsic: false});
  });
});
