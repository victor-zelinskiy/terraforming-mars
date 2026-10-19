<template>
  <!--
    THE DOSSIER'S SCORE (TR60 · the Information polish of 2026-10-19 — «сдержанно и дорого»): ONE hero, then a quiet
    ledger. The TOTAL is the zone's protagonist — the award shield and the number at the scene's largest size, nothing
    else at its weight; under it the ONE composition bar (a thin instrument: one hue per category, widths on the
    positive total — the ceremony's `.con-eg-cat--*`), then the categories as a LEDGER in two columns read top-down: the
    category's own symbol in a small disc ringed in its hue (the colour key the bar uses), the name, a hairline leader,
    the value in tabular numerals. A zero stays a quiet row (an LB/RB switch morphs ink, never the layout); the hero
    yields size to a long ledger, never the frame (`--dscore-rows`), so nothing ever stands outside the plate.
    The `data-vpx-*` anchors are the score explorer's SHARED ELEMENTS (`scoreExplorerMotion`): the total and the bar
    fly between the zones on A / B, and the explorer's grid unfolds out of the ledger — so `[data-vpx-total]` keeps the
    explorer's own structure (number + unit) and the shield stands BESIDE it, never inside.
  -->
  <div class="con-dscore" data-dossier-score :style="{'--dscore-rows': rows}" :data-dscore-rows="rows">
    <div class="con-dscore__head">
      <ConsoleVpBadge class="con-dscore__shield" :label="$t('VP')" />
      <div class="con-infovp__totalrow con-dscore__totalrow" data-vpx-total>
        <span class="con-infovp__total con-dscore__total" data-dossier-total>{{ liveScore.total }}</span>
        <span class="con-infovp__total-label con-dscore__unit">{{ $t('VP') }}</span>
      </div>
    </div>
    <div class="con-infovp__bar con-dscore__bar" data-vpx-bar aria-hidden="true">
      <span v-for="seg in segments" :key="seg.key"
            class="con-infovp__seg" :class="'con-eg-cat--' + seg.accent"
            :style="{width: seg.widthPct + '%'}"></span>
    </div>
    <div class="con-infovp__legend con-dscore__ledger" data-vpx-block>
      <div v-for="m in medallions" :key="m.key"
           class="con-infovp__cat con-dscore__row"
           :class="['con-eg-cat--' + m.accent, {'con-infovp__cat--zero': m.zero, 'con-dscore__row--penalty': m.penalty}]"
           :data-dossier-medal="m.key" role="group" :aria-label="$t(m.label) + ': ' + m.value">
        <ConsoleScoreDisc :glyph="m.glyph" />
        <span class="con-dscore__label">{{ $t(m.short) }}</span>
        <span class="con-dscore__leader" aria-hidden="true"></span>
        <b class="con-dscore__value">{{ signed(m.value) }}</b>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {LiveScoreModel} from '@/client/console/liveScoreModel';
import {DossierMedallion} from '@/client/console/infoDossierModel';
import ConsoleVpBadge from '@/client/components/console/ConsoleVpBadge.vue';
import ConsoleScoreDisc from '@/client/components/console/info/ConsoleScoreDisc.vue';

export default defineComponent({
  name: 'ConsoleDossierScore',
  components: {ConsoleVpBadge, ConsoleScoreDisc},
  props: {
    liveScore: {type: Object as PropType<LiveScoreModel>, required: true},
    medallions: {type: Array as PropType<ReadonlyArray<DossierMedallion>>, required: true},
    segments: {type: Array as PropType<ReadonlyArray<{key: string, accent: string, widthPct: number}>>, required: true},
  },
  computed: {
    /** The ledger reads in TWO columns, top-down: its rows are half the categories (a lone category keeps one row). */
    rows(): number {
      return Math.max(1, Math.ceil(this.medallions.length / 2));
    },
  },
  methods: {
    /** A penalty reads with a true minus (U+2212), never a hyphen. */
    signed(value: number): string {
      return value < 0 ? `−${Math.abs(value)}` : String(value);
    },
  },
});
</script>
