<template>
  <!-- ══ THE AGENDA — a read-only graphic track: the markers, the influence
       LEVELS, the TR and card rewards, the viewer's next step. Never a
       focus stop; it moves when a marker moves. During the sitting the
       marker STAYS on its old step until the enactment's first beat glides
       it (`holds.agendaAwaits`) — the influence reads the old level too. ══ -->
  <div class="con-parl__agenda" data-parl-agenda data-parl-recede>
    <div class="con-parl__agenda-head">
      <span class="con-parl__kicker">{{ $t('Agenda track') }}</span>
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
import {consoleParliamentUi, parliamentFlow, parliamentRootEl, parliamentSupportUp} from '@/client/console/parliament/consoleParliamentFlow';
import {parliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {sittingMotion} from '@/client/console/parliament/sittingDirector';
import {AgendaVm, ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';
import {
  AgendaWalkBeatScheduler, AgendaWalkHandle, AgendaWalkLeg, AgendaWalkRecordLike, agendaWalkHoldMs, agendaWalkMotion, agendaWalkPlan, deliverAgendaStepReward, runAgendaWalk,
} from '@/client/console/parliament/agendaWalkDirector';
import {agendaWalkFlow, releaseAgendaWalkHolds} from '@/client/console/parliament/agendaWalk';

/**
 * The AGENDA tier: the read-only track and the ONE marker in motion on it
 * (the Hydronetwork's marker director on the Parliament's rail, one leg per
 * recorded step — `agendaWalkDirector`) — for a live advance seen while on
 * screen, for the sitting's ПОВЕСТКА beat, for «ПРЕДСЕДАТЕЛЬСТВО»'s step and
 * for a card's walk of N (TR04).
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
      /** The phrase over the legs (the order and the waits) — one per walk. */
      agendaWalk: undefined as AgendaWalkHandle | undefined,
      agendaGlideHold: undefined as AnimationHold | undefined,
      /** The running walk's hold budget (re-armed after a card step's take, which the hold stands down for). */
      agendaGlideHoldMs: 0,
      /** The caller's «the marker has settled» callback of the running glide (fired once, on every ending). */
      onGlideLanded: undefined as (() => void) | undefined,
    };
  },
  computed: {
    flow() {
      return parliamentFlow;
    },
    /** A card step's take is in the PLAYER's hands (the viewer waits for «Взять») — the walk's animation holds stand down. */
    walkAwaitingCard(): boolean {
      return agendaWalkMotion.awaitingCard !== undefined;
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
     * A CARD STEP'S TAKE (TR37): the cover is off the node and the card is the
     * player's to take — nothing the walk owns is moving, so its glide hold
     * stands DOWN for the length of the take (a ceiling over a player's reading
     * would fire as a «leaked hold») and stands UP again, with the walk's own
     * budget, the moment the card has landed and the next leg is due.
     */
    walkAwaitingCard(waiting: boolean): void {
      if (this.agendaWalk === undefined || !this.agendaWalk.active()) {
        return;
      }
      if (waiting) {
        this.agendaGlideHold?.release();
        this.agendaGlideHold = undefined;
      } else if (this.agendaGlideHold === undefined) {
        this.agendaGlideHold = beginAnimationHold('parliament-agenda-glide', {maxHoldMs: this.agendaGlideHoldMs});
      }
    },
    /**
     * AN AGENDA ADVANCE, LIVE: the marker walks from the step it left to the
     * step it reached — one leg per recorded step (a rival's card walks it
     * two, TR04) — each step pulses, the reward follows (the influence tick,
     * the TR chip, a card cover lifting off the step — the board card-bonus
     * scene, which waits for the marker to settle). A mount or a reload never
     * replays it: only a change seen while on screen moves. The sitting's own
     * move is the director's (its beat calls `playAgendaWalk` over the held
     * marker), «ПРЕДСЕДАТЕЛЬСТВО»'s and a card's walk HOSTED by the hand are
     * their flows' — never played twice: a standing hold means a flow owns
     * the move. The one exception is the viewer's own card walk while the
     * Parliament stands ON ITS OWN (no hand to host the pose): the hold was
     * seeded for THIS tier, so the tier plays it, rewards and all.
     */
    lastAdvanceSeq(now: number, was: number): void {
      const advance = this.model?.lastAdvance;
      if (now <= was || advance === undefined || this.handedOver) {
        return;
      }
      if (parliamentFlow.stage === 'sitting' || advance.reason === 'phase') {
        return;
      }
      // «САНКЦИИ» (TR12): the support-area mode plays the card's step ITSELF, after the area's cubes have left — the
      // printed order (the discard, then the step) on one pose; a walk started here would race the discard.
      if (parliamentSupportUp()) {
        return;
      }
      const record: AgendaWalkRecordLike = {player: advance.player, from: advance.from, to: advance.to, steps: advance.steps};
      const owed = agendaWalkFlow.owed;
      if (parliamentHolds.agendaAwaits !== undefined) {
        if (advance.reason !== 'card' || owed === undefined || owed.host !== 'parliament' || owed.seq !== advance.seq || agendaWalkFlow.live) {
          return;
        }
        agendaWalkFlow.live = true;
        agendaWalkFlow.beat = 'walk';
        void this.playAgendaWalk(record, {
          onStep: (leg) => agendaWalkFlow.landed.push(leg.step),
          onLanded: () => {
            const root = parliamentRootEl();
            const finish = () => releaseAgendaWalkHolds('landed');
            if (root === undefined) {
              finish();
            } else {
              deliverAgendaStepReward(root, owed.generation, record.to, finish);
            }
          },
        });
        return;
      }
      void this.playAgendaWalk(record);
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
     * THE WALK — the marker takes the record's steps ONE AT A TIME along the
     * track, the ONE phrase of the track's three engines (`agendaWalkDirector`
     * owns the order and the waits). This component owns the DOM half: the
     * proxy cube (body-level, one for the whole walk), the rows' rects, the
     * real cubes hidden under the proxy, the HOLD moved step by step — so
     * `shown` draws the marker on the step it has reached and the influence
     * at that step's level, and the tick on the last landing is the hold's
     * own release — and the node's bloom at every landing.
     *
     * With a HOLD on the walk (`agendaAwaits` — seeded by the sitting, the
     * quest or a card's play) the real cube still stands on the old step: the
     * proxy is born exactly over it and the cube hides under it. Without a
     * hold (a rival's walk seen live) the old cube is gone already and its
     * rect is rebuilt from the old step's marker row. The marker CHARGES on
     * the first leg only — after that it is in hand: lift → glide → lock →
     * pulse, per leg. An intermediate step's reward is the caller's
     * (`rewardStep`; the tier's own watcher delivers the ledger's default) and
     * the next leg waits for it to LAND; the LAST step's reward follows
     * `onLanded`, after the proxy has crossfaded onto the real cube. While it
     * moves, the card-bonus scene of an Agenda card reward waits
     * (`agendaSettling`). Bounded by the director's own safeties and an
     * animation hold sized to the walk.
     */
    playAgendaWalk(record: AgendaWalkRecordLike, opts?: {
      rewardStep?: (leg: AgendaWalkLeg, done: () => void) => void,
      onStep?: (leg: AgendaWalkLeg) => void,
      onLanded?: () => void,
      /** The clock of the phrase's waits — a director's «дожать»-able one, or the motion clock. */
      beat?: AgendaWalkBeatScheduler,
    }): void {
      const root = parliamentRootEl();
      const legs = agendaWalkPlan(record);
      if (root === undefined || typeof window === 'undefined' || legs.length === 0) {
        parliamentHolds.agendaAwaits = undefined;
        this.pulseAgendaStep(record.to);
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
      const color = record.player;
      const hold = parliamentHolds.agendaAwaits;
      const held = hold !== undefined && hold.player === color && hold.from === record.from && hold.to === record.to;
      this.agendaHidden = {color, step: record.to};
      this.agendaFlight = {color};
      consoleParliamentUi.agendaSettling = true;
      this.agendaGlideHoldMs = agendaWalkHoldMs(record);
      this.agendaGlideHold = beginAnimationHold('parliament-agenda-glide', {maxHoldMs: this.agendaGlideHoldMs});
      const reduced = consoleReducedMotionActive();
      const rewardStep = opts?.rewardStep ?? ((leg: AgendaWalkLeg, done: () => void) => deliverAgendaStepReward(root, undefined, leg.to, done));
      const cubeRect = (step: number): DOMRect | undefined => {
        const r = root.querySelector<HTMLElement>(`[data-agenda-markers="${step}"] [data-agenda-cube="${color}"]`)?.getBoundingClientRect();
        return r !== undefined && r.width >= 2 ? r : undefined;
      };
      // THE STAGE'S GEOMETRY is read when the first leg LEAVES — after the lead, by which time the proxy and the
      // hidden cube have been flushed. The lead's clock starts NOW, in parallel with that render, exactly as the
      // sitting's lead ran on its master while the tier flushed: waiting for the flush FIRST serialized the two
      // and cost the ПОВЕСТКА beat ~60 ms against the v4 window (measured, `console-parliament-sitting-v4`).
      let geometry: {proxy: HTMLElement, size: DOMRect} | undefined;
      const stageGeometry = (): {proxy: HTMLElement, size: DOMRect} | undefined => {
        if (geometry === undefined) {
          const proxy = this.$refs.agendaFlightEl as HTMLElement | undefined;
          // The cube's own size: the held cube on the old step, the drawn cube on the new one, else any cube on the track.
          const anyCube = root.querySelector<HTMLElement>('[data-agenda-cube]')?.getBoundingClientRect();
          const size = cubeRect(record.from) ?? cubeRect(record.to) ?? (anyCube !== undefined && anyCube.width >= 2 ? anyCube : undefined);
          if (proxy !== undefined && size !== undefined) {
            geometry = {proxy, size};
          }
        }
        return geometry;
      };
      // A step's marker ROW centre at the cube's own size (the held marker is not drawn there yet).
      const rowRect = (step: number, size: DOMRect): DOMRect | undefined => {
        const row = root.querySelector<HTMLElement>(`[data-agenda-markers="${step}"]`)?.getBoundingClientRect();
        return row === undefined ? undefined :
          new DOMRect(row.left + row.width / 2 - size.width / 2, row.top + row.height / 2 - size.height / 2, size.width, size.height);
      };
      const walk = runAgendaWalk(record, {
        onLead: (leg) => {
          sittingMotion.agendaSegment = {player: color, from: leg.from, to: leg.to};
        },
        glide: (leg, onLocked) => {
          const stage = stageGeometry();
          if (stage === undefined) {
            this.finishAgendaGlide(record.to);
            return;
          }
          const {proxy, size} = stage;
          const from = (leg.index === 0 && held ? cubeRect(leg.from) : undefined) ?? rowRect(leg.from, size);
          const to = cubeRect(leg.to) ?? rowRect(leg.to, size);
          if (from === undefined || to === undefined || to.width < 2) {
            this.finishAgendaGlide(record.to);
            return;
          }
          if (leg.index === 0) {
            if (held) {
              // The real cube on the old step hides under the proxy born over it — the director places the proxy
              // on the same tick, so the cube is never seen twice and never gone.
              this.agendaLifted = {color, step: record.from};
            }
          } else {
            // The cube drawn on the step just reached hides under the leaving proxy.
            this.agendaLifted = {color, step: leg.from};
          }
          const handle = runHydroMarkerGlide({
            marker: proxy,
            from,
            to,
            reduced,
            skipCharge: !leg.charge,
            onPhase: () => undefined,
          });
          // RAW on purpose: the director's callbacks compare identities (`this.agendaGlide === handle`) — a reactive proxy never equals its raw object.
          this.agendaGlide = markRaw(handle);
          handle.lock(() => {
            if (this.agendaGlide !== handle) {
              return;
            }
            sittingMotion.agendaSegment = undefined;
            if (leg.last) {
              // The marker has arrived: the hold lets go (the real cube renders on the new step, under the proxy).
              parliamentHolds.agendaAwaits = undefined;
              this.agendaLifted = undefined;
              this.agendaHidden = undefined;
            } else {
              // The marker STANDS on this step now: the hold moves with it — the tier draws the cube here and reads
              // the influence at this step's level — while the proxy still covers it until the next leg lifts.
              parliamentHolds.agendaAwaits = held ? {player: color, from: leg.to, to: record.to} : undefined;
              this.agendaLifted = undefined;
            }
            this.pulseAgendaStep(leg.to);
            onLocked();
          });
        },
        release: (onGone) => {
          const handle = this.agendaGlide;
          if (handle === undefined) {
            this.finishAgendaGlide(record.to);
            onGone();
            return;
          }
          handle.release(() => {
            if (this.agendaGlide === handle) {
              this.finishAgendaGlide(record.to);
            }
            onGone();
          });
        },
        rewardStep,
        onStep: opts?.onStep,
        onLanded: () => landed(),
        beat: opts?.beat,
      });
      this.agendaWalk = markRaw(walk);
    },
    finishAgendaGlide(step: number): void {
      this.agendaWalk?.skip();
      this.agendaWalk = undefined;
      this.agendaGlide = undefined;
      this.agendaFlight = undefined;
      parliamentHolds.agendaAwaits = undefined;
      sittingMotion.agendaSegment = undefined;
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
      this.agendaWalk?.skip();
      this.agendaWalk = undefined;
      const handle = this.agendaGlide;
      this.agendaGlide = undefined;
      handle?.skip();
      sittingMotion.agendaSegment = undefined;
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
