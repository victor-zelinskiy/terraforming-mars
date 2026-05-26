<template>
  <div :class="cardClass" @click="$emit('select', player.color)">
    <div class="left-panel-card-row left-panel-card-row--top">
      <div :class="cubeClass"></div>
      <div class="left-panel-card-name" :class="playerNameShadowClass">{{ player.name }}</div>
    </div>
    <div v-if="corporationName" class="left-panel-card-corp" :title="corporationName" v-i18n>{{ corporationName }}</div>
    <div class="left-panel-card-row left-panel-card-row--stats">
      <div class="left-panel-card-stat left-panel-card-stat--vp" :title="$t('Victory points')">
        <span class="left-panel-card-stat-label">ПО</span>
        <span class="left-panel-card-stat-value">{{ hideVp ? '?' : vp }}</span>
      </div>
      <div class="left-panel-card-stat left-panel-card-stat--tr" :title="$t('Terraforming Rating')">
        <span class="left-panel-card-stat-label">РТ</span>
        <span class="left-panel-card-stat-value">{{ tr }}</span>
      </div>
    </div>
    <div v-if="actionLabel !== 'none' && actionLabel !== ''" :class="statusClass"><span v-i18n>{{ actionLabel }}</span></div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {playerColorClass} from '@/common/utils/utils';
import {CardType} from '@/common/cards/CardType';
import {getCard} from '@/client/cards/ClientCardManifest';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {ActionLabel} from './ActionLabel';

export default defineComponent({
  name: 'LeftPlayerCard',
  props: {
    player: {
      type: Object as () => PublicPlayerModel,
      required: true,
    },
    selected: {
      type: Boolean,
      default: false,
    },
    hideVp: {
      type: Boolean,
      default: false,
    },
    actionLabel: {
      type: String as () => ActionLabel,
      default: 'none',
    },
  },
  emits: ['select'],
  computed: {
    cardClass(): string {
      const classes = ['left-panel-card'];
      if (this.selected) {
        classes.push('left-panel-card--selected');
      }
      return classes.join(' ');
    },
    // Cube carries the player colour plus the legacy `.preferences_player_inner.active`
    // rotation animation while we're waiting on that player to do something.
    // The decision is delegated to `actionLabelForPlayer` (in `playerLabels.ts`):
    // any "waiting" label (active / researching / drafting / turmoil) spins the
    // cube. Because the label is derived from the live `playersWaitingFor`
    // signal bubbled up from the WaitingFor poll, the spin state is the same
    // on every player's screen — no drift across simultaneous-action phases.
    // Honours the existing `hide_animated_sidebar` preference.
    cubeClass(): string {
      const classes = [
        'left-panel-card-cube',
        'preferences_player_inner',
        `player_bg_color_${this.player.color}`,
      ];
      const awaitingInput =
        this.actionLabel === 'turn' ||
        this.actionLabel === 'researching' ||
        this.actionLabel === 'drafting' ||
        this.actionLabel === 'globalsupport' ||
        this.actionLabel === 'delegate';
      if (!getPreferences().hide_animated_sidebar && awaitingInput) {
        classes.push('active');
      }
      return classes.join(' ');
    },
    playerNameShadowClass(): string {
      return playerColorClass(this.player.color, 'shadow');
    },
    corporationName(): string {
      const corps = this.player.tableau
        .filter((card) => getCard(card.name)?.type === CardType.CORPORATION)
        .map((card) => card.name);
      return corps[0] ?? '';
    },
    vp(): number {
      return this.player.victoryPointsBreakdown.total;
    },
    tr(): number {
      return this.player.terraformRating;
    },
    statusClass(): string {
      const base = 'left-panel-card-status';
      if (this.actionLabel === 'passed') {
        return `${base} ${base}--passed`;
      }
      if (this.actionLabel === 'turn' ||
          this.actionLabel === 'drafting' ||
          this.actionLabel === 'researching' ||
          this.actionLabel === 'globalsupport' ||
          this.actionLabel === 'delegate') {
        return `${base} ${base}--active`;
      }
      return base;
    },
  },
});
</script>
