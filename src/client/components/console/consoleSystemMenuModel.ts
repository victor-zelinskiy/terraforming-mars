/*
 * ConsoleSystemMenu's MODULE level (docs/claude/vapor/RECIPES.md § R25). A `<script setup>` block cannot export a
 * value, and `GamepadLayer` — the overlay's owner — walks the very list the menu draws: the list and its item type
 * live here, built once per page, as they were.
 */

export type SystemMenuItem = {
  id: 'settings' | 'controls' | 'report' | 'diagnostics' | 'exit' | 'return',
  /** English i18n key. */
  label: string,
  /** English i18n key — what the plate leads to. Static: never a value. */
  sub: string,
  glyph: string,
};

/**
 * Fixed shape (see the header of `ConsoleSystemMenu.vue`): every plate is a constant-height pair
 * of STATIC labels, so d-pad navigation never moves the plates. «Настройки»
 * opens the settings console; «Сообщить о проблеме» and «Диагностика» open the
 * diagnostics surface (the report's first step / the journal —
 * docs/claude/diagnostics.md) — neither relabels anything here.
 */
export const SYSTEM_MENU_ITEMS: ReadonlyArray<SystemMenuItem> = [
  {id: 'settings', label: 'Settings', sub: 'Interface, controls, graphics', glyph: '⚙'},
  {id: 'controls', label: 'Controls', sub: 'Gamepad button map', glyph: '◎'},
  {id: 'report', label: 'Report a problem', sub: 'Send a report to the developer', glyph: '✉'},
  {id: 'diagnostics', label: 'Diagnostics', sub: 'Error journal, system, connection check', glyph: '⊙'},
  {id: 'exit', label: 'To main menu', sub: 'The game will be saved', glyph: '⌂'},
  {id: 'return', label: 'Return to game', sub: 'Close this menu', glyph: '↩'},
];
