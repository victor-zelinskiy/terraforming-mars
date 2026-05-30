<template>
  <div :class="cardClass" @click="$emit('select', player.color)">
    <div class="left-panel-card-row left-panel-card-row--top">
      <div :class="cubeClass"></div>
      <div class="left-panel-card-name" :class="playerNameShadowClass">{{ player.name }}</div>
    </div>
    <!--
      Turn-order бэйдж сидит в собственной строке под cube/name —
      раньше клался справа от имени в top-row и обрезал длинные
      ники до «N…», «V…». Своя строка даёт badge нормальную ширину
      и оставляет имя читаемым. CSS прячет его в обычной игре
      (`body:not(.initial-draft-active) ... { display: none }`), так
      что в legacy-режиме plate'a его нет вообще.
    -->
    <div class="left-panel-card-turn-badge"
         v-i18n="[turnOrderLabel]">Turn ${0}</div>
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
    <!--
      Turn-control column: PASS on top, END TURN below. Rendered ONLY on
      the viewer's own card — other players' cards never expose actions
      from this client. Buttons stack vertically because END TURN's full
      Russian label ("ЗАВЕРШИТЬ ХОД") doesn't fit comfortably in a
      half-width slot at this card width.
      The column's height is reserved for BOTH buttons regardless of
      whether either is currently offered by the server — unavailable
      buttons collapse to `visibility: hidden`, which keeps their layout
      space so the card height stays constant. This matters because
      END TURN can be conditionally absent (mid-generation logic, or
      potentially disabled by a future game option); hiding it via
      display: none would shift everything below it up/down between
      turns. Buttons stay hidden rather than disabled — visually noisy
      grey buttons add no information when the action just isn't on
      offer right now.
    -->
    <div v-if="isViewer" class="left-panel-card-actions" @click.stop>
      <button class="left-panel-card-action-btn left-panel-card-action-btn--pass"
              :class="{'left-panel-card-action-btn--hidden': !passAvailable}"
              :title="$t('Pass — end your participation in this generation. You will not be able to take any more actions until the next generation.')"
              @click="$emit('pass')"
              data-test="player-card-pass">
        <span class="left-panel-card-action-btn-label" v-i18n>Pass</span>
      </button>
      <button class="left-panel-card-action-btn left-panel-card-action-btn--end-turn"
              :class="{'left-panel-card-action-btn--hidden': !endTurnAvailable}"
              :title="$t('End turn — skip your second action and pass the turn to the next player. You can still act in this generation on your next turn.')"
              @click="$emit('end-turn')"
              data-test="player-card-end-turn">
        <!--
          Distinct English key ("Skip turn") rather than reusing "End Turn"
          here on purpose — the upstream "End Turn" key feeds into action-log
          templates ("${player} ended turn" → "завершил ход"), and changing
          its Russian translation would silently rewrite the log too. The
          button-label key lives on its own so we can pick the wording that
          reads best on this control without affecting other contexts.
        -->
        <span class="left-panel-card-action-btn-label" v-i18n>Skip turn</span>
      </button>
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
    // True iff this card belongs to the viewer (the player using this
    // client). Controls whether the turn-control button row (Pass / End
    // Turn) is rendered at all — other players' cards never expose
    // actions for this client to submit.
    isViewer: {
      type: Boolean,
      default: false,
    },
    // Server-confirmed availability of each top-level action option. The
    // parent walks `waitingFor` for the matching SelectOption; presence
    // === available. Buttons render but are disabled when their flag is
    // false, so the card layout stays constant whether a button is
    // offered or not.
    passAvailable: {
      type: Boolean,
      default: false,
    },
    endTurnAvailable: {
      type: Boolean,
      default: false,
    },
    // Порядок хода в текущем поколении (0-indexed). Используется только
    // на стартовом экране (initial draft) для отображения compact badge'a
    // «1-й ход» / «2-й ход» рядом с именем игрока — CSS прячет badge
    // в обычной партии через `body.initial-draft-active` гейт.
    turnIndex: {
      type: Number,
      default: 0,
    },
  },
  emits: ['select', 'pass', 'end-turn'],
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
    // 1-based label для бэйджа «N-й ход». i18n берёт параметризованный
    // ключ «Turn ${0}» (см. ru/ui.json), CSS уже добавит cyan-glass
    // chrome — здесь только данные.
    turnOrderLabel(): string {
      return String(this.turnIndex + 1);
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
