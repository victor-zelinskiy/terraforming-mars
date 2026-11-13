/*
 * ConsolePlayedStack's MODULE level (docs/claude/vapor/RECIPES.md § R2 · § R25). `defineProps` is hoisted out of
 * setup, so a prop's default may name an import — never a non-literal local of the `<script setup>` block. The set
 * the two defaults share lives here: built once per page, as it was.
 */

/** The default of `outNames` / `grounded`: no card is lifted, none dissolves. ONE set for every stack; nothing writes it. */
export const EMPTY_SET: ReadonlySet<string> = new Set();
