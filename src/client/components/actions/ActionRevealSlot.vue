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

      <!-- RESULT: the revealed card + a calm success/fail marker. -->
      <div v-else-if="state === 'result' && result !== undefined" class="action-reveal__card">
        <Card :card="result.revealed" />
        <span class="action-reveal__marker"
              :class="result.conditionMet ? 'action-reveal__marker--met' : 'action-reveal__marker--miss'"
              aria-hidden="true">{{ result.conditionMet ? '✓' : '✕' }}</span>
      </div>
    </div>

    <!-- The outcome line (result only): the reward on a match, or a clear "nothing". -->
    <div v-if="state === 'result' && result !== undefined" class="action-reveal__outcome"
         :class="result.conditionMet ? 'action-reveal__outcome--met' : 'action-reveal__outcome--miss'">
      <template v-if="result.conditionMet">
        <span class="action-reveal__outcome-label" v-i18n>Condition met</span>
        <ActionEffectChip v-if="result.reward !== undefined" :effect="result.reward" />
      </template>
      <template v-else>
        <span class="action-reveal__outcome-glyph" aria-hidden="true">—</span>
        <span class="action-reveal__outcome-label" v-i18n>Condition not met</span>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {ActionRevealDescriptor} from '@/common/models/ActionPreviewModel';
import {RevealResultModel} from '@/common/models/RevealResultModel';
import Card from '@/client/components/card/Card.vue';
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
});
</script>
