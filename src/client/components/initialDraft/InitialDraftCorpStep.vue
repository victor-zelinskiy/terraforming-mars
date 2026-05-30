<template>
  <!--
    Шаг выбора корпорации в initial draft flow.
    Хостится внутри <MandatoryInputModal>; родитель (InitialDraftFlowOverlay)
    отвечает за state machine, эта же компонента — чисто визуальный single-
    select-grid + money preview.

    Семантика:
      - single-select (min=1 / max=1).
      - per-card кнопка «Выбрать» commits сразу через emit('confirm', name) —
        родитель закрывает модал и переходит к следующему шагу.
      - single-click по карте — fullscreen preview (CardZoomModal).
        В fullscreen primary-кнопка «Выбрать» тоже commits сразу.
      - повторное открытие шага (после плашки в pill-stack'е, этап 5)
        приходит через prop `preSelected` — карта подсвечена, но игрок
        обязан явно нажать «Выбрать», чтобы зафиксировать новый выбор.
        Без явного commit'а изменения не применяются.
  -->
  <div class="card-selection initial-draft-step initial-draft-step--corp
              initial-draft-pick initial-draft-pick--corp"
       :class="{'initial-draft-pick--has-money': hoverMoneyValue !== undefined}">
    <header class="card-selection__header initial-draft-pick__header">
      <div class="initial-draft-pick__title-block">
        <h2 class="card-selection__title initial-draft-pick__title"
            v-i18n>Select a corporation</h2>
        <span class="card-selection__counter initial-draft-pick__counter">{{ counterText }}</span>
      </div>
      <div v-if="hoverMoneyValue !== undefined"
           class="initial-draft-step__money-panel initial-draft-pick__money"
           :title="$t('Starting M€')">
        <div class="initial-draft-step__money-label" v-i18n>Starting M€</div>
        <div class="initial-draft-step__money-value">{{ hoverMoneyValue }}</div>
      </div>
    </header>

    <div class="card-selection__cards initial-draft-pick__grid">
      <div v-for="card in cards"
           :key="card.name"
           class="card-selection__card-slot initial-draft-pick__card-unit"
           :class="{
             'card-selection__card-slot--selected': card.name === preSelected,
             'initial-draft-pick__card-unit--selected': card.name === preSelected,
           }"
           @mouseenter="hoveredName = card.name"
           @mouseleave="hoveredName = undefined">
        <div class="card-selection__card-clickable initial-draft-pick__card-clickable"
             @click.capture.stop="openFullscreen(card)">
          <Card :card="card" />
        </div>
        <button class="card-selection__card-action-btn initial-draft-pick__card-btn"
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
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {startingMegacredits} from '@/client/components/initialDraft/initialDraftMoney';

type DataModel = {
  hoveredName: CardName | undefined;
  zoomCard: CardModel | undefined;
};

export default defineComponent({
  name: 'InitialDraftCorpStep',
  components: {Card, CardZoomModal},
  props: {
    // SelectCardModel-обёртка с корпоративными картами и ограничениями
    // (min=1, max=1). Принимаем целиком, чтобы дальнейшие изменения
    // протокола (warnings, новые поля) не требовали правок в overlay.
    playerinput: {
      type: Object as PropType<SelectCardModel>,
      required: true,
    },
    // Текущий committed выбор (или undefined, если шаг открыт впервые).
    // Подсвечивает соответствующую карту ribbon'ом «ВЫБРАНА» при reopen
    // через pill, чтобы игрок сразу видел свой предыдущий выбор.
    preSelected: {
      type: String as PropType<CardName | undefined>,
      default: undefined,
    },
  },
  emits: {
    confirm: (corpName: CardName) => typeof corpName === 'string',
  },
  data(): DataModel {
    return {
      hoveredName: undefined,
      zoomCard: undefined,
    };
  },
  computed: {
    cards(): ReadonlyArray<CardModel> {
      return this.playerinput.cards;
    },
    counterText(): string {
      return translateTextWithParams('1 corporation out of ${0}', [String(this.cards.length)]);
    },
    // Money-panel показывает live preview. Приоритет:
    //   1. hover (игрок наводит мышь на любую карту — превью её M€);
    //   2. preSelected (зашёл через pill уже-выбранной корпы и не наводит
    //      ни на что — показываем M€ committed корпы по умолчанию).
    // Если ни hover, ни preSelected — panel скрыта (`v-if` в template).
    hoverMoneyValue(): number | undefined {
      const name = this.hoveredName ?? this.preSelected;
      return startingMegacredits(name, 0);
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
    // exposed для unused-imports lint protection — translateText используется
    // в template через v-i18n директиву; явный референс снимает ложный
    // «unused import» предупреждение в IDE.
    _ti(): typeof translateText {
      return translateText;
    },
  },
});
</script>
