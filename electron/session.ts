// Tiny persistent desktop session store (Electron main) — Phase 8.
//
// Persists the last-known-good compatibility snapshot to userData so the update policy
// (electron/updatePolicy.ts) can decide correctly when the server is unreachable. Best
// effort: any read/write failure degrades to "no cache" (→ fail-open), never throws.

import {app} from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {CompatSnapshot} from './updatePolicy';

interface DesktopSession {
  lastKnownGood?: CompatSnapshot & {at: number};
  // The app version that last populated Chromium's immutable asset cache. Used by
  // electron/cacheVersion.ts to wipe stale art when the version changes.
  cacheVersion?: string;
  // True once the user chose "Not now" on the first-run "Add to Steam" prompt — so we never
  // ask again (Windows only; the in-menu button stays available).
  steamPromptDismissed?: boolean;
  // Host-as-server mode (docs/EMBEDDED_SERVER.md §3). 'host' runs the embedded
  // game server locally (default); 'remote' is the thin-client fallback
  // (TM_SERVER_BASE / Heroku). Applied at launch; the settings row writes it.
  appMode?: 'host' | 'remote';
  // LAN visibility of the embedded server (bind 0.0.0.0 + mDNS advertise).
  // Default true in host mode; applied at launch.
  lanVisible?: boolean;
  // Friendly host name advertised over mDNS (player profile name). Live-renames.
  lanName?: string;
}

function sessionFile(): string {
  return path.join(app.getPath('userData'), 'tm-desktop-session.json');
}

function readSession(): DesktopSession {
  try {
    return JSON.parse(fs.readFileSync(sessionFile(), 'utf8')) as DesktopSession;
  } catch {
    return {};
  }
}

function writeSession(session: DesktopSession): void {
  try {
    fs.mkdirSync(path.dirname(sessionFile()), {recursive: true});
    fs.writeFileSync(sessionFile(), JSON.stringify(session));
  } catch {
    // best effort — a persistence failure must not break startup
  }
}

export function getLastKnownGood(): CompatSnapshot | undefined {
  const lkg = readSession().lastKnownGood;
  if (lkg === undefined) {
    return undefined;
  }
  return {
    latestVersion: lkg.latestVersion,
    minSupportedVersion: lkg.minSupportedVersion,
    updateRequired: lkg.updateRequired,
    releaseNotes: lkg.releaseNotes,
    downloadUrl: lkg.downloadUrl,
  };
}

export function setLastKnownGood(compat: CompatSnapshot, now: number): void {
  const session = readSession();
  session.lastKnownGood = {...compat, at: now};
  writeSession(session);
}

export function getCacheVersion(): string | undefined {
  return readSession().cacheVersion;
}

export function setCacheVersion(version: string): void {
  const session = readSession();
  session.cacheVersion = version;
  writeSession(session);
}

export function getSteamPromptDismissed(): boolean {
  return readSession().steamPromptDismissed === true;
}

export function setSteamPromptDismissed(dismissed: boolean): void {
  const session = readSession();
  session.steamPromptDismissed = dismissed;
  writeSession(session);
}

export function getAppMode(): 'host' | 'remote' | undefined {
  const mode = readSession().appMode;
  return mode === 'host' || mode === 'remote' ? mode : undefined;
}

export function setAppMode(mode: 'host' | 'remote'): void {
  const session = readSession();
  session.appMode = mode;
  writeSession(session);
}

export function getLanVisible(): boolean {
  return readSession().lanVisible !== false;
}

export function setLanVisible(visible: boolean): void {
  const session = readSession();
  session.lanVisible = visible;
  writeSession(session);
}

export function getLanName(): string {
  return readSession().lanName ?? '';
}

export function setLanName(name: string): void {
  const session = readSession();
  session.lanName = name;
  writeSession(session);
}
