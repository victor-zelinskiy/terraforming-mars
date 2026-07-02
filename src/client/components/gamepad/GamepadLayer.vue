<template>
  <Teleport to="body">
    <GamepadFocusRing />
    <GamepadHintBar />

    <!-- Controller mapping legend (Menu button). Its OWN mini-scope: while
         open the layer swallows every intent except close (Menu/B). -->
    <div v-if="legendOpen && gamepadActive" class="gp-legend" role="dialog" :aria-label="$t('Controls')">
      <div class="gp-legend__backdrop" aria-hidden="true"></div>
      <div class="gp-legend__card">
        <div class="gp-legend__title">{{ $t('Controller mode') }}</div>
        <div class="gp-legend__grid">
          <div v-for="(row, i) in legendRows" :key="i" class="gp-legend__row">
            <GamepadGlyph :control="row.control" />
            <span class="gp-legend__label">{{ $t(row.label) }}</span>
          </div>
        </div>
        <div class="gp-legend__foot">
          <GamepadGlyph control="menu" /><span class="gp-legend__label">{{ $t('Close') }}</span>
        </div>
      </div>
    </div>

    <!-- Connect/disconnect toast -->
    <transition name="gp-toast">
      <div v-if="toast !== ''" class="gp-toast" aria-hidden="true">
        <GamepadGlyph control="menu" />
        <span>{{ toast }}</span>
      </div>
    </transition>

    <!-- ?gpDebug readout -->
    <div v-if="debug" class="gp-debug">
      <div>mode: {{ inputModeState.mode }} · pads: {{ inputModeState.padsConnected }} · pad: {{ gamepadCoreState.activeId || '—' }}</div>
      <div>scope: {{ focusState.scopeId || '—' }} · focus: {{ focusState.focusKind }}</div>
      <div>ring: {{ Math.round(focusState.ring.left) }},{{ Math.round(focusState.ring.top) }} {{ Math.round(focusState.ring.width) }}×{{ Math.round(focusState.ring.height) }} {{ focusState.ring.variant }}</div>
      <div v-for="(line, i) in intentLog" :key="i" class="gp-debug__intent">{{ line }}</div>
    </div>
  </Teleport>
</template>

<script lang="ts">
/**
 * App-level gamepad layer (GAMEPAD_SUPPORT_DESIGN.md §5/§6) — mounts next
 * to NotificationLayer in App.vue (survives everything; the game screen
 * gates it). Owns the subsystem lifecycle: installs the core, routes
 * intents into the focus engine, runs the 400 ms focus-validity tick while
 * in gamepad mode, clears synthetic residue on mode exit, and hosts the
 * ring + hint bar + Menu legend + connect toast + ?gpDebug readout.
 *
 * Fully inert (installGamepadCore no-ops) under `?gp=0` / the
 * `gamepad_enabled` preference — invariant 2.
 */
import {defineComponent} from 'vue';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {gamepadCoreState, installGamepadCore, onGamepadIntent, uninstallGamepadCore} from '@/client/gamepad/gamepadCore';
import {clearGamepadFocus, focusState, gamepadFocusTick, handleGamepadIntent} from '@/client/gamepad/focusEngine';
import {InputMode, inputModeState, onInputModeChange} from '@/client/gamepad/inputModeState';
import {gamepadDebug} from '@/client/gamepad/gamepadSettings';
import {GlyphControl} from '@/client/gamepad/glyphSets';
import {motionMs} from '@/client/components/motion/motionTokens';
import GamepadFocusRing from '@/client/components/gamepad/GamepadFocusRing.vue';
import GamepadHintBar from '@/client/components/gamepad/GamepadHintBar.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

const FOCUS_TICK_MS = 400;

type LegendRow = {control: GlyphControl, label: string};

