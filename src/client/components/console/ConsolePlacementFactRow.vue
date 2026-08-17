<template>
  <!--
    ONE row of the console placement dossier — a BoardFact as an icon/value
    composition: the statement reads left (reading face), the change reads
    right (display face, tabular), and the row carries NO capsule of its own —
    the panel is one shell, severity speaks through colour and the value.
  -->
  <div class="con-dossier-row" :class="'con-dossier-row--' + fact.severity">
    <div class="con-dossier-row__main">
      <div class="con-dossier-row__title" v-i18n="fact.params">{{ fact.title }}</div>
      <div v-if="fact.description !== undefined" class="con-dossier-row__desc" v-i18n="fact.params">{{ fact.description }}</div>
      <div v-if="sourceLabel !== undefined" class="con-dossier-row__src" v-i18n>{{ sourceLabel }}</div>
    </div>

    <div class="con-dossier-row__val">
      <!-- Resource / parameter delta: icon + `N → M` (or ±N). A PRODUCTION
           change wears the game's own brown production frame — including the
           Ares «production of your choice» penalty, whose honest sprite is the
           EMPTY frame (there is no single resource to draw). -->
      <span v-if="delta !== undefined" class="con-dossier-row__delta" :class="deltaToneClass">
        <span v-if="delta.production === true" class="con-dossier-row__prod" aria-hidden="true">
          <span v-if="deltaIconClass !== ''" class="con-dossier-row__ico" :class="deltaIconClass"></span>
        </span>
        <span v-else-if="deltaIconClass !== ''" class="con-dossier-row__ico" :class="deltaIconClass" aria-hidden="true"></span>
        <span class="con-dossier-row__nums">
          <template v-if="hasRange">
            <span class="con-dossier-row__cur">{{ delta.current }}{{ unit }}</span>
            <span class="con-dossier-row__arrow" aria-hidden="true">→</span>
            <span class="con-dossier-row__res">{{ delta.resulting }}{{ unit }}</span>
          </template>
          <span v-else class="con-dossier-row__amt">{{ sign }}{{ delta.amount }}{{ unit }}</span>
        </span>
      </span>

      <!-- Endgame VP — the gold badge (identity as TYPE: there is no VP sprite). -->
      <span v-if="vpAmount !== undefined && vpAmount !== 0"
            class="con-dossier-row__vp" :class="{'con-dossier-row__vp--neg': vpAmount < 0}">
        {{ vpAmount < 0 ? '−' : '+' }}{{ Math.abs(vpAmount) }} <i>{{ $t('VP') }}</i>
      </span>

      <!-- Milestone / award standing: `from → to (/target)` + the micro track
           when the threshold reads as one. -->
      <span v-if="fact.progress !== undefined" class="con-dossier-row__prog"
            :class="{'con-dossier-row__prog--reached': progressReached}">
        <span class="con-dossier-row__prog-nums">
          <span class="con-dossier-row__cur">{{ fact.progress.from }}</span>
          <span class="con-dossier-row__arrow" aria-hidden="true">→</span>
          <span class="con-dossier-row__res">{{ fact.progress.to }}</span>
          <span v-if="fact.progress.target !== undefined" class="con-dossier-row__prog-tgt">/{{ fact.progress.target }}</span>
        </span>
        <span v-if="track !== undefined" class="con-dossier-row__track" aria-hidden="true">
          <i v-for="(cell, i) in track" :key="i" :class="'con-dossier-row__seg con-dossier-row__seg--' + cell"></i>
        </span>
      </span>

      <span v-if="timingKey !== undefined" class="con-dossier-row__when">{{ $t(timingKey) }}</span>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * Presentation only — every copy/visibility decision lives in the pure
 * `placementDossier` model, so the row template makes none of its own.
 */
import {defineComponent, PropType} from 'vue';
import {BoardFact, BoardFactTiming} from '@/common/boards/BoardInformationFacts';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {progressTrack, rowSourceLabel, rowTimingKey} from '@/client/console/placementDossier';

export default defineComponent({
  name: 'ConsolePlacementFactRow',
  props: {
    fact: {type: Object as PropType<BoardFact>, required: true},
    /** Timings the hosting section head already states (tag suppression). */
    stated: {type: Array as PropType<ReadonlyArray<BoardFactTiming>>, default: () => []},
  },
  computed: {
    Math() {
      return Math;
    },
    delta() {
      return this.fact.delta;
    },
    deltaIconClass(): string {
      return this.delta !== undefined ? iconClassFor(this.delta.icon) : '';
    },
    hasRange(): boolean {
      return this.delta?.current !== undefined && this.delta?.resulting !== undefined;
    },
    unit(): string {
      return this.delta?.unit ?? '';
    },
    sign(): string {
      return this.delta?.direction === 'cost' ? '−' : '+';
    },
    deltaToneClass(): string {
      if (this.fact.severity === 'danger') {
        return 'con-dossier-row__delta--danger';
      }
      return this.delta?.direction === 'cost' ? 'con-dossier-row__delta--cost' : 'con-dossier-row__delta--gain';
    },
    vpAmount(): number | undefined {
      return this.fact.vp !== undefined ? this.fact.vp.to - this.fact.vp.from : undefined;
    },
    progressReached(): boolean {
      const p = this.fact.progress;
      return p !== undefined && p.target !== undefined && p.to >= p.target;
    },
    track() {
      return progressTrack(this.fact.progress);
    },
    timingKey(): string | undefined {
      return rowTimingKey(this.fact, this.stated);
    },
    sourceLabel(): string | undefined {
      return rowSourceLabel(this.fact);
    },
  },
});
</script>
