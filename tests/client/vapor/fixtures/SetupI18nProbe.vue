<template>
  <div class="st-i18n" v-trim-whitespace>
    <span class="st-i18n__static" v-i18n>Research phase</span>
    <span class="st-i18n__dynamic" v-i18n>{{ text }}</span>
    <span class="st-i18n__params" v-i18n="[amount]">Draw ${0} cards</span>
    <span class="st-i18n__fn">{{ $t(text) }}</span>
  </div>
</template>

<script setup lang="ts">
// A `<script setup>` component that is NOT Vapor yet: the same two import lines as `VaporI18nProbe.vue` — they do not
// change when the `vapor` attribute is added.
import {$t} from '@/client/directives/i18n';
import {vI18n, vTrimWhitespace} from '@/client/directives/vDirectives';

defineProps<{text: string, amount: number}>();
</script>
