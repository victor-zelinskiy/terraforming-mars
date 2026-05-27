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
    <!--
      Status bar is ALWAYS rendered, even when there's no active label
      (`actionLabel` is 'none' / ''). The empty state has visibility:hidden
      via the `--empty` modifier so the card's vertical layout stays
      constant — resource icons and tags below don't jump up/down as
      players transition between turn / pass / waiting states.

      For the action-turn case, show which of the two actions the player
      is currently on ("ДЕЙСТВИЕ 1/2" / "ДЕЙСТВИЕ 2/2"). The default upstream
      label "ХОД" is ambiguous because a "turn" in TM is two consecutive
      actions; players couldn't tell whether they were about to do their
      first or second. `actionsTakenThisRound` is server-side state, so
      the index updates the moment the previous action resolves.
    -->
    <div :class="statusClass">
      <span v-if="actionLabel === 'turn'" v-i18n="[actionIndex, MAX_ACTIONS_PER_ROUND]">Action ${0}/${1}</span>
      <span v-else-if="hasStatus" v-i18n>{{ actionLabel }}</span>
      <span v-else>&nbsp;</span>
    </div>
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

// Vanilla TM gives each player exactly 2 actions per turn. The server side
// has an `availableActionsThisRound` field on Player.ts that anticipates
// variability (Mars Maths etc.) but it's hard-coded to 2 today. Mirror
// here; promote to a server-exposed field on PublicPlayerModel if a card
// ever starts varying it.
const MAX_ACTIONS_PER_ROUND = 2;

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
    hasStatus(): boolean {
      return this.actionLabel !== 'none' && this.actionLabel !== '';
    },
    statusClass(): string {
      const base = 'left-panel-card-status';
      if (!this.hasStatus) {
        // Empty state — bar is rendered (preserves card layout height)
        // but visually hidden via the --empty modifier. Resources / tags
        // below stay anchored regardless of turn state.
        return `${base} ${base}--empty`;
      }
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
    MAX_ACTIONS_PER_ROUND(): number {
      return MAX_ACTIONS_PER_ROUND;
    },
    // 1-indexed position of the action the player is currently about to
    // take. In normal play `actionsTakenThisRound` is 0 → display 1/2,
    // 1 → display 2/2, and the server resets it to 0 after every turn.
    //
    // BUT when all OTHER players have passed, the server intentionally
    // STOPS resetting the counter (see `Player.takeAction()`'s reset
    // condition `allOtherPlayersHavePassed() === false`). The remaining
    // player just keeps acting and the counter grows past 2 — 3, 4, 5, ...
    // Modding by MAX_ACTIONS_PER_ROUND restores the visual "1/2 ↔ 2/2"
    // alternation in that solo-play scenario without any server changes.
    actionIndex(): number {
      const taken = this.player.actionsTakenThisRound;
      return (taken % MAX_ACTIONS_PER_ROUND) + 1;
    },
  },
});
</script>
