import {test, expect} from '@playwright/test';

/**
 * Smoke test — the app boots and the Vue root renders the MAIN MENU.
 *
 * Deliberately shallow: its only job is to prove the E2E harness can reach the
 * running app and that the client bundle executed. Every other spec builds on
 * this, so when the suite goes red wholesale, this is the first thing to read —
 * green here means "the app is fine, the specs are wrong".
 *
 * It used to assert `.start-screen` / `.start-screen-title-top` — the FROZEN
 * desktop entry screen (see docs/DESKTOP_DEPRECATION_AUDIT.md). Console native
 * is the default shell now and boots `PremiumMainMenu`, so the old selectors
 * matched nothing and the smoke test reported the whole app as broken while it
 * was working perfectly. Assert what the product actually renders.
 */
test.describe('app smoke', () => {
  test('loads the main menu', async ({page}) => {
    await page.goto('/');

    // SEMANTIC, not structural. A smoke test must survive every re-skin the
    // console gets, so it asserts the landmarks the menu is REQUIRED to expose
    // rather than a class name — the previous version died on `.start-screen`
    // and reported the whole app as broken while it worked.
    //
    // The accessible NAME is deliberately not matched: `aria-label` runs through
    // the i18n directive, so it reads «Главное меню» on this fork. Matching it
    // would turn a locale change into a mystery failure — the same trap
    // `consoleStart.ts` documents.
    await expect(page.getByRole('navigation')).toBeVisible();
    // The wordmark is split across elements, so the accessible text reads
    // «TERRAFORMINGMARS…» with no separator — match the stem, not the phrase.
    await expect(page.getByRole('banner')).toContainText('TERRAFORMING');

    // The primary entry point exists and is reachable.
    await expect(page.getByRole('button').first()).toBeVisible();

    // #app must contain rendered DOM (guards against a blank mount / JS error).
    await expect(page.locator('#app')).not.toBeEmpty();
  });
});
