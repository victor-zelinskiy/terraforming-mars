/**
 * Which network links LAN discovery runs on (docs/EMBEDDED_SERVER.md §5).
 *
 * WHY THIS EXISTS — the bug it removes. `multicast-dns` sends through
 * `setMulticastInterface(defaultInterface())`, and `defaultInterface()` returns
 * the literal `'0.0.0.0'` on every platform except macOS. That hands the choice
 * of egress link to the OS routing table, and for `224.0.0.251` the routing
 * table lies: a VPN tunnel or a Hyper-V switch routinely wins the tie on
 * interface metric, so the advertisement leaves through a tunnel and never
 * reaches the couch in the next room. Receiving still works (membership is
 * joined on every link), which is why the symptom is always the same
 * asymmetric one — "I can see them, nobody can see me".
 *
 * The fix is NOT a better guess. You cannot identify "the real LAN" by adapter
 * name: a Cisco AnyConnect tunnel presents itself as `Ethernet 2`, and a Wi-Fi
 * link can legitimately be the only route to the couch. So we enumerate every
 * plausible link and run one mDNS responder per link, each pinned to its own
 * address. Guessing is replaced by covering.
 *
 * `virtual` therefore NEVER excludes a link — it only ranks it below the real
 * ones so that, if a machine somehow exceeds `MAX_LAN_INTERFACES`, the sockets
 * that survive are the ones most likely to carry players.
 */
import os from 'os';

/** A link LAN discovery binds a responder to. */
export type LanInterface = {
  /** OS adapter name (`Wi-Fi`, `eth0`, `vEthernet (WSL)`) — diagnostics + ranking. */
  name: string;
  /** The IPv4 address multicast egress is pinned to for this link. */
  address: string;
  netmask: string;
  /** Heuristically a tunnel/hypervisor adapter. RANKING ONLY — never a filter. */
  virtual: boolean;
};

/**
 * One responder per link is cheap (a socket and a timer), but an unbounded
 * count is not: a developer box with several hypervisors can present a dozen.
 * Real links sort first, so the cap only ever sheds tunnels.
 */
export const MAX_LAN_INTERFACES = 8;

/**
 * Adapter names that are almost always a tunnel, a hypervisor switch or a
 * container bridge. Deliberately incomplete — anything missed simply keeps its
 * default (real) rank and still gets a responder, which is the safe direction
 * to be wrong in.
 */
const VIRTUAL_NAME = /(^|[^a-z])(vethernet|veth|virbr|vmnet|vboxnet|docker|br-|tun\d|tap\d|utun|wg\d|ppp\d|zt[a-z0-9]{6}|tailscale|nordlynx|proton|wintun|hyper-v|wsl|vpn|tunnel|bluetooth|loopback|virtual)/i;

/** APIPA. A link with no DHCP lease never carries a reachable game server. */
const LINK_LOCAL = /^169\.254\./;

/** Node reports pseudo-adapters with an all-zero MAC; bonjour-service skips them too. */
const NULL_MAC = '00:00:00:00:00:00';

type NetworkInterfaceMap = ReturnType<typeof os.networkInterfaces>;

function isIPv4(family: string | number): boolean {
  return family === 'IPv4' || family === 4;
}

/** Pure predicate so the ranking rule is directly testable. */
export function isVirtualAdapterName(name: string): boolean {
  return VIRTUAL_NAME.test(name);
}

/**
 * Every link worth running a responder on, real ones first.
 *
 * One address per adapter: `addMembership` is per interface, not per address,
 * so a second address on the same adapter would be a duplicate socket.
 */
export function listLanInterfaces(nets: NetworkInterfaceMap = os.networkInterfaces()): LanInterface[] {
  const found: LanInterface[] = [];
  for (const [name, addresses] of Object.entries(nets)) {
    for (const address of addresses ?? []) {
      if (!isIPv4(address.family) || address.internal) {
        continue;
      }
      if (LINK_LOCAL.test(address.address) || address.mac === NULL_MAC) {
        continue;
      }
      found.push({
        name,
        address: address.address,
        netmask: address.netmask,
        virtual: isVirtualAdapterName(name),
      });
      break; // one membership per adapter
    }
  }
  // Stable: real links first, then original enumeration order within each group.
  const ranked = found.filter((i) => !i.virtual).concat(found.filter((i) => i.virtual));
  return ranked.slice(0, MAX_LAN_INTERFACES);
}

/**
 * Apply a `TM_LAN_INTERFACE` pin (comma-separated addresses and/or adapter
 * names, case-insensitive). A pin that matches NOTHING is ignored rather than
 * obeyed — a typo in an env var must not silently switch LAN play off, which
 * is the whole failure mode this module exists to end.
 */
export function applyInterfacePin(available: LanInterface[], pin: string): LanInterface[] {
  const wanted = pin.split(',').map((p) => p.trim().toLowerCase()).filter((p) => p !== '');
  if (wanted.length === 0) {
    return available;
  }
  const picked = available.filter((i) =>
    wanted.includes(i.address.toLowerCase()) || wanted.includes(i.name.toLowerCase()));
  return picked.length > 0 ? picked : available;
}
