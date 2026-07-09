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

          <!-- Name -->
          <template v-if="field.id === 'name'">
            <span v-if="!entering" class="cm-field__value">
              <span :class="{'cm-field__missing': currentName === ''}">{{ currentName !== '' ? currentName : $t('Name not set') }}</span>
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
import {menuPadState} from '@/client/console/menu/consoleMenuPad';
import {
  EditorField,
  EditorTarget,
  editorAdjust,
  editorFields,
} from '@/client/console/menu/consoleCreateModel';
import {createGameState, setSlotColor, setSlotName} from '@/client/components/create/premium/createGameState';
import {botDifficultyMeta} from '@/client/components/create/premium/createGameMeta';
import {validatePlayerName} from '@/common/utils/playerName';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

export default defineComponent({
  name: 'ConsoleParticipantEditor',
  components: {GamepadGlyph},
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
  },
  beforeUnmount() {
    menuPadState.textEntry = false;
  },
  methods: {
    /** Screen-root routed intents. Returns true when consumed. */
    handleIntent(intent: GamepadIntent): boolean {
      if (this.entering) {
        if (intent.kind === 'press' && intent.button === 'confirm') {
          this.commitNameEntry();
          return true;
        }
        if (intent.kind === 'press' && intent.button === 'back') {
          this.cancelNameEntry();
          return true;
        }
        return true; // The input owns the rest while entering.
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
      if (intent.kind === 'press' && intent.button === 'confirm') {
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
        this.startNameEntry();
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
    startNameEntry(): void {
      if (this.target.kind !== 'human') {
        return;
      }
      this.entering = true;
      this.entryDraft = this.currentName;
      this.nameIssue = '';
      menuPadState.textEntry = true;
      void this.$nextTick(() => (this.$refs.nameInput as HTMLInputElement | undefined)?.focus());
    },
    commitNameEntry(): void {
      if (this.target.kind !== 'human') {
        return;
      }
      const validation = validatePlayerName(this.entryDraft);
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
