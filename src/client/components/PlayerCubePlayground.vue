<template>
  <!--
    Dev-only QA page (?cubePlayground) for the premium PlayerCube.
    Lets you eyeball every colour at every size, on representative board
    backgrounds, with the colour-blind glyph / glow / shadow toggles, the
    placement animation, and a side-by-side comparison against the legacy
    `board_icons.png` sprite cube — BEFORE rolling PlayerCube out across the
    ~10 consumer sites.
  -->
  <div class="cube-playground" :class="{'cube-playground--embedded': embedded}">
    <div class="cube-playground__bar">
      <span class="cube-playground__title">Player cube — playground</span>
      <button class="cube-playground__btn" :class="{'cube-playground__btn--active': overlaySymbol}" @click="overlaySymbol = !overlaySymbol">Symbols: {{ overlaySymbol ? 'on' : 'off' }}</button>
      <button class="cube-playground__btn" :class="{'cube-playground__btn--active': glow}" @click="glow = !glow">Glow: {{ glow ? 'on' : 'off' }}</button>
      <button class="cube-playground__btn" :class="{'cube-playground__btn--active': shadow}" @click="shadow = !shadow">Shadow: {{ shadow ? 'on' : 'off' }}</button>
      <button class="cube-playground__btn" @click="replay">▶ Replay placement</button>
    </div>

    <div class="cube-playground__section-head">All colours — on representative surfaces</div>
    <div class="cube-playground__surfaces">
      <div v-for="s in surfaces" :key="s.key" class="cube-playground__surface" :class="'cube-playground__surface--' + s.key">
        <div class="cube-playground__surface-label">{{ s.label }}</div>
        <div class="cube-playground__row">
          <div v-for="c in colors" :key="c" class="cube-playground__swatch">
            <player-cube
              :key="c + '-' + animKey"
              :color="c"
              :size="34"
              :glow="glow"
              :shadow="shadow"
              :overlay-symbol="overlaySymbol"
              :animate-in="animateIn" />
            <span class="cube-playground__swatch-name">{{ c }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="cube-playground__section-head">Scale — same colour at every in-game size</div>
    <div class="cube-playground__surface cube-playground__surface--panel">
      <div class="cube-playground__sizes">
        <div v-for="sz in sizes" :key="sz" class="cube-playground__size">
          <player-cube
            :key="'sz-' + sz + '-' + animKey"
            :color="scaleColor"
            :size="sz"
            :glow="glow"
            :shadow="shadow"
            :overlay-symbol="overlaySymbol"
            :animate-in="animateIn" />
          <span>{{ sz }}px</span>
        </div>
      </div>
      <div class="cube-playground__bar" style="margin-top: 16px;">
        <button v-for="c in colors" :key="'pick-' + c"
                class="cube-playground__btn"
                :class="{'cube-playground__btn--active': scaleColor === c}"
                @click="scaleColor = c">{{ c }}</button>
      </div>
    </div>

    <!-- THE DELEGATE FIGURE (the Parliament's piece): every colour + the neutral steel at the hall's three sizes
         (18 · 24 · 28 logical px — the floor, the ribbon / chair, Information), on the hall's own glass; beside
         each, the CUBE of the same player — one palette, the same RGB; and the card's printed mark. The probe
         `console-player-token-parity` reads this section. -->
    <div class="cube-playground__section-head">Delegate figures — the Parliament's piece</div>
    <div class="cube-playground__surface cube-playground__surface--panel" data-token-stand="figures">
      <div v-for="h in figureSizes" :key="'fig-' + h" class="cube-playground__row" style="margin-bottom: 18px;" :data-token-row="h">
        <div v-for="c in tokenColors" :key="'fig-' + h + c" class="cube-playground__swatch" :data-token-pair="c">
          <span style="display: inline-flex; align-items: flex-end; gap: 10px;">
            <player-delegate :color="c" :steel="c === 'neutral'" :size="figurePx(h)" :glow="glow" :shadow="shadow" :overlay-symbol="overlaySymbol" :animate-in="animateIn" :key="'fd-' + h + c + animKey" />
            <player-cube v-if="h === 24" :color="c" :steel="c === 'neutral'" :size="figurePx(15)" :glow="glow" :shadow="shadow" :overlay-symbol="overlaySymbol" />
          </span>
          <span class="cube-playground__swatch-name">{{ c === 'neutral' ? 'steel' : c }} · {{ h }}</span>
        </div>
      </div>
      <div class="cube-playground__row" data-token-row="print">
        <div class="cube-playground__swatch"><i class="resource_icon resource_icon--delegate" style="display: inline-block; width: 40px; height: 52px;" data-token-print="player"></i><span class="cube-playground__swatch-name">print</span></div>
        <div class="cube-playground__swatch"><i class="resource_icon resource_icon--neutral-delegate" style="display: inline-block; width: 40px; height: 52px;" data-token-print="neutral"></i><span class="cube-playground__swatch-name">print · neutral</span></div>
      </div>
    </div>

    <div class="cube-playground__section-head">New vs legacy sprite (at ~21px)</div>
    <div class="cube-playground__surface cube-playground__surface--panel">
      <div v-for="c in colors" :key="'cmp-' + c" class="cube-playground__compare" style="margin-bottom: 14px;">
        <span class="cube-playground__swatch-name" style="min-width: 64px;">{{ c }}</span>
        <div class="cube-playground__compare-col">
          <player-cube :color="c" :size="21" :glow="glow" :shadow="shadow" :overlay-symbol="overlaySymbol" />
          <span>new</span>
        </div>
        <div class="cube-playground__compare-col">
          <span class="board-cube" :class="'board-cube--' + c"></span>
          <span>legacy</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import PlayerCube from '@/client/components/PlayerCube.vue';
import PlayerDelegate from '@/client/components/playerToken/PlayerDelegate.vue';
import {delegateFigurePx} from '@/client/components/playerToken/delegateFigureSize';
import {conLogicalPx} from '@/client/console/consoleLayoutProfile';

const COLORS: ReadonlyArray<Color> = ['red', 'green', 'yellow', 'blue', 'black', 'purple', 'orange', 'pink', 'bronze'];
/** The delegate stand: the eight player colours and the neutral delegate's steel. */
const TOKEN_COLORS: ReadonlyArray<Color> = ['red', 'green', 'yellow', 'blue', 'black', 'purple', 'orange', 'pink', 'neutral'];

export default defineComponent({
  name: 'PlayerCubePlayground',
  components: {
    'player-cube': PlayerCube,
    'player-delegate': PlayerDelegate,
  },
  props: {
    /** Hosted in the console playground stand — the host owns fullscreen + scroll. */
    embedded: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  data() {
    return {
      overlaySymbol: false,
      glow: true,
      shadow: true,
      animateIn: false,
      animKey: 0,
      scaleColor: 'blue' as Color,
      sizes: [14, 18, 21, 28, 40, 64],
      figureSizes: [18, 24, 28],
      surfaces: [
        {key: 'dark', label: 'Dark board panel'},
        {key: 'mars', label: 'Mars tile (warm)'},
        {key: 'light', label: 'Light surface'},
        {key: 'panel', label: 'Glass HUD'},
      ],
    };
  },
  computed: {
    colors(): ReadonlyArray<Color> {
      return COLORS;
    },
    tokenColors(): ReadonlyArray<Color> {
      return TOKEN_COLORS;
    },
  },
  methods: {
    /** A figure's height at the hall's scale (the floor enforced) — a cube beside it at the logical size it is given. */
    figurePx(logical: number): number {
      return logical >= 18 ? delegateFigurePx(logical) : conLogicalPx(logical);
    },
    // Force a remount (animKey) with animateIn on, so the placement keyframe
    // replays for every cube; then drop the flag back.
    replay(): void {
      this.animateIn = true;
      this.animKey++;
      window.setTimeout(() => {
        this.animateIn = false;
      }, 700);
    },
  },
});
</script>
