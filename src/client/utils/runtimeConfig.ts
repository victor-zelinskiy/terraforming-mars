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
 *
 * Host-as-server (docs/EMBEDDED_SERVER.md §6): a game joined on ANOTHER server
 * (a LAN host) is PINNED per participant id (`serverEndpoints.ts`); the pin
 * outranks the injected default, scoping the redirect to that one game session.
 */
import {ServerEndpoint, pinnedServerEndpoint} from './serverEndpoints';

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

/**
 * The participant id this page is scoped to (injected id, else the URL `?id=`).
 * Used to look up a PINNED per-game server endpoint (a LAN-joined game lives on
 * the host's server while the app default stays the local/remote one).
 */
function currentParticipantId(): string | undefined {
  const injected = config().participantId;
  if (injected !== undefined && injected !== '') {
    return injected;
  }
  try {
    const id = new URLSearchParams(window.location.search).get('id');
    return id === null || id === '' ? undefined : id;
  } catch {
    return undefined;
  }
}

/** The pinned endpoint for the current participant, if this game is pinned to another server. */
function pinnedEndpoint(): ServerEndpoint | undefined {
  const pid = currentParticipantId();
  return pid === undefined ? undefined : pinnedServerEndpoint(pid);
}

/**
 * The endpoint THIS page's API calls are pinned to, if any (LAN host-as-server:
 * a campaign map opened from a LAN row, a mission joined on another couch).
 * `undefined` = the app's own default server. What a navigation that must stay
 * on the SAME server propagates: a campaign map entering its mission pins the
 * mission's participant id to this endpoint before navigating.
 */
export function currentServerEndpoint(): ServerEndpoint | undefined {
  return pinnedEndpoint();
}

/** Base for HTTP API URLs. '' (relative, same origin) unless a host overrides. */
export function apiBaseUrl(): string {
  const pinned = pinnedEndpoint();
  if (pinned !== undefined) {
    return pinned.apiBase;
  }
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

/**
 * Whether the API endpoint the app talks to lives on THIS machine (loopback):
 * the Electron host mode (embedded server at 127.0.0.1) or a browser opened
 * against localhost. Gates the local-only tools (game rollback): «my machine's
 * games» is a property of the CONNECTION, mirroring the server's isLoopbackIp
 * gate — a LAN guest's browser (a remote hostname) answers false.
 */
export function apiEndpointIsLocal(): boolean {
  const base = apiBaseUrl();
  try {
    const hostname = base === '' ? window.location.hostname : new URL(base).hostname;
    const bare = hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return bare === 'localhost' || bare === '::1' || bare.startsWith('127.');
  } catch {
    return false;
  }
}

/** ws(s):// origin (no trailing slash). Pinned per game → override → derived from location. */
export function wsBaseUrl(): string {
  const pinned = pinnedEndpoint();
  if (pinned !== undefined) {
    return pinned.wsBase;
  }
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
