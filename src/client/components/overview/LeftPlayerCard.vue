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
    // "Waiting" covers three phases:
    //   - action phase: `actionLabel === 'active'` (their normal turn)
    //   - research phase: `actionLabel === 'researching'` (they still need to pick cards)
    //   - drafting phase: `actionLabel === 'drafting'` (they still need to pass a card)
    // In research / drafting both players can be waited on simultaneously, so
    // BOTH cubes should spin — that's the visual cue every player sees telling
    // them the table is waiting on input. Honours the existing
    // `hide_animated_sidebar` preference.
    cubeClass(): string {
      const classes = [
        'left-panel-card-cube',
        'preferences_player_inner',
        `player_bg_color_${this.player.color}`,
      ];
      const awaitingInput =
        this.actionLabel === 'active' ||
        this.actionLabel === 'researching' ||
        this.actionLabel === 'drafting';
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
      if (this.actionLabel === 'active' || this.actionLabel === 'drafting' || this.actionLabel === 'researching') {
        return `${base} ${base}--active`;
      }
      return base;
    },
  },
});
</script>
