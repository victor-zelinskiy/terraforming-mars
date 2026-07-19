<!--
@deprecated Desktop-only UI — FROZEN 2026-07-15. Do not develop further.
All UI work goes into console native (`?console=1`, ConsoleShell.vue); the next
desktop UI will be rebuilt from it. Unreachable from ConsoleShell, so changes
here cannot affect console. Fix only what breaks the shared layer or play.
See docs/DESKTOP_DEPRECATION_AUDIT.md + the deprecation banner in CLAUDE.md.
-->
<template>
  <div class="mb-panel">
    <div class="mb-panel__head">
      <span class="mb-panel__bot-glyph" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="7.5" width="14" height="10" rx="2.4" stroke="currentColor" stroke-width="1.6"/><path d="M12 7.5 V4.4 M12 4.4 L14 3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9.2" cy="12" r="1.5" fill="currentColor"/><circle cx="14.8" cy="12" r="1.5" fill="currentColor"/><path d="M9 15.4 H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </span>
      <span class="mb-panel__title">{{ $t('MarsBot') }}</span>
      <span class="mb-panel__difficulty" :class="'mb-panel__difficulty--' + automa.difficulty" v-i18n>{{ difficultyLabel }}</span>
    </div>

    <!-- Economy: the bot's ONLY resource is its M€ supply (+ floaters). -->
    <div class="mb-panel__rows">
      <div class="mb-panel__row">
        <i class="mb-panel__row-icon resource_icon resource_icon--megacredits" aria-hidden="true"></i>
        <span class="mb-panel__row-label" v-i18n>M€ supply</span>
        <span class="mb-panel__row-value">
          {{ player.megacredits }}
          <AnimatedMetricValue :value="player.megacredits" metricKey="megacredits.stock" :scopeKey="player.color" :epoch="epoch" variant="resource-stock" />
        </span>
      </div>
      <div v-if="showFloaters" class="mb-panel__row">
        <i class="mb-panel__row-icon card-resource card-resource-floater" aria-hidden="true"></i>
        <span class="mb-panel__row-label" v-i18n>Floaters</span>
        <span class="mb-panel__row-value">{{ automa.floaters }}</span>
      </div>
      <div class="mb-panel__row">
        <i class="mb-panel__row-icon resource_icon resource_icon--cards" aria-hidden="true"></i>
        <span class="mb-panel__row-label" v-i18n>Action deck</span>
        <span class="mb-panel__row-value">{{ automa.actionDeckSize }}</span>
      </div>
      <div class="mb-panel__row">
        <i class="mb-panel__row-icon resource_icon resource_icon--cards" aria-hidden="true"></i>
        <span class="mb-panel__row-label" v-i18n>Bonus deck</span>
        <span class="mb-panel__row-value">{{ automa.bonusDeckSize }}</span>
      </div>
    </div>

    <!-- Compact track readout: tag + progress + position. The full printed
         board (cell icons, regression markers) lives in the board overlay. -->
    <div class="mb-panel__tracks">
      <div v-for="(t, i) in automa.tracks" :key="i" class="mb-panel__track">
        <Tag v-if="tagOf(t) !== undefined" :tag="tagOf(t)!" size="med" type="secondary" />
        <span class="mb-panel__track-bar" aria-hidden="true">
          <span class="mb-panel__track-fill" :style="{width: fillPercent(t)}"></span>
        </span>
        <span class="mb-panel__track-pos">{{ t.position }}</span>
      </div>
    </div>

    <button type="button" class="mb-panel__board-btn" @click="$emit('open-board')">
      <span v-i18n>MarsBot board</span>
    </button>
  </div>
</template>

<script lang="ts">
/**
 * The MarsBot participant panel — replaces the human resource/tag cluster in
 * the left sidebar when the DISPLAYED player is the bot (a bot has no
 * production or resource stocks besides its M€ supply, so the ordinary table
 * would read as misleading zeros). Bot-specific state comes from the public
 * `GameModel.automa`; M€/TR ride the ordinary player model since the bot is a
 * real seat. The «MarsBot board» button opens the full printed board overlay.
 */
import {defineComponent, PropType} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {MarsBotModel, MarsBotTrackModel} from '@/common/models/MarsBotModel';
import {Tag as CardTag} from '@/common/cards/Tag';
import {DIFFICULTY_LABEL, trackTag} from './marsBotView';
import AnimatedMetricValue from '@/client/components/feedback/AnimatedMetricValue.vue';
import Tag from '@/client/components/Tag.vue';

export default defineComponent({
  name: 'MarsBotPanel',
  components: {AnimatedMetricValue, Tag},
  props: {
    player: {type: Object as PropType<PublicPlayerModel>, required: true},
    automa: {type: Object as PropType<MarsBotModel>, required: true},
    /** The playerView runId — the change-feedback epoch (same as the sidebar). */
    epoch: {type: String, default: ''},
  },
  emits: ['open-board'],
  computed: {
    difficultyLabel(): string {
      return DIFFICULTY_LABEL[this.automa.difficulty];
    },
    /** Floaters exist as a concept once Venus/Colonies tracks can grant them. */
    showFloaters(): boolean {
      return this.automa.floaters > 0 || this.automa.tracks.some((t) => t.layout.some((a) => a === 'floater' || a === 'floater2'));
    },
  },
  methods: {
    tagOf(track: MarsBotTrackModel): CardTag | undefined {
      return trackTag(track);
    },
    fillPercent(track: MarsBotTrackModel): string {
      if (track.maxPosition <= 0) {
        return '0%';
      }
      return `${Math.round((track.position / track.maxPosition) * 100)}%`;
    },
  },
});
</script>
