/*
 * PlayerCube's MODULE state (docs/claude/vapor/RECIPES.md § R25). Inside `<script setup>` every top-level statement
 * runs once per INSTANCE, so the counter the cubes share lives here — one per page, as it was.
 */

// Per-page unique id source for the gradient defs.
let pcUid = 0;

/** A cube's id for its gradient defs — taken once, in its setup. */
export function newPlayerCubeUid(): number {
  return ++pcUid;
}
