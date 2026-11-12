<template>
  <section class="dd">
    <p class="dd__action" v-i18n v-strip-action-prefix>{{ action }}</p>
    <p class="dd__effect" v-strip-effect-prefix>{{ effect }}</p>
    <div v-if="zone" v-embed-zone class="dd__zone" data-embed-slot="probe"></div>
  </section>
</template>

<script setup vapor lang="ts">
// The project's three LOCAL directives, imported — one binding each, the same line in both runtimes
// (`directives/vDirectives.ts`; RECIPES.md § R17): two that rewrite the element's text after `v-i18n`, one with a
// LIFETIME (`v-embed-zone` registers its element and must unregister it when it leaves).
import {vEmbedZone, vI18n, vStripActionPrefix, vStripEffectPrefix} from '@/client/directives/vDirectives';

defineProps<{action: string, effect: string, zone: boolean}>();
</script>
