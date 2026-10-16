<template>
  <!--
    THE DOSSIER'S SCORE (TR60 — «ИНФОРМАЦИЯ — ДОСЬЕ, А НЕ ТАБЛИЦА»): the hero of the Information summary, in the score
    cell's and the finale's ONE language — the award shield, the total as the screen's loudest number, the one
    segmented bar (one hue per category, widths on the positive total — the ceremony's `.con-eg-cat--*`), and the
    categories as MEDALLIONS: the category's own symbol in a disc ringed in its hue, the value, the name. A zero
    stays in the grid as a quiet pose (an LB/RB switch morphs ink, never the layout).
    The `data-vpx-*` anchors are the score explorer's SHARED ELEMENTS (`scoreExplorerMotion`): the total and the bar
    fly between the zones on A / B, so `[data-vpx-total]` keeps the explorer's own structure (number + unit) — the
    shield stands BESIDE it, never inside.
  -->
  <div class="con-dscore" data-dossier-score>
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
    <div class="con-infovp__legend con-dscore__medals" data-vpx-block :style="{'--dscore-cols': columns}">
      <div v-for="m in medallions" :key="m.key"
           class="con-infovp__cat con-dscore__medal"
           :class="['con-eg-cat--' + m.accent, {'con-infovp__cat--zero': m.zero, 'con-dscore__medal--penalty': m.penalty}]"
           :data-dossier-medal="m.key" role="group" :aria-label="$t(m.label) + ': ' + m.value">
        <span class="con-dscore__disc" aria-hidden="true">
          <i v-if="m.glyph.kind === 'icon'" class="con-dscore__glyph" :class="iconClass(m.glyph.icon)"></i>
          <i v-else-if="m.glyph.kind === 'tile'" class="con-dscore__glyph con-dscore__glyph--tile" :class="'con-dscore__glyph--' + m.glyph.tile"></i>
          <span v-else-if="m.glyph.kind === 'emblems'" class="con-dscore__emblems" :data-emblems="m.glyph.slugs.length">
            <img v-for="slug in m.glyph.slugs" :key="slug" class="con-dscore__emblem" :src="maArt(slug)" alt="" />
          </span>
          <i v-else class="con-dscore__glyph con-dscore__glyph--mark"></i>
        </span>
        <b class="con-dscore__value">{{ m.value }}</b>
        <span class="con-dscore__label">{{ $t(m.short) }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {LiveScoreModel} from '@/client/console/liveScoreModel';
import {DossierMedallion} from '@/client/console/infoDossierModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import ConsoleVpBadge from '@/client/components/console/ConsoleVpBadge.vue';

export default defineComponent({
  name: 'ConsoleDossierScore',
  components: {ConsoleVpBadge},
  props: {
    liveScore: {type: Object as PropType<LiveScoreModel>, required: true},
    medallions: {type: Array as PropType<ReadonlyArray<DossierMedallion>>, required: true},
    segments: {type: Array as PropType<ReadonlyArray<{key: string, accent: string, widthPct: number}>>, required: true},
  },
  computed: {
    /** ONE row of medallions for the six core categories (the finale's podium line); a table with more splits evenly in two. */
    columns(): number {
      const n = this.medallions.length;
      return n <= 6 ? Math.max(n, 1) : Math.ceil(n / 2);
    },
  },
  methods: {
    iconClass(icon: string): string {
      return iconClassFor(icon);
    },
    maArt(slug: string): string {
      return `assets/ma/${slug}.png`;
    },
  },
});
</script>
