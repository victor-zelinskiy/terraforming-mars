import {Color, PLAYER_COLORS} from '@/common/Color';
import {normalizePlayerName, validatePlayerName} from '@/common/utils/playerName';

/**
 * Where the resolved identity came from. Today only `local-storage` /
 * `manual-name` are produced; the others are declared so the UI can be written
 * against the full set now and a future account-login / Electron-local-DB
 * provider can populate them WITHOUT changing any consumer.
 */
export type IdentitySource =
  | 'existing-cookie'
  | 'local-storage'
  | 'manual-name'
  | 'future-electron-local-db';

/**
 * The TEMPORARY local player identity used by the Premium Main Menu to find a
 * player's unfinished games and prefill game creation. NOT authentication — see
 * the storage note below. The UI must depend only on this shape, never on where
 * it was resolved from, so the future identity provider is a drop-in swap.
 */
export interface ResolvedPlayerIdentity {
  displayName: string;
  normalizedName: string;
  cubeColor: Color;
  source: IdentitySource;
  temporary: boolean;
}

/**
 * localStorage key for the temporary identity. Scoped + clearly named.
 * TEMPORARY identity (display name + cube colour) — NOT secure authentication.
 * A later account login (or Electron local DB) will supersede this; keep all
 * reads/writes funnelled through this module so that migration is one place.
 */
const STORAGE_KEY = 'tm_player_identity';

/** Project default preselect when no identity exists yet (first playable colour). */
export const DEFAULT_IDENTITY_COLOR: Color = PLAYER_COLORS[0];

type StoredIdentity = {displayName: string, cubeColor: Color};

function storageAvailable(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function isPlayerColor(value: unknown): value is Color {
  return typeof value === 'string' && (PLAYER_COLORS as ReadonlyArray<string>).includes(value);
}

function buildIdentity(displayName: string, cubeColor: Color, source: IdentitySource): ResolvedPlayerIdentity {
  return {
    displayName,
    normalizedName: normalizePlayerName(displayName),
    cubeColor,
    source,
    temporary: true,
  };
}

/** Resolve the stored identity, or `undefined` if none / invalid. */
export function loadIdentity(): ResolvedPlayerIdentity | undefined {
  if (!storageAvailable()) {
    return undefined;
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null || raw === '') {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StoredIdentity>;
    const validation = validatePlayerName(String(parsed.displayName ?? ''));
    if (!validation.ok) {
      return undefined;
    }
    const cubeColor = isPlayerColor(parsed.cubeColor) ? parsed.cubeColor : DEFAULT_IDENTITY_COLOR;
    return buildIdentity(validation.displayName, cubeColor, 'local-storage');
  } catch {
    return undefined;
  }
}

/**
 * Persist a new identity (name + colour) and return the resolved value. The
 * caller is expected to have validated the name already; this re-trims as a
 * safety net and clamps an invalid colour to the default.
 */
export function persistIdentity(rawName: string, cubeColor: Color): ResolvedPlayerIdentity {
  const validation = validatePlayerName(rawName);
  const displayName = validation.ok ? validation.displayName : rawName.trim();
  const color = isPlayerColor(cubeColor) ? cubeColor : DEFAULT_IDENTITY_COLOR;
  const identity = buildIdentity(displayName, color, 'manual-name');
  if (storageAvailable()) {
    const stored: StoredIdentity = {displayName, cubeColor: color};
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Storage may be unavailable (private mode / quota). The in-memory
      // identity still works for this session.
    }
  }
  return identity;
}
