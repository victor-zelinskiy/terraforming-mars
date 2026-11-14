<template>
  <div class="vp-tph">
    <ConsoleTeleport :to="to" :disabled="disabled">
      <span v-if="on" class="vp-tph__leaf">{{ n }}</span>
    </ConsoleTeleport>
    <div v-if="zone" id="vp-tph-zone" v-embed-zone class="vp-tph__zone"></div>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * A VAPOR parent of `ConsoleTeleport` (ConsoleTeleport.spec.ts § under a Vapor parent) — the product's own shape: the
 * content is the parent's slot, and the target may be a zone the SAME parent renders, declared with `v-embed-zone`,
 * AFTER the teleport in its template. `measured` is emitted from a POST-flush watcher of the zone's arrival — the
 * moment a surface measures itself after a change (a fit, a FLIP's «last»).
 */
import {watch} from 'vue';
import ConsoleTeleport from '@/client/components/console/foundation/ConsoleTeleport.vue';
import {vEmbedZone} from '@/client/directives/vDirectives';

defineOptions({name: 'VaporTeleportHost'});
const props = withDefaults(defineProps<{to: string, disabled?: boolean, on?: boolean, n?: number, zone?: boolean}>(), {disabled: false, on: true, n: 0, zone: false});
const emit = defineEmits<{measured: []}>();
watch(() => props.zone, () => emit('measured'), {flush: 'post'});
</script>