const LEGEND_ROWS: ReadonlyArray<LegendRow> = [
  {control: 'dpad', label: 'Navigate'},
  {control: 'confirm', label: 'Select'},
  {control: 'back', label: 'Back / Close'},
  {control: 'secondary', label: 'Quick action'},
  {control: 'inspect', label: 'Zoom card'},
  {control: 'bumperL', label: 'Previous panel'},
  {control: 'bumperR', label: 'Next panel'},
  {control: 'triggerL', label: 'Adjust −5'},
  {control: 'triggerR', label: 'Adjust +5'},
  {control: 'stickScroll', label: 'Scroll'},
  {control: 'stickL', label: 'Board / interface'},
  {control: 'view', label: 'Log'},
];

export default defineComponent({
  name: 'GamepadLayer',
  components: {GamepadFocusRing, GamepadHintBar, GamepadGlyph},
  data() {
    return {
      inputModeState,
      gamepadCoreState,
      focusState,
      legendOpen: false,
      toast: '',
      toastTimer: undefined as number | undefined,
      intentLog: [] as Array<string>,
      offIntent: undefined as (() => void) | undefined,
      offMode: undefined as (() => void) | undefined,
      tickTimer: undefined as number | undefined,
      lastPadsSeen: 0,
    };
  },
  computed: {
    debug(): boolean {
      return gamepadDebug();
    },
    gamepadActive(): boolean {
      return this.inputModeState.mode === 'gamepad';
    },
    legendRows(): ReadonlyArray<LegendRow> {
      return LEGEND_ROWS;
    },
  },
  watch: {
    'inputModeState.padsConnected'(now: number, before: number) {
      // Connect/disconnect toast — the W3C lifecycle made visible.
      this.showToast(this.$t(now > before ? 'Controller connected' : 'Controller disconnected'));
    },
  },
  methods: {
    onIntent(intent: GamepadIntent): void {
      if (this.debug) {
        const line = intent.kind === 'press' || intent.kind === 'release' ?
          `${intent.kind}:${intent.button}` :
          intent.kind === 'nav' ? `nav:${intent.dir}${intent.repeat ? ' (r)' : ''}` : 'scroll';
        this.intentLog = [line, ...this.intentLog].slice(0, 5);
      }
      // The legend is a layer-owned mini-scope: swallow everything but close.
      if (this.legendOpen) {
        if (intent.kind === 'press' && (intent.button === 'menu' || intent.button === 'back' || intent.button === 'confirm')) {
          this.legendOpen = false;
        }
        return;
      }
      if (intent.kind === 'press' && intent.button === 'menu') {
        this.legendOpen = true;
        return;
      }
      handleGamepadIntent(intent);
    },
    onModeChange(mode: InputMode): void {
      if (mode === 'gamepad') {
        this.startTick();
        gamepadFocusTick();
      } else {
        this.stopTick();
        this.legendOpen = false;
        clearGamepadFocus();
      }
    },
    startTick(): void {
      if (this.tickTimer !== undefined) {
        return;
      }
      this.tickTimer = window.setInterval(() => gamepadFocusTick(), FOCUS_TICK_MS);
    },
    stopTick(): void {
      if (this.tickTimer !== undefined) {
        window.clearInterval(this.tickTimer);
        this.tickTimer = undefined;
      }
    },
    showToast(text: string): void {
      this.toast = text;
      if (this.toastTimer !== undefined) {
        window.clearTimeout(this.toastTimer);
      }
      this.toastTimer = window.setTimeout(() => {
        this.toast = '';
      }, motionMs(2600));
    },
  },
  mounted() {
    installGamepadCore();
    this.offIntent = onGamepadIntent((intent) => this.onIntent(intent));
    this.offMode = onInputModeChange((mode) => this.onModeChange(mode));
    if (this.gamepadActive) {
      this.startTick();
    }
  },
  beforeUnmount() {
    this.offIntent?.();
    this.offMode?.();
    this.stopTick();
    if (this.toastTimer !== undefined) {
      window.clearTimeout(this.toastTimer);
    }
    clearGamepadFocus();
    uninstallGamepadCore();
  },
});
</script>
