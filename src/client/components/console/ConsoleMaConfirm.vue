<template>
  <div class="con-task-host con-maconfirm" role="dialog" :aria-label="$t(title)">
    <div class="con-task-host__backdrop" aria-hidden="true"></div>
    <div class="con-task con-maconfirm__frame" :class="'con-maconfirm__frame--' + view.kind">
      <!-- ── Header: category identity + the decision verb ─────────────── -->
      <header class="con-task__head">
        <div class="con-task__kicker">
          <span class="con-task__kicker-mark" aria-hidden="true">{{ view.kind === 'milestone' ? '✦' : '❖' }}</span>
          <span>{{ $t(view.kind === 'milestone' ? 'Achievement' : 'Award') }} · {{ $t('Confirmation') }}</span>
        </div>
        <div class="con-task__title">{{ $t(title) }}</div>
      </header>

      <div class="con-task__body con-maconfirm__body">
        <div class="con-maconfirm__main">
          <!-- Hero stage: the 512×512 premium icon on a pedestal. -->
          <div class="con-maconfirm__side">
            <div class="con-maconfirm__stage" aria-hidden="true">
              <MaHeroArt :name="view.name" :kind="view.kind" class="con-maconfirm__hero" />
            </div>
            <div class="con-maconfirm__name" v-i18n>{{ view.displayName }}</div>
          </div>

          <div class="con-maconfirm__info">
            <div class="con-maconfirm__desc" v-i18n>{{ view.description }}</div>

            <!-- ── MILESTONE: progress → the immediate-5-VP truth ───────── -->
            <template v-if="view.kind === 'milestone'">
              <div class="con-start__section-title">{{ $t('Your progress') }}</div>
              <div class="con-maconfirm__progress">
                <span class="con-maconfirm__progress-value">
                  <b>{{ view.myScore }}</b><span v-if="view.threshold !== undefined" class="con-maconfirm__progress-req">/{{ view.threshold }}</span>
                </span>
                <span v-if="view.threshold !== undefined" class="con-maconfirm__meter" aria-hidden="true"><i :style="{width: meterWidth}"></i></span>
                <span class="con-maconfirm__progress-note" :class="{'con-maconfirm__progress-note--ok': view.thresholdMet}">
                  {{ $t(view.thresholdMet ? 'Threshold reached — claim now' : 'Threshold not reached yet') }}
                </span>
              </div>
              <div class="con-maconfirm__vp">
                <span class="con-maconfirm__vp-badge">+5 {{ $t('VP') }}</span>
                <span class="con-maconfirm__vp-note">{{ $t('Milestones grant 5 victory points immediately when claimed.') }}</span>
              </div>
            </template>

            <!-- ── AWARD: the endgame-scoring truth → the live race ─────── -->
            <template v-else>
              <div class="con-maconfirm__endgame">
                <span class="con-maconfirm__endgame-mark" aria-hidden="true">⏳</span>
                <span>
                  <b>{{ $t('The award grants no victory points now.') }}</b>
                  {{ $t(playersCount > 2 ? 'At game end: 5 VP for 1st place, 2 VP for 2nd.' : 'At game end: 5 VP for 1st place.') }}
                </span>
              </div>
              <div class="con-start__section-title">{{ $t('Current race') }}</div>
              <div class="con-maconfirm__race">
                <div v-for="r in view.race" :key="r.color"
                     class="con-maconfirm__racer"
                     :class="{'con-maconfirm__racer--viewer': r.viewer, 'con-maconfirm__racer--leader': r.leader}">
                  <span class="con-maconfirm__racer-dot" :class="'player_bg_color_' + r.color" aria-hidden="true"></span>
                  <span class="con-maconfirm__racer-name">{{ r.viewer ? $t('You') : r.name }}</span>
                  <span v-if="r.leader" class="con-maconfirm__racer-crown" aria-hidden="true">◆</span>
                  <span class="con-maconfirm__racer-score">{{ r.score }}</span>
                </div>
                <div class="con-maconfirm__race-tone" :class="'con-maconfirm__race-tone--' + view.raceTone">
                  <template v-if="view.raceTone === 'lead'">{{ $t('You lead') }}</template>
                  <template v-else-if="view.raceTone === 'tie'">{{ $t('Tied for the lead') }}</template>
                  <template v-else-if="view.raceTone === 'behind'">{{ $t('Leader') }}: {{ view.leaderScore }}</template>
                  <template v-else>{{ $t('No one has scored in this race yet') }}</template>
                </div>
              </div>
            </template>
          </div>
        </div>

        <!-- ── Economy: the M€ delta (free sponsorship never charges) ───── -->
        <template v-if="view.free">
          <div class="con-maconfirm__free">
            <span class="con-maconfirm__free-chip">{{ $t('Free sponsorship') }}</span>
            <span>{{ $t('This sponsorship costs nothing.') }}</span>
          </div>
        </template>
        <template v-else>
          <div class="con-start__section-title">{{ $t('You will spend') }}</div>
          <div class="con-maconfirm__spend">
            <i class="con-task__opt-icon resource_icon resource_icon--megacredits" aria-hidden="true"></i>
            <b class="con-maconfirm__spend-num">−{{ view.cost }}</b>
            <span class="con-maconfirm__beforeafter">{{ view.mcBefore }} <span aria-hidden="true">→</span> <b>{{ view.mcAfter }}</b></span>
          </div>
        </template>

        <!-- ── Slot economics: the limited-slots consequence ─────────────── -->
        <div class="con-maconfirm__slots">
          <span class="con-maconfirm__slots-count">
            {{ $t(view.kind === 'milestone' ? 'Claimed' : 'Funded') }} <b>{{ view.takenCount }}/{{ view.maxSlots }}</b>
          </span>
          <span class="con-maconfirm__slots-after">{{ $t('Slots left after') }}: <b>{{ view.openAfter }}</b></span>
          <span v-for="t in view.takenBy" :key="t.maName" class="con-maconfirm__slots-owner">
            <span class="con-maconfirm__racer-dot" :class="'player_bg_color_' + t.color" aria-hidden="true"></span>
            <span v-i18n>{{ t.maName }}</span>
          </span>
        </div>

        <!-- ── Honest stale state: the world moved while the modal was open. -->
        <div v-if="!available" class="con-task__warnings">
          <div class="con-task__warning">✕ {{ $t(blockReason !== '' ? blockReason : 'Unavailable right now') }}</div>
        </div>
      </div>

      <!-- ── Footer: the command contract ─────────────────────────────── -->
      <footer class="con-task__foot" aria-hidden="true">
        <span class="con-task__foot-item" :class="{'con-maconfirm__foot-off': !canConfirm}">
          <GamepadGlyph control="confirm" /><span>{{ $t(view.kind === 'milestone' ? 'Claim' : 'Fund') }}</span>
        </span>
        <span class="con-task__foot-item"><GamepadGlyph control="back" /><span>{{ $t('Cancel') }}</span></span>
      </footer>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE MA CONFIRM — the console-native premium confirmation for claiming
 * a milestone / funding an award (the strategic sibling of
 * `ConsoleHydroConfirm`). Opened by the MA dashboard's A on an AVAILABLE
 * item ONLY; nothing is submitted until this modal's A:
 *
 *  - milestone: the viewer's progress vs the threshold + the mechanic truth
 *    ("5 VP immediately") — never confusable with the awards' endgame race;
 *  - award: the M€ before → after delta + the LIVE race (viewer anchored
 *    first, leaders marked, tie honest) + the endgame-scoring truth;
 *  - both: the slot economics (taken X/3, what remains after this action).
 *
 * The view is REBUILT from the live playerView on every commit (the shell's
 * computed), so a slot raced away while the modal is open re-renders as an
 * honest blocked state instead of submitting a dead action. A = confirm
 * (gated + one-shot), B = cancel (returns to the dashboard, nothing sent).
 */
