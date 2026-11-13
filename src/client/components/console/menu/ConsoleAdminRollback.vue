<template>
  <div ref="root" class="cm-overlay" role="dialog" :aria-label="$t('Game rollback')">
    <div class="cm-overlay__card cm-overlay__card--wide">
      <div class="cm-overlay__title">{{ $t('Game rollback') }}</div>
      <div class="cm-admin__scope">{{ $t('Local games only — games hosted on this device.') }}</div>

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

<script setup lang="ts">
/**
 * CONSOLE-NATIVE GAME-ROLLBACK — a main-menu plate for LOCAL games. Visible to
 * every player when the menu talks to this machine's own server (plus the
 * ADMIN_NAME dev door from anywhere); the server enforces the same rule as a
 * loopback gate (`rollbackAuthorized`). The scope note under the title says the
 * one limit out loud: only games hosted on this device. Two views:
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
 * sees the rolled-back state. Host-routed pad intents via `handleIntent`, the
 * same contract every main-menu overlay follows. (This one still wears the
 * pre-game `.cm-overlay` chassis — the settings surface moved to the shared
 * `.con-sys` one because it also has an IN-GAME host; a dev tool has only this
 * one, so it stays with its neighbours.)
 */
import {computed, nextTick, onMounted, ref, useTemplateRef} from 'vue';
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

defineOptions({name: 'ConsoleAdminRollback'});
const props = defineProps({
  /** The player's display name — carried on every request (the server admits
   *  a loopback connection regardless of it, or the ADMIN_NAME identity). */
  name: {type: String, required: true},
});
const emit = defineEmits(['close']);

