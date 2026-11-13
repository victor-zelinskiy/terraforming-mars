<template>
  <div class="help-hotkeys">
    <div class="keys">
      <div v-i18n>Main Board</div>
      <div v-i18n>Players Overview Table</div>
      <div v-i18n>Cards in Hand</div>
      <div v-i18n>Colonies</div>
    </div>
  </div>
  <div class="help-hotkeys-example"></div>
</template>

<script setup vapor lang="ts">
import {vI18n} from '@/client/directives/vDirectives';

defineOptions({name: 'HelpHotkeys'});
</script>
