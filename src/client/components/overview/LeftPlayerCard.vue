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
        <span class="left-panel-card-stat-value">
          <span class="left-panel-card-stat-value__num">{{ hideVp ? '?' : vp }}</span>
          <AnimatedMetricValue
            v-if="!hideVp"
            :value="vp"
            metricKey="score.vp"
            :scopeKey="player.color"
            :epoch="epoch"
            variant="score" />
        </span>
      </div>
      <div class="left-panel-card-stat left-panel-card-stat--tr" :title="$t('Terraforming Rating')">
        <span class="left-panel-card-stat-label">РТ</span>
        <span class="left-panel-card-stat-value">
          <span class="left-panel-card-stat-value__num">{{ tr }}</span>
          <AnimatedMetricValue
            :value="tr"
            metricKey="score.tr"
            :scopeKey="player.color"
            :epoch="epoch"
            variant="score" />
        </span>
      </div>
      <!--
        Turn-order badge — порядок хода в текущем (или следующем после
        смены поколения) поколении. Данные берутся из turnIndex (0-based),
        который LeftPlayerPanel вычисляет как позицию в
        playerView.players — а тот массив уже в playersInGenerationOrder
        (сервер обновляет его в startGeneration() перед тем как слать
        новый playerView). Значит как только поколение завершается и
        приходит новый ответ — бэйдж уже показывает СЛЕДУЮЩИЙ порядок.
      -->
      <span class="left-panel-card-order" :title="$t('Turn order this generation')">#{{ turnIndex + 1 }}</span>
    </div>
    <!--
      Status chip — единая HUD-«капсула» статуса игрока. Внешний вид
      управляется presenter'ом (`presentPlayerStatus`) из
      `playerStatusPresenter.ts`, который ОДИНАКОВО мапит ActionLabel
      и в этом компоненте, и в `InitialDraftStatusRail`. Поэтому
      внешний вид статусов синхронен между стартовым экраном и
      основной партией — никакого if-ов по конкретным лейблам тут нет.

      Структура: [glyph] [текст] [опц. counter chip]. Glyph выбирается
      presenter'ом (dot для active / check для ready / pause для passed
      / clock для waiting / chevron для next). Counter рендерится только
      когда `presentation.showCounter === true` — сегодня это только
      'turn' (1/2 / 2/2).

      Категория presenter'а попадает в имя класса
      `.player-status-chip--<category>` — LESS-палитра / фон / glow
      переключаются полностью по категории, без знания конкретного
      action-лейбла.

      Empty-состояние (`category: 'none'`) держит chip в DOM, но скрывает
      его через `--empty` (visibility: hidden) — высота карточки остаётся
      постоянной между переходами turn / waiting / passed / END.
    -->
    <div :class="chipClass">
      <PlayerStatusGlyph v-if="presentation.glyph !== 'none'"
                        :glyph="presentation.glyph" />
      <span v-if="presentation.textKey" v-i18n>{{ presentation.textKey }}</span>
      <span v-else>&nbsp;</span>
      <span v-if="presentation.showCounter"
            class="player-status-chip__counter">{{ actionCounterText }}</span>
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
    <!--
      `@click.stop` is on the BUTTONS individually, NOT on the
      wrapper. The wrapper reserves layout space for two buttons but
      one or both may be `visibility: hidden` + `pointer-events:
      none` when the server isn't offering that action. Putting
      `.stop` on the wrapper killed click propagation in those
      hidden-button slots too, which made tapping the viewer's own
      card to switch back to self impossible in the lower half of
      the card (player feedback — "dead zones"). With .stop on the
      buttons themselves, clicks on a visible button stop at the
      button (so Pass / Skip-turn don't also trigger card select),
      while clicks landing on a hidden button slot bubble normally
      up to the card root and trigger the `select` emit.
    -->
    <div v-if="isViewer" class="left-panel-card-actions">
      <button class="left-panel-card-action-btn left-panel-card-action-btn--pass"
              :class="{'left-panel-card-action-btn--hidden': !passAvailable}"
              :title="$t('Pass — end your participation in this generation. You will not be able to take any more actions until the next generation.')"
              @click.stop="$emit('pass')"
              data-test="player-card-pass">
        <span class="left-panel-card-action-btn-label" v-i18n>Pass</span>
      </button>
      <button class="left-panel-card-action-btn left-panel-card-action-btn--end-turn"
              :class="{'left-panel-card-action-btn--hidden': !endTurnAvailable}"
              :title="$t('End turn — skip your second action and pass the turn to the next player. You can still act in this generation on your next turn.')"
              @click.stop="$emit('end-turn')"
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
import {
  presentPlayerStatus,
  StatusPresentation,
} from './playerStatusPresenter';
import PlayerStatusGlyph from './PlayerStatusGlyph.vue';
import AnimatedMetricValue from '@/client/components/feedback/AnimatedMetricValue.vue';

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
    /*
     * Game-session identifier (`playerView.runId`) forwarded into the
     * VP/TR AnimatedMetricValue instances. Combined with `player.color`
     * to scope change-feedback state so that switching games doesn't
     * fire a phantom delta against the previous game's VP/TR.
     */
    epoch: {
      type: String,
      default: '',
    },
  },
  emits: ['select', 'pass', 'end-turn'],
  components: {
    PlayerStatusGlyph,
    AnimatedMetricValue,
  },
  computed: {
    /*
     * Source of truth для всех «как именно показывать статус» решений
     * — единый presenter из `playerStatusPresenter.ts`. И этот компонент,
     * и rail на стартовом экране кормят сюда один и тот же `actionLabel`
     * и получают совпадающую визуальную категорию + текст.
     */
    presentation(): StatusPresentation {
      return presentPlayerStatus(this.actionLabel);
    },
    cardClass(): string {
      const classes = ['left-panel-card'];
      if (this.selected) {
        classes.push('left-panel-card--selected');
      }
      /*
       * --active = the SERVER is waiting on this player to act right
       * now (whether they're on their turn, drafting, picking research
       * cards, voting on Turmoil, etc.). Triggers the rail-style
       * left-edge accent bar + cyan glow on the card — the modern
       * standardised "this is the player to watch right now" signal,
       * matching the rail's `--active` modifier exactly.
       *
       * Distinct from --selected (which means "the viewer clicked
       * this card to inspect this player's tableau"). Both can be
       * true at once and stack cleanly.
       */
      if (this.presentation.category === 'active') {
        classes.push('left-panel-card--active');
      }
      if (this.presentation.category === 'passed') {
        classes.push('left-panel-card--passed');
      }
      return classes.join(' ');
    },
    // Cube carries the player colour plus the legacy `.preferences_player_inner.active`
    // rotation animation while we're waiting on that player to do something.
    // Spin gates на presenter.category === 'active' — единый сигнал «сервер
    // ждёт ввода», работает для любого активного лейбла (turn / researching /
    // drafting / preludes / ceos / globalsupport / delegate). Honors the
    // existing `hide_animated_sidebar` preference.
    cubeClass(): string {
      const classes = [
        'left-panel-card-cube',
        'preferences_player_inner',
        `player_bg_color_${this.player.color}`,
      ];
      if (!getPreferences().hide_animated_sidebar &&
          this.presentation.category === 'active') {
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
    // 1-based label для бэйджа «N-й ход». i18n берёт параметризованный
    // ключ «Turn ${0}» (см. ru/ui.json), CSS уже добавит cyan-glass
    // chrome — здесь только данные.
    turnOrderLabel(): string {
      return String(this.turnIndex + 1);
    },
    chipClass(): string {
      const base = 'player-status-chip';
      const modifier = `${base}--${this.presentation.category}`;
      // none-категория = chip остаётся в DOM ради постоянной высоты
      // карточки, но визуально скрыт через --empty (visibility: hidden).
      if (this.presentation.category === 'none') {
        return `${base} ${modifier} ${base}--empty`;
      }
      return `${base} ${modifier}`;
    },
    /*
     * Plain "N/M" string for the action counter chip — no i18n needed
     * (digits and slash translate identically across locales). Render
     * gated на `presentation.showCounter`, чтобы счётчик висел только
     * рядом с лейблом «ДЕЙСТВИЕ».
     */
    actionCounterText(): string {
      return `${this.actionIndex}/${MAX_ACTIONS_PER_ROUND}`;
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
