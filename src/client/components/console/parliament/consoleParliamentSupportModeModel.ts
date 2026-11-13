/*
 * ConsoleParliamentSupportMode's MODULE level (docs/claude/vapor/RECIPES.md § R25). A `<script setup>` block cannot
 * export a value: the one line of copy the mode owns lives here, where a spec can read the key the mode prints.
 */

/** The candidate's rule in one line — where the cubes go and what does not change (glossary §8: two short facts). */
export const SUPPORT_DISCARD_RULE_KEY = 'The neutral delegates return to the common supply. The resolutions keep their votes.';
