import {normalizePlayerName} from './playerName';

/**
 * The privileged display name that unlocks the dev-only game-rollback tool
 * (a new plate in the console main menu + its server routes).
 *
 * This is the SAME name-based identity model the premium main menu uses to find
 * a player's games (see {@link normalizePlayerName}) — it is NOT authentication.
 * A player who names themselves "admin" gains the tool; that is acceptable for a
 * self-hosted single-user fork (the rollback capability already exists ungated
 * via LOAD_GAME). Keep the gate funnelled through here so a future real account
 * model is a single-point swap. Both the client (menu visibility) and the server
 * routes (soft gate) consult {@link isAdminName}.
 */
export const ADMIN_NAME = 'admin';

/** Whether `name` is the privileged admin identity (case/space/NFC-insensitive). */
export function isAdminName(name: string | null | undefined): boolean {
  if (name === null || name === undefined) {
    return false;
  }
  return normalizePlayerName(name) === ADMIN_NAME;
}
