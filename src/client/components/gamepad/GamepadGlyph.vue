<template>
  <span class="gp-glyph" :class="['gp-glyph--' + spec.shape, {'gp-glyph--toned': spec.tone !== ''}]" :style="toneStyle" aria-hidden="true">{{ spec.label }}</span>
</template>

<script setup vapor lang="ts">
/**
 * One controller button badge (docs/GAMEPAD_SUPPORT_DESIGN.md §6). Drawn with
 * CSS only (no image assets, mirrors BarButtonIcon's asset-free approach):
 * a dark-glass chassis + the glyph-set's toned label. Semantic `control`
 * in, platform presentation out — the Xbox set is the only one today.
 */
import {computed, PropType} from 'vue';
import {GlyphControl, GlyphSpec, activeGlyphSet} from '@/client/gamepad/glyphSets';

defineOptions({name: 'GamepadGlyph'});
const props = defineProps({
  control: {type: String as PropType<GlyphControl>, required: true},
});

const spec = computed((): GlyphSpec => activeGlyphSet()[props.control]);
const toneStyle = computed((): Record<string, string> => spec.value.tone !== '' ? {'--gp-glyph-tone': spec.value.tone} : {});
</script>
