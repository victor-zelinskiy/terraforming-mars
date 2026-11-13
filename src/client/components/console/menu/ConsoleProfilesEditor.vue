<template>
  <div ref="root" class="cm-overlay cm-overlay--nested" role="dialog" :aria-label="$t('Profiles')">
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

<script setup lang="ts">
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
import {computed, nextTick, onBeforeUnmount, ref, useTemplateRef} from 'vue';
import {$t} from '@/client/directives/i18n';
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

defineOptions({name: 'ConsoleProfilesEditor'});
defineEmits(['close']);

const root = useTemplateRef<HTMLElement>('root');
const scroll = useTemplateRef<{ensureVisible?: (el: Element | null) => void}>('scroll');
const vkeyboard = useTemplateRef<{handleIntent?: (i: GamepadIntent) => boolean}>('vkeyboard');
const cursor = ref(0);
const entering = ref(false);
const entryDraft = ref('');
const issue = ref('');
const profiles = computed((): ReadonlyArray<PlayerProfile> => {
  return profilesState.profiles;
});
const activeId = computed((): string | undefined => {
  return profilesState.activeId;
});
/** True when the cursor sits on the trailing "＋ New profile" row. */
const onAddRow = computed((): boolean => {
  return cursor.value >= profiles.value.length;
});
/** A profile row is deletable only when it isn't the last remaining profile. */
const canDeleteCursor = computed((): boolean => {
  return !onAddRow.value && profiles.value.length > 1;
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
      const count = profiles.value.length + 1; // + the add-new row
      cursor.value = Math.min(count - 1, Math.max(0, cursor.value + (intent.dir === 'down' ? 1 : -1)));
      keepCursorVisible();
    }
    return true;
  }
  const action = consoleActionOf(intent);
  if (action === 'primary') {
    if (onAddRow.value) {
      startAdd();
    } else {
      useAt(cursor.value);
    }
    return true;
  }
  if (action === 'inspect') {
    // X — delete the cursored profile.
    if (!onAddRow.value) {
      removeAt(cursor.value);
    }
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
/** Switch the active profile to the one at index i (stays open so the ✓ moves). */
function useAt(i: number): void {
  const p = profiles.value[i];
  if (p === undefined) {
    return;
  }
  issue.value = '';
  setActiveProfile(p.id);
}
function removeAt(i: number): void {
  const p = profiles.value[i];
  if (p === undefined) {
    return;
  }
  const result = removeProfile(p.id);
  if (!result.ok) {
    if (result.reason === 'last') {
      issue.value = 'Can\'t delete your only profile';
    }
    return;
  }
  issue.value = '';
  cursor.value = Math.min(cursor.value, profiles.value.length); // clamp onto a valid row (incl. add-new)
}
function startAdd(): void {
  entryDraft.value = '';
  issue.value = '';
  // Silence the console key bridge — the on-screen keyboard owns input.
  menuPadState.textEntry = true;
  entering.value = true;
}
function commitAdd(value: string): void {
  const result = addProfile(value, {activate: true});
  if (!result.ok) {
    switch (result.reason) {
    case 'empty': issue.value = 'Fill in the player name'; break;
    case 'invalid': issue.value = 'This name cannot be used'; break;
    case 'duplicate': issue.value = 'This name is already used by another profile'; break;
    case 'full': issue.value = 'You have reached the maximum number of profiles'; break;
    default: issue.value = 'This name cannot be used'; break;
    }
    return;
  }
  entering.value = false;
  issue.value = '';
  menuPadState.textEntry = false;
  cursor.value = profiles.value.length - 1; // land on the freshly-added profile
  keepCursorVisible();
}
function cancelAdd(): void {
  entering.value = false;
  issue.value = '';
  menuPadState.textEntry = false;
}

ensureProfilesLoaded();
onBeforeUnmount(() => {
  menuPadState.textEntry = false;
});
defineExpose({handleIntent});
</script>
