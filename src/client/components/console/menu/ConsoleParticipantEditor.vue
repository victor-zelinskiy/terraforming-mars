<template>
  <div ref="root" class="cm-overlay" role="dialog" :aria-label="$t('Participant')">
    <div class="cm-overlay__card">
      <div class="cm-overlay__title cm-editor__head">
        <template v-if="target.kind === 'human'">
          <span class="cm-editor__cube" :class="'player_bg_color_' + slotColor" aria-hidden="true"></span>
          <span>{{ headName }}</span>
          <span v-if="target.kind === 'human' && target.index === 0" class="cm-row__tag cm-row__tag--creator">{{ $t('Creator') }}</span>
        </template>
        <template v-else>
          <span class="cm-editor__cube cm-editor__cube--bot" aria-hidden="true">⚙</span>
          <span>{{ $t('MarsBot') }}</span>
          <span class="cm-row__tag cm-row__tag--bot">{{ $t('Automa') }}</span>
        </template>
      </div>

      <div class="cm-fields">
        <div
          v-for="(field, i) in fields"
          :key="field.id"
          class="cm-field"
          :class="{'cm-field--cursor': i === cursor, 'cm-field--danger': field.danger === true}"
          @mousemove="$emit('cursor', i)"
          @click="onFieldClick(i)"
        >
          <span class="cm-field__label">{{ $t(field.labelKey) }}</span>

          <!-- Name — edited through the on-screen keyboard (never the device kb). -->
          <template v-if="field.id === 'name'">
            <span class="cm-field__value">
              <span :class="{'cm-field__missing': currentName === ''}">{{ currentName !== '' ? currentName : $t('Name not set') }}</span>
              <span class="cm-field__hint" aria-hidden="true"><GamepadGlyph control="confirm" />{{ $t('Change') }}</span>
            </span>
          </template>

          <!-- Colour -->
          <template v-else-if="field.id === 'color'">
            <span class="cm-field__value cm-field__value--cubes">
              <button
                v-for="c in colors"
                :key="c"
                type="button"
                class="cm-cube"
                :class="['player_bg_color_' + c, {'cm-cube--selected': c === slotColor, 'cm-cube--taken': takenBy(c)}]"
                :aria-label="c"
                @click.stop="pickColor(c)"
              ></button>
            </span>
          </template>

          <!-- TR boost -->
          <template v-else-if="field.id === 'trBoost'">
            <span class="cm-field__value cm-field__value--stepper">
              <span class="cm-field__arrow" aria-hidden="true">◄</span>
              <span class="cm-field__stepval">+{{ trBoost }}</span>
              <span class="cm-field__arrow" aria-hidden="true">►</span>
              <span class="cm-field__gauge" aria-hidden="true">
                <span v-for="n in 10" :key="n" class="cm-field__gauge-seg" :class="{'cm-field__gauge-seg--on': n <= trBoost}"></span>
              </span>
            </span>
          </template>

          <!-- Bot difficulty -->
          <template v-else-if="field.id === 'difficulty'">
            <span class="cm-field__value cm-field__value--stepper">
              <span class="cm-field__arrow" aria-hidden="true">◄</span>
              <span class="cm-field__stepval">{{ $t(difficultyLabel) }}</span>
              <span class="cm-field__arrow" aria-hidden="true">►</span>
            </span>
          </template>

          <!-- «Динамический баланс» (option key `secondShift`) — the switch beside the difficulty; its reading stands on the note below -->
          <template v-else-if="field.id === 'secondShift'">
            <span class="cm-field__value cm-field__value--stepper" data-field="secondShift">
              <span class="cm-field__arrow" aria-hidden="true">◄</span>
              <span class="cm-field__stepval">{{ $t(secondShiftOn ? 'On' : 'Off') }}</span>
              <span class="cm-field__arrow" aria-hidden="true">►</span>
            </span>
          </template>

          <!-- «Дополнительные корпорации бота» (option `extraCorporations`) — the fork's own CF series in the bot's pool -->
          <template v-else-if="field.id === 'extraCorporations'">
            <span class="cm-field__value cm-field__value--stepper" data-field="extraCorporations">
              <span class="cm-field__arrow" aria-hidden="true">◄</span>
              <span class="cm-field__stepval">{{ $t(extraCorporationsOn ? 'On' : 'Off') }}</span>
              <span class="cm-field__arrow" aria-hidden="true">►</span>
            </span>
          </template>

          <!-- Remove -->
          <template v-else-if="field.id === 'remove'">
            <span class="cm-field__value cm-field__value--danger">
              <span class="cm-field__hint" aria-hidden="true"><GamepadGlyph control="confirm" />{{ $t('Remove') }}</span>
            </span>
          </template>
        </div>

        <div v-if="nameIssue !== ''" class="cm-field__issue">{{ $t(nameIssue) }}</div>
        <div v-if="target.kind === 'bot'" class="cm-editor__note">{{ $t(difficultyDesc) }}</div>
        <div v-if="target.kind === 'bot'" class="cm-editor__note" data-second-shift-note>{{ $t(secondShiftDesc) }}</div>
        <div v-if="target.kind === 'bot'" class="cm-editor__note" data-extra-corporations-note>{{ $t(extraCorporationsDesc) }}</div>
        <div v-if="target.kind === 'bot'" class="cm-editor__note cm-editor__note--dim">{{ $t('The cube colour is assigned automatically at game start.') }}</div>
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

    <!-- Quick-pick a saved friend for this seat (or fall back to typing). -->
    <div v-if="pickingFriend" class="cm-overlay cm-overlay--nested" role="dialog" :aria-label="$t('Choose a friend')">
      <div class="cm-overlay__card cm-overlay__card--wide">
        <div class="cm-overlay__title">{{ $t('Choose a friend') }}</div>
        <ConsoleScrollArea ref="friendScroll" class="cm-friends-scroll">
          <div class="cm-fields">
            <div
              v-for="(row, i) in friendPickRows"
              :key="row.kind === 'type' ? '__type' : row.name"
              class="cm-field"
              :class="{'cm-field--cursor': i === friendCursor, 'cm-field--disabled': row.kind === 'friend' && row.seated}"
              @mousemove="friendCursor = i"
              @click="chooseFriendRow(i)"
            >
              <span class="cm-friend__name">{{ row.kind === 'type' ? $t('Type a new name') : row.name }}</span>
              <span class="cm-field__value">
                <span v-if="row.kind === 'friend' && row.seated" class="cm-field__missing">{{ $t('Already in the party') }}</span>
                <span v-else class="cm-field__hint" aria-hidden="true"><GamepadGlyph control="confirm" /></span>
              </span>
            </div>
          </div>
        </ConsoleScrollArea>
        <div class="cm-overlay__foot">
          <span class="cm-overlay__foot-hint"><GamepadGlyph control="confirm" />{{ $t('Select') }}</span>
          <span class="cm-overlay__foot-hint"><GamepadGlyph control="back" />{{ $t('Cancel') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup vapor lang="ts">
/**
 * Console-native PARTICIPANT editor (create screen) — one overlay per crew
 * member: name (the sanctioned text-entry fallback), cube colour (◄ ► cycles
 * with the shared swap logic), starting TR bonus (when the rule is on), bot
 * difficulty, and the danger REMOVE row (routed to the root's confirm).
 *
 * Presentation + field-local entry only: the field cursor lives in the
 * screen model (`consoleCreateUi.overlay`), intents are routed here via
 * `handleIntent` from the screen root.
 */
import {computed, nextTick, onBeforeUnmount, PropType, ref, useTemplateRef} from 'vue';
import {Color, PLAYER_COLORS} from '@/common/Color';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {menuPadState} from '@/client/console/menu/consoleMenuPad';
import {
  EditorField,
  EditorTarget,
  editorAdjust,
  editorFields,
} from '@/client/console/menu/consoleCreateModel';
import {createGameState, setSlotColor, setSlotName} from '@/client/components/create/premium/createGameState';
import {botDifficultyMeta} from '@/client/components/create/premium/createGameMeta';
import {friendsState, ensureFriendsLoaded} from '@/client/components/mainMenu/friendsState';
import {normalizePlayerName, validatePlayerName} from '@/common/utils/playerName';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsoleVirtualKeyboard from '@/client/components/console/menu/ConsoleVirtualKeyboard.vue';
import {$t} from '@/client/directives/i18n';

/** A row of the friend quick-pick: a saved friend, or the "type a name" escape. */
type FriendPickRow = {kind: 'friend', name: string, seated: boolean} | {kind: 'type'};

/** «Динамический баланс» on the editor's note — HIDDEN balance: the rule is named, its numbers never are (the owner, 2026-10-28/29); every difficulty has it. */
const SECOND_SHIFT_DESC_ON = 'Dynamic balance: MarsBot stays in the round longer when a long game drags on. How much depends on the difficulty.';

defineOptions({name: 'ConsoleParticipantEditor'});
const props = defineProps({
  target: {type: Object as PropType<EditorTarget>, required: true},
  cursor: {type: Number, required: true},
});
const emit = defineEmits(['close', 'remove-request', 'cursor']);

const vkeyboard = useTemplateRef<{handleIntent?: (i: GamepadIntent) => boolean}>('vkeyboard');
const friendScroll = useTemplateRef<{ensureVisible?: (el: Element | null) => void}>('friendScroll');
const root = useTemplateRef<HTMLElement>('root');
const entering = ref(false);
const entryDraft = ref('');
const nameIssue = ref('');
const pickingFriend = ref(false);
const friendCursor = ref(0);

const fields = computed((): ReadonlyArray<EditorField> => {
  return editorFields(props.target);
});
const colors = PLAYER_COLORS;
const slotColor = computed((): Color => {
  if (props.target.kind === 'human') {
    return createGameState.config.players[props.target.index]?.color ?? PLAYER_COLORS[0];
  }
  return PLAYER_COLORS[0];
});
const currentName = computed((): string => {
  if (props.target.kind === 'human') {
    return (createGameState.config.players[props.target.index]?.name ?? '').trim();
  }
  return 'MarsBot';
});
const headName = computed((): string => {
  return currentName.value !== '' ? currentName.value : $t('Participant');
});
const trBoost = computed((): number => {
  if (props.target.kind === 'human') {
    return createGameState.config.players[props.target.index]?.trBoost ?? 0;
  }
  return 0;
});
const difficultyLabel = computed((): string => {
  return botDifficultyMeta(createGameState.config.botDifficulty).labelKey;
});
const difficultyDesc = computed((): string => {
  return botDifficultyMeta(createGameState.config.botDifficulty).descKey;
});
const secondShiftOn = computed((): boolean => {
  return createGameState.config.botSecondShift;
});
/** The rule's reading — on or off; the cap is hidden balance and never named. */
const secondShiftDesc = computed((): string => {
  if (!secondShiftOn.value) {
    return 'Dynamic balance off: MarsBot keeps the same pace all game, as the Automa rules say.';
  }
  return SECOND_SHIFT_DESC_ON;
});
const extraCorporationsOn = computed((): boolean => {
  return createGameState.config.botExtraCorporations;
});
/** What the switch puts in the bot's pool — the official set alone, or the fork's own series beside it. */
const extraCorporationsDesc = computed((): string => {
  return extraCorporationsOn.value ?
    'Extra corporations on: besides the official ones, MarsBot may get one of the corporations made for this edition.' :
    'Extra corporations off: MarsBot gets only corporations from the official Automa set.';
});
/** Saved friends offered for this seat + a final "type a new name" row.
 * A friend already used by ANOTHER seat is shown disabled (case-insensitive). */
const friendPickRows = computed((): ReadonlyArray<FriendPickRow> => {
  if (props.target.kind !== 'human') {
    return [];
  }
  const myIndex = props.target.index;
  const takenNorms = new Set(
    createGameState.config.players
      .filter((_, i) => i !== myIndex)
      .map((p) => normalizePlayerName(p.name)),
  );
  const rows: Array<FriendPickRow> = friendsState.friends.map((name) => ({
    kind: 'friend',
    name,
    seated: takenNorms.has(normalizePlayerName(name)),
  }));
  rows.push({kind: 'type'});
  return rows;
});

/** Screen-root routed intents. Returns true when consumed. */
function handleIntent(intent: GamepadIntent): boolean {
  if (entering.value) {
    // The on-screen keyboard owns every intent while name entry is active.
    const vk = vkeyboard.value ?? undefined;
    return vk?.handleIntent?.(intent) ?? true;
  }
  if (pickingFriend.value) {
    // The friend quick-pick owns every intent while it is open.
    if (intent.kind === 'nav' && (intent.dir === 'up' || intent.dir === 'down')) {
      const count = friendPickRows.value.length;
      friendCursor.value = Math.min(count - 1, Math.max(0, friendCursor.value + (intent.dir === 'down' ? 1 : -1)));
      keepFriendCursorVisible();
      return true;
    }
    const pickAction = consoleActionOf(intent);
    if (pickAction === 'primary') {
      chooseFriendRow(friendCursor.value);
      return true;
    }
    if (pickAction === 'back') {
      pickingFriend.value = false;
      return true;
    }
    return true; // Swallow the rest — nothing behind the picker reacts.
  }
  const field = fields.value[props.cursor];
  if (intent.kind === 'nav') {
    if (intent.dir === 'up' || intent.dir === 'down') {
      const next = props.cursor + (intent.dir === 'down' ? 1 : -1);
      if (next >= 0 && next < fields.value.length) {
        emit('cursor', next);
      }
      return true;
    }
    if (field !== undefined && (intent.dir === 'left' || intent.dir === 'right')) {
      editorAdjust(props.target, field.id, intent.dir === 'right' ? 1 : -1);
      return true;
    }
    return true;
  }
  if (consoleActionOf(intent) === 'primary') {
    activateField(props.cursor);
    return true;
  }
  return false; // B (outside entry) falls through — the root closes us.
}
function onFieldClick(i: number): void {
  emit('cursor', i);
  activateField(i);
}
function activateField(i: number): void {
  const field = fields.value[i];
  if (field === undefined) {
    return;
  }
  switch (field.id) {
  case 'name':
    // With saved friends, offer the quick-pick first; otherwise type directly.
    if (props.target.kind === 'human' && friendsState.friends.length > 0) {
      openFriendPick();
    } else {
      startNameEntry();
    }
    break;
  case 'color':
  case 'trBoost':
  case 'difficulty':
  case 'secondShift':
  case 'extraCorporations':
    editorAdjust(props.target, field.id, 1);
    break;
  case 'remove':
    emit('remove-request');
    break;
  }
}
function openFriendPick(): void {
  friendCursor.value = 0;
  pickingFriend.value = true;
}
function keepFriendCursorVisible(): void {
  void nextTick(() => {
    const scroll = friendScroll.value ?? undefined;
    scroll?.ensureVisible?.(root.value?.querySelector('.cm-overlay--nested .cm-field--cursor') ?? null);
  });
}
function chooseFriendRow(i: number): void {
  const row = friendPickRows.value[i];
  if (row === undefined) {
    return;
  }
  if (row.kind === 'type') {
    pickingFriend.value = false;
    startNameEntry();
    return;
  }
  if (row.seated) {
    return; // Already used by another seat — the row is disabled.
  }
  if (props.target.kind === 'human') {
    setSlotName(props.target.index, row.name);
  }
  pickingFriend.value = false;
}
function startNameEntry(): void {
  if (props.target.kind !== 'human') {
    return;
  }
  entryDraft.value = currentName.value;
  nameIssue.value = '';
  // Silence the console key bridge so a physical key can't drive menu nav
  // behind the on-screen keyboard (the keyboard owns physical input too).
  menuPadState.textEntry = true;
  entering.value = true;
}
function commitNameEntry(value: string): void {
  if (props.target.kind !== 'human') {
    return;
  }
  const validation = validatePlayerName(value);
  if (!validation.ok) {
    nameIssue.value = validation.reason === 'empty' ? 'Fill in the player name' : 'This name cannot be used';
    return;
  }
  setSlotName(props.target.index, validation.displayName);
  entering.value = false;
  nameIssue.value = '';
  menuPadState.textEntry = false;
}
function cancelNameEntry(): void {
  entering.value = false;
  nameIssue.value = '';
  menuPadState.textEntry = false;
}
function pickColor(c: Color): void {
  if (props.target.kind === 'human') {
    setSlotColor(props.target.index, c);
  }
}
function takenBy(c: Color): boolean {
  if (props.target.kind !== 'human') {
    return false;
  }
  const idx = props.target.index;
  return createGameState.config.players.some((p, i) => i !== idx && p.color === c);
}

ensureFriendsLoaded();

onBeforeUnmount(() => {
  menuPadState.textEntry = false;
});
defineExpose({handleIntent});
</script>
