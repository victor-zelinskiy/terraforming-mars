<template>
  <div class="ma-hero" :class="['ma-hero--' + kind, {'ma-hero--fallback': failed}]" aria-hidden="true">
    <img v-if="!failed"
         class="ma-hero__img"
         :src="artUrl"
         alt=""
         draggable="false"
         @error="failed = true" />
    <span v-else class="ma-hero__glyph">{{ kind === 'milestone' ? '🏆' : '🏅' }}</span>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * THE TEMPLATE (the comment that opened it — it starts with its root now):
 *
 * The milestone/award HERO art — built for the transparent 512×512 premium
 * icon format: an <img> with `object-fit: contain` (NEVER cropped; legacy
 * 140×83 assets letterbox gracefully), sitting on whatever pedestal/glow
 * stage the host composes around it. A MISSING asset degrades to a calm
 * kind-emblem (trophy / medal) instead of a broken image — the host's
 * stage chrome stays intact either way.
 */
import {computed, PropType, ref, watch} from 'vue';
import {maArtUrl, MaKind} from '@/client/components/ma/maArt';

defineOptions({name: 'MaHeroArt'});
const props = defineProps({
  name: {type: String, required: true},
  kind: {type: String as PropType<MaKind>, required: true},
});

const failed = ref(false);
const artUrl = computed((): string => maArtUrl(props.name));

// Re-pointing the SAME component instance at a different item must
// re-attempt the asset (the failure is per-name, not per-instance).
watch(() => props.name, () => {
  failed.value = false;
});
</script>
