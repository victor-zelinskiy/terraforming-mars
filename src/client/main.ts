import {createApp, vaporInteropPlugin} from 'vue';

import {trimEmptyTextNodes} from '@/client/directives/TrimWhitespace';
import App from '@/client/components/App.vue';
import {getPreferences} from '@/client/utils/PreferencesManager';

import i18nPlugin from '@/client/plugins/i18n.plugin';
import {startOauth} from '@/client/oauth';
import {perfMark, perfMeasure, startLongTaskObserver} from '@/client/utils/perfMarks';
import {applyMotionCssScale, onMotionFpsCapChange} from '@/client/components/motion/motionTokens';
import {applyGsapTickerFps} from '@/client/components/motion/gsapMotionBridge';
import {applyConsoleFxLiteClass} from '@/client/console/consoleFxLite';
import {applyReducedMotionClass} from '@/client/utils/reducedMotion';
import {applyConsoleReadingScale} from '@/client/console/consoleReadingScale';
import {installConsoleLayoutProfile} from '@/client/console/consoleLayoutProfile';
import {warmDisplayFonts} from '@/client/utils/fontWarmup';
import {installVueErrorReport} from '@/client/console/vueErrorReport';
// The three components that are ASYNC ON PURPOSE (`components/asyncComponents.ts` says why each is): registered by
// name below for the Options-API components that still reach them that way; a `<script setup>` component imports the
// same binding instead.
import {ActionTargetCard, ConsoleSourceDock, PremiumCardFace} from '@/client/components/asyncComponents';

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
  // Bridge the FPS cap onto GSAP's global ticker so the player's Animation-rate
  // preference reaches the heavy card-deal / FLIP cinematics (motionFpsCap alone
  // only throttles createFrameGate loops). 'auto' = native rAF (unchanged).
  // Registering (rather than calling) also applies every LATER change — the
  // settings surface just persists the cap and never touches gsap itself.
  onMotionFpsCapChange((cap) => applyGsapTickerFps(cap));
  // Apply the reduced-graphics class + the reduced-motion class bridge from
  // the persisted preferences before first paint (both live-toggleable).
  applyConsoleFxLiteClass();
  applyReducedMotionClass();
  // Publish the reading-text scale (`--con-read-scale`) before first paint,
  // so the rules/lore surfaces never re-wrap after mount.
  applyConsoleReadingScale();
  // Resolve the DISPLAY PROFILE (`--con-ui-scale` + html.con-profile-*)
  // before first paint too. It used to install only with GamepadLayer —
  // i.e. after the first route resolution — so on a 4K TV the whole boot
  // curtain painted unscaled and visibly re-composed the moment the layer
  // mounted. Idempotent; GamepadLayer's later call is a no-op.
  installConsoleLayoutProfile();
  // Request the display faces the cinematics carry NOW: a face first used by a
  // flight re-lays out the whole document mid-flight (fontWarmup.ts).
  warmDisplayFonts();
  const lang = getPreferences().lang;

  // Stamp the active language on <html> at bootstrap (guaranteed to run before
  // anything renders). Language-scoped CSS that must reach body-TELEPORTED
  // overlays — e.g. the selected-card "ВЫБРАНА" ribbon, whose text comes from
  // the `--cab-selected-label` custom property set on `html[data-lang="ru"]` —
  // resolves through this, because the `.language-*` class only lives on
  // `#ts-preferences-target`, which does NOT contain those teleports.
  document.documentElement.setAttribute('data-lang', lang);
  // The real `lang` attribute too (not only the data- mirror): CSS
  // `hyphens: auto` resolves its dictionary from the element's language,
  // so Russian hyphenation on the reading surfaces (card rules / lore)
  // works only with this set — and assistive tech reads the right voice.
  document.documentElement.lang = lang;

  if (lang !== 'en') {
    try {
      window._translations = await fetch(`assets/locales/${lang}.json`).then((res) => res.json());
      // TODO - add a nice loader for this fetch
    } catch (err) {
      console.warn(`Cannot load ${lang} translations. See network for details.`);
    }
  }

  const app = createApp(App);
  installVueErrorReport(app);
  // THE ROAD TO `createVaporApp(App)` (docs/claude/vapor/ROADMAP.md): until the last component is converted the app is
  // a virtual-DOM one in which Vapor components (`<script setup vapor>`) and virtual-DOM components host each other —
  // this plugin is what lets them. It goes with the switch of V4 (a Vapor app needs no interop).
  app.use(vaporInteropPlugin);

  app.use(i18nPlugin);

  app.component('action-target-card', ActionTargetCard);
  app.component('premium-card-face', PremiumCardFace);
  app.component('console-source-dock', ConsoleSourceDock);

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
