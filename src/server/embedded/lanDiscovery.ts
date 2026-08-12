/**
 * LAN discovery for host-as-server mode (docs/EMBEDDED_SERVER.md §5-6).
 *
 * mDNS via `bonjour-service` (pure JS — no OS daemon, no native modules), run
 * INSIDE the embedded-server utility process so the multicast sockets share its
 * lifetime. Two halves, independently switchable:
 *   - ADVERTISE this host's embedded server (service `_tmars._tcp`) so other
 *     couches on the LAN can see it;
 *   - BROWSE for other hosts and keep an aggregated, self-filtered list.
 *
 * ONE RESPONDER PER LINK. The single most important thing this module does is
 * open a separate `Bonjour` per network interface, each with its multicast
 * egress pinned to that interface's own address (`lanInterfaces.ts` explains
 * why leaving the choice to the OS routing table silently routes the whole
 * advertisement into a VPN tunnel). `bind` and `interface` are DIFFERENT
 * options in `multicast-dns`: we bind the wildcard address — Windows only
 * delivers multicast to a wildcard-bound socket — while joining the group and
 * sending on exactly one link. Delivery then follows group membership, so each
 * responder hears only its own link and answers back out of it.
 *
 * The TXT record carries: `iid` (random per process — how a browser filters its
 * OWN advertisement out), `v` (build version, soft compat warning on the guest),
 * `name` (friendly player/host name; the INSTANCE name gets disambiguated on a
 * conflict — see `publishAll` — so TXT is what keeps the display value stable),
 * `addr` (THIS link's address, so a guest never has to guess which of the
 * host's many NIC addresses is the reachable one).
 */
import os from 'os';
import {Bonjour, Browser, Service} from 'bonjour-service';
import {applyInterfacePin, LanInterface, listLanInterfaces} from './lanInterfaces';

/** mDNS service type — rendered as `_tmars._tcp` on the wire. */
export const LAN_SERVICE_TYPE = 'tmars';

/**
 * How long a publish gets to come `up` before we judge it (probe is ≤ ~1 s:
 * a 0-250 ms initial delay plus three 250 ms retries, then one announce).
 */
const PUBLISH_CONFIRM_MS = 3_000;
/** Name attempts before giving up — `X`, `X (2)`, … `X (5)`. */
const MAX_NAME_ATTEMPTS = 5;
/** mDNS instance names are capped; leave room for the ` (n)` disambiguator. */
const NAME_LIMIT = 56;

/**
 * Steady re-announce beat. `bonjour-service` does re-announce, but on a x3
 * decay capped at ONE HOUR — after a few minutes a host effectively goes quiet,
 * so a guest that opens the menu later hears nothing. Worse, a host whose
 * inbound multicast is firewalled (the Windows default for an unsigned app on a
 * network classified Public) can never be *asked* either. A small unsolicited
 * announce on a fixed beat is what makes discovery work in both cases.
 */
const ANNOUNCE_INTERVAL_MS = 10_000;
/**
 * Re-query ramp. `bonjour-service`'s Browser sends its PTR query EXACTLY ONCE
 * at construction and never again, so a guest that started before the host
 * would otherwise depend entirely on catching an announce — and multicast over
 * Wi-Fi is unacknowledged and lossy.
 */
const QUERY_RAMP_MS = [1_000, 2_000, 4_000, 8_000, 15_000];
/** Drop a host we have not heard from for this long. */
const HOST_TTL_MS = 45_000;
const SWEEP_INTERVAL_MS = 5_000;
/** Re-enumerate links this often: Wi-Fi reconnects, VPNs and docks come and go. */
const INTERFACE_WATCH_MS = 10_000;

export type LanHostInfo = {
  /** Unique key for the row (the advertisement's instance id). */
  id: string;
  /** Friendly host name to render (TXT `name`, falling back to the instance name). */
  name: string;
  /** Addresses the host answers on, BEST FIRST; the client probes them in order. */
  addresses: string[];
  port: number;
  /** Host app build version ('' when unknown) — soft mismatch warning on join. */
  version: string;
};

