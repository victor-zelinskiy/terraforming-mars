<template>
  <div class="con-sections" aria-hidden="true">
    <GamepadGlyph control="bumperL" class="con-sections__bumper" />
    <div class="con-sections__tabs">
      <span v-for="s in sections"
            :key="s.id"
            class="con-sections__tab"
            :class="{'con-sections__tab--active': s.id === section}">{{ $t(s.label) }}</span>
    </div>
    <GamepadGlyph control="bumperR" class="con-sections__bumper" />
  </div>
</template>

<script lang="ts">
/**
 * Console section strip (CONSOLE_MODE_CONCEPT.md §5/§6) — the wayfinder.
 * LB/RB glyphs bracket the tabs so the switching control is self-evident.
 */
import {defineComponent, PropType} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {CONSOLE_SECTIONS, ConsoleSection} from '@/client/console/consoleRouter';

const LABELS: Record<ConsoleSection, string> = {
  board: 'Board',
  hand: 'Hand',
};

export default defineComponent({
  name: 'ConsoleSectionStrip',
  components: {GamepadGlyph},
  props: {
    section: {type: String as PropType<ConsoleSection>, required: true},
  },
  computed: {
    sections(): Array<{id: ConsoleSection, label: string}> {
      return CONSOLE_SECTIONS.map((id) => ({id, label: LABELS[id]}));
    },
  },
});
</script>
