<template>
  <div ref="root" class="cm-overlay" role="dialog" :aria-label="$t('Friends')">
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

<script setup vapor lang="ts">
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
import {computed, nextTick, onBeforeUnmount, ref, useTemplateRef} from 'vue';
import {$t} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {menuPadState} from '@/client/console/menu/consoleMenuPad';
import {friendsState, ensureFriendsLoaded, addFriend, removeFriend} from '@/client/components/mainMenu/friendsState';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsoleVirtualKeyboard from '@/client/components/console/menu/ConsoleVirtualKeyboard.vue';

defineOptions({name: 'ConsoleFriendsEditor'});
defineEmits(['close']);

const root = useTemplateRef<HTMLElement>('root');
const scroll = useTemplateRef<{ensureVisible?: (el: Element | null) => void}>('scroll');
const vkeyboard = useTemplateRef<{handleIntent?: (i: GamepadIntent) => boolean}>('vkeyboard');
const cursor = ref(0);
const entering = ref(false);
const entryDraft = ref('');
const issue = ref('');
const friends = computed((): ReadonlyArray<string> => {
  return friendsState.friends;
});

/** Host-routed pad intents. Returns true when consumed. */
function handleIntent(intent: GamepadIntent): boolean {
  if (entering.value) {
    // The on-screen keyboard owns every intent while name entry is active.
    const vk = vkeyboard.value;
    return vk?.handleIntent?.(intent) ?? true;
  }
  if (intent.kind === 'nav') {
    if (intent.dir === 'up' || intent.dir === 'down') {
      const count = friends.value.length;
      if (count > 0) {
        cursor.value = Math.min(count - 1, Math.max(0, cursor.value + (intent.dir === 'down' ? 1 : -1)));
        keepCursorVisible();
      }
    }
    return true;
  }
  const action = consoleActionOf(intent);
  if (action === 'primary') {
    startAdd();
    return true;
  }
  if (action === 'inspect') {
    removeSelected();
    return true;
  }
  return false; // B falls through to the host (close → back to profile).
}
function keepCursorVisible(): void {
  void nextTick(() => {
    const scrollNow = scroll.value;
    const rootNow = root.value;
    if (rootNow === null) {
      return;
    }
    scrollNow?.ensureVisible?.(rootNow.querySelector('.cm-field--cursor'));
  });
}
function startAdd(): void {
  entryDraft.value = '';
  issue.value = '';
  // Silence the console key bridge — the on-screen keyboard owns input.
  menuPadState.textEntry = true;
  entering.value = true;
}
function commitAdd(value: string): void {
  const result = addFriend(value);
  if (!result.ok) {
    switch (result.reason) {
    case 'empty': issue.value = 'Fill in the player name'; break;
    case 'invalid': issue.value = 'This name cannot be used'; break;
    case 'duplicate': issue.value = 'This name is already in your friends'; break;
    case 'full': issue.value = 'Your friends list is full'; break;
    }
    return;
  }
  entering.value = false;
  issue.value = '';
  menuPadState.textEntry = false;
  cursor.value = friends.value.length - 1;
  keepCursorVisible();
}
function cancelAdd(): void {
  entering.value = false;
  issue.value = '';
  menuPadState.textEntry = false;
}
function removeSelected(): void {
  if (friends.value.length > 0) {
    removeAt(cursor.value);
  }
}
function removeAt(i: number): void {
  const name = friends.value[i];
  if (name === undefined) {
    return;
  }
  removeFriend(name);
  cursor.value = Math.min(Math.max(0, friends.value.length - 1), cursor.value);
}

ensureFriendsLoaded();
onBeforeUnmount(() => {
  menuPadState.textEntry = false;
});
defineExpose({handleIntent});
</script>
