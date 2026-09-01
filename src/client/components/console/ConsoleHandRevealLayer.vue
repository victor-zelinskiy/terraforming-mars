<template>
  <!--
    HAND BODIES LAYER — the ONE OWNER of the hand's physical cards (the
    rework of the dock ⇄ album transition; module: handDock/handBodies.ts).

    Every card in the hand is ONE persistent element here, alive through the
    docked pack, the open/close flights, the album shelf and the page
    packets. The dock renders only chassis; «карта исчезла при свапе» is
    inexpressible — the same element continues. The historical root class is
    kept on purpose: its z (11645, under the footer band — bodies nest into
    the tray behind the plate, exactly the intake physics), the static STAGE
    WINDOW clip and the art no-refade rule all hang off it, as do the e2e
    probes' selectors.

    Attributes are the CONTRACT: `data-hand-dock-card` always (the berth
    anchor every intake/delivery director and probe targets), plus
    `data-reveal-card` ONLY while a reveal episode owns the body (the
    probes' «flight is live» signal). The face mounts lazily (first time a
    card needs one) and then stays — a mounted face is a warm cache.
  -->
  <div class="con-handreveal-layer" aria-hidden="true" :style="stageStyle"
       :data-hand-reveal-rev="handRevealState.rev">
    <div v-for="(c, i) in cards" :key="c.name"
         class="con-deal-proxy con-handbody"
         :class="{
           'con-handbody--held': heldSet.has(c.name),
           'con-handbody--deep': deepSet.has(c.name),
           'con-handbody--tucked': pose === 'compact' && modeOf(c.name) === 'docked',
         }"
         :style="{zIndex: 3 + i, width: naturalW + 'px', height: naturalH + 'px'}"
         :data-hand-dock-card="c.name"
         :data-hand-body-mode="modeOf(c.name)"
         :data-reveal-card="flyingSet.has(c.name) ? c.name : undefined"
         :ref="(el) => registerHandBody(c.name, el as HTMLElement | null)">
      <div class="con-deal-proxy__flip">
        <div v-if="faceSet.has(c.name)"
             class="con-deal-proxy__face"
             :class="{
               'con-deal-proxy__face--dim': visualOf(c.name)?.dim === 'soft',
               'con-deal-proxy__face--dim-strong': visualOf(c.name)?.dim === 'strong',
             }">
          <ConsoleCardFaceLite :name="c.name" :card="visualOf(c.name)?.card ?? c" :artTier="handRevealState.artTier" lightweight />
          <span v-if="visualOf(c.name)?.chip !== undefined" class="con-deal-proxy__chip">{{ $t(visualOf(c.name)!.chip!) }}</span>
        </div>
        <div class="con-deal-proxy__back">
          <div class="con-card-back con-card-back--flyer"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {gsap} from 'gsap';
