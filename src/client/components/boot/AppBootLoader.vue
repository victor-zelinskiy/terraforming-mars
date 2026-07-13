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
      <div v-if="warmReady" class="boot-loader__warm-cards">
        <div v-for="(c, i) in warmCards" :key="c.name"
             class="boot-loader__warm-card"
             :class="warmCardStateClass(i)"
             :style="{animationDelay: (i * 38) + 'ms'}">
          <Card :card="c" />
        </div>
      </div>
      <!-- GAME-UI warm-up: the board elements repeated every game — board
           spaces WITH tiles (ocean/city/greenery sprites + hex clip-path),
           player cubes (SVG gradient/3D/shadow), and the global-parameter arc
           scales (SVG paths + gradients). Same pipelines the first game-entry
           compiles. Isolated components (not the full Board) to avoid a fragile
           full mock; errorCaptured() below keeps a warm-up failure from ever
           crashing the app. -->
      <div v-if="warmReady" class="boot-loader__warm-game">
        <board-space v-for="s in warmSpaces" :key="s.id"
                     :space="s" tileView="show" :aresExtension="false" />
        <player-cube v-for="c in warmCubes" :key="c" :color="c" :size="21" />
        <arc-scale v-for="a in warmScales" :key="a.key"
                   :theme="a.theme" :config="a.config" :value="a.value" />
      </div>

      <!-- Overlay-only effects no card carries (backdrop-filter at both modal
           radii + heavy blur + glow). -->
      <div class="boot-warm-cell boot-warm-cell--backdrop"></div>
      <div class="boot-warm-cell boot-warm-cell--backdrop2"></div>
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
import BoardSpace from '@/client/components/BoardSpace.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import ArcScale from '@/client/components/board/ArcScale.vue';
import {ARC_SCALE_THEMES} from '@/client/components/board/arcScaleTheme';
import {OXYGEN_ARC, TEMPERATURE_ARC, VENUS_ARC} from '@/client/components/board/arcScaleConfigs';
import {SpaceModel} from '@/common/models/SpaceModel';
import {SpaceType} from '@/common/boards/SpaceType';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {TileType} from '@/common/TileType';
import {Color} from '@/common/Color';

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

function modelOf(name: CardName): CardModel | undefined {
  try {
    return {name, calculatedCost: getCardOrThrow(name).cost};
  } catch {
    return undefined; // a renamed/out-of-scope card must never break the loader
  }
}

// GAME-UI warm-up data. A few representative board spaces (ocean/city/greenery
// tiles + a cube), cubes of several colours, and the arc scales — enough to
// compile every board pipeline (tile sprite, hex clip-path, cube SVG, scale SVG);
// the pipeline depends on the KIND, not the count. `id` must match SpaceId's
// two-digit shape; these ids are warm-up-only (isolated components, not a game).
const WARM_SPACES: ReadonlyArray<SpaceModel> = [
  {id: '61', x: 0, y: 0, spaceType: SpaceType.LAND, bonus: [SpaceBonus.PLANT, SpaceBonus.STEEL]},
  {id: '62', x: 0, y: 0, spaceType: SpaceType.OCEAN, bonus: [], tileType: TileType.OCEAN},
  {id: '63', x: 0, y: 0, spaceType: SpaceType.LAND, bonus: [], tileType: TileType.CITY, color: 'blue'},
  {id: '64', x: 0, y: 0, spaceType: SpaceType.LAND, bonus: [], tileType: TileType.GREENERY, color: 'green'},
  {id: '65', x: 0, y: 0, spaceType: SpaceType.LAND, bonus: [SpaceBonus.TITANIUM, SpaceBonus.DRAW_CARD]},
];
const WARM_CUBES: ReadonlyArray<Color> = ['red', 'green', 'blue', 'yellow', 'black'];
const WARM_SCALES = [
  {key: 'oxygen', theme: ARC_SCALE_THEMES.oxygen, config: OXYGEN_ARC, value: 0},
  {key: 'temperature', theme: ARC_SCALE_THEMES.temperature, config: TEMPERATURE_ARC, value: -30},
  {key: 'venus', theme: ARC_SCALE_THEMES.venus, config: VENUS_ARC, value: 0},
];

export default defineComponent({
  name: 'AppBootLoader',
  components: {Card, BoardSpace, PlayerCube, ArcScale},
  data() {
    return {
      // Built in data() so the cards render from the FIRST loader frame (warm-up
      // starts immediately, behind the panel).
      warmCards: WARMUP_CARDS.map(modelOf).filter((c): c is CardModel => c !== undefined),
      warmSpaces: WARM_SPACES,
      warmCubes: WARM_CUBES,
      warmScales: WARM_SCALES,
      // The warm-up elements render ONLY once GPU compositing is live (see mounted)
      // so their pipelines compile on Graphite, not the software path during init.
      warmReady: false,
      phase: 0,
      progress: 8,
      timer: undefined as number | undefined,
      readyFallback: undefined as number | undefined,
      gpuReadyHandler: undefined as (() => void) | undefined,
    };
  },
  computed: {
    stageText(): string {
      return STAGES[Math.min(this.phase, STAGES.length - 1)];
    },
  },
  methods: {
    // Warm the two extra render states a real deal hits: the selected halo/rim
    // and the unplayable grayscale — otherwise their pipelines compile on the
    // first pick / first unplayable card.
    warmCardStateClass(i: number): string {
      if (i === 0) {
        return 'boot-loader__warm-card--selected';
      }
      if (i === 1) {
        return 'boot-loader__warm-card--disabled';
      }
      return '';
    },
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
    // motion shortens the hold but still runs the phases (not decoration).
    const perPhase = motionMs(reduced ? 340 : 900);
    // START the phases ONLY once GPU compositing is live, so (a) the cards render
    // on Graphite (not the software path during the ~330ms GPU-process init — else
    // the pipelines compile on software and the real deal recompiles them, the
    // residual hitch), and (b) the full warm-up hold happens AFTER the cards mount.
    // main signals `tm-gpu-ready`; fall back after 1.4s if it never arrives.
    const start = (): void => {
      if (this.warmReady) {
        return; // guard: event + fallback must not both start it
      }
      this.warmReady = true;
      this.step(perPhase);
    };
    const w = window as {__tmGpuReady?: boolean};
    if (w.__tmGpuReady === true) {
      start();
    } else {
      this.gpuReadyHandler = start;
      window.addEventListener('tm-gpu-ready', start, {once: true});
      this.readyFallback = window.setTimeout(start, 1400);
    }
  },
  beforeUnmount() {
    if (this.timer !== undefined) {
      window.clearTimeout(this.timer);
    }
    if (this.readyFallback !== undefined) {
      window.clearTimeout(this.readyFallback);
    }
    if (this.gpuReadyHandler !== undefined) {
      window.removeEventListener('tm-gpu-ready', this.gpuReadyHandler);
    }
  },
  errorCaptured(): boolean {
    // A warm-up render failure (an isolated board component missing some game
    // context it normally gets from a live game) must NEVER crash the app —
    // swallow it here. The pipeline it would have warmed just compiles at first
    // real use instead. The loader itself keeps running.
    return false;
  },
});
</script>
