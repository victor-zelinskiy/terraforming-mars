import {expect} from 'chai';
import {lanDisplayName, lanInstanceName, orderHostAddresses, toLanHostInfo} from '../../src/server/embedded/lanDiscovery';

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
    it('exposes the addresses best-first, so the guest probes the reachable one', () => {
      const info = toLanHostInfo({
        ...service({iid: 'ibbb', addr: '192.168.50.168'}),
        addresses: ['172.20.48.1', '192.168.50.168'],
        referer: {address: '192.168.50.168'},
      }, 'iaaa');
      expect(info?.addresses[0]).to.eq('192.168.50.168');
    });
  });

  // A host advertises an A record for EVERY one of its NICs, so the list happily
  // contains Hyper-V bridges and VPN tunnels. Ordering is what keeps the guest
  // from spending its probe budget on addresses that cannot answer.
  describe('orderHostAddresses', () => {
    it('puts the packet source first — it is reachable by construction', () => {
      const ordered = orderHostAddresses({
        name: 'admin', port: 17325,
        addresses: ['172.20.48.1', '10.5.0.2'],
        txt: {addr: '10.236.97.48'},
        referer: {address: '192.168.50.168'},
      });
      expect(ordered[0]).to.eq('192.168.50.168');
    });
    it('falls back to the TXT link address when there is no referer', () => {
      const ordered = orderHostAddresses({
        name: 'admin', port: 17325,
        addresses: ['172.20.48.1'],
        txt: {addr: '192.168.50.168'},
      });
      expect(ordered).to.deep.eq(['192.168.50.168', '172.20.48.1']);
    });
    it('never repeats an address that appears in several roles', () => {
      const ordered = orderHostAddresses({
        name: 'admin', port: 17325,
        addresses: ['192.168.50.168', '172.20.48.1'],
        txt: {addr: '192.168.50.168'},
        referer: {address: '192.168.50.168'},
      });
      expect(ordered).to.deep.eq(['192.168.50.168', '172.20.48.1']);
    });
    it('orders IPv4 ahead of IPv6 — bracketed fetches are the flakier path', () => {
      const ordered = orderHostAddresses({
        name: 'admin', port: 17325,
        addresses: ['fe80::1', '192.168.50.168'],
      });
      expect(ordered).to.deep.eq(['192.168.50.168', 'fe80::1']);
    });
    it('survives a service with no addresses at all', () => {
      expect(orderHostAddresses({name: 'admin', port: 17325})).to.deep.eq([]);
    });
  });
});
