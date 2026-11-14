<template>
    <div class="preferences_panel" :data="syncPreferences()">
      <div class="preferences_panel_item">
        <label class="form-switch">
          <input type="checkbox" v-on:change="updatePreferences" v-model="prefs.hide_awards_and_milestones" data-test="hide_awards_and_milestones">
          <i class="form-icon"></i> <span v-i18n>Hide awards and milestones</span>
        </label>
      </div>
      <div class="preferences_panel_item">
        <label class="form-switch">
          <input type="checkbox" v-on:change="updatePreferences" v-model="prefs.small_cards" data-test="small_cards">
          <i class="form-icon"></i> <span v-i18n>Smaller cards</span>
        </label>
      </div>
      <div class="preferences_panel_item">
        <label class="form-switch">
          <input type="checkbox" v-on:change="updatePreferences" v-model="prefs.magnify_cards" data-test="magnify_cards">
          <i class="form-icon"></i> <span v-i18n>Magnify cards on hover</span>
        </label>
      </div>
      <div class="preferences_panel_item">
        <label class="form-switch">
          <input type="checkbox" v-on:change="updatePreferences" v-model="prefs.fullscreen_cards_on_dblclick" data-test="fullscreen_cards_on_dblclick">
          <i class="form-icon"></i> <span v-i18n>Fullscreen card on click</span>
        </label>
      </div>
      <div class="preferences_panel_item">
        <label class="form-switch">
          <input type="checkbox" v-on:change="updatePreferences" v-model="prefs.hide_discount_on_cards" data-test="hide_discount_on_cards">
          <i class="form-icon"></i> <span v-i18n>Hide discount on cards</span>
        </label>
      </div>
      <div class="preferences_panel_item">
        <label class="form-switch">
          <input type="checkbox" v-on:change="updatePreferences" v-model="prefs.remove_background" data-test="remove_background">
          <i class="form-icon"></i> <span v-i18n>Remove background image</span>
        </label>
      </div>
      <div class="preferences_panel_item">
        <label class="form-switch">
          <input type="checkbox" v-on:change="updatePreferences" v-model="prefs.show_alerts" data-test="show_alerts">
          <i class="form-icon"></i> <span v-i18n>Show in-game alerts</span>
        </label>
      </div>
      <div class="preferences_panel_item">
        <label class="form-switch">
          <input type="checkbox" v-on:change="updatePreferences" v-model="prefs.enable_sounds" data-test="enable_sounds">
          <i class="form-icon"></i> <span v-i18n>Enable sounds</span>
        </label>
      </div>
      <div class="preferences_panel_item">
        <label class="form-switch">
          <input type="checkbox" v-on:change="updatePreferences" v-model="prefs.hide_animated_sidebar" data-test="hide_animated_sidebar">
          <i class="form-icon"></i> <span v-i18n>Hide sidebar notification</span>
        </label>
      </div>
      <div class="preferences_panel_item">
        <label class="form-switch">
          <input type="checkbox" v-on:change="updatePreferences" v-model="prefs.hide_tile_confirmation" data-test="hide_tile_confirmation">
          <i class="form-icon"></i> <span v-i18n>Hide tile confirmation</span>
        </label>
      </div>
      <div class="preferences_panel_item">
        <label class="form-switch">
          <input type="checkbox" v-on:change="updatePreferences" v-model="prefs.learner_mode" data-test="learner_mode">
          <i class="form-icon"></i>
          <span v-i18n>Learner Mode (req. refresh)</span>
          <span class="tooltip tooltip-left" :data-tooltip="$t('Show information that can be helpful\n to players who are still learning the games')">&#9432;</span>
        </label>
      </div>

      <div class="preferences_panel_item">
        <label class="form-switch">
          <input type="checkbox" v-on:change="updatePreferences" v-model="prefs.symbol_overlay" data-test="symbol_overlay">
          <i class="form-icon"></i>
          <span v-i18n>Symbol Overlay</span>
          <span class="tooltip tooltip-left" :data-tooltip="$t('Add symbols on top of player colors.')">&#9432;</span>
        </label>
      </div>

      <div class="preferences_panel_item">
        <label class="form-switch">
          <input type="checkbox" v-on:change="updatePreferences" v-model="prefs.animated_title" data-test="animated_title">
          <i class="form-icon"></i>
          <span v-i18n>Animated Title</span>
          <span class="tooltip tooltip-left" :data-tooltip="$t('Show spinning circle in window title on your turn.')">&#9432;</span>
        </label>
      </div>

      <div class="preferences_panel_item">
        <label class="form-switch">
          <input type="checkbox" v-on:change="updatePreferences" v-model="prefs.experimental_ui" data-test="experimental_ui">
          <i class="form-icon"></i>
          <span v-i18n>Experimental UI</span>
          <span class="tooltip tooltip-left" :data-tooltip="$t('Test out any possible new experimental UI features for feedback.')">&#9432;</span>
        </label>
      </div>
      <div class="preferences_panel_item">
        <label class="form-switch">
          <input type="checkbox" v-on:change="updatePreferences" v-model="prefs.debug_view" data-test="debug_view">
          <i class="form-icon"></i>
          <span v-i18n>Debug View</span>
          <span class="tooltip tooltip-left" :data-tooltip="$t('Add information useful for development and debugging.')">&#9432;</span>
        </label>
      </div>

      <div class="preferences_panel_actions">
        <button class="btn btn-lg btn-primary" v-on:click="okClicked" v-i18n>Ok</button>
        <button class="btn btn-lg btn-primary" v-on:click="showBugDialog" v-i18n>Report a bug</button>
      </div>
    </div>
