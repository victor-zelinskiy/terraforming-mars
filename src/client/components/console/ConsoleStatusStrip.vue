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

    <!-- P27: player chips = IDENTITY + live TURN STATUS. The cards/actions
         counters moved to the right home panel; TR / M€ live in the resource
         panel + Information Mode — the top chips answer ONE question:
         whose move is it and what is everyone doing. -->
    <div class="con-status__players">
      <span v-for="p in players"
            :key="p.color"
            class="con-status__player"
            :class="chipClasses(p)">
        <span :class="'con-status__dot player_bg_color_' + p.color"></span>
        <span class="con-status__pname">{{ p.name }}</span>
        <span class="con-status__pstatus" :class="'con-status__pstatus--' + presentation(p).category">
          <span class="con-status__pstatus-glyph" aria-hidden="true">{{ statusGlyph(p) }}</span>
          <span v-if="presentation(p).textKey !== ''" class="con-status__pstatus-text">{{ $t(presentation(p).textKey) }}</span>
          <b v-if="presentation(p).showCounter" class="con-status__pstatus-counter">{{ actionCounter(p) }}</b>
        </span>
      </span>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * Console status strip (CONSOLE_MODE_CONCEPT.md §6; P27 rework) — the
 * TV-scale top HUD: global parameters + generation on the left, compact
 * premium PLAYER STATUS chips on the right. Read-only.
 *
 * The chips REUSE the desktop's status truth (playerLabels.actionLabelFor
 * Player + playerStatusPresenter) so console and desktop can never disagree
 * about who the server is waiting on: active (ДЕЙСТВИЕ 1/2 with the real
 * `actionsTakenThisRound` counter), research/draft picks, forced reactions,
 * ready, waiting, passed. The viewer's chip fires a one-shot TURN BURST
 * animation the moment their status becomes active — the premium
 * "your turn" transition that replaced the central «ВАШ ХОД» pill.
 */
import {defineComponent, PropType} from 'vue';
import {GameModel} from '@/common/models/GameModel';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {actionLabelForPlayer} from '@/client/components/overview/playerLabels';
import {presentPlayerStatus, StatusPresentation} from '@/client/components/overview/playerStatusPresenter';

/** Mirrors LeftPlayerCard: 1-indexed position of the upcoming action. */
const MAX_ACTIONS_PER_ROUND = 2;

/** Category → the chip's compact text glyph (CSS animates the active dot). */
const GLYPHS: Record<StatusPresentation['category'], string> = {
  active: '●',
  next: '›',
  ready: '✓',
  waiting: '◌',
  passed: '∥',
  none: '',
};

export default defineComponent({
  name: 'ConsoleStatusStrip',
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    /** playerView.runId — reserved for delta feedback ('' disables). */
    epoch: {type: String, default: ''},
  },
  data() {
    return {
      /** One-shot "turn passed to YOU" attention burst on the viewer's chip. */
      turnBurst: false,
      burstTimer: undefined as number | undefined,
    };
  },
  computed: {
    game(): GameModel {
      return this.playerView.game;
    },
    players(): ReadonlyArray<PublicPlayerModel> {
      return this.playerView.players;
    },
    thisPlayerColor(): Color {
      return this.playerView.thisPlayer.color;
    },
    /** The viewer's status category — drives the one-shot burst watcher. */
    myCategory(): StatusPresentation['category'] {
      const me = this.players.find((p) => p.color === this.thisPlayerColor);
      return me !== undefined ? this.presentation(me).category : 'none';
    },
  },
  watch: {
    myCategory(now: StatusPresentation['category'], before: StatusPresentation['category']) {
      if (now === 'active' && before !== 'active') {
        this.turnBurst = true;
        if (this.burstTimer !== undefined) {
          window.clearTimeout(this.burstTimer);
        }
        this.burstTimer = window.setTimeout(() => {
          this.turnBurst = false;
        }, 2600);
      }
    },
  },
  beforeUnmount() {
    if (this.burstTimer !== undefined) {
      window.clearTimeout(this.burstTimer);
    }
  },
  methods: {
    presentation(p: PublicPlayerModel): StatusPresentation {
      return presentPlayerStatus(actionLabelForPlayer(this.playerView, p));
    },
    statusGlyph(p: PublicPlayerModel): string {
      return GLYPHS[this.presentation(p).category];
    },
    /** Mirrors LeftPlayerCard.actionIndex (incl. the solo-run modulo). */
    actionCounter(p: PublicPlayerModel): string {
      const idx = (p.actionsTakenThisRound % MAX_ACTIONS_PER_ROUND) + 1;
      return `${idx}/${MAX_ACTIONS_PER_ROUND}`;
    },
    chipClasses(p: PublicPlayerModel): Record<string, boolean> {
      const category = this.presentation(p).category;
      const me = p.color === this.thisPlayerColor;
      return {
        'con-status__player--me': me,
        'con-status__player--active': category === 'active',
        'con-status__player--passed': category === 'passed',
        'con-status__player--burst': me && this.turnBurst,
      };
    },
  },
});
</script>
