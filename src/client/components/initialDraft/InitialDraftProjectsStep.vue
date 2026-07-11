<template>
  <!--
    Шаг выбора стартовых проектных карт для покупки. Hosted внутри
    <MandatoryInputModal>; родитель (InitialDraftFlowOverlay) отвечает
    за state machine + Skip-confirmation popup.

    Семантика:
      - multi-select (min=0, max=10).
      - 5 карт в ряд × 2 ряда — отдельная LESS-сетка
        `.initial-draft-step--projects` поверх card-selection layout.
      - per-card toggle button «Выбрать» / «Снять выбор»; selected
        получают halo + ribbon «ВЫБРАНА» из card_selection.less.
      - single-click → fullscreen с toggle primary-кнопкой (не
        закрывает модал, как BUY-mode CardSelectionContent).
      - Money-панель в шапке: «После прологов» / «Стоимость» / «Останется»
        в 3 ячейки. Останется = budget − cost; если отрицательное,
        ячейка краснеет и confirm дизейблится с tooltip.
      - Footer commit-кнопка ведёт себя контекстно:
          • selected.length > 0 → «Купить» → emit('confirm', [...]);
          • selected.length === 0 → «Пропустить» → emit('skip-request')
            (родитель показывает легковесный popup для подтверждения).
      - При reopen после плашки (этап 5) приходит preSelected.

    Финальный submit на сервер делается ОДНИМ initialCards ответом
    после полного подтверждения flow (этап 6). На этом шаге commit
    остаётся локальным.
  -->
  <div class="card-selection initial-draft-step initial-draft-step--projects
              initial-draft-pick initial-draft-pick--projects initial-draft-pick--has-money">
    <header class="card-selection__header initial-draft-pick__header">
      <div class="initial-draft-pick__title-block">
        <h2 class="card-selection__title initial-draft-pick__title"
            v-i18n>Select initial cards to buy</h2>
        <span class="card-selection__counter initial-draft-pick__counter">{{ counterText }}</span>
      </div>
      <div class="initial-draft-step__money-panel initial-draft-step__money-panel--triple
                  initial-draft-pick__money"
           :class="{'initial-draft-step__money-panel--insufficient': insufficient}">
        <div class="initial-draft-step__money-cell">
          <div class="initial-draft-step__money-label" v-i18n>After preludes</div>
          <div class="initial-draft-step__money-value">{{ budget }}</div>
        </div>
        <div class="initial-draft-step__money-cell">
          <div class="initial-draft-step__money-label" v-i18n>Cost of purchase</div>
          <div class="initial-draft-step__money-value">{{ cost }}</div>
        </div>
        <div class="initial-draft-step__money-cell initial-draft-step__money-cell--remaining">
          <div class="initial-draft-step__money-label" v-i18n>Remaining</div>
          <div class="initial-draft-step__money-value">{{ remaining }}</div>
        </div>
      </div>
    </header>

    <div class="card-selection__cards initial-draft-pick__grid">
      <div v-for="card in cards"
           :key="card.name"
           class="card-selection__card-slot initial-draft-pick__card-unit"
           :class="{
             'card-selection__card-slot--selected': isSelected(card.name),
             'initial-draft-pick__card-unit--selected': isSelected(card.name),
             'initial-draft-pick__card-unit--disabled': !isSelected(card.name) && actionDisabled(card.name),
           }">
        <div class="card-selection__card-clickable initial-draft-pick__card-clickable"
             @click.capture.stop="openFullscreen(card)">
          <Card :card="card" />
        </div>
        <button class="card-selection__card-action-btn initial-draft-pick__card-btn"
                :class="{
                  'card-selection__card-action-btn--selected': isSelected(card.name),
                  'initial-draft-pick__card-btn--selected': isSelected(card.name),
                  'initial-draft-pick__card-btn--disabled': !isSelected(card.name) && actionDisabled(card.name),
                }"
                :disabled="actionDisabled(card.name)"
                :title="actionTooltip(card.name)"
                @click.stop="onActionClick(card.name)">
          {{ actionLabel(card.name) }}
        </button>
      </div>
    </div>

    <footer class="card-selection__footer initial-draft-pick__footer">
      <button class="card-selection__confirm initial-draft-pick__confirm"
              :disabled="!canConfirm"
              :title="confirmTooltip"
              @click="onFooterClick">
        <span class="initial-draft-pick__confirm-label">{{ footerLabel }}</span>
        <span class="initial-draft-pick__confirm-count" v-if="selected.length > 0">
          {{ selected.length }} {{ confirmCardsWord }}
        </span>
        <span v-if="cost > 0" class="card-selection__cost-coin initial-draft-pick__confirm-coin">{{ cost }}</span>
      </button>
    </footer>

    <CardZoomModal v-if="zoomCard !== undefined"
                   ref="zoomModal"
                   :card="zoomCard"
                   :cards="cards"
                   :selected="isSelected(zoomCard.name)"
                   @navigate="zoomCard = $event"
                   @close="onZoomClose">
      <template #actions>
        <button class="card-zoom-actions__btn card-zoom-actions__btn--primary"
                :class="{'card-zoom-actions__btn--unselect': isSelected(zoomCard.name)}"
                :disabled="fullscreenActionDisabled"
                :title="fullscreenActionTooltip"
                @click="onFullscreenToggle">
          {{ isSelected(zoomCard.name) ? $t('Unselect') : $t('Select') }}
        </button>
      </template>
    </CardZoomModal>
  </div>
