import {expect} from 'chai';
import {isReactive, ref, watch} from 'vue';
import {createManualClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {dumpFlowTree, resetFlowKernel} from '@/client/console/kernel/flowScope';
import {beginConsoleSession, consoleSessionScope, endConsoleSession, resetConsoleSession} from '@/client/console/session/consoleSession';
import {scopedState} from '@/client/console/session/scopedState';

/**
 * A LATCH IS A SCOPE (architecture v2 — PLAN §11 · S6; `session/scopedState.ts`). «Pending / owed / armed» written as a
 * bare `ref` is a flag every exit path must remember to lower; as `scopedState` it is a `Ref` for every reader and
 * writer — and each raised span of it is a `step` scope: owned, named with its age in the tree, and lowered BY ITSELF
 * when its owner ends.
 */
describe('scopedState — a latch is a scope of the flow tree', () => {
  beforeEach(() => {
    resetFlowKernel();
    resetConsoleSession();
    resetFlowKernel();
    setFlowClock(createManualClock(0));
  });
  afterEach(() => {
    resetConsoleSession();
    setFlowClock(undefined);
  });

  const standing = (label: string): Array<string> => dumpFlowTree().filter((line) => line.includes(`step:${label}#`));

  it('reads and writes like the `ref` it replaces — and every RAISED span stands in the tree', () => {
    beginConsoleSession();
    const owed = scopedState('commit-fold-owed', false);
    const seen: Array<boolean> = [];
    watch(owed, (value) => seen.push(value), {flush: 'sync'});
    expect(owed.value).to.equal(false);
    expect(standing('commit-fold-owed'), 'at rest: nothing stands').to.deep.eq([]);

    owed.value = true;
    owed.value = true; // unchanged: no second scope, no trigger
    expect(owed.value).to.equal(true);
    expect(standing('commit-fold-owed')).to.have.length(1);
    expect(seen).to.deep.eq([true]);

    owed.value = false;
    expect(standing('commit-fold-owed'), 'lowered: the scope ended').to.deep.eq([]);
    expect(seen).to.deep.eq([true, false]);
  });

  it('THE OWNER ENDED UNDER A RAISED LATCH: it falls back to rest by itself — nobody had to remember', () => {
    beginConsoleSession();
    const frame = consoleSessionScope().open('frame', 'card-actions');
    const owed = scopedState('commit-fold-owed', false, () => frame);
    const seen: Array<boolean> = [];
    watch(owed, (value) => seen.push(value), {flush: 'sync'});
    owed.value = true;
    expect(dumpFlowTree().some((line) => line.includes('step:commit-fold-owed#')), 'it stands inside its owner').to.equal(true);

    frame.end(); // the early `return` that never lowered it no longer matters
    expect(owed.value).to.equal(false);
    expect(seen, 'readers are told').to.deep.eq([true, false]);

    // …and a latch whose named owner is gone is the session's: it is still raised, named and ended.
    owed.value = true;
    expect(owed.value).to.equal(true);
    endConsoleSession();
    expect(owed.value, 'the game screen left').to.equal(false);
  });

  it('any value that is not `rest` is «raised»: a held record, a non-empty latch string — one span while it stands', () => {
    beginConsoleSession();
    const zone = scopedState('colony-embed-latch', '');
    zone.value = 'hand';
    zone.value = 'card-actions'; // still raised: the same span
    expect(standing('colony-embed-latch')).to.have.length(1);
    zone.value = '';
    expect(standing('colony-embed-latch')).to.deep.eq([]);

    const pick = scopedState('task-space-pending', undefined as {index: number, tags: Array<string>} | undefined);
    const plain = ref(undefined as {index: number, tags: Array<string>} | undefined);
    const record = {index: 2, tags: ['a']};
    pick.value = record;
    plain.value = record;
    expect(isReactive(pick.value), 'an assigned object is reactive, as under `ref`').to.equal(isReactive(plain.value));
    let touched = 0;
    watch(() => pick.value?.tags.length, () => touched++, {flush: 'sync'});
    pick.value?.tags.push('b');
    expect(touched, 'a nested write reaches a reader').to.equal(1);
    pick.value = record; // the same raw record: unchanged
    expect(standing('task-space-pending')).to.have.length(1);
    pick.value = undefined;
    expect(standing('task-space-pending')).to.deep.eq([]);
  });
});
