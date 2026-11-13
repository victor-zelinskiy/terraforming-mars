<template>
  <div class="con-ares con-ws" role="dialog" :aria-label="$t('Shift the planetary event thresholds')"
       data-motion-surface="ares-globals">
    <!-- A plate of the PROMPT-MODAL FAMILY (`console_prompt.less`): a free choice — the NEUTRAL tone. Each row states
         its own consequence (the threshold and what it moves), so the plate carries no consequence footer. -->
    <div class="con-ares__panel con-prompt con-prompt--m con-prompt--neutral" data-motion-panel data-prompt-panel data-stick-scroll>
      <ConsolePromptHead class="con-ares__head" tone="neutral" :kicker="$t('Planetary events')"
                         :title="$t('Shift the planetary event thresholds')"
                         :trigger="$t('Move each threshold up to 1 step up or down.')" :prompt-key="sequenceKey">
        <!-- Nothing is forced here: standing pat is a real answer, and the
             surface says so rather than letting the player hunt for it. -->
        <div class="con-ares__count" :class="{'con-ares__count--idle': changedCount === 0}">
          {{ changedCount === 0 ? $t('No changes') : shiftedText }}
        </div>
      </ConsolePromptHead>

      <div class="con-ares__rows">
        <div v-for="(row, i) in rows" :key="row.key"
             class="con-ares__row"
             :class="{
               'con-ares__row--focused': focusIdx === i,
               'con-ares__row--changed': deltaOf(row) !== 0,
             }">
          <div class="con-ares__id">
            <span class="con-ares__frame">
              <i class="con-ares__icon" :class="row.iconClass" aria-hidden="true"></i>
            </span>
            <span class="con-ares__names">
              <span class="con-ares__name">{{ $t(row.label) }}</span>
              <span class="con-ares__effect">{{ $t(row.effectKey) }}</span>
            </span>
          </div>

          <!-- current → resulting, in the parameter's OWN unit (°C moves two
               per step — the player must never have to know that). -->
          <span class="con-ares__values">
            <span class="con-ares__cur" :class="{'con-ares__cur--faded': deltaOf(row) !== 0}">{{ row.threshold }}{{ row.unit }}</span>
            <template v-if="deltaOf(row) !== 0">
              <span class="con-ares__arrow" aria-hidden="true">→</span>
              <span class="con-ares__next">{{ resultingOf(row) }}{{ row.unit }}</span>
            </template>
          </span>

          <!-- A three-state segmented control, driven by LB / RB so the whole
               screen answers to the same two shoulder buttons every other
               stepper in the shell uses. -->
          <span class="con-ares__seg" role="group">
            <span v-for="opt in OPTIONS" :key="opt"
                  class="con-ares__seg-cell"
                  :class="{
                    'con-ares__seg-cell--on': deltaOf(row) === opt,
                    'con-ares__seg-cell--down': opt === -1,
                    'con-ares__seg-cell--up': opt === 1,
                  }">{{ segLabel(opt) }}</span>
          </span>

          <span class="con-ares__keys" aria-hidden="true">
            <template v-if="focusIdx === i">
              <GamepadGlyph control="bumperL" /><GamepadGlyph control="bumperR" />
            </template>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/*
 * PLANETARY EVENT THRESHOLDS — the console-native «Butterfly Effect» prompt:
 * move each threshold up to one step up or down.
 *
 * Diegetic and expansion-neutral (the word «Ares» never appears — it is the
 * name of a box, not of anything on Mars). Each row states the CONSEQUENCE
 * next to the number, because a threshold with no consequence is trivia: the
 * player is choosing when erosions appear, not editing a variable.
 *
 * data-motion-*: rides the shared `.con-shade` dim + the surface-motion
 * director — no own backdrop.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
/**
 * Presentation + the pad contract. WHICH rows exist, what each one means and
 * how a step maps onto its parameter live in the pure `compositePrompts`
 * adapter, so the rules are unit-tested without mounting this component.
 */
import {computed, onBeforeUnmount, PropType, ref, watch} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ShiftAresGlobalParametersModel} from '@/common/models/PlayerInputModel';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {clearPanelCommands, setPanelCommands} from '@/client/console/consolePanelUi';
import {
  AresDelta, AresDeltaKey, AresThresholdRow, aresResponse, aresResulting, aresThresholdRows,
} from '@/client/console/compositePrompts';
import ConsolePromptHead from '@/client/components/console/foundation/ConsolePromptHead.vue';
import {promptSequenceKey} from '@/client/console/promptSequence';
import {promptIdentityKey} from '@/client/console/turnIntents';

