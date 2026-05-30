<template>
  <!--
    Шаг выбора директора (CEO) в initial draft flow. Hosted внутри
    <MandatoryInputModal>; родитель (InitialDraftFlowOverlay) отвечает
    за state machine.

    Семантика идентична InitialDraftCorpStep — single-select, click
    «Выбрать» сразу commits через emit('confirm', name), single-click
    по карте → fullscreen с primary «Выбрать», который тоже commits.
    Money-панели нет — CEO как класс не влияет на начальные М€.
  -->
  <div class="card-selection initial-draft-step initial-draft-step--ceo">
    <header class="card-selection__header">
      <div></div>
      <div class="card-selection__title-group">
        <h2 class="card-selection__title" v-i18n>Select a CEO</h2>
        <span class="card-selection__counter">{{ counterText }}</span>
      </div>
      <div></div>
    </header>

    <div class="card-selection__cards">
      <div v-for="card in cards"
           :key="card.name"
           class="card-selection__card-slot">
        <div class="card-selection__card-clickable"
             @click.capture.stop="openFullscreen(card)">
          <Card :card="card" />
        </div>
        <button class="card-selection__card-action-btn"
                @click.stop="onActionClick(card.name)"
                v-i18n>Select</button>
      </div>
    </div>

    <CardZoomModal v-if="zoomCard !== undefined"
                   ref="zoomModal"
                   :card="zoomCard"
                   :selected="false"
                   @close="onZoomClose">
      <template #actions>
        <button class="card-zoom-actions__btn card-zoom-actions__btn--primary"
                @click="onFullscreenSelect">
          <span v-i18n>Select</span>
        </button>
      </template>
    </CardZoomModal>
  </div>
</template>

<script lang="ts">
import {defineComponent, nextTick, PropType} from 'vue';
import Card from '@/client/components/card/Card.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {translateTextWithParams} from '@/client/directives/i18n';

type DataModel = {
  zoomCard: CardModel | undefined;
};

export default defineComponent({
  name: 'InitialDraftCeoStep',
  components: {Card, CardZoomModal},
  props: {
    playerinput: {
      type: Object as PropType<SelectCardModel>,
      required: true,
    },
  },
  emits: {
    confirm: (ceoName: CardName) => typeof ceoName === 'string',
  },
  data(): DataModel {
    return {
      zoomCard: undefined,
    };
  },
  computed: {
    cards(): ReadonlyArray<CardModel> {
      return this.playerinput.cards;
    },
    counterText(): string {
      return translateTextWithParams(
        '1 CEO out of ${0}', [String(this.cards.length)]);
    },
  },
  methods: {
    onActionClick(name: CardName): void {
      this.$emit('confirm', name);
    },
    openFullscreen(card: CardModel): void {
      this.zoomCard = card;
      nextTick(() => {
        const modal = this.$refs.zoomModal as InstanceType<typeof CardZoomModal> | undefined;
        modal?.show();
      });
    },
    onZoomClose(): void {
      this.zoomCard = undefined;
    },
    onFullscreenSelect(): void {
      if (this.zoomCard === undefined) {
        return;
      }
      const name = this.zoomCard.name;
      const modal = this.$refs.zoomModal as InstanceType<typeof CardZoomModal> | undefined;
      modal?.close();
      this.$emit('confirm', name);
    },
  },
});
</script>
