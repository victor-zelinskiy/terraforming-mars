<template>
  <div class="cm-overlay" role="dialog" :aria-label="$t('Game rollback')">
    <div class="cm-overlay__card cm-overlay__card--wide">
      <div class="cm-overlay__title">{{ $t('Game rollback') }}</div>

      <!-- ── LIST: pick a game ─────────────────────────────────────────── -->
      <template v-if="view === 'list'">
        <div v-if="state.loadingGames && !state.loadedGamesOnce" class="cm-gamelist__empty">{{ $t('Loading') }}…</div>
        <div v-else-if="state.gamesError" class="cm-gamelist__empty cm-gamelist__empty--error">{{ $t('Could not load games') }}</div>
        <div v-else-if="games.length === 0" class="cm-gamelist__empty">{{ $t('No games on this server.') }}</div>
        <ConsoleScrollArea v-else ref="gamesScroll" class="cm-gamelist-scroll">
          <div class="cm-gamelist">
            <button
              v-for="(g, i) in games"
              :key="g.id"
              type="button"
              class="cm-game"
              :class="{'cm-game--cursor': i === listCursor}"
              @click="openGameAt(i)"
              @mousemove="listCursor = i"
            >
              <div class="cm-game__head">
                <span class="cm-game__name">{{ g.name }}</span>
                <span class="cm-admin__gen-pill">{{ $t('Gen') }} {{ g.generation }}</span>
                <span class="cm-admin__phase" :class="'cm-admin__phase--' + g.phase">{{ phaseLabel(g.phase) }}</span>
              </div>
              <div class="cm-game__crew">
                <span v-for="p in g.players" :key="p.color" class="cm-game__player">
                  <span class="cm-game__pcube" :class="'player_bg_color_' + p.color" aria-hidden="true"></span>
                  <span class="cm-game__pname">{{ p.name }}</span>
                </span>
              </div>
            </button>
          </div>
        </ConsoleScrollArea>
        <div class="cm-overlay__foot">
          <span class="cm-overlay__foot-hint"><GamepadGlyph control="confirm" />{{ $t('Open') }}</span>
          <span class="cm-overlay__foot-hint"><GamepadGlyph control="back" />{{ $t('Back') }}</span>
        </div>
      </template>

      <!-- ── DETAIL: rollback one game ─────────────────────────────────── -->
      <template v-else>
        <div v-if="state.loadingHistory" class="cm-gamelist__empty">{{ $t('Loading') }}…</div>
        <div v-else-if="state.historyError || history === undefined" class="cm-gamelist__empty cm-gamelist__empty--error">{{ $t('Could not load game history') }}</div>
        <template v-else>
          <div class="cm-admin__detailhead">
            <span class="cm-admin__detailname">{{ history.name }}</span>
            <span class="cm-admin__detailnow">
              {{ $t('Now') }}: {{ $t('Gen') }} {{ history.currentGeneration }} · {{ $t('save') }} {{ history.currentSaveId }}
            </span>
          </div>

          <!-- Generation timeline — coarse quick-picks (first save of each gen). -->
          <div class="cm-admin__section" :class="{'cm-admin__section--focus': focusRow === 'gen'}">
            <div class="cm-admin__section-label">{{ $t('Generation') }}</div>
            <div class="cm-admin__gens">
              <button
                v-for="(c, i) in genChips"
                :key="c.generation"
                type="button"
                class="cm-admin__gen"
                :class="{'cm-admin__gen--active': c.generation === targetSave.generation}"
                @click="pickGen(i)"
              >{{ c.generation }}</button>
            </div>
          </div>

          <!-- Save slider — fine control over the exact save. -->
          <div class="cm-admin__section" :class="{'cm-admin__section--focus': focusRow === 'save'}">
            <div class="cm-admin__section-label">{{ $t('Save point') }}</div>
            <div class="cm-admin__slider">
              <button type="button" class="cm-admin__step" :disabled="targetIndex <= 0" @click="stepSave(-1)" aria-hidden="true">‹</button>
              <div class="cm-admin__track">
                <div class="cm-admin__track-fill" :style="{width: trackPct + '%'}"></div>
              </div>
              <button type="button" class="cm-admin__step" :disabled="targetIndex >= saves.length - 1" @click="stepSave(1)" aria-hidden="true">›</button>
            </div>
            <div class="cm-admin__saveinfo">
              {{ $t('save') }} {{ targetSave.saveId }} / {{ history.currentSaveId }} · {{ $t('Gen') }} {{ targetSave.generation }} · {{ phaseLabel(targetSave.phase) }}
            </div>
          </div>

          <!-- Target readout / result / confirm. -->
          <div v-if="done" class="cm-admin__result">
            {{ $t('Rolled back to') }} {{ $t('Gen') }} {{ targetSave.generation }} · {{ $t('save') }} {{ targetSave.saveId }}.
          </div>
          <div v-else-if="state.submitError" class="cm-admin__result cm-admin__result--error">{{ $t('Rollback failed') }}</div>
          <div v-else class="cm-admin__target" :class="{'cm-admin__target--noop': isNoop}">
            <template v-if="isNoop">{{ $t('This is already the latest state.') }}</template>
            <template v-else>{{ $t('Roll back to') }} {{ $t('Gen') }} {{ targetSave.generation }} · {{ $t('save') }} {{ targetSave.saveId }} — {{ deletesText }}</template>
          </div>

          <!-- Confirm bar. -->
          <div v-if="confirming" class="cm-admin__confirm">
            <div class="cm-admin__confirm-q">{{ confirmQuestion }}</div>
            <div class="cm-confirm__pad">
              <button type="button" class="cm-confirm__btn cm-confirm__btn--danger" :disabled="state.submitting" @click="doRollback">
                <GamepadGlyph control="confirm" /><span>{{ state.submitting ? $t('Rolling back') + '…' : $t('Roll back') }}</span>
              </button>
              <button type="button" class="cm-confirm__btn" :disabled="state.submitting" @click="confirming = false">
                <GamepadGlyph control="back" /><span>{{ $t('Cancel') }}</span>
              </button>
            </div>
          </div>
          <div v-else class="cm-overlay__foot">
            <span class="cm-overlay__foot-hint"><GamepadGlyph control="dpad" />{{ $t('Adjust') }}</span>
            <span class="cm-overlay__foot-hint" :class="{'cm-admin__hint--off': isNoop}"><GamepadGlyph control="confirm" />{{ $t('Roll back') }}</span>
            <span class="cm-overlay__foot-hint"><GamepadGlyph control="back" />{{ $t('Back') }}</span>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE-NATIVE ADMIN GAME-ROLLBACK — a dev-only main-menu plate (visible only
 * to the ADMIN_NAME identity). Two views:
 *
 *  - LIST: every game with its FRESH generation (server reads the authoritative
 *    instance, so a game whose generation advanced shows the real value). A =
 *    open, B = close the tool.
 *  - DETAIL: a chosen game's save history as a GENERATION timeline (coarse
 *    quick-picks — first save of each generation) + a SAVE slider (fine step).
 *    Up/Down switches the focused control, Left/Right adjusts it, A = roll back
 *    (confirm), B = back to the list.
 *
 * The rollback deletes every save ahead of the chosen one and reloads the game
 * there; the server broadcasts a realtime invalidation so a connected player
 * sees the rolled-back state. Host-routed pad intents via `handleIntent`,
 * mirroring ConsoleOptionsPanel.
 */
