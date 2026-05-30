<template>
  <!--
    Шаг выбора 2 прологов в initial draft flow. Hosted внутри
    <MandatoryInputModal>; родитель (InitialDraftFlowOverlay) отвечает
    за state machine.

    Семантика:
      - multi-select (min === max === N, обычно 2).
      - per-card toggle button «Выбрать» / «Снять выбор» — НЕ commits,
        просто переключает локальный selected[].
      - selected карты подсвечены полным ribbon'ом «ВЫБРАНА» + halo
        (наследуется из card_selection.less).
      - single-click по карте — fullscreen preview; primary-кнопка в
        fullscreen тоже toggle, БЕЗ закрытия модала (как BUY mode в
        CardSelectionContent — игрок может пересматривать сразу).
      - Money-panel «После прологов» live recompute при изменении
        selected + опционально учитывает выбранную ранее корпорацию
        (corpName prop) для специфичных бонусов (Manutech, Tharsis…).
      - Confirm-кнопка внизу commits через emit('confirm', [...selected]).
        Disabled пока selected.length !== max.
      - При reopen после плашки (этап 5) — приходит preSelected, текущие
        выборы подставляются в selected[].
  -->
  <div class="card-selection initial-draft-step initial-draft-step--prelude">
    <header class="card-selection__header">
      <div></div>
      <div class="card-selection__title-group">
        <h2 class="card-selection__title" v-i18n>Select 2 Prelude cards</h2>
        <span class="card-selection__counter">{{ counterText }}</span>
      </div>
      <div v-if="moneyValue !== undefined"
           class="initial-draft-step__money-panel"
           :title="$t('After preludes M€')">
        <div class="initial-draft-step__money-label" v-i18n>After preludes</div>
        <div class="initial-draft-step__money-value">{{ moneyValue }}</div>
      </div>
    </header>

    <div class="card-selection__cards">
      <div v-for="card in cards"
           :key="card.name"
           class="card-selection__card-slot"
           :class="{'card-selection__card-slot--selected': isSelected(card.name)}">
        <div class="card-selection__card-clickable"
             @click.capture.stop="openFullscreen(card)">
          <Card :card="card" />
        </div>
        <button class="card-selection__card-action-btn"
                :class="{'card-selection__card-action-btn--selected': isSelected(card.name)}"
                :disabled="actionDisabled(card.name)"
                :title="actionTooltip(card.name)"
                @click.stop="onActionClick(card.name)">
          {{ actionLabel(card.name) }}
        </button>
      </div>
    </div>

    <footer class="card-selection__footer">
      <button class="card-selection__confirm"
              :disabled="!canConfirm"
              :title="confirmTooltip"
              @click="onConfirm">
        <span class="card-selection__confirm-label" v-i18n>Confirm selection</span>
      </button>
    </footer>

    <CardZoomModal v-if="zoomCard !== undefined"
                   ref="zoomModal"
                   :card="zoomCard"
                   :selected="isSelected(zoomCard.name)"
                   @close="onZoomClose">
      <template #actions>
        <button class="card-zoom-actions__btn card-zoom-actions__btn--primary"
                :class="{'card-zoom-actions__btn--unselect': isSelected(zoomCard.name)}"
                :disabled="!isSelected(zoomCard.name) && isMaxedOut"
                @click="onFullscreenToggle">
          {{ isSelected(zoomCard.name) ? $t('Unselect') : $t('Select') }}
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
import {afterPreludes} from '@/client/components/initialDraft/initialDraftMoney';

type DataModel = {
  selected: CardName[];
  zoomCard: CardModel | undefined;
};

export default defineComponent({
  name: 'InitialDraftPreludeStep',
  components: {Card, CardZoomModal},
  props: {
    playerinput: {
      type: Object as PropType<SelectCardModel>,
      required: true,
    },
    // Выбранная ранее корпорация — нужна для расчёта corp-specific
    // бонусов прологов в money-панели (Manutech / Tharsis / Splice / …).
    // Undefined, если игрок ещё не commit'нул корпорацию (не должно
    // случаться в обычном flow, но защищаемся для уверенности).
    corpName: {
      type: String as PropType<CardName | undefined>,
      default: undefined,
    },
    // При повторном открытии шага (этап 5) — текущие выборы, чтобы
    // игрок видел свой предыдущий выбор.
    preSelected: {
      type: Array as PropType<ReadonlyArray<CardName>>,
      default: () => [],
    },
  },
  emits: {
    'confirm': (preludes: ReadonlyArray<CardName>) => Array.isArray(preludes),
    'selection-change': (preludes: ReadonlyArray<CardName>) => Array.isArray(preludes),
  },
  data(): DataModel {
    return {
      selected: [...this.preSelected],
      zoomCard: undefined,
    };
  },
  watch: {
    playerinput: {
      // Если сервер пришлёт новый список (теоретически — после reset
      // в pull mode), пересинхронизируемся.
      handler() {
        this.selected = this.selected.filter((name) =>
          this.playerinput.cards.some((c) => c.name === name));
      },
    },
    // Отдаём наружу любое изменение selected, чтобы overlay мог
    // сохранить working state и pill stack показал актуальный count
    // даже когда шаг свёрнут / переключён через другой pill.
    selected: {
      handler(now: ReadonlyArray<CardName>) {
        this.$emit('selection-change', [...now]);
      },
    },
  },
  computed: {
    cards(): ReadonlyArray<CardModel> {
      return this.playerinput.cards;
    },
    max(): number {
      return this.playerinput.max;
    },
    min(): number {
      return this.playerinput.min;
    },
    isMaxedOut(): boolean {
      return this.selected.length >= this.max;
    },
    canConfirm(): boolean {
      return this.selected.length >= this.min && this.selected.length <= this.max;
    },
    counterText(): string {
      return translateTextWithParams(
        'Selected ${0} of ${1}',
        [String(this.selected.length), String(this.max)]);
    },
    confirmTooltip(): string {
      if (this.canConfirm) {
        return '';
      }
      return translateTextWithParams(
        'Select ${0} card(s)', [String(this.min)]);
    },
    moneyValue(): number {
      return afterPreludes(this.corpName, this.selected, 0);
    },
  },
  methods: {
    isSelected(name: CardName): boolean {
      return this.selected.includes(name);
    },
    actionDisabled(name: CardName): boolean {
      // Можно всегда снять выбор; нельзя выбрать ещё, когда max уже взято.
      if (this.isSelected(name)) {
        return false;
      }
      return this.isMaxedOut;
    },
    actionLabel(name: CardName): string {
      return this.isSelected(name) ? translateText('Unselect') : translateText('Select');
    },
    actionTooltip(name: CardName): string {
      if (!this.isSelected(name) && this.isMaxedOut) {
        return translateTextWithParams(
          'Already selected ${0} of ${1} — deselect a card first',
          [String(this.selected.length), String(this.max)]);
      }
      return '';
    },
    toggleSelected(name: CardName): void {
      const idx = this.selected.indexOf(name);
      if (idx >= 0) {
        this.selected.splice(idx, 1);
        return;
      }
      if (this.selected.length >= this.max) {
        return;
      }
      this.selected.push(name);
    },
    onActionClick(name: CardName): void {
      this.toggleSelected(name);
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
    onFullscreenToggle(): void {
      if (this.zoomCard === undefined) {
        return;
      }
      this.toggleSelected(this.zoomCard.name);
    },
    onConfirm(): void {
      if (!this.canConfirm) {
        return;
      }
      this.$emit('confirm', [...this.selected]);
    },
  },
});
</script>
