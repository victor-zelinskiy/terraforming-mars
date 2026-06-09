<template>
  <Teleport to="body">
    <Transition name="aux-detail">
      <div
        v-if="group !== undefined && player !== undefined"
        class="additional-resource-detail-overlay"
        data-test="additional-resource-detail-overlay"
        @click.self="close">
        <div class="additional-resource-detail" :class="modeClass">
          <span class="additional-resource-detail__tick additional-resource-detail__tick--tl" aria-hidden="true"></span>
          <span class="additional-resource-detail__tick additional-resource-detail__tick--br" aria-hidden="true"></span>

          <header class="additional-resource-detail__header">
            <i class="card-resource additional-resource-detail__icon" :class="iconClass" aria-hidden="true"></i>
            <div class="additional-resource-detail__title">
              <div class="additional-resource-detail__name">{{ resourceName }}</div>
              <div class="additional-resource-detail__subtitle" v-i18n>Resources stored on cards</div>
            </div>
            <div class="additional-resource-detail__total">
              <span class="additional-resource-detail__total-label" v-i18n>Total</span>
              <span class="additional-resource-detail__total-value">
                {{ group.total }}
                <AnimatedMetricValue
                  :value="group.total"
                  :metricKey="totalMetricKey"
                  :scopeKey="detailScope"
                  :epoch="epoch"
                  variant="score" />
              </span>
            </div>
            <div class="additional-resource-detail__player" :class="'player_color_' + player.color">
              <span class="additional-resource-detail__player-dot" :class="'player_bg_color_' + player.color" aria-hidden="true"></span>
              <span class="additional-resource-detail__player-name">{{ isViewer ? $t('You') : player.name }}</span>
            </div>
            <button class="additional-resource-detail__close" type="button" :aria-label="$t('Close')" @click="close">✕</button>
          </header>

          <div class="additional-resource-detail__summary">
            <span class="additional-resource-detail__stat">
              <span class="additional-resource-detail__stat-label" v-i18n>Cards</span>
              <span class="additional-resource-detail__stat-value">{{ cardCount }}</span>
            </span>
            <span class="additional-resource-detail__stat-sep" aria-hidden="true"></span>
            <span class="additional-resource-detail__stat">
              <span class="additional-resource-detail__stat-label" v-i18n>With stock</span>
              <span class="additional-resource-detail__stat-value">{{ nonZeroCount }}</span>
            </span>
            <template v-if="hasScoring">
              <span class="additional-resource-detail__stat-sep" aria-hidden="true"></span>
              <span class="additional-resource-detail__stat additional-resource-detail__stat--vp">
                <span class="additional-resource-detail__stat-label" v-i18n>VP</span>
                <span class="additional-resource-detail__stat-value">{{ totalAccumulatedVp }}</span>
              </span>
            </template>
          </div>

          <div class="additional-resource-detail__body">
            <div class="additional-resource-detail__grid">
              <div
                v-for="s in summaries"
                :key="s.entry.name"
                class="additional-resource-detail__card"
                :class="{
                  'additional-resource-detail__card--zero': s.entry.amount === 0,
                  'additional-resource-detail__card--special': s.special !== undefined && s.special.replacesCardChrome === true,
                }"
                data-test="additional-resource-detail-card"
                @click.capture.stop="openZoom(s.entry.name)">
                <div class="additional-resource-detail__card-visual">
                  <Card :card="s.card" />
                </div>
                <!-- One cohesive info plate per card: PRIMARY count, then EITHER
                     a bespoke special-state marker OR the generic VP scoring. -->
                <div class="additional-resource-detail__card-foot">
                  <!-- PRIMARY: how many of the selected resource sit on this card. -->
                  <div class="additional-resource-detail__count" :class="{'additional-resource-detail__count--zero': s.entry.amount === 0}">
                    <i class="card-resource additional-resource-detail__count-icon" :class="iconClass" aria-hidden="true"></i>
                    <span class="additional-resource-detail__count-num">{{ s.entry.amount }}<AnimatedMetricValue
                      :value="s.entry.amount"
                      :metricKey="cardMetricKey(s.entry.name)"
                      :scopeKey="detailScope"
                      :epoch="epoch"
                      variant="misc" /></span>
                  </div>

                  <!-- SPECIAL: bespoke premium status marker (e.g. Search for Life). -->
                  <div v-if="s.special !== undefined"
                       class="additional-resource-detail__status"
                       :class="'additional-resource-detail__status--' + s.special.tone">
                    <span class="additional-resource-detail__status-glyph" aria-hidden="true">{{ s.special.tone === 'success' ? '✓' : '◦' }}</span>
                    <span class="additional-resource-detail__status-label" v-i18n>{{ s.special.label }}</span>
                    <span v-if="s.special.vp" class="additional-resource-detail__status-vp">+{{ s.special.vp }} <span v-i18n>VP</span></span>
                  </div>

                  <!-- SECONDARY: generic VP scoring shown as a NATURAL threshold rule
                       ("3 [res] = 1 VP", never a decimal) + accrued total + (for
                       threshold cards) progress toward the next VP. -->
                  <template v-else-if="s.scoring !== undefined">
                    <div class="additional-resource-detail__score">
                      <span class="additional-resource-detail__score-rate">
                        <span class="additional-resource-detail__score-amt">{{ s.scoring.per }}</span>
                        <i class="card-resource additional-resource-detail__score-icon" :class="iconClass" aria-hidden="true"></i>
                        <span class="additional-resource-detail__score-op">=</span>
                        <span class="additional-resource-detail__score-vp">{{ s.scoring.each }}</span>
                        <span class="additional-resource-detail__score-unit" v-i18n>VP</span>
                      </span>
                      <span class="additional-resource-detail__score-acc">
                        <span class="additional-resource-detail__score-acc-label" v-i18n>Accumulated</span>
                        <span class="additional-resource-detail__score-vp">{{ s.scoring.accumulated }}</span>
                        <span class="additional-resource-detail__score-unit" v-i18n>VP</span>
                      </span>
                    </div>
                    <div v-if="s.progress !== undefined" class="additional-resource-detail__progress" :aria-label="$t('Progress to next VP')">
                      <span class="additional-resource-detail__progress-track">
                        <span class="additional-resource-detail__progress-fill" :style="{width: s.progress.pct + '%'}"></span>
                      </span>
                      <span class="additional-resource-detail__progress-text">{{ s.progress.filled }}/{{ s.progress.per }}</span>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>

        <CardZoomModal
          ref="zoomModal"
          v-if="zoomCard !== undefined"
          :card="zoomCard"
          :cards="zoomCards"
          @navigate="zoomCard = $event"
          @close="zoomCard = undefined" />
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts">
import {defineComponent, PropType, nextTick} from 'vue';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {cardResourceCSS} from '@/client/components/common/cardResources';
import Card from '@/client/components/card/Card.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import AnimatedMetricValue from '@/client/components/feedback/AnimatedMetricValue.vue';
import {additionalResourceGroup, AdditionalResourceGroup, AdditionalResourceCardEntry, resourceScoring, accumulatedVp as calcAccumulatedVp} from '@/client/components/additionalResources/additionalResources';
import {specialResourceState, SpecialResourceState} from '@/client/components/additionalResources/additionalResourceSpecialCases';
import {additionalResourcesState, closeAdditionalResourceDetail} from '@/client/components/additionalResources/additionalResourcesState';

