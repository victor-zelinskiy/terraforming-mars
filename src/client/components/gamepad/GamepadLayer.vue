<template>
  <Teleport to="body">
    <GamepadFocusRing />
    <!-- The iteration-1 hint bar serves desktop gamepad mode AND the console
         lifecycle screens where the ConsoleShell command bar isn't mounted
         (join / lobby — fallback-engine-driven). The console-native pre-game
         screens (main menu / create) render their OWN command bar and
         suppress it via menuPadState. -->
    <GamepadHintBar v-if="(!consoleModeState.enabled || !consoleState.shellMounted) && menuPadState.mountedCount === 0" />
    <ConsoleEntryPrompt v-if="consoleModeState.entryPromptVisible && !consoleModeState.enabled" />

    <!-- The console SYSTEM overlay (Menu button): the action list and the
         settings console it opens are two members of ONE chassis, so ONE
         transition wraps the whole overlay and the swap between them is
         INSTANT. Giving each its own `con-layer` crossfaded two full-screen
         cards over two stacked backdrops for ~200 ms on every «Настройки» —
         and left both mounted meanwhile, which is a lie about where input is.
         The host must be fixed+full-bleed: an opacity below 1 makes it the
         containing block for its `position: fixed` children. -->
    <transition name="con-layer">
      <div v-if="systemMenuOpen && consoleModeState.enabled" class="con-sys-host">
        <!-- «Сообщить о проблеме» / «Диагностика» / F12 / the developer's notice — the DIAGNOSTICS surface, the third
             member of the same chassis (docs/claude/diagnostics.md). Loaded on first use. -->
        <ConsoleDiagnostics v-if="diagSurfaceState.shown" />
        <ConsoleSystemMenu v-else-if="systemMenuSettings === undefined"
                           :index="systemMenuIndex"
                           :confirmExit="systemMenuConfirmExit"
                           :inGame="screen === 'player-home'"
                           @activate="onSystemMenuActivate"
                           @cursor="systemMenuIndex = $event" />
        <!-- «Настройки» — the SHARED settings console (the ONE home of persistent
             console settings, CLAUDE.md). B returns to the system list. The in-game
             context drops the shell switch (a main-menu affordance) and the
             launch-time network rows. -->
        <ConsoleOptionsPanel v-else
                             ref="systemOptions"
                             context="game"
                             :initialCategory="systemMenuSettings"
                             @close="systemMenuSettings = undefined" />
      </div>
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
      <div>ring: {{ Math.round(focusState.ring.left) }},{{ Math.round(focusState.ring.top) }} {{ Math.round(focusState.ring.width) }}×{{ Math.round(focusState.ring.height) }} {{ focusState.ring.variant }}</div>
      <div v-for="(line, i) in intentLog" :key="i" class="gp-debug__intent">{{ line }}</div>
    </div>
  </Teleport>
</template>

<script setup vapor lang="ts">
/**
 * App-level gamepad layer (docs/GAMEPAD_SUPPORT_DESIGN.md §5/§6) — mounts next
 * to NotificationLayer in App.vue (survives everything; the game screen
 * gates it). Owns the subsystem lifecycle: installs the core, routes
 * intents into the focus engine, runs the 400 ms focus-validity tick while
 * in gamepad mode, clears synthetic residue on mode exit, and hosts the
 * ring + hint bar + Menu legend + connect toast + ?gpDebug readout.
 *
 * Fully inert (installGamepadCore no-ops) under `?gp=0` / the
 * `gamepad_enabled` preference — invariant 2.
 */
