import {expect} from 'chai';
import os from 'os';
import {applyInterfacePin, isVirtualAdapterName, LanInterface, listLanInterfaces, MAX_LAN_INTERFACES} from '../../src/server/embedded/lanInterfaces';

// Which links LAN discovery binds a responder to (docs/EMBEDDED_SERVER.md §5). Pure
// enumeration rules, so they unit-test without a socket:
//   npx mocha --import=tsx "tests/electron/lanInterfaces.spec.ts"

type Nets = ReturnType<typeof os.networkInterfaces>;

const ipv4 = (address: string, extra: Partial<os.NetworkInterfaceInfoIPv4> = {}): os.NetworkInterfaceInfoIPv4 => ({
  address,
  netmask: '255.255.255.0',
  family: 'IPv4',
  mac: 'aa:bb:cc:dd:ee:ff',
  internal: false,
  cidr: `${address}/24`,
  ...extra,
});

const ipv6 = (address: string): os.NetworkInterfaceInfoIPv6 => ({
  address,
  netmask: 'ffff:ffff:ffff:ffff::',
  family: 'IPv6',
  mac: 'aa:bb:cc:dd:ee:ff',
  internal: false,
  cidr: `${address}/64`,
  scopeid: 0,
});

const addresses = (interfaces: LanInterface[]): string[] => interfaces.map((i) => i.address);

describe('embedded/lanInterfaces', () => {
  describe('listLanInterfaces', () => {
    it('keeps a real IPv4 link', () => {
      const nets: Nets = {'Wi-Fi': [ipv4('192.168.50.168')]};
      expect(addresses(listLanInterfaces(nets))).to.deep.eq(['192.168.50.168']);
    });

    it('drops loopback and other internal adapters', () => {
      const nets: Nets = {
        'Loopback Pseudo-Interface 1': [ipv4('127.0.0.1', {internal: true})],
        'Wi-Fi': [ipv4('192.168.50.168')],
      };
      expect(addresses(listLanInterfaces(nets))).to.deep.eq(['192.168.50.168']);
    });

    // APIPA means the adapter never got a DHCP lease; nothing reachable lives there,
    // and a Windows box routinely carries five of them, which would eat the cap.
    it('drops APIPA link-local addresses', () => {
      const nets: Nets = {
        'Подключение по локальной сети 2': [ipv4('169.254.105.6')],
        'Wi-Fi': [ipv4('192.168.50.168')],
      };
      expect(addresses(listLanInterfaces(nets))).to.deep.eq(['192.168.50.168']);
    });

    // A WireGuard tunnel (NordLynx) reports no MAC — there is no L2 to multicast on.
    it('drops zero-MAC pseudo adapters', () => {
      const nets: Nets = {
        'NordLynx': [ipv4('10.5.0.2', {mac: '00:00:00:00:00:00'})],
        'Wi-Fi': [ipv4('192.168.50.168')],
      };
      expect(addresses(listLanInterfaces(nets))).to.deep.eq(['192.168.50.168']);
    });

    it('ignores IPv6 addresses — the mDNS socket is udp4', () => {
      const nets: Nets = {'Wi-Fi': [ipv6('fe80::1'), ipv4('192.168.50.168')]};
      expect(addresses(listLanInterfaces(nets))).to.deep.eq(['192.168.50.168']);
    });

    // addMembership is per interface, so a second address on one adapter would
    // only ever produce a duplicate responder.
    it('takes one address per adapter', () => {
      const nets: Nets = {'Wi-Fi': [ipv4('192.168.50.168'), ipv4('192.168.50.200')]};
      expect(addresses(listLanInterfaces(nets))).to.deep.eq(['192.168.50.168']);
    });

    it('ranks real links above tunnels and hypervisor switches', () => {
      const nets: Nets = {
        'vEthernet (WSLCore)': [ipv4('172.21.144.1')],
        'Wi-Fi': [ipv4('192.168.50.168')],
      };
      expect(addresses(listLanInterfaces(nets))).to.deep.eq(['192.168.50.168', '172.21.144.1']);
    });

    // Ranking must never become exclusion: a Cisco AnyConnect tunnel presents
    // itself as plain `Ethernet 2`, so any name-based filter would be wrong in
    // both directions. Covering every link is what removes the guess.
    it('still binds virtual links — they are ranked, never dropped', () => {
      const nets: Nets = {'vEthernet (Default Switch)': [ipv4('172.20.48.1')]};
      const found = listLanInterfaces(nets);
      expect(addresses(found)).to.deep.eq(['172.20.48.1']);
      expect(found[0].virtual).to.be.true;
    });

    it('caps the responder count, keeping the real links', () => {
      const nets: Nets = {};
      for (let i = 0; i < MAX_LAN_INTERFACES + 4; i++) {
        nets[`vEthernet (${i})`] = [ipv4(`172.20.${i}.1`)];
      }
      nets['Wi-Fi'] = [ipv4('192.168.50.168')];
      const found = listLanInterfaces(nets);
      expect(found.length).to.eq(MAX_LAN_INTERFACES);
      expect(found[0].address).to.eq('192.168.50.168');
    });

    it('carries the adapter name and netmask for diagnostics', () => {
      const nets: Nets = {'Беспроводная сеть': [ipv4('192.168.50.168')]};
      expect(listLanInterfaces(nets)[0]).to.deep.include({
        name: 'Беспроводная сеть',
        address: '192.168.50.168',
        netmask: '255.255.255.0',
        virtual: false,
      });
    });
  });

  describe('isVirtualAdapterName', () => {
    it('recognises the usual tunnels and hypervisor switches', () => {
      for (const name of ['vEthernet (WSL)', 'docker0', 'br-1a2b', 'tun0', 'utun3', 'NordLynx', 'Tailscale', 'VMware Network Adapter VMnet1']) {
        expect(isVirtualAdapterName(name), name).to.be.true;
      }
    });
    it('leaves ordinary adapters alone', () => {
      for (const name of ['Wi-Fi', 'eth0', 'en0', 'Ethernet 2', 'Беспроводная сеть', 'wlan0']) {
        expect(isVirtualAdapterName(name), name).to.be.false;
      }
    });
  });

  describe('applyInterfacePin', () => {
    const available: LanInterface[] = [
      {name: 'Wi-Fi', address: '192.168.50.168', netmask: '255.255.255.0', virtual: false},
      {name: 'vEthernet (WSLCore)', address: '172.21.144.1', netmask: '255.255.240.0', virtual: true},
    ];

    it('returns everything when nothing is pinned', () => {
      expect(applyInterfacePin(available, '')).to.deep.eq(available);
      expect(applyInterfacePin(available, '   ')).to.deep.eq(available);
    });
    it('pins by address', () => {
      expect(addresses(applyInterfacePin(available, '192.168.50.168'))).to.deep.eq(['192.168.50.168']);
    });
    it('pins by adapter name, case-insensitively', () => {
      expect(addresses(applyInterfacePin(available, 'wi-fi'))).to.deep.eq(['192.168.50.168']);
    });
    it('accepts a comma-separated list and tolerates spacing', () => {
      expect(addresses(applyInterfacePin(available, ' 192.168.50.168 , vEthernet (WSLCore) ')))
        .to.deep.eq(['192.168.50.168', '172.21.144.1']);
    });
    // A typo in an env var must not silently switch LAN play off — that is the
    // exact class of failure this module exists to end.
    it('ignores a pin that matches nothing rather than binding nothing', () => {
      expect(applyInterfacePin(available, '10.0.0.99')).to.deep.eq(available);
    });
  });
});
