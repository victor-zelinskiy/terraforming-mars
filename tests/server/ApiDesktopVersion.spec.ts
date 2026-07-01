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
});
