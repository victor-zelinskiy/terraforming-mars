/*
 * @console-shared LIVE — console native stands on this file.
 *
 * ConsoleRevealOverlay's MODULE state (docs/claude/vapor/RECIPES.md § R25). Inside `<script setup>` every top-level
 * statement runs once per INSTANCE, so the settlement table's handles live here — one registry per page, as they were.
 */

/**
 * THE SETTLEMENT TABLE's place bodies + their running turns — DOM/GSAP handles, never reactive state (one instance
 * per resolution; the overlay is the table's only renderer).
 */
export const placeBodies = new Map<number, HTMLElement>();
export const placeTurns = new Map<number, {kill: () => unknown}>();
