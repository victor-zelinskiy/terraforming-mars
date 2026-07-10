<template>
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
        <span v-if="multiLang" class="cm-vk-panel__hint"><GamepadGlyph control="inspect" />{{ $t('Input language') }}</span>
        <span class="cm-vk-panel__hint"><GamepadGlyph control="bumperR" />{{ $t('Space bar') }}</span>
        <span class="cm-vk-panel__hint cm-vk-panel__hint--done"><GamepadGlyph control="back" />{{ $t('Done') }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
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
 * INPUT LANGUAGE — the offered layouts come from the USER'S own language
 * preferences (`resolveUserKeyboardLayouts`, driven by `navigator.languages` /
 * a localStorage override), NOT the game's UI languages. The language hotkey
 * (Y) + the on-screen «{lang}» key CYCLE through that resolved set.
 *
 * Host contract: the parent renders this while name entry is active and routes
 * pad intents into `handleIntent`; it listens for `commit(value)` / `cancel`.
 */
import {defineComponent, markRaw} from 'vue';
import Keyboard from 'simple-keyboard';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {$t} from '@/client/directives/i18n';
import {VkLayout, resolveUserKeyboardLayouts} from '@/client/components/console/menu/consoleKeyboardLayouts';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

export default defineComponent({
  name: 'ConsoleVirtualKeyboard',
  components: {GamepadGlyph},
  props: {
    initial: {type: String, default: ''},
    maxLength: {type: Number, default: 32},
    title: {type: String, default: 'Player name'},
    /** English i18n source for a validation message shown above the keys. */
    issue: {type: String, default: ''},
  },
  emits: ['commit', 'cancel', 'update'],
  data() {
    return {
      value: this.initial,
      layouts: resolveUserKeyboardLayouts(),
      layoutIndex: 0,
      shift: false,
      cursorRow: 1,
      cursorCol: 0,
      keyboard: undefined as Keyboard | undefined,
      keyGrid: [] as Array<Array<HTMLElement>>,
    };
  },
  computed: {
    activeLayout(): VkLayout {
      return this.layouts[this.layoutIndex];
    },
    multiLang(): boolean {
      return this.layouts.length > 1;
    },
    langBadge(): string {
      return this.activeLayout.code;
    },
    layoutName(): string {
      return this.activeLayout.id + (this.shift ? 'Shift' : '');
    },
  },
  mounted() {
    const el = this.$refs.kb as HTMLDivElement;
    this.keyboard = markRaw(new Keyboard(el, {
      layout: this.buildLayout(),
      layoutName: this.layoutName,
      display: this.displayMap(),
      mergeDisplay: true,
      maxLength: this.maxLength,
      theme: 'hg-theme-default cm-vk',
      buttonTheme: [
        {class: 'cm-vk__key--fn', buttons: '{bksp} {shift} {lang} {space}'},
        {class: 'cm-vk__key--done', buttons: '{done}'},
        {class: 'cm-vk__key--wide', buttons: '{space}'},
      ],
      onChange: (input: string) => this.onChange(input),
      onKeyPress: (button: string) => this.onKeyPress(button),
    }));
    this.keyboard.setInput(this.value);
    void this.$nextTick(() => {
      this.recollect();
      this.moveTo(1, 0);
    });
    window.addEventListener('keydown', this.onPhysicalKey, {capture: true});
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.onPhysicalKey, {capture: true});
    this.keyboard?.destroy();
    this.keyboard = undefined;
  },
  methods: {
    /** Build the simple-keyboard layout object from the user's resolved layouts. */
    buildLayout(): Record<string, Array<string>> {
      // The {lang} key is only meaningful when >1 layout is offered.
      const fnDefault = (this.multiLang ? '{lang} ' : '') + '- {space} {done}';
      const fnShift = (this.multiLang ? '{lang} ' : '') + '_ {space} {done}';
      const obj: Record<string, Array<string>> = {};
      for (const l of this.layouts) {
        obj[l.id] = [...l.rows, fnDefault];
        obj[l.id + 'Shift'] = [...l.shiftRows, fnShift];
      }
      return obj;
    },
    displayMap(): Record<string, string> {
      const next = this.layouts[(this.layoutIndex + 1) % this.layouts.length];
      return {
        '{bksp}': '⌫',
        '{shift}': '⇧',
        '{space}': $t('Space bar'),
        '{lang}': next.code,
        '{done}': '✓ ' + $t('Done'),
      };
    },
    // ── Host-routed pad intents ────────────────────────────────────────
    handleIntent(intent: GamepadIntent): boolean {
      if (intent.kind === 'nav') {
        this.moveCursor(intent.dir);
        return true;
      }
      if (intent.kind !== 'press') {
        return true;
      }
      switch (intent.button) {
      case 'confirm': this.pressCursored(); return true;
      case 'secondary': this.press('{bksp}'); return true; // X — backspace
      case 'inspect': this.toggleLang(); return true; // Y — input language
      case 'bumperL': this.toggleShift(); return true; // LB — shift
      case 'bumperR': this.press('{space}'); return true; // RB — space
      case 'back': this.$emit('cancel'); return true; // B — cancel
      default: return true;
      }
    },
    // ── Key grid + cursor ──────────────────────────────────────────────
    recollect(): void {
      const root = this.$refs.kb as HTMLElement | undefined;
      if (root === undefined) {
        this.keyGrid = [];
        return;
      }
      this.keyGrid = Array.from(root.querySelectorAll<HTMLElement>('.hg-row'))
        .map((row) => Array.from(row.querySelectorAll<HTMLElement>('.hg-button')));
    },
    moveCursor(dir: NavDirection): void {
      if (dir === 'left') {
        this.moveTo(this.cursorRow, this.cursorCol - 1);
      } else if (dir === 'right') {
        this.moveTo(this.cursorRow, this.cursorCol + 1);
      } else if (dir === 'up') {
        this.moveTo(this.cursorRow - 1, this.cursorCol);
      } else if (dir === 'down') {
        this.moveTo(this.cursorRow + 1, this.cursorCol);
      }
    },
    moveTo(row: number, col: number): void {
      const rows = this.keyGrid;
      if (rows.length === 0) {
        return;
      }
      const r = Math.min(Math.max(0, row), rows.length - 1);
      const c = Math.min(Math.max(0, col), rows[r].length - 1);
      this.cursorRow = r;
      this.cursorCol = c;
      this.paintCursor();
    },
    paintCursor(): void {
      for (const row of this.keyGrid) {
        for (const key of row) {
          key.classList.remove('cm-vk__key--cursor');
        }
      }
      this.keyGrid[this.cursorRow]?.[this.cursorCol]?.classList.add('cm-vk__key--cursor');
    },
    pressCursored(): void {
      const el = this.keyGrid[this.cursorRow]?.[this.cursorCol];
      const name = el?.getAttribute('data-skbtn');
      if (name !== null && name !== undefined) {
        this.press(name);
      }
    },
    press(button: string): void {
      this.keyboard?.handleButtonClicked(button);
    },
    // ── Library callbacks ──────────────────────────────────────────────
    onChange(input: string): void {
      this.value = input;
      this.$emit('update', input);
    },
    onKeyPress(button: string): void {
      if (button === '{lang}') {
        this.toggleLang();
      } else if (button === '{shift}') {
        this.toggleShift();
      } else if (button === '{done}') {
        this.$emit('commit', this.value);
      }
      // Plain chars + {bksp}/{space} are applied by simple-keyboard → onChange.
    },
    // ── Layout switching ───────────────────────────────────────────────
    toggleShift(): void {
      this.shift = !this.shift;
      this.applyLayout();
    },
    toggleLang(): void {
      if (!this.multiLang) {
        return; // Only one layout offered — nothing to cycle.
      }
      this.layoutIndex = (this.layoutIndex + 1) % this.layouts.length;
      this.applyLayout();
    },
    applyLayout(): void {
      this.keyboard?.setOptions({layoutName: this.layoutName, display: this.displayMap()});
      // Re-render swaps the DOM — re-collect the grid and keep the cursor sane.
      void this.$nextTick(() => {
        this.recollect();
        this.moveTo(this.cursorRow, this.cursorCol);
      });
    },
    // ── Physical keyboard (desktop convenience; Deck is pad-only) ───────
    onPhysicalKey(e: KeyboardEvent): void {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.$emit('commit', this.value);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        this.$emit('cancel');
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        this.press('{bksp}');
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        this.press(e.key);
      }
    },
  },
});
</script>
