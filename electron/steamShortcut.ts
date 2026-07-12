// Electron — Windows "Add to Steam" (Non-Steam Game shortcut + artwork). Windows only.
//
// Ports steps 3-4 of scripts/steamdeck/install-steamdeck.sh to Windows: register a
// Non-Steam shortcut in Steam's shortcuts.vdf with a DETERMINISTIC appid and drop the
// bundled artwork into userdata/<id>/config/grid/ (the only reliable way to attach custom
// art to a non-Steam game). Steps 1-2 (download the AppImage, write the restart-loop
// wrapper) are Linux-only and have no Windows analogue — the NSIS installer already placed
// the .exe and electron-updater self-restarts, so no wrapper is needed.
//
// Invoked HEADLESSLY by the NSIS finish-page checkbox: `TerraformingMars.exe --add-to-steam`
// (main.ts detects the flag, runs addToSteam(), and exits without opening a window).
//
// Steam rewrites shortcuts.vdf on exit, so — like the Deck installer — we gracefully shut
// Steam down before writing and relaunch it after. Every shortcuts.vdf is backed up first.
// Best-effort throughout: any failure returns a reason and never throws to the caller.

import {app} from 'electron';
import {execFileSync, spawn} from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {
  appId32,
  findOrNextKey,
  gridId64,
  newShortcutEntry,
  parseShortcuts,
  serializeShortcuts,
  VdfMap,
} from './steamVdf';

const APP_NAME = 'Terraforming Mars';

export interface AddToSteamResult {
  ok: boolean;
  /** Why nothing was written — surfaced in the log; the finish-page run stays silent. */
  reason?: 'not-windows' | 'steam-not-found' | 'no-user-profile' | 'no-profile-written';
  /** How many Steam user profiles received the shortcut. */
  profiles?: number;
  /** The deterministic shortcut appid (for logs / diagnostics). */
  appId?: number;
}

/** The four bundled Steam art files (shared with the Steam Deck installer). */
const ART_FILES = {
  capsule: 'steam-deck-capsule-1024-1536.png',
  hero: 'steam-deck-hero-2172-724.png',
  header: 'steam-deck-header-920-430.png',
  logo: 'steam-deck-logo-2048-682.png',
} as const;

