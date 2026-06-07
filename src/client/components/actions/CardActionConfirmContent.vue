<template>
  <!--
    Premium confirmation gate before an activatable action is submitted. Hosted
    inside MandatoryInputModal (dark backdrop + sci-fi frame). Client-side only —
    nothing is sent until ВЫПОЛНИТЬ.

    Visual hierarchy (the point of the layout): the ACTION panel is the HERO —
    the isolated, scaled-up action graphic = "what you're about to do"; the
    source card is a compact, recessed SECONDARY preview = "where it comes from"
    (click → fullscreen); the CTA sits in a separated footer. The card art is
    NOT repeated as the action graphic, so the two read as distinct roles rather
    than duplication. Mirrors the StandardProject / HandCard payment-preview
    flow (emit up; the host submits + can cancel without a server round-trip).
  -->
  <div class="action-confirm" :class="{'action-confirm--corp': isCorporation}">
    <div class="action-confirm__frame">
      <div class="action-confirm__corner action-confirm__corner--tl" aria-hidden="true"></div>
      <div class="action-confirm__corner action-confirm__corner--tr" aria-hidden="true"></div>
      <div class="action-confirm__corner action-confirm__corner--bl" aria-hidden="true"></div>
      <div class="action-confirm__corner action-confirm__corner--br" aria-hidden="true"></div>

      <header class="action-confirm__header">
        <span class="action-confirm__kicker">
          <span class="action-confirm__kicker-dot" aria-hidden="true"></span>
          <span class="action-confirm__kicker-text" v-i18n>Action confirmation</span>
        </span>
        <h3 class="action-confirm__title" v-i18n>{{ headerTitle }}</h3>
      </header>

      <div class="action-confirm__body">
        <!--
          SOURCE — secondary preview. The card is the CONTEXT ("where the
          action comes from"), deliberately compact + recessed so it never
          competes with the action panel. Click → fullscreen.
          Renders with live resource counts when a full CardModel is supplied.
        -->
        <aside class="action-confirm__source">
          <span class="action-confirm__source-label" v-i18n>Source</span>
          <button type="button"
                  class="action-confirm__card"
                  :aria-label="$t('Open fullscreen')"
                  @click.capture.stop="openFullscreen"
                  @keydown.enter="openFullscreen">
            <Card :card="cardModel" />
            <span class="action-confirm__zoom" aria-hidden="true">⤢</span>
          </button>
        </aside>

        <!--
          ACTION — the HERO panel. This is the one thing the player is about to
          do; it's the largest, brightest, most readable element of the modal
          (the isolated action graphic, NOT a repeat of the card).
        -->
        <section class="action-confirm__action">
          <span class="action-confirm__action-kicker" v-i18n>You are about to</span>
          <div class="action-confirm__action-graphic">
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
          </div>
        </section>
      </div>

      <footer class="action-confirm__footer">
        <p class="action-confirm__hint" v-i18n>After confirming, the action is performed; follow-up choices appear next.</p>
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
      </footer>
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
    // Full live CardModel from the tableau — when supplied, the source card
    // preview shows current resource counts (animals/microbes/floaters/etc.).
    // Falls back to a bare {name} when absent (e.g. playground/tests).
    card: {
      type: Object as PropType<CardModel>,
      default: undefined,
    },
  },
  emits: ['confirm', 'cancel'],
  data() {
    return {
      zoomCard: undefined as CardModel | undefined,
    };
  },
  computed: {
    // The live card model used for the source preview and fullscreen viewer.
    cardModel(): CardModel {
      return this.card ?? ({name: this.cardName} as CardModel);
    },
    isCorporation(): boolean {
      return getCard(this.cardName)?.type === CardType.CORPORATION;
    },
    headerTitle(): string {
      return this.isCorporation ? 'Activate corporation action' : 'Activate card action';
    },
    group(): ActionGroup | undefined {
      // Re-derive the action graphic from the static manifest (one group).
      // Only `name` matters here — resources don't affect the graphic.
      return playerActionGroups([{name: this.cardName} as CardModel])[0];
    },
  },
  methods: {
    openFullscreen(): void {
      this.zoomCard = this.cardModel;
      nextTick(() => {
        (this.$refs.zoomModal as {show?: () => void} | undefined)?.show?.();
      });
    },
  },
});
</script>
