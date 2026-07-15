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
 * CONSOLE-NATIVE OPTIONS — the main menu's settings screen. Home of every
 * PERSISTENT preference the console shell exposes:
 *
 *  - INTERFACE (console ↔ desktop). The desktop UI is deprecated (CLAUDE.md):
 *    the console shell is the DEFAULT even with no controller attached, and
 *    desktop is reachable ONLY from here. Picking it stores the choice
 *    (`tm_console_mode` = '0' via setConsoleMode), so it survives reloads and
 *    the Electron/pad auto-enable heuristics (consoleModeExplicitlyDisabled)
 *    never force console back.
 *  - DISPLAY (the layout profile — Auto / Handheld / Standard / Large / TV 4K,
 *    persisted to `tm_console_profile`, the store `?consoleProfile=` uses).
 *    A cycles the value in place; the diagnostics block below shows what the
 *    choice resolves to (profile / viewport / panel / DPR / scale / why).
 *
 * Both settings used to live behind the in-game System menu; a value that
 * relabels in place plus a conditional diag block re-laid that fixed-shape
 * menu out under the d-pad cursor. This screen is built for it: the rows
 * carry their value on a fixed-width right rail and the diag block is
 * ALWAYS mounted (dimmed when another row is cursored), so nothing moves.
 *
 * Host (ConsoleMainMenu) routes pad intents via `handleIntent`.
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
import {translateText} from '@/client/directives/i18n';

type OptionRowId = 'interface' | 'display';
type OptionRow = {id: OptionRowId, label: string, sub: string, glyph: string, value: string};

export default defineComponent({
  name: 'ConsoleOptionsPanel',
  components: {GamepadGlyph},
  emits: ['close'],
  data() {
    return {consoleLayoutState, consoleModeState, cursor: 0};
  },
  computed: {
    rows(): ReadonlyArray<OptionRow> {
      return [
        {
          // The sub describes the SETTING, never the current value — a
          // value-dependent subtitle would relabel to a different line
          // count and move the rows under the cursor.
          id: 'interface',
          label: 'Interface',
          sub: 'Controller shell or mouse and keyboard',
          glyph: '◫',
          value: translateText(this.consoleModeState.enabled ? 'Console' : 'Desktop'),
        },
        {
          id: 'display',
          label: 'Display',
          sub: 'Layout profile for this screen',
          glyph: '🖥',
          value: this.displayValue,
        },
      ];
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
      }
    },
  },
});
</script>
