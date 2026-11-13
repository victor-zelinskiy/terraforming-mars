<template>
  <div class="cm-overlay" role="dialog" :aria-label="$t('Language')">
    <div class="cm-overlay__card">
      <div class="cm-overlay__title">{{ $t('Language') }}</div>
      <div class="cm-langlist">
        <button
          v-for="(opt, i) in options"
          :key="opt.id"
          type="button"
          class="cm-lang"
          :class="{'cm-lang--cursor': i === cursor, 'cm-lang--current': opt.id === currentLang}"
          @click="pick(i)"
          @mousemove="cursor = i"
        >
          <span class="cm-lang__code">{{ opt.code }}</span>
          <span class="cm-lang__name">{{ opt.native }}</span>
          <span v-if="opt.id === currentLang" class="cm-lang__current-tag">{{ $t('Current') }}</span>
        </button>
      </div>
      <div class="cm-overlay__foot">
        <span class="cm-overlay__foot-hint"><GamepadGlyph control="confirm" />{{ $t('Select') }}</span>
        <span class="cm-overlay__foot-hint"><GamepadGlyph control="back" />{{ $t('Close') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Console-native LANGUAGE picker — the unobtrusive replacement for the
 * desktop footer's flag-chip row. Opened by a hotkey (Y on the main menu),
 * a small cursor list of the three actively-maintained locales; A applies
 * (PreferencesManager + reload, byte-identical to PremiumLanguageSwitcher),
 * B closes. Host routes pad intents via `handleIntent`.
 */
import {computed, ref} from 'vue';
import {$t} from '@/client/directives/i18n';
import {LANGUAGES, LANGUAGE} from '@/common/constants';
import {getPreferences, PreferencesManager} from '@/client/utils/PreferencesManager';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

type LangOption = {id: LANGUAGE, code: string, native: string};

// The same curated subset the desktop premium switcher surfaces — the fork
// maintains ru/en/ua; anything else is still reachable from /legacy.
const SHOWN: ReadonlyArray<{id: LANGUAGE, code: string}> = [
  {id: 'ru', code: 'RU'},
  {id: 'en', code: 'EN'},
  {id: 'ua', code: 'UA'},
];

defineOptions({name: 'ConsoleLanguagePicker'});
const emit = defineEmits(['close']);

const currentLang = ref(getPreferences().lang as LANGUAGE);
const cursor = ref(Math.max(0, SHOWN.findIndex((o) => o.id === currentLang.value)));
const options = computed((): ReadonlyArray<LangOption> => {
  return SHOWN.map((o) => ({...o, native: LANGUAGES[o.id][0]}));
});
/** Host-routed pad intents. Returns true when consumed. */
function handleIntent(intent: GamepadIntent): boolean {
  if (intent.kind === 'nav' && (intent.dir === 'up' || intent.dir === 'down')) {
    const next = cursor.value + (intent.dir === 'down' ? 1 : -1);
    cursor.value = Math.min(options.value.length - 1, Math.max(0, next));
    return true;
  }
  if (intent.kind === 'press' && intent.button === 'confirm') {
    pick(cursor.value);
    return true;
  }
  if (intent.kind === 'press' && intent.button === 'back') {
    emit('close');
    return true;
  }
  return true;
}
function pick(i: number): void {
  cursor.value = i;
  const opt = options.value[i];
  if (opt === undefined || opt.id === currentLang.value) {
    emit('close');
    return;
  }
  PreferencesManager.INSTANCE.set('lang', opt.id);
  window.location.reload();
}

// What `ConsoleMainMenu` reaches through its `ref="language"`: `handleIntent` — and nothing else (it routes the pad's
// intents here while the picker is the open overlay).
defineExpose({handleIntent});
</script>
