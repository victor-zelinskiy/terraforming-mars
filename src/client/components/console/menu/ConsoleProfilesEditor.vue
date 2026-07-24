<template>
  <div class="cm-overlay cm-overlay--nested" role="dialog" :aria-label="$t('Profiles')">
    <div class="cm-overlay__card cm-overlay__card--wide">
      <div class="cm-overlay__title">{{ $t('Profiles') }}</div>
      <div class="cm-overlay__body cm-overlay__body--dim">{{ $t('Switch between your saved players, add a new one, or remove an old one.') }}</div>

      <ConsoleScrollArea ref="scroll" class="cm-friends-scroll">
        <div class="cm-fields">
          <!-- Saved profiles: A switches to it, X (inspect) deletes it. -->
          <div
            v-for="(p, i) in profiles"
            :key="p.id"
            class="cm-field cm-profile"
            :class="{'cm-field--cursor': i === cursor, 'cm-profile--active': p.id === activeId}"
            @mousemove="cursor = i"
            @click="cursor = i; useAt(i)"
          >
            <span class="cm-profile__cube" :class="'player_bg_color_' + p.cubeColor" aria-hidden="true"></span>
            <span class="cm-profile__name">{{ p.displayName }}</span>
            <span class="cm-field__value">
              <span v-if="p.id === activeId" class="cm-profile__active">✓ {{ $t('Active profile') }}</span>
              <span v-else class="cm-field__hint" aria-hidden="true"><GamepadGlyph control="confirm" />{{ $t('Select') }}</span>
              <button
                v-if="profiles.length > 1"
                type="button"
                class="cm-friend__remove"
                :aria-label="$t('Delete profile')"
                @click.stop="removeAt(i)"
              >✕</button>
            </span>
          </div>

          <!-- Add-new row — last in the cursor list (A adds through the on-screen keyboard). -->
          <div
            class="cm-field cm-profile cm-profile--add"
            :class="{'cm-field--cursor': cursor === profiles.length}"
            @mousemove="cursor = profiles.length"
            @click="cursor = profiles.length; startAdd()"
          >
            <span class="cm-profile__plus" aria-hidden="true">＋</span>
            <span class="cm-profile__name">{{ $t('New profile') }}</span>
            <span class="cm-field__value">
              <span class="cm-field__hint" aria-hidden="true"><GamepadGlyph control="confirm" />{{ $t('Add') }}</span>
            </span>
          </div>
        </div>
      </ConsoleScrollArea>

      <div v-if="issue !== ''" class="cm-field__issue">{{ $t(issue) }}</div>

      <div class="cm-overlay__foot">
        <span class="cm-overlay__foot-hint"><GamepadGlyph control="confirm" />{{ onAddRow ? $t('Add') : $t('Select') }}</span>
        <span v-if="canDeleteCursor" class="cm-overlay__foot-hint"><GamepadGlyph control="inspect" />{{ $t('Delete') }}</span>
        <span class="cm-overlay__foot-hint"><GamepadGlyph control="back" />{{ $t('Back') }}</span>
      </div>
    </div>

    <ConsoleVirtualKeyboard
      v-if="entering"
      ref="vkeyboard"
      :initial="entryDraft"
      :title="'New profile'"
      :issue="issue"
      @update="entryDraft = $event"
      @commit="commitAdd"
      @cancel="cancelAdd"
    />
  </div>
</template>

<script lang="ts">
/**
 * Console-native PROFILE MANAGER (reached from the player profile editor) — the
 * roster of saved players. A cursor runs over the saved profiles plus a trailing
 * "＋ New profile" row. A switches to the cursored profile (or adds one on the
 * last row — through the on-screen keyboard, never the device kb), X (the
 * console inspect button) deletes the cursored profile, B closes (the host
 * returns to the profile editor). Every change persists immediately via
 * profilesState, which mirrors the active profile into the shared identity.
 *
 * The host (ConsoleMainMenu) routes pad intents here via `handleIntent`.
 */
