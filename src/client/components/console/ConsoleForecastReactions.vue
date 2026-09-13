<template>
  <!--
    THE «⚡ сработает» GROUP inside an «ИЛИ» option card — what the TABLE adds
    if THIS branch is chosen (the forecast's `byBranch[pos]`), drawn on the
    SAME line as the option's own chips, past a thin vertical seam, with the
    zone's own caption in miniature: the effects bolt + the word «сработает».
    The same language as the «Сработает» row (one legend, learnt by adjacency),
    scaled to a note. Bare deltas only; at most two chips + «+N»; the group is
    ONE flex item, so when the line runs out it wraps WHOLE — the caption never
    parts from its chips. The row below never repeats these chips.
  -->
  <span v-if="reaction.chips.length > 0 || reaction.more > 0"
        class="con-forecast__vfx"
        role="note"
        :aria-label="ariaLabel"
        data-forecast-vfx>
    <span class="con-forecast__vfx-sep" aria-hidden="true"></span>
    <span class="con-forecast__vfx-head">
      <span class="con-forecast__bolt" aria-hidden="true">⚡</span>
      <span class="con-forecast__vfx-label">{{ $t('Will trigger') }}</span>
    </span>
    <span v-for="rc in reaction.chips" :key="rc.key + '|' + rc.effect.amount"
          class="con-forecast__chip con-forecast__vfx-chip"
          :class="chipClasses(rc)"
          data-forecast-vchip>
      <span v-if="rc.color !== undefined" class="con-forecast__owner-bar" :class="'player_bg_color_' + rc.color" aria-hidden="true"></span>
      <span v-if="rc.color !== undefined" class="con-forecast__owner-dot" :class="'player_bg_color_' + rc.color" aria-hidden="true"></span>
      <ActionEffectChip :effect="rc.effect" />
      <span v-if="rc.asks" class="con-forecast__ask" aria-hidden="true">?</span>
    </span>
    <span v-if="reaction.more > 0" class="con-forecast__more con-forecast__vfx-more" data-forecast-vchip>+{{ reaction.more }}</span>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {VariantReaction, VariantReactionChip} from '@/client/console/effectForecastModel';
import {translateText} from '@/client/directives/i18n';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';

export default defineComponent({
  name: 'ConsoleForecastReactions',
  components: {ActionEffectChip},
  props: {
    /** The branch's reactions (the pure model's `variantReactionChips`). */
    reaction: {type: Object as PropType<VariantReaction>, required: true},
  },
  computed: {
    ariaLabel(): string {
      return `${translateText('Will trigger')}: ${this.reaction.total}`;
    },
  },
  methods: {
    /** The row's chip vocabulary: whose (own / other seat), the degree («?»),
     *  the pool (production plate), the tone (a loss wears the spend tone). */
    chipClasses(rc: VariantReactionChip): Record<string, boolean> {
      return {
        'con-forecast__chip--own': rc.color === undefined && !rc.asks,
        'con-forecast__chip--asks': rc.asks,
        'con-forecast__chip--other': rc.color !== undefined,
        'con-forecast__chip--bot': rc.bot === true,
        'con-forecast__chip--loss': rc.effect.direction === 'cost',
        'con-forecast__chip--production': rc.production,
      };
    },
  },
});
</script>
