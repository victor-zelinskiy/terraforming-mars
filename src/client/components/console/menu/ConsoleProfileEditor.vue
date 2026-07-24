<template>
  <div class="cm-overlay" role="dialog" :aria-label="$t('Player profile')">
    <div class="cm-overlay__card">
      <div class="cm-overlay__title">{{ $t('Player profile') }}</div>
      <div class="cm-overlay__body cm-overlay__body--dim">{{ $t('Your name and cube colour prefill every party you create or join.') }}</div>

      <div class="cm-fields">
        <!-- Profiles — switch the active player (◄ ►) or open the roster to add/remove. -->
        <div class="cm-field" :class="{'cm-field--cursor': cursor === 0}" @mousemove="cursor = 0" @click="cursor = 0; $emit('manage-profiles')">
          <span class="cm-field__label">{{ $t('Profiles') }}</span>
          <span class="cm-field__value cm-field__value--stepper">
            <button v-if="profileCount > 1" type="button" class="cm-field__arrow" :aria-label="$t('Select')" @click.stop="cursor = 0; cycleActive(-1)">◄</button>
            <span :class="{'cm-field__missing': activeName === ''}">{{ activeName !== '' ? activeName : $t('Set your name') }}</span>
            <button v-if="profileCount > 1" type="button" class="cm-field__arrow" :aria-label="$t('Select')" @click.stop="cursor = 0; cycleActive(1)">►</button>
            <span class="cm-field__hint" aria-hidden="true"><GamepadGlyph control="confirm" />{{ $t('Manage') }}</span>
          </span>
        </div>

        <!-- Name — edits the ACTIVE profile through the on-screen keyboard (never the device kb). -->
        <div class="cm-field" :class="{'cm-field--cursor': cursor === 1}" @mousemove="cursor = 1" @click="cursor = 1; startNameEntry()">
          <span class="cm-field__label">{{ $t('Player name') }}</span>
          <span class="cm-field__value">
            <span :class="{'cm-field__missing': activeName === ''}">{{ activeName !== '' ? activeName : $t('Set your name') }}</span>
            <span class="cm-field__hint" aria-hidden="true"><GamepadGlyph control="confirm" />{{ $t('Change') }}</span>
          </span>
        </div>
        <div v-if="nameIssue !== ''" class="cm-field__issue">{{ $t(nameIssue) }}</div>

        <!-- Colour — of the active profile -->
        <div class="cm-field" :class="{'cm-field--cursor': cursor === 2}" @mousemove="cursor = 2">
          <span class="cm-field__label">{{ $t('Player color') }}</span>
          <span class="cm-field__value cm-field__value--cubes">
            <button
              v-for="c in colors"
              :key="c"
              type="button"
              class="cm-cube"
              :class="['player_bg_color_' + c, {'cm-cube--selected': c === activeColor}]"
              :aria-label="c"
              @click="cursor = 2; pickColor(c)"
            ></button>
          </span>
        </div>

        <!-- Friends — a primitive local list for quick picks when inviting. -->
        <div class="cm-field" :class="{'cm-field--cursor': cursor === 3}" @mousemove="cursor = 3" @click="cursor = 3; $emit('manage-friends')">
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
 * without the desktop DOM-focus modal. Four fields under a screen-state cursor:
 *
 *  0. PROFILES — the active player. ◄ ► quick-switch between saved profiles
 *     (the whole point: jump back to a previous player without re-typing);
 *     A opens the roster (ConsoleProfilesEditor) to add / remove profiles.
 *  1. NAME — edits the ACTIVE profile's name via the premium on-screen keyboard
 *     (ConsoleVirtualKeyboard) — the console flow never falls back to the
 *     device keyboard. When no profile exists yet, committing a name CREATES
 *     the first profile.
 *  2. COLOUR — the active profile's cube colour, cycles with ◄ ► (or A).
 *  3. FRIENDS — opens the friends quick-pick list.
 *
 * Every valid change persists immediately through profilesState (which mirrors
 * the active profile into the shared identity every other screen reads) — B
 * just closes. The host routes pad intents here via `handleIntent`.
 */
