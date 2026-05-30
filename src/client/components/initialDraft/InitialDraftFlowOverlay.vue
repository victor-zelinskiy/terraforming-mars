<template>
  <!--
    Initial draft flow overlay.

    Активируется как только сервер прислал prompt типа `'initialCards'`.
    Парсит вложенный set из 4 опциональных шагов (corp / prelude / CEO /
    проекты), держит локальные выборы и шагает по ним. Реальный submit
    на сервер отправляется одним пакетным `initialCards` ответом только
    после финального подтверждения (этап 6).

    Параллельно держит `body.initial-draft-active` — глобальный флаг,
    через который `initial_draft.less` прячет нерелевантный HUD
    (см. CLAUDE.md «UI Philosophy: dedicated buttons …» и собственный
    LESS-файл).

    Этап 4: corp → prelude → CEO → projects. Каждый из шагов опционален
    с точки зрения серверного prompt'а (prelude / CEO появляются только
    если включены соответствующие расширения); если соответствующего
    input'а в playerinput.options нет, шаг автоматически пропускается.
    После projects остаётся 'done' — final confirm popup + submit
    прилетят на этапе 6; до тех пор стартовый экран остаётся «слепым
    тупиком» после совершения всех выборов.

    Skip-flow для проектов: если игрок нажимает «Пропустить» (пустой
    selected[]), проектный модал эмитит skip-request — мы показываем
    лёгкий confirm popup `InitialDraftSkipConfirmContent`. Continue →
    committedProjects = [] (явный осознанный выбор). Go back → возврат
    к проектному модалу.
  -->
  <MandatoryInputModal v-if="activeStep === 'corp' && corpInput !== undefined"
                       :title="corpInput.title">
    <InitialDraftCorpStep :playerinput="corpInput"
                          :preSelected="committedCorp"
                          @confirm="onCorpConfirm" />
  </MandatoryInputModal>
  <MandatoryInputModal v-else-if="activeStep === 'prelude' && preludeInput !== undefined"
                       :title="preludeInput.title">
    <InitialDraftPreludeStep :playerinput="preludeInput"
                             :corpName="committedCorp"
                             :preSelected="workingPreludes"
                             @selection-change="onPreludeSelectionChange"
                             @confirm="onPreludeConfirm" />
  </MandatoryInputModal>
  <MandatoryInputModal v-else-if="activeStep === 'ceo' && ceoInput !== undefined"
                       :title="ceoInput.title">
    <InitialDraftCeoStep :playerinput="ceoInput"
                         :preSelected="committedCeo"
                         @confirm="onCeoConfirm" />
  </MandatoryInputModal>
  <MandatoryInputModal v-else-if="activeStep === 'projects' && projectsInput !== undefined && !skipConfirmOpen"
                       :title="projectsInput.title">
    <InitialDraftProjectsStep :playerinput="projectsInput"
                              :corpName="committedCorp"
                              :selectedPreludes="committedPreludes"
                              :preSelected="workingProjects"
                              @selection-change="onProjectsSelectionChange"
                              @confirm="onProjectsConfirm"
                              @skip-request="onProjectsSkipRequest" />
  </MandatoryInputModal>

  <MandatoryInputModal v-if="skipConfirmOpen"
                       :title="skipConfirmTitle"
                       :minimizable="false">
    <InitialDraftSkipConfirmContent @confirm="onSkipConfirm"
                                    @cancel="onSkipCancel" />
  </MandatoryInputModal>

  <MandatoryInputModal v-if="finalConfirmOpen"
                       :title="finalConfirmTitle"
                       :minimizable="false">
    <InitialDraftFinalConfirmContent :corpCard="summaryCorpCard"
                                     :preludeCards="summaryPreludeCards"
                                     :ceoCard="summaryCeoCard"
                                     :projectCards="summaryProjectCards"
                                     :hasPrelude="preludeInput !== undefined"
                                     :hasCeo="ceoInput !== undefined"
                                     :hasProjects="projectsInput !== undefined"
                                     :awaiting="awaitingOtherPlayers"
                                     @confirm="onFinalConfirm"
                                     @minimize="onFinalMinimize"
                                     @edit-step="onEditStep" />
  </MandatoryInputModal>

  <InitialDraftPillStack v-if="isActive"
                         :committedCorp="committedCorp"
                         :committedPreludes="committedPreludes"
                         :committedCeo="committedCeo"
                         :committedProjects="committedProjects"
                         :workingPreludes="workingPreludes"
                         :workingProjects="workingProjects"
                         :visitedPrelude="visitedPrelude"
                         :visitedProjects="visitedProjects"
                         :hasPrelude="preludeInput !== undefined"
                         :hasCeo="ceoInput !== undefined"
                         :hasProjects="projectsInput !== undefined"
                         :showFinalPill="showFinalPill"
                         :activeStepOverride="pillActiveOverride"
                         @reopen="onPillReopen" />
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectInitialCardsModel, SelectCardModel, PlayerInputModel} from '@/common/models/PlayerInputModel';
import {CardModel} from '@/common/models/CardModel';
import * as titles from '@/common/inputs/SelectInitialCards';
import {CardName} from '@/common/cards/CardName';
import MandatoryInputModal from '@/client/components/MandatoryInputModal.vue';
import InitialDraftCorpStep from '@/client/components/initialDraft/InitialDraftCorpStep.vue';
import InitialDraftPreludeStep from '@/client/components/initialDraft/InitialDraftPreludeStep.vue';
import InitialDraftCeoStep from '@/client/components/initialDraft/InitialDraftCeoStep.vue';
import InitialDraftProjectsStep from '@/client/components/initialDraft/InitialDraftProjectsStep.vue';
import InitialDraftSkipConfirmContent from '@/client/components/initialDraft/InitialDraftSkipConfirmContent.vue';
import InitialDraftFinalConfirmContent from '@/client/components/initialDraft/InitialDraftFinalConfirmContent.vue';
import InitialDraftPillStack from '@/client/components/initialDraft/InitialDraftPillStack.vue';
import {translateText} from '@/client/directives/i18n';
import {Message} from '@/common/logs/Message';
import {paths} from '@/common/app/paths';
import {statusCode} from '@/common/http/statusCode';
import {INVALID_RUN_ID, AppErrorResponse} from '@/common/app/AppErrorId';
import {SelectInitialCardsResponse, InputResponse} from '@/common/inputs/InputResponse';
import {vueRoot} from '@/client/components/vueRoot';
import {shouldPreserveCardPickModal} from '@/client/components/draftWaitState';
import {Phase} from '@/common/Phase';
import {initialDraftSharedState} from '@/client/components/initialDraft/initialDraftSharedState';

