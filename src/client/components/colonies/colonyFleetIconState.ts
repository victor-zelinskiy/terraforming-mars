/*
 * ColonyFleetIcon's MODULE state (docs/claude/vapor/RECIPES.md § R25). Inside `<script setup>` every top-level
 * statement runs once per INSTANCE, so the counter the ships share lives here — one per page, as it was (left in the
 * component it would start again with every ship, and all of them would share one gradient id).
 */
let fleetIconUid = 0;

/** A ship's number for its gradient id — taken once, in its setup (the component prints it as `cfi<n>`). */
export function newFleetIconUid(): number {
  return ++fleetIconUid;
}
