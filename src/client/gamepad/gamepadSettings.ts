/*
 * Gamepad subsystem config (GAMEPAD_SUPPORT_DESIGN.md §4.4). Mirrors the
 * motion-system flag ladder: URL param wins, then localStorage / preference,
 * then the default. Pure & DOM-optional (safe under JSDOM/tests).
 *
 *   enable   : `?gp=0|1`        / Preferences `gamepad_enabled` (default ON)
 *   deadzone : `?gpDeadzone=…`  / localStorage `tm_gp_deadzone` (default 0.28)
 *   debug    : `?gpDebug`       (session-only overlay, never persisted)
 *
 * `?gp=0` is the subsystem-wide KILL SWITCH — every phase's rollback story:
 * with it (or the preference off) the core never installs listeners, never
 * polls, never mounts visuals; mouse/keyboard players are byte-identical.
 */

import {getPreferences} from '@/client/utils/PreferencesManager';
import {DEFAULT_DEADZONE} from '@/client/gamepad/gamepadPollModel';

const DEADZONE_STORAGE_KEY = 'tm_gp_deadzone';
const DEADZONE_MIN = 0.05;
const DEADZONE_MAX = 0.6;

function storage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch (err) {
    return undefined;
  }
}

function searchString(): string {
  return typeof window !== 'undefined' ? window.location.search : '';
}

/** Is the gamepad subsystem enabled at all? (`?gp=0` kill switch → pref). */
export function gamepadEnabled(): boolean {
  const fromUrl = /[?&]gp=([01])/.exec(searchString())?.[1];
  if (fromUrl !== undefined) {
    return fromUrl === '1';
  }
  return getPreferences().gamepad_enabled;
}

/** The left-stick radial deadzone (URL → localStorage → model default). */
export function gamepadDeadzone(): number {
  const clamp = (v: number) => Math.min(DEADZONE_MAX, Math.max(DEADZONE_MIN, v));
  const fromUrl = /[?&]gpDeadzone=([0-9.]+)/.exec(searchString())?.[1];
  if (fromUrl !== undefined) {
    const parsed = Number(fromUrl);
    if (Number.isFinite(parsed)) {
      return clamp(parsed);
    }
  }
  const stored = storage()?.getItem(DEADZONE_STORAGE_KEY);
  if (stored !== null && stored !== undefined) {
    const parsed = Number(stored);
    if (Number.isFinite(parsed)) {
      return clamp(parsed);
    }
  }
  return DEFAULT_DEADZONE;
}

/** Persist a new deadzone (in-session value applies immediately via gamepadDeadzone()). */
export function setGamepadDeadzone(value: number): void {
  try {
    storage()?.setItem(DEADZONE_STORAGE_KEY, String(value));
  } catch (err) {
    // Private mode etc. — the default applies next session.
  }
}

/** Dev/debug overlay flag (`?gpDebug`) — live intents / scope / focus readout. */
export function gamepadDebug(): boolean {
  return /[?&]gpDebug\b/.test(searchString());
}
