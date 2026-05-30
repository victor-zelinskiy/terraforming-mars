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
                                     @confirm="onFinalConfirm"
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
      if (this.naturalStep !== 'done') {
        return false;
      }
      if (this.activeStepOverride !== undefined) {
        return false;
      }
      if (this.skipConfirmOpen) {
        return false;
      }
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
        if (!active) {
          this.resetLocal();
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
    onProjectsSkipRequest() {
      this.skipConfirmOpen = true;
    },
    onSkipConfirm() {
      this.committedProjects = [];
      this.workingProjects = [];
      this.skipConfirmOpen = false;
      this.activeStepOverride = undefined;
      this.finalConfirmDismissed = false;
    },
    onSkipCancel() {
      this.skipConfirmOpen = false;
    },
    onPillReopen(step: Step | 'final') {
      // Pill «Финальная сводка»: возвращаемся в финальный summary, не
      // открывая никакой step-модал. Override отключён, dismissed
      // сброшен — natural step остаётся 'done', и computed
      // `finalConfirmOpen` сразу даёт true.
      if (step === 'final') {
        this.activeStepOverride = undefined;
        this.finalConfirmDismissed = false;
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
    onFinalConfirm() {
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
            if (shouldPreserveCardPickModal(newPlayerView)) {
              root.playerView = newPlayerView;
            } else {
              root.screen = 'empty';
              root.playerView = newPlayerView;
              root.playerkey++;
              root.screen = 'player-home';
            }
            if (newPlayerView.game.phase === 'end' && window.location.pathname !== paths.THE_END) {
              window.location = window.location as any as (string & Location);
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
    },
  },
  beforeUnmount() {
    if (typeof document !== 'undefined') {
      document.body.classList.remove(BODY_CLASS);
    }
  },
});
</script>
