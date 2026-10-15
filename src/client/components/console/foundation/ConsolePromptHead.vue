<template>
  <!-- THE PROMPT-MODAL HEAD — one header for every decision modal (`console_prompt.less`).
       Reading order is fixed on every surface:
         [crest]                                   the tone's band across the plate's top edge
         [emblem] CATEGORY · extra …  [РЕШЕНИЕ 2] [▲ ВЫГОДА | ▼ УБЫТОК]
         The ask (the server's sentence)            [decline plate]
         Why it appeared (the trigger)
       The crest is positioned against the PANEL (this header is deliberately not a positioned box), so it spans the
       plate edge to edge whatever padding the host uses. -->
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
      <span v-if="ordinal > 1" class="con-prompt-head__seq" data-prompt-seq :data-prompt-seq-ordinal="ordinal">{{ seqText }}</span>
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

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import ConsolePromptEmblem from '@/client/components/console/foundation/ConsolePromptEmblem.vue';
import {PromptTone, promptToneTagKey} from '@/client/console/promptTone';
import {PromptPresentation, presentPrompt, promptSequenceState, SETTLE_FOLLOW_MS, withdrawPrompt} from '@/client/console/promptSequence';
import {translateTextWithParams} from '@/client/directives/i18n';
import {promptHandoffDelayNow} from '@/client/console/surfaceMotion/promptHandoffModel';

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
export default defineComponent({
  name: 'ConsolePromptHead',
  components: {ConsolePromptEmblem},
  props: {
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
  },
  data() {
    return {
      presentation: undefined as PromptPresentation | undefined,
      /** 0 = idle; 1 / 2 alternate so the one-shot pulse replays on every absorbed press. */
      nudgePhase: 0,
      /** The nudge counter at presentation — only presses absorbed AFTER it pulse this head. */
      nudgeBase: 0,
      /** How long this plate WAITS before it arrives (a handoff from the decision before it — PL-384): the tone
       *  flip's beat starts once the plate is there, never under a plate still letting the last one go. Read at
       *  render, so the CSS delay is in place before the first style pass. */
      beatAt: promptHandoffDelayNow() ?? 0,
    };
  },
  computed: {
    tagKey(): string | undefined {
      return promptToneTagKey(this.tone);
    },
    ordinal(): number {
      return this.presentation?.ordinal ?? 1;
    },
    seqText(): string {
      return translateTextWithParams('Decision ${0}', [String(this.ordinal)]);
    },
    /** The character FLIPPED since the last decision of this chain — the one-shot beat plays. */
    shiftBeat(): boolean {
      return this.presentation?.toneShift === true;
    },
    /** THIS head's decision is still settling (the shell swallows its deciding presses). */
    settling(): boolean {
      return promptSequenceState.settling && this.presentation !== undefined &&
        promptSequenceState.current?.key === this.presentation.key;
    },
    /** The settle METER runs only for a follow-up — the double-tap guard of a first decision is too short to show. */
    meterMs(): number {
      const p = this.presentation;
      return p !== undefined && p.ordinal > 1 && p.settleMs >= SETTLE_FOLLOW_MS ? p.settleMs : 0;
    },
  },
  watch: {
    promptKey() {
      this.present();
    },
    tone() {
      this.present();
    },
    'promptSequenceState.nudge'(n: number) {
      if (this.settling && n > this.nudgeBase) {
        this.nudgePhase = this.nudgePhase === 1 ? 2 : 1;
      }
    },
  },
  setup() {
    return {promptSequenceState};
  },
  mounted() {
    this.present();
  },
  beforeUnmount() {
    if (this.presentation !== undefined) {
      withdrawPrompt(this.presentation.key);
    }
  },
  methods: {
    present(): void {
      if (this.promptKey === '') {
        this.presentation = undefined;
        return;
      }
      this.presentation = presentPrompt(this.promptKey, this.tone);
      this.beatAt = promptHandoffDelayNow() ?? 0;
      this.nudgeBase = promptSequenceState.nudge;
      this.nudgePhase = 0;
    },
  },
});
</script>
