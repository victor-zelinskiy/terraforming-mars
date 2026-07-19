<template>
  <div class="cm-overlay" role="dialog" :aria-label="$t('Friends')">
    <div class="cm-overlay__card cm-overlay__card--wide">
      <div class="cm-overlay__title">{{ $t('Friends') }}</div>
      <div class="cm-overlay__body cm-overlay__body--dim">{{ $t("Add friends' names for quick selection when inviting them to a game.") }}</div>

      <div v-if="friends.length === 0" class="cm-friends__empty">{{ $t('You have no friends yet.') }}</div>
      <ConsoleScrollArea v-else ref="scroll" class="cm-friends-scroll">
        <div class="cm-fields">
          <div
            v-for="(name, i) in friends"
            :key="name"
            class="cm-field cm-friend"
            :class="{'cm-field--cursor': i === cursor}"
            @mousemove="cursor = i"
          >
            <span class="cm-friend__name">{{ name }}</span>
            <span class="cm-field__value">
              <button type="button" class="cm-friend__remove" :aria-label="$t('Remove')" @click.stop="removeAt(i)">✕</button>
            </span>
          </div>
        </div>
      </ConsoleScrollArea>

      <div class="cm-friends__foot">
        <button type="button" class="cm-confirm__btn" @click="startAdd">
          <GamepadGlyph control="confirm" /><span>{{ $t('Add friend') }}</span>
        </button>
      </div>

      <div v-if="issue !== ''" class="cm-field__issue">{{ $t(issue) }}</div>

      <div class="cm-overlay__foot">
        <span class="cm-overlay__foot-hint"><GamepadGlyph control="confirm" />{{ $t('Add friend') }}</span>
        <span v-if="friends.length > 0" class="cm-overlay__foot-hint"><GamepadGlyph control="inspect" />{{ $t('Remove') }}</span>
        <span class="cm-overlay__foot-hint"><GamepadGlyph control="back" />{{ $t('Close') }}</span>
      </div>
    </div>

    <ConsoleVirtualKeyboard
      v-if="entering"
      ref="vkeyboard"
      :initial="entryDraft"
      :title="'Friend name'"
      :issue="issue"
      @update="entryDraft = $event"
      @commit="commitAdd"
      @cancel="cancelAdd"
    />
  </div>
</template>

<script lang="ts">
/**
 * Console-native FRIENDS editor (reached from the player profile) — the
 * primitive local list of remembered names offered as quick picks when
 * inviting participants to a new game. A cursor over the friend rows; A adds a
 * name (through the on-screen keyboard — never the device kb), Y removes the
 * one under the cursor, B closes (the host returns to the profile). Every
 * change persists immediately via friendsState (case-insensitive de-dup).
 *
 * The host (ConsoleMainMenu) routes pad intents here via `handleIntent`.
 */
import {defineComponent} from 'vue';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {menuPadState} from '@/client/console/menu/consoleMenuPad';
import {friendsState, ensureFriendsLoaded, addFriend, removeFriend} from '@/client/components/mainMenu/friendsState';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsoleVirtualKeyboard from '@/client/components/console/menu/ConsoleVirtualKeyboard.vue';

export default defineComponent({
  name: 'ConsoleFriendsEditor',
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
    friends(): ReadonlyArray<string> {
      return friendsState.friends;
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
          const count = this.friends.length;
          if (count > 0) {
            this.cursor = Math.min(count - 1, Math.max(0, this.cursor + (intent.dir === 'down' ? 1 : -1)));
            this.keepCursorVisible();
          }
        }
        return true;
      }
      const action = consoleActionOf(intent);
      if (action === 'primary') {
        this.startAdd();
        return true;
      }
      if (action === 'inspect') {
        this.removeSelected();
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
    startAdd(): void {
      this.entryDraft = '';
      this.issue = '';
      // Silence the console key bridge — the on-screen keyboard owns input.
      menuPadState.textEntry = true;
      this.entering = true;
    },
    commitAdd(value: string): void {
      const result = addFriend(value);
      if (!result.ok) {
        switch (result.reason) {
        case 'empty': this.issue = 'Fill in the player name'; break;
        case 'invalid': this.issue = 'This name cannot be used'; break;
        case 'duplicate': this.issue = 'This name is already in your friends'; break;
        case 'full': this.issue = 'Your friends list is full'; break;
        }
        return;
      }
      this.entering = false;
      this.issue = '';
      menuPadState.textEntry = false;
      this.cursor = this.friends.length - 1;
      this.keepCursorVisible();
    },
    cancelAdd(): void {
      this.entering = false;
      this.issue = '';
      menuPadState.textEntry = false;
    },
    removeSelected(): void {
      if (this.friends.length > 0) {
        this.removeAt(this.cursor);
      }
    },
    removeAt(i: number): void {
      const name = this.friends[i];
      if (name === undefined) {
        return;
      }
      removeFriend(name);
      this.cursor = Math.min(Math.max(0, this.friends.length - 1), this.cursor);
    },
  },
});
</script>
