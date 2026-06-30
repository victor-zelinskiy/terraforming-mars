<template>
  <div class="pmm-lang" role="group" :aria-label="$t('Language')">
    <button
      v-for="opt in options"
      :key="opt.id"
      type="button"
      class="pmm-lang__chip"
      :class="{'pmm-lang__chip--active': opt.id === currentLang}"
      :aria-pressed="opt.id === currentLang"
      :title="opt.title"
      @click="switchTo(opt.id)"
    >{{ opt.label }}</button>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {LANGUAGES} from '@/common/constants';
import {getPreferences, PreferencesManager} from '@/client/utils/PreferencesManager';

type LangOption = {id: keyof typeof LANGUAGES, label: string, title: string};

// Premium launchers don't want a 17-flag wall — surface the three the fork
// actively maintains. The underlying mechanic is the SAME as LanguageSwitcher
// (PreferencesManager + reload), so anything else still works from /legacy.
const SHOWN: ReadonlyArray<{id: keyof typeof LANGUAGES, label: string}> = [
  {id: 'ru', label: 'RU'},
  {id: 'en', label: 'EN'},
  {id: 'ua', label: 'UA'},
];

export default defineComponent({
  name: 'PremiumLanguageSwitcher',
  data() {
    return {
      currentLang: getPreferences().lang as keyof typeof LANGUAGES,
    };
  },
  computed: {
    options(): ReadonlyArray<LangOption> {
      return SHOWN.map((o) => ({
        ...o,
        title: `${LANGUAGES[o.id][0]} (${LANGUAGES[o.id][1]})`,
      }));
    },
  },
  methods: {
    switchTo(langId: keyof typeof LANGUAGES): void {
      if (langId === this.currentLang) {
        return;
      }
      PreferencesManager.INSTANCE.set('lang', langId);
      window.location.reload();
    },
  },
});
</script>
