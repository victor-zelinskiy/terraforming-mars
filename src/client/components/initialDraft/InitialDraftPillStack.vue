<template>
  <!--
    Стопка sci-fi плашек поверх стартового экрана. Каждая плашка
    представляет уже зафиксированный шаг initial draft flow и работает
    как «нажмите, чтобы изменить». Click → emit('reopen', step) →
    родитель ставит activeStepOverride, и соответствующий модал
    открывается заново с уже выбранными картами в pre-selected
    состоянии. Pills видны на ЛЮБОМ этапе после первого commit'а, а
    не только в финале — игрок может, например, на шаге прологов
    нажать pill корпорации и пересмотреть свой выбор.

    Pills рендерятся через Teleport в body, чтобы избежать любых
    `overflow` / `clip-path` / `transform`-контекстов из #player-home,
    и сами расставлены на z=12500 — выше backdrop'a модала (z=12000),
    но ниже native <dialog> top-layer'а fullscreen card-preview. Таким
    образом стопка видна и поверх открытого модала шага, но fullscreen
    зум карты перекроет её корректно.
  -->
  <Teleport to="body">
    <div v-if="pills.length > 0" class="initial-draft-pills">
      <button v-for="pill in pills"
              :key="pill.step"
              type="button"
              class="initial-draft-pill"
              :class="['initial-draft-pill--' + pill.step,
                       {'initial-draft-pill--active': pill.step === activeStepOverride}]"
              :title="pill.tooltip"
              @click="$emit('reopen', pill.step)">
        <span class="initial-draft-pill__dot" aria-hidden="true"></span>
        <span class="initial-draft-pill__label">{{ pill.label }}</span>
        <template v-if="pill.value">
          <span class="initial-draft-pill__sep">/</span>
          <span class="initial-draft-pill__value">{{ pill.value }}</span>
        </template>
        <span class="initial-draft-pill__icon" aria-hidden="true">↺</span>
      </button>
    </div>
  </Teleport>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

type PillStep = 'corp' | 'prelude' | 'ceo' | 'projects' | 'final';

type Pill = {
  step: PillStep;
  label: string;
  value: string;
  tooltip: string;
};

