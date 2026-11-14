<template>
  <div class="con-diagrep" :data-diag-report="s.step">
    <transition name="con-diag-step">
      <!-- 1 · WHAT HAPPENED — a fixed list of plates; A picks one and goes on. -->
      <div v-if="s.step === 'category'" key="category" class="con-diagrep__pane">
        <div class="con-diagrep__lead">{{ $t('What happened?') }}</div>
        <div class="con-sysact con-diagrep__plates">
          <button
            v-for="(plate, i) in plates"
            :key="plate.id"
            type="button"
            class="con-sysact__plate"
            :class="{'con-sysact__plate--cursor': i === s.categoryCursor}"
            :data-diag-category="plate.id"
            @click="pick(i)"
            @mousemove="s.categoryCursor = i"
          >
            <span class="con-sysact__glyph" aria-hidden="true">{{ plate.glyph }}</span>
            <span class="con-sysact__text">
              <span class="con-sysact__label">{{ $t(plate.label) }}</span>
              <span class="con-sysact__sub">{{ $t(plate.sub) }}</span>
            </span>
            <GamepadGlyph control="confirm" class="con-sysact__go" />
          </button>
        </div>
      </div>

      <!-- 2 · WHAT WILL BE SENT, a word from the player, the commit plate. -->
      <div v-else-if="s.step === 'review'" key="review" class="con-diagrep__pane con-diagrep__pane--review">
        <div class="con-diagrep__col">
          <div class="con-diagrep__lead">{{ $t('What will be sent') }}</div>
          <div
            v-for="row in attach"
            :key="row.label"
            class="con-diagrep__attach"
            :class="{'con-diagrep__attach--off': !row.included}"
          >
            <span class="con-diagrep__attach-mark" aria-hidden="true">{{ row.included ? '✓' : '—' }}</span>
            <span class="con-diagrep__attach-text">
              <span class="con-diagrep__attach-label">{{ $t(row.label) }}</span>
              <span v-if="row.note !== ''" class="con-diagrep__attach-note">{{ $t(row.note) }}</span>
            </span>
          </div>
          <div class="con-diagrep__privacy">{{ $t('The report contains the names of the players and the state of this game. It goes to the developer only.') }}</div>
        </div>
        <div class="con-diagrep__col">
          <div class="con-diagrep__lead">{{ $t('In your own words') }}</div>
          <div
            class="con-diagrep__comment"
            :class="{'con-diagrep__comment--cursor': s.reviewCursor === 0, 'con-diagrep__comment--empty': s.comment === ''}"
            role="button"
            data-diag-comment
            @click="write"
            @mousemove="s.reviewCursor = 0"
          >{{ s.comment === '' ? $t('Optional — a few words about what you were doing help a lot') : s.comment }}</div>
          <div class="con-diagrep__commit-well">
            <!-- A refusal is SAID on a non-disabled wrapper — the plate itself never greys out silently. -->
            <div class="con-diagrep__refusal">{{ refusal === '' ? '' : $t(refusal) }}</div>
            <div
              class="con-diagrep__commit"
              :class="{'con-diagrep__commit--cursor': s.reviewCursor === 1, 'con-diagrep__commit--off': refusal !== ''}"
              role="button"
              data-diag-commit
              @click="send"
              @mousemove="s.reviewCursor = 1"
            >
              <span class="con-diagrep__commit-label">{{ $t('Send the report') }}</span>
              <GamepadGlyph control="confirm" class="con-diagrep__commit-go" />
            </div>
          </div>
        </div>
      </div>

      <!-- 3 · PAST THE COMMIT — one panel for the beat and for its result: the code is revealed in the cells that
           waited for it, so «sending» does not get replaced by «done» — it becomes it. -->
      <div v-else key="send" class="con-diagrep__pane con-diagsend" :class="'con-diagsend--' + s.step" data-diag-send>
        <div class="con-diagsend__kicker">{{ $t(kicker) }}</div>
        <div class="con-diagsend__code" :aria-label="code" data-diag-code>
          <span class="con-diagsend__prefix">TM</span>
          <span class="con-diagsend__dash" aria-hidden="true"></span>
          <span
            v-for="(ch, i) in cells"
            :key="i"
            class="con-diagsend__cell"
            :class="{'con-diagsend__cell--lit': ch !== ''}"
            :style="{'--cell': i}"
          >{{ ch }}</span>
        </div>
        <div class="con-diagsend__rail" aria-hidden="true"><span class="con-diagsend__rail-run"></span></div>
        <div class="con-diagsend__title" :class="'con-diag__tone--' + tone">{{ $t(title) }}</div>
        <div class="con-diagsend__body">{{ $t(body) }}</div>
        <div class="con-diagsend__where">
          <span v-if="folder !== ''" class="con-diagsend__where-key">{{ $t('Folder on this device') }}</span>
          <span class="con-diagsend__folder" data-diag-folder>{{ folder }}</span>
          <span class="con-diagsend__size">{{ size }}</span>
          <!-- Where a player can write to the developer — printed only once such a place exists (`DIAG_CONTACT`). -->
          <span v-if="contact !== '' && s.step === 'done'" class="con-diagsend__contact" data-diag-contact>{{ contact }}</span>
        </div>
      </div>
    </transition>

    <ConsoleVirtualKeyboard
      v-if="s.typing"
      ref="keyboard"
      :initial="s.comment"
      :maxLength="400"
      :title="'Describe the problem'"
      @commit="emit('typed', $event)"
      @cancel="emit('typed', undefined)"
    />
  </div>
