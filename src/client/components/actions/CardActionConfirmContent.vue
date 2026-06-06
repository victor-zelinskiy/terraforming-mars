<template>
  <!--
    Premium confirmation gate before an activatable action is submitted. Hosted
    inside MandatoryInputModal (dark backdrop + sci-fi frame). Client-side only —
    nothing is sent until ВЫПОЛНИТЬ. Shows the SOURCE card (clickable →
    fullscreen) and the action it's about to perform as an info panel (NOT a
    button), then the Confirm / Cancel pair. Mirrors the StandardProject /
    HandCard payment-preview flow (emit up; the host submits + can cancel without
    a server round-trip).
  -->
  <div class="action-confirm">
    <div class="action-confirm__frame">
      <div class="action-confirm__corner action-confirm__corner--tl" aria-hidden="true"></div>
      <div class="action-confirm__corner action-confirm__corner--tr" aria-hidden="true"></div>
      <div class="action-confirm__corner action-confirm__corner--bl" aria-hidden="true"></div>
      <div class="action-confirm__corner action-confirm__corner--br" aria-hidden="true"></div>

      <header class="action-confirm__header">
        <span class="action-confirm__tab" aria-hidden="true"></span>
        <h3 class="action-confirm__title" v-i18n>{{ headerTitle }}</h3>
      </header>

      <div class="action-confirm__body">
        <!-- Source card (click → fullscreen). -->
        <div class="action-confirm__card-col">
          <span class="action-confirm__col-label" v-i18n>Source</span>
          <div class="action-confirm__card"
               role="button"
               tabindex="0"
               :title="$t('Open fullscreen')"
               @click.capture.stop="openFullscreen"
               @keydown.enter="openFullscreen">
            <Card :card="cardModel" />
          </div>
        </div>

        <!-- Action summary (graphic as an info panel). -->
        <div class="action-confirm__summary-col">
          <span class="action-confirm__col-label" v-i18n>This action</span>
          <div class="action-confirm__summary">
            <div v-if="group !== undefined" class="action-confirm__summary-source">
              <span class="action-confirm__summary-accent"
                    :class="{'action-confirm__summary-accent--corp': isCorporation}"
                    aria-hidden="true"></span>
              <span class="action-confirm__summary-name" v-i18n>{{ cardName }}</span>
            </div>
            <template v-if="group !== undefined">
              <div v-for="node in group.nodes" :key="node.key" class="action-confirm__render-wrap">
                <div v-if="node.actionNode !== undefined" class="action-confirm__render card-container" v-i18n v-strip-action-prefix>
                  <CardRenderEffectBoxComponent :effectData="node.actionNode" />
                </div>
                <div v-else-if="node.renderRoot !== undefined" class="action-confirm__render card-container" v-i18n v-strip-action-prefix>
                  <CardRenderData :renderData="node.renderRoot" />
                  <div v-if="node.text" class="action-confirm__render-desc"><span v-i18n>{{ node.text }}</span></div>
                </div>
                <div v-else class="action-confirm__render-text" v-i18n v-strip-action-prefix>{{ node.text }}</div>
              </div>
            </template>
            <p class="action-confirm__hint" v-i18n>After confirming, the action is performed; follow-up choices appear next.</p>
          </div>
        </div>
      </div>

      <div class="action-confirm__actions">
        <button class="action-confirm__cancel cab-action-confirm-cancel"
                @click="$emit('cancel')"
                data-test="action-confirm-cancel">
          <span class="cab-action-confirm-cancel__label" v-i18n>Cancel</span>
        </button>
        <button class="action-confirm__confirm cab-action-confirm-go"
                @click="$emit('confirm')"
                data-test="action-confirm-confirm">
          <span class="cab-action-confirm-go__glow" aria-hidden="true"></span>
          <span class="cab-action-confirm-go__icon" aria-hidden="true">▶</span>
          <span class="cab-action-confirm-go__label" v-i18n>Perform action</span>
        </button>
      </div>
    </div>

    <Teleport to="body">
      <CardZoomModal v-if="zoomCard !== undefined"
                     ref="zoomModal"
                     :card="zoomCard"
                     @close="zoomCard = undefined" />
    </Teleport>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType, nextTick} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardModel} from '@/common/models/CardModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import {ActionGroup, playerActionGroups} from '@/client/components/actions/actionExtraction';
import Card from '@/client/components/card/Card.vue';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import {stripActionPrefix} from '@/client/directives/stripActionPrefix';

export default defineComponent({
  name: 'CardActionConfirmContent',
  components: {Card, CardRenderEffectBoxComponent, CardRenderData, CardZoomModal},
  directives: {stripActionPrefix},
  props: {
    cardName: {
      type: String as PropType<CardName>,
      required: true,
    },
  },
  emits: ['confirm', 'cancel'],
  data() {
    return {
      zoomCard: undefined as CardModel | undefined,
    };
  },
  computed: {
    cardModel(): CardModel {
      return {name: this.cardName} as CardModel;
    },
    isCorporation(): boolean {
      return getCard(this.cardName)?.type === CardType.CORPORATION;
    },
    headerTitle(): string {
      return this.isCorporation ? 'Activate corporation action' : 'Activate card action';
    },
    group(): ActionGroup | undefined {
      // Re-derive the action graphic from the static manifest (one group).
      return playerActionGroups([this.cardModel])[0];
    },
  },
  methods: {
    openFullscreen(): void {
      this.zoomCard = {name: this.cardName} as CardModel;
      nextTick(() => {
        (this.$refs.zoomModal as {show?: () => void} | undefined)?.show?.();
      });
    },
  },
});
</script>
