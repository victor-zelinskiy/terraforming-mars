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
    <!--
      Кнопка «свернуть» в правом верхнем углу панели. Позволяет
      игроку временно убрать summary, осмотреть карту / pill stack /
      достижения, и вернуться через pill «Финальная сводка» в pill
      stack'е (тот остаётся видимым благодаря `finalSummaryVisited`).
      Не использует штатный minimize MandatoryInputModal — там бы
      появлялся дублирующий mandatory pill, и было бы 2 индикатора
      ожидающего summary'a. Кастомная кнопка чистая dismiss-операция.
    -->
    <button class="initial-draft-summary__minimize"
            type="button"
            :title="$t('Minimize — inspect the rest of the UI before deciding')"
            @click="$emit('minimize')">
      <span class="initial-draft-summary__minimize-glyph" aria-hidden="true">↗</span>
      <span class="initial-draft-summary__minimize-label" v-i18n>Minimize</span>
    </button>

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

    <!--
      Body = 2-колоночный grid:
        Left col:  CORP + CEO в верхнем ряду, PRELUDES под ними.
        Right col: PROJECT CARDS — 3 ряда по типу, занимают всю
                   оставшуюся ширину и высоту до низа модала.

      Когда CEO нет, top-strip остаётся однострочной (corp один) и
      preludes автоматически примыкают к corporation без пустоты.
      Когда prelude'ов нет, low row просто отсутствует.

      Projects-col растягивается на 1fr (всё свободное место по
      ширине) и заполняет вертикаль за счёт `align-items: stretch` —
      3 ряда равномерно делят пространство.
    -->
    <div class="initial-draft-summary__body">
      <div class="initial-draft-summary__left-col">
        <div class="initial-draft-summary__top-strip">
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

          <section v-if="ceoCard !== undefined"
                   class="initial-draft-summary__section">
            <div class="initial-draft-summary__section-header">
              <span class="initial-draft-summary__section-label" v-i18n>CEO</span>
              <span class="initial-draft-summary__section-name" v-i18n>{{ ceoCard.name }}</span>
            </div>
            <div class="initial-draft-summary__pile initial-draft-summary__pile--single">
              <div class="initial-draft-summary__card-slot initial-draft-summary__card-slot--ceo"
                   :title="$t('Click to view')"
                   @click.capture.stop="openFullscreen(ceoCard)">
                <Card :card="ceoCard" />
              </div>
            </div>
          </section>
        </div>

        <section v-if="preludeCards.length > 0"
                 class="initial-draft-summary__section">
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
        </section>
      </div>

      <section v-if="hasAnyProject"
               class="initial-draft-summary__section initial-draft-summary__section--projects">
        <div class="initial-draft-summary__section-header">
          <span class="initial-draft-summary__section-label" v-i18n>Project cards</span>
          <span class="initial-draft-summary__section-count">{{ projectCards.length }}</span>
        </div>
        <div class="initial-draft-summary__projects">
          <div v-if="projectsActive.length > 0"
               class="initial-draft-summary__projects-row">
            <div class="initial-draft-summary__projects-row-label">
              <span v-i18n>Active</span>
              <span class="initial-draft-summary__projects-row-count">{{ projectsActive.length }}</span>
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
               class="initial-draft-summary__projects-row">
            <div class="initial-draft-summary__projects-row-label">
              <span v-i18n>Automated</span>
              <span class="initial-draft-summary__projects-row-count">{{ projectsAutomated.length }}</span>
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
               class="initial-draft-summary__projects-row">
            <div class="initial-draft-summary__projects-row-label">
              <span v-i18n>Events</span>
              <span class="initial-draft-summary__projects-row-count">{{ projectsEvent.length }}</span>
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

/*
 * Adaptive layout — параметры лестницы деградации. Задаются в логических
 * px relative to rendered (zoomed) cards. Алгоритм layoutPile измеряет
 * реальную ширину контейнера и первой карты, считает требуемый spacing
 * между картами и применяет результат через CSS var `--card-overlap`:
 *   spacing >= NATURAL_GAP   →  NATURAL_GAP  (Stage 1: места достаточно)
 *   0 <= spacing < NATURAL  →  spacing       (Stage 2: уплотнение)
 *   MAX_OVERLAP < spacing<0 →  spacing       (Stage 4: mild overlap)
 *   spacing < MAX_OVERLAP   →  MAX_OVERLAP   (Stage 5: cap, дальше скрывается)
 */
