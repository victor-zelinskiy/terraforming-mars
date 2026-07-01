/**
 * Runtime configuration seam (Electron-readiness).
 *
 * The browser client resolves the API base, the WebSocket base, and the
 * participant identity from `window.location` today. A future Electron renderer
 * has no URL bar / same-origin server, so it must be able to point the client at
 * an explicit host and inject the identity. This module is the single place all
 * of that is resolved, so the rest of the client never hard-codes `window.location`
 * for transport.
 *
 * Defaults reproduce today's browser behaviour EXACTLY (relative origin +
 * `window.location`), so wiring a call site through here is a no-op change in the
 * browser. An Electron host (or any embedder) sets `window.tmRuntimeConfig`
 * (e.g. from a preload script) to override.
 */

export interface TMRuntimeConfig {
  /** API origin, e.g. 'https://tm.example.com'. Default '' = same origin (relative). */
  apiBase?: string;
  /** WebSocket origin, e.g. 'wss://tm.example.com'. Default: derived from location. */
  wsBase?: string;
  /** The private `?id=` token, injected when there is no URL bar (Electron). */
  participantId?: string;
}

declare global {
  interface Window {
    tmRuntimeConfig?: TMRuntimeConfig;
  }
}

function config(): TMRuntimeConfig {
  try {
    return window.tmRuntimeConfig ?? {};
  } catch {
    return {};
  }
}

/** Base for HTTP API URLs. '' (relative, same origin) unless a host overrides. */
export function apiBaseUrl(): string {
  return config().apiBase ?? '';
}

/**
 * Build an API URL from a path constant (e.g. `paths.API_PLAYER`, no leading
 * slash). With the default empty base the path is returned UNCHANGED (a relative
 * URL — today's behaviour); with a configured base the two are joined by exactly
 * one slash.
 */
export function apiUrl(path: string): string {
  const base = apiBaseUrl();
  if (base === '') {
    return path;
  }
  return base.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
}

/** ws(s):// origin (no trailing slash). Overridable; else derived from location. */
export function wsBaseUrl(): string {
  const override = config().wsBase;
  if (override !== undefined && override !== '') {
    return override;
  }
  const loc = window.location;
  const scheme = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${loc.host}`;
}

/**
 * The `?id=<token>` query string used to authenticate API calls. In the browser
 * this is the current URL's search (identity lives in the URL); an Electron host
 * injects `participantId` instead (no URL bar).
 */
export function identitySearch(): string {
  const injected = config().participantId;
  if (injected !== undefined && injected !== '') {
    return '?id=' + encodeURIComponent(injected);
  }
  try {
    return window.location.search;
  } catch {
    return '';
  }
}
