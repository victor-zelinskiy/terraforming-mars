// FIRST, before any other module of the app is evaluated: the page's one diagnostic interceptor (an error thrown while
// the graph below loads is a record too — `diagnostics/diagnosticsBoot.ts`).
import '@/client/diagnostics/diagnosticsBoot';
import {createVaporApp} from 'vue';

import App from '@/client/components/App.vue';
import {getPreferences} from '@/client/utils/PreferencesManager';

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
import {installDiagnosticsJournal} from '@/client/diagnostics/diagnosticsJournalState';
import {installDiagnosticsProbe} from '@/client/diagnostics/diagnosticsSurface';

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

  // ONE VAPOR APPLICATION (the north star, V4 — docs/claude/vapor/ROADMAP.md): every component of the client is a
  // Vapor component, so the app is created by `createVaporApp` and there is NO virtual-DOM renderer behind it — no
  // `vaporInteropPlugin` either: nothing is left for it to host (a lazy component is `lazyComponent`, the Vapor async
  // wrapper). A virtual-DOM component rendered here would not mount; the readiness ledger fails the file that adds one.
  // (The cast is for the PLAIN compiler of the webpack build: its `*.vue` shim types every component as a virtual-DOM
  // one. vue-tsc reads the SFC itself and needs none.)
  const app = createVaporApp(App as unknown as Parameters<typeof createVaporApp>[0]);
  installVueErrorReport(app);
  // The journal's reactive face and its mirror in the diagnostics hub (the interceptor itself stands since the first
  // import of this file): what the page recorded so far goes to the hub, what the hub holds of earlier pages comes back.
  installDiagnosticsJournal();
  installDiagnosticsProbe();

  // NOTHING IS REGISTERED ON THE APP (ROADMAP § 4a · B10): no global component, no global directive, no global
  // property. Every component imports what it renders and calls (`$t` from `directives/i18n`, the directives from
  // `directives/vDirectives`, the three lazy tags from `components/asyncComponents`) — a Vapor component reads no
  // global, and the readiness ledger fails one that leans on any.

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
