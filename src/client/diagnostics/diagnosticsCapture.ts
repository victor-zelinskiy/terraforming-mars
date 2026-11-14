/*
 * THE PAGE'S ONE INTERCEPTOR — installed FIRST, by `main.ts`, before the app exists.
 *
 * Until this module, a diagnostic signal of the page had three half-readers: the field recorder wrapped
 * `console.warn/error` (but only once the console key bridge was up — the boot and the main menu printed into nothing —
 * and it flattened an `Error` to its message, losing the stack), `vueErrorReport` printed Vue's caught exceptions, and
 * the main process read the console from outside. Now ONE place sees everything the page says, from its first line:
 *
 *   console.warn / console.error ─┐
 *   window 'error'                ├─→ a `DiagLine` (the full text, the stack, the screen at that moment)
 *   window 'unhandledrejection'   │        │
 *   Vue's errorHandler ───────────┘        ├─→ the page's `DiagJournal` (classified, coalesced, episodes)
 *                                          └─→ the line listeners (the field recorder)
 *
 * ONE THROW — ONE RECORD AND ONE PRINTED LINE. An exception reported through `reportDiagnosticError` is printed by the
 * ORIGINAL console (so DevTools, the console export and the e2e harness read the very line they always read) and
 * recorded here directly, with the real stack; the wrapper does not record that print a second time.
 *
 * It imports nothing that renders and nothing of the console: it must be cheap enough to run before the first paint,
 * and it must work on a page whose application never mounted. Lifetimes: none — it is installed once per page and
 * lives as long as the page.
 */

import raw_settings from '@/genfiles/settings.json';
import {DiagEntry, DiagLevel, DiagScreen} from '@/common/diagnostics/DiagnosticModel';
import {DiagChange, DiagJournal, DiagLine} from '@/common/diagnostics/journal';

export type DiagLineListener = (line: DiagLine) => void;
export type DiagEntryListener = (entry: DiagEntry, change: DiagChange) => void;

/** What the supervisor's heartbeat tells this module about the screen (the field recorder's own beat, passed on). */
export type DiagHeartbeat = {
  prompt: string;
  accepting: boolean;
  inFlight: ReadonlyArray<string>;
  frames: ReadonlyArray<string>;
  section: string;
  quietS: number;
  block?: string;
};

/** Lines kept for a listener that subscribes late (the field recorder is installed with the console). */
const BACKLOG_MAX = 160;
/** One argument's longest rendering — an object dumped into a warn must not become the whole journal. */
const ARG_MAX = 6000;

let installed = false;
let journal: DiagJournal | undefined;
let emitting = false;
let backlog: Array<DiagLine> = [];
const lineListeners = new Set<DiagLineListener>();
const entryListeners = new Set<DiagEntryListener>();
let lastHeartbeat: DiagHeartbeat | undefined;
let lastHeartbeatAt = 0;
let appScreen = '';

type ConsoleMethod = (...args: Array<unknown>) => void;
const original: {warn: ConsoleMethod, error: ConsoleMethod} = {
  // Replaced at install; until then they are the platform's (a unit spec that never installs prints as usual).
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

/** The build that runs — `settings.json`'s version, else its git head. */
export function diagnosticsBuild(): string {
  const s = raw_settings as {version?: string, head?: string};
  return s.version !== undefined && s.version !== '' ? s.version : (s.head ?? '');
}

/** One console argument as the console itself would show it: a string as it is, an `Error` as its stack. */
export function formatConsoleArg(arg: unknown): string {
  if (typeof arg === 'string') {
    return arg;
  }
  if (arg instanceof Error) {
    return errorText(arg);
  }
  if (arg === null || arg === undefined || typeof arg === 'number' || typeof arg === 'boolean' || typeof arg === 'bigint') {
    return String(arg);
  }
  if (typeof arg === 'function') {
    return `[function ${arg.name || 'anonymous'}]`;
  }
  try {
    const seen = new WeakSet<object>();
    const json = JSON.stringify(arg, (_key, value: unknown) => {
      if (value instanceof Error) {
        return errorText(value);
      }
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[circular]';
        }
        seen.add(value);
      }
      return typeof value === 'bigint' ? String(value) : value;
    });
    const text = json ?? String(arg);
    return text.length > ARG_MAX ? `${text.slice(0, ARG_MAX)}…(truncated)` : text;
  } catch {
    return String(arg);
  }
}

