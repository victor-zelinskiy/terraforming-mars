import {expect} from 'chai';
import {lanDisplayName, lanInstanceName, toLanHostInfo} from '../../src/server/embedded/lanDiscovery';

// LAN discovery for host-as-server mode (docs/EMBEDDED_SERVER.md §5-6). The socket half runs
// inside the embedded-server utility process; the pure naming + mapping rules are unit-tested here.
//   npx mocha --import=tsx "tests/electron/lanDiscovery.spec.ts"

describe('embedded/lanDiscovery', () => {
  describe('lanDisplayName', () => {
    it('uses the trimmed profile name', () => {
      expect(lanDisplayName('  Виктор  ', 'HOST')).to.eq('Виктор');
    });
    it('falls back to the hostname when the profile name is blank', () => {
      expect(lanDisplayName('   ', 'HOST')).to.eq('HOST');
    });
  });

  describe('lanInstanceName', () => {
    it('carries the hostname so the instance is unique per machine', () => {
      expect(lanInstanceName('admin', 1, 'Victor')).to.eq('admin (Victor)');
    });
    // The conflict case this fork actually hits: a dev build running beside the packaged
    // one (or an orphaned utility process) already owns `admin (Victor)._tmars._tcp.local`.
    it('disambiguates later attempts, RFC 6762 §9 style', () => {
      expect(lanInstanceName('admin', 2, 'Victor')).to.eq('admin (Victor) (2)');
      expect(lanInstanceName('admin', 5, 'Victor')).to.eq('admin (Victor) (5)');
    });
    it('gives every attempt a distinct name', () => {
      const names = [1, 2, 3, 4, 5].map((n) => lanInstanceName('admin', n, 'Victor'));
      expect(new Set(names).size).to.eq(names.length);
    });
    it('caps the base name, leaving room for the disambiguator', () => {
      const long = lanInstanceName('x'.repeat(200), 2, 'Victor');
      expect(long.length).to.be.lessThan(64);
      expect(long.endsWith(' (2)')).to.be.true;
    });
  });

  describe('toLanHostInfo', () => {
    const service = (txt: Record<string, unknown>) =>
      ({name: 'admin (Victor)', port: 17325, addresses: ['192.168.50.168'], txt});

    it('drops this process own advertisement by iid', () => {
      expect(toLanHostInfo(service({iid: 'iaaa'}), 'iaaa')).to.be.undefined;
    });
    // A renamed instance must still read as the friendly profile name in the UI.
    it('prefers the TXT display name over the disambiguated instance name', () => {
      const info = toLanHostInfo({...service({iid: 'ibbb', name: 'admin'}), name: 'admin (Victor) (2)'}, 'iaaa');
      expect(info?.name).to.eq('admin');
      expect(info?.id).to.eq('ibbb');
    });
    it('falls back to the instance name when TXT carries none', () => {
      expect(toLanHostInfo(service({iid: 'ibbb'}), 'iaaa')?.name).to.eq('admin (Victor)');
    });
    it('keys off the instance name when the host predates the iid field', () => {
      expect(toLanHostInfo(service({}), 'iaaa')?.id).to.eq('svc:admin (Victor)');
    });
  });
});
