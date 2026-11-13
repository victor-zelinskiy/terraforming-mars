/*
 * CardZoomModal's MODULE state (docs/claude/vapor/RECIPES.md § R25). Inside `<script setup>` every top-level statement
 * runs once per INSTANCE, so the cache every viewer of the page shares lives here — one per page, as it was.
 */

/*
 * perf: a card's NATURAL (zoom = 1) size is deterministic per card name, so it
 * is cached module-wide and survives reopen. A cached card fits with a pure
 * calc + one style write — NO `zoom` reset and NO forced synchronous reflow on
 * the LB/RB navigation frame (the reflow was the second half of the console
 * fullscreen jank, after the per-step remount). A card is measured at most once
 * ever; every later visit — including the very common browse-back-and-forth —
 * is free.
 */
export const naturalCardSizeCache = new Map<string, {width: number, height: number}>();