import {defineComponent, PropType} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import MaHeroArt from '@/client/components/ma/MaHeroArt.vue';
import {MaConfirmView} from '@/client/components/ma/maConfirmModel';
import {$t} from '@/client/directives/i18n';
import {GamepadIntent, SemanticButton} from '@/client/gamepad/gamepadPollModel';

export default defineComponent({
  name: 'ConsoleMaConfirm',
  components: {GamepadGlyph, MaHeroArt},
  props: {
    view: {type: Object as PropType<MaConfirmView>, required: true},
    /** LIVE availability (the waitingFor tree is the source of truth). */
    available: {type: Boolean, required: true},
    /** The concrete reason when not available ('' → generic). */
    blockReason: {type: String, default: ''},
  },
  emits: ['confirm', 'cancel'],
  data() {
    return {submitted: false};
  },
  computed: {
    title(): string {
      if (this.view.kind === 'milestone') {
        return 'Claim the milestone';
      }
      return this.view.free ? 'Sponsor the award for free' : 'Fund the award';
    },
    playersCount(): number {
      return this.view.race.length;
    },
    meterWidth(): string {
      const t = this.view.threshold ?? 0;
      if (t <= 0) {
        return '0%';
      }
      return `${Math.min(100, Math.round((this.view.myScore / t) * 100))}%`;
    },
    canConfirm(): boolean {
      return this.available && !this.submitted;
    },
  },
  watch: {
    // Re-pointed at a different item (defensive) → re-arm the one-shot.
    'view.name'() {
      this.submitted = false;
    },
  },
  methods: {
    $t,
    /** The shell routes every intent here while the modal is open. */
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind !== 'press') {
        return;
      }
      this.onPress(intent.button);
    },
    onPress(button: SemanticButton): void {
      switch (button) {
      case 'confirm':
        if (this.canConfirm) {
          this.submitted = true; // one-shot: A-spam can never double-submit
          this.$emit('confirm');
        }
        return;
      case 'back':
        this.$emit('cancel');
        return;
      default:
        return;
      }
    },
  },
});
</script>
