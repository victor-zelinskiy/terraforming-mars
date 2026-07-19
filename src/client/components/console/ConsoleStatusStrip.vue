<template>
  <div class="con-status">
    <!-- P27: player chips = IDENTITY + live TURN STATUS. P27b: they sit on
         the LEFT (desktop parity — the player panels live on the left);
         the global parameters moved to the right flank. The cards/actions
         counters live in the right home panel; TR / M€ in the resource
         panel + Information Mode — the top chips answer ONE question:
         whose move is it and what is everyone doing. -->
    <div class="con-status__players">
      <span v-for="p in players"
            :key="p.color"
            class="con-status__player"
            :class="chipClasses(p)">
        <span :class="'con-status__dot player_bg_color_' + p.color"></span>
        <span class="con-status__pname">{{ displayName(p) }}</span>
        <span class="con-status__pstatus" :class="'con-status__pstatus--' + presentation(p).category">
          <span class="con-status__pstatus-glyph" aria-hidden="true">{{ statusGlyph(p) }}</span>
          <span v-if="presentation(p).textKey !== ''" class="con-status__pstatus-text">{{ $t(presentation(p).textKey) }}</span>
          <b v-if="presentation(p).showCounter" class="con-status__pstatus-counter">{{ actionCounter(p) }}</b>
        </span>
      </span>
    </div>

    <div class="con-status__params">
      <!-- The GAME-END trio (Temperature · Oxygen · Oceans) reads as ONE
           instrument group: a compact total percent + a thin premium rail
           underline. Venus (below) sits OUTSIDE this group on purpose — it
           is a separate expansion parameter and never part of the total. -->
      <div class="con-status__terra"
           :class="{
             'con-status__terra--complete': progress.complete,
             'con-status__terra--celebrating': celebrating,
           }"
           role="group"
           :aria-label="terraAriaLabel">
        <!-- Every readout announces its change TWICE over: the premium
             flip-swap of the value itself (nested INSIDE the value cell —
             see ConsoleFlipValue's layering note) plus the delta chip. -->
        <span class="con-status__param">
          <i class="wgt-icon wgt-icon--temperature con-status__icon" aria-hidden="true"></i>
          <span class="con-status__value">
            <ConsoleFlipValue :value="game.temperature" :text="`${game.temperature}°C`" />
          </span>
          <AnimatedMetricValue
            :value="game.temperature"
            metricKey="globals.temperature"
            scopeKey="global"
            :epoch="epoch"
            variant="global-parameter" />
        </span>
        <span class="con-status__param">
          <i class="wgt-icon wgt-icon--oxygen con-status__icon" aria-hidden="true"></i>
          <span class="con-status__value">
            <ConsoleFlipValue :value="game.oxygenLevel" :text="`${game.oxygenLevel}%`" />
          </span>
          <AnimatedMetricValue
            :value="game.oxygenLevel"
            metricKey="globals.oxygen"
            scopeKey="global"
            :epoch="epoch"
            variant="global-parameter" />
        </span>
        <span class="con-status__param">
          <i class="wgt-icon wgt-icon--ocean con-status__icon" aria-hidden="true"></i>
          <span class="con-status__value">
            <ConsoleFlipValue :value="game.oceans" :text="`${game.oceans}/9`" />
          </span>
          <AnimatedMetricValue
            :value="game.oceans"
            metricKey="globals.oceans"
            scopeKey="global"
            :epoch="epoch"
            variant="global-parameter" />
        </span>
        <!-- The percent is the trio's own mint readout — its beat follows
             the rail's colour (gold once terraforming is complete). -->
        <span class="con-status__terra-pct"><ConsoleFlipValue
            :value="progress.percent"
            :text="`${progress.percent}%`"
            :accent="progress.complete ? 'gold' : 'mint'" /><AnimatedMetricValue
            :value="progress.percent"
            metricKey="globals.terraforming-percent"
            scopeKey="global"
            :epoch="epoch"
            variant="global-parameter" /></span>
        <span class="con-status__terra-rail" aria-hidden="true">
          <span class="con-status__terra-fill" :style="{width: progress.percent + '%'}"></span>
        </span>
      </div>
      <span v-if="game.gameOptions.expansions.venus" class="con-status__param con-status__param--venus">
        <i class="wgt-icon wgt-icon--venus con-status__icon" aria-hidden="true"></i>
        <span class="con-status__value">
          <ConsoleFlipValue :value="game.venusScaleLevel" :text="`${game.venusScaleLevel}%`" />
        </span>
        <AnimatedMetricValue
          :value="game.venusScaleLevel"
          metricKey="globals.venus"
          scopeKey="global"
          :epoch="epoch"
          variant="global-parameter" />
      </span>
      <!-- The physical project draw pile — sits BETWEEN the global
           parameters and the generation block. Informational only: the
           count is the server's authoritative drawPile size. -->
      <ConsoleProjectDeck :deckSize="game.deckSize" :epoch="epoch" />
      <!-- The generation carries NO delta chip: the flip-swap alone is its
           announcement (and the console suppresses the desktop's "new
           generation" toast — the HUD tick IS the event). Its beat goes
           gold on the final generation, matching the persistent marker. -->
      <span class="con-status__gen" :class="{'con-status__gen--final': finalGeneration}">
        <span class="con-status__gen-label">{{ $t(finalGeneration ? 'FINAL GEN.' : 'GEN.') }}</span>
        <span class="con-status__value">
          <ConsoleFlipValue :value="game.generation" :accent="finalGeneration ? 'gold' : 'cyan'" />
        </span>
      </span>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * Console status strip (docs/CONSOLE_MODE_CONCEPT.md §6; P27 rework) — the
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
import {actionLabelForPlayer, liveWaitingSignal} from '@/client/components/overview/playerLabels';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {presentPlayerStatus, StatusPresentation, StatusGlyph} from '@/client/components/overview/playerStatusPresenter';
import {terraformingProgress, TerraformingProgress} from '@/client/components/gameProgress/terraformingProgress';
import {finalGenerationActive, terraformingCelebrationState} from '@/client/components/gameProgress/terraformingCelebration';
import {motionMs} from '@/client/components/motion/motionTokens';
import {translateText} from '@/client/directives/i18n';
import AnimatedMetricValue from '@/client/components/feedback/AnimatedMetricValue.vue';
import ConsoleFlipValue from '@/client/components/console/ConsoleFlipValue.vue';
import ConsoleProjectDeck from '@/client/components/console/ConsoleProjectDeck.vue';

/** Mirrors LeftPlayerCard: 1-indexed position of the upcoming action. */
const MAX_ACTIONS_PER_ROUND = 2;

/** Glyph → the chip's compact text mark (mirrors the desktop PlayerStatusGlyph;
 *  CSS animates the active dot via the --active class). MarsBot's active turn
 *  uses the SAME 'dot' as a human, so the bot reads as just another player. */
const GLYPH_CHARS: Record<StatusGlyph, string> = {
  dot: '●',
  check: '✓',
  clock: '◌',
  pause: '∥',
  none: '',
};

export default defineComponent({
  name: 'ConsoleStatusStrip',
  components: {AnimatedMetricValue, ConsoleFlipValue, ConsoleProjectDeck},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    /**
     * The LIVE `/api/waitingFor` poll. Without it the chips read the frozen
     * `isWaitingForInput` snapshot, which goes STALE for the whole of a
     * simultaneous-pick phase: while the viewer holds their own prompt the
     * playerView is deliberately not refreshed (it would drop their partial
     * input), so an opponent who has since submitted still reads as picking.
     * The start scene's summary rail reads the same brain WITH the poll, so
     * omitting it here made the two surfaces visibly disagree.
     */
    waitingOnPlayers: {type: Array as PropType<ReadonlyArray<Color>>, default: () => []},
    /** playerView.runId — drives the delta-chip feedback ('' disables). */
    epoch: {type: String, default: ''},
  },
  data() {
    return {
      /** One-shot "turn passed to YOU" attention burst on the viewer's chip. */
      turnBurst: false,
      burstTimer: undefined as number | undefined,
      /** One-shot terraforming-complete pulse on the Temp/O₂/Oceans group. */
      celebrating: false,
      celebrateTimer: undefined as number | undefined,
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
    /** The SHARED terraforming-progress math (same helper the desktop
     *  sidebar gauge uses) — Temperature + Oxygen + Oceans ONLY. */
    progress(): TerraformingProgress {
      return terraformingProgress(this.game);
    },
    /** This generation is authoritatively the game's last one. */
    finalGeneration(): boolean {
      return finalGenerationActive(this.playerView);
    },
    celebrationNonce(): number {
      return terraformingCelebrationState.celebrationNonce;
    },
    terraAriaLabel(): string {
      return `${translateText('Terraforming progress')}: ${this.progress.percent}%`;
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
    // One-shot pulse on the Temp/O₂/Oceans group when terraforming completes
    // LIVE (the shared nonce never re-fires on reload — the calm --complete
    // state carries the persistent look).
    celebrationNonce() {
      this.celebrating = true;
      if (this.celebrateTimer !== undefined) {
        window.clearTimeout(this.celebrateTimer);
      }
      this.celebrateTimer = window.setTimeout(() => {
        this.celebrating = false;
      }, motionMs(3400));
    },
  },
  beforeUnmount() {
    if (this.burstTimer !== undefined) {
      window.clearTimeout(this.burstTimer);
    }
    if (this.celebrateTimer !== undefined) {
      window.clearTimeout(this.celebrateTimer);
    }
  },
  methods: {
    displayName(p: PublicPlayerModel): string {
      return participantDisplayName(p);
    },
    presentation(p: PublicPlayerModel): StatusPresentation {
      return presentPlayerStatus(
        actionLabelForPlayer(this.playerView, p, liveWaitingSignal(this.waitingOnPlayers)),
        p.isMarsBot === true);
    },
    statusGlyph(p: PublicPlayerModel): string {
      return GLYPH_CHARS[this.presentation(p).glyph];
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
