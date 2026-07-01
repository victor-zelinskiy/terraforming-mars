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