import {computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch} from 'vue';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {gamepadCoreState, installGamepadCore, onGamepadIntent, uninstallGamepadCore} from '@/client/gamepad/gamepadCore';
import {clearGamepadFocus, focusState, gamepadFocusTick, handleGamepadIntent} from '@/client/gamepad/focusEngine';
import {InputMode, inputModeState, onInputModeChange} from '@/client/gamepad/inputModeState';
import {gamepadDebug} from '@/client/gamepad/gamepadSettings';
import {GlyphControl, resolveGlyphSetId} from '@/client/gamepad/glyphSets';
import {applyGlyphCssVars} from '@/client/gamepad/glyphCssBridge';
import GamepadFocusRing from '@/client/components/gamepad/GamepadFocusRing.vue';
import GamepadHintBar from '@/client/components/gamepad/GamepadHintBar.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleEntryPrompt from '@/client/components/console/ConsoleEntryPrompt.vue';
import ConsoleSystemMenu from '@/client/components/console/ConsoleSystemMenu.vue';
import {SYSTEM_MENU_ITEMS} from '@/client/components/console/consoleSystemMenuModel';
import {ConsoleDiagnostics, warmDiagnosticsSurface} from '@/client/components/console/diagnostics/diagnosticsAsync';
import {noteDiagnosticsAppScreen} from '@/client/diagnostics/diagnosticsCapture';
import {onDiagnosticsPush} from '@/client/diagnostics/diagnosticsJournalState';
import {interceptDevNoticeIntent} from '@/client/diagnostics/diagnosticsNotice';
import {setDiagnosticsOverlayOpener} from '@/client/diagnostics/diagnosticsOverlayBridge';
import {closeDiagnostics, DiagOpenTarget, diagSurfaceState, handleDiagnosticsIntent, holdDiagnosticsScreen, openDiagnostics} from '@/client/diagnostics/diagnosticsSurface';
import ConsoleOptionsPanel from '@/client/components/console/menu/ConsoleOptionsPanel.vue';
import {ConsoleSettingsCategoryId} from '@/client/console/settings/consoleSettingsModel';
import {buttonLayoutState, remapConsoleIntent} from '@/client/gamepad/buttonLayout';
import {consoleModeState, consoleModeExplicitlyDisabled, dismissConsoleOffer, maybeOfferConsoleMode, requestConsoleFullscreen, setConsoleMode} from '@/client/console/consoleModeState';
import {initialGamepadDetected, isElectronApp, isLinuxPlatform} from '@/client/console/runtimeMode';
import {exitGameToMenu} from '@/client/console/loadingScreenState';
import {consoleLayoutState, installConsoleLayoutProfile, ConsoleLayoutProfile} from '@/client/console/consoleLayoutProfile';
import {consoleState, dispatchConsoleIntent, stepIndex} from '@/client/console/consoleRouter';
import {menuPadState} from '@/client/console/menu/consoleMenuPad';
import {desktopUpdateBlocking} from '@/client/components/desktop/desktopUpdateState';
import {leakDetectorState} from '@/client/console/consoleLeakDetector';
import {installConsoleKeyBridge, uninstallConsoleKeyBridge} from '@/client/console/composables/consoleKeyBridge';
import {setConsoleSystemMenuInput} from '@/client/console/consoleSystemMenuBridge';
import {stickScrollBy} from '@/client/console/stickScrollTarget';
import {installConsoleOverflowGuard, uninstallConsoleOverflowGuard} from '@/client/console/composables/consoleOverflowGuard';
import {$t} from '@/client/directives/i18n';

const FOCUS_TICK_MS = 400;
/** How long after the layer mounts the diagnostics surface's chunk is fetched (well past the boot). */
const WARM_DIAGNOSTICS_MS = 9_000;

/** Holding Menu this long toggles console ↔ desktop mode. */
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

/** The console-mode mapping (docs/CONSOLE_MODE_CONCEPT.md §11; P27 command model). */
const CONSOLE_LEGEND_ROWS: ReadonlyArray<LegendRow> = [
  {control: 'dpad', label: 'Navigate'},
  {control: 'confirm', label: 'Select'},
  {control: 'back', label: 'Back / Close'},
  {control: 'inspect', label: 'Information'},
  {control: 'triggerR', label: 'Actions'},
  {control: 'triggerL', label: 'Basic actions'},
  {control: 'bumperL', label: 'Milestones'},
  {control: 'bumperR', label: 'Awards'},
  {control: 'stickL', label: 'Inspect board'},
  {control: 'stickR', label: 'Scale inspection'},
  {control: 'stickScroll', label: 'Scroll'},
  {control: 'view', label: 'Log'},
  {control: 'menu', label: 'System menu'},
];

defineOptions({name: 'GamepadLayer'});
const props = defineProps({
  /** The App screen — drives lifecycle context (system menu labels, hints). */
  screen: {type: String, default: ''},
});

