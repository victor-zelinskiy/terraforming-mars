import {expect} from 'chai';
import {
  STDP_HOLD_MS,
  STDP_SWEEP_PEAK_MS,
  abortStdProjectCommit,
  armStdProjectCommit,
  detectStdProjectCommit,
  releaseStdProjectCommit,
  resetStdProjectCommit,
  runStdProjectCommit,
  stdProjectCommitActive,
  stdProjectCommitBeatMs,
  stdProjectCommitState,
  stdProjectCommitted,
} from '@/client/console/consoleStdProjectCommit';

describe('consoleStdProjectCommit — the terminal commit phrase', () => {
  afterEach(() => {
    // Module state is bundle-shared in mochapack — never leak a live phrase.
    resetStdProjectCommit();
  });

  it('the press answers FIRST — armed synchronously, before any response', () => {
    armStdProjectCommit('Power Plant:SP');
    expect(stdProjectCommitState.phase).to.eq('press');
    expect(stdProjectCommitState.card).to.eq('Power Plant:SP');
    expect(stdProjectCommitActive()).to.eq(true);
    // …and that arm is exactly what the WaitingFor gate detects.
    expect(detectStdProjectCommit()).to.eq(true);
  });

  it('only an ARMED press is detected (desktop / non-terminal submits are a no-op)', () => {
    expect(detectStdProjectCommit()).to.eq(false);
    armStdProjectCommit('Asteroid:SP');
    releaseStdProjectCommit(); // a target follow-up arrived — no gold is owed
    expect(detectStdProjectCommit()).to.eq(false);
    expect(stdProjectCommitActive()).to.eq(false);
  });

  it('the run resolves at the sweep PEAK, and the row is committed by then', async () => {
    armStdProjectCommit('Asteroid:SP');
    const run = runStdProjectCommit();
    // The sweep is on screen while the world is still held back.
    expect(stdProjectCommitState.phase).to.eq('committing');
    expect(stdProjectCommitted()).to.eq(false);
    await run;
    // The gate opens ON the crest — this is the frame the delta chips land in.
    expect(stdProjectCommitted()).to.eq(true);
  });

  it('a REFUSAL unwinds the press with no gold and no credit', () => {
    armStdProjectCommit('Asteroid:SP');
    const before = stdProjectCommitState.abortNonce;
    abortStdProjectCommit();
    expect(stdProjectCommitState.phase).to.eq('idle');
    expect(stdProjectCommitState.card).to.eq('');
    // The nonce is what re-enables the row (the screen watches it).
    expect(stdProjectCommitState.abortNonce).to.eq(before + 1);
  });

  it('aborting an idle phrase is a no-op (never a phantom rollback)', () => {
    const before = stdProjectCommitState.abortNonce;
    abortStdProjectCommit();
    expect(stdProjectCommitState.abortNonce).to.eq(before);
  });

  it('the whole beat stays SHORT — the read, never a ceremony', () => {
    // The dismiss gates on the phrase's own length, so this is the number the
    // player waits: the crest plus the read after it. The flat 950 ms timer it
    // replaced is the ceiling it must stay under.
    expect(stdProjectCommitBeatMs()).to.be.at.most(950);
    expect(stdProjectCommitBeatMs()).to.eq(STDP_SWEEP_PEAK_MS + STDP_HOLD_MS);
  });
});