const root = useTemplateRef<HTMLElement>('root');
const gamesScroll = useTemplateRef<{ensureVisible?: (el: Element | null) => void}>('gamesScroll');
const state = adminRollbackState;
const view = ref<'list' | 'detail'>('list');
const listCursor = ref(0);
const focusRow = ref<'gen' | 'save'>('gen');
const targetIndex = ref(0);
const confirming = ref(false);
const done = ref(false);
// A rollback happened → refresh the list when returning to it.
const dirty = ref(false);
const games = computed((): ReadonlyArray<AdminRollbackGameSummary> => {
  return state.games;
});
const history = computed((): AdminRollbackHistory | undefined => {
  return state.history;
});
const saves = computed((): ReadonlyArray<AdminRollbackSave> => {
  return history.value?.saves ?? [];
});
/** One chip per generation present, with the index of its FIRST save. */
const genChips = computed((): ReadonlyArray<{generation: number, firstIndex: number}> => {
  const chips: Array<{generation: number, firstIndex: number}> = [];
  saves.value.forEach((s, i) => {
    if (chips.length === 0 || chips[chips.length - 1].generation !== s.generation) {
      chips.push({generation: s.generation, firstIndex: i});
    }
  });
  return chips;
});
const targetSave = computed((): AdminRollbackSave => {
  return saves.value[targetIndex.value] ?? {saveId: 0, generation: 0, phase: Phase.ACTION};
});
/** Saves deleted if we roll back to the current target. */
const deletes = computed((): number => {
  return saves.value.filter((s) => s.saveId > targetSave.value.saveId).length;
});
/** True when the target is already the latest save (nothing to roll back). */
const isNoop = computed((): boolean => {
  return saves.value.length === 0 || targetIndex.value >= saves.value.length - 1;
});
const trackPct = computed((): number => {
  const last = saves.value.length - 1;
  return last <= 0 ? 100 : Math.round((targetIndex.value / last) * 100);
});
// Parameterized strings — the template `$t` takes no params, so build them here.
const deletesText = computed((): string => {
  return translateTextWithParams('deletes ${0} save(s)', [String(deletes.value)]);
});
const confirmQuestion = computed((): string => {
  return translateTextWithParams('Delete ${0} save(s) and roll back? This cannot be undone.', [String(deletes.value)]);
});
/** Host-routed pad intents. Returns true when consumed. */
function handleIntent(intent: GamepadIntent): boolean {
  const action = consoleActionOf(intent);
  if (view.value === 'list') {
    return handleListIntent(intent, action);
  }
  return handleDetailIntent(intent, action);
}
function handleListIntent(intent: GamepadIntent, action: string | undefined): boolean {
  if (intent.kind === 'nav' && (intent.dir === 'up' || intent.dir === 'down')) {
    listCursor.value = stepIndex(listCursor.value, intent.dir === 'down' ? 1 : -1, games.value.length);
    keepListCursorVisible();
    return true;
  }
  if (action === 'primary') {
    openGameAt(listCursor.value);
    return true;
  }
  if (action === 'back') {
    emit('close');
    return true;
  }
  return true;
}
function handleDetailIntent(intent: GamepadIntent, action: string | undefined): boolean {
  // A success banner is up — any confirm/back returns to the list.
  if (done.value) {
    if (action === 'primary' || action === 'back') {
      backToList();
    }
    return true;
  }
  if (confirming.value) {
    if (action === 'primary') {
      void doRollback();
    } else if (action === 'back') {
      confirming.value = false;
    }
    return true;
  }
  if (intent.kind === 'nav') {
    if (intent.dir === 'up' || intent.dir === 'down') {
      focusRow.value = focusRow.value === 'gen' ? 'save' : 'gen';
      return true;
    }
    if (intent.dir === 'left' || intent.dir === 'right') {
      const delta = intent.dir === 'right' ? 1 : -1;
      if (focusRow.value === 'gen') {
        moveGen(delta);
      } else {
        stepSave(delta);
      }
      return true;
    }
  }
  if (action === 'primary') {
    if (!isNoop.value) {
      confirming.value = true;
    }
    return true;
  }
  if (action === 'back') {
    backToList();
    return true;
  }
  return true;
}
function keepListCursorVisible(): void {
  void nextTick(() => {
    const scroll = gamesScroll.value;
    const rootNow = root.value;
    if (rootNow === null) {
      return;
    }
    scroll?.ensureVisible?.(rootNow.querySelector('.cm-game--cursor'));
  });
}
function openGameAt(i: number): void {
  listCursor.value = i;
  const g = games.value[i];
  if (g === undefined) {
    return;
  }
  view.value = 'detail';
  focusRow.value = 'gen';
  targetIndex.value = 0;
  confirming.value = false;
  done.value = false;
  void loadAdminHistory(props.name, g.id).then(() => {
    // Start the cursor at the latest save (no-op position) so the player
    // moves DELIBERATELY back to a rollback point.
    targetIndex.value = Math.max(0, saves.value.length - 1);
  });
}
function backToList(): void {
  confirming.value = false;
  done.value = false;
  clearAdminHistory();
  view.value = 'list';
  if (dirty.value) {
    dirty.value = false;
    void loadAdminGames(props.name);
  }
}
/** Index of the generation chip whose generation contains the target. */
function currentGenChipIndex(): number {
  const idx = genChips.value.findIndex((c) => c.generation === targetSave.value.generation);
  return idx < 0 ? 0 : idx;
}
function moveGen(delta: number): void {
  if (genChips.value.length === 0) {
    return;
  }
  const next = Math.min(genChips.value.length - 1, Math.max(0, currentGenChipIndex() + delta));
  targetIndex.value = genChips.value[next].firstIndex;
}
function pickGen(i: number): void {
  focusRow.value = 'gen';
  const chip = genChips.value[i];
  if (chip !== undefined) {
    targetIndex.value = chip.firstIndex;
  }
}
function stepSave(delta: number): void {
  focusRow.value = 'save';
  targetIndex.value = Math.min(saves.value.length - 1, Math.max(0, targetIndex.value + delta));
}
async function doRollback(): Promise<void> {
  const game = history.value;
  if (game === undefined) {
    return;
  }
  const targetSaveId = targetSave.value.saveId;
  const result = await performAdminRollback(props.name, game.id, targetSaveId);
  if (result === undefined) {
    // submitError is shown; leave the confirm bar so the player can retry.
    return;
  }
  confirming.value = false;
  dirty.value = true;
  // Reload the (now truncated) history so the slider reflects reality, then
  // pin the cursor to the new latest save and flash the success banner.
  await loadAdminHistory(props.name, game.id);
  targetIndex.value = Math.max(0, saves.value.length - 1);
  done.value = true;
}
function phaseLabel(phase: Phase): string {
  return $t(PHASE_LABELS[phase] ?? String(phase));
}

onMounted(() => {
  // Always refresh on open so the list reflects the real current generation.
  void loadAdminGames(props.name);
});

// What `ConsoleMainMenu` reaches through its `ref="admin"`: `handleIntent` — and nothing else (it routes the pad's
// intents here while the rollback tool is the open overlay).
defineExpose({handleIntent});
</script>
