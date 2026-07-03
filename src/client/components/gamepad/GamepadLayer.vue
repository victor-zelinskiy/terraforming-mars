<template>
  <Teleport to="body">
    <GamepadFocusRing />
    <!-- The iteration-1 hint bar serves desktop gamepad mode AND the console
         lifecycle screens where the ConsoleShell command bar isn't mounted
         (main menu / create / join / lobby — fallback-engine-driven). -->
    <GamepadHintBar v-if="!consoleModeState.enabled || !consoleState.shellMounted" />
    <ConsoleEntryPrompt v-if="consoleModeState.entryPromptVisible && !consoleModeState.enabled" />

    <!-- The console SYSTEM overlay (Menu button): Controls / Exit to menu. -->
    <transition name="con-layer">
      <ConsoleSystemMenu v-if="systemMenuOpen && consoleModeState.enabled"
                         :index="systemMenuIndex"
                         :confirmExit="systemMenuConfirmExit"
                         :inGame="screen === 'player-home'" />
    </transition>

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
      <div v-if="leakDetectorState.stranded !== undefined" class="gp-debug__leak">⚠ STRANDED: {{ leakDetectorState.stranded.inputType }} → {{ leakDetectorState.stranded.taskKind }}</div>
      <div v-if="leakDetectorState.desktopSurfaces.length > 0" class="gp-debug__leak">desktop surfaces: {{ leakDetectorState.desktopSurfaces.join(', ') }}</div>
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
import ConsoleEntryPrompt from '@/client/components/console/ConsoleEntryPrompt.vue';
import ConsoleSystemMenu, {SYSTEM_MENU_ITEMS} from '@/client/components/console/ConsoleSystemMenu.vue';
import {consoleModeState, dismissConsoleOffer, maybeOfferConsoleMode, requestConsoleFullscreen, setConsoleMode} from '@/client/console/consoleModeState';
import {consoleState, dispatchConsoleIntent, stepIndex} from '@/client/console/consoleRouter';
import {leakDetectorState} from '@/client/console/consoleLeakDetector';

const FOCUS_TICK_MS = 400;
/** Holding Menu this long toggles console ↔ desktop mode. */
const MENU_HOLD_MS = 650;

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

/** The console-mode mapping (CONSOLE_MODE_CONCEPT.md §11). */
const CONSOLE_LEGEND_ROWS: ReadonlyArray<LegendRow> = [
  {control: 'dpad', label: 'Navigate'},
  {control: 'confirm', label: 'Select'},
  {control: 'back', label: 'Back / Close'},
  {control: 'inspect', label: 'Turn menu'},
  {control: 'bumperL', label: 'Previous panel'},
  {control: 'bumperR', label: 'Next panel'},
  {control: 'triggerR', label: 'Next playable'},
  {control: 'triggerL', label: 'Inspect all cells'},
  {control: 'view', label: 'Log'},
  {control: 'menu', label: 'Hold: switch interface mode'},
];

