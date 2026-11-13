/*
 * EndgameLineChart's MODULE state (docs/claude/vapor/RECIPES.md § R25). Inside `<script setup>` every top-level statement
 * runs once per INSTANCE, so the counter the charts share lives here — one per page, as it was.
 */

// Unique gradient-id namespace per chart instance (several charts per page).
let chartUid = 0;

/** A chart's id for its gradient defs — taken once, in its setup. */
export function newEndgameLineChartUid(): number {
  return ++chartUid;
}