// The layer's own scope (flow kernel — PLAN §10 · C1). The layer is mounted by the app on every screen, outside any
// console shell — so its scope is the PAGE's (`useFlowScope` reads the component tree): a game session ending
// beside it never takes its toast's timer away.
const flow = useFlowScope('gamepad-layer');

// The focus-validity tick — an OWNED tick of that scope (it stops with the layer), paused and resumed by the
// input mode: `resume` is idempotent (a standing tick is kept), `pause` stops it.
let stopFocusTick: (() => void) | undefined = undefined;
const focusTick = {
  resume: (): void => {
    stopFocusTick ??= flow.every(FOCUS_TICK_MS, 'the focus validity tick', () => gamepadFocusTick());
  },
  pause: (): void => {
    stopFocusTick?.();
    stopFocusTick = undefined;
  },
};
const systemOptions = useTemplateRef<{handleIntent?: (i: GamepadIntent) => boolean}>('systemOptions');
const systemMenuOpen = ref(false);
const systemMenuIndex = ref(0);
const systemMenuConfirmExit = ref(false);
/**
 * The settings console opened FROM the system menu, and which category it
 * opened on (undefined = the system list itself is showing). «Настройки»
 * opens it on its default category. (The diagnostics readout moved to the
 * diagnostics surface — the third member, `diagSurfaceState.shown`.)
 */
const systemMenuSettings = ref<ConsoleSettingsCategoryId | undefined>(undefined);
const legendOpen = ref(false);
const toast = ref('');
const intentLog = ref<Array<string>>([]);
let offIntent: (() => void) | undefined;
let offMode: (() => void) | undefined;
let offDiagPush: (() => void) | undefined;
const menuPressedAt = ref<number | undefined>(undefined);

const debug = computed((): boolean => {
  return gamepadDebug();
});
const gamepadActive = computed((): boolean => {
  return inputModeState.mode === 'gamepad';
});
const legendRows = computed((): ReadonlyArray<LegendRow> => {
  return consoleModeState.enabled ? CONSOLE_LEGEND_ROWS : LEGEND_ROWS;
});
/** Identity of the ACTIVE glyph presentation — set + A/B layout, the two
 * inputs of `activeGlyphSet()`. Drives the CSS bridge republish below. */
const glyphCssKey = computed((): string => {
  return `${resolveGlyphSetId()}:${buttonLayoutState.layout}`;
});

