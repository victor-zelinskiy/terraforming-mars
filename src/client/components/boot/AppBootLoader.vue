<template>
  <div class="boot-loader" role="status" :aria-label="$t('Preparing the game')">
    <!--
      HIDDEN WARM-UP SCENE. Sits BEHIND the opaque loader panel (low opacity) so
      the player never sees it, but it genuinely RENDERS on the GPU. The KEY part
      is the REAL cards: the first corporation / prelude deal in a game lagged
      because Skia Graphite compiled the card render pipelines (premium `.pcard`
      drop-shadow + box-shadow + gradients + art, legacy corp face) + the
      card-deal-in animation ON FIRST USE. Rendering the real `<Card>` faces here
      (one per type: corporation-legacy + automated/active/event/prelude-premium)
      + running the SAME card-deal-in keyframe compiles those exact pipelines up
      front. A couple of abstract cells cover overlay-only effects (backdrop
      blur) that no card carries. Must genuinely paint → low opacity +
      animation (a composited animating layer rasterizes even while occluded),
      NOT display:none.
    -->
    <div class="boot-loader__warm" aria-hidden="true">
      <div class="boot-loader__warm-cards">
        <div v-for="(c, i) in warmCards" :key="c.name"
             class="boot-loader__warm-card"
             :style="{animationDelay: (i * 38) + 'ms'}">
          <Card :card="c" />
        </div>
      </div>
      <!-- Overlay-only effects no card carries (backdrop-filter + heavy blur + glow). -->
      <div class="boot-warm-cell boot-warm-cell--backdrop"></div>
      <div class="boot-warm-cell boot-warm-cell--blur"></div>
      <div class="boot-warm-cell boot-warm-cell--glow"></div>
    </div>

    <!-- Layered premium scene: deep space → mars glow → grid → vignette. -->
    <div class="boot-loader__bg" aria-hidden="true"></div>
    <div class="boot-loader__glow" aria-hidden="true"></div>
    <div class="boot-loader__grid" aria-hidden="true"></div>
    <div class="boot-loader__vignette" aria-hidden="true"></div>

    <div class="boot-loader__panel">
      <span class="boot-loader__corner boot-loader__corner--tl" aria-hidden="true"></span>
      <span class="boot-loader__corner boot-loader__corner--tr" aria-hidden="true"></span>
      <span class="boot-loader__corner boot-loader__corner--bl" aria-hidden="true"></span>
      <span class="boot-loader__corner boot-loader__corner--br" aria-hidden="true"></span>

      <!-- Orbital scanner — a calm sweep, not an aggressive spinner. -->
      <div class="boot-loader__scanner" aria-hidden="true">
        <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle class="boot-loader__orbit boot-loader__orbit--outer" cx="60" cy="60" r="52" />
          <circle class="boot-loader__orbit boot-loader__orbit--mid" cx="60" cy="60" r="38" />
          <circle class="boot-loader__core" cx="60" cy="60" r="17" />
          <g class="boot-loader__sweep">
            <circle class="boot-loader__satellite" cx="60" cy="8" r="4" />
          </g>
        </svg>
      </div>

      <div class="boot-loader__title">TERRAFORMING MARS</div>

      <transition name="boot-stage-swap" mode="out-in">
        <div class="boot-loader__stage" :key="phase">{{ $t(stageText) }}</div>
      </transition>

      <div class="boot-loader__progress" aria-hidden="true">
        <span class="boot-loader__progress-fill" :style="{width: progress + '%'}"></span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * APP BOOT LOADER — premium app-launch screen + GPU shader warm-up.
 * Shown once per session (see bootWarmupState). Renders the REAL card faces
 * (see the template comment) so Graphite compiles the card + deal-animation
 * pipelines up front, killing the first-deal hitch. Walks a few phases, then
 * finishes and fades out. Purely presentational — does not block route/data
 * loading (the real screen loads underneath and is revealed on fade-out).
 */
import {defineComponent} from 'vue';
import Card from '@/client/components/card/CardFace.vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {getCardOrThrow} from '@/client/cards/ClientCardManifest';
import {cardArtUrl} from '@/client/cards/cardArt';
import {finishBootWarmup} from '@/client/components/boot/bootWarmupState';
import {motionMs} from '@/client/components/motion/motionTokens';

// English text = i18n key (fork convention). Kept short; one per warm-up phase.
const STAGES = [
  'Initializing renderer…',
  'Warming up shaders…',
  'Preparing animations…',
  'Almost ready…',
] as const;

// One card per render path: corporation (legacy face) + automated/active/event/
// prelude (premium `.pcard`). These are the exact pipelines the first corp/
// prelude deal compiles. All base-set, guaranteed to exist in the manifest.
const WARMUP_CARDS: ReadonlyArray<CardName> = [
  CardName.ECOLINE, // corporation → legacy face
  CardName.THARSIS_REPUBLIC, // corporation → legacy face (2nd, corp deal has several)
  CardName.TREES, // automated → premium emerald
  CardName.PREDATORS, // active → premium azure
  CardName.COMET, // event → premium crimson
  CardName.DONATION, // prelude → premium prelude
];

function modelOf(name: CardName): CardModel {
  return {name, calculatedCost: getCardOrThrow(name).cost};
}

export default defineComponent({
  name: 'AppBootLoader',
  components: {Card},
  data() {
    return {
      // Built in data() so the cards render from the FIRST loader frame (warm-up
      // starts immediately, behind the panel).
      warmCards: WARMUP_CARDS.map(modelOf),
      phase: 0,
      progress: 8,
      timer: undefined as number | undefined,
    };
  },
  computed: {
    stageText(): string {
      return STAGES[Math.min(this.phase, STAGES.length - 1)];
    },
  },
  mounted() {
    // Nudge the card art (webp) into the browser cache so the first REAL deal
    // doesn't pay the image decode either (harmless if already cached / missing).
    for (const name of WARMUP_CARDS) {
      const url = cardArtUrl(name);
      if (url !== undefined) {
        const img = new Image();
        img.src = url;
      }
    }
    const reduced = typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    // Each phase gives Graphite time to compile that phase's pipelines. Reduced
    // motion shortens the hold but still runs the phases (pipelines still need
    // compiling — this is not decoration).
    const perPhase = motionMs(reduced ? 340 : 900);
    this.step(perPhase);
  },
  beforeUnmount() {
    if (this.timer !== undefined) {
      window.clearTimeout(this.timer);
    }
  },
  methods: {
    step(perPhase: number): void {
      this.progress = Math.round(((this.phase + 1) / STAGES.length) * 100);
      if (this.phase >= STAGES.length - 1) {
        // Last phase: hold briefly at 100%, then finish + let the fade play.
        this.timer = window.setTimeout(() => finishBootWarmup(), perPhase);
        return;
      }
      this.timer = window.setTimeout(() => {
        this.phase += 1;
        this.step(perPhase);
      }, perPhase);
    },
  },
});
</script>