export type AdvertiseOptions = {
  /** Friendly name to advertise (player profile name / hostname). */
  name: string;
  port: number;
  version: string;
};

export type LanDiscoveryOptions = {
  /** `TM_LAN_INTERFACE` — pin discovery to given addresses/adapter names. */
  pin?: string;
  /**
   * Multicast loopback. OFF by default: with one responder per link, loopback
   * would make this process hear its OWN probe on the other links, read it as a
   * name conflict and rename itself into oblivion. Turn it on (dev only) to run
   * a host and a guest on one machine.
   */
  loopback?: boolean;
};

/** Per-link health, for the diagnostics surface. */
export type LanLinkStatus = {
  name: string;
  address: string;
  virtual: boolean;
  published: boolean;
  queriesIn: number;
  responsesIn: number;
  error: string;
};

export type LanDiagnostics = {
  advertising: boolean;
  /** The mDNS instance name currently on the wire ('' when not advertising). */
  serviceName: string;
  port: number;
  links: LanLinkStatus[];
  hosts: number;
  /**
   * Whether any link has ever received a QUERY. Staying false while responses
   * arrive is the fingerprint of a host that can send but not be asked —
   * inbound multicast blocked, almost always a firewall.
   */
  inboundSeen: boolean;
};

type FoundService = Pick<Service, 'name' | 'port'> & {
  addresses?: string[];
  txt?: Record<string, unknown>;
  referer?: {address?: string};
};

/**
 * What `new Bonjour(opts)` actually forwards to `multicast-dns`. The published
 * typing claims `Partial<ServiceConfig>`, which is simply wrong — these are
 * socket options, not service fields.
 */
type MdnsOptions = {
  bind?: string;
  interface?: string;
  reuseAddr?: boolean;
  loopback?: boolean;
};

/** The raw `multicast-dns` handle that `Bonjour` keeps private. */
type RawMdns = {
  respond(records: unknown, callback?: (err?: Error) => void): void;
  on(event: 'query' | 'response', listener: () => void): void;
  on(event: 'error' | 'warning', listener: (err: Error) => void): void;
};

type Link = {
  iface: LanInterface;
  bonjour: Bonjour;
  service?: Service;
  browser?: Browser;
  queriesIn: number;
  responsesIn: number;
  error: string;
};

/**
 * Both library typing bugs are absorbed here rather than at every call site:
 * the constructor options above, and the private `server.mdns` we need for a
 * forced re-announce (`registry.announce` is private, but re-broadcasting the
 * service's own records is exactly what it does internally).
 */
function openBonjour(options: MdnsOptions): Bonjour {
  return new Bonjour(options as unknown as ConstructorParameters<typeof Bonjour>[0]);
}

function rawMdns(bonjour: Bonjour): RawMdns {
  return (bonjour as unknown as {server: {mdns: RawMdns}}).server.mdns;
}

/**
 * Candidate addresses for a discovered host, best first.
 *
 * `referer` is the source address of the mDNS packet we actually received, so
 * it is reachable BY CONSTRUCTION — it is the only address that carries proof.
 * TXT `addr` is the link the responder pinned. Only then the A-record list,
 * which `bonjour-service` fills from every non-internal NIC on the host and
 * therefore happily includes Hyper-V bridges and VPN tunnels.
 */
export function orderHostAddresses(service: FoundService): string[] {
  const out: string[] = [];
  const push = (value: unknown): void => {
    if (typeof value === 'string' && value !== '' && !out.includes(value)) {
      out.push(value);
    }
  };
  push(service.referer?.address);
  push((service.txt ?? {}).addr);
  const advertised = (service.addresses ?? []).filter((a) => typeof a === 'string' && a !== '');
  // IPv4 first — bracketed IPv6 fetches are the flakier path on a LAN.
  advertised.filter((a) => a.includes('.')).forEach(push);
  advertised.filter((a) => !a.includes('.')).forEach(push);
  return out;
}

