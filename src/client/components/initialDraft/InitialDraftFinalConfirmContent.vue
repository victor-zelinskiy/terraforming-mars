<template>
  <!--
    Финальная сводка стартового выбора — premium command panel перед
    стартом партии. Layout:
      - Header: заголовок + подзаголовок + summary strip с ключевыми
        метриками (корпорация, прологи, проекты, стоимость, остаток).
      - Top row (2 колонки): слева крупная карта КОРПОРАЦИИ с её именем
        в заголовке; справа компактная зона ПРОЛОГОВ и CEO (если есть).
      - Bottom row: ПРОЕКТНЫЕ КАРТЫ на всю ширину, разделённые на 3
        стопки по типу (Активные / Автоматические / События). Пустые
        группы НЕ рендерятся.
      - Sticky footer с кнопками «Изменить выбор» / «Начать».

    Любая карта кликабельна → fullscreen через CardZoomModal. Клик
    перехватывается в capture-фазе, чтобы не сработал built-in zoom
    Card.vue и не открыл второй модал параллельно.
  -->
  <div class="initial-draft-summary">
    <header class="initial-draft-summary__header">
      <div class="initial-draft-summary__title-block">
        <h2 class="initial-draft-summary__title" v-i18n>Final selection</h2>
        <p class="initial-draft-summary__subtitle" v-i18n>Once the game begins, your starting selection cannot be changed.</p>
      </div>
      <!--
        Summary strip — компактная панель ключевых метрик. Показывает
        4-5 быстрых значений, чтобы игрок сразу видел числовую сводку
        своего стартового состояния и не пересчитывал в голове.
      -->
      <div class="initial-draft-summary__strip">
        <div class="initial-draft-summary__strip-cell">
          <span class="initial-draft-summary__strip-label" v-i18n>Corporation</span>
          <span class="initial-draft-summary__strip-value" v-i18n>{{ corpName }}</span>
        </div>
        <div v-if="preludeCards.length > 0" class="initial-draft-summary__strip-cell">
          <span class="initial-draft-summary__strip-label" v-i18n>Preludes</span>
          <span class="initial-draft-summary__strip-value">{{ preludeCards.length }}</span>
        </div>
        <div v-if="ceoCard !== undefined" class="initial-draft-summary__strip-cell">
          <span class="initial-draft-summary__strip-label" v-i18n>CEO</span>
          <span class="initial-draft-summary__strip-value" v-i18n>{{ ceoCard.name }}</span>
        </div>
        <div class="initial-draft-summary__strip-cell">
          <span class="initial-draft-summary__strip-label" v-i18n>Project cards</span>
          <span class="initial-draft-summary__strip-value">{{ projectCards.length }}</span>
        </div>
        <div class="initial-draft-summary__strip-cell initial-draft-summary__strip-cell--money">
          <span class="initial-draft-summary__strip-label" v-i18n>Cost of purchase</span>
          <span class="initial-draft-summary__strip-value">{{ totalCost }} M€</span>
        </div>
        <div class="initial-draft-summary__strip-cell initial-draft-summary__strip-cell--money">
          <span class="initial-draft-summary__strip-label" v-i18n>Remaining</span>
          <span class="initial-draft-summary__strip-value">{{ remainingMc }} M€</span>
        </div>
      </div>
    </header>

    <div class="initial-draft-summary__body">
      <!-- Top row: corp left, preludes+ceo right. На узких экранах
           секции сложатся в одну колонку через CSS grid auto-fit. -->
      <div class="initial-draft-summary__top-row">
        <section v-if="corpCard !== undefined"
                 class="initial-draft-summary__section initial-draft-summary__section--corp">
          <div class="initial-draft-summary__section-header">
            <span class="initial-draft-summary__section-label" v-i18n>Corporation</span>
            <span class="initial-draft-summary__section-name" v-i18n>{{ corpCard.name }}</span>
          </div>
          <div class="initial-draft-summary__pile initial-draft-summary__pile--single">
            <div class="initial-draft-summary__card-slot initial-draft-summary__card-slot--corp"
                 :title="$t('Click to view')"
                 @click.capture.stop="openFullscreen(corpCard)">
              <Card :card="corpCard" />
            </div>
          </div>
        </section>

        <section v-if="preludeCards.length > 0 || ceoCard !== undefined"
                 class="initial-draft-summary__section initial-draft-summary__section--secondary">
          <div v-if="preludeCards.length > 0"
               class="initial-draft-summary__subsection">
            <div class="initial-draft-summary__section-header">
              <span class="initial-draft-summary__section-label" v-i18n>Preludes</span>
              <span class="initial-draft-summary__section-count">{{ preludeCards.length }}</span>
            </div>
            <div class="initial-draft-summary__pile initial-draft-summary__pile--row">
              <div v-for="(card, idx) in preludeCards"
                   :key="'prelude-' + card.name"
                   class="initial-draft-summary__card-slot"
                   :style="{ zIndex: idx + 1 }"
                   :title="$t('Click to view')"
                   @click.capture.stop="openFullscreen(card)">
                <Card :card="card" />
              </div>
            </div>
          </div>

          <div v-if="ceoCard !== undefined"
               class="initial-draft-summary__subsection">
            <div class="initial-draft-summary__section-header">
              <span class="initial-draft-summary__section-label" v-i18n>CEO</span>
              <span class="initial-draft-summary__section-name" v-i18n>{{ ceoCard.name }}</span>
            </div>
            <div class="initial-draft-summary__pile initial-draft-summary__pile--single">
              <div class="initial-draft-summary__card-slot"
                   :title="$t('Click to view')"
                   @click.capture.stop="openFullscreen(ceoCard)">
                <Card :card="ceoCard" />
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Bottom row: проекты на всю ширину, 3 группы по типу карты. -->
      <section v-if="hasAnyProject"
               class="initial-draft-summary__section initial-draft-summary__section--projects">
        <div class="initial-draft-summary__section-header">
          <span class="initial-draft-summary__section-label" v-i18n>Project cards</span>
          <span class="initial-draft-summary__section-count">{{ projectCards.length }}</span>
        </div>
        <div class="initial-draft-summary__projects">
          <div v-if="projectsActive.length > 0"
               class="initial-draft-summary__projects-group">
            <div class="initial-draft-summary__projects-group-label">
              <span v-i18n>Active</span>
              <span class="initial-draft-summary__projects-group-count">{{ projectsActive.length }}</span>
            </div>
            <div class="initial-draft-summary__pile initial-draft-summary__pile--row">
              <div v-for="(card, idx) in projectsActive"
                   :key="'active-' + card.name"
                   class="initial-draft-summary__card-slot"
                   :style="{ zIndex: idx + 1 }"
                   :title="$t('Click to view')"
                   @click.capture.stop="openFullscreen(card)">
                <Card :card="card" />
              </div>
            </div>
          </div>
          <div v-if="projectsAutomated.length > 0"
               class="initial-draft-summary__projects-group">
            <div class="initial-draft-summary__projects-group-label">
              <span v-i18n>Automated</span>
              <span class="initial-draft-summary__projects-group-count">{{ projectsAutomated.length }}</span>
            </div>
            <div class="initial-draft-summary__pile initial-draft-summary__pile--row">
              <div v-for="(card, idx) in projectsAutomated"
                   :key="'auto-' + card.name"
                   class="initial-draft-summary__card-slot"
                   :style="{ zIndex: idx + 1 }"
                   :title="$t('Click to view')"
                   @click.capture.stop="openFullscreen(card)">
                <Card :card="card" />
              </div>
            </div>
          </div>
          <div v-if="projectsEvent.length > 0"
               class="initial-draft-summary__projects-group">
            <div class="initial-draft-summary__projects-group-label">
              <span v-i18n>Events</span>
              <span class="initial-draft-summary__projects-group-count">{{ projectsEvent.length }}</span>
            </div>
            <div class="initial-draft-summary__pile initial-draft-summary__pile--row">
              <div v-for="(card, idx) in projectsEvent"
                   :key="'event-' + card.name"
                   class="initial-draft-summary__card-slot"
                   :style="{ zIndex: idx + 1 }"
                   :title="$t('Click to view')"
                   @click.capture.stop="openFullscreen(card)">
                <Card :card="card" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <footer class="initial-draft-summary__actions">
      <!--
        Edit-wrapper держит ref для click-outside детекта и сам кнопку
        + всплывающее меню. Кнопка тогглит menu, menu выпадает ВВЕРХ
        (footer уже снизу окна, вниз места нет) и предлагает явные
        опции редактирования по шагам: Корпорация / Прологи / CEO /
        Проекты. Опции, которым нет соответствующего step'a в текущей
        партии, не рендерятся (`hasPrelude` / `hasCeo` / `hasProjects`).
        Клик за пределами меню — закрывает его без действий.
      -->
      <div class="initial-draft-summary__edit-wrapper" ref="editWrapper">
        <button class="initial-draft-summary__btn initial-draft-summary__btn--secondary
                       initial-draft-summary__btn--edit"
                :class="{'initial-draft-summary__btn--edit-open': editMenuOpen}"
                :aria-expanded="editMenuOpen"
                aria-haspopup="menu"
                @click.stop="toggleEditMenu">
          <span v-i18n>Change selection</span>
          <span class="initial-draft-summary__btn-caret" aria-hidden="true">▾</span>
        </button>
        <Transition name="initial-draft-summary-menu">
          <div v-if="editMenuOpen"
               class="initial-draft-summary__edit-menu"
               role="menu">
            <span class="initial-draft-summary__edit-menu-corner
                         initial-draft-summary__edit-menu-corner--tl"
                  aria-hidden="true"></span>
            <span class="initial-draft-summary__edit-menu-corner
                         initial-draft-summary__edit-menu-corner--tr"
                  aria-hidden="true"></span>
            <span class="initial-draft-summary__edit-menu-corner
                         initial-draft-summary__edit-menu-corner--bl"
                  aria-hidden="true"></span>
            <span class="initial-draft-summary__edit-menu-corner
                         initial-draft-summary__edit-menu-corner--br"
                  aria-hidden="true"></span>
            <button class="initial-draft-summary__edit-menu-item"
                    role="menuitem"
                    @click="onEditStep('corp')">
              <span v-i18n>Edit corporation</span>
            </button>
            <button v-if="hasPrelude"
                    class="initial-draft-summary__edit-menu-item"
                    role="menuitem"
                    @click="onEditStep('prelude')">
              <span v-i18n>Edit preludes</span>
            </button>
            <button v-if="hasCeo"
                    class="initial-draft-summary__edit-menu-item"
                    role="menuitem"
                    @click="onEditStep('ceo')">
              <span v-i18n>Edit CEO</span>
            </button>
            <button v-if="hasProjects"
                    class="initial-draft-summary__edit-menu-item"
                    role="menuitem"
                    @click="onEditStep('projects')">
              <span v-i18n>Edit projects</span>
            </button>
          </div>
        </Transition>
      </div>
      <button class="initial-draft-summary__btn initial-draft-summary__btn--primary"
              @click="$emit('confirm')">
        <span v-i18n>Start</span>
      </button>
    </footer>

    <CardZoomModal v-if="zoomCard !== undefined"
                   ref="zoomModal"
                   :card="zoomCard"
                   @close="onZoomClose" />
  </div>
