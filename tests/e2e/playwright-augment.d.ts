/*
 * TYPE AUGMENTATION for @playwright/test — the `screen` context option.
 *
 * `test.use({screen})` is SUPPORTED at runtime and documented by Playwright
 * itself (test.d.ts § test.use: «…`reducedMotion`, `contrast`, `screen`,
 * `userAgent`, `viewport`…»), but the installed version's
 * `PlaywrightTestOptions` interface simply does not declare it — so the 90+
 * profile-matrix specs that emulate a display size (`viewport` +
 * `deviceScaleFactor` + `screen`) failed the e2e typecheck on a correct call.
 * This closes the gap; delete it when a Playwright upgrade declares the
 * option itself (tsc will then flag this file as a duplicate declaration —
 * that IS the reminder).
 */
import '@playwright/test';

declare module '@playwright/test' {
  interface PlaywrightTestOptions {
    /** Emulated consistent `window.screen` size (a browser-context option). */
    screen?: {width: number, height: number};
    /** `prefers-reduced-motion` emulation (a browser-context option). */
    reducedMotion?: null | 'reduce' | 'no-preference';
  }
}
