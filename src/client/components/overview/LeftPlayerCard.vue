<template>
  <div :class="cardClass" :data-player-color="player.color" @click="$emit('select', player.color)">
    <!--
      TurnHandoff command brackets — the transient "system locked onto the
      active player" frame. Rendered ONLY during the start-of-turn burst
      (`isBursting`), in the player's OWN colour (var(--lpc-accent)), so it
      reads as an internal command-layer activation distinct from the cyan
      VIEWING selection border. A one-shot line sweeps the top/left edge. After
      the burst the card settles back to the calm normal active state — the
      brackets are NOT persistent (no permanent "ВАШ ХОД"). Decorative only.
    -->
    <div v-if="isBursting" class="left-panel-card-command" aria-hidden="true">
      <span class="lpc-bracket lpc-bracket--tl"></span>
      <span class="lpc-bracket lpc-bracket--tr"></span>
      <span class="lpc-bracket lpc-bracket--bl"></span>
      <span class="lpc-bracket lpc-bracket--br"></span>
      <span class="lpc-sweep"></span>
    </div>
    <div class="left-panel-card-row left-panel-card-row--top">
      <div :class="cubeClass"></div>
      <div class="left-panel-card-name" :class="playerNameShadowClass">{{ displayName }}</div>
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
    <!-- The MarsBot seat has no corporation — its identity chip takes the
         corp row's slot so the card reads as a full participant. -->
    <div v-else-if="player.isMarsBot" class="left-panel-card-corp left-panel-card-corp--bot">
      <span class="left-panel-card-bot-glyph" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="7.5" width="14" height="10" rx="2.4" stroke="currentColor" stroke-width="1.6"/><path d="M12 7.5 V4.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9.2" cy="12" r="1.5" fill="currentColor"/><circle cx="14.8" cy="12" r="1.5" fill="currentColor"/><path d="M9 15.4 H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </span>
      <span v-i18n>Automa opponent</span>
    </div>
    <div class="left-panel-card-row left-panel-card-row--stats">
      <div class="left-panel-card-stat left-panel-card-stat--vp" :title="privateMask ? '' : $t('Victory points')">
        <span class="left-panel-card-stat-label" v-i18n>VP</span>
        <span class="left-panel-card-stat-value">
          <PrivateScoreMask v-if="privateMask" compact />
          <template v-else>
            <span class="left-panel-card-stat-value__num">{{ hideVp ? '?' : vp }}</span>
            <AnimatedMetricValue
              v-if="!hideVp"
              :value="vp"
              metricKey="score.vp"
              :scopeKey="player.color"
              :epoch="epoch"
              variant="score" />
          </template>
        </span>
      </div>
      <div class="left-panel-card-stat left-panel-card-stat--tr" :title="$t('Terraforming Rating')">
        <span class="left-panel-card-stat-label" v-i18n>TR</span>
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
      <!--
        During the local player's start-of-turn burst the chip swaps to the
        transient "▶ ВАШ ХОД" command label (the same data, command framing).
        It is NOT a permanent status: once the burst ends (≈1.5s) the chip
        returns to the calm "● ДЕЙСТВИЕ X/Y" via the normal presenter — there
        is no turn clock, so a sticky "ВАШ ХОД" would read as a false alarm.
      -->
      <template v-if="statusBurst">
        <span class="player-status-chip__burst-glyph" aria-hidden="true">▶</span>
        <span v-i18n>Your turn</span>
        <span v-if="presentation.showCounter"
              class="player-status-chip__counter">{{ actionCounterText }}</span>
      </template>
      <template v-else>
        <PlayerStatusGlyph v-if="presentation.glyph !== 'none'"
                          :glyph="presentation.glyph" />
        <span v-if="presentation.textKey" v-i18n>{{ presentation.textKey }}</span>
        <span v-else>&nbsp;</span>
        <span v-if="presentation.showCounter"
              class="player-status-chip__counter">{{ actionCounterText }}</span>
      </template>
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
import {startSetupOverrideFor} from '@/client/components/startGameFlow/startSetupRevealState';
import PrivateScoreMask from '@/client/components/overview/PrivateScoreMask.vue';
import {shouldMaskOwnPassiveVp} from '@/client/components/overview/privateScoreState';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {turnHandoffState} from '@/client/components/overview/turnHandoffState';

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
    // True iff this player is the ACTION-phase turn owner (the active player).
    // Drives the PERSISTENT player-colour command accent (the internal "this
    // card owns the turn" channel), distinct from the cyan VIEWING/--selected
    // border. Derived from the model in LeftPlayerPanel (phase + isActive), so
    // it never depends on the TurnHandoff animation controller.
    turnOwner: {
      type: Boolean,
      default: false,
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
    PrivateScoreMask,
  },
  computed: {
    // The visible participant label: humans keep their name, the Automa seat
    // localizes («ИИ» in the Russian UI) through the shared resolver.
    displayName(): string {
      return participantDisplayName(this.player);
    },
    // Local "private score": mask THIS player's VP only when it's the viewer's
    // own card (never an opponent's; the VP overlay stays unmasked).
    privateMask(): boolean {
      return shouldMaskOwnPassiveVp(this.isViewer);
    },
    // TurnHandoff transient state, read from the module-level controller. These
    // drive the short start-of-turn "command activation" — they self-clear via
    // the controller's timers, so the card returns to its calm normal state.
    isBursting(): boolean {
      return turnHandoffState.burstColor === this.player.color;
    },
    // The strong "▶ ВАШ ХОД" status swap is for the LOCAL player's own
    // hand-off only; an opponent's hand-off gets the cube/bracket ignition but
    // keeps their normal status label (a calmer active indication).
    statusBurst(): boolean {
      return this.isBursting && turnHandoffState.burstIsLocal;
    },
    // One-shot inactivity micro-pulse (escalation step 1) — fires only on the
    // local player's card and only when they gave no input after the hand-off.
    isIdlePulsing(): boolean {
      return turnHandoffState.idlePulseColor === this.player.color;
    },
    /*
     * Source of truth для всех «как именно показывать статус» решений
     * — единый presenter из `playerStatusPresenter.ts`. И этот компонент,
     * и rail на стартовом экране кормят сюда один и тот же `actionLabel`
     * и получают совпадающую визуальную категорию + текст.
     */
    presentation(): StatusPresentation {
      return presentPlayerStatus(this.actionLabel, this.player.isMarsBot === true);
    },
    cardClass(): string {
      // Per-colour class exposes the player's colour as `--lpc-accent` (see the
      // each(@players) loop in turn_handoff.less) so the turn command channel
      // (accent bar, brackets, cube ignition) is tinted to the player, NOT the
      // generic cyan used by the VIEWING/--active channels.
      const classes = ['left-panel-card', `left-panel-card--color-${this.player.color}`];
      if (this.selected) {
        classes.push('left-panel-card--selected');
      }
      // TURN channel (player colour) — kept on a SEPARATE visual channel from
      // the cyan VIEWING (--selected) channel so "who is acting" and "whose
      // seat am I viewing" never collide.
      if (this.turnOwner) {
        classes.push('left-panel-card--turn-owner');
        if (this.isViewer) {
          classes.push('left-panel-card--local-turn');
        }
      }
      if (this.isBursting) {
        classes.push('left-panel-card--turn-burst');
      }
      if (this.isIdlePulsing) {
        classes.push('left-panel-card--idle-pulse');
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
      // Cube ignition — the primary carrier of the start-of-turn event: a brief
      // spin-up + player-colour glow burst. Honours the same animated-sidebar
      // preference as the steady spin.
      if (this.isBursting && !getPreferences().hide_animated_sidebar) {
        classes.push('left-panel-card-cube--ignition');
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
      // During the start-of-game setup reveal, show the staged TR (a corp that
      // grants starting TR animates its delta chip like the resources do).
      const override = startSetupOverrideFor(this.player.color);
      return override !== undefined ? override.terraformRating : this.player.terraformRating;
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
      // Burst command framing (player colour) layered over the active chip.
      if (this.statusBurst) {
        return `${base} ${modifier} ${base}--turn-burst`;
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