import {defineComponent} from 'vue';
import {Color, PLAYER_COLORS} from '@/common/Color';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {menuPadState} from '@/client/console/menu/consoleMenuPad';
import {DEFAULT_IDENTITY_COLOR} from '@/client/components/mainMenu/identity/playerIdentity';
import {
  profilesState,
  ensureProfilesLoaded,
  activeProfile,
  addProfile,
  renameProfile,
  setProfileColor,
  setActiveProfile,
} from '@/client/components/mainMenu/profilesState';
import {friendsState, ensureFriendsLoaded} from '@/client/components/mainMenu/friendsState';
import {validatePlayerName} from '@/common/utils/playerName';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleVirtualKeyboard from '@/client/components/console/menu/ConsoleVirtualKeyboard.vue';

export default defineComponent({
  name: 'ConsoleProfileEditor',
  components: {GamepadGlyph, ConsoleVirtualKeyboard},
  emits: ['close', 'manage-friends', 'manage-profiles'],
  data() {
    return {
      cursor: 0,
      entering: false,
      entryDraft: '',
      nameIssue: '',
    };
  },
  computed: {
    colors(): ReadonlyArray<Color> {
      return PLAYER_COLORS;
    },
    activeName(): string {
      return activeProfile()?.displayName ?? '';
    },
    activeColor(): Color {
      return activeProfile()?.cubeColor ?? DEFAULT_IDENTITY_COLOR;
    },
    profileCount(): number {
      return profilesState.profiles.length;
    },
    friendCount(): number {
      return friendsState.friends.length;
    },
  },
  created() {
    ensureProfilesLoaded();
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
          this.cursor = Math.min(3, Math.max(0, this.cursor + (intent.dir === 'down' ? 1 : -1)));
          return true;
        }
        if (intent.dir === 'left' || intent.dir === 'right') {
          const step = intent.dir === 'right' ? 1 : -1;
          if (this.cursor === 0) {
            this.cycleActive(step);
          } else if (this.cursor === 2) {
            this.cycleColor(step);
          }
          return true;
        }
        return true;
      }
      if (consoleActionOf(intent) === 'primary') {
        if (this.cursor === 0) {
          this.$emit('manage-profiles');
        } else if (this.cursor === 1) {
          this.startNameEntry();
        } else if (this.cursor === 2) {
          this.cycleColor(1);
        } else {
          this.$emit('manage-friends');
        }
        return true;
      }
      return false; // B falls through to the host (close).
    },
    /** Switch the active profile among the saved roster (◄ ► on the Profiles field). */
    cycleActive(step: 1 | -1): void {
      const list = profilesState.profiles;
      if (list.length < 2) {
        return;
      }
      let idx = list.findIndex((p) => p.id === profilesState.activeId);
      if (idx < 0) {
        idx = 0;
      }
      const next = list[(idx + step + list.length) % list.length];
      setActiveProfile(next.id);
    },
    startNameEntry(): void {
      this.entryDraft = this.activeName;
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
      const active = activeProfile();
      // Editing the active profile → rename; no profile yet → create the first one.
      const result = active !== undefined ?
        renameProfile(active.id, validation.displayName) :
        addProfile(validation.displayName, {activate: true});
      if (!result.ok) {
        this.nameIssue = result.reason === 'duplicate' ? 'This name is already used by another profile' : 'This name cannot be used';
        return;
      }
      this.entering = false;
      this.nameIssue = '';
      menuPadState.textEntry = false;
    },
    cancelNameEntry(): void {
      this.entering = false;
      this.nameIssue = '';
      menuPadState.textEntry = false;
    },
    cycleColor(step: 1 | -1): void {
      const active = activeProfile();
      if (active === undefined) {
        return; // no profile to colour yet — set a name first
      }
      const ring: ReadonlyArray<Color> = PLAYER_COLORS;
      const idx = ring.indexOf(active.cubeColor);
      const next = ring[(idx + step + ring.length) % ring.length];
      setProfileColor(active.id, next);
    },
    pickColor(c: Color): void {
      const active = activeProfile();
      if (active !== undefined) {
        setProfileColor(active.id, c);
      }
    },
  },
});
</script>
