<template>
  <div class="vp-i18n" v-trim-whitespace>
    <span class="vp-i18n__static" v-i18n>Research phase</span>
    <span class="vp-i18n__dynamic" v-i18n>{{ text }}</span>
    <span class="vp-i18n__params" v-i18n="[amount]">Draw ${0} cards</span>
    <span v-if="extra" class="vp-i18n__late" v-i18n>Action phase</span>
    <span class="vp-i18n__fn">{{ $t(text) }}</span>
  </div>
</template>

<script setup vapor lang="ts">
// The recipe of a converted component: the directives and `$t` are IMPORTED — a `<script setup>` binding named
// `vI18n` is `v-i18n`; `$t` in the template is the binding, not `app.config.globalProperties`.
import {$t} from '@/client/directives/i18n';
import {vI18n, vTrimWhitespace} from '@/client/directives/vDirectives';

defineProps<{text: string, amount: number, extra: boolean}>();
</script>
