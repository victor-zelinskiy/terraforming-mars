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
 *
 * FAULTS (FREEZE ZERO, stage 4 — «fault injection for every transport outcome never seen today»): `faultNext(match,
 * fault)` breaks the NEXT matching request in one of the ways a wire breaks (`WireFault`). Three of them never reach
 * the server (the move is NOT made), two do (the move IS made and the page never learns it from the answer) — the
 * second pair is the one a client recovers from only by asking the server again.
 */
import type {BottleClock} from './bottleTime';
import type * as Host from './server/bottleServerHost';

export type WireRecord = {at: number, method: string, url: string, status: number, bytes: number};

/** How the next matching request breaks. */
export type WireFault =
  /** The request never reaches the server; the page's `fetch` rejects (the poll's XHR: `onerror`). */
  | 'network'
  /** The server's 400 with no id — the move is not made. */
  | 'refused'
  /** The server's 400 «the question has moved on» (`STALE_PROMPT`) — the move is not made. */
  | 'stale'
  /** A 5xx page (a restarting server, a proxy) — the move is not made. */
  | 'error500'
  /** The request is lost before the server: no answer ever comes. */
  | 'silent'
  /** THE SERVER MAKES THE MOVE; its answer never comes. */
  | 'lost'
  /** THE SERVER MAKES THE MOVE; its answer does not parse. */
  | 'malformed';

export const WIRE_FAULTS: ReadonlyArray<WireFault> = ['network', 'refused', 'stale', 'error500', 'silent', 'lost', 'malformed'];

/** The server's own id of «the question has moved on» (`common/app/AppErrorId.ts` — a literal: the wire is plain data). */
const STALE_PROMPT_ID = '#stale-prompt';

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
  /** THE NEXT request that matches breaks this way (one shot; a later call replaces a fault still armed). */
  faultNext(match: (method: string, url: string) => boolean, fault: WireFault): void,
  /** Is a fault armed and not yet taken? */
  faultArmed(): boolean,
  /** The faults that were TAKEN, in order. */
  faulted: Array<{at: number, fault: WireFault, method: string, url: string}>,
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
  let armed: {match: (method: string, url: string) => boolean, fault: WireFault} | undefined;

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
    faultNext: (match, fault) => {
      armed = {match, fault};
    },
    faultArmed: () => armed !== undefined,
    faulted: [],
    giveBack: () => {},
  };

  async function exchange(method: string, url: string, body: string | undefined): Promise<{status: number, headers: Record<string, string>, body: string}> {
    const path = pathOf(url);
    flying++;
    /** A request that is GONE (no answer will ever come) is no longer on the wire — counted down where it vanishes. */
    let gone = false;
    try {
      for (const entry of holds) {
        if (entry.match(method, path)) {
          await new Promise<void>((resolve) => entry.waiters.push(resolve));
        }
      }
      if (wire.latencyMs > 0) {
        await new Promise<void>((resolve) => clock.setTimeout(resolve, wire.latencyMs));
      }
      if (armed !== undefined && armed.match(method, path)) {
        const fault = armed.fault;
        armed = undefined;
        wire.faulted.push({at: clock.now(), fault, method, url: path});
        const vanish = (): Promise<never> => {
          gone = true;
          flying--;
          wire.log.push({at: clock.now(), method, url: path, status: 0, bytes: 0});
          return new Promise<never>(() => {});
        };
        const answered = (status: number, answer: string): {status: number, headers: Record<string, string>, body: string} => {
          wire.log.push({at: clock.now(), method, url: path, status, bytes: answer.length});
          return {status, headers: {'content-type': 'application/json'}, body: answer};
        };
        switch (fault) {
        case 'network':
          wire.log.push({at: clock.now(), method, url: path, status: 0, bytes: 0});
          throw new TypeError('Failed to fetch');
        case 'refused':
          return answered(400, JSON.stringify({message: 'The wire refused this request (an injected fault).'}));
        case 'stale':
          return answered(400, JSON.stringify({id: STALE_PROMPT_ID, message: 'The question has moved on (an injected fault).'}));
        case 'error500':
          return answered(500, 'Internal server error');
        case 'silent':
          return await vanish();
        case 'lost':
          await server.request(method, path, body);
          return await vanish();
        case 'malformed':
          await server.request(method, path, body);
          return answered(200, '{"this is not');
        }
      }
      const file = wire.files.get(path.split('?')[0]);
      const answer = file !== undefined ?
        {status: 200, headers: {'content-type': 'application/json'}, body: file} :
        await server.request(method, path, body);
      wire.log.push({at: clock.now(), method, url: path, status: answer.status, bytes: answer.body.length});
      return answer;
    } finally {
      if (!gone) {
        flying--;
      }
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
