<template>
  <!--
    THE CARD PLAY WORKSPACE LANDING STAGE — the embedded «Разыграно» the play
    composer's right zone becomes after the commit (played-hero host
    'workspace'). This is SCENERY of the hero transaction, not a new surface:

     - the tableau is the SAME ConsolePlayedOverlay every host uses, in
       embedded + headless dress (the workspace breadcrumb already says
       «… › РАЗЫГРАНО» — the table must not title itself);
     - it renders the +1 layout from the first frame (synthetic incoming →
       reserved hidden top slot), registers the hero target measurer, and the
       transaction flies the ONE persistent proxy into it;
     - this component owns only the stage choreography around that: the
       REVEAL cascade when the stage engages (families surface in reading
       order while the card lifts — the receiving family materializes IN
       PLACE, so the landing rect never moves under an approaching card), and
       the STACK SETTLE after the commit handoff (the pile takes the card's
       weight — a 2–3 px damped press, strictly after the proxy has dissolved
       into the real slot, so the two can never double-vision).

    Read-only and input-inert: the transaction gates the pad; nothing here
    ever submits or handles intents.
  -->
  <div class="con-landing" aria-hidden="true">
    <ConsolePlayedOverlay embedded headless
                          :players="playerView.players"
                          :thisPlayerColor="playerView.thisPlayer.color"
                          :forcedColor="playerView.thisPlayer.color"
                          :automa="playerView.game.automa"
                          :heroIncoming="incoming"
                          :heroRevealed="heroState.revealed"
                          :heroActive="presenting" />
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {gsap} from 'gsap';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {playedHeroState, playedHeroLandingUp, playedHeroIncomingCard} from '@/client/console/played/consolePlayedHero';
import ConsolePlayedOverlay from '@/client/components/console/played/ConsolePlayedOverlay.vue';

/** The families' materialize (ms @ motion scale 1) — rides the hero lift. */
const CASCADE_MS = 190;
const CASCADE_STAGGER_S = 0.035;
/** The pile's weight response at the handoff: press depth (px @ uiScale 1). */
const SETTLE_PX = 2.5;

export default defineComponent({
  name: 'ConsolePlayedLandingStage',
  components: {ConsolePlayedOverlay},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  },
  data() {
    return {
      heroState: playedHeroState,
      /** One-shot latches per transaction nonce (a re-entry never replays). */
      cascadeRan: false,
      settleRan: false,
    };
  },
  computed: {
    /** The stage is PRESENTING (holding window of the workspace host). */
    presenting(): boolean {
      return playedHeroLandingUp();
    },
    /** The card the tableau reserves its top slot for (shared derivation). */
    incoming(): CardModel | undefined {
      return playedHeroIncomingCard() as CardModel | undefined;
    },
  },
  watch: {
    /** The stage engaged (the commit's CONTEXT RESOLVE): the tableau surfaces
     *  from inside the zone the review just released — families in reading
     *  order, the RECEIVING one strictly in place (its geometry is the
     *  flight's destination and may not move). */
    presenting(now: boolean) {
      if (now && !this.cascadeRan) {
        this.cascadeRan = true;
        void this.$nextTick(() => this.runCascade());
      }
    },
    /** The handoff completed (proxy dissolved into the real top card): the
     *  pile takes the card's WEIGHT — a microscopic damped press. Strictly on
     *  'showing-result' (after disposeHeroProxy), never on the reveal itself,
     *  so the settling pile can never drag the real card out from under the
     *  still-dissolving proxy. */
    'heroState.phase'(phase: string) {
      if (phase === 'showing-result' && this.presenting && !this.settleRan) {
        this.settleRan = true;
        this.runStackSettle();
      }
    },
    /** A fresh transaction re-arms the one-shots (collapse/reopen safety). */
    'heroState.nonce'() {
      this.cascadeRan = false;
      this.settleRan = false;
    },
  },
  beforeUnmount() {
    const root = this.$el as HTMLElement | undefined;
    if (root !== undefined && typeof root.querySelectorAll === 'function') {
      gsap.killTweensOf(root.querySelectorAll('.con-played__family, .con-played__pile, .con-played__backstack'));
    }
  },
  methods: {
    familyEls(): Array<HTMLElement> {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || typeof root.querySelectorAll !== 'function') {
        return [];
      }
      return Array.from(root.querySelectorAll<HTMLElement>('.con-played__family'));
    },
    runCascade(): void {
      const families = this.familyEls();
      if (families.length === 0 || consoleReducedMotionActive()) {
        return; // reduced motion / no zones: the layer's own visibility flip is the whole entrance
      }
      const receiving = families.filter((el) => el.classList.contains('con-played__family--receiving'));
      const rest = families.filter((el) => !el.classList.contains('con-played__family--receiving'));
      const dur = motionMs(CASCADE_MS) / 1000;
      if (rest.length > 0) {
        gsap.fromTo(rest,
          {autoAlpha: 0, y: 9 * conUiScale()},
          {autoAlpha: 1, y: 0, duration: dur, ease: 'expo.out', stagger: CASCADE_STAGGER_S, clearProps: 'transform,opacity,visibility'});
      }
      // The DESTINATION materializes IN PLACE — no translate: its reserved
      // top rect is what the hero measures, and the measure's stability loop
      // must find it still as early as possible.
      if (receiving.length > 0) {
        gsap.fromTo(receiving,
          {autoAlpha: 0},
          {autoAlpha: 1, duration: dur, ease: 'power1.out', clearProps: 'opacity,visibility'});
      }
    },
    /** The receiving pile of the just-committed card (face pile or the
     *  face-down events backstack), located by the same slot identity every
     *  flight in this project measures. */
    receivingPileEl(): HTMLElement | undefined {
      const root = this.$el as HTMLElement | undefined;
      const name = this.heroState.card;
      if (root === undefined || name === undefined || typeof root.querySelector !== 'function') {
        return undefined;
      }
      if (this.heroState.isEvent) {
        return root.querySelector<HTMLElement>('.con-played__family--event .con-played__backstack') ?? undefined;
      }
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ?
        CSS.escape(name) : name.replace(/"/g, '\\"');
      const slot = root.querySelector<HTMLElement>(`[data-played-key="${esc}"]`);
      return slot?.closest<HTMLElement>('.con-played__pile') ?? undefined;
    },
    runStackSettle(): void {
      if (consoleReducedMotionActive()) {
        return;
      }
      const pile = this.receivingPileEl();
      if (pile === undefined) {
        return;
      }
      const press = Math.max(2, Math.round(SETTLE_PX * conUiScale()));
      gsap.timeline()
        .to(pile, {y: press, duration: 0.07, ease: 'power1.out'})
        .to(pile, {y: 0, duration: 0.16, ease: 'power2.out', clearProps: 'transform'});
    },
  },
});
</script>
