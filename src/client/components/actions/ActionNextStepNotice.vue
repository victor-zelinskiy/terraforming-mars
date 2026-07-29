<template>
  <!--
    "What happens next" notice — the context for a follow-up the modal can't pre-
    collect (a tile placement, a colony pick, a special board move). Shown in TWO
    surfaces: the details panel as a PREVIEW ("Далее" / variant 'next', present
    tense) and the confirmation modal as a final EXECUTION reminder ("После
    подтверждения" / variant 'after-confirm'). So the player always knows what
    confirming will require. Extracted from CardActionConfirmContent so both
    surfaces share one source of copy.
  -->
  <div v-if="notes.length > 0 || warnings.length > 0">
    <!-- WARNING — an effect that will be SKIPPED for lack of a valid target. Orange,
         and it NAMES which effect (+ the magnitude lost as a muted chip), so the
         player is never surprised by — nor left guessing about — a lost effect. -->
    <SkippedEffectWarning v-for="(w, i) in warnings" :key="'w' + i" :step="w" class="action-next__warn" />
    <div v-if="notes.length > 0" class="action-next" :class="'action-next--' + variant">
      <span class="action-next__label" v-i18n>{{ variant === 'next' ? 'Next' : 'After confirming' }}</span>
      <div v-for="(note, i) in notes" :key="i" class="action-next__item">
        <span class="action-next__glyph" aria-hidden="true">◎</span>
        <!-- Pre-translated in JS (a named tile interpolates its name), so NO
             `v-i18n` here — it would re-translate an already-Russian string. -->
        <span class="action-next__text">{{ noteText(note) }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Message} from '@/common/logs/Message';
import {ActionPreviewStep} from '@/common/models/ActionPreviewModel';
import SkippedEffectWarning from '@/client/components/actions/SkippedEffectWarning.vue';
import {isSkippedWarning} from '@/client/components/actions/skippedEffectView';
import {BoardPlacementStep, placementRow} from '@/client/console/consolePlacementNextStep';
import {consoleTranslate} from '@/client/console/consoleTranslate';
import {translateMessage, translateText} from '@/client/directives/i18n';

type NoteStep = {kind: string, placementType?: string, noteKind?: string, text?: string | Message, resource?: string};

export default defineComponent({
  name: 'ActionNextStepNotice',
  components: {SkippedEffectWarning},
  props: {
    // The branch's steps — only the non-interactive context notes (boardPlacement /
    // note) are surfaced; interactive inputs (payment/target) live elsewhere.
    steps: {
      type: Array as PropType<ReadonlyArray<ActionPreviewStep>>,
      default: () => [],
    },
    // 'next' (details preview, present tense) | 'after-confirm' (modal reminder).
    variant: {
      type: String as PropType<'next' | 'after-confirm'>,
      default: 'after-confirm',
    },
  },
  computed: {
    // Context notes (placement / colony / board move) — the "what happens next" list.
    notes(): ReadonlyArray<NoteStep> {
      return (this.steps ?? []).filter((s) => (s.kind === 'boardPlacement' || s.kind === 'note') && !isSkippedWarning(s)) as ReadonlyArray<NoteStep>;
    },
    // Skipped-effect warnings — rendered above the notes by the shared
    // SkippedEffectWarning block, which names WHICH effect is lost.
    warnings(): ReadonlyArray<ActionPreviewStep> {
      return (this.steps ?? []).filter(isSkippedWarning);
    },
  },
  methods: {
    text(m: string | Message): string {
      return typeof m === 'string' ? translateText(m) : translateMessage(m);
    },
    /**
     * The finished line for one step. A tile PLACEMENT goes through the shared
     * `consolePlacementNextStep` presenter, so both shells name the same tile
     * («особый тайл «Солнечная электростанция»») from the same TileType — the
     * copy table is not duplicated here. A `note` keeps its canned per-variant
     * wording (it is a step that places no tile).
     */
    noteText(step: NoteStep): string {
      const after = this.variant === 'after-confirm';
      if (step.kind === 'note') {
        if (step.text !== undefined) {
          return this.text(step.text);
        }
        switch (step.noteKind) {
        case 'colony': return translateText(after ? 'After confirming, choose a colony.' : 'Next: choose a colony.');
        case 'board': return translateText(after ? 'After confirming, choose a location on the board.' : 'Next: choose a location on the board.');
        default: return translateText(after ? 'After confirming, you will make one more choice.' : 'Next: one more choice.');
        }
      }
      const row = placementRow(step as BoardPlacementStep, consoleTranslate, (m) => this.text(m));
      return row.full;
    },
  },
});
</script>
