import {expect} from 'chai';
import {CompatSnapshot, resolveUpdateDecision} from '../../electron/updatePolicy';

// Pure unit test of the Phase 8 last-known-good update policy.
//   npx mocha --import=tsx "tests/electron/updatePolicy.spec.ts"

const compatible: CompatSnapshot = {latestVersion: '1.4.0', minSupportedVersion: '1.0.0', updateRequired: false};
const required: CompatSnapshot = {latestVersion: '1.4.0', minSupportedVersion: '1.4.0', updateRequired: true};

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
});
