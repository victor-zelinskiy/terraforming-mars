<template>
  <!--
    PLANETARY EVENT THRESHOLDS — the console-native «Butterfly Effect» prompt:
    move each threshold up to one step up or down.

    Diegetic and expansion-neutral (the word «Ares» never appears — it is the
    name of a box, not of anything on Mars). Each row states the CONSEQUENCE
    next to the number, because a threshold with no consequence is trivia: the
    player is choosing when erosions appear, not editing a variable.

    data-motion-*: rides the shared `.con-shade` dim + the surface-motion
    director — no own backdrop.
  -->
  <div class="con-ares con-ws" role="dialog" :aria-label="$t('Shift the planetary event thresholds')"
       data-motion-surface="ares-globals">
    <div class="con-ares__panel" data-motion-panel>
      <header class="con-ares__head">
        <div class="con-ares__kicker">
          <span class="con-ares__kicker-mark" aria-hidden="true">◈</span>
          <span>{{ $t('Planetary events') }}</span>
        </div>
        <div class="con-ares__title">{{ $t('Shift the planetary event thresholds') }}</div>
        <div class="con-ares__lead">{{ $t('Move each threshold up to 1 step up or down.') }}</div>
        <!-- Nothing is forced here: standing pat is a real answer, and the
             surface says so rather than letting the player hunt for it. -->
        <div class="con-ares__count" :class="{'con-ares__count--idle': changedCount === 0}">
          {{ changedCount === 0 ? $t('No changes') : shiftedText }}
        </div>
      </header>

      <div class="con-ares__rows">
        <div v-for="(row, i) in rows" :key="row.key"
             class="con-ares__row"
             :class="{
               'con-ares__row--focused': focusIdx === i,
               'con-ares__row--changed': deltaOf(row) !== 0,
             }">
          <div class="con-ares__id">
            <span class="con-ares__frame">
              <i class="con-ares__icon" :class="row.iconClass" aria-hidden="true"></i>
            </span>
            <span class="con-ares__names">
              <span class="con-ares__name">{{ $t(row.label) }}</span>
              <span class="con-ares__effect">{{ $t(row.effectKey) }}</span>
            </span>
          </div>

          <!-- current → resulting, in the parameter's OWN unit (°C moves two
               per step — the player must never have to know that). -->
          <span class="con-ares__values">
            <span class="con-ares__cur" :class="{'con-ares__cur--faded': deltaOf(row) !== 0}">{{ row.threshold }}{{ row.unit }}</span>
            <template v-if="deltaOf(row) !== 0">
              <span class="con-ares__arrow" aria-hidden="true">→</span>
              <span class="con-ares__next">{{ resultingOf(row) }}{{ row.unit }}</span>
            </template>
          </span>

          <!-- A three-state segmented control, driven by LB / RB so the whole
               screen answers to the same two shoulder buttons every other
               stepper in the shell uses. -->
          <span class="con-ares__seg" role="group">
            <span v-for="opt in OPTIONS" :key="opt"
                  class="con-ares__seg-cell"
                  :class="{
                    'con-ares__seg-cell--on': deltaOf(row) === opt,
                    'con-ares__seg-cell--down': opt === -1,
                    'con-ares__seg-cell--up': opt === 1,
                  }">{{ segLabel(opt) }}</span>
          </span>

          <span class="con-ares__keys" aria-hidden="true">
            <template v-if="focusIdx === i">
              <GamepadGlyph control="bumperL" /><GamepadGlyph control="bumperR" />
            </template>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * Presentation + the pad contract. WHICH rows exist, what each one means and
 * how a step maps onto its parameter live in the pure `compositePrompts`
 * adapter, so the rules are unit-tested without mounting this component.
 */
import {defineComponent, PropType} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ShiftAresGlobalParametersModel} from '@/common/models/PlayerInputModel';
import {translateTextWithParams} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {clearPanelCommands, setPanelCommands} from '@/client/console/consolePanelUi';
import {
  AresDelta, AresDeltaKey, AresThresholdRow, aresResponse, aresResulting, aresThresholdRows,
} from '@/client/console/compositePrompts';

