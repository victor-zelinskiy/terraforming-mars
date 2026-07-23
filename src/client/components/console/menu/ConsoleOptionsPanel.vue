<template>
  <div class="cm-overlay" role="dialog" :aria-label="$t('Options')">
    <div class="cm-overlay__card">
      <div class="cm-overlay__title">{{ $t('Options') }}</div>

      <div class="cm-optlist">
        <button
          v-for="(row, i) in rows"
          :key="row.id"
          type="button"
          class="cm-opt"
          :class="{'cm-opt--cursor': i === cursor}"
          @click="activateAt(i)"
          @mousemove="cursor = i"
        >
          <span class="cm-opt__glyph" aria-hidden="true">{{ row.glyph }}</span>
          <span class="cm-opt__text">
            <span class="cm-opt__label">{{ $t(row.label) }}</span>
            <span class="cm-opt__sub">{{ $t(row.sub) }}</span>
          </span>
          <span class="cm-opt__value">{{ row.value }}</span>
        </button>
      </div>

      <!-- Display diagnostics — always mounted (never a layout jump on
           navigation), dimmed while another row is cursored. -->
      <div class="cm-optdiag" :class="{'cm-optdiag--muted': rows[cursor]?.id !== 'display'}" aria-live="polite">
        <div class="cm-optdiag__row"><span>{{ $t('Profile') }}</span><b>{{ diag.profile }} · {{ diag.forced ? $t('manual') : $t('auto') }}</b></div>
        <div class="cm-optdiag__row"><span>Viewport</span><b>{{ diag.viewport }}</b></div>
        <div class="cm-optdiag__row"><span>{{ $t('Panel') }}</span><b>{{ diag.physical }} · DPR {{ diag.devicePixelRatio }}</b></div>
        <div class="cm-optdiag__row"><span>UI scale</span><b>×{{ diag.uiScale }}</b></div>
        <div class="cm-optdiag__row cm-optdiag__row--why"><span>{{ diag.reason }}</span></div>
      </div>

      <div class="cm-overlay__foot">
        <span class="cm-overlay__foot-hint"><GamepadGlyph control="confirm" />{{ $t('Change') }}</span>
        <span class="cm-overlay__foot-hint"><GamepadGlyph control="back" />{{ $t('Done') }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE-NATIVE OPTIONS — THE home of every PERSISTENT console preference
 * (CLAUDE.md: settings live here, NOT in the fixed-shape in-game System menu).
 * Reachable from the main menu AND, in-game, from the System overlay's
 * «Настройки» item (GamepadLayer hosts it there with `context="game"`).
 *
 *  - INTERFACE (console ↔ desktop) — MAIN-MENU ONLY (`context !== 'game'`): the
 *    desktop UI is deprecated and reachable ONLY from the menu, and switching
 *    the shell mid-game is jarring. Picking Desktop stores the opt-out
 *    (`tm_console_mode`='0') the auto-enable heuristics honour.
 *  - DISPLAY — the layout profile (Auto / Handheld / Standard / Large / TV 4K,
 *    `tm_console_profile`); the diag block shows what it resolves to.
 *  - CONTROLLER — the button GLYPH set (Auto / Xbox / PlayStation / Steam).
 *  - BUTTON LAYOUT — the confirm/cancel (A↔B) gamepad remap (buttonLayout.ts):
 *    cycling it swaps the input funnels + the glyph layer in lockstep.
 *  - PRIVATE SCORE — IN-GAME ONLY (`context === 'game'`): a PER-GAME display
 *    pref masking the viewer's OWN victory points on the console score cap /
 *    passive surfaces (privateScoreState, keyed by the game's participant id).
 *    Hidden in the main menu, where there is no game to scope it to.
 *
 * Every row carries its value on a fixed-width right rail and the diag block is
 * ALWAYS mounted (dimmed when another row is cursored), so navigation never
 * relayouts — the exact property the fixed-shape System menu lacks. Both hosts
 * (ConsoleMainMenu / GamepadLayer) route pad intents via `handleIntent`.
 */
import {defineComponent} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {stepIndex} from '@/client/console/consoleRouter';
import {
  PROFILE_LABELS,
  consoleDisplayDiagnostics,
  consoleLayoutState,
  currentProfileOverride,
  cycleConsoleProfileOverride,
} from '@/client/console/consoleLayoutProfile';
import {consoleModeState, setConsoleMode} from '@/client/console/consoleModeState';
import {
  GLYPHSET_LABELS,
  cycleGlyphSetOverride,
  glyphSetState,
  resolveGlyphSetId,
} from '@/client/gamepad/glyphSets';
import {BUTTON_LAYOUT_LABELS, buttonLayoutState, cycleButtonLayout} from '@/client/gamepad/buttonLayout';
import {privateScoreState, togglePrivateScore} from '@/client/components/overview/privateScoreState';
import {
  type MotionFpsCap,
  type MotionSpeedPreset,
  motionFpsCap,
  motionSpeedPreset,
  setMotionFpsCap,
  setMotionSpeedPreset,
} from '@/client/components/motion/motionTokens';
import {applyGsapTickerFps} from '@/client/components/motion/gsapMotionBridge';
import {translateText} from '@/client/directives/i18n';

// English i18n keys ('Standard' / 'Auto' already exist in console.json — reused).
const MOTION_SPEED_LABELS: Record<MotionSpeedPreset, string> = {
  standard: 'Standard',
  calm: 'Calm',
  swift: 'Swift',
};
const MOTION_SPEED_CYCLE: ReadonlyArray<MotionSpeedPreset> = ['standard', 'calm', 'swift'];
const MOTION_FPS_LABELS: Record<'auto' | '30' | '60', string> = {
  auto: 'Auto',
  60: '60 FPS',
  30: '30 FPS',
};
const MOTION_FPS_CYCLE: ReadonlyArray<MotionFpsCap> = ['auto', 60, 30];

type OptionRowId =
  'interface' | 'display' | 'controller' | 'buttons' | 'motionSpeed' | 'motionRate' | 'privateScore';
type OptionRow = {id: OptionRowId, label: string, sub: string, glyph: string, value: string};

export default defineComponent({
  name: 'ConsoleOptionsPanel',
  components: {GamepadGlyph},
  props: {
    /**
     * Where the panel is hosted. 'game' (opened from the in-game system menu)
     * hides the Interface (console↔desktop) row — switching the shell mid-game
     * stays a main-menu-only affordance (CLAUDE.md). 'menu' shows every row.
     */
    context: {type: String as () => 'menu' | 'game', default: 'menu'},
  },
  emits: ['close'],
  data() {
    return {
      consoleLayoutState, consoleModeState, glyphSetState, buttonLayoutState, privateScoreState,
      // Motion prefs are module-cached (motionTokens), not reactive — mirror
      // them here so the row value re-renders when this panel cycles them.
      motionSpeed: motionSpeedPreset() as MotionSpeedPreset,
      motionRate: motionFpsCap() as MotionFpsCap,
      cursor: 0,
    };
  },
  computed: {
    rows(): ReadonlyArray<OptionRow> {
      const rows: Array<OptionRow> = [];
      // Interface (shell switch) — main menu only; hidden in-game.
      if (this.context !== 'game') {
        rows.push({
          // The sub describes the SETTING, never the current value — a
          // value-dependent subtitle would relabel to a different line
          // count and move the rows under the cursor.
          id: 'interface',
          label: 'Interface',
          sub: 'Controller shell or mouse and keyboard',
          glyph: '◫',
          value: translateText(this.consoleModeState.enabled ? 'Console' : 'Desktop'),
        });
      }
      rows.push(
        {
          id: 'display',
          label: 'Display',
          sub: 'Layout profile for this screen',
          glyph: '🖥',
          value: this.displayValue,
        },
        {
          id: 'controller',
          label: 'Controller',
          sub: 'Button glyph set',
          glyph: '🎮',
          value: this.controllerValue,
        },
        {
          id: 'buttons',
          label: 'Button layout',
          sub: 'Which face button confirms',
          glyph: '🅰',
          value: translateText(BUTTON_LAYOUT_LABELS[this.buttonLayoutState.layout]),
        },
        {
          // Animation SPEED preset — Calm lengthens easings (fewer per-frame
          // deltas); Swift shortens them. A CPU-side smoothness lever.
          id: 'motionSpeed',
          label: 'Motion speed',
          sub: 'Pace of animations',
          glyph: '🎞',
          value: translateText(MOTION_SPEED_LABELS[this.motionSpeed]),
        },
        {
          // Animation FRAME-RATE cap — 'Auto' = native; 60/30 throttle both the
          // rAF loops AND (via the GSAP ticker bridge) the card-deal / FLIP
          // cinematics, cutting per-second main-thread work on a weak CPU.
          id: 'motionRate',
          label: 'Animation smoothness',
          sub: 'Frame-rate cap for animations',
          glyph: '⚡',
          value: translateText(MOTION_FPS_LABELS[this.motionRate === 'auto' ? 'auto' : (String(this.motionRate) as '30' | '60')]),
        },
      );
      // Private score is a per-GAME preference — offered ONLY in-game (from the
      // system menu), never in the main-menu Options where there is no game to
      // scope it to (`bindPrivateScoreGame` is unbound there).
      if (this.context === 'game') {
        rows.push({
          // Local display preference (not a game option) — masks the viewer's
          // OWN victory points on the console score cap / passive surfaces.
          id: 'privateScore',
          label: 'Private score',
          sub: 'Hide your own victory points on screen',
          glyph: '🛡',
          value: translateText(this.privateScoreState.enabled ? 'Hidden' : 'Shown'),
        });
      }
      return rows;
    },
    controllerValue(): string {
      // Reads glyphSetState (override + detected) so the row reacts to both a
      // manual change and a newly-detected pad.
      const choice = this.glyphSetState.override;
      const value = translateText(GLYPHSET_LABELS[choice]);
      // Auto shows the set it currently resolves to, so the pick is informed.
      return choice === 'auto' ?
        `${value} (${translateText(GLYPHSET_LABELS[resolveGlyphSetId()])})` :
        value;
    },
    displayValue(): string {
      const override = currentProfileOverride();
      const value = translateText(PROFILE_LABELS[override] ?? override);
      // Auto shows what it currently resolves to, so the pick is informed.
      return override === 'auto' ?
        `${value} (${translateText(PROFILE_LABELS[this.consoleLayoutState.profile] ?? this.consoleLayoutState.profile)})` :
        value;
    },
    diag() {
      // Recomputed on every re-render the state provokes (profile/scale are
      // reactive; viewport values are read fresh each time).
      return consoleDisplayDiagnostics();
    },
  },
  methods: {
    /** Host-routed pad intents. Returns true when consumed. */
    handleIntent(intent: GamepadIntent): boolean {
      const action = consoleActionOf(intent);
      if (intent.kind === 'nav' && (intent.dir === 'up' || intent.dir === 'down')) {
        this.cursor = stepIndex(this.cursor, intent.dir === 'down' ? 1 : -1, this.rows.length);
        return true;
      }
      if (action === 'primary') {
        this.activateAt(this.cursor);
        return true;
      }
      if (action === 'back') {
        this.$emit('close');
        return true;
      }
      return true;
    },
    activateAt(i: number): void {
      this.cursor = i;
      switch (this.rows[i]?.id) {
      case 'interface':
        // Persisted both ways: picking Desktop stores the opt-out that the
        // auto-enable heuristics honour; picking Console stores '1'.
        setConsoleMode(!this.consoleModeState.enabled);
        break;
      case 'display':
        // Cycle Auto → Handheld → Standard → Large → TV 4K in place — the
        // change applies instantly (reversible) and the diag block reacts.
        cycleConsoleProfileOverride();
        break;
      case 'controller':
        // Cycle Auto → Xbox → PlayStation → Steam in place — every button
        // glyph across the shell re-renders instantly and the choice persists.
        cycleGlyphSetOverride();
        break;
      case 'buttons':
        // Cycle Standard → Swap A/B in place — the intent funnels + the glyph
        // layer swap in lockstep (buttonLayout.ts), so the change is instant
        // and consistent (glyph shows the button that now confirms) + persists.
        cycleButtonLayout();
        break;
      case 'motionSpeed': {
        // Cycle Standard → Calm → Swift in place; setMotionSpeedPreset persists
        // and applies the CSS `--motion-scale` bridge live.
        const next = MOTION_SPEED_CYCLE[(MOTION_SPEED_CYCLE.indexOf(this.motionSpeed) + 1) % MOTION_SPEED_CYCLE.length];
        this.motionSpeed = next;
        setMotionSpeedPreset(next);
        break;
      }
      case 'motionRate': {
        // Cycle Auto → 60 → 30 in place; setMotionFpsCap persists + the GSAP
        // ticker bridge applies it to the heavy cinematics live.
        const next = MOTION_FPS_CYCLE[(MOTION_FPS_CYCLE.indexOf(this.motionRate) + 1) % MOTION_FPS_CYCLE.length];
        this.motionRate = next;
        setMotionFpsCap(next);
        applyGsapTickerFps(next);
        break;
      }
      case 'privateScore':
        // Local, per-browser display pref — masks only THIS viewer's own VP on
        // passive surfaces (the console score cap reads shouldMaskOwnPassiveVp).
        togglePrivateScore();
        break;
      }
    },
  },
});
</script>
