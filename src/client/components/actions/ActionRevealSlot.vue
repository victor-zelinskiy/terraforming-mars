<template>
  <!--
    Premium REVEAL slot for a deck-check action (SearchForLife / AsteroidDeflection-
    System). One reusable block in three states so the confirm flow reads as a
    single continuous reveal: BEFORE confirming an empty card-shaped slot + the
    condition being checked and the reward on a match; the brief PENDING bridge
    while the server reveals; and the RESULT — the revealed card with a calm
    success/fail marker + the concrete outcome. No debug look, no giant icons.
  -->
  <div class="action-reveal" :class="'action-reveal--' + state">
    <!-- The condition being checked + the reward on a match (empty + pending). -->
    <div v-if="state !== 'result' && reveal !== undefined" class="action-reveal__check">
      <span class="action-reveal__check-label" v-i18n>Looking for</span>
      <CardTag v-if="reveal.check.tag !== undefined" :index="0" :type="reveal.check.tag" class="action-reveal__check-tag" />
      <span class="action-reveal__check-arrow" aria-hidden="true">→</span>
      <ActionEffectChip :effect="reveal.reward" />
    </div>

    <!-- VP clarity (pre-confirm): a successful reveal either GAINS VP, or — when
         the card already scores its max (Search For Life already holds a science)
         — an amber warning that a repeat adds NO more VP. So the player never
         wonders why a second find didn't move their score. -->
    <div v-if="state !== 'result' && revealVp !== undefined"
         class="action-reveal__vp"
         :class="revealVpGain ? 'action-reveal__vp--gain' : 'action-reveal__vp--warn'">
      <template v-if="revealVpGain">
        <span class="action-reveal__vp-star" aria-hidden="true">★</span>
        <span class="action-reveal__vp-delta">+{{ revealVpDelta }}</span>
        <span class="action-reveal__vp-unit" v-i18n>VP</span>
        <span class="action-reveal__vp-suffix" v-i18n>on a successful reveal</span>
      </template>
      <template v-else>
        <span class="action-reveal__vp-glyph" aria-hidden="true">⚠</span>
        <span v-i18n>Victory points are already maxed — a repeat won't add any.</span>
      </template>
    </div>

    <!-- The card slot. Empty placeholder / pending pulse / the revealed card. -->
    <div class="action-reveal__slot"
         :class="{
           'action-reveal__slot--met': state === 'result' && result !== undefined && result.conditionMet,
           'action-reveal__slot--miss': state === 'result' && result !== undefined && !result.conditionMet,
         }">
      <div class="action-reveal__slot-corner action-reveal__slot-corner--tl" aria-hidden="true"></div>
      <div class="action-reveal__slot-corner action-reveal__slot-corner--br" aria-hidden="true"></div>

      <!-- EMPTY: a calm placeholder. -->
      <div v-if="state === 'empty'" class="action-reveal__placeholder">
        <span class="action-reveal__placeholder-glyph" aria-hidden="true">⤓</span>
        <span class="action-reveal__placeholder-text" v-i18n>Card opens here after confirming</span>
      </div>

      <!-- PENDING: the brief reveal bridge. -->
      <div v-else-if="state === 'pending'" class="action-reveal__pending">
        <span class="action-reveal__pending-ring" aria-hidden="true"></span>
        <span class="action-reveal__pending-text" v-i18n>Revealing card…</span>
      </div>

      <!-- RESULT: the revealed card. The success/fail is shown by the slot's
           green/red frame (above) + the ✓/✗ badge on the outcome line (below) —
           NOT an opaque marker OVER the card art (which collided with the card's
           tags/content and read as a broken semi-transparent overlay). -->
      <div v-else-if="state === 'result' && result !== undefined" class="action-reveal__card">
        <Card :card="result.revealed" />
      </div>
    </div>

    <!-- The outcome line (result only): the reward on a match, or a clear "nothing". -->
    <div v-if="state === 'result' && result !== undefined" class="action-reveal__outcome"
         :class="result.conditionMet ? 'action-reveal__outcome--met' : 'action-reveal__outcome--miss'">
      <span class="action-reveal__outcome-badge"
            :class="result.conditionMet ? 'action-reveal__outcome-badge--met' : 'action-reveal__outcome-badge--miss'"
            aria-hidden="true">{{ result.conditionMet ? '✓' : '✕' }}</span>
      <template v-if="result.conditionMet">
        <span class="action-reveal__outcome-label" v-i18n>Condition met</span>
        <ActionEffectChip v-if="result.reward !== undefined" :effect="result.reward" />
      </template>
      <span v-else class="action-reveal__outcome-label" v-i18n>Condition not met</span>
    </div>

    <!-- VP clarity (result): the score either went up (+N VP — the first science
         unlocking 3), or, on a match that didn't move it (already maxed), a calm
         "victory points unchanged" so the player understands the find was real but
         worth no extra points. Only when the condition was met. -->
    <div v-if="state === 'result' && result !== undefined && result.conditionMet && resultVp !== undefined"
         class="action-reveal__vp"
         :class="resultVpGain ? 'action-reveal__vp--gain' : 'action-reveal__vp--neutral'">
      <template v-if="resultVpGain">
        <span class="action-reveal__vp-star" aria-hidden="true">★</span>
        <span class="action-reveal__vp-delta">+{{ resultVpDelta }}</span>
        <span class="action-reveal__vp-unit" v-i18n>VP</span>
      </template>
      <span v-else v-i18n>Victory points unchanged</span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {ActionRevealDescriptor} from '@/common/models/ActionPreviewModel';
import {RevealResultModel} from '@/common/models/RevealResultModel';
import Card from '@/client/components/card/CardFace.vue';
import CardTag from '@/client/components/card/CardTag.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';

export default defineComponent({
  name: 'ActionRevealSlot',
  components: {Card, CardTag, ActionEffectChip},
  props: {
    // 'empty' (before confirm) | 'pending' (revealing) | 'result' (revealed).
    state: {
      type: String as PropType<'empty' | 'pending' | 'result'>,
      required: true,
    },
    // The condition + reward (for empty/pending). Absent in result state.
    reveal: {
      type: Object as PropType<ActionRevealDescriptor>,
      default: undefined,
    },
    // The live result (for result state).
    result: {
      type: Object as PropType<RevealResultModel>,
      default: undefined,
    },
  },
  computed: {
    // Pre-confirm VP context (now → after a successful reveal).
    revealVp(): {from: number, to: number} | undefined {
      return this.reveal?.vp;
    },
    revealVpGain(): boolean {
      return this.revealVp !== undefined && this.revealVp.to > this.revealVp.from;
    },
    revealVpDelta(): number {
      return this.revealVp === undefined ? 0 : this.revealVp.to - this.revealVp.from;
    },
    // Post-reveal VP context (before → after the actual reveal).
    resultVp(): {from: number, to: number} | undefined {
      return this.result?.vp;
    },
    resultVpGain(): boolean {
      return this.resultVp !== undefined && this.resultVp.to > this.resultVp.from;
    },
    resultVpDelta(): number {
      return this.resultVp === undefined ? 0 : this.resultVp.to - this.resultVp.from;
    },
  },
});
</script>