/** `TypeError: message` + the frames. V8's stack already begins with that head; a stackless error has only the head. */
export function errorText(err: Error): string {
  const head = `${err.name}: ${err.message}`;
  if (typeof err.stack !== 'string' || err.stack === '') {
    return head;
  }
  return err.stack.startsWith(err.name) ? err.stack : `${head}\n${err.stack}`;
}

/** The full text of one console call and the stack of its first `Error` — pure. */
export function consoleCallText(args: ReadonlyArray<unknown>): {text: string, stack?: string} {
  const text = args.map(formatConsoleArg).join(' ');
  const firstError = args.find((a): a is Error => a instanceof Error);
  return firstError === undefined ? {text} : {text, stack: errorText(firstError)};
}

/**
 * `[page-error] <kind>: <Name: message> @ <the first two frames>` — the line an uncaught error has always been printed
 * as (the field log's tools and the e2e harness read it). Pure.
 */
export function pageErrorLine(kind: string, err: unknown): string {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  const frames = err instanceof Error && typeof err.stack === 'string' ?
    err.stack.split('\n').slice(1, 3).map((f) => f.trim()).join(' | ') : '';
  return `[page-error] ${kind}: ${message.slice(0, 300)}${frames !== '' ? ` @ ${frames.slice(0, 300)}` : ''}`;
}

/** What the screen was doing right now — the last heartbeat (while it is fresh) and what the document itself says. */
/*
 * THE VIEWPORT, READ ONCE PER RESIZE — never per recorded line. `window.innerWidth` / `innerHeight` make the browser
 * bring the page's layout up to date before they answer, and a line is recorded wherever the game prints one: in the
 * middle of a heavy mount that is a whole forced layout inside somebody else's frame. A diagnostic may not cost the
 * frame it describes — so the reading is kept, and re-taken only when the window says its size changed.
 */
let viewportText: string | undefined;

function readViewport(): string {
  return typeof window !== 'undefined' ?
    `${window.innerWidth}×${window.innerHeight}@${Math.round((window.devicePixelRatio || 1) * 100) / 100}` : '';
}

export function currentDiagScreen(now: number = Date.now()): DiagScreen {
  const html = typeof document !== 'undefined' ? document.documentElement : undefined;
  const profile = /(?:^|\s)con-profile-([a-z0-9]+)/.exec(html?.className ?? '')?.[1] ?? '';
  viewportText ??= readViewport();
  const viewport = viewportText;
  // A heartbeat older than a few seconds describes a screen that is gone (the game was left; the arbiter is not
  // running): the snapshot then names only what the document knows.
  const beat = lastHeartbeat !== undefined && now - lastHeartbeatAt < 5_000 ? lastHeartbeat : undefined;
  return {
    screen: appScreen,
    section: beat?.section ?? '',
    prompt: beat?.prompt ?? '',
    accepting: beat?.accepting ?? true,
    inFlight: beat === undefined ? [] : [...beat.inFlight],
    frames: beat === undefined ? [] : [...beat.frames],
    quietS: beat?.quietS ?? 0,
    block: beat?.block ?? '',
    profile, viewport,
  };
}

function record(level: DiagLevel, text: string, stack: string | undefined): void {
  const line: DiagLine = {at: Date.now(), level, text, screen: currentDiagScreen(), ...(stack !== undefined ? {stack} : {})};
  backlog.push(line);
  if (backlog.length > BACKLOG_MAX) {
    backlog.splice(0, backlog.length - BACKLOG_MAX);
  }
  for (const listener of lineListeners) {
    try {
      listener(line);
    } catch {
      // A reader never breaks the console it reads.
    }
  }
  if (journal !== undefined) {
    const {entry, change} = journal.ingest(line);
    notify(entry, change);
  }
}

function notify(entry: DiagEntry, change: DiagChange): void {
  for (const listener of entryListeners) {
    try {
      listener(entry, change);
    } catch {
      // as above
    }
  }
}

/**
 * AN EXCEPTION, REPORTED — the one door for a caught or uncaught error. `line` is the console line it has always been
 * printed as (`[vue-error] …`, `[page-error] …`); it goes to the ORIGINAL console with the error beside it, and into
 * the journal once, with the error's own stack.
 */
export function reportDiagnosticError(line: string, err: unknown): void {
  emitting = true;
  try {
    original.error(line, err);
  } finally {
    emitting = false;
  }
  const stack = err instanceof Error ? errorText(err) : undefined;
  record('error', stack === undefined ? line : `${line}\n${stack}`, stack);
}

