import {paths} from '@/common/app/paths';
import {wsBaseUrl} from '@/client/utils/runtimeConfig';

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
 * **Default ON** (Phase 12 — WebSocket is the primary realtime mechanism); this
 * cascades to `realtimeRefreshEnabled` + `realtimePollReductionEnabled`.
 * Resolution order (first decisive wins):
 *   1. URL override `?realtime=1` / `?realtime=0` (the kill-switch)
 *   2. localStorage `realtime_transport` = '1' / '0'
 *   3. default: ON
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
  return true;
}

/**
 * Whether a WS invalidation should WAKE the existing refresh path (Phase 4).
 * Separate from the transport flag so the refresh wiring can be turned off
 * independently (falling back to observe-only + polling) if it ever misbehaves.
 * Resolution order:
 *   1. URL override `?realtimeRefresh=1` / `?realtimeRefresh=0`
 *   2. localStorage `realtime_refresh` = '1' / '0'
 *   3. default: ON whenever the transport is enabled.
 */
export function realtimeRefreshEnabled(): boolean {
  const param = readParam('realtimeRefresh');
  if (param === '1' || param === 'true') {
    return true;
  }
  if (param === '0' || param === 'false') {
    return false;
  }
  const stored = readStorage('realtime_refresh');
  if (stored === '1' || stored === 'true') {
    return true;
  }
  if (stored === '0' || stored === 'false') {
    return false;
  }
  return realtimeClientEnabled();
}

/**
 * Whether the primary poll interval may be STRETCHED while WS is healthy
 * (Phase 6). Requires the refresh wiring (a long poll without WS-driven refresh
 * would go stale). `?realtimePoll=0` / localStorage `realtime_poll=0` is the
 * emergency override that forces the safe interval even when everything else is
 * on. Default: on whenever the refresh wiring is on.
 */
export function realtimePollReductionEnabled(): boolean {
  const param = readParam('realtimePoll');
  if (param === '0' || param === 'false') {
    return false;
  }
  const stored = readStorage('realtime_poll');
  if (stored === '0' || stored === 'false') {
    return false;
  }
  return realtimeRefreshEnabled();
}

/** Build the ws(s):// URL from the runtime WS base (origin in the browser). */
export function realtimeWsUrl(): string {
  return `${wsBaseUrl()}/${paths.WEBSOCKET}`;
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
