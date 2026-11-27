import {expect} from 'chai';
import {planCommandRun, defaultDropPriority, CommandFitEntry, commandKeeps, ConsoleCommand} from '@/client/console/consoleCommandModel';
import {multiPickConfirmCommand} from '@/client/components/console/consoleHandSelectModel';

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

  it('a narrow bar keeps a multi pick\'s COMMIT — A, B and the RT whose priority is zero never drop (CI\'s bottle, Pluto\'s discard in «Действия карт»)', () => {
    const cmds: Array<ConsoleCommand> = [
      {control: 'confirm', label: 'Select / Deselect'},
      {control: 'stickR', label: 'Select all', priority: 1},
      {control: 'triggerR', ...multiPickConfirmCommand('Discard', {min: 1, max: 1}, 0)},
      {control: 'secondary', label: 'Inspect', priority: 3},
      {control: 'stickL', label: 'Source', priority: 1},
      {control: 'back', label: 'Minimize'},
    ];
    const entries = cmds.map((c) => ({width: 8, keep: commandKeeps(c), dropPriority: c.priority ?? defaultDropPriority(c.control)}));
    // Room for two commands and a half: every hint goes, the commit stays beside A and B.
    const kept = planCommandRun(entries, 10, 10).kept.map((i) => cmds[i].control);
    expect(kept).to.deep.eq(['confirm', 'triggerR', 'back']);
    expect(commandKeeps({control: 'triggerR', priority: 1}), 'a hint on RT still drops').to.eq(false);
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