const OPTIONS: ReadonlyArray<AresDelta> = [-1, 0, 1];

defineOptions({name: 'ConsoleAresGlobals'});
const props = defineProps({
  playerView: {type: Object as PropType<PlayerViewModel>, required: true},
});
const emit = defineEmits(['submit', 'defer']);

const focusIdx = ref(0);
const deltas = ref<Partial<Record<AresDeltaKey, AresDelta>>>({});
const submitting = ref(false);

const model = computed((): ShiftAresGlobalParametersModel | undefined => {
  const wf = props.playerView.waitingFor;
  return wf?.type === 'aresGlobalParameters' ? (wf as ShiftAresGlobalParametersModel) : undefined;
});
const rows = computed((): ReadonlyArray<AresThresholdRow> => {
  return model.value === undefined ? [] : aresThresholdRows(model.value);
});
const changedCount = computed((): number => {
  return rows.value.filter((row) => deltaOf(row) !== 0).length;
});
const shiftedText = computed((): string => {
  return translateTextWithParams('Shifted: ${0}', [String(changedCount.value)]);
});
/** The decision's identity in the press's sequence (`promptSequence.ts`). */
const sequenceKey = computed((): string => {
  return model.value === undefined ? '' : promptSequenceKey(model.value, promptIdentityKey(model.value));
});
const promptKey = computed((): string => {
  return rows.value.map((r) => `${r.key}:${r.threshold}`).join('|');
});
const footCommands = computed((): Array<ConsoleCommand> => {
  return [
    {control: 'dpad', label: 'Navigate'},
    {control: 'bumperL', label: '−1'},
    {control: 'bumperR', label: '+1'},
    // ALWAYS enabled: leaving every threshold alone is a legitimate answer,
    // and a disabled confirm would read as "you must change something".
    {control: 'secondary', label: 'Apply'},
    {control: 'back', label: 'Minimize'},
  ];
});

function deltaOf(row: AresThresholdRow): AresDelta {
  return deltas.value[row.key] ?? 0;
}
function resultingOf(row: AresThresholdRow): number {
  return aresResulting(row, deltaOf(row));
}
function segLabel(opt: AresDelta): string {
  return opt === 0 ? '0' : opt > 0 ? '+1' : '−1';
}
function reset(): void {
  submitting.value = false;
  focusIdx.value = 0;
  deltas.value = {};
}
function handleIntent(intent: GamepadIntent): void {
  if (intent.kind === 'nav') {
    if (intent.dir === 'up' || intent.dir === 'down') {
      focusIdx.value = Math.min(rows.value.length - 1, Math.max(0, focusIdx.value + (intent.dir === 'down' ? 1 : -1)));
    } else {
      // Left / right nudge the focused threshold too — the segmented
      // control looks horizontal, so the d-pad must agree with it.
      step(intent.dir === 'right' ? 1 : -1);
    }
    return;
  }
  switch (consoleActionOf(intent)) {
  case 'prevSection':
    step(-1);
    return;
  case 'nextSection':
    step(1);
    return;
  case 'inspect': // X — apply
    apply();
    return;
  case 'back':
    emit('defer');
    return;
  default:
    return;
  }
}
/** Clamped to [−1, +1]: the rules allow ONE step per threshold. */
function step(delta: number): void {
  const row = rows.value[focusIdx.value];
  if (row === undefined) {
    return;
  }
  const next = Math.min(1, Math.max(-1, deltaOf(row) + delta)) as AresDelta;
  deltas.value = {...deltas.value, [row.key]: next};
}
function apply(): void {
  if (submitting.value) {
    return;
  }
  submitting.value = true;
  emit('submit', aresResponse(deltas.value));
}

watch(() => promptKey.value, () => {
  reset();
}, {immediate: true});
watch(() => props.playerView, () => {
  submitting.value = false;
});
watch(() => footCommands.value, (cmds: ReadonlyArray<ConsoleCommand>) => {
  setPanelCommands('aresGlobals', cmds);
}, {immediate: true, deep: true});
onBeforeUnmount(() => {
  clearPanelCommands('aresGlobals');
});

// What the shell's pad router reaches through the surface registry (`surfaces.at('aresGlobals')` → `handedTo`):
// `handleIntent` — and nothing else.
defineExpose({handleIntent});
</script>
