import {reactive} from 'vue';
import {Color, PLAYER_COLORS} from '@/common/Color';
import {normalizePlayerName, validatePlayerName} from '@/common/utils/playerName';
import {identityState, ensureIdentityLoaded, setIdentity} from './identity/identityState';
import {DEFAULT_IDENTITY_COLOR, isPlayerColor} from './identity/playerIdentity';

/**
 * The player's LOCAL profile roster — the multi-profile evolution of the single
 * {@link identityState}. Each profile is a saved (name + cube colour); ONE of
 * them is ACTIVE at a time. Switching / adding / removing a profile is a purely
 * local convenience so a household sharing one launcher can keep several named
 * players and jump between them without re-typing a name every time.
 *
 * `identityState` stays the ACTIVE identity that the rest of the app reads
 * (header, games list, create-game creator seat). This module is the SOURCE OF
 * TRUTH for the list + which one is active, and it MIRRORS the active profile
 * into `identityState` (via {@link setIdentity}) on every change — so every
 * existing consumer keeps working untouched, and a future account backend is a
 * single-file swap (mirrors friendsState / playerIdentity / lastGameState).
 *
 * Persisted in localStorage under ONE key; matching is case-insensitive
 * throughout (via {@link normalizePlayerName}), so a name can never be stored as
 * two profiles under different casing.
 */

const STORAGE_KEY = 'tm_player_profiles';

/** A sane upper bound so the roster can't grow unbounded / bloat storage. */
export const MAX_PROFILES = 12;

export interface PlayerProfile {
  id: string;
  displayName: string;
  normalizedName: string;
  cubeColor: Color;
}

export const profilesState = reactive<{
  profiles: Array<PlayerProfile>,
  activeId: string | undefined,
  loaded: boolean,
}>({
  profiles: [],
  activeId: undefined,
  loaded: false,
});

export type ProfileResult =
  | {ok: true, id: string}
  | {ok: false, reason: 'empty' | 'invalid' | 'duplicate' | 'full' | 'last' | 'missing'};

type StoredProfile = {id: string, displayName: string, cubeColor: Color};

function storageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/** A stable id for a profile (survives renames). crypto.randomUUID where available. */
function makeProfileId(): string {
  try {
    const uuid = (globalThis.crypto as {randomUUID?: () => string} | undefined)?.randomUUID?.();
    if (typeof uuid === 'string' && uuid !== '') {
      return uuid;
    }
  } catch {
    // fall through to the deterministic-ish fallback
  }
  return `p_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/**
 * Coerce a raw stored list into valid, case-insensitively-unique profiles
 * (first occurrence of a name wins) with unique ids, capped at
 * {@link MAX_PROFILES}. Tolerates any legacy / corrupt shape without throwing.
 */
function sanitize(rawList: ReadonlyArray<unknown>): Array<PlayerProfile> {
  const out: Array<PlayerProfile> = [];
  const seenNames = new Set<string>();
  const seenIds = new Set<string>();
  for (const raw of rawList) {
    if (typeof raw !== 'object' || raw === null) {
      continue;
    }
    const r = raw as {id?: unknown, displayName?: unknown, cubeColor?: unknown};
    const validation = validatePlayerName(String(r.displayName ?? ''));
    if (!validation.ok) {
      continue;
    }
    const norm = normalizePlayerName(validation.displayName);
    if (seenNames.has(norm)) {
      continue;
    }
    let id = typeof r.id === 'string' && r.id !== '' ? r.id : makeProfileId();
    if (seenIds.has(id)) {
      id = makeProfileId();
    }
    seenNames.add(norm);
    seenIds.add(id);
    out.push({
      id,
      displayName: validation.displayName,
      normalizedName: norm,
      cubeColor: isPlayerColor(r.cubeColor) ? r.cubeColor : DEFAULT_IDENTITY_COLOR,
    });
    if (out.length >= MAX_PROFILES) {
      break;
    }
  }
  return out;
}

function loadStored(): {profiles: Array<PlayerProfile>, activeId: string | undefined} {
  if (!storageAvailable()) {
    return {profiles: [], activeId: undefined};
  }
  const rawValue = localStorage.getItem(STORAGE_KEY);
  if (rawValue === null || rawValue === '') {
    return {profiles: [], activeId: undefined};
  }
  try {
    const parsed = JSON.parse(rawValue) as {profiles?: unknown, activeId?: unknown};
    const list = Array.isArray(parsed.profiles) ? parsed.profiles : [];
    const profiles = sanitize(list);
    let activeId = typeof parsed.activeId === 'string' ? parsed.activeId : undefined;
    if (activeId === undefined || !profiles.some((p) => p.id === activeId)) {
      activeId = profiles[0]?.id;
    }
    return {profiles, activeId};
  } catch {
    return {profiles: [], activeId: undefined};
  }
}

function persist(): void {
  if (!storageAvailable()) {
    return;
  }
  try {
    const payload: {profiles: Array<StoredProfile>, activeId: string | undefined} = {
      profiles: profilesState.profiles.map((p) => ({id: p.id, displayName: p.displayName, cubeColor: p.cubeColor})),
      activeId: profilesState.activeId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage may be unavailable (private mode / quota). The in-memory roster
    // still works for this session.
  }
}

/** The currently-active profile, or undefined when the roster is empty. */
export function activeProfile(): PlayerProfile | undefined {
  return profilesState.profiles.find((p) => p.id === profilesState.activeId);
}

/** Push the active profile into the shared identity every consumer reads. */
function syncActiveIdentity(): void {
  const active = activeProfile();
  if (active !== undefined) {
    setIdentity(active.displayName, active.cubeColor);
  }
}

/**
 * When the roster is empty but a legacy single identity exists (the pre-roster
 * `tm_player_identity`, or one just set by the Steam prefill / first-run
 * capture), adopt it as the first profile. Idempotent + cheap — safe to call on
 * every {@link ensureProfilesLoaded}, so a late (async) identity is picked up
 * regardless of call order.
 */
function adoptOrphanIdentity(): void {
  if (profilesState.profiles.length > 0) {
    return;
  }
  ensureIdentityLoaded();
  const id = identityState.identity;
  if (id === undefined) {
    return;
  }
  const profile: PlayerProfile = {
    id: makeProfileId(),
    displayName: id.displayName,
    normalizedName: id.normalizedName,
    cubeColor: id.cubeColor,
  };
  profilesState.profiles = [profile];
  profilesState.activeId = profile.id;
  persist();
  // identityState already equals this profile — no re-mirror needed.
}

/** Hydrate the roster from storage once (idempotent) + migrate legacy identity. */
export function ensureProfilesLoaded(): void {
  if (!profilesState.loaded) {
    const {profiles, activeId} = loadStored();
    profilesState.profiles = profiles;
    profilesState.activeId = activeId;
    profilesState.loaded = true;
    if (profiles.length > 0) {
      // The roster is the source of truth — mirror its active profile into the
      // shared identity (it may differ from a stale legacy key).
      syncActiveIdentity();
    }
  }
  adoptOrphanIdentity();
}

/** The first cube colour not already used by a profile (keeps them distinct). */
export function nextProfileColor(): Color {
  const used = new Set(profilesState.profiles.map((p) => p.cubeColor));
  for (const c of PLAYER_COLORS) {
    if (!used.has(c)) {
      return c;
    }
  }
  return DEFAULT_IDENTITY_COLOR;
}

/**
 * Add a profile (validated + de-duplicated case-insensitively). Activates it by
 * default (a freshly-added profile becomes the one you're playing as).
 */
export function addProfile(rawName: string, options: {color?: Color, activate?: boolean} = {}): ProfileResult {
  ensureProfilesLoaded();
  const validation = validatePlayerName(rawName);
  if (!validation.ok) {
    return {ok: false, reason: validation.reason === 'empty' ? 'empty' : 'invalid'};
  }
  const norm = normalizePlayerName(validation.displayName);
  if (profilesState.profiles.some((p) => p.normalizedName === norm)) {
    return {ok: false, reason: 'duplicate'};
  }
  if (profilesState.profiles.length >= MAX_PROFILES) {
    return {ok: false, reason: 'full'};
  }
  const profile: PlayerProfile = {
    id: makeProfileId(),
    displayName: validation.displayName,
    normalizedName: norm,
    cubeColor: options.color !== undefined && isPlayerColor(options.color) ? options.color : nextProfileColor(),
  };
  profilesState.profiles.push(profile);
  if (options.activate !== false) {
    profilesState.activeId = profile.id;
    syncActiveIdentity();
  }
  persist();
  return {ok: true, id: profile.id};
}

/** Rename a profile (validated + de-duplicated against the OTHER profiles). */
export function renameProfile(id: string, rawName: string): ProfileResult {
  ensureProfilesLoaded();
  const profile = profilesState.profiles.find((p) => p.id === id);
  if (profile === undefined) {
    return {ok: false, reason: 'missing'};
  }
  const validation = validatePlayerName(rawName);
  if (!validation.ok) {
    return {ok: false, reason: validation.reason === 'empty' ? 'empty' : 'invalid'};
  }
  const norm = normalizePlayerName(validation.displayName);
  if (profilesState.profiles.some((p) => p.id !== id && p.normalizedName === norm)) {
    return {ok: false, reason: 'duplicate'};
  }
  profile.displayName = validation.displayName;
  profile.normalizedName = norm;
  if (id === profilesState.activeId) {
    syncActiveIdentity();
  }
  persist();
  return {ok: true, id};
}

/** Change a profile's cube colour. */
export function setProfileColor(id: string, color: Color): ProfileResult {
  ensureProfilesLoaded();
  const profile = profilesState.profiles.find((p) => p.id === id);
  if (profile === undefined) {
    return {ok: false, reason: 'missing'};
  }
  profile.cubeColor = isPlayerColor(color) ? color : DEFAULT_IDENTITY_COLOR;
  if (id === profilesState.activeId) {
    syncActiveIdentity();
  }
  persist();
  return {ok: true, id};
}

/** Make a profile the active one (mirrors it into the shared identity). */
export function setActiveProfile(id: string): ProfileResult {
  ensureProfilesLoaded();
  if (!profilesState.profiles.some((p) => p.id === id)) {
    return {ok: false, reason: 'missing'};
  }
  profilesState.activeId = id;
  syncActiveIdentity();
  persist();
  return {ok: true, id};
}

/**
 * Remove a profile. Refuses to remove the LAST one (there must always be an
 * identity to play as). Removing the active profile hands active status to the
 * first remaining profile.
 */
export function removeProfile(id: string): ProfileResult {
  ensureProfilesLoaded();
  if (profilesState.profiles.length <= 1) {
    return {ok: false, reason: 'last'};
  }
  const idx = profilesState.profiles.findIndex((p) => p.id === id);
  if (idx < 0) {
    return {ok: false, reason: 'missing'};
  }
  const wasActive = profilesState.activeId === id;
  profilesState.profiles.splice(idx, 1);
  if (wasActive) {
    profilesState.activeId = profilesState.profiles[0]?.id;
    syncActiveIdentity();
  }
  persist();
  return {ok: true, id};
}
