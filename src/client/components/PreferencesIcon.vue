<template>
  <div class="sidebar_item sidebar_item--settings">
    <i class="sidebar_icon sidebar_icon--settings" :title="$t('Player Settings')" :class="{'sidebar_item--is-active': preferencesPanelOpen}" v-on:click="preferencesPanelOpen = !preferencesPanelOpen"></i>
    <preferences-dialog v-show="preferencesPanelOpen" @okButtonClicked="preferencesPanelOpen = false" :preferencesManager="preferencesManager"/>
  </div>
</template>

<script setup vapor lang="ts">

import {computed, ref} from 'vue';
import {$t} from '@/client/directives/i18n';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import PreferencesDialog from '@/client/components/PreferencesDialog.vue';

defineOptions({name: 'PreferencesIcon'});

const preferencesPanelOpen = ref(false);
const preferencesManager = computed((): PreferencesManager => PreferencesManager.INSTANCE);

</script>
