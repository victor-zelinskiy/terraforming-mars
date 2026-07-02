<template>
  <div class="con-cmdbar" aria-hidden="true">
    <div class="con-cmdbar__context">{{ $t(context) }}</div>
    <div class="con-cmdbar__cmds">
      <span v-for="(cmd, i) in commands"
            :key="i"
            class="con-cmdbar__cmd"
            :class="{'con-cmdbar__cmd--disabled': cmd.enabled === false}">
        <GamepadGlyph :control="cmd.control" />
        <span class="con-cmdbar__label">{{ $t(cmd.label) }}</span>
      </span>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * THE console command bar (CONSOLE_MODE_CONCEPT.md §6) — the single most
 * important shell element: the CURRENT meaning of every face button, always
 * visible at the bottom. Commands come from the shell's context computed —
 * the same state the router executes by, so the bar can't lie. This is the
 * user-facing answer to "which button does what": no on-screen button
 * exists without its glyph here (and the key objects carry their own
 * inline Ⓐ chips on top).
 */
import {defineComponent, PropType} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {GlyphControl} from '@/client/gamepad/glyphSets';

export type ConsoleCommand = {
  control: GlyphControl,
  /** English i18n key. */
  label: string,
  enabled?: boolean,
};

export default defineComponent({
  name: 'ConsoleCommandBar',
  components: {GamepadGlyph},
  props: {
    context: {type: String, required: true},
    commands: {type: Array as PropType<ReadonlyArray<ConsoleCommand>>, required: true},
  },
});
</script>
