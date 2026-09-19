<template>
  <!-- ══ THE AGENDA — a read-only graphic track: the markers, the influence
       LEVELS, the TR and card rewards, the viewer's next step. Never a
       focus stop; it moves when a marker moves. ══ -->
  <div class="con-parl__agenda" data-parl-agenda data-parl-recede>
    <div class="con-parl__agenda-head">
      <span class="con-parl__kicker">{{ $t('Agenda') }}</span>
      <span v-if="view.viewer !== undefined" class="con-parl__agenda-me">
        <PlayerCube :color="view.viewer.color" :size="cubePx(12)" :glow="false" />
        <span class="con-parl__chip-dim">{{ $t('Influence') }}</span>
        <!-- The influence BADGE — the same asset the resolution faces print
             in their formulas, so «влияние» reads as one symbol everywhere. -->
        <i class="con-parl__inf-icon" aria-hidden="true"></i>
        <b :key="'ai' + agendaVm.viewerInfluence" class="con-parl__tick">{{ agendaVm.viewerInfluence }}</b>
        <span class="con-parl__agenda-next">
          <span class="con-parl__chip-dim">{{ $t(agendaVm.nextStep === undefined ? 'end of the track' : 'next step') }}</span>
          <span v-if="agendaVm.nextStep !== undefined" class="con-parl__reward-step" :class="'con-parl__reward-step--' + agendaVm.nextStep.kind">
            <template v-if="agendaVm.nextStep.kind === 'influence'"><span class="con-parl__step-level">{{ agendaVm.nextStep.influence }}</span></template>
            <template v-else-if="agendaVm.nextStep.kind === 'tr'"><i class="con-parl__step-res resource_icon resource_icon--rating" aria-hidden="true"></i></template>
            <template v-else><i class="con-parl__step-res resource_icon resource_icon--cards" aria-hidden="true"></i></template>
          </span>
        </span>
      </span>
    </div>
    <!-- THE SCALE — every step is TWO fixed rows: the NODE (the symbol,
         optically centred on the rail) and the MARKER row beneath it
         (reserved whether or not a cube stands there, so a marker's
         arrival moves no symbol). The rail is drawn by the steps' own
         half-segments, so the viewer's PASSED part is tinted exactly up to
         their node; the CURRENT node reads by its marker and its reached
         fill, the NEXT one wears a light gold ring — never a focus ring. -->
    <div class="con-parl__track">
      <div class="con-parl__step con-parl__step--start" :class="{'con-parl__step--here': viewerParticipates && agendaVm.viewerPosition === 0, 'con-parl__step--passed': viewerParticipates && agendaVm.viewerPosition > 0}" data-step="0">
        <span class="con-parl__step-node"><span class="con-parl__step-label">{{ $t('Agenda start') }}</span></span>
        <span class="con-parl__step-cubes" data-agenda-markers="0">
          <span v-for="color in agendaVm.start" :key="color" class="con-parl__agenda-cube"
                :class="{'con-parl__agenda-cube--hidden': agendaHidden !== undefined && agendaHidden.step === 0 && agendaHidden.color === color}"
                :data-agenda-cube="color">
            <PlayerCube :color="color" :size="cubePx(12)" :glow="false" />
          </span>
        </span>
      </div>
      <div v-for="step in agendaVm.steps" :key="step.index" class="con-parl__step"
           :class="['con-parl__step--' + step.step.kind, {
             'con-parl__step--lit': flow.stage === 'sitting' && sittingStep === step.index,
             'con-parl__step--next': step.viewerNext,
             'con-parl__step--here': step.viewerHere,
             'con-parl__step--passed': viewerParticipates && step.index < agendaVm.viewerPosition,
             'con-parl__step--pulse': agendaPulseStep === step.index,
           }]"
           :data-step="step.index"
           @animationend="onStepPulseEnd($event, step.index)">
          <span class="con-parl__step-node">
            <template v-if="step.step.kind === 'influence'"><span class="con-parl__step-level">{{ step.step.influence }}</span></template>
            <template v-else-if="step.step.kind === 'tr'"><i class="con-parl__step-res con-parl__step-res--tr resource_icon resource_icon--rating" aria-hidden="true"></i></template>
            <template v-else><i class="con-parl__step-res con-parl__step-res--card resource_icon resource_icon--cards" aria-hidden="true"></i></template>
          </span>
          <span class="con-parl__step-cubes" :data-agenda-markers="step.index">
            <span v-for="color in step.cubes" :key="color" class="con-parl__agenda-cube"
                  :class="{'con-parl__agenda-cube--hidden': agendaHidden !== undefined && agendaHidden.step === step.index && agendaHidden.color === color}"
                  :data-agenda-cube="color">
              <PlayerCube :color="color" :size="cubePx(12)" :glow="false" />
            </span>
          </span>
      </div>
    </div>
  </div>
  <!-- THE AGENDA MARKER in motion — the Hydronetwork's marker director on the
       Parliament's track: from the step it left to the step it reached. -->
  <Teleport to="body">
    <div v-if="agendaFlight !== undefined" class="con-parl__flight con-parl__flight--agenda" ref="agendaFlightEl" aria-hidden="true">
      <PlayerCube :color="agendaFlight.color" :size="cubePx(12)" :glow="false" />
    </div>
  </Teleport>