const OPTIONS: ReadonlyArray<AresDelta> = [-1, 0, 1];

export default defineComponent({
  name: 'ConsoleAresGlobals',
  components: {GamepadGlyph},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  },
  emits: ['submit', 'defer'],
  data() {
    return {
      focusIdx: 0,
      deltas: {} as Partial<Record<AresDeltaKey, AresDelta>>,
      submitting: false,
      OPTIONS,
    };
  },
  computed: {
    model(): ShiftAresGlobalParametersModel | undefined {
      const wf = this.playerView.waitingFor;
      return wf?.type === 'aresGlobalParameters' ? (wf as ShiftAresGlobalParametersModel) : undefined;
    },
    rows(): ReadonlyArray<AresThresholdRow> {
      return this.model === undefined ? [] : aresThresholdRows(this.model);
    },
    changedCount(): number {
      return this.rows.filter((row) => this.deltaOf(row) !== 0).length;
    },
    shiftedText(): string {
      return translateTextWithParams('Shifted: ${0}', [String(this.changedCount)]);
    },
    promptKey(): string {
      return this.rows.map((r) => `${r.key}:${r.threshold}`).join('|');
    },
    footCommands(): Array<ConsoleCommand> {
      return [
        {control: 'dpad', label: 'Navigate'},
        {control: 'bumperL', label: '−1'},
        {control: 'bumperR', label: '+1'},
        // ALWAYS enabled: leaving every threshold alone is a legitimate answer,
        // and a disabled confirm would read as "you must change something".
        {control: 'secondary', label: 'Apply'},
        {control: 'back', label: 'Minimize'},
      ];
    },
  },
  watch: {
    promptKey: {
      immediate: true,
      handler() {
        this.reset();
      },
    },
    playerView() {
      this.submitting = false;
    },
    footCommands: {
      immediate: true,
      deep: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>) {
        setPanelCommands('aresGlobals', cmds);
      },
    },
  },
  beforeUnmount() {
    clearPanelCommands('aresGlobals');
  },
  methods: {
    deltaOf(row: AresThresholdRow): AresDelta {
      return this.deltas[row.key] ?? 0;
    },
    resultingOf(row: AresThresholdRow): number {
      return aresResulting(row, this.deltaOf(row));
    },
    segLabel(opt: AresDelta): string {
      return opt === 0 ? '0' : opt > 0 ? '+1' : '−1';
    },
    reset(): void {
      this.submitting = false;
      this.focusIdx = 0;
      this.deltas = {};
    },
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        if (intent.dir === 'up' || intent.dir === 'down') {
          this.focusIdx = Math.min(this.rows.length - 1, Math.max(0, this.focusIdx + (intent.dir === 'down' ? 1 : -1)));
        } else {
          // Left / right nudge the focused threshold too — the segmented
          // control looks horizontal, so the d-pad must agree with it.
          this.step(intent.dir === 'right' ? 1 : -1);
        }
        return;
      }
      switch (consoleActionOf(intent)) {
      case 'prevSection':
        this.step(-1);
        return;
      case 'nextSection':
        this.step(1);
        return;
      case 'inspect': // X — apply
        this.apply();
        return;
      case 'back':
        this.$emit('defer');
        return;
      default:
        return;
      }
    },
    /** Clamped to [−1, +1]: the rules allow ONE step per threshold. */
    step(delta: number): void {
      const row = this.rows[this.focusIdx];
      if (row === undefined) {
        return;
      }
      const next = Math.min(1, Math.max(-1, this.deltaOf(row) + delta)) as AresDelta;
      this.deltas = {...this.deltas, [row.key]: next};
    },
    apply(): void {
      if (this.submitting) {
        return;
      }
      this.submitting = true;
      this.$emit('submit', aresResponse(this.deltas));
    },
  },
});
</script>
