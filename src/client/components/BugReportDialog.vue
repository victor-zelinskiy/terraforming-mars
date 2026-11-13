<template>
  <dialog ref="dialog" class="bug-dialog">
    <p class="center"><span v-i18n>Copy the text below and then paste it in</span><br>
        <a href="https://github.com/terraforming-mars/terraforming-mars/issues/new?template=from-heroku.md" target="_blank"  v-i18n>a GitHub issue</a>
        <span v-i18n>or the</span> <a href="https://discord.com/channels/737945098695999559/742721510376210583" target="_blank"  v-i18n>#bug-reports Discord channel</a>
    </p>
    <textarea ref="textarea" readonly rows="6" cols = "50" v-model="message"></textarea>
    <div class="dialog-menu centered-content">
      <div>
        <button class="btn btn-lg btn-primary" @click="copyTextArea" v-i18n>Copy to Clipboard</button>
        <div :class="{ center: true, invisible: !showCopied }" v-i18n>Copied!</div>
      </div>
      <form method="dialog">
        <button class="btn btn-lg" v-i18n>Close</button>
      </form>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import {onMounted, ref, useTemplateRef} from 'vue';
import {useClipboard} from '@vueuse/core';
import {showModal, windowHasHTMLDialogElement} from '@/client/components/HTMLDialogElementCompatibility';
import raw_settings from '@/genfiles/settings.json';
import {useAppRoot} from '@/client/components/appRoot';
import {vI18n} from '@/client/directives/vDirectives';
import {getPreferences} from '../utils/PreferencesManager';

import dialogPolyfill from 'dialog-polyfill';


function browser(): string {
  // Taken from https://stackoverflow.com/questions/5916900/how-can-you-detect-the-version-of-a-browser
  const ua= navigator.userAgent;
  let match = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
  if (/trident/i.test(match[1])) {
    const temp = /\brv[ :]+(\d+)/g.exec(ua) || [];
    return 'IE '+(temp[1] || '');
  }
  if (match[1]=== 'Chrome') {
    const temp = ua.match(/\b(OPR|Edge)\/(\d+)/);
    if (temp !== null) {
      return temp.slice(1).join(' ').replace('OPR', 'Opera');
    }
  }
  match = match[2] ? [match[1], match[2]] : [navigator.appName, navigator.appVersion, '-?'];
  const temp = ua.match(/version\/(\d+)/i);
  if (temp !== null) {
    match.splice(1, 1, temp[1]);
  }
  return match.join(' ');
}

defineOptions({name: 'BugReportDialog'});

// the app root's port (R26): `undefined` outside the application — the report then carries no game, as it does on a
// screen that has none
const root = useAppRoot();
// VueUse clipboard (navigator.clipboard + execCommand legacy fallback — the
// direct writeText here had NO fallback for older browsers).
const {copy: clipboardCopy} = useClipboard({legacy: true});
const dialog = useTemplateRef<HTMLDialogElement>('dialog');
const textarea = useTemplateRef<HTMLTextAreaElement>('textarea');
const message = ref('');
const showCopied = ref(false);
function show() {
  const el = dialog.value;
  if (el === null) {
    return;
  }
  showModal(el);
}
function copyTextArea() {
  const el = textarea.value;
  if (el === null) {
    return;
  }
  el.select();
  void clipboardCopy(el.value);
  showCopied.value = true;
}
function url() {
  return new URL(window.location.href);
}
function setMessage() {
  const playerView = root?.playerView;
  const content: Record<string, any> = {
    url: url(),
  };
  if (playerView !== undefined) {
    Object.assign(
      content,
      {
        color: playerView.thisPlayer.color,
        expansions: Object.entries(playerView.game.gameOptions.expansions)
          .filter(([_k, v]) => v === true)
          .map(([k, _v]) => k)
          .join(', '),
        step: playerView.game.step,
      });
  }
  if (playerView?.game?.turmoil) {
    content['party'] = playerView.game.turmoil.ruling ?? 'None';
  }
  Object.assign(content,
    {
      version: raw_settings.head,
      builtAt: raw_settings.builtAt,
      browser: browser(),
      language: getPreferences().lang,
      experimental_ui: getPreferences().experimental_ui,
    });
  message.value = JSON.stringify(content, null, 2);
}

onMounted(() => {
  if (!windowHasHTMLDialogElement()) {
    const el = dialog.value;
    if (el === null) {
      return;
    }
    dialogPolyfill.registerDialog(el);
  }
  setMessage();
});
// What `PreferencesDialog` reaches through its `ref="bugDialog"` — `show()` — and nothing else.
defineExpose({show});
</script>
