import {expect} from 'chai';
import {compareVersions, computeDesktopVersion} from '../../src/common/models/DesktopVersionModel';

// Pure unit test of the desktop compatibility logic.
//   npx mocha --import=tsx "tests/server/ApiDesktopVersion.spec.ts"

const BASE = {
  latestVersion: '1.4.0',
  minSupportedVersion: '1.2.0',
  serverProtocolVersion: 1,
  channel: 'latest',
  platform: 'win32',
  releaseNotes: ['a', 'b'],
} as const;

describe('common/DesktopVersionModel', () => {
  describe('compareVersions', () => {
    it('orders x.y.z numerically', () => {
      expect(compareVersions('1.2.0', '1.2.0')).to.eq(0);
      expect(compareVersions('1.1.9', '1.2.0')).to.eq(-1);
      expect(compareVersions('1.2.1', '1.2.0')).to.eq(1);
      expect(compareVersions('1.10.0', '1.9.0')).to.eq(1); // numeric, not lexical
      expect(compareVersions('2.0.0', '1.99.99')).to.eq(1);
      expect(compareVersions('1.2', '1.2.0')).to.eq(0); // missing parts = 0
    });
  });

  describe('computeDesktopVersion', () => {
    it('requires an update when current < min', () => {
      const m = computeDesktopVersion({...BASE, currentVersion: '1.1.0'});
      expect(m.updateRequired).to.be.true;
      expect(m.latestVersion).to.eq('1.4.0');
      expect(m.minSupportedVersion).to.eq('1.2.0');
      expect(m.releaseNotes).to.deep.eq(['a', 'b']);
    });

    it('does not require an update when current >= min', () => {
      expect(computeDesktopVersion({...BASE, currentVersion: '1.2.0'}).updateRequired).to.be.false;
      expect(computeDesktopVersion({...BASE, currentVersion: '1.5.0'}).updateRequired).to.be.false;
    });

    it('does not require an update when current is unknown (no ?current)', () => {
      expect(computeDesktopVersion({...BASE}).updateRequired).to.be.false;
      expect(computeDesktopVersion({...BASE, currentVersion: ''}).updateRequired).to.be.false;
    });

    it('forceUpdate overrides regardless of version', () => {
      const m = computeDesktopVersion({...BASE, currentVersion: '9.9.9', forceUpdate: true});
      expect(m.updateRequired).to.be.true;
    });

    it('requireLatest requires an update when current < latest (even if >= min)', () => {
      // 1.3.0 is >= min (1.2.0) but < latest (1.4.0) → required only with requireLatest.
      expect(computeDesktopVersion({...BASE, currentVersion: '1.3.0', requireLatest: true}).updateRequired).to.be.true;
    });

    it('requireLatest does not require an update at/above latest', () => {
      expect(computeDesktopVersion({...BASE, currentVersion: '1.4.0', requireLatest: true}).updateRequired).to.be.false;
      expect(computeDesktopVersion({...BASE, currentVersion: '1.5.0', requireLatest: true}).updateRequired).to.be.false;
    });

    it('without requireLatest, current below latest but >= min is NOT required (historical)', () => {
      expect(computeDesktopVersion({...BASE, currentVersion: '1.3.0'}).updateRequired).to.be.false;
    });

    it('passes through channel/platform/protocol/downloadUrl', () => {
      const m = computeDesktopVersion({...BASE, platform: 'darwin', downloadUrl: 'https://x/y.exe'});
      expect(m.platform).to.eq('darwin');
      expect(m.channel).to.eq('latest');
      expect(m.serverProtocolVersion).to.eq(1);
      expect(m.downloadUrl).to.eq('https://x/y.exe');
    });

    it('copies releaseNotes (no shared mutable reference)', () => {
      const notes = ['x'];
      const m = computeDesktopVersion({...BASE, releaseNotes: notes});
      m.releaseNotes.push('y');
      expect(notes).to.deep.eq(['x']);
    });
  });

  describe('computeDesktopVersion — buildInProgress (waiting for a CI build)', () => {
    it('reports buildInProgress when a NEWER build is pending and no update is required yet', () => {
      // current == latest (not required), but a build for a newer version is running.
      const m = computeDesktopVersion({...BASE, currentVersion: '1.4.0', requireLatest: true, pendingVersion: '1.4.1'});
      expect(m.updateRequired).to.be.false;
      expect(m.buildInProgress).to.be.true;
      expect(m.pendingVersion).to.eq('1.4.1');
    });

    it('does not report buildInProgress when the pending build is not newer than current', () => {
      const m = computeDesktopVersion({...BASE, currentVersion: '1.4.0', requireLatest: true, pendingVersion: '1.4.0'});
      expect(m.buildInProgress).to.be.false;
      expect(m.pendingVersion).to.be.undefined;
    });

    it('an already-available required update wins over a pending build (buildInProgress suppressed)', () => {
      // current < latest → updateRequired; even with a newer pending build, download now.
      const m = computeDesktopVersion({...BASE, currentVersion: '1.3.0', requireLatest: true, pendingVersion: '1.5.0'});
      expect(m.updateRequired).to.be.true;
      expect(m.buildInProgress).to.be.false;
      expect(m.pendingVersion).to.be.undefined;
    });

    it('no pendingVersion (no build running) → buildInProgress false', () => {
      const m = computeDesktopVersion({...BASE, currentVersion: '1.4.0'});
      expect(m.buildInProgress).to.be.false;
      expect(m.pendingVersion).to.be.undefined;
    });

    it('unknown current version → buildInProgress false even with a pending build', () => {
      const m = computeDesktopVersion({...BASE, pendingVersion: '1.9.0'});
      expect(m.buildInProgress).to.be.false;
    });
  });
});
