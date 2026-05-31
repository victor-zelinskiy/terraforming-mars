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
            'initial-draft-rail__item--active': presentationFor(p).category === 'active',
            'initial-draft-rail__item--done': presentationFor(p).category === 'ready',
            'initial-draft-rail__item--viewer': isViewer(p),
          }">
        <span v-if="presentationFor(p).category === 'active'"
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

        <!--
          Status — единый presenter (`presentPlayerStatus`) рассчитывает
          и категорию (active / ready / waiting / passed / next / none),
          и какой глиф рендерить, и какой англ. i18n-ключ показать. Тот
          же presenter использует основной LeftPlayerCard — визуально
          rail и in-game карточки выглядят как одна система.
        -->
        <div class="initial-draft-rail__status player-status-chip"
             :class="`player-status-chip--${presentationFor(p).category}`">
          <PlayerStatusGlyph v-if="presentationFor(p).glyph !== 'none'"
                            :glyph="presentationFor(p).glyph" />
          <span v-if="presentationFor(p).textKey" v-i18n>{{ presentationFor(p).textKey }}</span>
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
import {
  presentPlayerStatus,
  StatusPresentation,
} from '@/client/components/overview/playerStatusPresenter';
import PlayerStatusGlyph from '@/client/components/overview/PlayerStatusGlyph.vue';

export default defineComponent({
  name: 'InitialDraftStatusRail',
  components: {
    PlayerStatusGlyph,
  },
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
      if (!getPreferences().hide_animated_sidebar &&
          this.presentationFor(player).category === 'active') {
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
    /*
     * Единственная точка решения «как показать статус игрока» — общий
     * presenter с LeftPlayerCard. Категория используется для CSS-модификаторов,
     * glyph — для иконки, textKey — для i18n.
     */
    presentationFor(player: PublicPlayerModel): StatusPresentation {
      const label = actionLabelForPlayer(this.playerView, player, this.livePlayersWaitingFor);
      return presentPlayerStatus(label);
    },
    /*
     * Seating-order index (а не позиция в orderedPlayers) — так order
     * chip остаётся стабильным относительно реального порядка хода и
     * соответствует turn-order badge'у в основном LeftPlayerCard.
     */
    turnIndexFor(player: PublicPlayerModel): number {
      return this.playerView.players.findIndex((p) => p.color === player.color);
    },
  },
});
</script>
