import {test, expect, Page} from './consoleTest';
import {finiteMotion, reloadMenu, settle} from './consoleStart';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Console-native MULTI-PROFILE roster (main menu → Player profile → Profiles).
 * Drives the pre-game console main menu with the mouse (the @click fallbacks the
 * pad screens also expose) and exercises the whole feature end-to-end:
 *   - the roster is the source of truth for the active identity (header mirror),
 *   - switch the active profile to a previous one,
 *   - delete a profile,
 *   - add a new profile through the on-screen keyboard,
 *   - and it all persists across a reload.
 */

const OUT = path.resolve('screenshots', 'console-profiles');

async function shoot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT, {recursive: true});
  await page.screenshot({path: path.join(OUT, `${name}.png`)});
}

/**
 * THE MENU AT REST (FLAKE ZERO, class G) — the state a pause used to stand in for: the console's own quiet (`settle`;
 * the pre-game menu has no readiness probe, so it is the short quiet window), then no finite motion left on the page
 * (an overlay's entrance, a row's highlight). Softly bounded, like `settle`'s own motion wait: a motion that never
 * ends is a standing state, never a reason to fail a frame that is only evidence.
 */
async function menuAtRest(page: Page): Promise<void> {
  await settle(page);
  await expect.poll(() => finiteMotion(page), {timeout: 5_000, message: 'the menu holds still'}).toBe(0)
    .catch(() => undefined);
}

test.describe('console profiles roster', () => {
  test.use({viewport: {width: 1920, height: 1080}, deviceScaleFactor: 1});

  test('switch / delete / add profiles from the main menu, persisted', async ({page}) => {
    test.setTimeout(120_000);

    // Seed a roster ONCE (only when absent) so a reload keeps the mutations we
    // make below rather than re-seeding the original three. No legacy
    // tm_player_identity key — proving the roster→identity mirror runs on mount.
    await page.addInitScript(() => {
      if (localStorage.getItem('tm_player_profiles') === null) {
        localStorage.setItem('tm_player_profiles', JSON.stringify({
          profiles: [
            {id: 'pa', displayName: 'Alice', cubeColor: 'red'},
            {id: 'pb', displayName: 'Bob', cubeColor: 'blue'},
            {id: 'pc', displayName: 'Carol', cubeColor: 'green'},
          ],
          activeId: 'pa',
        }));
      }
    });

    await page.goto('/?console=1&consoleProfile=auto');
    await page.waitForSelector('.cm-menu', {timeout: 45_000});
    await menuAtRest(page);

    // The active profile (Alice) is mirrored into the header even though only
    // the roster key was seeded (no legacy identity).
    await expect(page.locator('.cm-identity__name')).toHaveText('Alice');
    await shoot(page, '01-menu-active-alice');

    // Open the profile editor via the identity chip.
    await page.locator('.cm-identity').click();
    await page.waitForSelector('.cm-overlay__title', {timeout: 10_000});
    await expect(page.locator('.cm-overlay__title', {hasText: 'Профиль игрока'})).toHaveCount(1);
    await shoot(page, '02-profile-editor');

    // Open the Profiles roster (click the Profiles field's label).
    await page.locator('.cm-field:has(.cm-field__label:text-is("Профили")) .cm-field__label').click();
    await page.waitForSelector('.cm-profile', {timeout: 10_000});

    // Three saved profiles + Alice active.
    await expect(page.locator('.cm-profile__name')).toHaveText(['Alice', 'Bob', 'Carol', 'Новый профиль']);
    await expect(page.locator('.cm-profile--active .cm-profile__name')).toHaveText('Alice');
    await menuAtRest(page);
    await shoot(page, '03-roster-alice-active');

    // Switch the active player to Bob (jump to a previous profile).
    await page.locator('.cm-profile:has(.cm-profile__name:text-is("Bob"))').click();
    await expect(page.locator('.cm-profile--active .cm-profile__name')).toHaveText('Bob');
    await menuAtRest(page);
    await shoot(page, '04-switched-to-bob');

    // Delete Carol (the ✕ on her row).
    await page.locator('.cm-profile:has(.cm-profile__name:text-is("Carol")) .cm-friend__remove').click();
    await expect(page.locator('.cm-profile__name')).toHaveText(['Alice', 'Bob', 'Новый профиль']);
    await menuAtRest(page);
    await shoot(page, '05-carol-deleted');

    // Add a brand-new profile through the on-screen keyboard.
    await page.locator('.cm-profile--add').click();
    await page.waitForSelector('[data-skbtn]', {timeout: 10_000});
    await menuAtRest(page);
    // Each key is verified by its EFFECT — the draft's own counter grows by one (act → verify), never a pause between
    // two clicks.
    const typed = page.locator('.cm-vk-field__count');
    const typedBefore = Number((await typed.innerText()).split('/')[0]);
    for (const [i, ch] of ['d', 'a', 'n'].entries()) {
      await page.locator(`.hg-button[data-skbtn="${ch}"]`).first().click();
      await expect(typed, `the on-screen key «${ch}» typed into the draft`).toHaveText(new RegExp(`^\\s*${typedBefore + i + 1}\\s*/`));
    }
    await shoot(page, '06-typing-new-name');
    await page.locator('.cm-vk__key--done').click(); // commit

    // The new profile is added AND active.
    await expect(page.locator('.cm-profile__name')).toContainText(['dan']);
    await expect(page.locator('.cm-profile--active .cm-profile__name')).toHaveText('dan');
    await menuAtRest(page);
    await shoot(page, '07-added-dan-active');

    // Close the overlays back to the menu — the header reflects the active player. Each B waits for the overlay it
    // closes to LEAVE (the state), never a guessed pause; the assertion below is the verdict.
    await page.keyboard.press('Escape'); // roster → profile editor
    await page.locator('.cm-profile').first().waitFor({state: 'detached', timeout: 10_000}).catch(() => undefined);
    await page.keyboard.press('Escape'); // profile editor → menu
    await page.locator('.cm-overlay__title', {hasText: 'Профиль игрока'}).first()
      .waitFor({state: 'detached', timeout: 10_000}).catch(() => undefined);
    await expect(page.locator('.cm-identity__name')).toHaveText('dan');
    await menuAtRest(page);
    await shoot(page, '08-menu-active-dan');

    // Persistence: reload (the init script won't re-seed since the key exists).
    await reloadMenu(page);
    await page.waitForSelector('.cm-menu', {timeout: 45_000});
    await menuAtRest(page);
    await expect(page.locator('.cm-identity__name')).toHaveText('dan');
    // Re-open the roster and confirm the persisted state (Carol gone, dan present).
    await page.locator('.cm-identity').click();
    await page.waitForSelector('.cm-overlay__title', {timeout: 10_000});
    await page.locator('.cm-field:has(.cm-field__label:text-is("Профили")) .cm-field__label').click();
    await page.waitForSelector('.cm-profile', {timeout: 10_000});
    await expect(page.locator('.cm-profile__name')).toHaveText(['Alice', 'Bob', 'dan', 'Новый профиль']);
    await expect(page.locator('.cm-profile--active .cm-profile__name')).toHaveText('dan');
    await menuAtRest(page);
    await shoot(page, '09-persisted-after-reload');
  });
});
