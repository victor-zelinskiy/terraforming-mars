<template>
  <!--
    CONSOLE MA INSPECT — the console-native READER for a single milestone /
    award (X → «Осмотреть» on the premium M/A dashboard). The dashboard cards
    clamp their rule text to fit the no-scroll grid; THIS full-screen premium
    surface shows the WHOLE description (never truncated) on a hero art stage,
    so even the wordiest awards can be read in full. Read-only: A sponsors /
    claims when the item is available right now (hands off to the existing
    confirm), B closes back to the dashboard. Nothing is submitted here.
  -->
  <div class="con-mainspect" role="dialog" :aria-label="$t(displayName)">
    <div class="con-mainspect__backdrop" aria-hidden="true"></div>
    <div class="con-mainspect__card" :class="'con-mainspect__card--' + item.kind">
      <div class="con-mainspect__kicker">
        <span class="con-mainspect__kicker-mark" aria-hidden="true">{{ item.kind === 'milestone' ? '✦' : '❖' }}</span>
        <span>{{ $t(item.kind === 'milestone' ? 'Achievement' : 'Award') }}</span>
      </div>

      <!-- Hero: the 512×512 premium icon + name + the live status line. -->
      <div class="con-mainspect__hero">
        <div class="con-mainspect__stage" aria-hidden="true">
          <MaHeroArt :name="item.name" :kind="item.kind" class="con-mainspect__art" />
        </div>
        <div class="con-mainspect__head">
          <div class="con-mainspect__name" v-i18n>{{ displayName }}</div>
          <div v-if="item.takenBy !== undefined" class="con-mainspect__status con-mainspect__status--owner">
            <span class="con-mainspect__dot" :class="'player_bg_color_' + item.takenBy.color" aria-hidden="true"></span>
            <span>{{ $t(item.kind === 'milestone' ? 'claimed by' : 'funded by') }} {{ item.takenBy.name }}</span>
          </div>
          <div v-else-if="item.available" class="con-mainspect__status con-mainspect__status--ready">
            <span aria-hidden="true">✦</span>
            <span>{{ $t(item.kind === 'milestone' ? 'Threshold reached — claim now' : 'Ready to fund now') }}</span>
          </div>
          <div v-else-if="item.blocker !== ''" class="con-mainspect__status con-mainspect__status--blocked">
            <span>{{ $t(item.blocker) }}</span>
          </div>
        </div>
      </div>

      <!-- The whole rule text — NEVER clamped (the reason this surface exists). -->
      <div class="con-mainspect__desc con-info__scroll" v-i18n>{{ item.description }}</div>

      <!-- The live standings: the viewer's score (+ threshold/meter for a
           milestone) and the rivals — the same data the card carries. -->
      <div class="con-mainspect__stats">
        <div class="con-mainspect__you" :class="metricClass">
          <span class="con-mainspect__you-label">{{ $t('You') }}</span>
          <span class="con-mainspect__you-value">
            <template v-if="item.scores.length === 0">—</template>
            <template v-else><b>{{ item.myScore }}</b><span v-if="item.threshold !== undefined" class="con-mainspect__you-req">/{{ item.threshold }}</span></template>
          </span>
          <span v-if="item.kind === 'award' && item.scores.length > 0" class="con-mainspect__you-sub">
            <template v-if="item.myLead">{{ $t('You lead') }}</template>
            <template v-else>{{ $t('Leader') }}: {{ item.leaderScore }}</template>
          </span>
          <span v-if="item.threshold !== undefined && item.scores.length > 0" class="con-mainspect__meter" aria-hidden="true"><i :style="{width: meterWidth}"></i></span>
        </div>
        <div v-if="rivals.length > 0" class="con-mainspect__rivals">
          <span class="con-mainspect__rivals-label">{{ $t('Rivals') }}</span>
          <span v-for="s in rivals" :key="s.color"
                class="con-mainspect__rival"
                :class="rivalClasses(s)">{{ s.score }}</span>
        </div>
      </div>

      <footer class="con-mainspect__foot" aria-hidden="true">
        <span v-if="item.available" class="con-mainspect__foot-item con-mainspect__foot-item--go">
          <GamepadGlyph control="confirm" /><span>{{ $t(item.kind === 'milestone' ? 'Claim' : 'Fund') }}</span>
        </span>
        <span class="con-mainspect__foot-item"><GamepadGlyph control="back" /><span>{{ $t('Close') }}</span></span>
      </footer>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import MaHeroArt from '@/client/components/ma/MaHeroArt.vue';
import {$t} from '@/client/directives/i18n';
import {ConsoleMaItem, ConsoleMaScore} from '@/client/components/console/consoleMaModel';

export default defineComponent({
  name: 'ConsoleMaInspect',
  components: {GamepadGlyph, MaHeroArt},
  props: {
    item: {type: Object as PropType<ConsoleMaItem>, required: true},
  },
  computed: {
    /** Strip the numeric variant suffix (Terraformer26 → Terraformer). */
    displayName(): string {
      return this.item.name.replace(/[0-9]+$/, '');
    },
    rivals(): ReadonlyArray<ConsoleMaScore> {
      return [...this.item.scores].filter((s) => s.color !== this.item.myColor).sort((a, b) => b.score - a.score);
    },
    metricClass(): string {
      if (this.item.kind === 'award') {
        return this.item.myLead ? 'con-mainspect__you--lead' : '';
      }
      return this.item.myReady && this.item.scores.length > 0 ? 'con-mainspect__you--ready' : '';
    },
    meterWidth(): string {
      const t = this.item.threshold ?? 0;
      if (t <= 0) {
        return '0%';
      }
      return `${Math.min(100, Math.round((this.item.myScore / t) * 100))}%`;
    },
  },
  methods: {
    $t,
    rivalClasses(s: ConsoleMaScore): Array<string> {
      const classes = ['player_bg_color_' + s.color];
      if (this.item.kind === 'award' && s.score === this.item.leaderScore && s.score > 0) {
        classes.push('con-mainspect__rival--leader');
      }
      if (this.item.kind === 'milestone' && s.claimable === true) {
        classes.push('con-mainspect__rival--ready');
      }
      return classes;
    },
  },
});
</script>
