import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {ResolvedPlayerIdentity, loadIdentity, persistIdentity} from './playerIdentity';

/**
 * Module-level reactive identity store (mirrors journalState / notificationState):
 * a single source of truth for the resolved player identity that survives any
 * component remount. The Premium Main Menu reads `identityState.identity` and
 * mutates it ONLY through {@link setIdentity}, so a future provider can replace
 * the storage backend without touching the UI.
 */
export const identityState = reactive<{
  identity: ResolvedPlayerIdentity | undefined,
  loaded: boolean,
}>({
  identity: undefined,
  loaded: false,
});

/** Hydrate the store from storage once (idempotent). */
export function ensureIdentityLoaded(): void {
  if (!identityState.loaded) {
    identityState.identity = loadIdentity();
    identityState.loaded = true;
  }
}

/** Persist + publish a new identity. Returns the resolved value. */
export function setIdentity(displayName: string, cubeColor: Color): ResolvedPlayerIdentity {
  const identity = persistIdentity(displayName, cubeColor);
  identityState.identity = identity;
  return identity;
}

export function hasIdentity(): boolean {
  ensureIdentityLoaded();
  return identityState.identity !== undefined;
}
