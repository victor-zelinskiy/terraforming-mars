<template>
  <Teleport to="body">
  <div class="cm-vk-overlay" role="dialog" :aria-label="$t('On-screen keyboard')">
    <div class="cm-vk-panel">
      <span class="cm-vk-panel__corner cm-vk-panel__corner--tl" aria-hidden="true"></span>
      <span class="cm-vk-panel__corner cm-vk-panel__corner--tr" aria-hidden="true"></span>

      <div class="cm-vk-panel__head">
        <span class="cm-vk-panel__title">{{ $t(title) }}</span>
        <span class="cm-vk-panel__lang">{{ langBadge }}</span>
      </div>

      <!-- Draft display (read-only — the virtual keyboard is the ONLY editor). -->
      <div class="cm-vk-field" :class="{'cm-vk-field--empty': value === ''}">
        <span class="cm-vk-field__text">{{ value !== '' ? value : $t('Enter a player name') }}</span>
        <span class="cm-vk-field__caret" aria-hidden="true"></span>
        <span class="cm-vk-field__count">{{ value.length }}/{{ maxLength }}</span>
      </div>
      <div v-if="issue !== ''" class="cm-vk-field__issue">{{ $t(issue) }}</div>

      <!-- simple-keyboard mount (its own CSS is NOT imported — fully styled in LESS). -->
      <div ref="kb" class="cm-vk-mount"></div>

      <div class="cm-vk-panel__hints" aria-hidden="true">
        <span class="cm-vk-panel__hint"><GamepadGlyph control="dpad" />{{ $t('Navigate') }}</span>
        <span class="cm-vk-panel__hint"><GamepadGlyph control="confirm" />{{ $t('Type a key') }}</span>
        <span class="cm-vk-panel__hint"><GamepadGlyph control="secondary" />{{ $t('Backspace') }}</span>
        <span class="cm-vk-panel__hint"><GamepadGlyph control="bumperR" />{{ $t('Space bar') }}</span>
        <span v-if="multiLang" class="cm-vk-panel__hint"><GamepadGlyph control="triggerR" />{{ $t('Input language') }}</span>
        <span class="cm-vk-panel__hint cm-vk-panel__hint--done"><GamepadGlyph control="inspect" />{{ $t('Confirm') }}</span>
        <span class="cm-vk-panel__hint"><GamepadGlyph control="back" />{{ $t('Cancel') }}</span>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<script setup vapor lang="ts">
/*
 * Teleported to <body> so it escapes the host editor's stacking context
 * (.cm-overlay, z 11500) and covers EVERYTHING, including the command bar.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
/**
 * CONSOLE-NATIVE VIRTUAL KEYBOARD — the premium on-screen keyboard for name
 * entry on the create/profile screens, so the console flow never falls back
 * to the device keyboard. Built on `simple-keyboard` (hodgef/simple-keyboard)
 * for the key layout + input model; the library's CSS is deliberately NOT
 * imported — the whole thing is restyled in `console_menu.less` to match the
 * Mission Bridge (dark glass / cyan cursor / gold accents).
 *
 * We OWN the input logic through the library's public API
 * (`handleButtonClicked` / `onChange` / `setOptions`), so a gamepad cursor can
 * drive it deterministically: a 2D cursor sits over the rendered `.hg-button`
 * grid (state-based, never DOM focus), A presses the cursored key, the d-pad
 * moves, and dedicated buttons map to backspace / space / shift / language /
 * done. A physical keyboard is a desktop convenience (its own window listener),
 * but the on-screen keyboard is the primary interface.
 *
 * Pad hotkeys: A = type the cursored key, X = backspace, LB = shift,
 * RB = space, **RT = switch input language**, **Y = CONFIRM (commit — no need
 * to land on the on-screen ✓)**, B = cancel. The two hotkey keys carry their
 * glyph baked on: ✓ shows the Y badge, {lang} shows the RT badge.
 *
 * INPUT LANGUAGE — the offered layouts come from the USER'S own language
 * preferences (`resolveUserKeyboardLayouts`, driven by `navigator.languages` /
 * a localStorage override), NOT the game's UI languages. RT + the on-screen
 * «{lang}» key CYCLE through that resolved set.
 *
 * Host contract: the parent renders this while name entry is active and routes
 * pad intents into `handleIntent`; it listens for `commit(value)` / `cancel`.
 */