const CANNOT_CONTACT_SERVER = 'Unable to reach the server. It may be restarting or down for maintenance.';

const BODY_CLASS = 'initial-draft-active';

// Состояния state machine. Шаги добавляются по мере реализации
// последующих этапов; «done» — все обязательные выборы сделаны
// (срабатывает final-confirm popup, этап 6).
type Step = 'corp' | 'prelude' | 'ceo' | 'projects' | 'done';

type DataModel = {
  committedCorp: CardName | undefined;
  committedPreludes: ReadonlyArray<CardName>;
  committedCeo: CardName | undefined;
  committedProjects: ReadonlyArray<CardName> | undefined;
  // когда true — игрок открыл final confirm popup и нажал
  // «Изменить выбор», т.е. явно отказался от автоматического
  // показа popup'а до того, как откроет pill для пересмотра.
  finalConfirmDismissed: boolean;
  // когда true — открыт лёгкий confirm popup, который спрашивает,
  // действительно ли игрок хочет пропустить покупку стартовых карт.
  skipConfirmOpen: boolean;
  // Перекрытие natural step: игрок кликнул pill уже committed шага,
  // чтобы его пересмотреть. Сбрасывается, как только этот шаг
  // подтверждён повторно (или сервер прислал новый initialCards prompt).
  activeStepOverride: Step | undefined;
  // Visited флаги. Pill для multi-select шагов (prelude / projects)
  // показывается как только игрок открыл шаг хоть раз — даже если
  // он ещё не подтвердил выбор. Это нужно для кейса «зашёл в проекты,
  // нажал pill прологов посмотреть, теперь хочет вернуться в проекты,
  // а pill'a нет». Watcher на activeStep ставит флаг автоматически.
  visitedPrelude: boolean;
  visitedProjects: boolean;
  // In-flight selection шагов prelude / projects. Раньше жила локально
  // в Step-компоненте и терялась при unmount (когда игрок переключался
  // через pill). Теперь хранится в overlay и передаётся обратно как
  // preSelected при ре-открытии — выбор не теряется.
  workingPreludes: ReadonlyArray<CardName>;
  workingProjects: ReadonlyArray<CardName>;
  // Visited флаг для финального summary popup'a. Поднимается, как
  // только summary был открыт хотя бы раз. Позволяет показать pill
  // «Финальная сводка» в pill stack'е, чтобы игрок, нажавший
  // «Изменить выбор», мог быстро вернуться к summary без повторного
  // полного прогресса по шагам.
  finalSummaryVisited: boolean;
  // Когда true — игрок уже отправил финальный submit, сервер принял
  // ответ, но партия ещё не стартует (ждём пока остальные игроки
  // подтвердят свой выбор). Summary остаётся открытым в locked
  // read-only state с «ОЖИДАЕМ ИГРОКОВ» в primary CTA. Сбрасывается
  // только при полном remount overlay'a (фаза игры меняется на
  // ACTION / PRODUCTION / etc).
  awaitingOtherPlayers: boolean;
};