const ADAPTIVE_NATURAL_GAP = 12;
const ADAPTIVE_MAX_OVERLAP = -95;

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
    'minimize': () => true,
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
    /*
     * Adaptive layout pass — для каждой horizontal стопки замеряем
     * доступную ширину контейнера + ширину первой карты, считаем
     * оптимальный spacing между картами по лестнице деградации
     * (см. константы выше). Без overlap'a — Stage 1. Если карт слишком
     * много — Stage 4-5 с capped overlap. Stage 3 (wrap) не используем,
     * потому что projects-row фикс высоты на grid.
     */
    recomputeAdaptiveLayout(): void {
      const root = this.$el as HTMLElement | null;
      if (root === null) {
        return;
      }
      const piles = root.querySelectorAll<HTMLElement>('.initial-draft-summary__pile--row');
      piles.forEach((pile) => this.layoutPile(pile));
    },
    layoutPile(pile: HTMLElement): void {
      const cards = pile.querySelectorAll<HTMLElement>('.initial-draft-summary__card-slot');
      const n = cards.length;
      if (n === 0) {
        return;
      }
      if (n === 1) {
        // Одна карта — overlap не нужен (и применить не к чему),
        // но всё равно сбрасываем var на natural-gap, чтобы CSS
        // fallback не оставался от предыдущего state'a.
        pile.style.setProperty('--card-overlap', `${ADAPTIVE_NATURAL_GAP}px`);
        return;
      }
      // Снимаем applied overlap на время измерения, чтобы получить
      // «натуральную» ширину карты. Без этого первая карта будет
      // искажена inline-стилем предыдущего pass'a.
      pile.style.setProperty('--card-overlap', `${ADAPTIVE_NATURAL_GAP}px`);
      const cardWidth = cards[0].getBoundingClientRect().width;
      // Эффективная ширина контейнера = clientWidth − padding − safety.
      // clientWidth включает padding (а у pile--row есть padding-right
      // под hover-лифт), который реально не доступен под карты.
      // Дополнительные 6px — запас на sub-pixel rendering при zoom 0.46.
      const style = window.getComputedStyle(pile);
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const effectiveWidth = pile.clientWidth - padX - 6;
      if (cardWidth <= 0 || effectiveWidth <= 0) {
        return;
      }
      // available spacing per gap between consecutive cards:
      //   total = n * cardWidth + (n-1) * spacing  ≤ effectiveWidth
      const spacing = (effectiveWidth - n * cardWidth) / (n - 1);
      let finalSpacing: number;
      if (spacing >= ADAPTIVE_NATURAL_GAP) {
        // Stage 1: места более чем хватает — natural gap, без растяжения.
        finalSpacing = ADAPTIVE_NATURAL_GAP;
      } else if (spacing >= 0) {
        // Stage 2: уплотнение, но без overlap.
        finalSpacing = spacing;
      } else {
        // Stage 4-5: overlap, capped на MAX_OVERLAP.
        finalSpacing = Math.max(spacing, ADAPTIVE_MAX_OVERLAP);
      }
      pile.style.setProperty('--card-overlap', `${finalSpacing}px`);
    },
    scheduleRecompute(): void {
      // Несколько RAF подряд — нужно, потому что на mount'е CSS zoom +
      // images могут ещё не загрузиться, ширина первой карты считается
      // ноль. Один пересчёт через ResizeObserver покрывает 80% case'ов,
      // но первоначальный mount всё равно требует pull чуть позже.
      if (typeof requestAnimationFrame === 'undefined') {
        this.recomputeAdaptiveLayout();
        return;
      }
      requestAnimationFrame(() => {
        this.recomputeAdaptiveLayout();
        requestAnimationFrame(() => this.recomputeAdaptiveLayout());
      });
    },
  },
  watch: {
    // Любое изменение набора карт меняет stack'и → пересчитываем.
    projectCards: {
      deep: true,
      handler() {
        this.scheduleRecompute();
      },
    },
    preludeCards: {
      deep: true,
      handler() {
        this.scheduleRecompute();
      },
    },
  },
  mounted() {
    document.addEventListener('mousedown', this.onDocumentMousedown, true);
    this.scheduleRecompute();
    window.addEventListener('resize', this.scheduleRecompute);
    // ResizeObserver на корне компонента — реагирует на изменения
    // ширины модала, изменения CSS zoom (media queries) и любые
    // другие изменения layout, не покрытые window.resize. Храним
    // экземпляр через cast на `any`, чтобы не разводить отдельное
    // поле в DataModel (он не reactive и не должен триггерить
    // компонент).
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => this.scheduleRecompute());
      observer.observe(this.$el as HTMLElement);
      (this as unknown as {__resizeObserver: ResizeObserver}).__resizeObserver = observer;
    }
  },
  beforeUnmount() {
    document.removeEventListener('mousedown', this.onDocumentMousedown, true);
    window.removeEventListener('resize', this.scheduleRecompute);
    const observer = (this as unknown as {__resizeObserver?: ResizeObserver}).__resizeObserver;
    observer?.disconnect();
  },
});
</script>
