/*
 * AnimatedScaleMarker's MODULE state (docs/claude/vapor/RECIPES.md § R25). Inside `<script setup>` every top-level
 * statement runs once per INSTANCE, so the baseline the cursors keep across their remounts lives here — one per page,
 * as it was (left in the component it would start empty with every mount, and no cursor would ever have a previous
 * value to glide from).
 */

export type AccentName = 'temperature' | 'oxygen' | 'venus' | 'oceans';

/**
 * Per-accent baseline that SURVIVES the `<player-home :key="playerkey">`
 * remount that App.vue forces on every server poll. Without this the
 * marker re-mounts with no memory of the previous value — its `watch`
 * never fires and every change visually looks like a snap.
 *
 * On mount the component reads the stored `lastValue`, snaps the marker
 * to that previous position, then animates to its current `value` prop
 * over the freshly-snapshotted anchors. Mirrors the contract of
 * `changeFeedbackManager` (src/client/components/feedback/).
 *
 * Single store across all sessions is fine for global parameters —
 * temperature / oxygen / venus are game-wide and don't change between
 * displayed players. Worst case across a brand-new game: a one-time
 * long-range traversal from the last game's final value to MIN — quickly
 * capped by MAX_DURATION_MS, no further bleed.
 */
type AccentState = {lastValue: number | undefined};
export const accentBaseline: Record<AccentName, AccentState> = {
  temperature: {lastValue: undefined},
  oxygen: {lastValue: undefined},
  venus: {lastValue: undefined},
  oceans: {lastValue: undefined},
};
