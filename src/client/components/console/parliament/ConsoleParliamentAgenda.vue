<template>
  <!-- ══ THE AGENDA — a read-only graphic track: the markers, the influence
       LEVELS, the TR and card rewards, the viewer's next step. Never a
       focus stop; it moves when a marker moves. During the sitting the
       marker STAYS on its old step until the enactment's first beat glides
       it (`holds.agendaAwaits`) — the influence reads the old level too. ══ -->
  <div class="con-parl__agenda" data-parl-agenda data-parl-recede>
    <div class="con-parl__agenda-head">
      <span class="con-parl__kicker">{{ $t('Agenda') }}</span>
      <span v-if="view.viewer !== undefined" class="con-parl__agenda-me">
        <PlayerCube :color="view.viewer.color" :size="cubePx(12)" :glow="false" />
        <span class="con-parl__chip-dim">{{ $t('Influence') }}</span>
        <!-- The influence BADGE — the same asset the resolution faces print
             in their formulas, so «влияние» reads as one symbol everywhere. -->
        <i class="con-parl__inf-icon" aria-hidden="true"></i>
        <b :key="'ai' + shown.viewerInfluence" class="con-parl__tick" data-parl-influence>{{ shown.viewerInfluence }}</b>
        <span class="con-parl__agenda-next">
          <span class="con-parl__chip-dim">{{ $t(shown.nextStep === undefined ? 'end of the track' : 'next reward') }}</span>
          <span v-if="shown.nextStep !== undefined" class="con-parl__reward-step" :class="'con-parl__reward-step--' + shown.nextStep.kind">
            <template v-if="shown.nextStep.kind === 'influence'"><i class="con-parl__step-res con-parl__step-res--inf" aria-hidden="true"></i><span class="con-parl__step-level">{{ shown.nextStep.influence }}</span></template>
            <template v-else-if="shown.nextStep.kind === 'tr'"><i class="con-parl__step-res resource_icon resource_icon--rating" aria-hidden="true"></i></template>
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
      <div class="con-parl__step con-parl__step--start" :class="{'con-parl__step--here': viewerParticipates && shown.viewerPosition === 0, 'con-parl__step--passed': viewerParticipates && shown.viewerPosition > 0}" data-step="0">
        <span class="con-parl__step-node"><span class="con-parl__step-label">{{ $t('Agenda start') }}</span></span>
        <span class="con-parl__step-cubes" data-agenda-markers="0">
          <span v-for="color in shown.start" :key="color" class="con-parl__agenda-cube"
                :class="{'con-parl__agenda-cube--hidden': cubeHidden(color, 0)}"
                :data-agenda-cube="color">
            <PlayerCube :color="color" :size="cubePx(12)" :glow="false" />
          </span>
        </span>
      </div>
      <div v-for="step in shown.steps" :key="step.index" class="con-parl__step"
           :class="['con-parl__step--' + step.step.kind, {
             'con-parl__step--lit': flow.stage === 'sitting' && sittingStep === step.index,
             'con-parl__step--segment': segmentLit(step.index),
             'con-parl__step--next': step.viewerNext,
             'con-parl__step--here': step.viewerHere,
             'con-parl__step--passed': viewerParticipates && step.index < shown.viewerPosition,
             'con-parl__step--pulse': agendaPulseStep === step.index,
           }]"
           :data-step="step.index"
           @animationend="onStepPulseEnd($event, step.index)">
          <span class="con-parl__step-node">
            <template v-if="step.step.kind === 'influence'"><i class="con-parl__step-res con-parl__step-res--inf" aria-hidden="true"></i><span class="con-parl__step-level">{{ step.step.influence }}</span></template>
            <template v-else-if="step.step.kind === 'tr'"><i class="con-parl__step-res con-parl__step-res--tr resource_icon resource_icon--rating" aria-hidden="true"></i></template>
            <template v-else><i class="con-parl__step-res con-parl__step-res--card resource_icon resource_icon--cards" aria-hidden="true"></i></template>
          </span>
          <span class="con-parl__step-cubes" :data-agenda-markers="step.index">
            <span v-for="color in step.cubes" :key="color" class="con-parl__agenda-cube"
                  :class="{'con-parl__agenda-cube--hidden': cubeHidden(color, step.index)}"
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
import {AGENDA_TRACK, influenceAtAgenda} from '@/common/parliament/ParliamentTypes';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {conLogicalPx} from '@/client/console/consoleLayoutProfile';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {AnimationHold, beginAnimationHold} from '@/client/components/presentation/animationHold';
import {HydroMarkerDirectorHandle, runHydroMarkerGlide} from '@/client/console/hydroMarker/hydroMarkerDirector';
import {consoleParliamentUi, parliamentFlow, parliamentRootEl} from '@/client/console/parliament/consoleParliamentFlow';
import {parliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {sittingMotion} from '@/client/console/parliament/sittingDirector';
import {AgendaMove, AgendaVm, ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';

/**
 * The AGENDA tier: the read-only track and the ONE marker in motion on it
 * (the Hydronetwork's marker director on the Parliament's rail) — for a live
 * advance seen while on screen, and for the sitting's ПОВЕСТКА beat.
 */
export default defineComponent({
  name: 'ConsoleParliamentAgenda',
  components: {PlayerCube},
  props: {
    view: {type: Object as PropType<ParliamentViewVm>, required: true},
    model: {type: Object as PropType<ParliamentModel | undefined>, default: undefined},
    agendaVm: {type: Object as PropType<AgendaVm>, required: true},
    viewerParticipates: {type: Boolean, default: false},
    /** The Agenda step the SITTING's enactment lights (the winner's new position, once the marker has reached it), if any. */
    sittingStep: {type: Number as PropType<number | undefined>, default: undefined},
    /** A nested frame (the action workspace) took the scene — a live advance is not replayed under it. */
    handedOver: {type: Boolean, default: false},
  },
  data() {
    return {
      agendaPulseStep: undefined as number | undefined,
      /** The marker in motion along the Agenda track (a body-level proxy). */
      agendaFlight: undefined as {color: Color} | undefined,
      /** The real cube the gliding proxy stands in for at its DESTINATION — hidden until the lock. */
      agendaHidden: undefined as {color: Color, step: number} | undefined,
      /** The real cube the proxy LIFTED OFF (the held marker on its old step) — hidden from the launch. */
      agendaLifted: undefined as {color: Color, step: number} | undefined,
      agendaGlide: undefined as HydroMarkerDirectorHandle | undefined,
      agendaGlideHold: undefined as AnimationHold | undefined,
      /** The caller's «the marker has settled» callback of the running glide (fired once, on every ending). */
      onGlideLanded: undefined as (() => void) | undefined,
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
    /**
     * THE TRACK AS SHOWN: the live reading — or, while the sitting HOLDS the
     * winner's move, the marker on its OLD step and (for the viewer) the OLD
     * influence and level; the glide is what moves them.
     */
    shown(): AgendaVm {
      const vm = this.agendaVm;
      const hold = parliamentHolds.agendaAwaits;
      if (hold === undefined) {
        return vm;
      }
      const viewer = this.view.viewer;
      const mine = viewer !== undefined && viewer.participates && viewer.color === hold.player;
      const position = mine ? hold.from : vm.viewerPosition;
      const next = mine ? (hold.from < AGENDA_TRACK.length ? hold.from + 1 : undefined) : undefined;
      const levelDelta = mine ? influenceAtAgenda(hold.to) - influenceAtAgenda(hold.from) : 0;
      const steps = vm.steps.map((step) => {
        let cubes = step.cubes;
        if (step.index === hold.to) {
          cubes = cubes.filter((color) => color !== hold.player);
        }
        if (step.index === hold.from && !cubes.includes(hold.player)) {
          cubes = [...cubes, hold.player];
        }
        return {
          ...step,
          cubes,
          viewerHere: mine ? step.index === position : step.viewerHere,
          viewerNext: mine ? step.index === next : step.viewerNext,
        };
      });
      const start = hold.from === 0 && !vm.start.includes(hold.player) ? [...vm.start, hold.player] : vm.start;
      return {
        ...vm,
        steps,
        start,
        viewerPosition: position,
        viewerInfluence: mine ? Math.max(0, vm.viewerInfluence - levelDelta) : vm.viewerInfluence,
        viewerLevel: mine ? influenceAtAgenda(hold.from) : vm.viewerLevel,
        nextStep: mine ? (next === undefined ? undefined : AGENDA_TRACK[next - 1]) : vm.nextStep,
      };
    },
  },
  watch: {
    /**
     * AN AGENDA ADVANCE, LIVE: the marker glides from the step it left to the
     * step it reached, the step pulses, the reward follows (the influence
     * tick, the TR chip, a card cover lifting off the step — the board
     * card-bonus scene, which waits for the marker to settle). A mount or a
     * reload never replays it: only a change seen while on screen moves. The
     * sitting's own move is the director's (its beat calls `playAgendaGlide`
     * over the held marker) — never played twice.
     */
    lastAdvanceSeq(now: number, was: number): void {
      const advance = this.model?.lastAdvance;
      if (now <= was || advance === undefined || this.handedOver) {
        return;
      }
      if (parliamentFlow.stage === 'sitting' || advance.reason === 'phase' || parliamentHolds.agendaAwaits !== undefined) {
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
    /** A real cube is hidden while a proxy stands for it — lifted off its old step, or not yet locked onto its new one. */
    cubeHidden(color: Color, step: number): boolean {
      const hidden = this.agendaHidden;
      const lifted = this.agendaLifted;
      return (hidden !== undefined && hidden.step === step && hidden.color === color) ||
        (lifted !== undefined && lifted.step === step && lifted.color === color);
    },
    /** The steps the marker is CROSSING light as a segment (the sitting's ПОВЕСТКА beat). */
    segmentLit(step: number): boolean {
      const seg = sittingMotion.agendaSegment;
      return seg !== undefined && step > seg.from && step <= seg.to;
    },
    /**
     * The marker glides along the track — the Hydronetwork's own director
     * (charge → glide → arrive → lock → release). With the sitting's HOLD on
     * the move, the real cube still stands on the old step: the proxy is born
     * exactly over it (the cube hides under it), flies to the new step's
     * marker row, and the hold is released at the lock — the real cube
     * materializes under the proxy, the step pulses, the influence ticks.
     * Without a hold (a live mid-generation advance) the old cube is gone
     * already and its rect is rebuilt from the old step's marker row. While
     * it moves, the card-bonus scene of an Agenda card reward waits
     * (`agendaSettling`). Bounded by the director's own safeties and an
     * animation hold.
     */
    async playAgendaGlide(move: AgendaMove, opts?: {onLanded?: () => void}): Promise<void> {
      const root = parliamentRootEl();
      if (root === undefined || typeof window === 'undefined' || move.to === move.from) {
        parliamentHolds.agendaAwaits = undefined;
        this.pulseAgendaStep(move.to);
        opts?.onLanded?.();
        return;
      }
      this.stopAgendaGlide();
      let landedFired = false;
      const landed = () => {
        if (!landedFired) {
          landedFired = true;
          opts?.onLanded?.();
        }
      };
      this.onGlideLanded = landed;
      const hold = parliamentHolds.agendaAwaits;
      const held = hold !== undefined && hold.player === move.player && hold.from === move.from && hold.to === move.to;
      const fromCube = held ? root.querySelector<HTMLElement>(`[data-agenda-markers="${move.from}"] [data-agenda-cube="${move.player}"]`) : null;
      const fromRow = root.querySelector<HTMLElement>(`[data-agenda-markers="${move.from}"]`);
      const toRow = root.querySelector<HTMLElement>(`[data-agenda-markers="${move.to}"]`);
      this.agendaHidden = {color: move.player, step: move.to};
      this.agendaFlight = {color: move.player};
      consoleParliamentUi.agendaSettling = true;
      await this.$nextTick();
      const proxy = this.$refs.agendaFlightEl as HTMLElement | undefined;
      const toCube = root.querySelector<HTMLElement>(`[data-agenda-markers="${move.to}"] [data-agenda-cube="${move.player}"]`);
      const size = (fromCube ?? toCube)?.getBoundingClientRect();
      const cube = size !== undefined && size.width >= 2 ? size : undefined;
      // The destination: the reached cube when it is drawn already, else the new step's marker ROW centre at the
      // cube's own size (the held marker is not drawn there yet).
      const toRect = toCube?.getBoundingClientRect();
      const rowTo = toRow?.getBoundingClientRect();
      const to = toRect !== undefined && toRect.width >= 2 ? toRect :
        (rowTo === undefined || cube === undefined ? undefined : new DOMRect(rowTo.left + rowTo.width / 2 - cube.width / 2, rowTo.top + rowTo.height / 2 - cube.height / 2, cube.width, cube.height));
      const fromCubeRect = fromCube?.getBoundingClientRect();
      const rowFrom = fromRow?.getBoundingClientRect();
      const from = fromCubeRect !== undefined && fromCubeRect.width >= 2 ? fromCubeRect :
        (rowFrom === undefined || to === undefined ? undefined : new DOMRect(rowFrom.left + rowFrom.width / 2 - to.width / 2, to.top, to.width, to.height));
      if (proxy === undefined || from === undefined || to === undefined || to.width < 2) {
        this.finishAgendaGlide(move.to);
        return;
      }
      if (held) {
        this.agendaLifted = {color: move.player, step: move.from};
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
      handle.lock(() => {
        if (this.agendaGlide !== handle) {
          return;
        }
        // The marker has arrived: the hold lets go (the real cube renders on the new step, under the proxy),
        // the step pulses, the proxy crossfades away.
        parliamentHolds.agendaAwaits = undefined;
        this.agendaLifted = undefined;
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
      parliamentHolds.agendaAwaits = undefined;
      this.agendaLifted = undefined;
      if (this.agendaHidden !== undefined) {
        this.agendaHidden = undefined;
        this.pulseAgendaStep(step);
      }
      this.agendaGlideHold?.release();
      this.agendaGlideHold = undefined;
      consoleParliamentUi.agendaSettling = false;
      const landed = this.onGlideLanded;
      this.onGlideLanded = undefined;
      landed?.();
    },
    stopAgendaGlide(): void {
      const handle = this.agendaGlide;
      this.agendaGlide = undefined;
      handle?.skip();
      this.agendaFlight = undefined;
      this.agendaHidden = undefined;
      this.agendaLifted = undefined;
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
