import {expect} from 'chai';
import {dedupeByEndpoint, hostPresencePlan, lanDisplayName, lanInstanceName, orderHostAddresses, reachable, toLanHostInfo} from '../../src/server/embedded/lanDiscovery';
import {LanHostInfo} from '../../src/server/embedded/lanDiscovery';

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

  /**
   * ⚠️ THE REGRESSION THIS SUITE EXISTS FOR.
   *
   * `bonjour-service`'s Browser emits `up` EXACTLY ONCE per service: a repeat
   * response for a service it already holds updates nothing and re-emits
   * nothing. A "last seen" fed from `up` alone therefore freezes at the moment
   * of discovery — and the TTL sweep that read it deleted EVERY host 45 s after
   * finding it, permanently, because the Browser would never announce it again.
   * Symptom: play a LAN game for ten minutes, go back to the menu, and the host
   * you were still talking to is not on the list. Only restarting the app
   * brought it back.
   *
   * So: mDNS is how a host is FOUND; a socket is what says it is still there.
   */
  describe('hostPresencePlan', () => {
    const host = (id: string): LanHostInfo =>
      ({id, name: id, addresses: ['192.168.50.168'], port: 17325, version: ''});

    it('asks a socket about a host that has gone mDNS-quiet', () => {
      const plan = hostPresencePlan({
        now: 600_000,
        published: [host('a')],
        lastSeen: new Map([['a', 600_000 - 120_000]]),
        offline: new Map(),
      });
      expect(plan.verify.map((h) => h.id)).to.deep.eq(['a']);
    });

    it('leaves a host that is still announcing alone', () => {
      const plan = hostPresencePlan({
        now: 600_000,
        published: [host('a')],
        lastSeen: new Map([['a', 600_000 - 1_000]]),
        offline: new Map(),
      });
      expect(plan.verify).to.be.empty;
    });

    it('checks a host it has never had wire evidence for', () => {
      const plan = hostPresencePlan({
        now: 1_000,
        published: [host('a')],
        lastSeen: new Map(),
        offline: new Map(),
      });
      expect(plan.verify.map((h) => h.id)).to.deep.eq(['a']);
    });

    it('re-asks a hidden host on its own rotation — it carries its own record', () => {
      const hidden = new Map([['a', {at: 100_000 - 1_000, host: host('a')}]]);
      // Too soon...
      expect(hostPresencePlan({
        now: 100_000, published: [], lastSeen: new Map(), offline: hidden,
      }).verify).to.be.empty;
      // ...and due. Note `published` is empty and no browser lists it: a hidden
      // host must not depend on discovery to get another chance.
      expect(hostPresencePlan({
        now: 100_000, published: [], lastSeen: new Map(),
        offline: new Map([['a', {at: 100_000 - 60_000, host: host('a')}]]),
      }).verify.map((h) => h.id)).to.deep.eq(['a']);
    });
  });

  /**
   * A crashed / force-quit app leaves its advertisement behind (no mDNS
   * goodbye). Now that liveness is a SOCKET, that ghost answers forever — what
   * is listening on its address:port is the machine's current app — so a ghost
   * and its live successor would both be listed as separate couches.
   */
  describe('dedupeByEndpoint', () => {
    const at = (id: string, addresses: Array<string>, port = 17325): LanHostInfo =>
      ({id, name: id, addresses, port, version: ''});

    it('keeps the FRESHEST advertisement of one machine', () => {
      const ghost = at('old', ['192.168.50.168', '172.20.48.1']);
      const live = at('new', ['172.20.48.1', '192.168.50.168']);
      const kept = dedupeByEndpoint([ghost, live], new Map([['old', 1_000], ['new', 5_000]]));
      expect(kept.map((h) => h.id)).to.deep.eq(['new']);
    });

    it('does not care what order the addresses were advertised in', () => {
      const kept = dedupeByEndpoint(
        [at('a', ['10.0.0.2', '10.0.0.1']), at('b', ['10.0.0.1', '10.0.0.2'])],
        new Map([['a', 1], ['b', 2]]));
      expect(kept).to.have.length(1);
    });

    it('never merges two DIFFERENT machines', () => {
      const kept = dedupeByEndpoint(
        [at('a', ['192.168.50.10']), at('b', ['192.168.50.11'])], new Map());
      expect(kept.map((h) => h.id)).to.have.members(['a', 'b']);
    });

    it('treats a different port as a different host (two apps on one box)', () => {
      const kept = dedupeByEndpoint(
        [at('a', ['192.168.50.10'], 17325), at('b', ['192.168.50.10'], 17326)], new Map());
      expect(kept).to.have.length(2);
    });
  });

  describe('reachable', () => {
    const host = ['10.0.0.1', '192.168.50.168'];

    it('is true when ANY address answers — one dead NIC cannot hide a host', async () => {
      const asked: Array<string> = [];
      const ok = await reachable(host, 17325, 50, (address) => {
        asked.push(address);
        return Promise.resolve(address === '192.168.50.168');
      });
      expect(ok).to.be.true;
      // Raced, not sequential: a hanging address must not gate the live one.
      expect(asked).to.have.members(host);
    });

    it('is false when every address refuses', async () => {
      expect(await reachable(host, 17325, 50, () => Promise.resolve(false))).to.be.false;
    });

    it('is false — never a throw — for a host with no addresses', async () => {
      expect(await reachable([], 17325, 50, () => Promise.resolve(true))).to.be.false;
    });

    it('treats a probe that blows up as unreachable', async () => {
      expect(await reachable(host, 17325, 50, () => Promise.reject(new Error('EHOSTDOWN')))).to.be.false;
    });
  });
});
