// Export the renderer console to a text file (the "⬇ Экспорт консоли" button in the F12
// DevTools overlay). Steam Machine / Deck have no easy copy-out of the console, so this dumps
// everything the renderer logged to a file NEXT TO the game log, named with the game, date and
// time. Passive by construction: it buffers the `console-message` event (which fires whether or
// not DevTools is open) — it does NOT touch the renderer, the game, or the pad-cursor overlay.
//
// Filename: <game>_console_export_<YYYY-MM-DD_HH-MM-SS>.txt  (game sanitized for the filesystem).
// Directory: TM_LOG_DIR / dirname(TM_LOG_FILE) / dirname($APPIMAGE) (where the wrapper's
//   terraforming-mars-steam.log lives) / app logs path — first that resolves.

import type {App, BrowserWindow} from 'electron';
import * as fs from 'fs';
import * as path from 'path';

/** One captured console line. */
export interface ConsoleEntry {
  t: number;
  level: string;
  text: string;
  source: string;
}

const MAX_ENTRIES = 20000;

/** Normalize the console level to a short upper token. The `console-message` event carries a
 *  STRING level on modern Electron and an INT (0 verbose … 3 error) on the legacy signature. */
export function normalizeConsoleLevel(level: unknown): string {
  if (typeof level === 'string' && level.trim() !== '') {
    return level.trim().toUpperCase();
  }
  switch (Number(level)) {
  case 0: return 'DEBUG';
  case 2: return 'WARN';
  case 3: return 'ERROR';
  default: return 'INFO';
  }
}

/** Two-digit zero-pad for the timestamp fields. */
function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

/** `YYYY-MM-DD_HH-MM-SS` from local time — filesystem-safe (no `:`). PURE (unit-tested). */
export function formatStamp(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}_` +
    `${pad2(d.getHours())}-${pad2(d.getMinutes())}-${pad2(d.getSeconds())}`;
}

/** `HH:MM:SS` for a per-line gutter. */
function clock(t: number): string {
  const d = new Date(t);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** Reduce a game name to a safe, bounded filename segment (never empty). PURE (unit-tested). */
export function sanitizeForFilename(name: string): string {
  const cleaned = (name ?? '')
    .replace(/[^A-Za-z0-9._-]+/g, '_') // collapse any run of unsafe chars to one _
    .replace(/^[._-]+|[._-]+$/g, '')   // trim leading/trailing separators
    .slice(0, 48);
  return cleaned === '' ? 'game' : cleaned;
}

/** `<game>_console_export_<stamp>.txt`. PURE (unit-tested). */
export function buildExportFilename(gameName: string, when: Date): string {
  return `${sanitizeForFilename(gameName)}_console_export_${formatStamp(when)}.txt`;
}

/** One formatted export line. PURE (unit-tested). */
export function formatConsoleEntry(e: ConsoleEntry): string {
  const src = e.source !== '' ? `  (${e.source})` : '';
  return `[${clock(e.t)}] ${e.level.padEnd(5)} ${e.text}${src}`;
}

/** The capture buffer + the exporter, bound to one window's renderer. */
export interface ConsoleExporter {
  /** Read the current game name from the renderer + write the dump. Resolves with the outcome. */
  export(): Promise<{ok: boolean, path?: string, error?: string}>;
}

/** Where to write the export — mirror the wrapper's log location, with sane fallbacks. */
function resolveExportDir(app: App): string {
  const dir = (process.env.TM_LOG_DIR ?? '').trim();
  if (dir !== '') {
    return dir;
  }
  const logFile = (process.env.TM_LOG_FILE ?? '').trim();
  if (logFile !== '') {
    return path.dirname(logFile);
  }
  const appImage = (process.env.APPIMAGE ?? '').trim();
  if (appImage !== '') {
    return path.dirname(appImage); // the wrapper keeps the .log beside the AppImage
  }
  try {
    return app.getPath('logs');
  } catch {
    return app.getPath('userData');
  }
}

// Reads the current game name from the RENDERER (best-effort, side-effect-free): the Options-API
// root instance holds `playerView`; fall back to the URL's participant id, then a constant.
const GAME_NAME_PROBE = `(() => {
  try {
    const root = document.querySelector('#app');
    const inst = root && root.__vue_app__ && root.__vue_app__._instance;
    const pv = inst && inst.proxy && inst.proxy.playerView;
    const n = pv && pv.game && pv.game.name;
    if (typeof n === 'string' && n.trim() !== '') return n.trim();
  } catch (e) { /* internals moved — fall through */ }
  try {
    const id = new URLSearchParams(location.search).get('id');
    if (id) return 'game-' + id.slice(0, 8);
  } catch (e) { /* no location */ }
  return 'game';
})()`;

/**
 * Buffer the renderer console and return an exporter. Call once after the BrowserWindow is
 * created. Captures from app start (independent of DevTools being open); a main-frame navigation
 * (the game-boundary reload) inserts a marker line but keeps prior history (bounded by MAX_ENTRIES).
 */
export function installConsoleCapture(app: App, win: BrowserWindow): ConsoleExporter {
  const buffer: ConsoleEntry[] = [];
  const push = (level: string, text: string, source: string): void => {
    buffer.push({t: Date.now(), level, text, source});
    if (buffer.length > MAX_ENTRIES) {
      buffer.splice(0, buffer.length - MAX_ENTRIES);
    }
  };

  // Dual-signature tolerant: modern Electron passes a ConsoleMessageEvent object; the legacy
  // form is (event, level, message, line, sourceId).
  win.webContents.on('console-message', (...args: unknown[]) => {
    const first = args[0] as Record<string, unknown> | undefined;
    if (first !== undefined && typeof first === 'object' && typeof first.message === 'string') {
      const line = Number(first.lineNumber ?? 0);
      const sourceId = String(first.sourceId ?? '');
      push(normalizeConsoleLevel(first.level), first.message, sourceId !== '' && line > 0 ? `${sourceId}:${line}` : sourceId);
    } else {
      const line = Number(args[3] ?? 0);
      const sourceId = String(args[4] ?? '');
      push(normalizeConsoleLevel(args[1]), String(args[2] ?? ''), sourceId !== '' && line > 0 ? `${sourceId}:${line}` : sourceId);
    }
  });

  win.webContents.on('did-navigate', (_e, url) => {
    push('INFO', `──────── page loaded: ${url} ────────`, '');
  });

  const dump = (gameName: string, when: Date): string => {
    const header = [
      `Terraforming Mars — console export`,
      `game: ${gameName}`,
      `time: ${when.toISOString()} (local ${formatStamp(when)})`,
      `url:  ${win.webContents.getURL()}`,
      `lines: ${buffer.length}`,
      '─'.repeat(60),
      '',
    ].join('\n');
    return header + buffer.map(formatConsoleEntry).join('\n') + '\n';
  };

  return {
    async export() {
      try {
        const gameName = String(await win.webContents.executeJavaScript(GAME_NAME_PROBE));
        const when = new Date();
        const dir = resolveExportDir(app);
        const file = path.join(dir, buildExportFilename(gameName, when));
        await fs.promises.mkdir(dir, {recursive: true});
        await fs.promises.writeFile(file, dump(gameName, when), 'utf8');
        // eslint-disable-next-line no-console
        console.log(`[console-export] wrote ${buffer.length} lines → ${file}`);
        return {ok: true, path: file};
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console
        console.error('[console-export] failed —', error);
        return {ok: false, error};
      }
    },
  };
}
