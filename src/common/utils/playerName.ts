/**
 * Shared player-name helpers used by BOTH the client identity layer and the
 * server join/color-override routes, so name matching is byte-identical on
 * both sides.
 *
 * NOTE: this is part of the TEMPORARY, name-based player identity model used by
 * the Premium Main Menu to find a player's unfinished games and prefill game
 * creation. It is NOT authentication. A future account/login (or Electron-local
 * identity) will replace name matching with a stable account id — keep all
 * name-based matching funnelled through `normalizePlayerName` so that swap is a
 * single-point change.
 */

export const PLAYER_NAME_MIN_LENGTH = 2;
export const PLAYER_NAME_MAX_LENGTH = 32;

/**
 * Canonical form used for cross-game matching: trim, Unicode-normalize (NFC so
 * composed/decomposed forms compare equal), and lower-case with locale rules
 * (correct for Cyrillic, which the fork's audience uses).
 */
export function normalizePlayerName(name: string): string {
  return name.trim().normalize('NFC').toLocaleLowerCase();
}

export type PlayerNameValidation =
  | {ok: true, displayName: string}
  | {ok: false, reason: 'empty' | 'too-short' | 'too-long'};

/** Validate a raw display-name input for the identity modal. */
export function validatePlayerName(raw: string): PlayerNameValidation {
  const displayName = raw.trim();
  if (displayName.length === 0) {
    return {ok: false, reason: 'empty'};
  }
  // Count by code points so an emoji / surrogate pair isn't double-counted.
  const length = [...displayName].length;
  if (length < PLAYER_NAME_MIN_LENGTH) {
    return {ok: false, reason: 'too-short'};
  }
  if (length > PLAYER_NAME_MAX_LENGTH) {
    return {ok: false, reason: 'too-long'};
  }
  return {ok: true, displayName};
}