function onIntent(rawIntent: GamepadIntent): void {
  if (debug.value) {
    const line = rawIntent.kind === 'press' || rawIntent.kind === 'release' ?
      `${rawIntent.kind}:${rawIntent.button}` :
      rawIntent.kind === 'nav' ? `nav:${rawIntent.dir}${rawIntent.repeat ? ' (r)' : ''}${rawIntent.analog === true ? ' (s)' : ''}` :
        rawIntent.kind === 'navEnd' ? `navEnd:${rawIntent.dir}` :
          rawIntent.kind === 'aim' ? `aim:${rawIntent.dir}` :
            rawIntent.kind === 'aimEnd' ? 'aimEnd' : 'scroll';
    intentLog.value = [line, ...intentLog.value].slice(0, 5);
  }
  // BUTTON LAYOUT (Console → Options → «Раскладка кнопок»): swap the
  // semantic button a physical press produces ONCE here, at the pad funnel,
  // so every downstream handler (system menu, entry prompt, console shell,
  // focus engine) sees the remapped role — the glyph layer swaps in lockstep
  // (glyphSets.activeGlyphSet), so nothing else needs to know. Identity for
  // the default layout (returns the same object).
  const intent = remapConsoleIntent(rawIntent, buttonLayoutState.layout);
  // MANDATORY UPDATE GATE (highest priority): while the full-cover desktop
  // update overlay owns the screen, route input STRAIGHT to the DOM focus
  // engine — its `desktopUpdate` scope is rooted at `.desktop-update--cover`,
  // so it drives ONLY the update buttons. This bypasses the console shell /
  // pre-game dispatch entirely, so A can never leak through to a menu item
  // (Continue) behind the overlay. `onPress('confirm')` ensures focus on the
  // update button before clicking, so a single A applies the update.
  if (desktopUpdateBlocking()) {
    handleGamepadIntent(intent);
    return;
  }
  // THE DEVELOPER'S NOTICE asks first for its hold-X (`diagnosticsNotice.ts`): a hold opens the record, a tap is
  // replayed to the screen below. It stands outside the shell on purpose — it must answer while the shell does not.
  if (!systemMenuOpen.value && interceptDevNoticeIntent(intent, routeIntent)) {
    return;
  }
  routeIntent(intent);
}
/** The pad's intent past the gates that stand above every screen (the update cover, the developer's notice). */
function routeIntent(intent: GamepadIntent): void {
  // Menu = the SYSTEM overlay. The old HOLD (≥650ms) shell toggle died
  // with the desktop shell (desktop-removal wave 1) — a long hold now
  // behaves exactly like a short press.
  if (intent.kind === 'press' && intent.button === 'menu') {
    menuPressedAt.value = Date.now();
    // The frame on screen is kept for a report that may follow — NOW, on the press: the overlay rises on the release.
    if (!systemMenuOpen.value && consoleModeState.enabled && props.screen === 'player-home') {
      void holdDiagnosticsScreen();
    }
    return;
  }
  if (intent.kind === 'release' && intent.button === 'menu') {
    menuPressedAt.value = undefined;
    if (legendOpen.value) {
      legendOpen.value = false;
    } else if (consoleModeState.enabled) {
      // The SYSTEM overlay (view controls / return to menu) is an IN-GAME
      // affordance — at the lifecycle screens (menu / create / lobby)
      // there is nowhere to "return to", so a short Menu press does
      // nothing there (hold-to-toggle-mode above still applies).
      if (props.screen === 'player-home') {
        systemMenuOpen.value ? closeSystemMenu() : openSystemMenu();
      }
    } else {
      legendOpen.value = true;
    }
    return;
  }
  // The legend is a layer-owned mini-scope: swallow everything but close.
  if (legendOpen.value) {
    if (intent.kind === 'press' && (intent.button === 'back' || intent.button === 'confirm')) {
      legendOpen.value = false;
    }
    return;
  }
  // The SYSTEM overlay owns input while open (any lifecycle context).
  if (systemMenuOpen.value && consoleModeState.enabled) {
    handleSystemMenuIntent(intent);
    return;
  }
  // The console-mode entry prompt: A = switch shells, B = stay (desktop).
  if (consoleModeState.entryPromptVisible && !consoleModeState.enabled) {
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
  if (consoleModeState.enabled) {
    if (dispatchConsoleIntent(intent)) {
      // The console owns the screen — clear any stale fallback focus.
      if (focusState.ring.visible) {
        clearGamepadFocus();
      }
      return;
    }
  }
  handleGamepadIntent(intent);
}
// ── System overlay (console lifecycle §4) ─────────────────────────
function openSystemMenu(): void {
  // Two of the menu's plates lead to the diagnostics surface: its chunk is fetched while the player reads the list.
  warmDiagnosticsSurface();
  systemMenuOpen.value = true;
  systemMenuIndex.value = 0;
  systemMenuConfirmExit.value = false;
  systemMenuSettings.value = undefined;
}
function closeSystemMenu(): void {
  systemMenuOpen.value = false;
  systemMenuConfirmExit.value = false;
  systemMenuSettings.value = undefined;
  if (diagSurfaceState.shown) {
    closeDiagnostics();
  }
}
/**
 * THE DIAGNOSTICS SURFACE, opened from OUTSIDE the system list — the developer's notice, the main menu's item, the
 * developer's key. It needs no game screen: the overlay rises over whatever stands, and B at the surface's root closes
 * the whole overlay (there is no list to return to).
 */
function openDiagnosticsDirect(target: DiagOpenTarget): void {
  if (!consoleModeState.enabled || desktopUpdateBlocking()) {
    return;
  }
  legendOpen.value = false;
  systemMenuOpen.value = true;
  systemMenuConfirmExit.value = false;
  systemMenuSettings.value = undefined;
  openDiagnostics('direct', target);
}
/** The surface is done with the overlay: back to the system list it was opened from, or the overlay closes. */
function leaveDiagnostics(): void {
  const toList = diagSurfaceState.origin === 'menu' && props.screen === 'player-home';
  closeDiagnostics();
  if (!toList) {
    closeSystemMenu();
  }
}
/**
 * The KEYBOARD's view of the system overlay (the pad path is `onIntent`).
 * Returns true for everything it consumed, so the key bridge stops routing:
 * while the overlay is open it owns the keyboard entirely — otherwise the
 * arrows would drive the board behind it.
 */
function keyboardSystemMenuIntent(intent: GamepadIntent): boolean {
  if (!consoleModeState.enabled || desktopUpdateBlocking()) {
    return false;
  }
  // The developer's notice takes its hold-X from the keyboard too; a tap is replayed to the console's own dispatch.
  if (!systemMenuOpen.value && interceptDevNoticeIntent(intent, (replayed) => {
    dispatchConsoleIntent(replayed);
  })) {
    return true;
  }
  if (systemMenuOpen.value) {
    // The Menu key closes it again; everything else is the overlay's.
    if (intent.kind === 'press' && intent.button === 'menu') {
      closeSystemMenu();
    } else {
      handleSystemMenuIntent(intent);
    }
    return true;
  }
  if (intent.kind === 'press' && intent.button === 'menu') {
    // Same rule as the pad: the overlay is an IN-GAME affordance (at the
    // lifecycle screens there is nowhere to "return to").
    if (props.screen === 'player-home') {
      // (The keyboard opens on the press itself: the frame is asked for in the same breath — the overlay's own
      // fade leaves it the time.)
      void holdDiagnosticsScreen();
      openSystemMenu();
    }
    return true;
  }
  // Swallow the matching release so it cannot reach a surface below.
  return intent.kind === 'release' && intent.button === 'menu';
}
function handleSystemMenuIntent(intent: GamepadIntent): void {
  // THE RIGHT STICK pages what overflows INSIDE the overlay (the settings
  // console's rows, a readout) — never the game behind it.
  if (intent.kind === 'scroll') {
    // (Asked of the DOCUMENT: this component's root is a teleport to `body` — it has no element of its own —
    // and there is ONE system overlay. The lookup used to go through `$el`, which under a teleport root is the
    // teleport's placeholder: it never found the host, and the stick never paged the overlay.)
    const host = document.querySelector('.con-sys-host');
    if (host !== null && host !== undefined) {
      stickScrollBy(intent.dy, host);
    }
    return;
  }
  // The diagnostics surface owns its own steps and input (`diagnosticsSurface.ts`); it says when it is done.
  if (diagSurfaceState.shown) {
    if (handleDiagnosticsIntent(intent) === 'leave') {
      leaveDiagnostics();
    }
    return;
  }
  // The settings console is a full component that owns its own nav /
  // category ring / primary / back — delegate the whole intent to it (it
  // emits close on B, which returns to the system list).
  if (systemMenuSettings.value !== undefined) {
    const options = systemOptions.value ?? undefined;
    options?.handleIntent?.(intent);
    return;
  }
  if (intent.kind === 'nav') {
    // No list navigation while the exit confirmation owns the card — the
    // menu index is hidden underneath it.
    if (!systemMenuConfirmExit.value && (intent.dir === 'up' || intent.dir === 'down')) {
      systemMenuIndex.value = stepIndex(systemMenuIndex.value, intent.dir === 'down' ? 1 : -1, SYSTEM_MENU_ITEMS.length);
    }
    return;
  }
  if (intent.kind !== 'press') {
    return;
  }
  if (systemMenuConfirmExit.value) {
    if (intent.button === 'confirm') {
      // The ONE exit funnel: the game is server-saved and re-enterable;
      // the shell registered the honest destination (a campaign mission
      // returns to ITS campaign map, an ordinary game to the main menu)
      // and the transition curtain covers the deliberate reload.
      exitGameToMenu();
    } else if (intent.button === 'back') {
      systemMenuConfirmExit.value = false;
    }
    return;
  }
  if (intent.button === 'back') {
    closeSystemMenu();
    return;
  }
  if (intent.button === 'confirm') {
    onSystemMenuActivate(systemMenuIndex.value);
  }
}
/** Run the plate at `i` — the ONE branch A and a mouse click share. */
function onSystemMenuActivate(i: number): void {
  systemMenuIndex.value = i;
  switch (SYSTEM_MENU_ITEMS[i]?.id) {
  case 'settings':
    systemMenuSettings.value = 'interface';
    break;
  case 'controls':
    closeSystemMenu();
    legendOpen.value = true;
    break;
  case 'report':
    // «Сообщить о проблеме» — the diagnostics surface, straight on the report's first step.
    openDiagnostics('menu', {to: 'report'});
    break;
  case 'diagnostics':
    // The journal, the system readout and the connection check — the diagnostics surface's browse step.
    openDiagnostics('menu', {to: 'journal'});
    break;
  case 'exit':
    systemMenuConfirmExit.value = true;
    break;
  case 'return':
    closeSystemMenu();
    break;
  }
}
function onModeChange(mode: InputMode): void {
  if (mode === 'gamepad') {
    startTick();
    gamepadFocusTick();
    // Desktop shell + a pad in hand → offer the console interface once.
    // ELECTRON (P10): the shell IS the couch build — a pad in hand
    // switches straight into console mode, no prompt.
    if (!consoleModeState.enabled) {
      if (isElectronApp() && !consoleModeExplicitlyDisabled()) {
        setConsoleMode(true);
      } else {
        maybeOfferConsoleMode();
      }
    } else {
      // Console + pad = the TV posture — (re-)enter fullscreen
      // (best-effort; a trusted-gesture retry arms itself on failure).
      requestConsoleFullscreen();
    }
  } else {
    stopTick();
    legendOpen.value = false;
    clearGamepadFocus();
  }
}
function startTick(): void {
  focusTick.resume(); // idempotent
}
function stopTick(): void {
  focusTick.pause();
}

watch(() => inputModeState.padsConnected, (now: number, before: number) => {
  // NO disconnect toast — REMOVED GLOBALLY (player decision, 2026-09-05).
  // Even debounced it kept mis-firing on couch hardware: Steam Input /
  // gamescope device swaps and suspend cycles produce pad-count dips the
  // Gamepad API cannot distinguish from an unplug, and a false «Контроллер
  // отключён» is worse than no notice — the pad's own state IS the notice
  // (input simply resumes on the next press; the focus ring and glyph bar
  // already communicate pad presence). The count keeps driving the
  // console-posture switch below.
  // ELECTRON (P10): a pad connecting anywhere in the shell (menu /
  // create / lobby / game) enables the console posture immediately —
  // unless the player explicitly opted out (their choice persists).
  if (now > before && isElectronApp() && !consoleModeState.enabled && !consoleModeExplicitlyDisabled()) {
    setConsoleMode(true);
  }
});
// P10: a screen transition invalidates the focus descriptor — drop it
// so the next tick re-acquires the first actionable of the NEW screen
// (never a stale/hidden element, never an unfocusable state).
watch(() => props.screen, (screen) => {
  // What a diagnostic record says the screen was (`diagnosticsCapture.currentDiagScreen`).
  noteDiagnosticsAppScreen(screen);
  if (gamepadActive.value) {
    clearGamepadFocus();
    void nextTick(() => gamepadFocusTick());
  }
});
// Console-mode presentation class — owned HERE (the layer lives on every
// lifecycle screen), so menu/create/lobby get the console styling too.
// The console KEY BRIDGE (foundation layer) rides the same switch: while
// console mode is on, EVERY console surface — pre-game and in-game —
// gets the one keyboard fallback through dispatchConsoleIntent.
watch(() => consoleModeState.enabled, (on: boolean) => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('console-mode', on);
  }
  if (on) {
    installConsoleKeyBridge();
  } else {
    uninstallConsoleKeyBridge();
  }
}, {immediate: true});
// P12: the console LAYOUT PROFILE class (handheld / standard / large —
// Steam Deck being the handheld flagship). Owned here for the same
// reason; every selector pairs it with console-scoped classes, so the
// desktop premium UI is structurally unreachable.
watch(() => consoleLayoutState.profile, (now: ConsoleLayoutProfile, before: ConsoleLayoutProfile | undefined) => {
  if (typeof document === 'undefined') {
    return;
  }
  const html = document.documentElement;
  if (before !== undefined) {
    html.classList.remove(`con-profile-${before}`);
  }
  for (const p of ['handheld', 'standard', 'large', 'tv']) {
    html.classList.remove(`con-profile-${p}`);
  }
  html.classList.add(`con-profile-${now}`);
}, {immediate: true});
// GLYPH CSS BRIDGE — mirror the active glyph set onto <html> as
// --gp-label-* / --gp-tone-* custom properties. Owned here for the same
// reason as the classes above (the layer spans every lifecycle screen), so
// a badge a Vue component can't reach (the virtual keyboard's simple-keyboard
// keys) still follows the player's controller. See glyphCssBridge.ts.
watch(() => glyphCssKey.value, () => {
  applyGlyphCssVars();
}, {immediate: true});

