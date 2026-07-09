<template>
  <!--
    Тонкий компонент-роутер: один из набора визуальных глифов слева от
    статусной подписи игрока. Тип глифа выбирается presenter'ом
    (`presentPlayerStatus(label).glyph`) — здесь только рендеринг.

    Размер и цвет управляются CSS через хост-класс
    `.player-status-chip__glyph` + модификатор категории
    `.player-status-chip--<category>`, заданный родителем. Сам компонент
    не задаёт фиксированных размеров и не несёт цветов — он подхватывает
    `currentColor` от родительского chip'а, поэтому одна и та же иконка
    переиспользуется в left-panel-card и initial-draft-rail без правок.

    SVG-формы — простые геометрические примитивы (точка / чип / галочка /
    пауза / hollow-dot) на 14×14 view-box, stroke 1.8 px. Достаточно
    плотные для размера 9–10 px, но без лишних деталей.
  -->
  <span v-if="glyph === 'dot'"
        class="player-status-chip__glyph player-status-chip__glyph--dot"
        aria-hidden="true"></span>
  <svg v-else-if="glyph === 'check'"
       class="player-status-chip__glyph player-status-chip__glyph--check"
       viewBox="0 0 14 14"
       aria-hidden="true">
    <path d="M2.5 7.5 L5.5 10.5 L11.5 3.5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round" />
  </svg>
  <svg v-else-if="glyph === 'pause'"
       class="player-status-chip__glyph player-status-chip__glyph--pause"
       viewBox="0 0 14 14"
       aria-hidden="true">
    <!--
      Две вертикальные полоски в небольшом «выключателе» — спокойнее, чем
      красный стоп, и без галочки. Читается как «закончил действия в
      поколении».
    -->
    <rect x="4" y="3" width="2" height="8" rx="0.6" fill="currentColor"/>
    <rect x="8" y="3" width="2" height="8" rx="0.6" fill="currentColor"/>
  </svg>
  <svg v-else-if="glyph === 'cpu'"
       class="player-status-chip__glyph player-status-chip__glyph--cpu"
       viewBox="0 0 14 14"
       aria-hidden="true">
    <!--
      Небольшой «чип» — квадрат с ножками. Отличает АКТИВНЫЙ ход MarsBot от
      человеческой пульсирующей точки: честный сигнал «ходит автомат», при той
      же active-категории (свечение карточки).
    -->
    <rect x="4" y="4" width="6" height="6" rx="1"
          fill="none" stroke="currentColor" stroke-width="1.4"/>
    <rect x="6" y="6" width="2" height="2" rx="0.4" fill="currentColor"/>
    <path d="M5.5 4 V2.4 M8.5 4 V2.4 M5.5 10 V11.6 M8.5 10 V11.6 M4 5.5 H2.4 M4 8.5 H2.4 M10 5.5 H11.6 M10 8.5 H11.6"
          fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
  </svg>
  <svg v-else-if="glyph === 'clock'"
       class="player-status-chip__glyph player-status-chip__glyph--clock"
       viewBox="0 0 14 14"
       aria-hidden="true">
    <!--
      Hollow-dot со стрелочкой циферблата — компактный idle-marker. Не
      пульсирует (CSS); это про «партия идёт, но действие не на этом игроке».
    -->
    <circle cx="7" cy="7" r="4.2"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"/>
    <path d="M7 4.5 L7 7 L8.8 8.2"
          fill="none"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linecap="round"
          stroke-linejoin="round"/>
  </svg>
  <!-- glyph === 'none' → ничего не рендерим -->
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {StatusGlyph} from '@/client/components/overview/playerStatusPresenter';

export default defineComponent({
  name: 'PlayerStatusGlyph',
  props: {
    glyph: {
      type: String as PropType<StatusGlyph>,
      required: true,
    },
  },
});
</script>
