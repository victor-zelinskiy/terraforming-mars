<template>
  <div ref="root" class="con-cmdbar" :class="{'con-cmdbar--bay': bay}" aria-hidden="true">
    <div class="con-cmdbar__zone-left">
      <div class="con-cmdbar__context">{{ $t(context) }}</div>
      <div v-if="bay && cmdsLeft.length > 0" class="con-cmdbar__cmds con-cmdbar__cmds--left">
        <span v-for="(cmd, i) in cmdsLeft"
              :key="'l' + i"
              class="con-cmdbar__cmd"
              :class="{'con-cmdbar__cmd--disabled': cmd.enabled === false, 'con-cmdbar__cmd--hot': cmd.highlight === true, 'con-cmdbar__cmd--danger': cmd.tone === 'danger'}">
          <template v-if="cmd.spread === true && cmd.control2 !== undefined">
            <GamepadGlyph :control="cmd.control" />
            <span class="con-cmdbar__spread-arrow" aria-hidden="true">◀</span>
            <span class="con-cmdbar__label">{{ cmdLabel(cmd) }}</span>
            <span class="con-cmdbar__spread-arrow" aria-hidden="true">▶</span>
            <GamepadGlyph :control="cmd.control2" />
          </template>
          <template v-else>
          <!-- A HOLD press wears the shared progress ring around its glyph, so
               «удерживать» is something the player watches happen instead of a
               word they have to take on trust. One ring for the whole console
               (consoleHoldConfirm) — never a per-surface affordance. -->
          <span v-if="cmd.hold === true" class="con-cmdbar__hold"
                :style="{'--con-hold-progress': holdProgress}"
                :class="{'con-cmdbar__hold--live': holdProgress > 0}">
            <GamepadGlyph :control="cmd.control" />
          </span>
          <GamepadGlyph v-else :control="cmd.control" />
            <GamepadGlyph v-if="cmd.control2 !== undefined" :control="cmd.control2" />
            <span class="con-cmdbar__label">{{ cmdLabel(cmd) }}</span>
            <span v-if="cmd.badge !== undefined && cmd.badge > 0" class="con-cmdbar__badge" :class="{'con-cmdbar__badge--neutral': cmd.badgeTone === 'neutral'}" :data-badge-tone="cmd.badgeTone ?? 'go'">{{ cmd.badge }}</span>
          </template>
        </span>
      </div>
    </div>
    <!-- The reserved centre BAY track — an empty grid spacer the hand dock
         (a footer sibling) sits over. Deliberately NO visuals of its own:
         the dock's plate IS the socket, welded straight into the bar. -->
    <div v-if="bay" class="con-cmdbar__bay"></div>
    <div class="con-cmdbar__cmds" :class="{'con-cmdbar__cmds--right': bay}">
      <span v-for="(cmd, i) in cmdsRight"
            :key="i"
            class="con-cmdbar__cmd"
            :class="{'con-cmdbar__cmd--disabled': cmd.enabled === false, 'con-cmdbar__cmd--hot': cmd.highlight === true, 'con-cmdbar__cmd--danger': cmd.tone === 'danger'}">
        <template v-if="cmd.spread === true && cmd.control2 !== undefined">
          <GamepadGlyph :control="cmd.control" />
          <span class="con-cmdbar__spread-arrow" aria-hidden="true">◀</span>
          <span class="con-cmdbar__label">{{ cmdLabel(cmd) }}</span>
          <span class="con-cmdbar__spread-arrow" aria-hidden="true">▶</span>
          <GamepadGlyph :control="cmd.control2" />
        </template>
        <template v-else>
          <!-- A HOLD press wears the shared progress ring around its glyph, so
               «удерживать» is something the player watches happen instead of a
               word they have to take on trust. One ring for the whole console
               (consoleHoldConfirm) — never a per-surface affordance. -->
          <span v-if="cmd.hold === true" class="con-cmdbar__hold"
                :style="{'--con-hold-progress': holdProgress}"
                :class="{'con-cmdbar__hold--live': holdProgress > 0}">
            <GamepadGlyph :control="cmd.control" />
          </span>
          <GamepadGlyph v-else :control="cmd.control" />
          <GamepadGlyph v-if="cmd.control2 !== undefined" :control="cmd.control2" />
          <span class="con-cmdbar__label">{{ cmdLabel(cmd) }}</span>
          <span v-if="cmd.badge !== undefined && cmd.badge > 0" class="con-cmdbar__badge" :class="{'con-cmdbar__badge--neutral': cmd.badgeTone === 'neutral'}" :data-badge-tone="cmd.badgeTone ?? 'go'">{{ cmd.badge }}</span>
        </template>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * THE console command bar (docs/CONSOLE_MODE_CONCEPT.md §6) — the single most
 * important shell element: the CURRENT meaning of every face button, always
 * visible at the bottom. Commands come from the shell's context computed —
 * the same state the router executes by, so the bar can't lie. This is the
 * user-facing answer to "which button does what": no on-screen button
 * exists without its glyph here (and the key objects carry their own
 * inline Ⓐ chips on top).
 *
 * BAY mode (`bay` — the in-game shell only): the bar reserves a centre
 * track (`--con-hd-bay`, mathematically centred on the viewport — the grid
 * splits the remaining width symmetrically) as the socket of the permanent
 * hand dock (ConsoleHandDock). The hint run keeps its right-anchored
 * convention: commands pack from the RIGHT while they fit the right zone
 * (a pure width estimate — consoleHandDock.bayCommandSplit), the remainder
 * flows to the left zone beside the context label. The menus / bot-review
 * embed the bar WITHOUT the bay — their layout is byte-identical to before.
 */