export default defineComponent({
  name: 'InitialDraftPillStack',
  props: {
    committedCorp: {
      type: String as PropType<CardName | undefined>,
      default: undefined,
    },
    committedPreludes: {
      type: Array as PropType<ReadonlyArray<CardName>>,
      default: () => [],
    },
    committedCeo: {
      type: String as PropType<CardName | undefined>,
      default: undefined,
    },
    // undefined — игрок ещё не дошёл до шага projects;
    // [] — игрок осознанно пропустил покупку (skip flow).
    committedProjects: {
      type: Array as PropType<ReadonlyArray<CardName> | undefined>,
      default: undefined,
    },
    // In-flight выбор прологов / проектов — показывается в pill'e
    // когда шаг visited, но ещё не подтверждён. Позволяет показать
    // живой counter «Выбрано: N» и не терять выбор при переключении.
    workingPreludes: {
      type: Array as PropType<ReadonlyArray<CardName>>,
      default: () => [],
    },
    workingProjects: {
      type: Array as PropType<ReadonlyArray<CardName>>,
      default: () => [],
    },
    // Visited флаги. Pill для prelude / projects показывается как
    // только игрок открыл шаг хотя бы раз — даже без commit'а — чтобы
    // можно было вернуться обратно через pill, а не вынуждать жать
    // «Подтвердить» там, где игрок ничего не менял.
    visitedPrelude: {
      type: Boolean,
      default: false,
    },
    visitedProjects: {
      type: Boolean,
      default: false,
    },
    // Эти три флага говорят, существует ли соответствующий шаг
    // в принципе (зависит от gameOptions сервера). Без флага у
    // pill'а нет данных, но и `committed*` уже не будет задан.
    // Передаём явно, чтобы pill stack не делал догадок.
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
    // Pill «Финальная сводка» — показывается, когда summary хоть раз
    // открывалась (finalSummaryVisited в overlay) и сейчас закрыта.
    // Клик возвращает игрока к summary через emit('reopen', 'final').
    showFinalPill: {
      type: Boolean,
      default: false,
    },
    // Текущий активный pill — overrid'нутый шаг (corp/prelude/ceo/projects)
    // ИЛИ 'final' когда открыта финальная сводка. Подсвечивает активную
    // плашку как «вы находитесь здесь».
    activeStepOverride: {
      type: String as PropType<PillStep | undefined>,
      default: undefined,
    },
    // True после финального submit'a — выбор отправлен, менять нельзя.
    // Step-pills (corp/prelude/ceo/projects) остаются ВИДИМЫМИ, но
    // приглушаются через body.initial-draft-awaiting-others и получают
    // tooltip-объяснение «изменить нельзя» вместо «нажмите, чтобы
    // изменить». Pill «Финальная сводка» не затрагивается — она нужна,
    // чтобы вернуть свёрнутое окно ожидания.
    awaiting: {
      type: Boolean,
      default: false,
    },
  },
  emits: {
    reopen: (step: PillStep) =>
      step === 'corp' || step === 'prelude' || step === 'ceo' ||
      step === 'projects' || step === 'final',
  },
  computed: {
    pills(): ReadonlyArray<Pill> {
      const result: Pill[] = [];
      // В awaiting-режиме step-pills нельзя редактировать — tooltip
      // объясняет почему вместо обещания «нажмите, чтобы изменить».
      const blockedTip = translateText('Selection confirmed — cannot be changed');
      if (this.committedCorp !== undefined) {
        result.push({
          step: 'corp',
          label: translateText('Corporation'),
          value: this.committedCorp,
          tooltip: this.awaiting ? blockedTip : translateText('Click to change corporation'),
        });
      }
      // Prelude pill: показывается если committed (preludes выбраны)
      // ИЛИ visited (открыт хоть раз). Visited-without-commit case даёт
      // игроку возможность вернуться обратно в проекты после похода
      // в прологи, не вынуждая «Подтвердить» там, где он ничего не менял.
      if (this.hasPrelude && (this.committedPreludes.length > 0 || this.visitedPrelude)) {
        const count = this.committedPreludes.length > 0 ?
          this.committedPreludes.length :
          this.workingPreludes.length;
        result.push({
          step: 'prelude',
          label: translateText('Preludes'),
          value: translateTextWithParams('${0} selected', [String(count)]),
          tooltip: this.awaiting ? blockedTip : translateText('Click to change preludes'),
        });
      }
      if (this.hasCeo && this.committedCeo !== undefined) {
        result.push({
          step: 'ceo',
          label: translateText('CEO'),
          value: this.committedCeo,
          tooltip: this.awaiting ? blockedTip : translateText('Click to change CEO'),
        });
      }
      // Projects pill: те же правила, что и prelude. Committed
      // («N карт» / «Пропущено») имеет приоритет над visited
      // («Выбрано: N»).
      if (this.hasProjects && (this.committedProjects !== undefined || this.visitedProjects)) {
        let value: string;
        if (this.committedProjects !== undefined) {
          const count = this.committedProjects.length;
          value = count === 0 ?
            translateText('Skipped') :
            translateTextWithParams('${0} cards', [String(count)]);
        } else {
          value = translateTextWithParams(
            '${0} selected', [String(this.workingProjects.length)]);
        }
        result.push({
          step: 'projects',
          label: translateText('Projects'),
          value,
          tooltip: this.awaiting ? blockedTip : translateText('Click to change project cards'),
        });
      }
      // Final summary pill — последний в стопке. Появляется только
      // после первого открытия summary; click возвращает к ней. Value
      // оставляем пустой — label «Финальная сводка» сам по себе говорит
      // достаточно, а value добавило бы лишнюю длину к и без того
      // длинному pill'у (с value «Готова» стопка не помещалась по
      // ширине, см. отзыв).
      if (this.showFinalPill) {
        result.push({
          step: 'final',
          label: translateText('Final summary'),
          value: '',
          tooltip: translateText('Click to return to the final summary'),
        });
      }
      return result;
    },
  },
});
</script>
