<template>
  <header class="con-prompt-head"
          :class="[
            'con-prompt-head--' + tone,
            {
              'con-prompt-head--shift': shiftBeat,
              'con-prompt-head--settling': settling,
              'con-prompt-head--nudge-a': nudgePhase === 1,
              'con-prompt-head--nudge-b': nudgePhase === 2,
            },
          ]"
          :style="beatAt > 0 ? {'--con-prompt-beat-at': beatAt + 'ms'} : undefined"
          :data-prompt-tone="tone"
          :data-prompt-ordinal="presentation?.ordinal"
          :data-prompt-shift="shiftBeat ? '1' : undefined"
          :data-prompt-settling="settling ? '1' : undefined">
    <span class="con-prompt-head__crest" aria-hidden="true">
      <span v-if="meterMs > 0" class="con-prompt-head__settle" :key="'settle' + (presentation?.nonce ?? 0)"
            :style="{animationDuration: meterMs + 'ms'}" data-prompt-settle></span>
    </span>
    <div class="con-prompt-head__kicker">
      <ConsolePromptEmblem :tone="tone" class="con-prompt-head__emblem" />
      <span class="con-prompt-head__category">{{ kicker }}</span>
      <slot name="kicker-extra" />
      <!-- ONE count: a question that is one of a SERIES (PC04 — the server's `choiceContext.series`) counts «МЕТКА k / N»
           in the very place the press's «РЕШЕНИЕ N» stands, never beside it. -->
      <span v-if="series !== undefined" class="con-prompt-head__seq" data-prompt-seq
            :data-series-count="series.index + ' / ' + series.of">{{ seriesText }}</span>
      <span v-else-if="ordinal > 1" class="con-prompt-head__seq" data-prompt-seq :data-prompt-seq-ordinal="ordinal">{{ seqText }}</span>
      <span v-if="tagKey !== undefined" class="con-prompt-head__tag" :class="'con-prompt-head__tag--' + tone" data-prompt-tag>
        <span class="con-prompt-head__tag-sign" aria-hidden="true">{{ tone === 'gain' ? '▲' : '▼' }}</span>
        <span>{{ $t(tagKey) }}</span>
      </span>
    </div>
    <div class="con-prompt-head__ask">
      <component :is="titleTag" class="con-prompt-head__title">{{ title }}</component>
      <slot name="decline" />
    </div>
    <p v-if="trigger !== ''" class="con-prompt-head__trigger">{{ trigger }}</p>
    <slot />
  </header>
</template>

<script setup vapor lang="ts">
/*
 * THE PROMPT-MODAL HEAD — one header for every decision modal (`console_prompt.less`).
 * Reading order is fixed on every surface:
 *   [crest]                                   the tone's band across the plate's top edge
 *   [emblem] CATEGORY · extra …  [РЕШЕНИЕ 2] [▲ ВЫГОДА | ▼ УБЫТОК]
 *   The ask (the server's sentence)            [decline plate]
 *   Why it appeared (the trigger)
 * The crest is positioned against the PANEL (this header is deliberately not a positioned box), so it spans the
 * plate edge to edge whatever padding the host uses.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, onBeforeUnmount, onMounted, PropType, ref, watch} from 'vue';
import ConsolePromptEmblem from '@/client/components/console/foundation/ConsolePromptEmblem.vue';
import {PromptTone, promptToneTagKey} from '@/client/console/promptTone';
import {PromptPresentation, presentPrompt, promptSequenceState, SETTLE_FOLLOW_MS, withdrawPrompt} from '@/client/console/promptSequence';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {promptHandoffDelayNow} from '@/client/console/surfaceMotion/promptHandoffModel';
import {GrantSeries} from '@/common/models/PlayerInputModel';
import {choiceSeriesCount} from '@/client/console/promptSeries';

/**
 * @console-shared LIVE — the ONE head of the prompt-modal family.
 *
 * It is also the family's ONE registration point with the decision sequence
 * (`promptSequence.ts`): presenting a decision here is what gives it its
 * ordinal, its tone-shift beat and its settle window, so no surface can stand
 * a decision on screen without the inertia guard. A host passes `promptKey`
 * (`promptSequenceKey(...)`); an empty key opts out (a non-decision surface
 * borrowing the head's look).
 */
defineOptions({name: 'ConsolePromptHead'});
const props = defineProps({
  tone: {type: String as PropType<PromptTone>, required: true},
  /** The CATEGORY (already translated) — `consoleTaskSummary`'s kicker, the surface's own eyebrow. */
  kicker: {type: String, required: true},
  /** The ask — the server's sentence, already translated. */
  title: {type: String, required: true},
  /** Why the decision appeared (the `choiceContext` trigger), already translated. */
  trigger: {type: String, default: ''},
  /** The decision's identity in the sequence ('' = not a decision — no ordinal, no settle). */
  promptKey: {type: String, default: ''},
  titleTag: {type: String, default: 'h2'},
  /** The question's place in a SERIES (`choiceContext.series` — PC04), when it is one; read by `choiceSeriesOf`. */
  series: {type: Object as PropType<GrantSeries | undefined>, default: undefined},
});

const presentation = ref<PromptPresentation | undefined>(undefined);
/** 0 = idle; 1 / 2 alternate so the one-shot pulse replays on every absorbed press. */
const nudgePhase = ref(0);
/** The nudge counter at presentation — only presses absorbed AFTER it pulse this head. */
const nudgeBase = ref(0);
/** How long this plate WAITS before it arrives (a handoff from the decision before it — PL-384): the tone
 *  flip's beat starts once the plate is there, never under a plate still letting the last one go. Read at
 *  render, so the CSS delay is in place before the first style pass. */
const beatAt = ref(promptHandoffDelayNow() ?? 0);
const tagKey = computed((): string | undefined => {
  return promptToneTagKey(props.tone);
});
const ordinal = computed((): number => {
  return presentation.value?.ordinal ?? 1;
});
const seqText = computed((): string => {
  return translateTextWithParams('Decision ${0}', [String(ordinal.value)]);
});
const seriesText = computed((): string => {
  if (props.series === undefined) {
    return '';
  }
  const count = choiceSeriesCount(props.series);
  return translateTextWithParams(count.key, [...count.params]);
});
/** The character FLIPPED since the last decision of this chain — the one-shot beat plays. */
const shiftBeat = computed((): boolean => {
  return presentation.value?.toneShift === true;
});
/** THIS head's decision is still settling (the shell swallows its deciding presses). */
const settling = computed((): boolean => {
  return promptSequenceState.settling && presentation.value !== undefined &&
    promptSequenceState.current?.key === presentation.value.key;
});
/** The settle METER runs only for a follow-up — the double-tap guard of a first decision is too short to show. */
const meterMs = computed((): number => {
  const p = presentation.value;
  return p !== undefined && p.ordinal > 1 && p.settleMs >= SETTLE_FOLLOW_MS ? p.settleMs : 0;
});
function present(): void {
  if (props.promptKey === '') {
    presentation.value = undefined;
    return;
  }
  presentation.value = presentPrompt(props.promptKey, props.tone);
  beatAt.value = promptHandoffDelayNow() ?? 0;
  nudgeBase.value = promptSequenceState.nudge;
  nudgePhase.value = 0;
}

watch(() => props.promptKey, () => {
  present();
});
watch(() => props.tone, () => {
  present();
});
watch(() => promptSequenceState.nudge, (n: number) => {
  if (settling.value && n > nudgeBase.value) {
    nudgePhase.value = nudgePhase.value === 1 ? 2 : 1;
  }
});
onMounted(() => {
  present();
});
onBeforeUnmount(() => {
  if (presentation.value !== undefined) {
    withdrawPrompt(presentation.value.key);
  }
});
</script>
