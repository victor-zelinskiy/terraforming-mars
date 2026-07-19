<template>
  <div class="cm-overlay" role="dialog" :aria-label="$t('Player profile')">
    <div class="cm-overlay__card">
      <div class="cm-overlay__title">{{ $t('Player profile') }}</div>
      <div class="cm-overlay__body cm-overlay__body--dim">{{ $t('Your name and cube colour prefill every party you create or join.') }}</div>

      <div class="cm-fields">
        <!-- Name — edited through the on-screen keyboard (never the device kb). -->
        <div class="cm-field" :class="{'cm-field--cursor': cursor === 0}" @mousemove="cursor = 0" @click="cursor = 0; startNameEntry()">
          <span class="cm-field__label">{{ $t('Player name') }}</span>
          <span class="cm-field__value">
            <span :class="{'cm-field__missing': draftName === ''}">{{ draftName !== '' ? draftName : $t('Set your name') }}</span>
            <span class="cm-field__hint" aria-hidden="true"><GamepadGlyph control="confirm" />{{ $t('Change') }}</span>
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

        <!-- Friends — a primitive local list for quick picks when inviting. -->
        <div class="cm-field" :class="{'cm-field--cursor': cursor === 2}" @mousemove="cursor = 2" @click="cursor = 2; $emit('manage-friends')">
          <span class="cm-field__label">{{ $t('Friends') }}</span>
          <span class="cm-field__value">
            <span :class="{'cm-field__missing': friendCount === 0}">{{ friendCount > 0 ? friendCount : '—' }}</span>
            <span class="cm-field__hint" aria-hidden="true"><GamepadGlyph control="confirm" />{{ $t('Manage') }}</span>
          </span>
        </div>
      </div>

      <div class="cm-overlay__foot">
        <span class="cm-overlay__foot-hint"><GamepadGlyph control="back" />{{ $t('Close') }}</span>
      </div>
    </div>

    <ConsoleVirtualKeyboard
      v-if="entering"
      ref="vkeyboard"
      :initial="entryDraft"
      :title="'Player name'"
      :issue="nameIssue"
      @update="entryDraft = $event"
      @commit="commitNameEntry"
      @cancel="cancelNameEntry"
    />
  </div>
</template>

<script lang="ts">
/**
 * Console-native PROFILE editor (name + cube colour) — the pre-game identity
 * without the desktop DOM-focus modal. Two fields under a screen-state
 * cursor; the NAME field opens the premium on-screen keyboard
 * (ConsoleVirtualKeyboard) — the console flow never falls back to the device
 * keyboard. Colour cycles with ◄ ► (or A). Every valid change persists
 * immediately via setIdentity — B just closes.
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
import {friendsState, ensureFriendsLoaded} from '@/client/components/mainMenu/friendsState';
import {validatePlayerName} from '@/common/utils/playerName';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleVirtualKeyboard from '@/client/components/console/menu/ConsoleVirtualKeyboard.vue';

export default defineComponent({
  name: 'ConsoleProfileEditor',
  components: {GamepadGlyph, ConsoleVirtualKeyboard},
  emits: ['close', 'manage-friends'],
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
    friendCount(): number {
      return friendsState.friends.length;
    },
  },
  created() {
    ensureFriendsLoaded();
  },
  beforeUnmount() {
    menuPadState.textEntry = false;
  },
  methods: {
    /** Host-routed pad intents. Returns true when consumed. */
    handleIntent(intent: GamepadIntent): boolean {
      if (this.entering) {
        // The on-screen keyboard owns every intent while name entry is active.
        const vk = this.$refs.vkeyboard as {handleIntent?: (i: GamepadIntent) => boolean} | undefined;
        return vk?.handleIntent?.(intent) ?? true;
      }
      if (intent.kind === 'nav') {
        if (intent.dir === 'up' || intent.dir === 'down') {
          this.cursor = Math.min(2, Math.max(0, this.cursor + (intent.dir === 'down' ? 1 : -1)));
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
        } else if (this.cursor === 1) {
          this.cycleColor(1);
        } else {
          this.$emit('manage-friends');
        }
        return true;
      }
      return false; // B falls through to the host (close).
    },
    startNameEntry(): void {
      this.entryDraft = this.draftName;
      this.nameIssue = '';
      // Silence the console key bridge — the on-screen keyboard owns input.
      menuPadState.textEntry = true;
      this.entering = true;
    },
    commitNameEntry(value: string): void {
      const validation = validatePlayerName(value);
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
