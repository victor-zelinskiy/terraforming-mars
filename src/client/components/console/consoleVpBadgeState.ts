/*
 * The MODULE STATE of `ConsoleVpBadge.vue`. It lives in a `.ts` module because every top-level statement of a
 * `<script setup>` block runs once per INSTANCE (docs/claude/vapor/RECIPES.md § R25): left inside the component the
 * counter would start from zero in every badge, and every badge would carry the same ids.
 */

// Per-instance gradient ids: same-id <defs> collide across multiple mounted
// copies (all resolve to the FIRST one in the document, which breaks if that
// copy unmounts) — a module counter keeps every badge self-contained.
let uidCounter = 0;

/** The next badge's number — taken once, in the badge's setup. */
export function nextVpBadgeUid(): number {
  return ++uidCounter;
}