/** Pure mapping of a browsed service → a host row; undefined = filtered out (self). */
export function toLanHostInfo(service: FoundService, selfInstanceId: string): LanHostInfo | undefined {
  const txt = service.txt ?? {};
  const iid = typeof txt.iid === 'string' ? txt.iid : '';
  if (iid !== '' && iid === selfInstanceId) {
    return undefined;
  }
  const friendly = typeof txt.name === 'string' && txt.name !== '' ? txt.name : service.name;
  return {
    id: iid !== '' ? iid : `svc:${service.name}`,
    name: friendly,
    addresses: orderHostAddresses(service),
    port: service.port,
    version: typeof txt.v === 'string' ? txt.v : '',
  };
}

/** Rows are re-emitted only on a real change — an announce every 10 s must not churn the UI. */
function sameHost(a: LanHostInfo, b: LanHostInfo): boolean {
  return a.name === b.name && a.port === b.port && a.version === b.version &&
    a.addresses.length === b.addresses.length && a.addresses.every((v, i) => v === b.addresses[i]);
}

/** The name the UI shows (TXT `name`) — the profile name, hostname as fallback. */
export function lanDisplayName(name: string, hostname: string = os.hostname()): string {
  return name.trim() !== '' ? name.trim() : hostname;
}

/**
 * The mDNS INSTANCE name (what must be unique on the wire). `attempt` implements
 * the RFC 6762 §9 disambiguation the library skips: 1 → `Имя (HOST)`, 2 →
 * `Имя (HOST) (2)`, … The display name rides in TXT, so a suffix never reaches the UI.
 */
export function lanInstanceName(display: string, attempt: number, hostname: string = os.hostname()): string {
  const base = `${display} (${hostname})`.slice(0, NAME_LIMIT);
  return attempt > 1 ? `${base} (${attempt})` : base;
}

export class LanDiscovery {
  private links: Link[] = [];
  /** Address set the current links were built from — the interface-change signal. */
  private linkKey = '';
  private advertiseOptions: AdvertiseOptions | undefined;
  private browsing = false;
  private nameAttempt = 1;
  private confirmTimer: ReturnType<typeof setTimeout> | undefined;
  private announceTimer: ReturnType<typeof setInterval> | undefined;
  private queryTimer: ReturnType<typeof setTimeout> | undefined;
  private sweepTimer: ReturnType<typeof setInterval> | undefined;
  private watchTimer: ReturnType<typeof setInterval> | undefined;
  private queryStep = 0;
  private inboundSeen = false;
  private destroyed = false;
  private readonly hosts = new Map<string, LanHostInfo>();
  private readonly lastSeen = new Map<string, number>();
  private readonly pin: string;
  private readonly loopback: boolean;
  /** Random per process; lets the browser drop this process's own advertisement. */
  public readonly instanceId: string = `i${Math.floor(Math.random() * Math.pow(16, 12)).toString(16)}`;

  constructor(
    private readonly onHostsChanged: (hosts: LanHostInfo[]) => void,
    options: LanDiscoveryOptions = {}) {
    this.pin = options.pin ?? '';
    this.loopback = options.loopback === true;
  }

  // ---------------------------------------------------------------- links

  private currentInterfaces(): LanInterface[] {
    return applyInterfacePin(listLanInterfaces(), this.pin);
  }

  private ensureLinks(): void {
    if (this.links.length > 0 || this.destroyed) {
      return;
    }
    const interfaces = this.currentInterfaces();
    // The KEY records what we tried to bind, not what succeeded — otherwise a
    // link that failed once would look like a network change on every watch
    // tick and rebuild the healthy responders along with it, forever.
    this.linkKey = interfaces.map((i) => i.address).join(',');
    this.links = interfaces
      .map((iface) => this.openLink(iface))
      .filter((link): link is Link => link !== undefined);
    if (this.links.length === 0) {
      console.warn('[lan] no usable network interface found — LAN play is unavailable on this machine');
    }
    this.startTimers();
  }

