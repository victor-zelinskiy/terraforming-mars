/*
 * ConsoleBoardSection's MODULE state (docs/claude/vapor/RECIPES.md § R25). Inside `<script setup>` every top-level
 * statement runs once per INSTANCE, so the two measurement caches and the registry of marked cells live here — one of
 * each per page, as they were (the section is a singleton, and the caches' keys carry the map name: a re-mounted
 * section keeps what the board already measured).
 */

/**
 * Intrinsic board-px coordinates per cell — measured ONCE per (map, cell):
 * every hex is absolutely positioned by a static per-id margin, so its
 * intrinsic position never changes for the life of a map. Measured through
 * rect division (cell rect vs `.board-cont` rect / the live scale), which
 * cancels the planet transform exactly — a mid-tween measurement is still
 * correct. Module-level: the section is a singleton and the key carries the
 * map name, so a rematch onto another board can never read a stale entry.
 */
export const cellPosCache = new Map<string, {x: number, y: number}>();

/**
 * Cells currently carrying a placement RELATION mark (`con-rel con-rel--*`) —
 * remembered so a step/exit strips exactly what was applied. Value = the tone
 * class, so clearing never has to enumerate the vocabulary.
 */
export const relationMarked = new Map<HTMLElement, string>();

/**
 * The focused cell's printed-bonus cluster in CELL-LOCAL board px (union of
 * its `.board-space-bonus` boxes) — measured once per (map, cell): the icons
 * are absolutely positioned by static per-id margins, so the cluster never
 * moves for the life of a map. Drives the reticle's ghost «quiet zone» mask.
 * (The value is `ConsoleBoardCursor.vue`'s `BonusZone`, spelled out: a `.ts` module sees a `.vue` only through the
 * shim, which carries no named export. `null` = measured, none.)
 */
export const bonusZoneCache = new Map<string, {cx: number, cy: number, w: number, h: number} | null>();