import {computed, markRaw, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef} from 'vue';
import Keyboard from 'simple-keyboard';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {$t} from '@/client/directives/i18n';
import {VkLayout, resolveUserKeyboardLayouts} from '@/client/components/console/menu/consoleKeyboardLayouts';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

defineOptions({name: 'ConsoleVirtualKeyboard'});
const props = defineProps({
  initial: {type: String, default: ''},
  maxLength: {type: Number, default: 32},
  title: {type: String, default: 'Player name'},
  /** English i18n source for a validation message shown above the keys. */
  issue: {type: String, default: ''},
});
const emit = defineEmits(['commit', 'cancel', 'update']);

const kb = useTemplateRef<HTMLDivElement>('kb');
const value = ref(props.initial);
const layouts = ref(resolveUserKeyboardLayouts());
const layoutIndex = ref(0);
const shift = ref(false);
const cursorRow = ref(1);
const cursorCol = ref(0);
let keyboard: Keyboard | undefined;
let keyGrid: Array<Array<HTMLElement>> = [];
const activeLayout = computed((): VkLayout => {
  return layouts.value[layoutIndex.value];
});
const multiLang = computed((): boolean => {
  return layouts.value.length > 1;
});
const langBadge = computed((): string => {
  return activeLayout.value.code;
});
const layoutName = computed((): string => {
  return activeLayout.value.id + (shift.value ? 'Shift' : '');
});

