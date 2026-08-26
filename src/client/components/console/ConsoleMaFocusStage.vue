<template>
  <!-- THE MA FOCUS STAGE — the same workspace frame, one level deeper. The
       descend hooks unfold it from the pressed card's rect; the emblem
       pedestal is the carried subject. It is BOTH the full detail dossier and
       the safe confirmation context (the second A commits); past the commit
       it becomes the ceremony's scene — the hero emblem never leaves it. -->
  <div class="con-mafocus"
       :class="['con-mafocus--' + kind, {
         'con-mafocus--committing': phase === 'committing',
         'con-mafocus--cere': ceremonyUp,
         'con-mafocus--avail': available && phase === 'detail',
       }]">
    <div class="con-mafocus__surface" data-unfold-surface>
      <span class="con-mafocus__edge" data-unfold-edge aria-hidden="true"></span>

      <div class="con-mafocus__grid">
        <!-- ── HERO column: the carried emblem + identity. The pedestal is the
             ONE physical object of the whole flow (card → hero → ceremony) —
             its children must be identical in every phase. ── -->
        <div class="con-mafocus__side">
          <div class="con-mafocus__stage" data-ma-focus-hero>
            <MaHeroArt :name="item.name" :kind="kind" class="con-mafocus__hero" />
            <!-- The «can act NOW» light — the same gold-white activation rim
                 the overview tile and the strategy rail wear. Absolute, zero
                 layout: the hero column's children stay identical in every
                 phase; only the light comes and goes with availability. -->
            <i class="con-mafocus__actring" aria-hidden="true"></i>
          </div>
          <div class="con-mafocus__name" data-ma-detail data-unfold-item v-i18n>{{ displayView.displayName }}</div>
          <!-- THE STATE BADGE — ONE short word-pair, never a sentence. It says
               WHICH state this is; the progress block says by how much, and
               the status rail says what the action would do (or why it can't).
               A badge that tried to carry the whole reason («ПОРОГ ДОСТИГНУТ —
               МОЖНО ВЗЯТЬ СЕЙЧАС») outgrew the hero column and was clipped by
               it; the length is the fix, not a smaller font. -->
          <div class="con-mafocus__state" data-ma-detail data-unfold-late>
            <span class="con-mafocus__state-chip" :class="'con-mafocus__state-chip--' + stateTone">
              <span v-if="ownerColor !== ''" class="con-mafocus__dot" :class="'player_bg_color_' + ownerColor" aria-hidden="true"></span>
              <span>{{ $t(stateLabel) }}</span>
            </span>
          </div>

          <!-- YOUR STANDING — the personal fact, and the column's second
               voice. It lived in the dossier as a «Ваш прогресс» block, which
               left the identity column ending at the badge with a void under
               it and made the player's own number one row among the rules.
               Here it belongs to the artefact: this is YOUR reading of it. -->
          <div class="con-mafocus__you" data-ma-detail data-unfold-late>
            <span class="con-mafocus__you-label">{{ $t('You') }}</span>
            <span class="con-mafocus__you-value" :class="{'con-mafocus__you-value--met': kind === 'milestone' && displayView.thresholdMet}">
              <b>{{ displayView.myScore }}</b><span v-if="displayView.threshold !== undefined" class="con-mafocus__you-req">/{{ displayView.threshold }}</span>
            </span>
            <span v-if="displayView.threshold !== undefined" class="con-mafocus__meter" aria-hidden="true"><i :style="{width: meterWidth}"></i></span>
            <span v-if="standingNote !== ''" class="con-mafocus__you-note" :class="{'con-mafocus__you-note--lead': displayView.raceTone === 'lead' || displayView.raceTone === 'tie'}">{{ standingNote }}</span>
          </div>
        </div>

        <!-- ── DOSSIER column: two PLATES — what the rule is, and how the
             field stands. Material (plate + edge light) rather than naked
             lines: the stage is the artefact's exhibition, and grouped
             surfaces are what the rest of the console is built from. ── -->
        <div class="con-mafocus__main" data-ma-detail>
          <div class="con-mafocus__plate" data-unfold-item>
            <div class="con-mafocus__block-title">{{ $t('Condition') }}</div>
            <div class="con-mafocus__desc" v-i18n>{{ displayView.description }}</div>
            <!-- The MECHANIC TRUTH of the category: a milestone pays its 5 VP
                 the moment it is claimed; an award pays nothing now and
                 everything at the end. -->
            <div class="con-mafocus__truth" data-unfold-late>
              <template v-if="kind === 'milestone'">
                <span class="con-mafocus__vp-badge">+5 {{ $t('VP') }}</span>
                <span class="con-mafocus__truth-note">{{ $t('Milestones grant 5 victory points immediately when claimed.') }}</span>
              </template>
              <template v-else>
                <span class="con-mafocus__truth-mark" aria-hidden="true">⏳</span>
                <span class="con-mafocus__truth-note">
                  <b>{{ $t('The award grants no victory points now.') }}</b>
                  {{ $t(displayInspect.playersCount > 2 ? 'At game end: 5 VP for 1st place, 2 VP for 2nd.' : 'At game end: 5 VP for 1st place.') }}
                </span>
              </template>
            </div>
          </div>

          <!-- The RACE / STANDINGS — ranked leader→last with relative bars
               (the inspect view-model; engine-faithful VP projection). A
               claimed milestone has no meaningful race and renders none. -->
          <div v-if="displayInspect.rows.length > 0" class="con-mafocus__plate con-mafocus__race" data-unfold-item>
            <div class="con-mafocus__block-title">{{ $t('Current race') }}</div>
            <div class="con-mafocus__rows">
              <div v-for="r in displayInspect.rows" :key="r.color"
                   class="con-mafocus__row"
                   :class="{'con-mafocus__row--viewer': r.viewer, 'con-mafocus__row--leader': r.isLeader}">
                <span class="con-mafocus__row-rank" aria-hidden="true">
                  <!-- The award identity echo: the RACE leader wears the same
                       crown the overview cassette caps its cluster with. -->
                  <i v-if="kind === 'award' && r.isLeader" class="con-mafocus__row-crown">
                    <svg viewBox="0 0 18 15">
                      <path d="M2.4 12.2 L3 5.6 L6.5 8.1 L9 1 L11.5 8.1 L15 5.6 L15.6 12.2 Z" />
                      <path class="con-mafocus__row-crown-base" d="M2.9 13 H15.1 A0.62 0.62 0 0 1 15.1 14.24 H2.9 A0.62 0.62 0 0 1 2.9 13 Z" />
                    </svg>
                  </i>
                  <template v-else>{{ r.rank }}</template>
                </span>
                <span class="con-mafocus__dot" :class="'player_bg_color_' + r.color" aria-hidden="true"></span>
                <span class="con-mafocus__row-name">{{ r.viewer ? $t('You') : r.name }}</span>
                <span class="con-mafocus__row-bar" aria-hidden="true"><i :style="{width: r.barPct + '%'}"></i></span>
                <span class="con-mafocus__row-score">{{ r.score }}</span>
                <span v-if="r.projectedVp !== undefined" class="con-mafocus__row-vp" data-unfold-late>+{{ r.projectedVp }} {{ $t('VP') }}</span>
                <span v-else-if="r.canClaim === true" class="con-mafocus__row-ready" data-unfold-late>✓</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── THE STATUS RAIL — the stage's ONE centre of decision, and the
           SAME line the list state carries: the whole projected transaction in
           shared `current → resulting` chips, or the one concrete blocker.
           Past the press it states the commit instead (and after a refusal,
           the inline reason). The verbs live in the global command bar. ── -->
      <div class="con-mafocus__decision" data-ma-detail data-unfold-item>
        <ConsoleMaRail v-if="commitStatus === ''" :view="railView" />
        <span v-else class="con-mafocus__status" :class="statusClass">
          <template v-if="phase === 'committing'">{{ $t('Confirming…') }}</template>
          <template v-else>✕ {{ $t(commitStatus) }}</template>
        </span>
      </div>

      <!-- ── THE CEREMONY SCENE (post-commit). The hero emblem GLIDES into
           the seat below; the dressing surfaces around it; the shared burst
           fires over the seat. Mounted only past the commit boundary —
           motion is driven by consoleMaFocusMotion.runMaCeremonyStage. ── -->
      <div v-if="ceremonyUp" class="con-mafocus__cere" aria-hidden="true">
        <div class="con-mafocus__cere-seat" data-ma-cere-seat>
          <span class="con-mafocus__cere-halo" data-ma-cere-dress></span>
          <span class="con-mafocus__cere-ring" data-ma-cere-dress></span>
          <!-- The glide TARGET — smaller than the ring, so the coronation
               ring FRAMES the arriving emblem instead of hiding under it. -->
          <span class="con-mafocus__cere-slot" data-ma-cere-slot></span>
        </div>
        <div class="con-mafocus__cere-lines">
          <div class="con-mafocus__cere-kicker" data-ma-cere-line>{{ $t(ceremonyKicker) }}</div>
          <div class="con-mafocus__cere-name" data-ma-cere-line v-i18n>{{ displayView.displayName }}</div>
          <div v-if="kind === 'milestone'" class="con-mafocus__cere-vp" data-ma-cere-line>
            <span class="con-mafocus__cere-vp-num">+5</span>
            <span class="con-mafocus__cere-vp-unit">{{ $t('VP') }}</span>
          </div>
          <div v-else-if="displayView.free" class="con-mafocus__cere-cost" data-ma-cere-line>{{ $t('Free sponsorship') }}</div>
          <div v-else class="con-mafocus__cere-cost" data-ma-cere-line>
            <span>{{ $t('Cost') }}: <b>{{ displayView.cost }}</b></span>
            <i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE MA FOCUS STAGE — the detail state of the Milestones/Awards
 * workspace (the North-Star rework of the old `ConsoleMaConfirm` modal).
 *
 * A PURE renderer over three unit-tested view-models:
 *  - `ConsoleMaItem` (consoleMaModel) — the dashboard item identity;
 *  - `MaConfirmView` (maConfirmModel) — economy / slots / progress, REBUILT
 *    from the live playerView on every commit (a raced-away slot re-renders
 *    as an honest blocked state);
 *  - `MaInspectView` (consoleMaInspectModel) — the ranked race/standings
 *    with the engine-faithful endgame VP projection.
 *
 * Input, commands and the commit path live in ConsoleShell (the sheet
 * pattern); the flow phase lives in consoleMaFocus.ts. The CEREMONY runs on
 * this stage: the `phase` watcher hands the DOM to
 * `runMaCeremonyStage` and emits `ceremony-done` on its completion — the
 * shell's ONE signal to close the workspace.
 */
import {defineComponent, PropType} from 'vue';
import MaHeroArt from '@/client/components/ma/MaHeroArt.vue';
import ConsoleMaRail from '@/client/components/console/ConsoleMaRail.vue';
import {ConsoleMaItem} from '@/client/components/console/consoleMaModel';
import {buildMaRail, MaRailView} from '@/client/components/console/consoleMaRail';
import {MaConfirmView} from '@/client/components/ma/maConfirmModel';
import {MaInspectView} from '@/client/components/console/consoleMaInspectModel';
import {maFocusState, MaFocusPhase} from '@/client/console/consoleMaFocus';
import {runMaCeremonyStage, stopMaCeremonyStage} from '@/client/console/consoleMaFocusMotion';
import {$t} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsoleMaFocusStage',
  components: {MaHeroArt, ConsoleMaRail},
  props: {
    item: {type: Object as PropType<ConsoleMaItem>, required: true},
    view: {type: Object as PropType<MaConfirmView>, required: true},
    inspect: {type: Object as PropType<MaInspectView>, required: true},
    /** LIVE availability (the waitingFor tree is the source of truth). */
    available: {type: Boolean, required: true},
    /** The concrete reason when not available ('' → generic). */
    blockReason: {type: String, default: ''},
  },
  emits: ['ceremony-done'],
  data() {
    return {
      /**
       * THE COMMIT FREEZE (the colony stage's `heldView` idiom): the instant
       * the commit leaves for the wire the stage pins what it shows — the
       * live rebuild would otherwise repaint the paid price / before-after /
       * standings mid-beat (the free flag drops with the consumed task, the
       * NEXT award price replaces the paid one). The ceremony then states
       * the EXACT paid economy. A refusal releases the pin — the restored
       * detail must be live again.
       */
      heldView: undefined as MaConfirmView | undefined,
      heldInspect: undefined as MaInspectView | undefined,
    };
  },
  computed: {
    kind(): 'milestone' | 'award' {
      return this.item.kind;
    },
    phase(): MaFocusPhase {
      return maFocusState.phase;
    },
    error(): string {
      return maFocusState.error;
    },
    ceremonyUp(): boolean {
      return this.phase === 'ceremony' || this.phase === 'closing';
    },
    /** What the stage renders: LIVE pre-commit, PINNED past the commit. */
    displayView(): MaConfirmView {
      return this.heldView ?? this.view;
    },
    displayInspect(): MaInspectView {
      return this.heldInspect ?? this.inspect;
    },
    takenByMe(): boolean {
      return this.item.takenBy !== undefined && this.item.takenBy.color === this.item.myColor;
    },
    /** The state BADGE — one short label, one tone. Which state, nothing more:
     *  the quantity is the progress block's, the consequence is the rail's. */
    stateTone(): 'taken' | 'mine' | 'go' | 'idle' {
      if (this.displayView.takenByOther !== undefined) {
        return 'taken';
      }
      if (this.takenByMe) {
        return 'mine';
      }
      return this.available ? 'go' : 'idle';
    },
    stateLabel(): string {
      switch (this.stateTone) {
      case 'taken':
      case 'mine':
        return this.kind === 'milestone' ? 'Claimed' : 'Funded';
      case 'go':
        return this.kind === 'milestone' ? 'Can be claimed' : 'Can be sponsored';
      default:
        return 'Unavailable right now';
      }
    },
    /** The claimant's colour dot rides the badge when someone ELSE owns it. */
    ownerColor(): string {
      return this.displayView.takenByOther?.color ?? '';
    },
    /**
     * The one line UNDER the viewer's own number: where they stand in the
     * race. An award's whole point is the comparison, so it names the leader
     * (or says the viewer IS one); a milestone's number already carries its
     * own target («20/29»), so it says nothing rather than something twice.
     */
    standingNote(): string {
      if (this.kind === 'milestone') {
        return '';
      }
      switch (this.displayView.raceTone) {
      case 'lead': return $t('You lead');
      case 'tie': return $t('Tied for the lead');
      case 'behind': return `${$t('Leader')}: ${this.displayView.leaderScore}`;
      default: return '';
      }
    },
    meterWidth(): string {
      const t = this.displayView.threshold ?? 0;
      if (t <= 0) {
        return '0%';
      }
      return `${Math.min(100, Math.round((this.displayView.myScore / t) * 100))}%`;
    },
    /**
     * THE STATUS RAIL of this item — the same pure model, the same component
     * the list state renders. It uses the PINNED view past the commit, so the
     * ceremony states the economy that was actually paid.
     */
    railView(): MaRailView {
      return buildMaRail({
        item: this.item,
        kind: this.kind === 'milestone' ? 'milestones' : 'awards',
        cost: this.displayView.cost,
        free: this.displayView.free,
        myMegacredits: this.displayView.mcBefore,
        takenCount: this.displayView.takenCount,
        maxSlots: this.displayView.maxSlots,
      });
    },
    /**
     * The COMMIT's own line, which REPLACES the rail while it speaks: the
     * pending beat, or a refusal's inline reason. A blocked-by-state item is
     * NOT one of these — the rail already names that blocker, and printing it
     * twice is the duplication this iteration removed.
     */
    commitStatus(): string {
      if (this.phase === 'committing') {
        return 'Confirming…';
      }
      return this.error;
    },
    statusClass(): string {
      return this.phase === 'committing' ?
        'con-mafocus__status--wait' : 'con-mafocus__status--blocked';
    },
    ceremonyKicker(): string {
      if (this.kind === 'milestone') {
        return 'Milestone claimed';
      }
      return this.displayView.free ? 'Award sponsored' : 'Award funded';
    },
  },
  watch: {
    /** The commit resolved — the ceremony owns the stage from here. One-shot
     *  by construction (the phase machine never re-enters 'ceremony'). */
    phase(next: MaFocusPhase, prev: MaFocusPhase) {
      if (next === 'committing') {
        // Pin the presentation across the commit (see `heldView`).
        this.heldView = this.view;
        this.heldInspect = this.inspect;
      } else if (next === 'detail') {
        // A refusal restored the reversible detail — live values again.
        this.heldView = undefined;
        this.heldInspect = undefined;
      }
      if (next === 'ceremony' && prev === 'committing') {
        void this.$nextTick(() => {
          runMaCeremonyStage(this.$el as Element, {kind: this.kind}, () => this.$emit('ceremony-done'));
        });
      }
    },
  },
  beforeUnmount() {
    // A torn-down stage must never fire a late completion into the shell.
    stopMaCeremonyStage();
  },
  methods: {$t},
});
</script>
