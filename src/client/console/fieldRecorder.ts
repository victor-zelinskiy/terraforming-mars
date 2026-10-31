/*
 * THE FIELD FLIGHT RECORDER — phase 2 of the start director (the owner, 2026-10-31: «ты можешь сам получить нужные
 * данные, чтобы начать фазу 2?»). The box's saves carry the SERVER's side of a freeze only (the prompt that stood, the
 * minutes it stood, the reload that re-primed it — `scripts/field-opening-index.cjs`); what the player's SCREEN was
 * doing in those minutes — a hold that never released, a surface deaf to the pad, the arbiter's own verdict — lives in
 * the renderer's console, which nothing on the box keeps and which a reload erases. This module keeps it:
 *
 *   · every diagnostic line the console names (`[start-shadow]`, `[start-stranded]`, `[liveness]`, `[workspace-stall]`,
 *     `[transport]`, … — any `console.warn` / `console.error` whose text starts with a `[tag]`), bounded;
 *   · a HEARTBEAT the liveness arbiter writes once a second (the prompt, whether a surface accepts, what is in flight,
 *     the stack, how long since anything moved) — the last few of them;
 *   · persisted in `localStorage` under the game + player, SO THAT A RELOAD DOES NOT ERASE IT: the next boot of the
 *     same page finds the previous session's record and posts it to the embedded server as `previous-session`, with
 *     the navigation type (`reload` = the player re-entered) — the freeze's own signature, from the screen that froze.
 *
 * Posted to `POST /api/field-log` (`ApiFieldLog` — appended as JSONL under the server's `db/field-log/`), batched,
 * `keepalive` / `sendBeacon` on `pagehide`. Names of players never travel — the game id, the player id and the seat's
 * colour are what the saves are keyed by. Pure where it matters: the ring, the batching and the previous-session
 * handoff take their storage / clock / poster from the caller (`tests/console/fieldRecorder.spec.ts`).
 */

export type FieldHeartbeat = {
  /** The game id (the shell knows it; the URL does not carry it). */
  game?: string;
  /** The server's question as the arbiter saw it (`promptIdentityKey`), '' for none. */
  prompt: string;
  /** A surface serves the question and takes input. */
  accepting: boolean;
  /** What is provably moving (named). */
  inFlight: ReadonlyArray<string>;
  /** The stack's frames `<kind>:<phase>` and the projected section / sheet. */
  frames: ReadonlyArray<string>;
  section: string;
  /** Seconds since the observable picture last moved (the arbiter's clock). */
  quietS: number;
  /** A / B presses the arbiter counted since the last progress. */
  presses: number;
  at: number;
};

export type FieldRecord = {
  session: string;
  startedAt: number;
  game: string;
  player: string;
  profile: string;
  build: string;
  ua: string;
  lines: Array<{at: number, text: string}>;
  heartbeats: Array<FieldHeartbeat>;
};

export type FieldPost = {
  kind: 'live' | 'previous-session' | 'pagehide';
  /** `reload` / `navigate` / `back_forward` — the navigation that opened THIS page (for `previous-session`: how the player came back). */
  navigation?: string;
  record: FieldRecord;
};

export type FieldStorage = {
  read(): string | null;
  write(value: string): void;
  clear(): void;
};

export type FieldRecorderDeps = {
  storage: FieldStorage;
  post: (body: FieldPost, final: boolean) => void;
  now: () => number;
  /** The page identity. */
  page: {game: string, player: string, profile: string, build: string, ua: string, navigation: string};
  /** The debounce of a live batch (ms). */
  batchMs?: number;
  schedule?: (fn: () => void, ms: number) => unknown;
};

/** Lines kept per session (the newest win) and the longest line kept. */
export const FIELD_LINES_MAX = 120;
export const FIELD_LINE_CHARS = 1200;
/** Heartbeats kept (one a second — the last half minute before whatever happened). */
export const FIELD_HEARTBEATS_MAX = 30;
export const FIELD_BATCH_MS = 1500;
/** The diagnostic convention: a tagged line. Anything else the console prints is not ours to ship. */
const TAGGED = /^\[[a-z][a-z0-9-]*\]/i;

export const FIELD_STORAGE_KEY = 'tm_field_rec';

export class FieldRecorder {
  private readonly record: FieldRecord;
  private pendingLines: Array<{at: number, text: string}> = [];
  private batchTimer: unknown;
  private readonly batchMs: number;
  private readonly schedule: (fn: () => void, ms: number) => unknown;
  private persistQueued = false;

