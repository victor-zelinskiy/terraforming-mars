import {createApp, defineAsyncComponent} from 'vue';

import {trimEmptyTextNodes} from '@/client/directives/TrimWhitespace';
import App from '@/client/components/App.vue';
import {getPreferences} from '@/client/utils/PreferencesManager';

import i18nPlugin from '@/client/plugins/i18n.plugin';
import {startOauth} from '@/client/oauth';
import {perfMark, perfMeasure, startLongTaskObserver} from '@/client/utils/perfMarks';
import {applyMotionCssScale} from '@/client/components/motion/motionTokens';
const PlayerInputFactory = defineAsyncComponent(() => import(/* webpackChunkName: "player-input" */ '@/client/components/PlayerInputFactory.vue'));
// Registered globally so ModernOptionPicker can host a nested input recursively
// via `<modal-input-host>` WITHOUT a static import — breaks the
// ModalInputHost <-> ModernOptionPicker type cycle the same way
// `player-input-factory` does for OrOptions. See WaitingFor modal routing.
const ModalInputHost = defineAsyncComponent(() => import(/* webpackChunkName: "player-input" */ '@/client/components/modalInputs/ModalInputHost.vue'));
// Registered globally so ColonyTradePaymentModal can host the card-target
// picker WITHOUT a static import — Card.vue's import chain breaks the
// mochapack client-test bundle (the known baseline class), and the picker
// only renders when a trade actually has card-target steps.
const ActionTargetCard = defineAsyncComponent(() => import(/* webpackChunkName: "player-input" */ '@/client/components/actions/ActionTargetCard.vue'));

declare global {
  interface Window {
    _translations: { [key: string]: string } | undefined;
  }
}

async function bootstrap() {
  startLongTaskObserver();
  perfMark('app:bootstrap:start');
  // Write the motion speed preset to the CSS bridge (`--motion-scale` on
  // <html>) before anything renders, so CSS animation durations and the
  // JS-side motionMs() timings scale in lockstep from the first frame.
  applyMotionCssScale();
  const lang = getPreferences().lang;

  // Stamp the active language on <html> at bootstrap (guaranteed to run before
  // anything renders). Language-scoped CSS that must reach body-TELEPORTED
  // overlays — e.g. the selected-card "ВЫБРАНА" ribbon, whose text comes from
  // the `--cab-selected-label` custom property set on `html[data-lang="ru"]` —
  // resolves through this, because the `.language-*` class only lives on
  // `#ts-preferences-target`, which does NOT contain those teleports.
  document.documentElement.setAttribute('data-lang', lang);

  if (lang !== 'en') {
    try {
      window._translations = await fetch(`assets/locales/${lang}.json`).then((res) => res.json());
      // TODO - add a nice loader for this fetch
    } catch (err) {
      console.warn(`Cannot load ${lang} translations. See network for details.`);
    }
  }

  const app = createApp(App);

  app.use(i18nPlugin);

  app.component('player-input-factory', PlayerInputFactory);
  app.component('modal-input-host', ModalInputHost);
  app.component('action-target-card', ActionTargetCard);

  app.directive('trim-whitespace', {
    mounted: trimEmptyTextNodes,
    updated: trimEmptyTextNodes,
  });

  // Service workers are only supported on http/https origins. Under the Electron
  // desktop shell's custom `app://` scheme (and file://) registration is
  // unsupported and the SW is an empty no-op anyway, so skip it there — keeps the
  // browser behavior identical while avoiding a rejected registration in Electron.
  const swScheme = window.location.protocol;
  if (window.isSecureContext && (swScheme === 'http:' || swScheme === 'https:') && 'serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('sw.js').then(function(registration) {
        console.log('registered the service worker', registration);
      });
    });
  }

  app.mount('#app');
  perfMeasure('app:bootstrap', 'app:bootstrap:start');

  window.onload = startOauth;
}

bootstrap();