</template>

<script lang="ts">
import {defineComponent, nextTick, PropType} from 'vue';
import Card from '@/client/components/card/Card.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {getCard} from '@/client/cards/ClientCardManifest';
import {
  startingMegacredits,
  afterPreludes,
  cardCostForCorp,
} from '@/client/components/initialDraft/initialDraftMoney';

type EditStep = 'corp' | 'prelude' | 'ceo' | 'projects';

type DataModel = {
  zoomCard: CardModel | undefined;
  editMenuOpen: boolean;
};

export default defineComponent({
  name: 'InitialDraftFinalConfirmContent',
  components: {Card, CardZoomModal},
  props: {
    corpCard: {
      type: Object as PropType<CardModel | undefined>,
      default: undefined,
    },
    preludeCards: {
      type: Array as PropType<ReadonlyArray<CardModel>>,
      default: () => [],
    },
    ceoCard: {
      type: Object as PropType<CardModel | undefined>,
      default: undefined,
    },
    projectCards: {
      type: Array as PropType<ReadonlyArray<CardModel>>,
      default: () => [],
    },
    // Гейтят пункты edit-меню. Истина = соответствующий шаг существует
    // в текущей партии (server прислал sub-input в playerinput.options).
    hasPrelude: {
      type: Boolean,
      default: false,
    },
    hasCeo: {
      type: Boolean,
      default: false,
    },
    hasProjects: {
      type: Boolean,
      default: false,
    },
  },
  emits: {
    'confirm': () => true,
    'edit-step': (step: EditStep) =>
      step === 'corp' || step === 'prelude' || step === 'ceo' || step === 'projects',
  },
  data(): DataModel {
    return {
      zoomCard: undefined,
      editMenuOpen: false,
    };
  },
  computed: {
    corpName(): string {
      return this.corpCard?.name ?? '';
    },
    /*
     * Сплит проектных карт по CardType. Тип берётся из ClientCard
     * manifest'a (getCard), потому что CardModel сам не несёт типа.
     * Карты с unresolved manifest'ом молча игнорируются — лучше
     * пропустить, чем сломать summary.
     */
    projectsActive(): ReadonlyArray<CardModel> {
      return this.projectCards.filter((c) => getCard(c.name)?.type === CardType.ACTIVE);
    },
    projectsAutomated(): ReadonlyArray<CardModel> {
      return this.projectCards.filter((c) => getCard(c.name)?.type === CardType.AUTOMATED);
    },
    projectsEvent(): ReadonlyArray<CardModel> {
      return this.projectCards.filter((c) => getCard(c.name)?.type === CardType.EVENT);
    },
    hasAnyProject(): boolean {
      return this.projectsActive.length > 0 ||
             this.projectsAutomated.length > 0 ||
             this.projectsEvent.length > 0;
    },
    corpNameForMoney(): CardName | undefined {
      return this.corpCard?.name as CardName | undefined;
    },
    preludeNames(): ReadonlyArray<CardName> {
      return this.preludeCards.map((c) => c.name as CardName);
    },
    /*
     * Money sumary (логика повторяет projects-step money panel).
     *   budget   = базовый стартовый M€ корпорации + бонусы прологов.
     *   cost     = sum(прайс карты × количество выбранных проектов).
     *   remaining = budget − cost.
     * Все вычисления — pure через initialDraftMoney utility.
     */
    budget(): number {
      const base = startingMegacredits(this.corpNameForMoney, 0) ?? 0;
      return base + afterPreludes(this.corpNameForMoney, this.preludeNames, 0);
    },
    totalCost(): number {
      return this.projectCards.length * cardCostForCorp(this.corpNameForMoney);
    },
    remainingMc(): number {
      return this.budget - this.totalCost;
    },
  },
  methods: {
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
    toggleEditMenu(): void {
      this.editMenuOpen = !this.editMenuOpen;
    },
    onEditStep(step: EditStep): void {
      this.editMenuOpen = false;
      this.$emit('edit-step', step);
    },
    /*
     * Click-outside handler в capture-фазе: закрывает edit-меню,
     * если клик пришёл не на сам wrapper (кнопку + меню). Капчер
     * нужен, потому что pill stack живёт в Teleport-е на body root и
     * его клики иначе обрабатывались бы Vue до того, как event
     * bubble дошёл бы до document. Кнопка-тоггл сама использует
     * `@click.stop`, чтобы её клик не закрывал меню сразу же.
     */
    onDocumentMousedown(event: MouseEvent): void {
      if (!this.editMenuOpen) {
        return;
      }
      const wrapper = this.$refs.editWrapper as HTMLElement | undefined;
      if (wrapper === undefined) {
        return;
      }
      const target = event.target;
      if (target instanceof Node && !wrapper.contains(target)) {
        this.editMenuOpen = false;
      }
    },
  },
  mounted() {
    document.addEventListener('mousedown', this.onDocumentMousedown, true);
  },
  beforeUnmount() {
    document.removeEventListener('mousedown', this.onDocumentMousedown, true);
  },
});
</script>
