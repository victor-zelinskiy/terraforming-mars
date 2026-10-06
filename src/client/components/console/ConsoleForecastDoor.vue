<template>
  <!--
    THE DOOR of the R3 «Эффекты» layer on a STAGE — the composers' «⚡ сработает»
    group (what the TABLE adds to this move, bare deltas, at most two chips +
    «+N») with the R3 key riding it: ONE flex item on the host's own chips line
    (the group never parts from its key), a click opens the layer exactly as
    R3 does. Rendered only while there is something to show; the key only while
    the host says the door may open (its setup level, nothing held). The host
    marks nothing else: the motion hooks find the door by `data-forecast-row`.
  -->
  <span v-if="reaction.chips.length > 0 || reaction.more > 0"
        class="con-fxdoor"
        :class="{'con-forecast--descend': pulse}"
        data-forecast-row
        @click="$emit('open')">
    <ConsoleForecastReactions :reaction="reaction" />
    <span v-if="canOpen" class="con-forecast__key" aria-hidden="true"><GamepadGlyph control="stickR" /></span>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {VariantReaction} from '@/client/console/effectForecastModel';
import ConsoleForecastReactions from '@/client/components/console/ConsoleForecastReactions.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

export default defineComponent({
  name: 'ConsoleForecastDoor',
  components: {ConsoleForecastReactions, GamepadGlyph},
  props: {
    /** The table's answer, compact (`reactionChipsOf(forecast.facts)`). */
    reaction: {type: Object as PropType<VariantReaction>, required: true},
    /** The host's setup level with nothing held — the key is drawn. */
    canOpen: {type: Boolean, default: false},
    /** The one-shot COMMIT flare (`pulseForecastDoor`). */
    pulse: {type: Boolean, default: false},
  },
  emits: ['open'],
});
</script>
