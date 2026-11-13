/*
 * NomadToken's MODULE state (docs/claude/vapor/RECIPES.md § R25). Inside `<script setup>` every top-level statement
 * runs once per INSTANCE, so the counter the tokens share lives here — one per page, as it was.
 */

// Per-page unique id source for the gradient defs (PlayerCube's discipline —
// many tokens on one page must not collide).
let ntUid = 0;

/** A token's id for its gradient defs — taken once, in its setup. */
export function newNomadTokenUid(): number {
  return ++ntUid;
}
