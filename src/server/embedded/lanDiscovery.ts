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
 * `name` (friendly player/host name; instance names get mangled for uniqueness
 * by mDNS responders, TXT keeps the display value stable).
 */
import os from 'os';
import {Bonjour, Browser, Service} from 'bonjour-service';

/** mDNS service type — rendered as `_tmars._tcp` on the wire. */
export const LAN_SERVICE_TYPE = 'tmars';

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

export class LanDiscovery {
  private bonjour: Bonjour | undefined;
  private published: Service | undefined;
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
    this.stopPublishing();
    const name = options.name.trim() !== '' ? options.name.trim() : os.hostname();
    this.published = this.ensureBonjour().publish({
      // The instance name must be network-unique; mDNS renames on conflict, so
      // the DISPLAY name rides in TXT and the instance carries the hostname.
      name: `${name} (${os.hostname()})`.slice(0, 60),
      type: LAN_SERVICE_TYPE,
      port: options.port,
      txt: {iid: this.instanceId, v: options.version, name},
    });
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

  private stopPublishing(): void {
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
