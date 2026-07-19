<template>
  <span class="gp-glyph" :class="['gp-glyph--' + spec.shape, {'gp-glyph--toned': spec.tone !== ''}]" :style="toneStyle" aria-hidden="true">{{ spec.label }}</span>
</template>

<script lang="ts">
/**
 * One controller button badge (docs/GAMEPAD_SUPPORT_DESIGN.md §6). Drawn with
 * CSS only (no image assets, mirrors BarButtonIcon's asset-free approach):
 * a dark-glass chassis + the glyph-set's toned label. Semantic `control`
 * in, platform presentation out — the Xbox set is the only one today.
 */
import {defineComponent, PropType} from 'vue';
import {GlyphControl, GlyphSpec, activeGlyphSet} from '@/client/gamepad/glyphSets';

export default defineComponent({
  name: 'GamepadGlyph',
  props: {
    control: {type: String as PropType<GlyphControl>, required: true},
  },
  computed: {
    spec(): GlyphSpec {
      return activeGlyphSet()[this.control];
    },
    toneStyle(): Record<string, string> {
      return this.spec.tone !== '' ? {'--gp-glyph-tone': this.spec.tone} : {};
    },
  },
});
</script>