</template>

<script setup vapor lang="ts">
/**
 * «СООБЩИТЬ О ПРОБЛЕМЕ» — the report's three panes, in the diagnostics surface's own cell:
 *
 *   category → review → (the commit) → sending → done | failed
 *
 * Everything that decides lives in `diagnostics/diagnosticsSurface.ts`; this is the template. Three things are worth
 * saying about the picture:
 *
 *  · THE REVIEW TELLS BEFORE THE PRESS what leaves the device, in a person's words — never a list of file names —
 *    and what does not (a save that lives on another device is shown as «—» with its reason, not hidden).
 *  · THE COMMIT PLATE NEVER GREYS OUT SILENTLY: a refusal stands above it, in an always-reserved line.
 *  · PAST THE COMMIT THERE IS ONE PANEL. The six cells of the code wait empty while the report is assembled and
 *    sent, and the code is revealed IN them, one cell after another — the result grows out of the wait instead of
 *    replacing it. The panel's lines are all reserved, so nothing moves when the words arrive.
 *
 * It exposes `keyboardIntent` — while the on-screen keyboard is up for the comment, the controller hands every
 * intent to it.
 */
import {computed, useTemplateRef} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleVirtualKeyboard from '@/client/components/console/menu/ConsoleVirtualKeyboard.vue';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {DIAG_CONTACT} from '@/common/diagnostics/protocol';
import {diagHubState} from '@/client/diagnostics/diagnosticsHubState';
import {currentDiagContext} from '@/client/diagnostics/diagnosticsContext';
import {diagSurfaceState, handleDiagnosticsIntent} from '@/client/diagnostics/diagnosticsSurface';
import {DIAG_REPORT_PLATES, reportAttachRows, reportDoneReading, reportSize} from '@/client/diagnostics/diagnosticsView';
import {$t, translateTextWithParams} from '@/client/directives/i18n';

defineOptions({name: 'ConsoleDiagReport'});
const emit = defineEmits({
  /** The keyboard closed: the comment as typed, or `undefined` when it was cancelled. */
  typed: (_text: string | undefined) => true,
});

const s = diagSurfaceState;
const plates = DIAG_REPORT_PLATES;
const contact = DIAG_CONTACT;
const keyboard = useTemplateRef<{handleIntent?: (intent: GamepadIntent) => boolean}>('keyboard');

const attach = computed(() => reportAttachRows(diagHubState.status, currentDiagContext().participantId !== ''));
/** Why the commit cannot be pressed right now ('' = it can). */
const refusal = computed((): string => (s.category === undefined ? 'Choose what happened first' : ''));

const code = computed((): string => s.result?.code ?? '');
/** The six cells after `TM-`: empty while the report is on its way. */
const cells = computed((): ReadonlyArray<string> => {
  const tail = code.value.replace(/^TM-/, '');
  return [0, 1, 2, 3, 4, 5].map((i) => tail.charAt(i));
});
const done = computed(() => (s.result === undefined ? undefined : reportDoneReading(s.result.state)));
const kicker = computed((): string => {
  if (s.step === 'failed') {
    return 'The report was not made';
  }
  return s.step === 'done' ? 'Report code' : 'Assembling and sending the report…';
});
const title = computed((): string => (s.step === 'failed' ? s.failure : (done.value?.title ?? '')));
const body = computed((): string => {
  if (s.step === 'failed') {
    return 'Nothing was sent. You can try again — the journal and your words are kept.';
  }
  return done.value?.body ?? '';
});
const tone = computed((): string => (s.step === 'failed' ? 'bad' : (done.value?.tone ?? 'plain')));
const folder = computed((): string => s.result?.folder ?? '');
const size = computed((): string => {
  if (s.result === undefined) {
    return '';
  }
  const reading = reportSize(s.result.parts);
  return translateTextWithParams(reading.key, [...reading.params]);
});

/** A mouse click runs the same branch the pad does. */
function pick(i: number): void {
  s.categoryCursor = i;
  handleDiagnosticsIntent({kind: 'press', button: 'confirm'});
}
function write(): void {
  s.reviewCursor = 0;
  handleDiagnosticsIntent({kind: 'press', button: 'confirm'});
}
function send(): void {
  s.reviewCursor = 1;
  handleDiagnosticsIntent({kind: 'press', button: 'confirm'});
}
function keyboardIntent(intent: GamepadIntent): boolean {
  return keyboard.value?.handleIntent?.(intent) ?? false;
}

defineExpose({keyboardIntent});
</script>