function initKeyboard(): void {
  const el = kb.value;
  if (el === null) {
    void nextTick(() => initKeyboard());
    return;
  }
  keyboard = markRaw(new Keyboard(el, {
    layout: buildLayout(),
    layoutName: layoutName.value,
    display: displayMap(),
    mergeDisplay: true,
    maxLength: props.maxLength,
    theme: 'hg-theme-default cm-vk',
    buttonTheme: [
      {class: 'cm-vk__key--fn', buttons: '{bksp} {shift} {lang} {space}'},
      {class: 'cm-vk__key--lang', buttons: '{lang}'},
      {class: 'cm-vk__key--done', buttons: '{done}'},
      {class: 'cm-vk__key--wide', buttons: '{space}'},
    ],
    onChange: (input: string) => onChange(input),
    onKeyPress: (button: string) => onKeyPress(button),
  }));
  keyboard.setInput(value.value);
  void nextTick(() => {
    recollect();
    moveTo(1, 0);
  });
}
/** Build the simple-keyboard layout object from the user's resolved layouts. */
function buildLayout(): Record<string, Array<string>> {
  // The {lang} key is only meaningful when >1 layout is offered.
  const fnDefault = (multiLang.value ? '{lang} ' : '') + '- {space} {done}';
  const fnShift = (multiLang.value ? '{lang} ' : '') + '_ {space} {done}';
  const obj: Record<string, Array<string>> = {};
  for (const l of layouts.value) {
    obj[l.id] = [...l.rows, fnDefault];
    obj[l.id + 'Shift'] = [...l.shiftRows, fnShift];
  }
  return obj;
}
function displayMap(): Record<string, string> {
  const next = layouts.value[(layoutIndex.value + 1) % layouts.value.length];
  return {
    // The {lang} / {done} keys carry their gamepad-hotkey glyph via CSS
    // (::before badge), so their display stays compact — the layout code
    // for {lang}, a bare check for {done}.
    '{bksp}': '⌫',
    '{shift}': '⇧',
    '{space}': $t('Space bar'),
    '{lang}': next.code,
    '{done}': '✓',
  };
}
// ── Host-routed pad intents ────────────────────────────────────────
function handleIntent(intent: GamepadIntent): boolean {
  if (intent.kind === 'nav') {
    moveCursor(intent.dir);
    return true;
  }
  if (intent.kind !== 'press') {
    return true;
  }
  switch (intent.button) {
  case 'confirm': pressCursored(); return true;
  case 'secondary': press('{bksp}'); return true; // X — backspace
  case 'inspect': emit('commit', value.value); return true; // Y — CONFIRM (commit)
  case 'triggerR': toggleLang(); return true; // RT — input language
  case 'bumperL': toggleShift(); return true; // LB — shift
  case 'bumperR': press('{space}'); return true; // RB — space
  case 'back': emit('cancel'); return true; // B — cancel
  default: return true;
  }
}
// ── Key grid + cursor ──────────────────────────────────────────────
function recollect(): void {
  const root = kb.value;
  if (root === null) {
    keyGrid = [];
    return;
  }
  keyGrid = Array.from(root.querySelectorAll<HTMLElement>('.hg-row'))
    .map((row) => Array.from(row.querySelectorAll<HTMLElement>('.hg-button')));
}
function moveCursor(dir: NavDirection): void {
  if (dir === 'left') {
    moveTo(cursorRow.value, cursorCol.value - 1);
  } else if (dir === 'right') {
    moveTo(cursorRow.value, cursorCol.value + 1);
  } else if (dir === 'up') {
    moveTo(cursorRow.value - 1, cursorCol.value);
  } else if (dir === 'down') {
    moveTo(cursorRow.value + 1, cursorCol.value);
  }
}
function moveTo(row: number, col: number): void {
  const rows = keyGrid;
  if (rows.length === 0) {
    return;
  }
  const r = Math.min(Math.max(0, row), rows.length - 1);
  const c = Math.min(Math.max(0, col), rows[r].length - 1);
  cursorRow.value = r;
  cursorCol.value = c;
  paintCursor();
}
function paintCursor(): void {
  for (const row of keyGrid) {
    for (const key of row) {
      key.classList.remove('cm-vk__key--cursor');
    }
  }
  keyGrid[cursorRow.value]?.[cursorCol.value]?.classList.add('cm-vk__key--cursor');
}
function pressCursored(): void {
  const el = keyGrid[cursorRow.value]?.[cursorCol.value];
  const name = el?.getAttribute('data-skbtn');
  if (name !== null && name !== undefined) {
    press(name);
  }
}
function press(button: string): void {
  keyboard?.handleButtonClicked(button);
}
// ── Library callbacks ──────────────────────────────────────────────
function onChange(input: string): void {
  value.value = input;
  emit('update', input);
}
function onKeyPress(button: string): void {
  if (button === '{lang}') {
    toggleLang();
  } else if (button === '{shift}') {
    toggleShift();
  } else if (button === '{done}') {
    emit('commit', value.value);
  }
  // Plain chars + {bksp}/{space} are applied by simple-keyboard → onChange.
}
// ── Layout switching ───────────────────────────────────────────────
function toggleShift(): void {
  shift.value = !shift.value;
  applyLayout();
}
function toggleLang(): void {
  if (!multiLang.value) {
    return; // Only one layout offered — nothing to cycle.
  }
  layoutIndex.value = (layoutIndex.value + 1) % layouts.value.length;
  applyLayout();
}
function applyLayout(): void {
  keyboard?.setOptions({layoutName: layoutName.value, display: displayMap()});
  // Re-render swaps the DOM — re-collect the grid and keep the cursor sane.
  void nextTick(() => {
    recollect();
    moveTo(cursorRow.value, cursorCol.value);
  });
}
// ── Physical keyboard (desktop convenience; Deck is pad-only) ───────
function onPhysicalKey(e: KeyboardEvent): void {
  if (e.key === 'Enter') {
    e.preventDefault();
    emit('commit', value.value);
    return;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    emit('cancel');
    return;
  }
  if (e.key === 'Backspace') {
    e.preventDefault();
    press('{bksp}');
    return;
  }
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    press(e.key);
  }
}

onMounted(() => {
  // The mount lives inside a Teleport; the ref is populated by mount time,
  // but guard defensively so a timing miss retries instead of crashing.
  void nextTick(() => initKeyboard());
  window.addEventListener('keydown', onPhysicalKey, {capture: true});
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onPhysicalKey, {capture: true});
  keyboard?.destroy();
  keyboard = undefined;
});
defineExpose({handleIntent});
</script>