function log(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(`[steam] ${msg}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Read Steam's install path from the registry (authoritative), else the common defaults. */
export function findSteamPath(): string | undefined {
  const candidates: Array<string> = [];
  const fromRegistry = readSteamPathFromRegistry();
  if (fromRegistry !== undefined) {
    candidates.push(fromRegistry);
  }
  candidates.push('C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam');
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'steam.exe')) ||
        fs.existsSync(path.join(candidate, 'userdata'))) {
      return candidate;
    }
  }
  return undefined;
}

function readSteamPathFromRegistry(): string | undefined {
  try {
    const out = execFileSync(
      'reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'],
      {encoding: 'utf8', windowsHide: true, timeout: 5000},
    );
    // "    SteamPath    REG_SZ    C:/Program Files (x86)/Steam"
    const m = out.match(/SteamPath\s+REG_SZ\s+(.+)/i);
    if (m !== null) {
      // Steam stores the path with forward slashes; normalize for Windows fs.
      return m[1].trim().replace(/\//g, '\\');
    }
  } catch {
    // Steam not installed / reg unavailable — fall back to the default paths.
  }
  return undefined;
}

/** The `userdata/<accountId>/` directories (each is one logged-in Steam account). */
function steamUserDirs(steamPath: string): Array<string> {
  const base = path.join(steamPath, 'userdata');
  if (!fs.existsSync(base)) {
    return [];
  }
  try {
    return fs.readdirSync(base)
      .filter((name) => /^\d+$/.test(name) && name !== '0')
      .map((name) => path.join(base, name))
      .filter((dir) => {
        try {
          return fs.statSync(dir).isDirectory();
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }
}

/** Where the bundled art lives — inside the asar (packaged) or the repo (dev). */
function artDir(): string {
  return path.join(app.getAppPath(), 'assets', 'steamdeck');
}

function readArt(fileName: string): Buffer | undefined {
  try {
    // read+write (not copyFileSync) so it works transparently from inside the asar.
    return fs.readFileSync(path.join(artDir(), fileName));
  } catch {
    return undefined;
  }
}

/**
 * Write every art variant Steam looks for into `grid/`, for both the 32- and 64-bit ids and
 * both the quoted- and unquoted-Exe appid variants (mirrors the Deck installer). Returns the
 * path of a written header image, used as the shortcut's small `icon`.
 */
function writeGridArt(gridDir: string, artIds: ReadonlySet<number>): string {
  fs.mkdirSync(gridDir, {recursive: true});
  const capsule = readArt(ART_FILES.capsule);
  const hero = readArt(ART_FILES.hero);
  const header = readArt(ART_FILES.header);
  const logo = readArt(ART_FILES.logo);
  let headerDest = '';
  const put = (buf: Buffer | undefined, ...names: Array<string>): void => {
    if (buf === undefined) {
      return;
    }
    for (const name of names) {
      const dest = path.join(gridDir, name);
      fs.writeFileSync(dest, buf);
      if (headerDest === '' && name.endsWith('.jpg')) {
        headerDest = dest;
      }
    }
  };
  for (const aid of artIds) {
    const aid64 = gridId64(aid).toString();
    put(capsule, `${aid}p.png`, `${aid64}p.png`);       // portrait / library capsule
    put(hero, `${aid}_hero.png`, `${aid64}_hero.png`);  // hero banner
    put(header, `${aid}.jpg`, `${aid64}.jpg`);          // header / grid capsule
    put(logo, `${aid}_logo.png`, `${aid64}_logo.png`);  // transparent title logo
  }
  return headerDest;
}

function isSteamRunning(): boolean {
  try {
    const out = execFileSync(
      'tasklist', ['/FI', 'IMAGENAME eq steam.exe', '/NH'],
      {encoding: 'utf8', windowsHide: true, timeout: 5000},
    );
    return /steam\.exe/i.test(out);
  } catch {
    return false;
  }
}

/** Ask Steam to close (`steam.exe -shutdown`) and wait — bounded — for it to actually exit. */
async function shutdownSteam(steamPath: string): Promise<void> {
  try {
    execFileSync(path.join(steamPath, 'steam.exe'), ['-shutdown'],
      {windowsHide: true, timeout: 10000});
  } catch {
    // -shutdown returns quickly; ignore its exit code and poll instead.
  }
  for (let i = 0; i < 20; i++) {
    if (!isSteamRunning()) {
      return;
    }
    await sleep(1000);
  }
  log('Steam did not close in time — writing anyway (art may need a Steam restart to appear)');
}

function relaunchSteam(steamPath: string): void {
  try {
    const child = spawn(path.join(steamPath, 'steam.exe'), [], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
  } catch {
    // best-effort — the user can reopen Steam themselves.
  }
}

/** Write (or replace) our shortcut + art into one Steam user profile. */
function writeProfile(userDir: string, opts: {
  exeQuoted: string;
  startDirQuoted: string;
  exePath: string;
  appId: number;
  artIds: ReadonlySet<number>;
}): boolean {
  try {
    const cfg = path.join(userDir, 'config');
    fs.mkdirSync(cfg, {recursive: true});
    const scPath = path.join(cfg, 'shortcuts.vdf');
    if (fs.existsSync(scPath)) {
      try {
        fs.copyFileSync(scPath, `${scPath}.bak.${Date.now()}`);
      } catch {
        // a failed backup must not block the write.
      }
    }
    const headerDest = writeGridArt(path.join(cfg, 'grid'), opts.artIds);
    const icon = headerDest !== '' ? headerDest : opts.exePath;

    const root: VdfMap = fs.existsSync(scPath) && fs.statSync(scPath).size > 0
      ? parseShortcuts(fs.readFileSync(scPath))
      : {shortcuts: {}};
    const shortcuts = root.shortcuts as VdfMap;
    const key = findOrNextKey(shortcuts, opts.exeQuoted, opts.appId);
    shortcuts[key] = newShortcutEntry({
      appId: opts.appId,
      appName: APP_NAME,
      exeQuoted: opts.exeQuoted,
      startDirQuoted: opts.startDirQuoted,
      icon,
    });
    fs.writeFileSync(scPath, serializeShortcuts(root));
    return true;
  } catch (err) {
    log(`profile ${userDir} failed — ${String((err as {message?: string})?.message ?? err)}`);
    return false;
  }
}

/**
 * Add "Terraforming Mars" to Steam as a Non-Steam Game with artwork, across every logged-in
 * Steam profile on this machine. Idempotent (re-running replaces the existing entry). Never
 * throws; returns a result the caller logs.
 */
export async function addToSteam(): Promise<AddToSteamResult> {
  if (process.platform !== 'win32') {
    return {ok: false, reason: 'not-windows'};
  }
  const steamPath = findSteamPath();
  if (steamPath === undefined) {
    log('Steam is not installed — skipping (nothing was changed).');
    return {ok: false, reason: 'steam-not-found'};
  }
  const users = steamUserDirs(steamPath);
  if (users.length === 0) {
    log('no Steam user profile found — open Steam once, then re-run.');
    return {ok: false, reason: 'no-user-profile'};
  }

  const exePath = app.getPath('exe');
  const startDir = path.dirname(exePath);
  const exeQuoted = `"${exePath}"`;
  const startDirQuoted = `"${startDir}"`;
  const appId = appId32(exeQuoted + APP_NAME);
  // Also drop art for the unquoted-Exe appid variant (some tools compute it unquoted).
  const artIds = new Set<number>([appId, appId32(exePath + APP_NAME)]);

  const wasRunning = isSteamRunning();
  if (wasRunning) {
    log('Steam is running — shutting it down so the shortcut is saved safely…');
    await shutdownSteam(steamPath);
  }

  let profiles = 0;
  for (const userDir of users) {
    if (writeProfile(userDir, {exeQuoted, startDirQuoted, exePath, appId, artIds})) {
      profiles += 1;
    }
  }

  if (wasRunning) {
    relaunchSteam(steamPath);
  }

  if (profiles === 0) {
    return {ok: false, reason: 'no-profile-written', appId};
  }
  log(`shortcut + artwork written for ${profiles} profile(s) (appid=${appId}).`);
  return {ok: true, profiles, appId};
}
