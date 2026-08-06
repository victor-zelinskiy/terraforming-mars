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
 * The TXT record carries: `iid` (random per process — how a browser filters its
 * OWN advertisement out), `v` (build version, soft compat warning on the guest),
 * `name` (friendly player/host name; the INSTANCE name gets disambiguated on a
 * conflict — see `publishAttempt` — so TXT is what keeps the display value stable).
 */
import os from 'os';
import {Bonjour, Browser, Service} from 'bonjour-service';

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

export type LanHostInfo = {
  /** Unique key for the row (the advertisement's instance id). */
  id: string;
  /** Friendly host name to render (TXT `name`, falling back to the instance name). */
  name: string;
  /** Addresses the host answers on; the client probes them in order. */
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

type FoundService = Pick<Service, 'name' | 'port'> & {
  addresses?: string[];
  txt?: Record<string, unknown>;
};

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
    addresses: (service.addresses ?? []).filter((a) => typeof a === 'string' && a !== ''),
    port: service.port,
    version: typeof txt.v === 'string' ? txt.v : '',
  };
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
  private bonjour: Bonjour | undefined;
  private published: Service | undefined;
  private confirmTimer: ReturnType<typeof setTimeout> | undefined;
  private browser: Browser | undefined;
  private advertiseOptions: AdvertiseOptions | undefined;
  private readonly hosts = new Map<string, LanHostInfo>();
  /** Random per process; lets the browser drop this process's own advertisement. */
  public readonly instanceId: string = `i${Math.floor(Math.random() * Math.pow(16, 12)).toString(16)}`;

  constructor(private readonly onHostsChanged: (hosts: LanHostInfo[]) => void) {}

  private ensureBonjour(): Bonjour {
    if (this.bonjour === undefined) {
      this.bonjour = new Bonjour();
    }
    return this.bonjour;
  }

  /** Publish (or re-publish) this host's embedded server on the LAN. */
  public advertise(options: AdvertiseOptions): void {
    this.advertiseOptions = options;
    this.publishAttempt(1);
  }

  /**
   * Publish under the `attempt`-th candidate name and VERIFY it actually went up.
   *
   * `name (hostname)` is unique per machine+profile, NOT per process — a dev build
   * beside the packaged one, a second install, or an orphaned utility process from
   * the previous run all probe for the very same instance name. bonjour-service
   * does not implement RFC 6762 §9 renaming there: it tears the service down and
   * only `console.log`s an Error, so without this retry the loser stays silently
   * invisible on the LAN for the whole session, with nothing ever retrying.
   */
  private publishAttempt(attempt: number): void {
    const options = this.advertiseOptions;
    if (options === undefined) {
      return;
    }
    this.stopPublishing();
    const display = lanDisplayName(options.name);
    const service = this.ensureBonjour().publish({
      name: lanInstanceName(display, attempt),
      type: LAN_SERVICE_TYPE,
      port: options.port,
      txt: {iid: this.instanceId, v: options.version, name: display},
    });
    this.published = service;
    service.once('up', () => this.clearConfirmTimer());
    this.confirmTimer = setTimeout(() => this.confirmPublished(service, attempt), PUBLISH_CONFIRM_MS);
    this.confirmTimer.unref?.();
  }

  /**
   * Judge a publish that never emitted `up`. The library's conflict path calls
   * `service.stop()`, which clears `activated` — that flag is what separates a
   * TAKEN name (retry under the next one) from a merely slow/quiet network
   * (still activated: leave it, `up` may yet arrive).
   */
  private confirmPublished(service: Service, attempt: number): void {
    this.confirmTimer = undefined;
    if (this.published !== service || service.published) {
      return;
    }
    if (service.activated) {
      console.warn(`[lan] "${service.name}" has not been confirmed yet — the announce is slow, leaving it to settle`);
      return;
    }
    if (attempt >= MAX_NAME_ATTEMPTS) {
      console.error(`[lan] "${service.name}" is taken and ${MAX_NAME_ATTEMPTS} names were refused — this host stays hidden on the LAN`);
      return;
    }
    console.warn(`[lan] "${service.name}" is already advertised on the network (another instance of the app?) — retrying as attempt ${attempt + 1}`);
    this.publishAttempt(attempt + 1);
  }

  /** Live rename (profile change on the host) — re-publish under the new name. */
  public rename(name: string): void {
    if (this.advertiseOptions !== undefined) {
      this.advertise({...this.advertiseOptions, name});
    }
  }

  /** Start browsing for other hosts; every add/remove re-emits the full list. */
  public browse(): void {
    if (this.browser !== undefined) {
      return;
    }
    this.browser = this.ensureBonjour().find({type: LAN_SERVICE_TYPE}, (service) => {
      this.upsert(service as FoundService);
    });
    this.browser.on('down', (service) => {
      const info = toLanHostInfo(service as FoundService, this.instanceId);
      if (info !== undefined && this.hosts.delete(info.id)) {
        this.emit();
      }
    });
  }

  private upsert(service: FoundService): void {
    const info = toLanHostInfo(service, this.instanceId);
    if (info === undefined) {
      return;
    }
    this.hosts.set(info.id, info);
    this.emit();
  }

  private emit(): void {
    this.onHostsChanged([...this.hosts.values()]);
  }

  private clearConfirmTimer(): void {
    if (this.confirmTimer !== undefined) {
      clearTimeout(this.confirmTimer);
      this.confirmTimer = undefined;
    }
  }

  private stopPublishing(): void {
    this.clearConfirmTimer();
    if (this.published !== undefined) {
      try {
        this.published.stop?.();
      } catch {
        // best effort — a teardown failure must not break the server
      }
      this.published = undefined;
    }
  }

  public destroy(): void {
    this.stopPublishing();
    try {
      this.browser?.stop();
    } catch {
      // best effort
    }
    this.browser = undefined;
    this.bonjour?.destroy();
    this.bonjour = undefined;
    this.hosts.clear();
  }
}
