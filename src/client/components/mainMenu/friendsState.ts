import {reactive} from 'vue';
import {normalizePlayerName, validatePlayerName} from '@/common/utils/playerName';

/**
 * The player's LOCAL friends list — a primitive convenience feature: a set of
 * remembered display names offered as quick picks when inviting participants to
 * a new game. Just strings; NOT accounts, NOT authentication.
 *
 * Matching is case-insensitive throughout (via {@link normalizePlayerName}),
 * consistent with the rest of the name-based identity model — so a friend can
 * never be stored twice under different casing, and picking a friend into a
 * seat lines up with the case-insensitive duplicate check on the create screen.
 *
 * Persisted in localStorage under ONE key (mirrors playerIdentity /
 * lastGameState / joinGamesState) so a future account/contacts backend is a
 * single-file swap. The module-level reactive store survives component
 * remounts, like journalState / identityState.
 */

const STORAGE_KEY = 'tm_friends';

/** A sane upper bound so the list can't grow unbounded / bloat storage. */
export const MAX_FRIENDS = 50;

export const friendsState = reactive<{
  friends: Array<string>,
  loaded: boolean,
}>({
  friends: [],
  loaded: false,
});

export type AddFriendResult =
  | {ok: true}
  | {ok: false, reason: 'empty' | 'invalid' | 'duplicate' | 'full'};

function storageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Coerce a raw stored list into valid, case-insensitively-unique display names
 * (first occurrence wins), capped at {@link MAX_FRIENDS}. Tolerates any legacy /
 * corrupt shape without throwing.
 */
function sanitize(names: ReadonlyArray<unknown>): Array<string> {
  const out: Array<string> = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const validation = validatePlayerName(String(raw ?? ''));
    if (!validation.ok) {
      continue;
    }
    const norm = normalizePlayerName(validation.displayName);
    if (seen.has(norm)) {
      continue;
    }
    seen.add(norm);
    out.push(validation.displayName);
    if (out.length >= MAX_FRIENDS) {
      break;
    }
  }
  return out;
}

function loadFriends(): Array<string> {
  if (!storageAvailable()) {
    return [];
  }
  const rawValue = localStorage.getItem(STORAGE_KEY);
  if (rawValue === null || rawValue === '') {
    return [];
  }
  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? sanitize(parsed) : [];
  } catch {
    return [];
  }
}

function persist(): void {
  if (!storageAvailable()) {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(friendsState.friends));
  } catch {
    // Storage may be unavailable (private mode / quota). The in-memory list
    // still works for this session.
  }
}

/** Hydrate the store from storage once (idempotent). */
export function ensureFriendsLoaded(): void {
  if (!friendsState.loaded) {
    friendsState.friends = loadFriends();
    friendsState.loaded = true;
  }
}

/** Add a friend name (validated + de-duplicated case-insensitively). */
export function addFriend(rawName: string): AddFriendResult {
  ensureFriendsLoaded();
  const validation = validatePlayerName(rawName);
  if (!validation.ok) {
    return {ok: false, reason: validation.reason === 'empty' ? 'empty' : 'invalid'};
  }
  const norm = normalizePlayerName(validation.displayName);
  if (friendsState.friends.some((f) => normalizePlayerName(f) === norm)) {
    return {ok: false, reason: 'duplicate'};
  }
  if (friendsState.friends.length >= MAX_FRIENDS) {
    return {ok: false, reason: 'full'};
  }
  friendsState.friends.push(validation.displayName);
  persist();
  return {ok: true};
}

/** Remove a friend by name (case-insensitive). No-op when absent. */
export function removeFriend(name: string): void {
  ensureFriendsLoaded();
  const norm = normalizePlayerName(name);
  const idx = friendsState.friends.findIndex((f) => normalizePlayerName(f) === norm);
  if (idx >= 0) {
    friendsState.friends.splice(idx, 1);
    persist();
  }
}

/** True when a name is already a friend (case-insensitive). */
export function isFriend(name: string): boolean {
  ensureFriendsLoaded();
  const norm = normalizePlayerName(name);
  return friendsState.friends.some((f) => normalizePlayerName(f) === norm);
}