  /**
   * One responder. Returns undefined when the socket cannot be opened at all:
   * one refused link (a disappearing adapter, a port already held without
   * SO_REUSEADDR) must never take the working ones down with it.
   */
  private openLink(iface: LanInterface): Link | undefined {
    let bonjour: Bonjour;
    try {
      // bind = where we RECEIVE (wildcard, or Windows drops multicast);
      // interface = where we SEND (this link, never the routing table's pick).
      bonjour = openBonjour({bind: '0.0.0.0', interface: iface.address, reuseAddr: true, loopback: this.loopback});
    } catch (err) {
      console.error(`[lan] could not open a responder on ${iface.address} (${iface.name})`, err);
      return undefined;
    }
    const link: Link = {iface, bonjour, queriesIn: 0, responsesIn: 0, error: ''};
    const mdns = rawMdns(link.bonjour);
    mdns.on('query', () => {
      link.queriesIn++;
      this.inboundSeen = true;
    });
    mdns.on('response', () => {
      link.responsesIn++;
    });
    // multicast-dns re-emits socket failures on ITS emitter and nothing in
    // bonjour-service listens. An 'error' with no listener is an uncaught
    // exception, which would take the whole embedded server — and the player's
    // game with it — down over a network hiccup.
    mdns.on('error', (err: Error) => {
      link.error = err.message;
      console.error(`[lan] socket error on ${iface.address} (${iface.name})`, err);
    });
    mdns.on('warning', (err: Error) => {
      link.error = err.message;
    });
    return link;
  }

  /** Tear links down and rebuild them — the network itself changed under us. */
  private rebuildLinks(): void {
    const wasBrowsing = this.browsing;
    this.closeLinks();
    this.ensureLinks();
    if (wasBrowsing) {
      this.browsing = true;
      this.links.forEach((link) => this.attachBrowser(link));
    }
    if (this.advertiseOptions !== undefined) {
      // The network changed, so a name that was taken a moment ago may be free.
      this.publishAll(1);
    }
  }

  private closeLinks(): void {
    this.clearConfirmTimer();
    for (const link of this.links) {
      try {
        link.browser?.stop();
        link.service?.stop?.();
        link.bonjour.destroy();
      } catch {
        // best effort — a teardown failure must not break the server
      }
    }
    this.links = [];
    this.linkKey = '';
  }

  // ------------------------------------------------------------ advertise

  /** Publish (or re-publish) this host's embedded server on the LAN. */
  public advertise(options: AdvertiseOptions): void {
    this.advertiseOptions = options;
    this.ensureLinks();
    this.publishAll(1);
  }

  /**
   * Publish under the `attempt`-th candidate name on EVERY link.
   *
   * The name is chosen once for the whole host, not per link: a host that
   * answered as `Имя (HOST)` on Ethernet and `Имя (HOST) (2)` on Wi-Fi would be
   * one machine wearing two identities. (Guests key rows off TXT `iid`, so even
   * a transient mismatch still collapses to a single row.)
   *
   * `name (hostname)` is unique per machine+profile, NOT per process — a dev
   * build beside the packaged one, a second install, or an orphaned utility
   * process from the previous run all probe for the very same instance name.
   * bonjour-service does not implement RFC 6762 §9 renaming there: it tears the
   * service down and only `console.log`s an Error, so without this retry the
   * loser stays silently invisible on the LAN for the whole session.
   */
  private publishAll(attempt: number): void {
    const options = this.advertiseOptions;
    if (options === undefined || this.destroyed) {
      return;
    }
    this.stopPublishing();
    this.nameAttempt = attempt;
    const display = lanDisplayName(options.name);
    const name = lanInstanceName(display, attempt);
    for (const link of this.links) {
      try {
        link.service = link.bonjour.publish({
          name,
          type: LAN_SERVICE_TYPE,
          port: options.port,
          // Our socket is udp4-only, so AAAA records can never be used and only
          // bloat a packet that already carries an address per NIC.
          disableIPv6: true,
          txt: {iid: this.instanceId, v: options.version, name: display, addr: link.iface.address},
        });
        link.error = '';
      } catch (err) {
        link.error = err instanceof Error ? err.message : String(err);
        console.error(`[lan] publishing on ${link.iface.address} (${link.iface.name}) failed`, err);
      }
    }
    this.confirmTimer = setTimeout(() => this.confirmPublished(attempt), PUBLISH_CONFIRM_MS);
    this.confirmTimer.unref?.();
  }

