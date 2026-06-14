import {test, expect} from '@playwright/test';

/**
 * Smoke test — verifies the app boots and the Vue root mounts the start screen.
 *
 * This is deliberately shallow: its only job is to prove the E2E harness can
 * reach the running app and that the client bundle renders. Modal / overlay /
 * visual-regression specs build on top of this infrastructure later.
 */
test.describe('app smoke', () => {
  test('loads the start screen', async ({page}) => {
    await page.goto('/');

    // The Vue app mounts into #app; once it renders, the start screen appears.
    const startScreen = page.locator('.start-screen');
    await expect(startScreen).toBeVisible();

    // The headline and the primary "New game" entry point are the canonical
    // signal that the client bundle executed and rendered, not just an empty
    // index.html shell. Assert presence/non-emptiness rather than exact text:
    // the title runs through the i18n directive, so its content depends on the
    // active locale (e.g. "ПОКОРЕНИЕ" on the ru fork).
    const title = page.locator('.start-screen-title-top');
    await expect(title).toBeVisible();
    await expect(title).not.toBeEmpty();
    await expect(page.locator('.start-screen-link--new-game')).toBeVisible();

    // #app must contain rendered DOM (guards against a blank mount / JS error).
    await expect(page.locator('#app')).not.toBeEmpty();
  });
});
