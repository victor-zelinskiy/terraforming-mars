<template>
  <div class="cm-overlay" role="dialog" :aria-label="$t('Participant')">
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

          <!-- Remove -->
          <template v-else-if="field.id === 'remove'">
            <span class="cm-field__value cm-field__value--danger">
              <span class="cm-field__hint" aria-hidden="true"><GamepadGlyph control="confirm" />{{ $t('Remove') }}</span>
            </span>
          </template>
        </div>

        <div v-if="nameIssue !== ''" class="cm-field__issue">{{ $t(nameIssue) }}</div>
        <div v-if="target.kind === 'bot'" class="cm-editor__note">{{ $t(difficultyDesc) }}</div>
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

<script lang="ts">
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
import {defineComponent, PropType} from 'vue';
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

/** A row of the friend quick-pick: a saved friend, or the "type a name" escape. */
type FriendPickRow = {kind: 'friend', name: string, seated: boolean} | {kind: 'type'};

export default defineComponent({
  name: 'ConsoleParticipantEditor',
  components: {GamepadGlyph, ConsoleScrollArea, ConsoleVirtualKeyboard},
  props: {
    target: {type: Object as PropType<EditorTarget>, required: true},
    cursor: {type: Number, required: true},
  },
  emits: ['close', 'remove-request', 'cursor'],
  data() {
    return {
      entering: false,
      entryDraft: '',
      nameIssue: '',
      pickingFriend: false,
      friendCursor: 0,
    };
  },
  computed: {
    fields(): ReadonlyArray<EditorField> {
      return editorFields(this.target);
    },
    colors(): ReadonlyArray<Color> {
      return PLAYER_COLORS;
    },
    slotColor(): Color {
      if (this.target.kind === 'human') {
        return createGameState.config.players[this.target.index]?.color ?? PLAYER_COLORS[0];
      }
      return PLAYER_COLORS[0];
    },
    currentName(): string {
      if (this.target.kind === 'human') {
        return (createGameState.config.players[this.target.index]?.name ?? '').trim();
      }
      return 'MarsBot';
    },
    headName(): string {
      return this.currentName !== '' ? this.currentName : this.$t('Participant');
    },
    trBoost(): number {
      if (this.target.kind === 'human') {
        return createGameState.config.players[this.target.index]?.trBoost ?? 0;
      }
      return 0;
    },
    difficultyLabel(): string {
      return botDifficultyMeta(createGameState.config.botDifficulty).labelKey;
    },
    difficultyDesc(): string {
      return botDifficultyMeta(createGameState.config.botDifficulty).descKey;
    },
    /** Saved friends offered for this seat + a final "type a new name" row.
     * A friend already used by ANOTHER seat is shown disabled (case-insensitive). */
    friendPickRows(): ReadonlyArray<FriendPickRow> {
      if (this.target.kind !== 'human') {
        return [];
      }
      const myIndex = this.target.index;
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
    },
  },
  created() {
    ensureFriendsLoaded();
  },
  beforeUnmount() {
    menuPadState.textEntry = false;
  },
  methods: {
    /** Screen-root routed intents. Returns true when consumed. */
    handleIntent(intent: GamepadIntent): boolean {
      if (this.entering) {
        // The on-screen keyboard owns every intent while name entry is active.
        const vk = this.$refs.vkeyboard as {handleIntent?: (i: GamepadIntent) => boolean} | undefined;
        return vk?.handleIntent?.(intent) ?? true;
      }
      if (this.pickingFriend) {
        // The friend quick-pick owns every intent while it is open.
        if (intent.kind === 'nav' && (intent.dir === 'up' || intent.dir === 'down')) {
          const count = this.friendPickRows.length;
          this.friendCursor = Math.min(count - 1, Math.max(0, this.friendCursor + (intent.dir === 'down' ? 1 : -1)));
          this.keepFriendCursorVisible();
          return true;
        }
        const pickAction = consoleActionOf(intent);
        if (pickAction === 'primary') {
          this.chooseFriendRow(this.friendCursor);
          return true;
        }
        if (pickAction === 'back') {
          this.pickingFriend = false;
          return true;
        }
        return true; // Swallow the rest — nothing behind the picker reacts.
      }
      const field = this.fields[this.cursor];
      if (intent.kind === 'nav') {
        if (intent.dir === 'up' || intent.dir === 'down') {
          const next = this.cursor + (intent.dir === 'down' ? 1 : -1);
          if (next >= 0 && next < this.fields.length) {
            this.$emit('cursor', next);
          }
          return true;
        }
        if (field !== undefined && (intent.dir === 'left' || intent.dir === 'right')) {
          editorAdjust(this.target, field.id, intent.dir === 'right' ? 1 : -1);
          return true;
        }
        return true;
      }
      if (consoleActionOf(intent) === 'primary') {
        this.activateField(this.cursor);
        return true;
      }
      return false; // B (outside entry) falls through — the root closes us.
    },
    onFieldClick(i: number): void {
      this.$emit('cursor', i);
      this.activateField(i);
    },
    activateField(i: number): void {
      const field = this.fields[i];
      if (field === undefined) {
        return;
      }
      switch (field.id) {
      case 'name':
        // With saved friends, offer the quick-pick first; otherwise type directly.
        if (this.target.kind === 'human' && friendsState.friends.length > 0) {
          this.openFriendPick();
        } else {
          this.startNameEntry();
        }
        break;
      case 'color':
      case 'trBoost':
      case 'difficulty':
        editorAdjust(this.target, field.id, 1);
        break;
      case 'remove':
        this.$emit('remove-request');
        break;
      }
    },
    openFriendPick(): void {
      this.friendCursor = 0;
      this.pickingFriend = true;
    },
    keepFriendCursorVisible(): void {
      void this.$nextTick(() => {
        const scroll = this.$refs.friendScroll as {ensureVisible?: (el: Element | null) => void} | undefined;
        scroll?.ensureVisible?.(this.$el.querySelector('.cm-overlay--nested .cm-field--cursor'));
      });
    },
    chooseFriendRow(i: number): void {
      const row = this.friendPickRows[i];
      if (row === undefined) {
        return;
      }
      if (row.kind === 'type') {
        this.pickingFriend = false;
        this.startNameEntry();
        return;
      }
      if (row.seated) {
        return; // Already used by another seat — the row is disabled.
      }
      if (this.target.kind === 'human') {
        setSlotName(this.target.index, row.name);
      }
      this.pickingFriend = false;
    },
    startNameEntry(): void {
      if (this.target.kind !== 'human') {
        return;
      }
      this.entryDraft = this.currentName;
      this.nameIssue = '';
      // Silence the console key bridge so a physical key can't drive menu nav
      // behind the on-screen keyboard (the keyboard owns physical input too).
      menuPadState.textEntry = true;
      this.entering = true;
    },
    commitNameEntry(value: string): void {
      if (this.target.kind !== 'human') {
        return;
      }
      const validation = validatePlayerName(value);
      if (!validation.ok) {
        this.nameIssue = validation.reason === 'empty' ? 'Fill in the player name' : 'This name cannot be used';
        return;
      }
      setSlotName(this.target.index, validation.displayName);
      this.entering = false;
      this.nameIssue = '';
      menuPadState.textEntry = false;
    },
    cancelNameEntry(): void {
      this.entering = false;
      this.nameIssue = '';
      menuPadState.textEntry = false;
    },
    pickColor(c: Color): void {
      if (this.target.kind === 'human') {
        setSlotColor(this.target.index, c);
      }
    },
    takenBy(c: Color): boolean {
      if (this.target.kind !== 'human') {
        return false;
      }
      const idx = this.target.index;
      return createGameState.config.players.some((p, i) => i !== idx && p.color === c);
    },
  },
});
</script>