</template>

<script setup vapor lang="ts">
import {ref} from 'vue';

import {PreferencesManager, Preference} from '@/client/utils/PreferencesManager';
import {$t} from '@/client/directives/i18n';
import {vI18n} from '@/client/directives/vDirectives';
import {openDiagnosticsOverlay} from '@/client/diagnostics/diagnosticsOverlayBridge';


defineOptions({name: 'PreferencesDialog'});
const props = defineProps({
  preferencesManager: {
    type: Object as () => PreferencesManager,
    required: true,
  },
});
const emit = defineEmits(['okButtonClicked']);

const prefs = ref({...props.preferencesManager.values()});
/**
 * «Report a bug» is the GAME'S OWN report (docs/claude/diagnostics.md): the diagnostics surface, on its report step —
 * a package for this fork's developer with a code. (It used to open a dialog that sent the player to the ORIGINAL
 * project's GitHub and Discord — upstream cannot act on a bug of this fork, and the text it offered to paste carried
 * the player's id.)
 */
function showBugDialog() {
  openDiagnosticsOverlay({to: 'report'});
}
function setBoolPreferencesCSS(
  target: HTMLElement,
  val: boolean,
  name: Preference,
): void {
  const cssClassSuffix = name;
  if (val) {
    target.classList.add('preferences_' + cssClassSuffix);
  } else {
    target.classList.remove('preferences_' + cssClassSuffix);
  }
}
function updatePreferences(): void {
  for (const k of Object.keys(props.preferencesManager.values()) as Array<Preference>) {
    const val = prefs.value[k];
    props.preferencesManager.set(k, val, /* setOnChange */ true);
  }
}
function syncPreferences(): void {
  const target = document.getElementById('ts-preferences-target');
  if (!target) {
    return;
  }

  for (const k of Object.keys(prefs.value) as Array<Preference>) {
    if (k === 'lang') {
      continue;
    }
    setBoolPreferencesCSS(target, prefs.value[k], k);
  }

  if (!target.classList.contains('language-' + prefs.value.lang)) {
    target.classList.add('language-' + prefs.value.lang);
  }
  // Also stamp the language on <html> so language-scoped CSS that must reach
  // body-TELEPORTED overlays (e.g. the selected-card "ВЫБРАНА" ribbon, whose
  // text comes from the `--cab-selected-label` custom property) resolves
  // there too — `#ts-preferences-target` does not contain those teleports.
  document.documentElement.setAttribute('data-lang', prefs.value.lang);
}
function okClicked(): void {
  emit('okButtonClicked');
}
</script>