  /**
   * Judge a publish where no link came `up`. The library's conflict path calls
   * `service.stop()`, which clears `activated` — that flag is what separates a
   * TAKEN name (retry under the next one) from a merely slow/quiet network
   * (still activated: leave it, `up` may yet arrive).
   */
  private confirmPublished(attempt: number): void {
    this.confirmTimer = undefined;
    if (this.advertiseOptions === undefined || attempt !== this.nameAttempt) {
      return;
    }
    const services = this.links.map((l) => l.service).filter((s): s is Service => s !== undefined);
    if (services.length === 0 || services.some((s) => s.published)) {
      return;
    }
    if (services.some((s) => s.activated)) {
      console.warn(`[lan] "${lanInstanceName(lanDisplayName(this.advertiseOptions.name), attempt)}" has not been confirmed yet — the announce is slow, leaving it to settle`);
      return;
    }
    if (attempt >= MAX_NAME_ATTEMPTS) {
      console.error(`[lan] ${MAX_NAME_ATTEMPTS} names were refused — this host stays hidden on the LAN`);
      return;
    }
    console.warn(`[lan] the advertised name is already taken (another instance of the app?) — retrying as attempt ${attempt + 1}`);
    this.publishAll(attempt + 1);
  }

  /**
   * Re-broadcast the current records on every link. This is `registry.announce`'s
   * own `broadcast()` step, called on a steady beat instead of its x3-to-one-hour
   * decay — see ANNOUNCE_INTERVAL_MS for why that decay is not survivable here.
   */
  private announceTick(): void {
    for (const link of this.links) {
      const service = link.service;
      if (service === undefined || !service.activated) {
        continue;
      }
      try {
        rawMdns(link.bonjour).respond(service.records());
      } catch (err) {
        link.error = err instanceof Error ? err.message : String(err);
      }
    }
  }

  /** Live rename (profile change on the host) — re-publish under the new name. */
  public rename(name: string): void {
    if (this.advertiseOptions !== undefined) {
      this.advertise({...this.advertiseOptions, name});
    }
  }

  // --------------------------------------------------------------- browse

  /** Start browsing for other hosts; every add/remove re-emits the full list. */
  public browse(): void {
    this.browsing = true;
    this.ensureLinks();
    this.links.forEach((link) => this.attachBrowser(link));
  }

  private attachBrowser(link: Link): void {
    if (link.browser !== undefined) {
      return;
    }
    link.browser = link.bonjour.find({type: LAN_SERVICE_TYPE}, (service) => {
      this.upsert(service as FoundService);
    });
    link.browser.on('down', (service) => {
      const info = toLanHostInfo(service as FoundService, this.instanceId);
      if (info !== undefined && this.hosts.delete(info.id)) {
        this.lastSeen.delete(info.id);
        this.emit();
      }
    });
  }

  private queryTick(): void {
    for (const link of this.links) {
      try {
        link.browser?.update();
      } catch (err) {
        link.error = err instanceof Error ? err.message : String(err);
      }
    }
    const delay = QUERY_RAMP_MS[Math.min(this.queryStep, QUERY_RAMP_MS.length - 1)];
    this.queryStep++;
    this.queryTimer = setTimeout(() => this.queryTick(), delay);
    this.queryTimer.unref?.();
  }

  private upsert(service: FoundService): void {
    const info = toLanHostInfo(service, this.instanceId);
    if (info === undefined) {
      return;
    }
    this.lastSeen.set(info.id, Date.now());
    const previous = this.hosts.get(info.id);
    this.hosts.set(info.id, info);
    if (previous === undefined || !sameHost(previous, info)) {
      this.emit();
    }
  }

