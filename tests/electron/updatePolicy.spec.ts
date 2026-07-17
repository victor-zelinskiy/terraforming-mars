import {expect} from 'chai';
import {CompatSnapshot, planPostPendingBridge, resolveUpdateDecision, restartMarkerStamp} from '../../electron/updatePolicy';

// Pure unit test of the Phase 8 last-known-good update policy.
//   npx mocha --import=tsx "tests/electron/updatePolicy.spec.ts"

const compatible: CompatSnapshot = {latestVersion: '1.4.0', minSupportedVersion: '1.0.0', updateRequired: false};
const required: CompatSnapshot = {latestVersion: '1.4.0', minSupportedVersion: '1.4.0', updateRequired: true};
// CI is building 1.5.0. The gate reports it alongside whatever it currently knows.
const buildPending: CompatSnapshot = {...compatible, buildInProgress: true, pendingVersion: '1.5.0'};
const buildPendingAndRequired: CompatSnapshot = {...required, buildInProgress: true, pendingVersion: '1.5.0'};

describe('electron/updatePolicy resolveUpdateDecision', () => {
  it('a fresh result is authoritative (required)', () => {
    const d = resolveUpdateDecision({fresh: required, cached: compatible, strictOffline: false});
    expect(d.mode).to.eq('required');
    expect(d.usedCache).to.be.false;
    expect(d.info).to.eq(required);
  });

  it('a fresh result is authoritative (compatible)', () => {
    const d = resolveUpdateDecision({fresh: compatible, cached: required, strictOffline: true});
    expect(d.mode).to.eq('normal');
    expect(d.usedCache).to.be.false;
  });

  it('offline + last-known-good REQUIRED → offlineBlocked (no silent unlock)', () => {
    const d = resolveUpdateDecision({fresh: undefined, cached: required, strictOffline: false});
    expect(d.mode).to.eq('offlineBlocked');
    expect(d.usedCache).to.be.true;
    expect(d.info).to.eq(required);
  });

  it('offline + last-known-good COMPATIBLE → normal (fail-open)', () => {
    const d = resolveUpdateDecision({fresh: undefined, cached: compatible, strictOffline: false});
    expect(d.mode).to.eq('normal');
    expect(d.usedCache).to.be.true;
  });

  it('offline + never verified + NOT strict → normal (do not brick first-run offline)', () => {
    const d = resolveUpdateDecision({fresh: undefined, cached: undefined, strictOffline: false});
    expect(d.mode).to.eq('normal');
    expect(d.usedCache).to.be.false;
    expect(d.info).to.be.undefined;
  });

  it('offline + never verified + STRICT → offlineBlocked', () => {
    const d = resolveUpdateDecision({fresh: undefined, cached: undefined, strictOffline: true});
    expect(d.mode).to.eq('offlineBlocked');
  });

  it('strict offline does NOT block when a compatible last-known-good exists', () => {
    const d = resolveUpdateDecision({fresh: undefined, cached: compatible, strictOffline: true});
    expect(d.mode).to.eq('normal');
  });

  describe('pending CI build', () => {
    it('a fresh build-in-progress → pending (wait for it)', () => {
      const d = resolveUpdateDecision({fresh: buildPending, cached: undefined, strictOffline: false});
      expect(d.mode).to.eq('pending');
      expect(d.info).to.eq(buildPending);
      expect(d.usedCache).to.be.false;
    });

    it('a pending build OUTRANKS an available required update (never update twice)', () => {
      const d = resolveUpdateDecision({fresh: buildPendingAndRequired, cached: undefined, strictOffline: false});
      expect(d.mode).to.eq('pending');
    });

    it('once the build lands (no longer in progress) the required update takes over', () => {
      const d = resolveUpdateDecision({fresh: required, cached: buildPendingAndRequired, strictOffline: false});
      expect(d.mode).to.eq('required');
    });

    it('a CACHED build-in-progress is ignored offline (that build finished long ago)', () => {
      // Falls back to the cached snapshot's own updateRequired, never to a stale 'pending' lock.
      const d = resolveUpdateDecision({fresh: undefined, cached: buildPendingAndRequired, strictOffline: false});
      expect(d.mode).to.eq('offlineBlocked');
      expect(d.usedCache).to.be.true;
    });

    it('a cached build-in-progress on a COMPATIBLE snapshot still fails open offline', () => {
      const d = resolveUpdateDecision({fresh: undefined, cached: buildPending, strictOffline: false});
      expect(d.mode).to.eq('normal');
    });
  });
});

describe('electron/updatePolicy planPostPendingBridge', () => {
  const MAX = 4;

  it('starts the bridge (full budget) on the first settled run right after pending', () => {
    const r = planPostPendingBridge({settled: true, wasPending: true, ticksRemaining: 0, maxTicks: MAX});
    expect(r).to.deep.equal({keepPolling: true, ticksRemaining: MAX});
  });

  it('counts the budget down on subsequent settled runs and stops at zero', () => {
    let ticks = MAX;
    const seen: number[] = [];
    for (let i = 0; i < MAX + 1; i++) {
      const r = planPostPendingBridge({settled: true, wasPending: false, ticksRemaining: ticks, maxTicks: MAX});
      ticks = r.ticksRemaining;
      seen.push(ticks);
    }
    expect(seen).to.deep.equal([3, 2, 1, 0, 0]);
    // the last run with ticks already 0 must NOT keep polling
    expect(planPostPendingBridge({settled: true, wasPending: false, ticksRemaining: 0, maxTicks: MAX}).keepPolling).to.be.false;
  });

  it('does NOT bridge on an ordinary settled run (never pending, no budget) — no in-game/idle churn', () => {
    const r = planPostPendingBridge({settled: true, wasPending: false, ticksRemaining: 0, maxTicks: MAX});
    expect(r).to.deep.equal({keepPolling: false, ticksRemaining: 0});
  });

  it('resets on a non-settled decision (pending re-arms itself / required takes over)', () => {
    const r = planPostPendingBridge({settled: false, wasPending: false, ticksRemaining: 3, maxTicks: MAX});
    expect(r).to.deep.equal({keepPolling: false, ticksRemaining: 0});
  });
});

describe('electron/updatePolicy restartMarkerStamp', () => {
  it('stamps the AppImage identity for the wrapper apply-wait, mtime floored to whole SECONDS (stat -c %Y)', () => {
    // The wrapper parses `read -r tag ino mtime` and compares against `stat -c '%i %Y'`
    // — three space-separated tokens, seconds precision.
    expect(restartMarkerStamp({ino: 123456, mtimeMs: 1752760661987})).to.eq('applying 123456 1752760661');
  });

  it('degrades to the legacy bare timestamp when the AppImage identity is unknown', () => {
    // A NEW wrapper treats a non-`applying` marker as "relaunch immediately" (old behaviour);
    // an OLD wrapper never reads the content at all — every pairing stays safe.
    expect(restartMarkerStamp(undefined, 1752760661987)).to.eq('1752760661987');
  });
});
