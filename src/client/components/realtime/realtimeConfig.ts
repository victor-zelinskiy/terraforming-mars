import {paths} from '@/common/app/paths';

/**
 * Client-side realtime configuration.
 *
 * Kept as a small, centralized module so the transport never reads
 * `window.location` from scattered places and a future Electron client can
 * swap the base URL / enable flag without touching the service or the UI.
 *
 * Default is OFF: an unconfigured browser (and all of production until we flip
 * a flag) opens NO WebSocket and behaves exactly as before.
 */

function readParam(name: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/**
 * Whether the client should attempt a realtime connection at all.
 * Resolution order (first decisive wins):
 *   1. URL override `?realtime=1` / `?realtime=0`
 *   2. localStorage `realtime_transport` = '1' / '0'
 *   3. default: OFF
 */
export function realtimeClientEnabled(): boolean {
  const param = readParam('realtime');
  if (param === '1' || param === 'true') {
    return true;
  }
  if (param === '0' || param === 'false') {
    return false;
  }
  const stored = readStorage('realtime_transport');
  if (stored === '1' || stored === 'true') {
    return true;
  }
  if (stored === '0' || stored === 'false') {
    return false;
  }
  return false;
}

/** Build the ws(s):// URL from the current origin (or a future Electron base). */
export function realtimeWsUrl(): string {
  const loc = window.location;
  const scheme = loc.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${loc.host}/${paths.WEBSOCKET}`;
}

/** Verbose realtime logging: on in dev builds, or when explicitly opted in. */
export function isRealtimeDebug(): boolean {
  if (readParam('realtime') !== null) {
    return true;
  }
  if (readStorage('realtime_debug') === '1') {
    return true;
  }
  return process.env.NODE_ENV !== 'production';
}