/**
 * Per-card info-plate descriptor, precomputed in `summaries` so the template
 * stays declarative + vue-tsc narrows cleanly. Exactly ONE of `special` /
 * `scoring` drives the secondary line; `progress` rides alongside `scoring`
 * for threshold cards (per > 1).
 */
interface CardResourceLine {
  readonly entry: AdditionalResourceCardEntry;
  readonly card: CardModel;
  readonly special?: SpecialResourceState;
  readonly scoring?: {readonly per: number; readonly each: number; readonly accumulated: number};
  readonly progress?: {readonly filled: number; readonly per: number; readonly pct: number};
}

export default defineComponent({
  name: 'AdditionalResourceDetailOverlay',
  components: {Card, CardZoomModal, AnimatedMetricValue},
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
  },
  data() {
    return {
      zoomCard: undefined as CardModel | undefined,
    };
  },
  computed: {
    resource(): CardResource | undefined {
      return additionalResourcesState.detailResource;
    },
    player(): PublicPlayerModel | undefined {
      const color = additionalResourcesState.detailPlayerColor;
      if (color === undefined) {
        return undefined;
      }
      return this.playerView.players.find((p) => p.color === color);
    },
    group(): AdditionalResourceGroup | undefined {
      if (this.resource === undefined || this.player === undefined) {
        return undefined;
      }
      return additionalResourceGroup(this.player.tableau, this.resource);
    },
    visible(): boolean {
      return this.group !== undefined && this.player !== undefined;
    },
    isViewer(): boolean {
      return this.player?.color === this.playerView.thisPlayer.color;
    },
    iconClass(): string {
      return this.resource === undefined ? '' : cardResourceCSS[this.resource];
    },
    resourceName(): string {
      return this.resource === undefined ? '' : this.$t(this.resource);
    },
    epoch(): string {
      return this.playerView.runId;
    },
    detailScope(): string {
      return `${this.player?.color ?? ''}-aux-detail`;
    },
    totalMetricKey(): string {
      return `card-resource.${this.resource}.detail-total`;
    },
    zoomCards(): ReadonlyArray<CardModel> {
      if (this.group === undefined) {
        return [];
      }
      return this.group.cards.map((entry) => this.cardModelFor(entry.name));
    },
    cardCount(): number {
      return this.group?.cards.length ?? 0;
    },
    nonZeroCount(): number {
      return this.group?.cards.filter((c) => c.amount > 0).length ?? 0;
    },
    // True when this resource yields VP anywhere — via generic scoring OR a
    // special-case status (e.g. Search for Life's "life found" 3 VP). Gates
    // the header's aggregate-VP stat (hidden entirely when nothing scores).
    hasScoring(): boolean {
      return this.summaries.some((s) => s.scoring !== undefined || (s.special?.vp ?? 0) > 0);
    },
    // Total VP this resource currently yields across all cards: each card's
    // exact accrued scoring VP, or its special-case VP — correct even when
    // cards mix threshold rates or special triggers.
    totalAccumulatedVp(): number {
      return this.summaries.reduce((sum, s) => sum + (s.scoring?.accumulated ?? s.special?.vp ?? 0), 0);
    },
    // Precomputed per-card info-plate descriptors. Bespoke special cards
    // (registry) win the secondary line; otherwise the generic VP scoring +
    // (for threshold cards) progress toward the next VP.
    summaries(): ReadonlyArray<CardResourceLine> {
      return (this.group?.cards ?? []).map((entry): CardResourceLine => {
        const special = specialResourceState(entry.name, entry.amount);
        const s = special === undefined ? resourceScoring(entry.name) : undefined;
        let scoring: CardResourceLine['scoring'];
        let progress: CardResourceLine['progress'];
        if (s !== undefined) {
          scoring = {per: s.per, each: s.each, accumulated: calcAccumulatedVp(entry.name, entry.amount)};
          if (s.per > 1) {
            const filled = entry.amount % s.per;
            progress = {filled, per: s.per, pct: Math.round((filled / s.per) * 100)};
          }
        }
        return {entry, card: this.cardModelFor(entry.name), special, scoring, progress};
      });
    },
    // Layout mode = number of source cards. Drives the modal's per-mode
    // max-width cap + card zoom (see additional_resources.less). The modal is
    // width:fit-content, so it hugs the real card row in every mode.
    layoutMode(): 'single' | 'double' | 'grid' | 'many' {
      const n = this.cardCount;
      if (n <= 1) {
        return 'single';
      }
      if (n === 2) {
        return 'double';
      }
      if (n <= 4) {
        return 'grid';
      }
      return 'many';
    },
    modeClass(): string {
      return `additional-resource-detail--${this.layoutMode}`;
    },
  },
  methods: {
    cardModelFor(name: CardName): CardModel {
      return this.player?.tableau.find((c) => c.name === name) ?? ({name} as CardModel);
    },
    cardMetricKey(name: CardName): string {
      return `card-resource.${this.resource}.card.${name}`;
    },
    openZoom(name: CardName): void {
      this.zoomCard = this.cardModelFor(name);
      nextTick(() => {
        (this.$refs.zoomModal as {show?: () => void} | undefined)?.show?.();
      });
    },
    close(): void {
      closeAdditionalResourceDetail();
    },
    onKeydown(e: KeyboardEvent): void {
      if (e.key !== 'Escape') {
        return;
      }
      // Let an open fullscreen card (native <dialog>) consume Escape first.
      if (document.querySelector('dialog[open]') !== null) {
        return;
      }
      if (this.visible) {
        this.close();
      }
    },
  },
  mounted() {
    window.addEventListener('keydown', this.onKeydown);
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.onKeydown);
  },
});
</script>
