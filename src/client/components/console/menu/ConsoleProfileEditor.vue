<template>
  <div class="cm-overlay" role="dialog" :aria-label="$t('Player profile')">
    <div class="cm-overlay__card">
      <div class="cm-overlay__title">{{ $t('Player profile') }}</div>
      <div class="cm-overlay__body cm-overlay__body--dim">{{ $t('Your name and cube colour prefill every party you create or join.') }}</div>

      <div class="cm-fields">
        <!-- Name -->
        <div class="cm-field" :class="{'cm-field--cursor': cursor === 0}" @mousemove="cursor = 0" @click="cursor = 0; startNameEntry()">
          <span class="cm-field__label">{{ $t('Player name') }}</span>
          <span v-if="!entering" class="cm-field__value">
            <span :class="{'cm-field__missing': draftName === ''}">{{ draftName !== '' ? draftName : $t('Set your name') }}</span>
            <span class="cm-field__hint" aria-hidden="true"><GamepadGlyph control="confirm" />{{ $t('Change') }}</span>
          </span>
          <span v-else class="cm-field__value cm-field__value--entry">
            <input
              ref="nameInput"
              v-model="entryDraft"
              class="cm-field__input"
              type="text"
              maxlength="32"
              :placeholder="$t('Enter a player name')"
              @keydown.enter.prevent="commitNameEntry"
              @keydown.esc.prevent="cancelNameEntry"
            />
          </span>
        </div>
        <div v-if="nameIssue !== ''" class="cm-field__issue">{{ $t(nameIssue) }}</div>

        <!-- Colour -->
        <div class="cm-field" :class="{'cm-field--cursor': cursor === 1}" @mousemove="cursor = 1">
          <span class="cm-field__label">{{ $t('Player color') }}</span>
          <span class="cm-field__value cm-field__value--cubes">
            <button
              v-for="c in colors"
              :key="c"
              type="button"
              class="cm-cube"
              :class="['player_bg_color_' + c, {'cm-cube--selected': c === draftColor}]"
              :aria-label="c"
              @click="cursor = 1; pickColor(c)"
            ></button>
          </span>
        </div>
      </div>

      <div class="cm-overlay__foot">
        <span class="cm-overlay__foot-hint"><GamepadGlyph control="back" />{{ $t('Close') }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * Console-native PROFILE editor (name + cube colour) — the pre-game identity
 * without the desktop DOM-focus modal. Two fields under a screen-state
 * cursor; the NAME field is the sanctioned text-entry fallback: A opens the
 * input (menuPadState.textEntry arms — the physical keyboard belongs to the
 * input), Enter/A commits, Esc/B cancels. Colour cycles with ◄ ► (or A).
 * Every valid change persists immediately via setIdentity — B just closes.
 *
 * The host routes pad intents here via `handleIntent` (public method).
 */
import {defineComponent} from 'vue';
import {Color, PLAYER_COLORS} from '@/common/Color';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {menuPadState} from '@/client/console/menu/consoleMenuPad';
import {identityState, setIdentity} from '@/client/components/mainMenu/identity/identityState';
import {DEFAULT_IDENTITY_COLOR} from '@/client/components/mainMenu/identity/playerIdentity';
import {validatePlayerName} from '@/common/utils/playerName';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

export default defineComponent({
  name: 'ConsoleProfileEditor',
  components: {GamepadGlyph},
  emits: ['close'],
  data() {
    return {
      cursor: 0,
      entering: false,
      entryDraft: '',
      draftName: identityState.identity?.displayName ?? '',
      draftColor: (identityState.identity?.cubeColor ?? DEFAULT_IDENTITY_COLOR) as Color,
      nameIssue: '',
    };
  },
  computed: {
    colors(): ReadonlyArray<Color> {
      return PLAYER_COLORS;
    },
  },
  beforeUnmount() {
    menuPadState.textEntry = false;
  },
  methods: {
    /** Host-routed pad intents. Returns true when consumed. */
    handleIntent(intent: GamepadIntent): boolean {
      if (this.entering) {
        if (consoleActionOf(intent) === 'primary') {
          this.commitNameEntry();
          return true;
        }
        if (consoleActionOf(intent) === 'back') {
          this.cancelNameEntry();
          return true;
        }
        return true; // The input owns everything else while entering.
      }
      if (intent.kind === 'nav') {
        if (intent.dir === 'up' || intent.dir === 'down') {
          this.cursor = this.cursor === 0 ? 1 : 0;
          return true;
        }
        if (this.cursor === 1 && (intent.dir === 'left' || intent.dir === 'right')) {
          this.cycleColor(intent.dir === 'right' ? 1 : -1);
          return true;
        }
        return true;
      }
      if (consoleActionOf(intent) === 'primary') {
        if (this.cursor === 0) {
          this.startNameEntry();
        } else {
          this.cycleColor(1);
        }
        return true;
      }
      return false; // B falls through to the host (close).
    },
    startNameEntry(): void {
      this.entering = true;
      this.entryDraft = this.draftName;
      this.nameIssue = '';
      menuPadState.textEntry = true;
      void this.$nextTick(() => (this.$refs.nameInput as HTMLInputElement | undefined)?.focus());
    },
    commitNameEntry(): void {
      const validation = validatePlayerName(this.entryDraft);
      if (!validation.ok) {
        this.nameIssue = validation.reason === 'empty' ? 'Fill in the player name' : 'This name cannot be used';
        return;
      }
      this.draftName = validation.displayName;
      this.entering = false;
      this.nameIssue = '';
      menuPadState.textEntry = false;
      this.persist();
    },
    cancelNameEntry(): void {
      this.entering = false;
      this.nameIssue = '';
      menuPadState.textEntry = false;
    },
    cycleColor(step: 1 | -1): void {
      const ring: ReadonlyArray<Color> = PLAYER_COLORS;
      const idx = ring.indexOf(this.draftColor);
      this.draftColor = ring[(idx + step + ring.length) % ring.length];
      this.persist();
    },
    pickColor(c: Color): void {
      this.draftColor = c;
      this.persist();
    },
    persist(): void {
      if (this.draftName !== '') {
        setIdentity(this.draftName, this.draftColor);
      }
    },
  },
});
</script>