import {defineComponent} from 'vue';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {menuPadState} from '@/client/console/menu/consoleMenuPad';
import {
  profilesState,
  ensureProfilesLoaded,
  addProfile,
  removeProfile,
  setActiveProfile,
  PlayerProfile,
} from '@/client/components/mainMenu/profilesState';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsoleVirtualKeyboard from '@/client/components/console/menu/ConsoleVirtualKeyboard.vue';

export default defineComponent({
  name: 'ConsoleProfilesEditor',
  components: {GamepadGlyph, ConsoleScrollArea, ConsoleVirtualKeyboard},
  emits: ['close'],
  data() {
    return {
      cursor: 0,
      entering: false,
      entryDraft: '',
      issue: '',
    };
  },
  computed: {
    profiles(): ReadonlyArray<PlayerProfile> {
      return profilesState.profiles;
    },
    activeId(): string | undefined {
      return profilesState.activeId;
    },
    /** True when the cursor sits on the trailing "＋ New profile" row. */
    onAddRow(): boolean {
      return this.cursor >= this.profiles.length;
    },
    /** A profile row is deletable only when it isn't the last remaining profile. */
    canDeleteCursor(): boolean {
      return !this.onAddRow && this.profiles.length > 1;
    },
  },
  created() {
    ensureProfilesLoaded();
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
          const count = this.profiles.length + 1; // + the add-new row
          this.cursor = Math.min(count - 1, Math.max(0, this.cursor + (intent.dir === 'down' ? 1 : -1)));
          this.keepCursorVisible();
        }
        return true;
      }
      const action = consoleActionOf(intent);
      if (action === 'primary') {
        if (this.onAddRow) {
          this.startAdd();
        } else {
          this.useAt(this.cursor);
        }
        return true;
      }
      if (action === 'inspect') {
        // X — delete the cursored profile.
        if (!this.onAddRow) {
          this.removeAt(this.cursor);
        }
        return true;
      }
      return false; // B falls through to the host (close → back to profile).
    },
    keepCursorVisible(): void {
      void this.$nextTick(() => {
        const scroll = this.$refs.scroll as {ensureVisible?: (el: Element | null) => void} | undefined;
        scroll?.ensureVisible?.(this.$el.querySelector('.cm-field--cursor'));
      });
    },
    /** Switch the active profile to the one at index i (stays open so the ✓ moves). */
    useAt(i: number): void {
      const p = this.profiles[i];
      if (p === undefined) {
        return;
      }
      this.issue = '';
      setActiveProfile(p.id);
    },
    removeAt(i: number): void {
      const p = this.profiles[i];
      if (p === undefined) {
        return;
      }
      const result = removeProfile(p.id);
      if (!result.ok) {
        if (result.reason === 'last') {
          this.issue = 'Can\'t delete your only profile';
        }
        return;
      }
      this.issue = '';
      this.cursor = Math.min(this.cursor, this.profiles.length); // clamp onto a valid row (incl. add-new)
    },
    startAdd(): void {
      this.entryDraft = '';
      this.issue = '';
      // Silence the console key bridge — the on-screen keyboard owns input.
      menuPadState.textEntry = true;
      this.entering = true;
    },
    commitAdd(value: string): void {
      const result = addProfile(value, {activate: true});
      if (!result.ok) {
        switch (result.reason) {
        case 'empty': this.issue = 'Fill in the player name'; break;
        case 'invalid': this.issue = 'This name cannot be used'; break;
        case 'duplicate': this.issue = 'This name is already used by another profile'; break;
        case 'full': this.issue = 'You have reached the maximum number of profiles'; break;
        default: this.issue = 'This name cannot be used'; break;
        }
        return;
      }
      this.entering = false;
      this.issue = '';
      menuPadState.textEntry = false;
      this.cursor = this.profiles.length - 1; // land on the freshly-added profile
      this.keepCursorVisible();
    },
    cancelAdd(): void {
      this.entering = false;
      this.issue = '';
      menuPadState.textEntry = false;
    },
  },
});
</script>