function titleText(t: string | Message | undefined): string | undefined {
  if (t === undefined) {
    return undefined;
  }
  return typeof t === 'string' ? t : t.message;
}

function findSelectCardOption(
  options: ReadonlyArray<PlayerInputModel> | undefined,
  expected: string,
): SelectCardModel | undefined {
  if (options === undefined) {
    return undefined;
  }
  const match = options.find((o) => titleText(o.title) === expected);
  if (match === undefined || match.type !== 'card') {
    return undefined;
  }
  return match;
}

export default defineComponent({
  name: 'InitialDraftFlowOverlay',
  components: {
    MandatoryInputModal,
    InitialDraftCorpStep,
    InitialDraftPreludeStep,
    InitialDraftCeoStep,
    InitialDraftProjectsStep,
    InitialDraftSkipConfirmContent,
    InitialDraftFinalConfirmContent,
    InitialDraftPillStack,
  },
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
  },
  data(): DataModel {
    return {
      committedCorp: undefined,
      committedPreludes: [],
      committedCeo: undefined,
      committedProjects: undefined,
      finalConfirmDismissed: false,
      skipConfirmOpen: false,
      activeStepOverride: undefined,
      visitedPrelude: false,
      visitedProjects: false,
      workingPreludes: [],
      workingProjects: [],
      finalSummaryVisited: false,
      awaitingOtherPlayers: false,
    };
  },
  computed: {
    initialCardsInput(): SelectInitialCardsModel | undefined {
      const wf = this.playerView.waitingFor;
      if (wf === undefined || wf.type !== 'initialCards') {
        return undefined;
      }
      return wf;
    },
    isActive(): boolean {
      // После submit'a `waitingFor.type === 'initialCards'` уже false
      // (сервер принял наш ответ), но мы остаёмся в waiting-state
      // пока другие игроки не подтвердят. body.initial-draft-active +
      // overlay должны жить весь этот период.
      if (this.awaitingOtherPlayers) {
        return true;
      }
      return this.initialCardsInput !== undefined;
    },
    corpInput(): SelectCardModel | undefined {
      return findSelectCardOption(this.initialCardsInput?.options, titles.SELECT_CORPORATION_TITLE);
    },
    preludeInput(): SelectCardModel | undefined {
      return findSelectCardOption(this.initialCardsInput?.options, titles.SELECT_PRELUDE_TITLE);
    },
    ceoInput(): SelectCardModel | undefined {
      return findSelectCardOption(this.initialCardsInput?.options, titles.SELECT_CEO_TITLE);
    },
    projectsInput(): SelectCardModel | undefined {
      return findSelectCardOption(this.initialCardsInput?.options, titles.SELECT_PROJECTS_TITLE);
    },
    // Естественный текущий шаг — рассчитывается по уже совершённым
    // выборам, пропускает шаги, для которых сервер не прислал input.
    naturalStep(): Step {
      if (!this.isActive) {
        return 'done';
      }
      if (this.corpInput !== undefined && this.committedCorp === undefined) {
        return 'corp';
      }
      if (this.preludeInput !== undefined && this.committedPreludes.length < this.preludeInput.min) {
        return 'prelude';
      }
      if (this.ceoInput !== undefined && this.committedCeo === undefined) {
        return 'ceo';
      }
      if (this.projectsInput !== undefined && this.committedProjects === undefined) {
        return 'projects';
      }
      return 'done';
    },
    // Что реально открыто прямо сейчас: либо перекрытый pill'ом шаг
    // (если игрок кликнул pill уже committed выбора), либо естественный
    // шаг. Override очищается на successfull confirm в `onCorpConfirm` /
    // `onPreludeConfirm` / etc.
    activeStep(): Step {
      if (this.activeStepOverride !== undefined) {
        return this.activeStepOverride;
      }
      return this.naturalStep;
    },
    skipConfirmTitle(): string {
      return translateText('Continue without buying any project cards?');
    },
    // Pill stack принимает только 4 «реальных» шага (corp/prelude/
    // ceo/projects). 'done' override pill'ом сделать нельзя — поэтому
    // отсекаем его на типовом уровне здесь.
    pillActiveOverride(): 'corp' | 'prelude' | 'ceo' | 'projects' | 'final' | undefined {
      // Финальный summary имеет приоритет: пока он открыт, pill
      // «Финальная сводка» подсвечен как текущий и игрок видит, где
      // он находится. activeStepOverride и finalConfirmOpen взаимно
      // исключают друг друга (см. computed `finalConfirmOpen`), но
      // явная проверка делает приоритет читаемым.
      if (this.finalConfirmOpen) {
        return 'final';
      }
      const o = this.activeStepOverride;
      if (o === undefined || o === 'done') {
        return undefined;
      }
      return o;
    },
    /*
     * Pill «Финальная сводка» виден сразу после первого открытия
     * summary и остаётся на месте — даже когда summary открыта.
     * Pills вверху работают как progress-track «где игрок находится»;
     * прятать pill при открытом summary нарушало бы этот контракт.
     * Подсветка активной плашки идёт через `pillActiveOverride`.
     */
    showFinalPill(): boolean {
      return this.finalSummaryVisited;
    },
    /*
     * Резолв CardName → CardModel из соответствующих dealt-cards-наборов
     * playerView. Нужно для финальной summary'и, которая показывает
     * полноценные мини-карты вместо имён. find() безопасен — committed
     * имена пришли как раз из dealt arrays при выборе, всегда найдутся.
     */
    summaryCorpCard(): CardModel | undefined {
      if (this.committedCorp === undefined) {
        return undefined;
      }
      const target = this.committedCorp;
      return this.playerView.dealtCorporationCards.find((c) => c.name === target);
    },
    summaryPreludeCards(): ReadonlyArray<CardModel> {
      const dealt = this.playerView.dealtPreludeCards;
      return this.committedPreludes
        .map((name) => dealt.find((c) => c.name === name))
        .filter((c): c is CardModel => c !== undefined);
    },
    summaryCeoCard(): CardModel | undefined {
      if (this.committedCeo === undefined) {
        return undefined;
      }
      const target = this.committedCeo;
      return this.playerView.dealtCeoCards.find((c) => c.name === target);
    },
    summaryProjectCards(): ReadonlyArray<CardModel> {
      if (this.committedProjects === undefined) {
        return [];
      }
      const dealt = this.playerView.dealtProjectCards;
      return this.committedProjects
        .map((name) => dealt.find((c) => c.name === name))
        .filter((c): c is CardModel => c !== undefined);
    },
    // Финальный confirm popup открыт, когда все обязательные шаги
    // совершены (naturalStep === 'done'), нет открытого pill-override,
    // нет открытого skip popup'а, и игрок ещё не нажимал «Изменить
    // выбор» (или нажимал, но потом снова открыл pill для пересмотра).
    finalConfirmOpen(): boolean {
      if (!this.isActive) {
        return false;
      }
      // В awaiting-state модал ВСЕГДА открыт — это и есть main UI
      // post-submit waiting'a. dismiss не работает.
      if (this.awaitingOtherPlayers) {
        return true;
      }
      if (this.naturalStep !== 'done') {
        return false;
      }
      if (this.activeStepOverride !== undefined) {
        return false;
      }
      // Skip popup теперь рендерится ПОВЕРХ summary'a (а не заменяет
      // его), поэтому finalConfirmOpen остаётся true даже когда
      // skipConfirmOpen=true. Backdrop'ы наслаиваются, skip popup
      // визуально доминирует.
      return !this.finalConfirmDismissed;
    },
    finalConfirmTitle(): string {
      return translateText('Final selection');
    },
  },
  watch: {
    isActive: {
      immediate: true,
      handler(active: boolean) {
        if (typeof document !== 'undefined') {
          document.body.classList.toggle(BODY_CLASS, active);
        }
        // Зеркалим в shared state, чтобы PlayerHome знал об active
        // initial draft (включая awaiting post-submit window) и не
        // снял rail'а раньше времени.
        initialDraftSharedState.active = active;
        if (!active) {
          this.resetLocal();
        }
      },
    },
    /*
     * body.initial-draft-awaiting-others — CSS-гейт для блокировки
     * pill stack'a и других интерактивных элементов: «никаких
     * изменений после submit'a». Включается одновременно с
     * awaitingOtherPlayers, выключается при resetLocal (overlay
     * remount по phase change).
     */
    awaitingOtherPlayers: {
      immediate: true,
      handler(awaiting: boolean) {
        if (typeof document !== 'undefined') {
          document.body.classList.toggle('initial-draft-awaiting-others', awaiting);
        }
      },
    },
    /*
     * Phase change ловим через polling: пока мы в awaiting, polling в
     * WaitingFor.vue продолжает тянуть playerView. Когда последний
     * игрок отправит свой initial draft, серверная фаза уйдёт из
     * INITIALDRAFTING — это сигнал «партия стартовала, можно
     * отрисовать игровой UI». Снимаем awaitingOtherPlayers и делаем
     * playerkey++ remount, чтобы PlayerHome перерисовался с нужными
     * для новой фазы prompt'ами (RESEARCH / ACTION / etc).
     */
    'playerView.game.phase': {
      handler(phase: Phase | undefined) {
        if (!this.awaitingOtherPlayers) {
          return;
        }
        if (phase !== Phase.INITIALDRAFTING) {
          this.awaitingOtherPlayers = false;
          const root = vueRoot(this);
          root.screen = 'empty';
          root.playerkey++;
          root.screen = 'player-home';
        }
      },
    },
    /*
     * Любое появление шага (через естественный прогресс ИЛИ override
     * pill'ом) поднимает visited-флаг. Для multi-select шагов pill
     * остаётся видимым после этого, даже если игрок ушёл без commit'а.
     * Watcher специально без `immediate: true` — на mount шаг 'corp'
     * ещё не считается «visited» в кадре, что не имеет значения, потому
     * что pill для corp всё равно гейтится не visited'ом, а committed'ом.
     */
    activeStep: {
      handler(step: Step) {
        if (step === 'prelude') {
          this.visitedPrelude = true;
        }
        if (step === 'projects') {
          this.visitedProjects = true;
        }
      },
    },
    /*
     * Любое открытие финальной summary поднимает visited-флаг. После
     * этого pill «Финальная сводка» остаётся в pill stack'е и игрок
     * может быстро вернуться к ней, даже если нажал «Изменить выбор».
     */
    finalConfirmOpen: {
      handler(open: boolean) {
        if (open) {
          this.finalSummaryVisited = true;
        }
      },
    },
  },
  methods: {
    /*
     * Каждый commit:
     *   - очищает override (если игрок зашёл через pill, после нового
     *     commit'а вернуться к natural прогрессу),
     *   - сбрасывает finalConfirmDismissed — даже если игрок ничего
     *     не поменял, после «Подтвердить» он ожидает вернуться к
     *     финальной сводке, если она уже была доступна. Без сброса
     *     dismissed модал шага закрывался бы в пустоту (final NOT
     *     открывался автоматически).
     */
    onCorpConfirm(name: CardName) {
      this.committedCorp = name;
      this.activeStepOverride = undefined;
      this.finalConfirmDismissed = false;
    },
    onPreludeConfirm(preludes: ReadonlyArray<CardName>) {
      this.committedPreludes = preludes;
      // working синхронизируется с committed на commit'е (чтобы
      // следующий reopen показал ровно то, что только что committed'ano).
      this.workingPreludes = preludes;
      this.activeStepOverride = undefined;
      this.finalConfirmDismissed = false;
    },
    onPreludeSelectionChange(preludes: ReadonlyArray<CardName>) {
      this.workingPreludes = preludes;
    },
    onCeoConfirm(name: CardName) {
      this.committedCeo = name;
      this.activeStepOverride = undefined;
      this.finalConfirmDismissed = false;
    },
    onProjectsConfirm(cards: ReadonlyArray<CardName>) {
      this.committedProjects = cards;
      this.workingProjects = cards;
      this.activeStepOverride = undefined;
      this.finalConfirmDismissed = false;
    },
    onProjectsSelectionChange(cards: ReadonlyArray<CardName>) {
      this.workingProjects = cards;
    },
    /*
     * «Пропустить» в проектном шаге теперь сразу коммитит пустой
     * выбор — без промежуточного confirm popup'a. Скип-подтверждение
     * переехало в final flow: финальный «НАЧАТЬ» при пустых проектах
     * вызывает skip popup поверх summary'а, и только после явного
     * подтверждения там идёт submit.
     */
    onProjectsSkipRequest() {
      this.committedProjects = [];
      this.workingProjects = [];
      this.activeStepOverride = undefined;
      this.finalConfirmDismissed = false;
    },
    onSkipConfirm() {
      // Skip-popup на финале подтверждён → отправляем submit на сервер.
      this.skipConfirmOpen = false;
      this.submitFinal();
    },
    onSkipCancel() {
      this.skipConfirmOpen = false;
    },
    onPillReopen(step: Step | 'final') {
      // Pill «Финальная сводка»: возвращаемся в финальный summary, не
      // открывая никакой step-модал. Override отключён, dismissed
      // сброшен — natural step остаётся 'done', и computed
      // `finalConfirmOpen` сразу даёт true. В awaiting-state это
      // ЕДИНСТВЕННАЯ pill, которая остаётся рабочей — она нужна, чтобы
      // восстановить свёрнутое окно «ожидаем игроков».
      if (step === 'final') {
        this.activeStepOverride = undefined;
        this.finalConfirmDismissed = false;
        return;
      }
      // Step-pills (corp/prelude/ceo/projects) в awaiting-state не
      // открывают никаких модалов — выбор уже отправлен на сервер,
      // менять его нельзя.
      if (this.awaitingOtherPlayers) {
        return;
      }
      // 'done' через pill реоткрыть нельзя: pill stack эмитит только
      // конкретные шаги (corp / prelude / ceo / projects).
      if (step === 'done') {
        return;
      }
      this.activeStepOverride = step;
      // Открыли pill для пересмотра — после нового commit'а вернёмся
      // к естественному прогрессу и должны снова автоматически
      // показать финальный popup (если все обязательные шаги покрыты).
      this.finalConfirmDismissed = false;
    },
    /*
     * «Изменить выбор» в финальной сводке — теперь dropdown с явным
     * выбором шага. Эмитится `edit-step` со значением 'corp' / 'prelude'
     * / 'ceo' / 'projects'. Закрываем summary через dismissed-флаг
     * (иначе при возврате к natural 'done' она открылась бы автоматом
     * и закрыла бы только что открытый редактируемый шаг) и ставим
     * override на выбранный шаг.
     */
    onEditStep(step: 'corp' | 'prelude' | 'ceo' | 'projects') {
      this.finalConfirmDismissed = true;
      this.activeStepOverride = step;
    },
    /*
     * «Свернуть» — кастомная dismiss-операция (не штатный
     * MandatoryInputModal minimize, который бы дал дублирующий
     * mandatory-pill параллельно с pill «Финальная сводка»). Просто
     * закрываем summary через dismissed-флаг; pill stack pill final
     * остаётся видимым (тот рендерится при `finalSummaryVisited`),
     * игрок возвращается в summary кликом по нему.
     */
    onFinalMinimize() {
      this.finalConfirmDismissed = true;
    },
    onFinalConfirm() {
      // Если committedProjects пуст (игрок не купил ни одной карты),
      // показываем skip-confirm popup ПОВЕРХ финального summary'a.
      // submit отправляется только после явного «Продолжить». Если хоть
      // одна карта выбрана — сразу submit, без popup'a.
      if (this.projectsInput !== undefined &&
          this.committedProjects !== undefined &&
          this.committedProjects.length === 0) {
        this.skipConfirmOpen = true;
        return;
      }
      this.submitFinal();
    },
    /*
     * Собираем агрегированный SelectInitialCardsResponse в строгом
     * порядке (corp / prelude / ceo / projects) — пропуская опциональные
     * блоки, которых нет в playerinput.options. Точно повторяет shape,
     * что отправлял legacy SelectInitialCards.vue, чтобы серверный
     * обработчик не заметил подмены.
     */
    buildResponse(): SelectInitialCardsResponse {
      const responses: InputResponse[] = [];
      if (this.corpInput !== undefined && this.committedCorp !== undefined) {
        responses.push({type: 'card', cards: [this.committedCorp]});
      }
      if (this.preludeInput !== undefined) {
        responses.push({type: 'card', cards: [...this.committedPreludes]});
      }
      if (this.ceoInput !== undefined && this.committedCeo !== undefined) {
        responses.push({type: 'card', cards: [this.committedCeo]});
      }
      if (this.projectsInput !== undefined) {
        responses.push({type: 'card', cards: [...(this.committedProjects ?? [])]});
      }
      return {type: 'initialCards', responses};
    },
    /*
     * Отправка результата на сервер. Inline replica
     * WaitingFor.fetchPlayerInput, по аналогии с DraftFlowOverlay —
     * legacy WaitingFor в legacy-ui-overlay скрыт нашим CSS, его
     * onsave дёрнуть нельзя, поэтому собираем POST прямо здесь.
     *
     * shouldPreserveCardPickModal обычно вернёт false (сервер уходит
     * в RESEARCH / ACTION после initialCards), и playerkey++ снесёт
     * наш overlay вместе со всем initial-draft контекстом — это OK,
     * мы для этого и здесь.
     */
    /*
     * Сервер всё ещё в фазе INITIALDRAFTING — наш submit принят, но
     * другие игроки ещё не подтвердили свой initial draft. Используется
     * в submitFinal'е для перехода в awaiting-state вместо мгновенного
     * playerkey++ remount'a. RESEARCH / PRELUDES / CEOS — уже игровые
     * фазы (первое поколение), в них нужен полноценный игровой UI
     * (кнопки действий, поле и т.д.), поэтому в awaiting не уводим.
     */
    isStillInInitialDraft(view: PlayerViewModel): boolean {
      return view.game.phase === Phase.INITIALDRAFTING;
    },
    submitFinal(): void {
      const view = this.playerView;
      const root = vueRoot(this);
      if (root.isServerSideRequestInProgress) {
        return;
      }
      root.isServerSideRequestInProgress = true;

      const response = this.buildResponse();
      const url = paths.PLAYER_INPUT + '?id=' + view.id;

      fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({runId: view.runId, ...response}),
      })
        .then(async (httpResponse) => {
          if (httpResponse.ok) {
            const newPlayerView = await httpResponse.json() as PlayerViewModel;
            /*
             * Если игра ушла в END — стандартный flow с redirect.
             * Иначе: если сервер всё ещё в pre-game фазе (нас приняли,
             * но другие игроки ещё в initial draft), переходим в
             * awaiting-state. Modal остаётся открытым с «ОЖИДАЕМ
             * ИГРОКОВ» UI; polling от WaitingFor подхватит phase
             * change позже и сделает full remount overlay'a, после
             * чего initial draft закроется автоматически.
             *
             * Если же сервер сразу перевёл игру в ACTION (все игроки
             * успели submit'нуть одновременно), идём по стандартному
             * playerkey++ path — модал закроется через
             * `applyPlayerViewUpdate`.
             */
            if (newPlayerView.game.phase === 'end' && window.location.pathname !== paths.THE_END) {
              window.location = window.location as any as (string & Location);
              return;
            }
            if (this.isStillInInitialDraft(newPlayerView)) {
              // Reactive swap без playerkey++, остаёмся в waiting UI.
              root.playerView = newPlayerView;
              this.awaitingOtherPlayers = true;
            } else if (shouldPreserveCardPickModal(newPlayerView)) {
              root.playerView = newPlayerView;
            } else {
              root.screen = 'empty';
              root.playerView = newPlayerView;
              root.playerkey++;
              root.screen = 'player-home';
            }
            return;
          }
          if (httpResponse.status === statusCode.badRequest) {
            const resp = await httpResponse.json() as AppErrorResponse;
            let cb = () => { /* default no-op */ };
            if (resp.id === INVALID_RUN_ID) {
              cb = () => setTimeout(() => window.location.reload(), 100);
            }
            root.showAlert('Error with input', resp.message, cb);
          } else {
            root.showAlert(
              'Error processing response',
              'Unexpected response from server. Please try again.',
            );
            console.error(httpResponse.statusText);
          }
        })
        .catch((e) => {
          root.showAlert('Error sending input', CANNOT_CONTACT_SERVER);
          console.error(e);
        })
        .finally(() => {
          root.isServerSideRequestInProgress = false;
        });
    },
    resetLocal() {
      this.committedCorp = undefined;
      this.committedPreludes = [];
      this.committedCeo = undefined;
      this.committedProjects = undefined;
      this.finalConfirmDismissed = false;
      this.skipConfirmOpen = false;
      this.activeStepOverride = undefined;
      this.visitedPrelude = false;
      this.visitedProjects = false;
      this.workingPreludes = [];
      this.workingProjects = [];
      this.finalSummaryVisited = false;
      this.awaitingOtherPlayers = false;
    },
  },
  beforeUnmount() {
    if (typeof document !== 'undefined') {
      document.body.classList.remove(BODY_CLASS);
    }
  },
});
</script>