</template>

<script lang="ts">
import {defineComponent, nextTick, PropType} from 'vue';
import Card from '@/client/components/card/CardFace.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {
  startingMegacredits,
  afterPreludes,
  cardCostForCorp,
} from '@/client/components/initialDraft/initialDraftMoney';

type DataModel = {
  selected: CardName[];
  zoomCard: CardModel | undefined;
};

export default defineComponent({
  name: 'InitialDraftProjectsStep',
  components: {Card, CardZoomModal},
  props: {
    playerinput: {
      type: Object as PropType<SelectCardModel>,
      required: true,
    },
    corpName: {
      type: String as PropType<CardName | undefined>,
      default: undefined,
    },
    selectedPreludes: {
      type: Array as PropType<ReadonlyArray<CardName>>,
      default: () => [],
    },
    preSelected: {
      type: Array as PropType<ReadonlyArray<CardName>>,
      default: () => [],
    },
  },
  emits: {
    'confirm': (cards: ReadonlyArray<CardName>) => Array.isArray(cards),
    'skip-request': () => true,
    'selection-change': (cards: ReadonlyArray<CardName>) => Array.isArray(cards),
  },
  data(): DataModel {
    return {
      selected: [...this.preSelected],
      zoomCard: undefined,
    };
  },
  watch: {
    playerinput: {
      handler() {
        this.selected = this.selected.filter((name) =>
          this.playerinput.cards.some((c) => c.name === name));
      },
    },
    // Отдаём наружу любое изменение selected, чтобы overlay сохранил
    // working state — иначе при переключении через pill (например, в
    // прологи) локальный selected[] терялся, и игрок возвращался к
    // проектам с очищенным выбором. Также pill 'projects' показывает
    // живой count «Выбрано: N из 10».
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
    cardCost(): number {
      return cardCostForCorp(this.corpName);
    },
    // Полный бюджет на этапе projects: стартовые М€ выбранной
    // корпорации + бонусы от выбранных прологов. Стоимость карт
    // НЕ учитывается тут — она отдельно показана как `cost`.
    budget(): number {
      const start = startingMegacredits(this.corpName, 0) ?? 0;
      return start + afterPreludes(this.corpName, this.selectedPreludes, 0);
    },
    cost(): number {
      return this.selected.length * this.cardCost;
    },
    remaining(): number {
      return this.budget - this.cost;
    },
    insufficient(): boolean {
      return this.remaining < 0;
    },
    isMaxedOut(): boolean {
      return this.selected.length >= this.max;
    },
    canConfirm(): boolean {
      // Skip (0 selected) всегда валидный — будет тестирован через
      // отдельный confirm popup из родителя.
      // Покупка с нехваткой денег запрещена.
      return !this.insufficient;
    },
    counterText(): string {
      return translateTextWithParams(
        'Selected ${0} of ${1}',
        [String(this.selected.length), String(this.max)]);
    },
    footerLabel(): string {
      if (this.selected.length === 0) {
        return translateText('Skip');
      }
      return translateText('Buy');
    },
    /*
     * Русское плюральное окончание для «N карт(а/ы)». Используется в
     * правой части footer-кнопки рядом с числом, чтобы CTA читалась
     * как «КУПИТЬ · 5 КАРТ · 15 M€». Простой rule:
     *   1, 21, 31, … → «карта»
     *   2-4, 22-24, …  → «карты»
     *   0, 5-20, 25-30 → «карт»
     */
    confirmCardsWord(): string {
      const n = this.selected.length;
      const mod10 = n % 10;
      const mod100 = n % 100;
      if (mod10 === 1 && mod100 !== 11) {
        return translateText('card');
      }
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
        return translateText('cards (2-4)');
      }
      return translateText('cards (5+)');
    },
    confirmTooltip(): string {
      if (this.insufficient) {
        return translateText('Not enough M€');
      }
      return '';
    },
    fullscreenActionDisabled(): boolean {
      if (this.zoomCard === undefined) {
        return false;
      }
      if (this.isSelected(this.zoomCard.name)) {
        // снять выбор можно всегда.
        return false;
      }
      return this.isMaxedOut || this.wouldExceedBudget();
    },
    fullscreenActionTooltip(): string {
      if (this.zoomCard === undefined) {
        return '';
      }
      if (!this.isSelected(this.zoomCard.name) && this.wouldExceedBudget()) {
        return translateText('Not enough M€');
      }
      return '';
    },
  },
  methods: {
    isSelected(name: CardName): boolean {
      return this.selected.includes(name);
    },
    wouldExceedBudget(): boolean {
      // если выберем ещё одну карту — хватит ли денег?
      return (this.cost + this.cardCost) > this.budget;
    },
    actionDisabled(name: CardName): boolean {
      if (this.isSelected(name)) {
        return false;
      }
      if (this.isMaxedOut) {
        return true;
      }
      return this.wouldExceedBudget();
    },
    actionLabel(name: CardName): string {
      return this.isSelected(name) ? translateText('Unselect') : translateText('Select');
    },
    actionTooltip(name: CardName): string {
      if (this.isSelected(name)) {
        return '';
      }
      if (this.isMaxedOut) {
        return translateTextWithParams(
          'Already selected ${0} of ${1} — deselect a card first',
          [String(this.selected.length), String(this.max)]);
      }
      if (this.wouldExceedBudget()) {
        return translateText('Not enough M€');
      }
      return '';
    },
    toggleSelected(name: CardName): void {
      const idx = this.selected.indexOf(name);
      if (idx >= 0) {
        this.selected.splice(idx, 1);
        return;
      }
      if (this.actionDisabled(name)) {
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
    /*
     * Fullscreen primary action — toggles selection and KEEPS the
     * fullscreen open. With in-viewer navigation the player browses
     * the whole offer and picks several cards without leaving
     * fullscreen; the card halo/ribbon (`:selected`) and the button
     * label flip in place to confirm each toggle. A toggle never
     * removes the card from the list, so we stay on it (spec: a
     * non-removing action keeps the current card). Exit via ЗАКРЫТЬ /
     * Esc / backdrop.
     */
    onFullscreenToggle(): void {
      if (this.zoomCard === undefined) {
        return;
      }
      this.toggleSelected(this.zoomCard.name);
    },
    onFooterClick(): void {
      if (this.selected.length === 0) {
        this.$emit('skip-request');
        return;
      }
      if (!this.canConfirm) {
        return;
      }
      this.$emit('confirm', [...this.selected]);
    },
  },
});
</script>
