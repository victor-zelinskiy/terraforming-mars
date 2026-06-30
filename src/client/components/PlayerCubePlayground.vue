<template>
  <!--
    Dev-only QA page (?cubePlayground) for the premium PlayerCube.
    Lets you eyeball every colour at every size, on representative board
    backgrounds, with the colour-blind glyph / glow / shadow toggles, the
    placement animation, and a side-by-side comparison against the legacy
    `board_icons.png` sprite cube — BEFORE rolling PlayerCube out across the
    ~10 consumer sites.
  -->
  <div class="cube-playground">
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

const COLORS: ReadonlyArray<Color> = ['red', 'green', 'yellow', 'blue', 'black', 'purple', 'orange', 'pink', 'bronze'];

export default defineComponent({
  name: 'PlayerCubePlayground',
  components: {
    'player-cube': PlayerCube,
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
  },
  methods: {
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