  /**
   * Age out hosts we stopped hearing. `bonjour-service` defines `expire()` but
   * never schedules it, and its PTR TTL is 8 hours anyway, so a host that dies
   * without sending a goodbye would otherwise sit in the list until restart.
   * Our own announce beat is what makes a short TTL safe here.
   */
  private sweep(): void {
    const now = Date.now();
    let changed = false;
    for (const [id, seen] of [...this.lastSeen]) {
      if (now - seen > HOST_TTL_MS) {
        this.lastSeen.delete(id);
        changed = this.hosts.delete(id) || changed;
      }
    }
    if (changed) {
      this.emit();
    }
  }

  // --------------------------------------------------------------- timers

  private startTimers(): void {
    if (this.announceTimer === undefined) {
      this.announceTimer = setInterval(() => this.announceTick(), ANNOUNCE_INTERVAL_MS);
      this.announceTimer.unref?.();
    }
    if (this.sweepTimer === undefined) {
      this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
      this.sweepTimer.unref?.();
    }
    if (this.watchTimer === undefined) {
      this.watchTimer = setInterval(() => this.watchInterfaces(), INTERFACE_WATCH_MS);
      this.watchTimer.unref?.();
    }
    if (this.queryTimer === undefined) {
      this.queryStep = 0;
      this.queryTimer = setTimeout(() => this.queryTick(), QUERY_RAMP_MS[0]);
      this.queryTimer.unref?.();
    }
  }

  /**
   * A Wi-Fi reconnect, a VPN toggle or a dock change rewrites the interface
   * list; without this the responders stay bound to addresses that no longer
   * exist and the host goes quietly invisible until the app is restarted.
   */
  private watchInterfaces(): void {
    if (this.destroyed) {
      return;
    }
    const key = this.currentInterfaces().map((i) => i.address).join(',');
    if (key !== this.linkKey) {
      console.log(`[lan] network interfaces changed (${this.linkKey || 'none'} → ${key || 'none'}) — rebuilding responders`);
      this.rebuildLinks();
    }
  }

  // ---------------------------------------------------------------- misc

  private emit(): void {
    this.onHostsChanged([...this.hosts.values()]);
  }

  public diagnostics(): LanDiagnostics {
    const advertising = this.advertiseOptions !== undefined;
    return {
      advertising,
      serviceName: advertising ? lanInstanceName(lanDisplayName(this.advertiseOptions?.name ?? ''), this.nameAttempt) : '',
      port: this.advertiseOptions?.port ?? 0,
      links: this.links.map((link) => ({
        name: link.iface.name,
        address: link.iface.address,
        virtual: link.iface.virtual,
        published: link.service?.published === true,
        queriesIn: link.queriesIn,
        responsesIn: link.responsesIn,
        error: link.error,
      })),
      hosts: this.hosts.size,
      inboundSeen: this.inboundSeen,
    };
  }

  private clearConfirmTimer(): void {
    if (this.confirmTimer !== undefined) {
      clearTimeout(this.confirmTimer);
      this.confirmTimer = undefined;
    }
  }

  private stopPublishing(): void {
    this.clearConfirmTimer();
    for (const link of this.links) {
      if (link.service !== undefined) {
        try {
          link.service.stop?.();
        } catch {
          // best effort — a teardown failure must not break the server
        }
        link.service = undefined;
      }
    }
  }

  public destroy(): void {
    this.destroyed = true;
    for (const timer of [this.announceTimer, this.sweepTimer, this.watchTimer]) {
      if (timer !== undefined) {
        clearInterval(timer);
      }
    }
    this.announceTimer = undefined;
    this.sweepTimer = undefined;
    this.watchTimer = undefined;
    if (this.queryTimer !== undefined) {
      clearTimeout(this.queryTimer);
      this.queryTimer = undefined;
    }
    this.stopPublishing();
    this.closeLinks();
    this.hosts.clear();
    this.lastSeen.clear();
  }
}
