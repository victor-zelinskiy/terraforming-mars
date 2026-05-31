<template>
      <div class="player-status">
        <div class="player-status-bottom">
          <div :class="getLabelAndTimerClasses()">
            <div :class="getActionStatusClasses()"><span v-i18n>{{ presentation.textKey }}</span></div>
            <div class="player-status-timer" v-if="showTimer"><player-timer :timer="timer" :live="liveTimer"/></div>
          </div>
        </div>
      </div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import {ActionLabel} from '@/client/components/overview/ActionLabel';
import PlayerTimer from '@/client/components/overview/PlayerTimer.vue';
import {TimerModel} from '@/common/models/TimerModel';
import {
  presentPlayerStatus,
  StatusPresentation,
} from '@/client/components/overview/playerStatusPresenter';

/*
 * Legacy other-player статус-блок (живёт в верхнем top-bar / в шапке
 * чужой панели игрока). У него СВОЙ визуальный слой —
 * `.player-action-status-container--active/--passed` в players_overview.less,
 * который НЕ заменяется новой premium chip-системой (для top-bar свёртка
 * другая, размер другой). Но текстовый ключ и категория всё равно идут
 * через общий `presentPlayerStatus`-presenter — иначе расширение
 * ActionLabel (preludes / ceos / initialdrafting / ready) до этого
 * компонента не доходило бы и игрок видел бы сырое английское имя
 * лейбла.
 */
export default defineComponent({
  name: 'player-status',
  props: {
    timer: {
      type: Object as () => TimerModel,
      required: true,
    },
    actionLabel: {
      type: String as () => ActionLabel,
      required: true,
    },
    showTimer: {
      type: Boolean,
    },
    liveTimer: {
      type: Boolean,
    },
  },
  components: {
    PlayerTimer,
  },
  computed: {
    presentation(): StatusPresentation {
      return presentPlayerStatus(this.actionLabel);
    },
  },
  methods: {
    getLabelAndTimerClasses(): string {
      const classes = [];
      const baseClass = 'player-action-status-container';
      classes.push(baseClass);
      if (!this.showTimer) {
        classes.push('no-timer');
      }
      // Маппим presenter-категории на существующие legacy css-модификаторы.
      // У этой панели всего два визуальных модификатора — active и passed —
      // поэтому ready/next/waiting сюда не доезжают и сваливаются к
      // дефолтному «без модификатора», как и было раньше.
      if (this.presentation.category === 'passed') {
        classes.push(`${baseClass}--passed`);
      } else if (this.presentation.category === 'active') {
        classes.push(`${baseClass}--active`);
      }
      return classes.join(' ');
    },
    getActionStatusClasses(): string {
      const classes: Array<string> = ['player-action-status'];
      if (this.presentation.category === 'none') {
        classes.push('visibility-hidden');
      }
      return classes.join(' ');
    },
  },
});

</script>

