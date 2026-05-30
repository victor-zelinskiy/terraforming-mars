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
    <InitialDraftFinalConfirmContent @confirm="onFinalConfirm"
                                     @cancel="onFinalCancel" />
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
                         :activeStepOverride="pillActiveOverride"
                         @reopen="onPillReopen" />
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectInitialCardsModel, SelectCardModel, PlayerInputModel} from '@/common/models/PlayerInputModel';
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
    pillActiveOverride(): 'corp' | 'prelude' | 'ceo' | 'projects' | undefined {
      const o = this.activeStepOverride;
      if (o === undefined || o === 'done') {
        return undefined;
      }
      return o;
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
      return translateText('Start the game with the selected cards?');
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
  },
  methods: {
    // Каждый commit очищает override — если игрок открыл pill уже
    // выбранного шага и сейчас подтвердил новый выбор, нужно вернуться
    // к естественному прогрессу (например, обратно к prelude/ceo).
    onCorpConfirm(name: CardName) {
      this.committedCorp = name;
      this.activeStepOverride = undefined;
    },
    onPreludeConfirm(preludes: ReadonlyArray<CardName>) {
      this.committedPreludes = preludes;
      // working синхронизируется с committed на commit'е (чтобы
      // следующий reopen показал ровно то, что только что committed'ano).
      this.workingPreludes = preludes;
      this.activeStepOverride = undefined;
    },
    onPreludeSelectionChange(preludes: ReadonlyArray<CardName>) {
      this.workingPreludes = preludes;
    },
    onCeoConfirm(name: CardName) {
      this.committedCeo = name;
      this.activeStepOverride = undefined;
    },
    onProjectsConfirm(cards: ReadonlyArray<CardName>) {
      this.committedProjects = cards;
      this.workingProjects = cards;
      this.activeStepOverride = undefined;
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
    },
    onSkipCancel() {
      this.skipConfirmOpen = false;
    },
    onPillReopen(step: Step) {
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
    onFinalCancel() {
      this.finalConfirmDismissed = true;
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
    },
  },
  beforeUnmount() {
    if (typeof document !== 'undefined') {
      document.body.classList.remove(BODY_CLASS);
    }
  },
});
</script>