import {computed, nextTick, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

import {useConsoleViewport} from '@/client/console/composables/useConsoleViewport';
import {commandWidthRem, contextWidthRem, handDockBayRem} from '@/client/console/consoleHandDock';
import {ConsoleCommand, defaultDropPriority, planCommandRun} from '@/client/console/consoleCommandModel';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {holdConfirmState} from '@/client/console/consoleHoldConfirm';
import {LabelFont, labelFontOf, measureTextPx} from '@/client/console/consoleTextMeasure';

/* The type lives in consoleCommandModel.ts (pure TS — importable by plain
 * .ts modules); re-exported here so the existing .vue importers keep their
 * `from 'ConsoleCommandBar.vue'` path. */
export type {ConsoleCommand};

defineOptions({name: 'ConsoleCommandBar'});
const props = defineProps({
  context: {type: String, required: true},
  commands: {type: Array as PropType<ReadonlyArray<ConsoleCommand>>, required: true},
  /** Reserve the centre hand-dock bay (the in-game shell footer). */
  bay: {type: Boolean, default: false},
});

const {width: vpWidth, profile, uiScale} = useConsoleViewport();
const root = useTemplateRef<HTMLElement>('root');
/** The bar's own label font (read off a rendered label; the fit plan measures with it — P-15). */
const labelFont = ref<LabelFont | undefined>(undefined);
const contextFont = ref<LabelFont | undefined>(undefined);

/**
 * The live progress of the SHARED hold gate (`consoleHoldConfirm`). Read
 * globally on purpose: the bar shows at most one hold command at a time,
 * so it needs no key of its own and cannot fall out of sync with whichever
 * surface armed the hold.
 */
const holdProgress = computed((): number => {
  return holdConfirmState.key === '' ? 0 : holdConfirmState.progress;
});
/**
 * The TV fit plan: which commands RENDER and how they split around the
 * bay. When the run overflows both zone budgets, whole low-priority
 * commands DROP (consoleCommandModel) — a hint label never truncates.
 * Classic (non-bay) bars keep every command (menus are hint-light).
 */
const runPlan = computed((): {kept: ReadonlyArray<number>, splitIndex: number} => {
  const all = props.commands.map((_, i) => i);
  if (!props.bay || props.commands.length === 0) {
    return {kept: all, splitIndex: 0};
  }
  const remPx = 20 * (uiScale.value || 1);
  const wRem = vpWidth.value / remPx;
  // The rail's content inset (--con-hud-pad-x = --con-pad-x + breathing):
  // the bar is FULL-BLEED now, so the whole horizontal inset lives on the
  // bar itself (console.less / console_tv.less). rootPad mirrors the
  // EDGE token --con-edge-x per profile (constants since the mirrored
  // edge system replaced the vw-sized gutter), barPad the extra
  // breathing.
  const rootPad = profile.value === 'tv' ? 0.7 :
    (profile.value === 'handheld' ? 0.45 : 0.6);
  // Mirrors the alignment-grammar breathing of --con-hud-pad-x (the
  // shared first-content anchor: safe area + ~the rail's interior).
  const barPad = profile.value === 'handheld' ? 0.85 : 1.05;
  const halfRem = wRem / 2 - handDockBayRem(profile.value) / 2 - rootPad - barPad - 1;
  // The width estimate (`commandWidthRem`) is calibrated for the COMPACT
  // bay typography (label .95rem / glyph 1.3rem). The TV profile renders
  // the labels + glyphs LARGER (console_tv.less: label 1.05rem, glyph
  // floor 1.55rem), so the raw estimate UNDER-counts — the fit model then
  // keeps more commands than fit and the CSS truncates their labels (the
  // exact broken bar on 4K). Scaling the estimate up at TV restores the
  // model's contract: whole low-priority hints DROP (A/B always kept),
  // labels never truncate. Conservative on purpose — a dropped step hint
  // (the logic still works; the step chips show the structure) beats a
  // clipped one.
  const wScale = profile.value === 'tv' ? 1.15 : 1;
  // MEASURED labels (consoleTextMeasure) once the bar has painted a label: the chrome (glyphs,
  // gaps, badge) keeps the estimate scaled for the TV, the words are their painted width — a
  // 2 % margin for the runner's glyph rounding. Before the first paint: the coarse estimate.
  const labelRem = (text: string, font: LabelFont | undefined): number | undefined => {
    const px = font === undefined ? undefined : measureTextPx(text, font);
    return px === undefined ? undefined : (px * 1.02) / remPx;
  };
  const contextText = translateText(props.context);
  const contextMeasured = labelRem(contextText, contextFont.value);
  const zoneLeft = halfRem - (contextMeasured === undefined ?
    contextWidthRem(contextText) * wScale :
    contextWidthRem('', 0) * wScale + contextMeasured);
  const entries = props.commands.map((c) => ({
    // The estimate measures the RENDERED text — params included, or a
    // parameterised label under-counts and truncates on 4K.
    width: ((): number => {
      const text = cmdLabel(c);
      const opts = {badge: c.badge !== undefined && c.badge > 0, twoGlyphs: c.control2 !== undefined};
      const measured = labelRem(text, labelFont.value);
      return measured === undefined ?
        commandWidthRem(text, opts) * wScale :
        commandWidthRem('', {...opts, labelRem: 0}) * wScale + measured;
    })(),
    keep: c.control === 'confirm' || c.control === 'back',
    dropPriority: c.priority ?? defaultDropPriority(c.control),
  }));
  const plan = planCommandRun(entries, zoneLeft, halfRem);
  return {kept: plan.kept, splitIndex: plan.splitIndex};
});
const cmdsLeft = computed((): ReadonlyArray<ConsoleCommand> => {
  const {kept, splitIndex} = runPlan.value;
  return kept.slice(0, splitIndex).map((i) => props.commands[i]);
});
const cmdsRight = computed((): ReadonlyArray<ConsoleCommand> => {
  const {kept, splitIndex} = runPlan.value;
  return kept.slice(splitIndex).map((i) => props.commands[i]);
});

/** The fonts the bar paints its labels and its context with — read off the DOM, re-read per profile. */
function readFonts(): void {
  const rootNow = root.value;
  if (rootNow === null || typeof rootNow.querySelector !== 'function') {
    return;
  }
  labelFont.value = labelFontOf(rootNow.querySelector('.con-cmdbar__label')) ?? labelFont.value;
  contextFont.value = labelFontOf(rootNow.querySelector('.con-cmdbar__context')) ?? contextFont.value;
}
/** A hint's rendered text: the plain key, or the `${0}`-parameterised
 *  key interpolated with its (already translated) params. */
function cmdLabel(cmd: ConsoleCommand): string {
  return cmd.labelParams !== undefined ?
    translateTextWithParams(cmd.label, [...cmd.labelParams]) :
    translateText(cmd.label);
}

watch(() => profile.value, () => {
  void nextTick(() => readFonts());
});
watch(() => props.commands, () => {
  if (labelFont.value === undefined) {
    void nextTick(() => readFonts());
  }
});
onMounted(() => {
  readFonts();
});
</script>