</template>
<script lang="ts">
import {defineComponent, markRaw, PropType} from 'vue';
import {Color} from '@/common/Color';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {conLogicalPx} from '@/client/console/consoleLayoutProfile';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {AnimationHold, beginAnimationHold} from '@/client/components/presentation/animationHold';
import {HydroMarkerDirectorHandle, runHydroMarkerGlide} from '@/client/console/hydroMarker/hydroMarkerDirector';
import {consoleParliamentUi, parliamentFlow, parliamentRootEl} from '@/client/console/parliament/consoleParliamentFlow';
import {AgendaMove, AgendaVm, ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';

/**
 * The AGENDA tier: the read-only track and the ONE marker in motion on it
 * (the Hydronetwork's marker director on the Parliament's rail) — for a live
 * advance seen while on screen, and for the results scene's Agenda beat.
 */
export default defineComponent({
  name: 'ConsoleParliamentAgenda',
  components: {PlayerCube},
  props: {
    view: {type: Object as PropType<ParliamentViewVm>, required: true},
    model: {type: Object as PropType<ParliamentModel | undefined>, default: undefined},
    agendaVm: {type: Object as PropType<AgendaVm>, required: true},
    viewerParticipates: {type: Boolean, default: false},
    /** The results scene's current focus ('' outside the scene) and the step its Agenda beat names. */
    /** The Agenda step the SITTING's enactment page lights (the winner's new position), if any. */
    sittingStep: {type: Number as PropType<number | undefined>, default: undefined},
    /** A nested frame (the action workspace) took the scene — a live advance is not replayed under it. */
    handedOver: {type: Boolean, default: false},
  },
  data() {
    return {
      agendaPulseStep: undefined as number | undefined,
      /** The marker in motion along the Agenda track (a body-level proxy). */
      agendaFlight: undefined as {color: Color} | undefined,
      /** The real cube the gliding proxy stands in for — hidden until the lock. */
      agendaHidden: undefined as {color: Color, step: number} | undefined,
      agendaGlide: undefined as HydroMarkerDirectorHandle | undefined,
      agendaGlideHold: undefined as AnimationHold | undefined,
    };
  },
  computed: {
    flow() {
      return parliamentFlow;
    },
    /** The server's record of the LAST Agenda advance (its serial) — a live change plays the marker's move. */
    lastAdvanceSeq(): number {
      return this.model?.lastAdvance?.seq ?? 0;
    },
  },
  watch: {
    /**
     * AN AGENDA ADVANCE, LIVE: the marker glides from the step it left to the
     * step it reached, the step pulses, the reward follows (the influence
     * tick, the TR chip, a card cover lifting off the step — the board
     * card-bonus scene, which waits for the marker to settle). A mount or a
     * reload never replays it: only a change seen while on screen moves.
     */
    lastAdvanceSeq(now: number, was: number): void {
      const advance = this.model?.lastAdvance;
      if (now <= was || advance === undefined || this.handedOver) {
        return;
      }
      void this.playAgendaGlide({player: advance.player, from: advance.from, to: advance.to});
    },
  },
  beforeUnmount() {
    this.stopAgendaGlide();
  },
  methods: {
    cubePx(logical: number): number {
      return conLogicalPx(logical);
    },
    /**
     * The marker glides along the track — the Hydronetwork's own director
     * (charge → glide → arrive → lock → release): the real cube at the
     * destination stays hidden until the proxy has locked onto its exact
     * rect, then the step pulses. While it moves, the card-bonus scene of an
     * Agenda card reward waits (`agendaSettling`) — the reward follows the
     * arrival, never precedes it. Bounded by the director's own safeties
     * and an animation hold.
     */
    async playAgendaGlide(move: AgendaMove): Promise<void> {
      const root = parliamentRootEl();
      if (root === undefined || typeof window === 'undefined' || move.to === move.from) {
        this.pulseAgendaStep(move.to);
        return;
      }
      this.stopAgendaGlide();
      const fromEl = root.querySelector<HTMLElement>(`[data-agenda-markers="${move.from}"]`);
      this.agendaHidden = {color: move.player, step: move.to};
      this.agendaFlight = {color: move.player};
      consoleParliamentUi.agendaSettling = true;
      await this.$nextTick();
      const proxy = this.$refs.agendaFlightEl as HTMLElement | undefined;
      const toEl = root.querySelector<HTMLElement>(`[data-agenda-markers="${move.to}"] [data-agenda-cube="${move.player}"]`);
      // The cube the marker LEFT is no longer drawn (the model already stands
      // on the new step), so its rect is rebuilt from the old step's marker
      // ROW: the row's centre, at the destination cube's own size and on its
      // own line — the director scales the proxy by the two rects' widths,
      // and the row spans the whole cell.
      const fromRow = fromEl?.getBoundingClientRect();
      const to = toEl?.getBoundingClientRect();
      const from = fromRow === undefined || to === undefined ? undefined :
        new DOMRect(fromRow.left + fromRow.width / 2 - to.width / 2, to.top, to.width, to.height);
      if (proxy === undefined || from === undefined || to === undefined || to.width < 2 || (fromRow?.width ?? 0) < 2) {
        this.finishAgendaGlide(move.to);
        return;
      }
      this.agendaGlideHold = beginAnimationHold('parliament-agenda-glide', {maxHoldMs: 5000});
      const handle = runHydroMarkerGlide({
        marker: proxy,
        from,
        to,
        reduced: consoleReducedMotionActive(),
        onPhase: () => undefined,
      });
      // RAW on purpose: the director's callbacks compare identities (`this.agendaGlide === handle`) — a reactive proxy never equals its raw object.
      this.agendaGlide = markRaw(handle);
      // The server has already confirmed the move: the lock releases as soon
      // as the marker arrives — the real cube materializes under the proxy,
      // the step pulses, the proxy crossfades away.
      handle.lock(() => {
        if (this.agendaGlide !== handle) {
          return;
        }
        this.agendaHidden = undefined;
        this.pulseAgendaStep(move.to);
        handle.release(() => {
          if (this.agendaGlide === handle) {
            this.finishAgendaGlide(move.to);
          }
        });
      });
    },
    finishAgendaGlide(step: number): void {
      this.agendaGlide = undefined;
      this.agendaFlight = undefined;
      if (this.agendaHidden !== undefined) {
        this.agendaHidden = undefined;
        this.pulseAgendaStep(step);
      }
      this.agendaGlideHold?.release();
      this.agendaGlideHold = undefined;
      consoleParliamentUi.agendaSettling = false;
    },
    stopAgendaGlide(): void {
      const handle = this.agendaGlide;
      this.agendaGlide = undefined;
      handle?.skip();
      this.agendaFlight = undefined;
      this.agendaHidden = undefined;
      this.agendaGlideHold?.release();
      this.agendaGlideHold = undefined;
      consoleParliamentUi.agendaSettling = false;
    },
    /** The step's node blooms once (a CSS one-shot); the flag is cleared by the animation's own end. */
    pulseAgendaStep(step: number): void {
      this.agendaPulseStep = step;
    },
    onStepPulseEnd(event: AnimationEvent, step: number): void {
      if (event.animationName === 'con-parl-node-bloom' && this.agendaPulseStep === step) {
        this.agendaPulseStep = undefined;
      }
    },
  },
});
</script>
