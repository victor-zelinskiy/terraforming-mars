<template>
  <div class="language-switcher">
    <template v-for="lang in ALL_LANGUAGES" :key="lang">
    <div
      :class="`language-icon language-icon--${lang} language-icon-for-switcher`"
      :title="title(lang)"
      @click="switchLanguageTo(lang)"
    />
    &nbsp;
    </template>
  </div>
</template>

<script setup lang="ts">
import {ALL_LANGUAGES, LANGUAGES} from '@/common/constants';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {languageSwitcherReload} from '@/client/components/languageSwitcherReload';

defineOptions({name: 'language-switcher'});

function reloadWindow() {
  // The reload is a member of a module, not of this component: a unit spec replaces it there.
  languageSwitcherReload.reload();
}
function switchLanguageTo(langId: string) {
  PreferencesManager.INSTANCE.set('lang', langId);
  reloadWindow();
}
function title(key: keyof typeof LANGUAGES) {
  const lang = LANGUAGES[key];
  return `${lang[0]} (${lang[1]})`;
}
</script>
