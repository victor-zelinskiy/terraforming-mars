<template>
  <div class="con-cmdbar" :class="{'con-cmdbar--bay': bay}" aria-hidden="true">
    <div class="con-cmdbar__zone-left">
      <div class="con-cmdbar__context">{{ $t(context) }}</div>
      <div v-if="bay && cmdsLeft.length > 0" class="con-cmdbar__cmds con-cmdbar__cmds--left">
        <span v-for="(cmd, i) in cmdsLeft"
              :key="'l' + i"
              class="con-cmdbar__cmd"
              :class="{'con-cmdbar__cmd--disabled': cmd.enabled === false, 'con-cmdbar__cmd--hot': cmd.highlight === true}">
          <GamepadGlyph :control="cmd.control" />
          <GamepadGlyph v-if="cmd.control2 !== undefined" :control="cmd.control2" />
          <span class="con-cmdbar__label">{{ $t(cmd.label) }}</span>
          <span v-if="cmd.badge !== undefined && cmd.badge > 0" class="con-cmdbar__badge">{{ cmd.badge }}</span>
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
            :class="{'con-cmdbar__cmd--disabled': cmd.enabled === false, 'con-cmdbar__cmd--hot': cmd.highlight === true}">
        <GamepadGlyph :control="cmd.control" />
        <GamepadGlyph v-if="cmd.control2 !== undefined" :control="cmd.control2" />
        <span class="con-cmdbar__label">{{ $t(cmd.label) }}</span>
        <span v-if="cmd.badge !== undefined && cmd.badge > 0" class="con-cmdbar__badge">{{ cmd.badge }}</span>
      </span>
    </div>
  </div>
</template>

<script lang="ts">
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
import {defineComponent, PropType} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

import {useConsoleViewport} from '@/client/console/composables/useConsoleViewport';
import {commandWidthRem, contextWidthRem, handDockBayRem} from '@/client/console/consoleHandDock';
import {ConsoleCommand, defaultDropPriority, planCommandRun} from '@/client/console/consoleCommandModel';
import {translateText} from '@/client/directives/i18n';

/* The type lives in consoleCommandModel.ts (pure TS — importable by plain
 * .ts modules); re-exported here so the existing .vue importers keep their
 * `from 'ConsoleCommandBar.vue'` path. */
export type {ConsoleCommand};

export default defineComponent({
  name: 'ConsoleCommandBar',
  components: {GamepadGlyph},
  props: {
    context: {type: String, required: true},
    commands: {type: Array as PropType<ReadonlyArray<ConsoleCommand>>, required: true},
    /** Reserve the centre hand-dock bay (the in-game shell footer). */
    bay: {type: Boolean, default: false},
  },
  setup() {
    const {width, profile, uiScale} = useConsoleViewport();
    return {vpWidth: width, profile, uiScale};
  },
  computed: {
    /**
     * The TV fit plan: which commands RENDER and how they split around the
     * bay. When the run overflows both zone budgets, whole low-priority
     * commands DROP (consoleCommandModel) — a hint label never truncates.
     * Classic (non-bay) bars keep every command (menus are hint-light).
     */
    runPlan(): {kept: ReadonlyArray<number>, splitIndex: number} {
      const all = this.commands.map((_, i) => i);
      if (!this.bay || this.commands.length === 0) {
        return {kept: all, splitIndex: 0};
      }
      const remPx = 20 * (this.uiScale || 1);
      const wRem = this.vpWidth / remPx;
      // Root horizontal padding per profile (console.less / console_tv.less).
      const rootPad = this.profile === 'tv' ?
        Math.min(3.4, Math.max(1, wRem * 0.032)) :
        wRem * (this.profile === 'handheld' ? 0.007 : 0.016);
      const barPad = this.profile === 'handheld' ? 0.7 : 1.2;
      const halfRem = wRem / 2 - handDockBayRem(this.profile) / 2 - rootPad - barPad - 1;
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
      const wScale = this.profile === 'tv' ? 1.15 : 1;
      const zoneLeft = halfRem - contextWidthRem(translateText(this.context)) * wScale;
      const entries = this.commands.map((c) => ({
        width: commandWidthRem(translateText(c.label), {
          badge: c.badge !== undefined && c.badge > 0,
          twoGlyphs: c.control2 !== undefined,
        }) * wScale,
        keep: c.control === 'confirm' || c.control === 'back',
        dropPriority: c.priority ?? defaultDropPriority(c.control),
      }));
      const plan = planCommandRun(entries, zoneLeft, halfRem);
      return {kept: plan.kept, splitIndex: plan.splitIndex};
    },
    cmdsLeft(): ReadonlyArray<ConsoleCommand> {
      const {kept, splitIndex} = this.runPlan;
      return kept.slice(0, splitIndex).map((i) => this.commands[i]);
    },
    cmdsRight(): ReadonlyArray<ConsoleCommand> {
      const {kept, splitIndex} = this.runPlan;
      return kept.slice(splitIndex).map((i) => this.commands[i]);
    },
  },
});
</script>
