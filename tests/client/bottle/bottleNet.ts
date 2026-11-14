/*
 * THE BOTTLE'S WIRE (FREEZE ZERO · B3, the spike) — the two doors a page's request leaves through, bound to the
 * in-process server.
 *
 * The client reaches the server through exactly two globals: `fetch` (the root's `update()`, the submit funnel
 * `fetchPlayerInput`, every preview / journal / stats read) and `XMLHttpRequest` (ONE user — the transport's poll,
 * `waitForUpdate`). Neither is injectable in the product and neither has to be: both are looked up on the global at
 * the call, so the bottle replaces the globals for its life. A request then enters `processRequest` of the real server
 * (`server/bottleServerHost.ts`) — the router, the handler's validation, the model's serialisation all run.
 *
 * TIME: an answer arrives `latencyMs` of the bottle's clock after the request (0 = in the microtasks of the same
 * task — an instant server). A request can be HELD (`hold(match)`) and released by hand: the perturbation the plan's
 * § 3.2 asks for («a delayed server answer») is one call.
 */
import type {BottleClock} from './bottleTime';
import type * as Host from './server/bottleServerHost';

export type WireRecord = {at: number, method: string, url: string, status: number, bytes: number};

export type BottleWire = {
  /** Every request the page made, in order. */
  log: Array<WireRecord>,
  /** Requests on the wire right now. */
  inFlight(): number,
  /** Answers come this many ms of the bottle's clock after the request. */
  latencyMs: number,
  /** Hold every later request whose URL matches; the returned function lets them through. */
  hold(match: (method: string, url: string) => boolean): () => void,
  /** A file answer for a path the game server does not serve in the bottle (`assets/…`). */
  files: Map<string, string>,
  giveBack(): void,
};

type Globals = Record<string, unknown>;

/** What the product reads of a `fetch` response. */
type WireResponse = {
  ok: boolean,
  status: number,
  statusText: string,
  headers: {get(name: string): string | null},
  json(): Promise<unknown>,
  text(): Promise<string>,
};

function pathOf(url: string): string {
  // The page asks by a relative path (`apiUrl` with the default empty base): `api/player?id=…`, `/player/input?id=…`.
  const stripped = url.replace(/^https?:\/\/[^/]+/, '');
  return stripped.startsWith('/') ? stripped : '/' + stripped;
}

export function takeWire(server: typeof Host, clock: BottleClock): BottleWire {
  const globals = globalThis as unknown as Globals;
  const win = globals.window as Globals | undefined;
  let flying = 0;
  const holds = new Set<{match: (method: string, url: string) => boolean, waiters: Array<() => void>}>();

  const wire: BottleWire = {
    log: [],
    inFlight: () => flying,
    latencyMs: 0,
    hold: (match) => {
      const entry = {match, waiters: [] as Array<() => void>};
      holds.add(entry);
      return () => {
        holds.delete(entry);
        for (const go of entry.waiters.splice(0)) {
          go();
        }
      };
    },
    files: new Map(),
    giveBack: () => {},
  };

  async function exchange(method: string, url: string, body: string | undefined): Promise<{status: number, headers: Record<string, string>, body: string}> {
    const path = pathOf(url);
    flying++;
    try {
      for (const entry of holds) {
        if (entry.match(method, path)) {
          await new Promise<void>((resolve) => entry.waiters.push(resolve));
        }
      }
      if (wire.latencyMs > 0) {
        await new Promise<void>((resolve) => clock.setTimeout(resolve, wire.latencyMs));
      }
      const file = wire.files.get(path.split('?')[0]);
      const answer = file !== undefined ?
        {status: 200, headers: {'content-type': 'application/json'}, body: file} :
        await server.request(method, path, body);
      wire.log.push({at: clock.now(), method, url: path, status: answer.status, bytes: answer.body.length});
      return answer;
    } finally {
      flying--;
    }
  }

  const bottleFetch = async (input: unknown, init?: {method?: string, body?: unknown, signal?: {aborted: boolean, addEventListener(type: string, fn: () => void): void}}): Promise<WireResponse> => {
    const url = typeof input === 'string' ? input : String((input as {url?: string}).url ?? input);
    const method = (init?.method ?? 'GET').toUpperCase();
    const aborted = (): Error => Object.assign(new Error('The operation was aborted.'), {name: 'AbortError'});
    if (init?.signal?.aborted === true) {
      throw aborted();
    }
    const answer = await Promise.race([
      exchange(method, url, typeof init?.body === 'string' ? init.body : undefined),
      new Promise<never>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(aborted()))),
    ]);
    return {
      ok: answer.status >= 200 && answer.status < 300,
      status: answer.status,
      statusText: String(answer.status),
      headers: {get: (name) => answer.headers[name.toLowerCase()] ?? null},
      json: () => Promise.resolve().then(() => JSON.parse(answer.body) as unknown),
      text: () => Promise.resolve(answer.body),
    };
  };

  /** The slice of `XMLHttpRequest` the transport's poll uses (`open` · `send` · `onload` · `onerror` · `ontimeout`). */
  class BottleXhr {
    public responseType = '';
    public timeout = 0;
    public status = 0;
    public response: unknown = null;
    public responseText = '';
    public onload: (() => void) | null = null;
    public onerror: (() => void) | null = null;
    public ontimeout: (() => void) | null = null;
    private method = 'GET';
    private url = '';
    private done = false;
    open(method: string, url: string): void {
      this.method = method.toUpperCase();
      this.url = url;
    }
    setRequestHeader(): void {}
    abort(): void {
      this.done = true;
    }
    send(body?: string): void {
      let cancelTimeout: unknown;
      if (this.timeout > 0) {
        cancelTimeout = clock.setTimeout(() => {
          if (!this.done) {
            this.done = true;
            this.ontimeout?.();
          }
        }, this.timeout);
      }
      exchange(this.method, this.url, body).then((answer) => {
        if (this.done) {
          return;
        }
        this.done = true;
        clock.clearTimeout(cancelTimeout);
        this.status = answer.status;
        this.responseText = answer.body;
        if (this.responseType === 'json') {
          try {
            this.response = JSON.parse(answer.body);
          } catch {
            this.response = null;
          }
        } else {
          this.response = answer.body;
        }
        this.onload?.();
      }, () => {
        if (!this.done) {
          this.done = true;
          this.onerror?.();
        }
      });
    }
  }

  const saved: Array<() => void> = [];
  const replace = (host: Globals | undefined, key: string, value: unknown): void => {
    if (host === undefined) {
      return;
    }
    const descriptor = Object.getOwnPropertyDescriptor(host, key);
    Object.defineProperty(host, key, {value, configurable: true, writable: true, enumerable: descriptor?.enumerable ?? true});
    saved.push(() => {
      if (descriptor !== undefined) {
        Object.defineProperty(host, key, descriptor);
      } else {
        delete host[key];
      }
    });
  };
  replace(globals, 'fetch', bottleFetch);
  replace(win, 'fetch', bottleFetch);
  replace(globals, 'XMLHttpRequest', BottleXhr);
  replace(win, 'XMLHttpRequest', BottleXhr);
  wire.giveBack = () => {
    for (const restore of saved.reverse()) {
      restore();
    }
    saved.length = 0;
  };
  return wire;
}
