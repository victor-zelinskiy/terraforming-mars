<template>
  <!--
    Initial draft status rail — компактная вертикальная strip-панель
    игроков на стартовом экране. Заменяет основной LeftPlayerPanel
    (тот скрыт через `.left-panel { display: none }` под
    `body.initial-draft-active`).

    Цель: дать игроку минимум нужной информации (имя / цвет /
    порядок хода / статус выбора), не превращаясь в полноценный
    sidebar и не отвлекая от центрального modal'a выбора карт.

    Viewer (текущий клиент) всегда первый в списке — соответствует
    контракту основного LeftPlayerPanel, после старта партии
    location-восприятие у игрока сохраняется. Order chip
    (`#1` / `#2` / …) тем не менее показывает seating-order index
    из `playerView.players`, а не позицию в локальном списке.

    Stylesheet: см. `.initial-draft-rail` в initial_draft.less.
  -->
  <div class="initial-draft-rail">
    <header class="initial-draft-rail__header">
      <span class="initial-draft-rail__header-label" v-i18n>Players</span>
      <span class="initial-draft-rail__header-count">{{ players.length }}</span>
    </header>
    <ul class="initial-draft-rail__list">
      <li v-for="p in orderedPlayers"
          :key="p.color"
          class="initial-draft-rail__item"
          :class="{
            'initial-draft-rail__item--active': isActive(p),
            'initial-draft-rail__item--done': isDone(p),
            'initial-draft-rail__item--viewer': isViewer(p),
          }">
        <span v-if="isActive(p)"
              class="initial-draft-rail__accent"
              aria-hidden="true"></span>

        <div class="initial-draft-rail__row-top">
          <div :class="cubeClass(p)"
               :title="$t('Player cube spins while we wait on them')"></div>
          <div class="initial-draft-rail__name-block">
            <span class="initial-draft-rail__name"
                  :class="playerNameShadowClass(p)">{{ p.name }}</span>
            <span v-if="corpName(p)"
                  class="initial-draft-rail__corp"
                  :title="corpName(p)">{{ corpName(p) }}</span>
          </div>
          <span class="initial-draft-rail__order">#{{ turnIndexFor(p) + 1 }}</span>
        </div>

        <div class="initial-draft-rail__status" :class="statusModifierClass(p)">
          <span v-if="isActive(p)"
                class="initial-draft-rail__status-dot"
                aria-hidden="true"></span>
          <svg v-else-if="isDone(p)"
               class="initial-draft-rail__status-check"
               viewBox="0 0 14 14"
               aria-hidden="true">
            <path d="M2.5 7.5 L5.5 10.5 L11.5 3.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round" />
          </svg>
          <span v-i18n>{{ statusLabel(p) }}</span>
        </div>
      </li>
    </ul>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {playerColorClass} from '@/common/utils/utils';
import {CardType} from '@/common/cards/CardType';
import {getCard} from '@/client/cards/ClientCardManifest';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {actionLabelForPlayer} from '@/client/components/overview/playerLabels';

export default defineComponent({
  name: 'InitialDraftStatusRail',
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    livePlayersWaitingFor: {
      type: Array as PropType<ReadonlyArray<Color>>,
      default: () => [],
    },
  },
  computed: {
    players(): ReadonlyArray<PublicPlayerModel> {
      // seating order — server строит `playerView.players` в порядке
      // generation, что и есть turn-order.
      return this.playerView.players;
    },
    /*
     * Viewer всегда первый в списке. Использует ту же логику, что
     * LeftPlayerPanel.orderedPlayers — после старта партии игрок
     * видит свою карту на той же позиции (сверху), что и в initial
     * draft rail'е.
     */
    orderedPlayers(): ReadonlyArray<PublicPlayerModel> {
      const me = this.playerView.thisPlayer;
      const players = this.playerView.players;
      if (me === undefined) {
        return players;
      }
      const others = players.filter((p) => p.color !== me.color);
      return [me, ...others];
    },
  },
  methods: {
    /*
     * Cube — переиспользуем токены LeftPlayerCard: цвет от
     * `playerColorClass`, `.active` модификатор крутит куб через
     * существующую анимацию `preferences_player_inner.active`.
     */
    cubeClass(player: PublicPlayerModel): string {
      const classes = [
        'initial-draft-rail__cube',
        'preferences_player_inner',
        `player_bg_color_${player.color}`,
      ];
      if (!getPreferences().hide_animated_sidebar && this.isActive(player)) {
        classes.push('active');
      }
      return classes.join(' ');
    },
    playerNameShadowClass(player: PublicPlayerModel): string {
      return playerColorClass(player.color, 'shadow');
    },
    corpName(player: PublicPlayerModel): string {
      const corp = player.tableau.find((card) => getCard(card.name)?.type === CardType.CORPORATION);
      return corp?.name ?? '';
    },
    isViewer(player: PublicPlayerModel): boolean {
      return player.color === this.playerView.thisPlayer?.color;
    },
    isActive(player: PublicPlayerModel): boolean {
      const label = actionLabelForPlayer(this.playerView, player, this.livePlayersWaitingFor);
      return label === 'drafting' || label === 'researching' || label === 'turn' ||
             label === 'globalsupport' || label === 'delegate';
    },
    isDone(player: PublicPlayerModel): boolean {
      if (this.isActive(player)) {
        return false;
      }
      const label = actionLabelForPlayer(this.playerView, player, this.livePlayersWaitingFor);
      return label === 'waiting' || label === 'none' || label === '';
    },
    /*
     * Seating-order index (а не позиция в orderedPlayers) — так order
     * chip остаётся стабильным относительно реального порядка хода и
     * соответствует turn-order badge'у в основном LeftPlayerCard.
     */
    turnIndexFor(player: PublicPlayerModel): number {
      return this.playerView.players.findIndex((p) => p.color === player.color);
    },
    statusLabel(player: PublicPlayerModel): string {
      if (this.isActive(player)) {
        return 'Choosing';
      }
      const label = actionLabelForPlayer(this.playerView, player, this.livePlayersWaitingFor);
      if (label === 'passed') {
        return 'passed';
      }
      return 'Done';
    },
    statusModifierClass(player: PublicPlayerModel): string {
      const base = 'initial-draft-rail__status';
      if (this.isActive(player)) {
        return `${base} ${base}--active`;
      }
      const label = actionLabelForPlayer(this.playerView, player, this.livePlayersWaitingFor);
      if (label === 'passed') {
        return `${base} ${base}--passed`;
      }
      return `${base} ${base}--done`;
    },
  },
});
</script>
