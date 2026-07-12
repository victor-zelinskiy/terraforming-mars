// Build-scoped asset cache (Electron main).
//
// The app:// protocol serves stable art/fonts with an `immutable` Cache-Control in a
// PACKAGED build (electron/protocol.ts) — Chromium then never revalidates them, so an
// updated sprite whose URL is unchanged (e.g. assets/ma/blacksmith.png) keeps serving
// the OLD bytes across launches AND across reinstalls (the HTTP cache lives in userData,
// which survives an uninstall). That fast immutable cache is the intended behaviour
// WITHIN one build — but it means a rebuilt asset is invisible until the cache is cleared.
//
// This module makes the immutable cache BUILD-SCOPED: on startup we compare the build
// identity that last populated the cache (persisted in the desktop session file) with the
// CURRENT build identity, and if it changed we wipe Chromium's HTTP + code caches ONCE, so
// a new build's fresh art loads while same-build launches keep the fast cache.
//
// The build identity is `version|head|builtAt` read from src/genfiles/settings.json (the
// same file whose `head`/`version` the main-menu footer shows). `head` is the git short
// hash and `builtAt` a per-build timestamp, so the key changes on EVERY new build even
// when package.json `version` is unchanged — which is exactly the workflow: replace an
// asset, rebuild, ship, and the cache busts itself on first launch. NO manual version bump
// or userData-cache wipe needed.
//
// Best effort: any failure degrades to "did not clear" and never throws — a cache wipe is
// an optimization, not a correctness requirement. On a wipe failure we intentionally leave
// the stored key unchanged so the next launch retries.

import {app, session} from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {getCacheVersion, setCacheVersion} from './session';

// build/electron/cacheVersion.js → repo root (dev) / asar root (packaged), matching
// protocol.ts. settings.json is shipped explicitly via electron-builder `files`.
const SETTINGS_FILE = path.resolve(__dirname, '..', '..', 'src', 'genfiles', 'settings.json');

interface BuildSettings {
  head?: string;
  version?: string;
  builtAt?: string;
}

/** Compose the build-identity cache key from settings.json fields (pure). */
export function buildCacheKey(settings: BuildSettings | undefined): string {
  if (settings === undefined) {
    return '';
  }
  const parts = [settings.version ?? '', settings.head ?? '', settings.builtAt ?? ''];
  return parts.join('|');
}

/** True when the persisted build key differs from the current one. */
export function cacheVersionChanged(stored: string | undefined, current: string): boolean {
  return stored !== current;
}

function readBuildSettings(): BuildSettings | undefined {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) as BuildSettings;
  } catch {
    return undefined;
  }
}

/** The current build's cache key, falling back to the app version if settings are missing. */
export function currentCacheKey(): string {
  const key = buildCacheKey(readBuildSettings());
  // Empty (settings unreadable) or all-blank ('||') → scope by the package version so we
  // still key on SOMETHING rather than never/always clearing.
  return key.replace(/\|/g, '') !== '' ? key : app.getVersion();
}

/**
 * If the build identity changed since the cache was last populated, clear Chromium's HTTP +
 * code caches (so freshly-built assets load) and record the new identity. No-op within one
 * build — the immutable cache keeps working. MUST run after app 'ready' and BEFORE the
 * window loads its first URL. Returns whether the cache was actually cleared.
 */
export async function enforceVersionScopedCache(): Promise<boolean> {
  const current = currentCacheKey();
  let stored: string | undefined;
  try {
    stored = getCacheVersion();
  } catch {
    stored = undefined;
  }
  if (!cacheVersionChanged(stored, current)) {
    return false;
  }
  try {
    await session.defaultSession.clearCache();
    // Empty `urls` clears every entry in the code-cache directory (stale V8 bytecode for
    // the previous bundle). Chromium auto-invalidates it on byte changes anyway, but a
    // new build is exactly when we want a clean slate.
    await session.defaultSession.clearCodeCaches({urls: []});
  } catch {
    // Leave the stored key unchanged so the next launch retries the wipe.
    return false;
  }
  try {
    setCacheVersion(current);
  } catch {
    // Stamp write failed → next launch wipes again (harmless, just loses the perf win).
  }
  return true;
}
