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
        <span class="initial-draft-pill__sep">/</span>
        <span class="initial-draft-pill__value">{{ pill.value }}</span>
        <span class="initial-draft-pill__icon" aria-hidden="true">↺</span>
      </button>
    </div>
  </Teleport>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

type PillStep = 'corp' | 'prelude' | 'ceo' | 'projects';

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
    // Текущий перекрытый шаг (если игрок уже кликнул pill).
    // Подсвечивает активную плашку.
    activeStepOverride: {
      type: String as PropType<PillStep | undefined>,
      default: undefined,
    },
  },
  emits: {
    reopen: (step: PillStep) =>
      step === 'corp' || step === 'prelude' || step === 'ceo' || step === 'projects',
  },
  computed: {
    pills(): ReadonlyArray<Pill> {
      const result: Pill[] = [];
      if (this.committedCorp !== undefined) {
        result.push({
          step: 'corp',
          label: translateText('Corporation'),
          value: this.committedCorp,
          tooltip: translateText('Click to change corporation'),
        });
      }
      if (this.hasPrelude && this.committedPreludes.length > 0) {
        result.push({
          step: 'prelude',
          label: translateText('Preludes'),
          value: translateTextWithParams(
            '${0} selected', [String(this.committedPreludes.length)]),
          tooltip: translateText('Click to change preludes'),
        });
      }
      if (this.hasCeo && this.committedCeo !== undefined) {
        result.push({
          step: 'ceo',
          label: translateText('CEO'),
          value: this.committedCeo,
          tooltip: translateText('Click to change CEO'),
        });
      }
      if (this.hasProjects && this.committedProjects !== undefined) {
        const count = this.committedProjects.length;
        const value = count === 0 ?
          translateText('Skipped') :
          translateTextWithParams('${0} cards', [String(count)]);
        result.push({
          step: 'projects',
          label: translateText('Projects'),
          value,
          tooltip: translateText('Click to change project cards'),
        });
      }
      return result;
    },
  },
});
</script>