import {defineComponent} from 'vue';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {stepIndex} from '@/client/console/consoleRouter';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import {Phase} from '@/common/Phase';
import {AdminRollbackGameSummary, AdminRollbackHistory, AdminRollbackSave} from '@/common/models/AdminRollbackModel';
import {
  adminRollbackState,
  loadAdminGames,
  loadAdminHistory,
  performAdminRollback,
  clearAdminHistory,
} from '@/client/components/console/menu/adminRollbackState';
import {$t, translateTextWithParams} from '@/client/directives/i18n';

const PHASE_LABELS: Partial<Record<Phase, string>> = {
  [Phase.INITIALDRAFTING]: 'Draft',
  [Phase.RESEARCH]: 'Research',
  [Phase.DRAFTING]: 'Draft',
  [Phase.ACTION]: 'Action',
  [Phase.PRODUCTION]: 'Production phase',
  [Phase.SOLAR]: 'World government',
  [Phase.INTERGENERATION]: 'Between generations',
  [Phase.PRELUDES]: 'Preludes',
  [Phase.CEOS]: 'CEOs',
  [Phase.END]: 'Game over',
};

export default defineComponent({
  name: 'ConsoleAdminRollback',
  components: {GamepadGlyph, ConsoleScrollArea},
  props: {
    /** The admin's display name — carried on every request (server soft-gates). */
    name: {type: String, required: true},
  },
  emits: ['close'],
  data() {
    return {
      state: adminRollbackState,
      view: 'list' as 'list' | 'detail',
      listCursor: 0,
      focusRow: 'gen' as 'gen' | 'save',
      targetIndex: 0,
      confirming: false,
      done: false,
      // A rollback happened → refresh the list when returning to it.
      dirty: false,
    };
  },
  computed: {
    games(): ReadonlyArray<AdminRollbackGameSummary> {
      return this.state.games;
    },
    history(): AdminRollbackHistory | undefined {
      return this.state.history;
    },
    saves(): ReadonlyArray<AdminRollbackSave> {
      return this.history?.saves ?? [];
    },
    /** One chip per generation present, with the index of its FIRST save. */
    genChips(): ReadonlyArray<{generation: number, firstIndex: number}> {
      const chips: Array<{generation: number, firstIndex: number}> = [];
      this.saves.forEach((s, i) => {
        if (chips.length === 0 || chips[chips.length - 1].generation !== s.generation) {
          chips.push({generation: s.generation, firstIndex: i});
        }
      });
      return chips;
    },
    targetSave(): AdminRollbackSave {
      return this.saves[this.targetIndex] ?? {saveId: 0, generation: 0, phase: Phase.ACTION};
    },
    /** Saves deleted if we roll back to the current target. */
    deletes(): number {
      return this.saves.filter((s) => s.saveId > this.targetSave.saveId).length;
    },
    /** True when the target is already the latest save (nothing to roll back). */
    isNoop(): boolean {
      return this.saves.length === 0 || this.targetIndex >= this.saves.length - 1;
    },
    trackPct(): number {
      const last = this.saves.length - 1;
      return last <= 0 ? 100 : Math.round((this.targetIndex / last) * 100);
    },
    // Parameterized strings — the template `$t` takes no params, so build them here.
    deletesText(): string {
      return translateTextWithParams('deletes ${0} save(s)', [String(this.deletes)]);
    },
    confirmQuestion(): string {
      return translateTextWithParams('Delete ${0} save(s) and roll back? This cannot be undone.', [String(this.deletes)]);
    },
  },
  mounted() {
    // Always refresh on open so the list reflects the real current generation.
    void loadAdminGames(this.name);
  },
  methods: {
    /** Host-routed pad intents. Returns true when consumed. */
    handleIntent(intent: GamepadIntent): boolean {
      const action = consoleActionOf(intent);
      if (this.view === 'list') {
        return this.handleListIntent(intent, action);
      }
      return this.handleDetailIntent(intent, action);
    },
    handleListIntent(intent: GamepadIntent, action: string | undefined): boolean {
      if (intent.kind === 'nav' && (intent.dir === 'up' || intent.dir === 'down')) {
        this.listCursor = stepIndex(this.listCursor, intent.dir === 'down' ? 1 : -1, this.games.length);
        this.keepListCursorVisible();
        return true;
      }
      if (action === 'primary') {
        this.openGameAt(this.listCursor);
        return true;
      }
      if (action === 'back') {
        this.$emit('close');
        return true;
      }
      return true;
    },
    handleDetailIntent(intent: GamepadIntent, action: string | undefined): boolean {
      // A success banner is up — any confirm/back returns to the list.
      if (this.done) {
        if (action === 'primary' || action === 'back') {
          this.backToList();
        }
        return true;
      }
      if (this.confirming) {
        if (action === 'primary') {
          void this.doRollback();
        } else if (action === 'back') {
          this.confirming = false;
        }
        return true;
      }
      if (intent.kind === 'nav') {
        if (intent.dir === 'up' || intent.dir === 'down') {
          this.focusRow = this.focusRow === 'gen' ? 'save' : 'gen';
          return true;
        }
        if (intent.dir === 'left' || intent.dir === 'right') {
          const delta = intent.dir === 'right' ? 1 : -1;
          if (this.focusRow === 'gen') {
            this.moveGen(delta);
          } else {
            this.stepSave(delta);
          }
          return true;
        }
      }
      if (action === 'primary') {
        if (!this.isNoop) {
          this.confirming = true;
        }
        return true;
      }
      if (action === 'back') {
        this.backToList();
        return true;
      }
      return true;
    },
    keepListCursorVisible(): void {
      void this.$nextTick(() => {
        const scroll = this.$refs.gamesScroll as {ensureVisible?: (el: Element | null) => void} | undefined;
        scroll?.ensureVisible?.(this.$el.querySelector('.cm-game--cursor'));
      });
    },
    openGameAt(i: number): void {
      this.listCursor = i;
      const g = this.games[i];
      if (g === undefined) {
        return;
      }
      this.view = 'detail';
      this.focusRow = 'gen';
      this.targetIndex = 0;
      this.confirming = false;
      this.done = false;
      void loadAdminHistory(this.name, g.id).then(() => {
        // Start the cursor at the latest save (no-op position) so the player
        // moves DELIBERATELY back to a rollback point.
        this.targetIndex = Math.max(0, this.saves.length - 1);
      });
    },
    backToList(): void {
      this.confirming = false;
      this.done = false;
      clearAdminHistory();
      this.view = 'list';
      if (this.dirty) {
        this.dirty = false;
        void loadAdminGames(this.name);
      }
    },
    /** Index of the generation chip whose generation contains the target. */
    currentGenChipIndex(): number {
      const idx = this.genChips.findIndex((c) => c.generation === this.targetSave.generation);
      return idx < 0 ? 0 : idx;
    },
    moveGen(delta: number): void {
      if (this.genChips.length === 0) {
        return;
      }
      const next = Math.min(this.genChips.length - 1, Math.max(0, this.currentGenChipIndex() + delta));
      this.targetIndex = this.genChips[next].firstIndex;
    },
    pickGen(i: number): void {
      this.focusRow = 'gen';
      const chip = this.genChips[i];
      if (chip !== undefined) {
        this.targetIndex = chip.firstIndex;
      }
    },
    stepSave(delta: number): void {
      this.focusRow = 'save';
      this.targetIndex = Math.min(this.saves.length - 1, Math.max(0, this.targetIndex + delta));
    },
    async doRollback(): Promise<void> {
      const game = this.history;
      if (game === undefined) {
        return;
      }
      const targetSaveId = this.targetSave.saveId;
      const result = await performAdminRollback(this.name, game.id, targetSaveId);
      if (result === undefined) {
        // submitError is shown; leave the confirm bar so the player can retry.
        return;
      }
      this.confirming = false;
      this.dirty = true;
      // Reload the (now truncated) history so the slider reflects reality, then
      // pin the cursor to the new latest save and flash the success banner.
      await loadAdminHistory(this.name, game.id);
      this.targetIndex = Math.max(0, this.saves.length - 1);
      this.done = true;
    },
    phaseLabel(phase: Phase): string {
      return $t(PHASE_LABELS[phase] ?? String(phase));
    },
  },
});
</script>