onMounted(() => {
  installGamepadCore();
  installConsoleLayoutProfile();
  // Dev-only "no page scrollbars in console-native" diagnostics —
  // self-gates on consoleNativeActive() + build mode (inert in prod).
  installConsoleOverflowGuard();
  offIntent = onGamepadIntent((intent) => onIntent(intent));
  offMode = onInputModeChange((mode) => onModeChange(mode));
  // The KEYBOARD route into the system overlay. Pads reach `onIntent`
  // directly; the keyboard bridge speaks to the console router, which this
  // layer is not part of — so it asks here first (consoleSystemMenuBridge).
  setConsoleSystemMenuInput((intent) => keyboardSystemMenuIntent(intent));
  noteDiagnosticsAppScreen(props.screen);
  // The doors into the diagnostics surface from outside this layer: the notice, the main menu, the developer's key
  // (F12 — the main process pushes it; a second press closes what the first one opened).
  setDiagnosticsOverlayOpener((target) => openDiagnosticsDirect(target));
  // …and its chunk is fetched once the app has settled — never on the boot's path, and never a first-open blink.
  // PACING: a layer that left has nothing to warm.
  flow.after(WARM_DIAGNOSTICS_MS, 'the diagnostics surface\'s chunk is fetched ahead of its first use', warmDiagnosticsSurface);
  offDiagPush = onDiagnosticsPush((push) => {
    if (push.kind !== 'open-journal') {
      return;
    }
    if (diagSurfaceState.shown) {
      leaveDiagnostics();
    } else {
      void holdDiagnosticsScreen().then(() => openDiagnosticsDirect({to: 'journal'}));
    }
  });
  if (gamepadActive.value) {
    startTick();
  }
  // ELECTRON BOOTSTRAP (P10 + the Steam Deck fix): Chromium HIDES a
  // connected pad until its first button press (privacy), and Steam
  // Input may emulate mouse/keyboard — so pad detection alone is NOT a
  // reliable launch signal on the Deck. The Electron shell therefore
  // boots console-first on EITHER robust signal: a pad already visible
  // OR the Deck posture (LINUX shell + the HANDHELD layout profile —
  // the platform anchor keeps a small-screen Windows laptop out of it).
  // An explicit player opt-out (?console=0 / «Настройки» → ИНТЕРФЕЙС → Оболочка →
  // Desktop, stored) always wins and is never overridden.
  //
  // NOTE: console mode now DEFAULTS on (consoleModeState) — so `!enabled`
  // here already implies the player opted out, which `explicitlyDisabled`
  // then vetoes. This whole branch is a dormant safety net kept for the
  // signals it encodes; it cannot fire under the current default.
  if (isElectronApp() && !consoleModeState.enabled && !consoleModeExplicitlyDisabled() &&
      (initialGamepadDetected() || (isLinuxPlatform() && consoleLayoutState.profile === 'handheld'))) {
    setConsoleMode(true);
  }
});
onBeforeUnmount(() => {
  offIntent?.();
  offMode?.();
  setConsoleSystemMenuInput(undefined);
  setDiagnosticsOverlayOpener(undefined);
  offDiagPush?.();
  stopTick();
  clearGamepadFocus();
  uninstallGamepadCore();
  uninstallConsoleKeyBridge();
  uninstallConsoleOverflowGuard();
});
</script>
