import {normalizePlayerName, validatePlayerName, PLAYER_NAME_MAX_LENGTH} from '@/common/utils/playerName';
import {desktopBridge} from '@/client/components/desktop/desktopUpdateState';
import {DEFAULT_IDENTITY_COLOR} from './playerIdentity';
import {ensureIdentityLoaded, identityState, setIdentity} from './identityState';

/**
 * First-run convenience: when NO local player identity exists yet, prefill it from the DISPLAY
 * name (persona) of the account signed into Steam. This is the "if the name isn't set yet, pull
 * whatever the Steam user is called" behaviour for the Steam Deck / Steam Machine build.
 *
 * Guarantees:
 *  - NEVER overrides an existing identity (only acts when `identityState.identity === undefined`),
 *    so a name the player typed before is untouched.
 *  - Inert off the desktop (Electron) shell / on an older shell without the bridge / on the web.
 *  - Best-effort + time-boxed: a slow or hung bridge can never block the menu / create screen.
 *
 * The prefilled name stays fully editable in the profile / participant editors; it just gives the
 * player a sensible default instead of an empty field the very first time they launch.
 */

/** Cap the bridge call so a wedged main process can't stall the screen that awaits us. */
const STEAM_NAME_TIMEOUT_MS = 1500;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([
    p,
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms)),
  ]);
}

/** Fit a raw Steam persona name to the game's name rules (trim + clamp to the max length). */
function toValidName(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return undefined;
  }
  const validation = validatePlayerName(trimmed);
  if (validation.ok) {
    return validation.displayName;
  }
  // Only failure worth salvaging is "too-long": clamp by code points and re-validate.
  const clamped = [...trimmed].slice(0, PLAYER_NAME_MAX_LENGTH).join('').trim();
  const reValidated = validatePlayerName(clamped);
  return reValidated.ok && normalizePlayerName(clamped) !== '' ? reValidated.displayName : undefined;
}

let inFlight: Promise<void> | undefined;

async function doPrefill(): Promise<void> {
  const getSteamName = desktopBridge()?.getSteamName;
  if (typeof getSteamName !== 'function') {
    return; // web / older shell — nothing to pull from.
  }
  try {
    const raw = await withTimeout(getSteamName(), STEAM_NAME_TIMEOUT_MS);
    // Re-check: the player may have set a name while the IPC was in flight — never clobber it.
    if (identityState.identity !== undefined || typeof raw !== 'string') {
      return;
    }
    const name = toValidName(raw);
    if (name !== undefined) {
      setIdentity(name, DEFAULT_IDENTITY_COLOR);
    }
  } catch {
    // Best-effort: leave the field empty if Steam can't be read.
  }
}

/**
 * Prefill the identity from Steam if none is set. Idempotent + concurrency-safe: the bridge is
 * queried at most once per session, and a second concurrent caller (e.g. the create screen awaiting
 * while the main menu's fire-and-forget call is still in flight) awaits that SAME result rather than
 * racing ahead of it. Safe to call from any menu / create-screen `mounted()`; resolves once the
 * attempt is complete so an awaiting screen can then read `identityState.identity`.
 */
export function prefillIdentityFromSteam(): Promise<void> {
  ensureIdentityLoaded();
  if (identityState.identity !== undefined) {
    return Promise.resolve();
  }
  if (inFlight === undefined) {
    inFlight = doPrefill();
  }
  return inFlight;
}
