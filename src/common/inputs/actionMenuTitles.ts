/**
 * The per-turn action-menu OrOptions titles, set by the server in
 * `Player.getActions` (`Player.ts`). This is the ONE top-level `or` the fork
 * deliberately keeps on the legacy inline radio UI (every OTHER top-level `or`
 * routes to a modal / dedicated surface), so several client surfaces must
 * recognise "this waitingFor IS the action menu".
 *
 * Kept here as a SHARED constant — the server SETS the title from it and the
 * client DETECTS it from the same source — so the literal lives in exactly one
 * place (mirrors the shared `SelectInitialCards` title constants). These are
 * plain STRINGS (never a `Message`), so the serialized model title is never
 * rewritten in place by i18n; matching it is language-independent (the check is
 * on the ORIGINAL English contract value, identical in every locale).
 */
export const ACTION_MENU_FIRST_TITLE = 'Take your first action';
export const ACTION_MENU_NEXT_TITLE = 'Take your next action';

export const ACTION_MENU_TITLES: ReadonlySet<string> =
  new Set<string>([ACTION_MENU_FIRST_TITLE, ACTION_MENU_NEXT_TITLE]);

/** True when `title` is one of the action-menu titles (the inline action `or`). */
export function isActionMenuTitle(title: string | undefined): boolean {
  return title !== undefined && ACTION_MENU_TITLES.has(title);
}
