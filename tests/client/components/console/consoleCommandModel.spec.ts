import {expect} from 'chai';
import {planCommandRun, defaultDropPriority, CommandFitEntry} from '@/client/console/consoleCommandModel';

function entry(width: number, keep = false, dropPriority = 2): CommandFitEntry {
  return {width, keep, dropPriority};
}

describe('consoleCommandModel', () => {
  it('keeps every command when the run fits the zones', () => {
    const plan = planCommandRun([entry(5), entry(6), entry(4, true)], 10, 10);
    expect(plan.kept).to.deep.eq([0, 1, 2]);
    expect(plan.dropped).to.be.empty;
  });

  it('drops the highest drop-priority command first, never a keep', () => {
    const run = [
      entry(6, true, 0), // A — keep
      entry(6, false, 1), // X verb
      entry(6, false, 3), // global hint — drops first
      entry(6, true, 0), // B — keep
    ];
    const plan = planCommandRun(run, 5, 14); // budget 19 < 24
    expect(plan.dropped).to.deep.eq([2]);
    expect(plan.kept).to.deep.eq([0, 1, 3]);
  });

  it('among equal priorities drops the widest (frees the most room)', () => {
    const run = [entry(4, false, 2), entry(9, false, 2), entry(5, true, 0)];
    const plan = planCommandRun(run, 4, 6); // budget 10 < 18
    expect(plan.dropped).to.deep.eq([1]);
  });

  it('renders all keeps even when they alone overflow (CSS is the last resort)', () => {
    const run = [entry(8, true, 0), entry(9, true, 0)];
    const plan = planCommandRun(run, 3, 4);
    expect(plan.kept).to.deep.eq([0, 1]);
    expect(plan.dropped).to.be.empty;
  });

  it('preserves original order in kept and computes a sane split', () => {
    const run = [entry(3), entry(3), entry(3, true), entry(3, true)];
    const plan = planCommandRun(run, 6, 6);
    expect(plan.kept).to.deep.eq([0, 1, 2, 3]);
    expect(plan.splitIndex).to.be.within(0, 4);
  });

  it('defaultDropPriority: primary verbs lowest, chords mid, global hints highest', () => {
    expect(defaultDropPriority('confirm')).to.eq(0);
    expect(defaultDropPriority('back')).to.eq(0);
    expect(defaultDropPriority('secondary')).to.eq(1);
    expect(defaultDropPriority('bumperL')).to.eq(2);
    expect(defaultDropPriority('triggerR')).to.eq(2);
    expect(defaultDropPriority('view')).to.eq(3);
    expect(defaultDropPriority('stickL')).to.eq(3);
    expect(defaultDropPriority('dpad')).to.eq(3);
  });
});