/** Every line the page printed (and will print): the kept backlog first, then live. Returns the unsubscribe. */
export function onDiagnosticLine(listener: DiagLineListener, opts: {replay?: boolean} = {}): () => void {
  if (opts.replay === true) {
    for (const line of backlog) {
      listener(line);
    }
  }
  lineListeners.add(listener);
  return () => lineListeners.delete(listener);
}

/** Every change of the page's journal. Returns the unsubscribe. */
export function onDiagnosticEntry(listener: DiagEntryListener): () => void {
  entryListeners.add(listener);
  return () => entryListeners.delete(listener);
}

/** The page's journal (undefined until installed — a unit spec, a server-side import). */
export function pageJournal(): DiagJournal | undefined {
  return journal;
}

/** Tell the listeners about a record the journal changed by itself (a tick that closed an episode, an adoption). */
export function announceDiagnosticEntry(entry: DiagEntry, change: DiagChange): void {
  notify(entry, change);
}

/** The supervisor's heartbeat (once a second while a game screen stands) — what `currentDiagScreen` reads. */
export function noteDiagnosticsHeartbeat(beat: DiagHeartbeat): void {
  lastHeartbeat = beat;
  lastHeartbeatAt = Date.now();
}

/** The app's screen (`player-home`, `main-menu`, …), told by the app-level layer that receives it. */
export function noteDiagnosticsAppScreen(screen: string): void {
  appScreen = screen;
}

/** Idempotent. The FIRST statement of `main.ts`. */
export function installDiagnosticsCapture(): void {
  if (installed || typeof window === 'undefined') {
    return;
  }
  installed = true;
  const build = diagnosticsBuild();
  // What the field tools read as the page's build (`fieldRecorder.pageIdentity`) — nobody set it until now.
  (window as unknown as {__tmBuild?: string}).__tmBuild = build;
  journal = new DiagJournal({
    runtime: 'page',
    session: `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`,
    build,
  });
  const wrap = (method: 'warn' | 'error'): void => {
    const platform = console[method].bind(console) as ConsoleMethod;
    original[method] = platform;
    console[method] = (...args: Array<unknown>) => {
      platform(...args);
      if (emitting) {
        return;
      }
      try {
        const {text, stack} = consoleCallText(args);
        record(method, text, stack);
      } catch {
        // never into the console being recorded
      }
    };
  };
  wrap('warn');
  wrap('error');
  // Taken now — the boot's first script, nothing laid out yet — and again only when the window resizes.
  viewportText = readViewport();
  window.addEventListener('resize', () => {
    viewportText = readViewport();
  });
  // AN EXCEPTION IN AN ASYNC BEAT leaves its flow half-way (a stage never left, a hold never released): every uncaught
  // error and every unhandled rejection is a tagged line, with its whole stack.
  window.addEventListener('error', (e) => {
    // The browser's own notice that a ResizeObserver callback was deferred a frame — no exception, no flow affected.
    if (/^ResizeObserver loop/.test(String(e.message ?? ''))) {
      return;
    }
    // A resource that failed to load (an <img>, a <script>) fires `error` on the element and reaches here only in the
    // capture phase — this listener is a bubble one, so what arrives is a script error.
    const err: unknown = e.error ?? (e.filename ? `${e.message} (${e.filename}:${e.lineno}:${e.colno})` : e.message);
    reportDiagnosticError(pageErrorLine('uncaught', err), err);
  });
  window.addEventListener('unhandledrejection', (e) => {
    reportDiagnosticError(pageErrorLine('unhandled rejection', e.reason), e.reason);
  });
}

/** Spec seam: the module as it was before `installDiagnosticsCapture` (the wrapped console is restored). */
export function __resetDiagnosticsCaptureForTesting(): void {
  journal = undefined;
  backlog = [];
  lineListeners.clear();
  entryListeners.clear();
  lastHeartbeat = undefined;
  appScreen = '';
  viewportText = undefined;
}

/** Spec seam: a journal without a window (the capture's record path under the server runner). */
export function __installDiagnosticsJournalForTesting(j: DiagJournal): (level: DiagLevel, args: ReadonlyArray<unknown>) => void {
  journal = j;
  return (level, args) => {
    const {text, stack} = consoleCallText(args);
    record(level, text, stack);
  };
}
