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
          </div>

          <div class="additional-resource-detail__body">
            <div class="additional-resource-detail__grid">
              <div
                v-for="entry in group.cards"
                :key="entry.name"
                class="additional-resource-detail__card"
                :class="{'additional-resource-detail__card--zero': entry.amount === 0}"
                data-test="additional-resource-detail-card"
                @click.capture.stop="openZoom(entry.name)">
                <div class="additional-resource-detail__card-visual">
                  <Card :card="cardModelFor(entry.name)" />
                </div>
                <div class="additional-resource-detail__card-foot">
                  <span class="additional-resource-detail__card-amount" :class="{'additional-resource-detail__card-amount--zero': entry.amount === 0}">
                    <i class="card-resource additional-resource-detail__card-amount-icon" :class="iconClass" aria-hidden="true"></i>
                    {{ entry.amount }}
                    <AnimatedMetricValue
                      :value="entry.amount"
                      :metricKey="cardMetricKey(entry.name)"
                      :scopeKey="detailScope"
                      :epoch="epoch"
                      variant="misc" />
                  </span>
                  <span class="additional-resource-detail__hints">
                    <span v-if="entry.isCorporation" class="additional-resource-detail__hint additional-resource-detail__hint--corp" v-i18n>Corporation</span>
                    <span v-if="scoresFromResource(entry.name)" class="additional-resource-detail__hint additional-resource-detail__hint--vp" v-i18n>VP</span>
                    <span v-if="hasAction(entry.name)" class="additional-resource-detail__hint additional-resource-detail__hint--action" v-i18n>Action</span>
                  </span>
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
import {getCard} from '@/client/cards/ClientCardManifest';
import Card from '@/client/components/card/Card.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import AnimatedMetricValue from '@/client/components/feedback/AnimatedMetricValue.vue';
import {additionalResourceGroup, AdditionalResourceGroup} from '@/client/components/additionalResources/additionalResources';
import {additionalResourcesState, closeAdditionalResourceDetail} from '@/client/components/additionalResources/additionalResourcesState';

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
    scoresFromResource(name: CardName): boolean {
      const vp = getCard(name)?.victoryPoints;
      return typeof vp === 'object' && vp !== null && 'resourcesHere' in vp;
    },
    hasAction(name: CardName): boolean {
      return getCard(name)?.hasAction === true;
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
