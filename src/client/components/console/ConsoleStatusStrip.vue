<template>
  <div class="con-status">
    <div class="con-status__params">
      <span class="con-status__param">
        <i class="wgt-icon wgt-icon--temperature con-status__icon" aria-hidden="true"></i>
        <span class="con-status__value">{{ game.temperature }}°C</span>
      </span>
      <span class="con-status__param">
        <i class="wgt-icon wgt-icon--oxygen con-status__icon" aria-hidden="true"></i>
        <span class="con-status__value">{{ game.oxygenLevel }}%</span>
      </span>
      <span class="con-status__param">
        <i class="wgt-icon wgt-icon--ocean con-status__icon" aria-hidden="true"></i>
        <span class="con-status__value">{{ game.oceans }}/9</span>
      </span>
      <span v-if="game.gameOptions.expansions.venus" class="con-status__param">
        <i class="wgt-icon wgt-icon--venus con-status__icon" aria-hidden="true"></i>
        <span class="con-status__value">{{ game.venusScaleLevel }}%</span>
      </span>
      <span class="con-status__gen">
        <span class="con-status__gen-label">{{ $t('Generation') }}</span>
        <span class="con-status__value">{{ game.generation }}</span>
      </span>
    </div>

    <!-- Action intelligence (feedback iteration 2): playable NOW / total —
         the same sources the desktop bar buttons read. -->
    <div class="con-status__intel">
      <span class="con-status__intel-item" :class="{'con-status__intel-item--hot': cardsPlayable > 0}">
        <BarButtonIcon name="cards" />
        <span class="con-status__intel-label">{{ $t('Cards') }}</span>
        <span class="con-status__intel-value"><b>{{ cardsPlayable }}</b>/{{ cardsTotal }}</span>
      </span>
      <span class="con-status__intel-item" :class="{'con-status__intel-item--hot': actionsAvailable > 0}">
        <BarButtonIcon name="actions" />
        <span class="con-status__intel-label">{{ $t('Actions') }}</span>
        <span class="con-status__intel-value"><b>{{ actionsAvailable }}</b>/{{ actionsTotal }}</span>
      </span>
    </div>

    <div class="con-status__players">
      <span v-for="p in players"
            :key="p.color"
            class="con-status__player"
            :class="{'con-status__player--me': p.color === thisPlayerColor, 'con-status__player--passed': passed(p.color)}">
        <span :class="'con-status__dot player_bg_color_' + p.color"></span>
        <span class="con-status__pname">{{ p.name }}</span>
        <span class="con-status__ptr">{{ p.terraformRating }} {{ $t('TR') }}</span>
        <span class="con-status__pmc">{{ p.megacredits }} M€</span>
      </span>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * Console status strip (CONSOLE_MODE_CONCEPT.md §6) — the TV-scale
 * replacement for the desktop's scattered chrome: global parameters +
 * generation + compact player cards (passed players dim). Read-only.
 */
import {defineComponent, PropType} from 'vue';
import {GameModel} from '@/common/models/GameModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import BarButtonIcon from '@/client/components/overview/BarButtonIcon.vue';

export default defineComponent({
  name: 'ConsoleStatusStrip',
  components: {BarButtonIcon},
  props: {
    game: {type: Object as PropType<GameModel>, required: true},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
    thisPlayerColor: {type: String as PropType<Color>, required: true},
    cardsPlayable: {type: Number, default: 0},
    cardsTotal: {type: Number, default: 0},
    actionsAvailable: {type: Number, default: 0},
    actionsTotal: {type: Number, default: 0},
  },
  methods: {
    passed(color: Color): boolean {
      return this.game.passedPlayers.includes(color);
    },
  },
});
</script>