  constructor(private readonly deps: FieldRecorderDeps) {
    this.batchMs = deps.batchMs ?? FIELD_BATCH_MS;
    this.schedule = deps.schedule ?? ((fn, ms) => setTimeout(fn, ms));
    this.record = {
      session: `${deps.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
      startedAt: deps.now(),
      game: deps.page.game, player: deps.page.player, profile: deps.page.profile, build: deps.page.build, ua: deps.page.ua,
      lines: [], heartbeats: [],
    };
    this.handOverPreviousSession();
    this.persist();
  }

  /** The previous session of THIS page (a reload, a crash, a closed window) is posted first, as it was left. */
  private handOverPreviousSession(): void {
    const raw = this.deps.storage.read();
    if (raw === null || raw === '') {
      return;
    }
    let previous: FieldRecord | undefined;
    try {
      previous = JSON.parse(raw) as FieldRecord;
    } catch {
      previous = undefined;
    }
    this.deps.storage.clear();
    if (previous === undefined || previous.session === undefined || previous.session === this.record.session) {
      return;
    }
    if (previous.game !== this.record.game || previous.player !== this.record.player) {
      // Another table's record — still evidence, still posted; the server keys it by its own ids.
    }
    // Nothing happened in it (no line, no heartbeat) — nothing to say.
    if (previous.lines.length === 0 && previous.heartbeats.length === 0) {
      return;
    }
    this.deps.post({kind: 'previous-session', navigation: this.deps.page.navigation, record: previous}, false);
  }

  /** A console line of the diagnostic convention (`[tag] …`); anything else is ignored. */
  line(text: string): boolean {
    if (!TAGGED.test(text)) {
      return false;
    }
    const entry = {at: this.deps.now(), text: text.slice(0, FIELD_LINE_CHARS)};
    this.record.lines.push(entry);
    if (this.record.lines.length > FIELD_LINES_MAX) {
      this.record.lines.splice(0, this.record.lines.length - FIELD_LINES_MAX);
    }
    this.pendingLines.push(entry);
    this.persist();
    if (this.batchTimer === undefined) {
      this.batchTimer = this.schedule(() => this.flush(false), this.batchMs);
    }
    return true;
  }

  /** The arbiter's heartbeat — the last `FIELD_HEARTBEATS_MAX` are kept; persisted at most once a second. */
  heartbeat(h: Omit<FieldHeartbeat, 'at'>): void {
    if (h.game !== undefined && h.game !== '' && this.record.game !== h.game) {
      this.record.game = h.game;
    }
    this.record.heartbeats.push({...h, inFlight: [...h.inFlight], frames: [...h.frames], at: this.deps.now()});
    if (this.record.heartbeats.length > FIELD_HEARTBEATS_MAX) {
      this.record.heartbeats.splice(0, this.record.heartbeats.length - FIELD_HEARTBEATS_MAX);
    }
    this.persist();
  }

  /** The pending lines (and the latest heartbeats) go to the server; `final` on `pagehide` (a beacon, never awaited). */
  flush(final: boolean): void {
    this.batchTimer = undefined;
    if (this.pendingLines.length === 0 && !final) {
      return;
    }
    const lines = this.pendingLines;
    this.pendingLines = [];
    this.deps.post({
      kind: final ? 'pagehide' : 'live',
      record: {...this.record, lines, heartbeats: this.record.heartbeats.slice(-5)},
    }, final);
  }

  /** The page is leaving: the record stays in storage for the next boot's hand-over; what is pending goes out now. */
  pagehide(): void {
    this.persistNow();
    this.flush(true);
  }

  snapshot(): FieldRecord {
    return {...this.record, lines: [...this.record.lines], heartbeats: [...this.record.heartbeats]};
  }

  private persist(): void {
    if (this.persistQueued) {
      return;
    }
    this.persistQueued = true;
    this.schedule(() => {
      this.persistQueued = false;
      this.persistNow();
    }, 250);
  }

  private persistNow(): void {
    try {
      this.deps.storage.write(JSON.stringify(this.record));
    } catch {
      // Storage full or disabled — the live posts still carry the lines.
    }
  }
}

// ── The browser installation ──────────────────────────────────────────────────────────────────────────────────────

let installed: FieldRecorder | undefined;

function pageIdentity(): FieldRecorderDeps['page'] {
  const params = new URLSearchParams(window.location.search);
  const player = params.get('id') ?? '';
  const nav = (performance.getEntriesByType?.('navigation')?.[0] as {type?: string} | undefined)?.type ?? '';
  const build = (document.querySelector('meta[name="build"]') as HTMLMetaElement | null)?.content ??
    (window as unknown as {__tmBuild?: string}).__tmBuild ?? '';
  return {
    game: params.get('game') ?? '',
    player,
    profile: params.get('consoleProfile') ?? '',
    build,
    ua: navigator.userAgent.slice(0, 120),
    navigation: nav,
  };
}

function browserPost(body: FieldPost, final: boolean): void {
  const json = JSON.stringify(body);
  try {
    if (final && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/field-log', new Blob([json], {type: 'application/json'}));
      return;
    }
    void fetch('/api/field-log', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: json, keepalive: true}).catch(() => undefined);
  } catch {
    // The recorder never throws into the console it records.
  }
}

/**
 * Idempotent — installed once per page by the console key bridge (the console's own entry). Wraps `console.warn` and
 * `console.error` to COPY tagged lines (the originals still print); the heartbeat is the shell's call.
 */
export function installFieldRecorder(): FieldRecorder | undefined {
  if (installed !== undefined || typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return installed;
  }
  const page = pageIdentity();
  const key = `${FIELD_STORAGE_KEY}:${page.player}`;
  const storage: FieldStorage = {
    read: () => localStorage.getItem(key),
    write: (v) => localStorage.setItem(key, v),
    clear: () => localStorage.removeItem(key),
  };
  const recorder = new FieldRecorder({storage, post: browserPost, now: () => Date.now(), page});
  installed = recorder;
  const wrap = (method: 'warn' | 'error') => {
    const original = console[method].bind(console);
    console[method] = (...args: Array<unknown>) => {
      original(...args);
      try {
        const text = args.map((a) => typeof a === 'string' ? a : (a instanceof Error ? a.message : JSON.stringify(a))).join(' ');
        recorder.line(text);
      } catch {
        // never into the console being recorded
      }
    };
  };
  wrap('warn');
  wrap('error');
  window.addEventListener('pagehide', () => recorder.pagehide());
  (window as unknown as {__conFieldRecorder?: () => FieldRecord}).__conFieldRecorder = () => recorder.snapshot();
  return recorder;
}

/** The arbiter's heartbeat — a no-op until the recorder is installed. */
export function recordFieldHeartbeat(h: Omit<FieldHeartbeat, 'at'>): void {
  installed?.heartbeat(h);
}
