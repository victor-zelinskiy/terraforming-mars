// Electron 43 — Phase 2A custom `app://` protocol handler.
//
// Serves the PACKAGED static renderer from a single logical origin
// (`app://bundle/`), mirroring the server's ServeAsset.toFile mapping so the
// existing bundle loads unchanged:
//   - JS (main/vendors/sw/chunks + maps) → build-desktop/  (webpack desktop
//     output, built with publicPath 'app://bundle/'; kept SEPARATE from the web
//     build/ so a desktop build never clobbers the browser bundle);
//   - styles.css → build/  (make:css output — identical for web + desktop);
//   - everything else (index.html, fonts, card/tile art, locales, favicon)
//     → assets/;
//   - any extensionless path (an SPA route like /player) → assets/index.html,
//     so client-side routing + relative navigation keep working.
//
// Registered as a STANDARD + SECURE scheme so: relative asset URLs and the
// locale `fetch('assets/locales/…')` resolve, window.location keeps a real
// path/query (applyRoute + identitySearch reuse unchanged), and it is a secure
// context. NO Node is exposed — this is main-process file reading only, guarded
// against path traversal.
//
// Scope note: this is asset loading ONLY. Cross-origin REST/WS + CORS is Phase 2B.

import {protocol} from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const APP_SCHEME = 'app';

/** app://bundle — the single logical origin of the packaged renderer. */
export const APP_ORIGIN = 'app://bundle';

/** Build an app:// URL for a route path (e.g. '' or 'player?id=x'). */
export function appUrl(routePath: string): string {
  return `${APP_ORIGIN}/${routePath.replace(/^\/+/, '')}`;
}

// build/electron → repo root (dev). In a packaged app (Phase 6) this resolves
// to the unpacked resources root; build-desktop/, build/ and assets/ ship there.
const ROOT = path.resolve(__dirname, '..', '..');
const JS_DIR = path.join(ROOT, 'build-desktop'); // webpack desktop output
const BUILD_DIR = path.join(ROOT, 'build'); // make:css styles.css
const ASSETS_DIR = path.join(ROOT, 'assets'); // index.html, fonts, art, locales
const INDEX_HTML = path.join(ASSETS_DIR, 'index.html');

const JS_FILES = new Set<string>([
  'main.js', 'main.js.map',
  'vendors.js', 'vendors.js.map',
  'sw.js', 'sw.js.map',
]);

const ASSET_EXT = /\.(ttf|png|jpe?g|gif|svg|webp|json|ico)$/i;

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ttf': 'font/ttf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

export function contentType(file: string): string {
  return CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}

// Stable, expensive-to-decode assets (art + fonts) — worth caching across the
// frequent in-app game-boundary reloads so Chromium keeps them in its memory
// cache (decoded textures included) instead of re-reading + re-decoding from
// disk each time. HTML / CSS / JS / JSON change per build, so they are NEVER
// cached here (a stale shell would be a correctness bug).
const CACHEABLE_EXT = /\.(ttf|woff2?|png|jpe?g|gif|svg|webp|ico)$/i;

/**
 * `Cache-Control` for a served file, or undefined (no header) for non-cacheable
 * types. `immutable` (packaged builds) promises the bytes never change for this
 * app version → Chromium can skip revalidation entirely; dev uses a modest TTL
 * so edited art still refreshes within the hour / on a hard reload.
 */
export function cacheControl(file: string, immutable: boolean): string | undefined {
  if (!CACHEABLE_EXT.test(file)) {
    return undefined;
  }
  return immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600';
}

/** Join `sub` under `base`, refusing anything that escapes `base` (traversal guard). */
function safeJoin(base: string, sub: string): string | undefined {
  const resolved = path.resolve(base, sub);
  const withSep = base.endsWith(path.sep) ? base : base + path.sep;
  return (resolved === base || resolved.startsWith(withSep)) ? resolved : undefined;
}

/**
 * Map an `app://bundle/<pathname>` to a file on disk (mirrors ServeAsset.toFile).
 * Returns `undefined` only for a path that escapes its root (→ 403).
 * Exported for unit testing (pure: uses `path` only, no `electron`/`fs`).
 */
export function resolveFile(pathname: string): string | undefined {
  let clean: string;
  try {
    clean = decodeURIComponent(pathname);
  } catch {
    return undefined;
  }
  clean = clean.replace(/^\/+/, '');

  if (clean === '') {
    return INDEX_HTML;
  }
  if (clean === 'styles.css' || clean === 'styles.css.map') {
    return path.join(BUILD_DIR, clean);
  }
  if (JS_FILES.has(clean)) {
    return path.join(JS_DIR, clean);
  }
  if (clean.startsWith('chunks/')) {
    return safeJoin(JS_DIR, clean);
  }
  if (clean === 'favicon.ico') {
    return path.join(ASSETS_DIR, 'favicon.ico');
  }
  if (clean.startsWith('assets/')) {
    return safeJoin(ASSETS_DIR, clean.slice('assets/'.length));
  }
  if (ASSET_EXT.test(clean)) {
    return safeJoin(ASSETS_DIR, clean);
  }
  // No matching asset → treat as an SPA route and serve the shell.
  return INDEX_HTML;
}

/** Register the `app://` scheme as privileged. MUST run BEFORE app 'ready'. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([{
    scheme: APP_SCHEME,
    privileges: {standard: true, secure: true, supportFetchAPI: true, stream: true},
  }]);
}

/**
 * Install the `app://` request handler. MUST run AFTER app 'ready'.
 * `immutable` (packaged builds) makes stable art/fonts cache immutably; dev
 * passes false for a modest TTL. Defaults true so the packaged behaviour is the
 * safe default when the caller omits it.
 */
export function registerAppProtocolHandler(immutable = true): void {
  protocol.handle(APP_SCHEME, async (request) => {
    let pathname = '/';
    try {
      pathname = new URL(request.url).pathname;
    } catch {
      return new Response('Bad request', {status: 400});
    }
    const file = resolveFile(pathname);
    if (file === undefined) {
      return new Response('Forbidden', {status: 403});
    }
    try {
      const data = await fs.promises.readFile(file);
      const headers: Record<string, string> = {'content-type': contentType(file)};
      const cache = cacheControl(file, immutable);
      if (cache !== undefined) {
        headers['cache-control'] = cache;
      }
      return new Response(new Uint8Array(data), {status: 200, headers});
    } catch {
      return new Response('Not found', {status: 404, headers: {'content-type': 'text/plain; charset=utf-8'}});
    }
  });
}