export default defineComponent({
  name: 'GamepadLayer',
  components: {GamepadFocusRing, GamepadHintBar, GamepadGlyph, ConsoleEntryPrompt, ConsoleSystemMenu},
  props: {
    /** The App screen — drives lifecycle context (system menu labels, hints). */
    screen: {type: String, default: ''},
  },
  data() {
    return {
      inputModeState,
      gamepadCoreState,
      focusState,
      consoleModeState,
      consoleState,
      leakDetectorState,
      systemMenuOpen: false,
      systemMenuIndex: 0,
      systemMenuConfirmExit: false,
      legendOpen: false,
      toast: '',
      toastTimer: undefined as number | undefined,
      intentLog: [] as Array<string>,
      offIntent: undefined as (() => void) | undefined,
      offMode: undefined as (() => void) | undefined,
      tickTimer: undefined as number | undefined,
      lastPadsSeen: 0,
      menuPressedAt: undefined as number | undefined,
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
      return this.consoleModeState.enabled ? CONSOLE_LEGEND_ROWS : LEGEND_ROWS;
    },
  },
  watch: {
    'inputModeState.padsConnected'(now: number, before: number) {
      // Connect/disconnect toast — the W3C lifecycle made visible.
      this.showToast(this.$t(now > before ? 'Controller connected' : 'Controller disconnected'));
    },
    // Console-mode presentation class — owned HERE (the layer lives on every
    // lifecycle screen), so menu/create/lobby get the console styling too.
    'consoleModeState.enabled': {
      immediate: true,
      handler(on: boolean) {
        if (typeof document !== 'undefined') {
          document.documentElement.classList.toggle('console-mode', on);
        }
      },
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
      // Menu = short press → the SYSTEM overlay (console) / legend (desktop);
      // HOLD (≥650ms) → toggle console ↔ desktop shell.
      if (intent.kind === 'press' && intent.button === 'menu') {
        this.menuPressedAt = Date.now();
        return;
      }
      if (intent.kind === 'release' && intent.button === 'menu') {
        const held = this.menuPressedAt !== undefined ? Date.now() - this.menuPressedAt : 0;
        this.menuPressedAt = undefined;
        if (held >= MENU_HOLD_MS) {
          this.legendOpen = false;
          this.closeSystemMenu();
          clearGamepadFocus();
          setConsoleMode(!this.consoleModeState.enabled);
        } else if (this.legendOpen) {
          this.legendOpen = false;
        } else if (this.consoleModeState.enabled) {
          this.systemMenuOpen ? this.closeSystemMenu() : this.openSystemMenu();
        } else {
          this.legendOpen = true;
        }
        return;
      }
      // The legend is a layer-owned mini-scope: swallow everything but close.
      if (this.legendOpen) {
        if (intent.kind === 'press' && (intent.button === 'back' || intent.button === 'confirm')) {
          this.legendOpen = false;
        }
        return;
      }
      // The SYSTEM overlay owns input while open (any lifecycle context).
      if (this.systemMenuOpen && this.consoleModeState.enabled) {
        this.handleSystemMenuIntent(intent);
        return;
      }
      // The console-mode entry prompt: A = switch shells, B = stay (desktop).
      if (this.consoleModeState.entryPromptVisible && !this.consoleModeState.enabled) {
        if (intent.kind === 'press' && intent.button === 'confirm') {
          clearGamepadFocus();
          setConsoleMode(true);
        } else if (intent.kind === 'press' && intent.button === 'back') {
          dismissConsoleOffer();
        }
        return;
      }
      // Console shell first; unclaimed intents (a fallback surface is on
      // top) fall through to the demoted DOM focus engine.
      if (this.consoleModeState.enabled) {
        if (dispatchConsoleIntent(intent)) {
          // The console owns the screen — clear any stale fallback focus.
          if (this.focusState.ring.visible) {
            clearGamepadFocus();
          }
          return;
        }
      }
      handleGamepadIntent(intent);
    },
    // ── System overlay (console lifecycle §4) ─────────────────────────
    openSystemMenu(): void {
      this.systemMenuOpen = true;
      this.systemMenuIndex = 0;
      this.systemMenuConfirmExit = false;
    },
    closeSystemMenu(): void {
      this.systemMenuOpen = false;
      this.systemMenuConfirmExit = false;
    },
    handleSystemMenuIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        if (!this.systemMenuConfirmExit && (intent.dir === 'up' || intent.dir === 'down')) {
          this.systemMenuIndex = stepIndex(this.systemMenuIndex, intent.dir === 'down' ? 1 : -1, SYSTEM_MENU_ITEMS.length);
        }
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      if (this.systemMenuConfirmExit) {
        if (intent.button === 'confirm') {
          // The SAME safe navigation the desktop corner button used — the
          // game is server-saved and re-enterable from the main menu.
          window.location.assign('/');
        } else if (intent.button === 'back') {
          this.systemMenuConfirmExit = false;
        }
        return;
      }
      if (intent.button === 'back') {
        this.closeSystemMenu();
        return;
      }
      if (intent.button === 'confirm') {
        const item = SYSTEM_MENU_ITEMS[this.systemMenuIndex];
        switch (item?.id) {
        case 'controls':
          this.closeSystemMenu();
          this.legendOpen = true;
          break;
        case 'exit':
          this.systemMenuConfirmExit = true;
          break;
        case 'return':
          this.closeSystemMenu();
          break;
        }
      }
    },
    onModeChange(mode: InputMode): void {
      if (mode === 'gamepad') {
        this.startTick();
        gamepadFocusTick();
        // Desktop shell + a pad in hand → offer the console interface once.
        if (!this.consoleModeState.enabled) {
          maybeOfferConsoleMode();
        } else {
          // Console + pad = the TV posture — (re-)enter fullscreen
          // (best-effort; a trusted-gesture retry arms itself on failure).
          requestConsoleFullscreen();
        }
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