import {CardModel} from '@/common/models/CardModel';
import {handRevealState, RevealVisual} from '@/client/console/handDock/handRevealState';
import {
  BodyPose, PackAnchor, PackPose, PoseRide, bodyNaturalH, dockedBodyPose, handBodiesState, handBodyEl, handBodyMode,
  packProfileTuning, poseRideSpec, registerHandBody, rideDurationForRemainder, setHandBodiesOracle, ensureHandBodyFaces,
} from '@/client/console/handDock/handBodies';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {dockFaceRotation, handDockPresentation} from '@/client/console/handDock/handDockPresentation';
import {handDockPlan} from '@/client/console/consoleHandDock';
import {consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {motionMs} from '@/client/components/motion/motionTokens';
import {CARD_NATURAL_W} from '@/client/console/cardDeal/cardDealModel';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';

/* ── THE SILENT RETURN's motion (resettleBodies) — the tray's own arrival
   vocabulary, never a journey: the rise matches the fresh-body pop above, and
   the stagger is BUDGET-capped so the pack's re-forming reads the same at 6
   cards and at 25. */
const RESETTLE_RISE_REM = 1.15;
const RESETTLE_RISE_MS = 300;
const RESETTLE_SPREAD_MAX_MS = 200;

export default defineComponent({
  name: 'ConsoleHandBodies',
  components: {ConsoleCardFaceLite},
  props: {
    /** The hand in SERVER order (the dock's old `cards` prop — append-order,
     *  newest right; DOM order is the pack's z-order). */
    cards: {type: Array as PropType<ReadonlyArray<CardModel>>, required: true},
    /** Names withheld while still arriving (the delivery hold — hidden with
     *  layout, released on the intake's touchdown). */
    held: {type: Array as PropType<ReadonlyArray<string>>, default: () => []},
    /** The pack-level pose (rest / compact / raised) — shell-derived from
     *  the same flags that used to drive the dock's CSS pose classes. */
    pose: {type: String as PropType<PackPose>, default: 'rest'},
  },
  data() {
    return {handRevealState, handBodiesState, layout: consoleLayoutState, anchorRetries: 0, dockPresentation: handDockPresentation};
  },
  computed: {
    heldSet(): Set<string> {
      return new Set(this.held);
    },
    flyingSet(): Set<string> {
      return new Set(this.handBodiesState.flying);
    },
    faceSet(): Set<string> {
      return new Set(this.handBodiesState.faces);
    },
    deepSet(): Set<string> {
      const plan = handDockPlan(this.cards.length);
      const out = new Set<string>();
      plan.slots.forEach((s, i) => {
        if (s.deep && this.cards[i] !== undefined) {
          out.add(this.cards[i].name);
        }
      });
      return out;
    },
    naturalW(): number {
      return CARD_NATURAL_W;
    },
    naturalH(): number {
      const a = this.anchor();
      return a === undefined ? CARD_NATURAL_W * 1.4 : bodyNaturalH(a);
    },
    stageStyle(): Record<string, string> {
      const c = this.handRevealState.stageClip;
      if (c === undefined) {
        return {};
      }
      const l = Math.max(0, c.left);
      const r = Math.max(0, window.innerWidth - c.right);
      return {clipPath: `inset(0px ${r.toFixed(1)}px 0px ${l.toFixed(1)}px)`};
    },
    /** One string that changes whenever the docked COMPOSITION must re-seat
     *  (cards joined/left/reordered, the profile or scale flipped). The PACK
     *  POSE is deliberately NOT part of it — a pose change is a different
     *  event with its own choreography (see the `pose` watcher). */
    compositionEpoch(): string {
      return `${this.cards.map((c) => c.name).join('|')}::${this.layout.profile}::${this.layout.uiScale}`;
    },
  },
  watch: {
    compositionEpoch() {
      // Face-up presentation: every card in the pack shows its face, so a
      // newly arrived card needs one mounted (cheap, render-once, cached).
      if (this.dockPresentation.faceUp) {
        ensureHandBodyFaces(this.cards.map((c) => c.name));
      }
      // The re-seat exists for the STANDING pack only. During an episode
      // the director owns every body: the flight departs from the live
      // painted pose and the finalize reconciles — while a ride tween
      // lives on the GLOBAL gsap ticker, which the album's mount
      // storm starves; its catch-up then lands the whole raised→rest delta
      // in ONE frame (the handheld probe's 15px dockjump at the open).
      if (this.handRevealState.phase !== 'docked') {
        return;
      }
      // The patch (new bodies mount / order changes) lands first.
      void this.$nextTick().then(() => this.applyDockedPoses(true));
    },
    /**
     * The pack POSE changed (rest ↔ compact ↔ raised) — ride the pair's own
     * choreography (poseRideSpec: «→ compact» is a long quiet settle, «→
     * raised» a soft delayed rise behind the wheel's pop, returns are calm).
     * Synchronous on purpose: no DOM mounts are pending for a pure pose
     * flip, and the ride must start from the exact frame the player acted.
     * An interrupted ride restarts from the current visual position with a
     * distance-scaled duration (no snap, no syrup — see applyDockedPoses).
     */
    pose(now: PackPose, was: PackPose) {
      if (this.handRevealState.phase !== 'docked') {
        return;
      }
      this.applyDockedPoses(true, {spec: poseRideSpec(was, now), from: was});
    },
    // The dock-presentation toggle («Рубашкой» ↔ «Лицом»): the standing fan
    // turns over in place — one 3D flip of every docked card. Faces mount
    // first (a face-less flip turning to 0 shows a transparent card).
    'dockPresentation.faceUp'() {
      ensureHandBodyFaces(this.cards.map((c) => c.name));
      void this.$nextTick().then(() => {
        const target = dockFaceRotation();
        this.cards.forEach((c) => {
          if (handBodyMode(c.name) !== 'docked') {
            return;
          }
          const flip = handBodyEl(c.name)?.querySelector<HTMLElement>('.con-deal-proxy__flip');
          if (flip !== null && flip !== undefined) {
            gsap.to(flip, {rotationY: target, duration: motionMs(420) / 1000, ease: 'power2.inOut', overwrite: 'auto'});
          }
        });
      });
    },
  },
  mounted() {
    window.addEventListener('resize', this.onResize);
    setHandBodiesOracle({
      poseFor: (name) => this.dockedPoseOf(name),
      poseForCopy: (name, seqFromEnd) => this.dockedPoseOfCopy(name, seqFromEnd),
      reconcile: () => this.applyDockedPoses(true),
      seatNew: () => this.applyDockedPoses(false),
      resettle: (names) => this.resettleBodies(names),
      names: () => this.cards.map((c) => c.name as string),
    });
    if (this.dockPresentation.faceUp) {
      ensureHandBodyFaces(this.cards.map((c) => c.name));
    }
    void this.$nextTick().then(() => this.applyDockedPoses(false));
  },
  beforeUnmount() {
    window.removeEventListener('resize', this.onResize);
    setHandBodiesOracle(undefined);
  },
  methods: {
    registerHandBody,
    visualOf(name: string): RevealVisual | undefined {
      return this.handRevealState.flightVisuals[name];
    },
    /** The body's mode as a DOM fact (probes and e2e read it — the module
     *  state is not reachable from a page context). Always present. */
    modeOf(name: string): string {
      return this.handBodiesState.modes[name] ?? 'docked';
    },
    onResize(): void {
      this.applyDockedPoses(false); // instant — resize snaps, like every fit engine
    },
    /** The pack's bottom-centre anchor, measured off the dock chassis. The
     *  anchor box is DELIBERATELY zero-width («cards centre themselves
     *  around this axis» — console.less), so the judge of measurability is
     *  its HEIGHT, and the axis is its left edge. */
    anchor(): PackAnchor | undefined {
      const box = document.querySelector<HTMLElement>('.con-handdock__pack');
      if (box === null) {
        return undefined;
      }
      const r = box.getBoundingClientRect();
      if (r.height < 2) {
        return undefined;
      }
      const remPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 20;
      const tune = packProfileTuning(this.layout.profile);
      return {ax: r.left + r.width / 2, ay: r.bottom, remPx, ...tune};
    },
    dockedPoseOf(name: string): {x: number, y: number, scale: number, rotation: number} | undefined {
      const a = this.anchor();
      if (a === undefined) {
        return undefined;
      }
      const i = this.cards.findIndex((c) => c.name === name);
      if (i === -1) {
        return undefined;
      }
      return dockedBodyPose(i, this.cards.length, this.pose as PackPose, a);
    },
    /** One COPY of `name`, claimed from the hand's end (0 = newest) — the
     *  intake director's landing target for duplicate-safe aiming. */
    dockedPoseOfCopy(name: string, seqFromEnd: number): {x: number, y: number, scale: number, rotation: number} | undefined {
      const a = this.anchor();
      if (a === undefined) {
        return undefined;
      }
      const indexes: Array<number> = [];
      this.cards.forEach((c, i) => {
        if (c.name === name) {
          indexes.push(i);
        }
      });
      const idx = indexes[indexes.length - 1 - seqFromEnd];
      if (idx === undefined) {
        return undefined;
      }
      return dockedBodyPose(idx, this.cards.length, this.pose as PackPose, a);
    },
    /**
     * Seat every DOCKED body on its analytic pose.
     *
     * Two animated languages, chosen by the CAUSE:
     *  - `ride` set (a pure pose flip — rest↔compact↔raised): the pair's own
     *    choreography from poseRideSpec. One duration + one ease for the
     *    whole pack (one object changing posture); the only per-card
     *    differentiation is the CENTRE-OUT stagger delay of the raised
     *    open. The duration is scaled to the travel actually REMAINING
     *    (rideDurationForRemainder), so a reversal caught mid-way continues
     *    from the current visual position at a natural speed — never a
     *    snap, never a full-budget crawl over 2px.
     *  - no `ride` (composition re-spread / episode-end reconcile): the
     *    legacy 340ms power2.out response — a reaction to an event (a card
     *    landed, a flight let go), not a posture change.
     *
     * A fresh body (no transform yet) always SEATS instantly and pops in
     * from the tray — never slides in from (0,0). Reduced motion: the poses
     * still apply (they carry meaning), only their travel stops.
     */
    applyDockedPoses(animate: boolean, ride?: {spec: PoseRide, from: PackPose}): void {
      const a = this.anchor();
      if (a === undefined) {
        // The dock chassis may mount a beat after this layer — retry on a
        // bounded TIMER ladder (never rAF: a fully idle headless compositor
        // withholds frames exactly at load, and an unseated pack must not
        // depend on one arriving).
        if (this.anchorRetries < 60) {
          this.anchorRetries++;
          window.setTimeout(() => this.applyDockedPoses(animate, ride), 60);
        }
        return;
      }
      this.anchorRetries = 0;
      const n = this.cards.length;
      const reduced = consoleReducedMotionActive();
      const mid = (n - 1) / 2;
      type Seat = {el: HTMLElement, flip: HTMLElement | null, pose: BodyPose, fresh: boolean, norm: number};
      const seats: Array<Seat> = [];
      let maxRemaining = 0;
      let maxCanonical = 0;
      this.cards.forEach((c, i) => {
        if (handBodyMode(c.name) !== 'docked') {
          return;
        }
        const el = handBodyEl(c.name);
        if (el === undefined) {
          return;
        }
        const pose = dockedBodyPose(i, n, this.pose as PackPose, a);
        const fresh = el.style.transform === '';
        if (!fresh && ride !== undefined) {
          // Current travel left: transform cache reads, no layout flush.
          const cx = Number(gsap.getProperty(el, 'x'));
          const cy = Number(gsap.getProperty(el, 'y'));
          maxRemaining = Math.max(maxRemaining, Math.hypot(pose.x - cx, pose.y - cy));
          const fromPose = dockedBodyPose(i, n, ride.from, a);
          maxCanonical = Math.max(maxCanonical, Math.hypot(pose.x - fromPose.x, pose.y - fromPose.y));
        }
        seats.push({
          el, pose, fresh,
          flip: el.querySelector<HTMLElement>('.con-deal-proxy__flip'),
          norm: mid === 0 ? 0 : Math.abs(i - mid) / mid,
        });
      });
      const baseMs = ride === undefined ? 340 :
        rideDurationForRemainder(ride.spec.durationMs, maxRemaining, maxCanonical);
      const durS = motionMs(baseMs) / 1000;
      const ease = ride === undefined ? 'power2.out' : ride.spec.ease;
      seats.forEach(({el, flip, pose, fresh, norm}) => {
        gsap.killTweensOf(el);
        // A DOCKED card rests in the chosen presentation («Рубашкой» /
        // «Лицом») — fresh seats state it, and re-poses self-heal any
        // residue an interrupted episode left (the close already turns
        // every card on approach, so this is normally a no-op).
        if (fresh || !animate || reduced) {
          gsap.set(el, {...pose, autoAlpha: 1});
          if (flip !== null) {
            gsap.set(flip, {rotationY: dockFaceRotation()});
          }
          if (fresh && animate && !reduced) {
            // The arrival pop: rise out of the tray (the old con-hd-enter).
            gsap.from(el, {y: `+=${1.15 * a.remPx}`, autoAlpha: 0, duration: motionMs(300) / 1000, ease: 'power2.out'});
          }
          return;
        }
        const delayS = ride === undefined ? 0 :
          motionMs(ride.spec.delayMs + norm * ride.spec.staggerMaxMs) / 1000;
        gsap.to(el, {...pose, autoAlpha: 1, duration: durS, ease, delay: delayS, overwrite: 'auto'});
        if (flip !== null) {
          gsap.to(flip, {rotationY: dockFaceRotation(), duration: durS, ease: 'power2.inOut', delay: delayS, overwrite: 'auto'});
        }
      });
    },
    /**
     * THE SILENT RETURN (handRevealDirector.settleHandHome). These bodies come
     * home from a place the player could NOT see — the album parked behind the
     * play stage — so there is nothing to fly FROM: each is SEATED on its dock
     * pose in one write (zero travel, faces already turned to the dock's
     * presentation) and the pack rises out of the tray, the same 300 ms pop a
     * card joining the hand has always had. Right→left, the close episode's
     * own LIFO order, so the fan re-forms along one growing edge instead of
     * inflating as a blob; the whole stagger is budget-capped, so a 25-card
     * hand takes no longer than a 6-card one.
     */
    resettleBodies(names: ReadonlyArray<string>): void {
      if (names.length === 0) {
        return;
      }
      const a = this.anchor();
      if (a === undefined) {
        // The dock chassis may not be measurable yet — the same bounded TIMER
        // ladder `applyDockedPoses` uses (never rAF: an idle headless
        // compositor withholds frames exactly at load).
        if (this.anchorRetries < 60) {
          this.anchorRetries++;
          window.setTimeout(() => this.resettleBodies(names), 60);
        }
        return;
      }
      this.anchorRetries = 0;
      const want = new Set(names);
      const n = this.cards.length;
      const seats: Array<{el: HTMLElement, pose: BodyPose}> = [];
      this.cards.forEach((c, i) => {
        const el = handBodyEl(c.name);
        if (el === undefined || !want.has(c.name) || handBodyMode(c.name) !== 'docked') {
          return;
        }
        seats.push({el, pose: dockedBodyPose(i, n, this.pose as PackPose, a)});
      });
      if (seats.length === 0) {
        return;
      }
      seats.sort((l, r) => r.pose.x - l.pose.x);
      const reduced = consoleReducedMotionActive();
      const spread = motionMs(Math.min(RESETTLE_SPREAD_MAX_MS, seats.length * 16)) / 1000;
      const step = seats.length <= 1 ? 0 : spread / (seats.length - 1);
      seats.forEach(({el, pose}, k) => {
        gsap.killTweensOf(el);
        gsap.set(el, {...pose, autoAlpha: 1});
        const flip = el.querySelector<HTMLElement>('.con-deal-proxy__flip');
        if (flip !== null) {
          gsap.set(flip, {rotationY: dockFaceRotation()});
        }
        if (reduced) {
          return;
        }
        // `from` renders its START values immediately (immediateRender), so the
        // seat above is never painted before the rise begins — no flash.
        gsap.from(el, {
          y: `+=${RESETTLE_RISE_REM * a.remPx}`, autoAlpha: 0,
          duration: motionMs(RESETTLE_RISE_MS) / 1000, ease: 'power2.out', delay: k * step,
        });
      });
    },
  },
});
</script>
